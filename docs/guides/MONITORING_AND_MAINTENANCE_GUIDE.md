# Monitoring & Maintenance Guide

## 📊 Production Monitoring Setup

### 1. PM2 Log Rotation (Critical)

```bash
# Install PM2 log rotation module
pm2 install pm2-logrotate

# Configure log rotation settings
pm2 set pm2-logrotate:max_size 10M          # Max log file size
pm2 set pm2-logrotate:retain 7              # Keep 7 rotated files
pm2 set pm2-logrotate:compress true         # Gzip old logs
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss
pm2 set pm2-logrotate:rotateModule true     # Rotate PM2's own logs

# Verify configuration
pm2 conf pm2-logrotate

# Check current log sizes
du -sh /var/log/crm/*
du -sh ~/.pm2/logs/*
```

### 2. System Log Rotation

```bash
# Configure logrotate for Nginx
sudo nano /etc/logrotate.d/nginx

# Ensure it contains:
/var/log/nginx/*.log {
    daily
    missingok
    rotate 30
    compress
    notifempty
    sharedscripts
    postrotate
        systemctl reload nginx
    endscript
}

# Test logrotate
sudo logrotate -d /etc/logrotate.d/nginx
```

### 3. External Uptime Monitoring

#### UptimeRobot (Free Option)

1. **Create Account**
   - Go to https://uptimerobot.com
   - Sign up for free account

2. **Add Monitors**
   ```
   Monitor 1:
   - Type: HTTPS
   - URL: https://api.yourdomain.com/health
   - Name: CRM API Health Check
   - Check Interval: 5 minutes

   Monitor 2:
   - Type: HTTPS  
   - URL: https://app.yourdomain.com
   - Name: CRM Frontend
   - Check Interval: 5 minutes
   ```

3. **Configure Alerts**
   - Email notifications for downtime
   - SMS alerts (if premium)
   - Webhook notifications (optional)

#### Alternative: StatusCake, Pingdom, or DataDog

### 4. Error Tracking (Sentry - Optional)

If you have Sentry configured:

```bash
# Verify Sentry DSN in environment
cd /srv/crm/backend
grep SENTRY_DSN .env

# Test error reporting (optional)
node -e "
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });
Sentry.captureMessage('Test deployment message');
"
```

### 5. Database Monitoring

#### Supabase Dashboard Monitoring

1. **Enable Monitoring**
   - Login to Supabase dashboard
   - Go to Settings → Monitoring
   - Enable query performance tracking
   - Set up slow query alerts

2. **Database Metrics to Watch**
   - Connection count
   - Query performance
   - Storage usage
   - Backup status

## 🔧 Automated Maintenance Tasks

### 1. Daily Health Checks (Cron Job)

Create automated health check script:

```bash
# Create health check script
nano /srv/crm/scripts/health-check.sh
```

```bash
#!/bin/bash
# Daily health check script

LOG_FILE="/var/log/crm/health-check.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting health check..." >> $LOG_FILE

# Check PM2 processes
echo "[$DATE] Checking PM2 processes..." >> $LOG_FILE
pm2 list | grep -E "(online|stopped)" >> $LOG_FILE

# Check disk space
echo "[$DATE] Checking disk space..." >> $LOG_FILE
df -h | grep -E "(/$|/srv)" >> $LOG_FILE

# Check memory usage
echo "[$DATE] Checking memory usage..." >> $LOG_FILE
free -h >> $LOG_FILE

# Check API health
echo "[$DATE] Testing API health..." >> $LOG_FILE
if curl -s https://api.yourdomain.com/health | grep -q "ok"; then
    echo "[$DATE] API health check: PASSED" >> $LOG_FILE
else
    echo "[$DATE] API health check: FAILED" >> $LOG_FILE
    # Send alert email if needed
fi

# Check SSL certificate expiry
echo "[$DATE] Checking SSL certificate..." >> $LOG_FILE
openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com 2>/dev/null | \
openssl x509 -noout -dates >> $LOG_FILE

echo "[$DATE] Health check completed." >> $LOG_FILE
echo "" >> $LOG_FILE
```

```bash
# Make script executable
chmod +x /srv/crm/scripts/health-check.sh

# Add to cron (run daily at 6 AM)
crontab -e
# Add this line:
# 0 6 * * * /srv/crm/scripts/health-check.sh
```

### 2. Weekly Maintenance Script

```bash
# Create weekly maintenance script  
nano /srv/crm/scripts/weekly-maintenance.sh
```

```bash
#!/bin/bash
# Weekly maintenance tasks

LOG_FILE="/var/log/crm/maintenance.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

echo "[$DATE] Starting weekly maintenance..." >> $LOG_FILE

# Update system packages (security updates only)
echo "[$DATE] Updating security packages..." >> $LOG_FILE
sudo apt update && sudo apt upgrade -y --security >> $LOG_FILE 2>&1

# Clean old logs
echo "[$DATE] Cleaning old logs..." >> $LOG_FILE
find /var/log/crm -name "*.log" -mtime +30 -delete
find ~/.pm2/logs -name "*.log" -mtime +30 -delete

# Restart PM2 processes (zero-downtime)
echo "[$DATE] Reloading PM2 processes..." >> $LOG_FILE
pm2 reload all

# Clean package cache
echo "[$DATE] Cleaning package cache..." >> $LOG_FILE
sudo apt autoremove -y >> $LOG_FILE 2>&1
npm cache clean --force >> $LOG_FILE 2>&1

echo "[$DATE] Weekly maintenance completed." >> $LOG_FILE
```

```bash
# Make executable and add to cron (Sundays at 3 AM)
chmod +x /srv/crm/scripts/weekly-maintenance.sh
crontab -e
# Add: 0 3 * * 0 /srv/crm/scripts/weekly-maintenance.sh
```

## 🚨 Alert Configuration

### 1. Email Alerts for Critical Issues

Create alert script:

```bash
nano /srv/crm/scripts/send-alert.sh
```

```bash
#!/bin/bash
# Send email alerts (requires mailutils or postfix)

SUBJECT="$1"
MESSAGE="$2"
TO_EMAIL="admin@yourdomain.com"

# Send email (configure mail server first)
echo "$MESSAGE" | mail -s "$SUBJECT" "$TO_EMAIL"

# Alternative: Use curl with email service
# curl -X POST "https://api.mailgun.com/v3/YOUR_DOMAIN/messages" \
#   -u "api:YOUR_API_KEY" \
#   -F "from=alerts@yourdomain.com" \
#   -F "to=$TO_EMAIL" \
#   -F "subject=$SUBJECT" \
#   -F "text=$MESSAGE"
```

### 2. Process Monitoring Script

```bash
nano /srv/crm/scripts/process-monitor.sh
```

```bash
#!/bin/bash
# Monitor critical processes

check_process() {
    local service=$1
    local process_name=$2
    
    if ! pm2 list | grep -q "$process_name.*online"; then
        echo "ALERT: $service is down!" 
        /srv/crm/scripts/send-alert.sh "CRM Alert: $service Down" "The $service process is not running. Please check immediately."
        
        # Auto-restart attempt
        pm2 restart $process_name
    fi
}

# Check main services
check_process "API Server" "crm-api"
check_process "Worker Process" "crm-worker"

# Check system resources
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
DISK_USAGE=$(df / | tail -1 | awk '{printf "%.0f", $5}' | sed 's/%//')

if [ "$MEMORY_USAGE" -gt 90 ]; then
    /srv/crm/scripts/send-alert.sh "CRM Alert: High Memory Usage" "Memory usage is at ${MEMORY_USAGE}%"
fi

if [ "$DISK_USAGE" -gt 85 ]; then
    /srv/crm/scripts/send-alert.sh "CRM Alert: High Disk Usage" "Disk usage is at ${DISK_USAGE}%"
fi
```

```bash
# Run every 5 minutes
chmod +x /srv/crm/scripts/process-monitor.sh
crontab -e
# Add: */5 * * * * /srv/crm/scripts/process-monitor.sh
```

## 📈 Performance Monitoring

### 1. Resource Usage Tracking

```bash
# Create performance monitoring script
nano /srv/crm/scripts/perf-monitor.sh
```

```bash
#!/bin/bash
# Performance monitoring and logging

PERF_LOG="/var/log/crm/performance.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# System metrics
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
MEMORY_USAGE=$(free | grep Mem | awk '{printf "%.1f", $3/$2 * 100.0}')
LOAD_AVERAGE=$(uptime | awk -F'load average:' '{print $2}')
DISK_USAGE=$(df / | tail -1 | awk '{print $5}')

echo "[$DATE] CPU: ${CPU_USAGE}%, Memory: ${MEMORY_USAGE}%, Load: ${LOAD_AVERAGE}, Disk: ${DISK_USAGE}" >> $PERF_LOG

# PM2 process metrics
pm2 jlist | jq -r '.[] | "\(.name): CPU: \(.monit.cpu)%, Memory: \(.monit.memory / 1024 / 1024 | floor)MB"' >> $PERF_LOG

# API response time test
RESPONSE_TIME=$(curl -o /dev/null -s -w '%{time_total}' https://api.yourdomain.com/health)
echo "[$DATE] API Response Time: ${RESPONSE_TIME}s" >> $PERF_LOG
```

```bash
# Run every 15 minutes
chmod +x /srv/crm/scripts/perf-monitor.sh
crontab -e  
# Add: */15 * * * * /srv/crm/scripts/perf-monitor.sh
```

## 🔄 Backup Strategy

### 1. Database Backups (Automatic via Supabase)

Supabase provides automatic backups, but you can also create manual backups:

```bash
# Manual database backup script
nano /srv/crm/scripts/backup-db.sh
```

```bash
#!/bin/bash
# Database backup script

BACKUP_DIR="/srv/crm/backups"
DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/crm_backup_$DATE.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup (requires DATABASE_URL)
cd /srv/crm/backend
pg_dump $DATABASE_URL > $BACKUP_FILE

# Compress backup
gzip $BACKUP_FILE

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup completed: $BACKUP_FILE.gz"
```

### 2. Application Code Backups

```bash
# Application backup script
nano /srv/crm/scripts/backup-app.sh
```

```bash
#!/bin/bash
# Application and configuration backup

BACKUP_DIR="/srv/crm/backups"
DATE=$(date '+%Y%m%d_%H%M%S')

# Backup configuration files
tar -czf "$BACKUP_DIR/config_backup_$DATE.tar.gz" \
    /srv/crm/backend/.env \
    /srv/crm/ecosystem.config.cjs \
    /etc/nginx/sites-available/crm \
    /etc/letsencrypt/renewal/api.yourdomain.com.conf

# Keep only last 14 days
find $BACKUP_DIR -name "config_backup_*.tar.gz" -mtime +14 -delete
```

## 📋 Maintenance Checklist

### Daily Tasks (Automated)
- [ ] Health check script runs
- [ ] Process monitoring active
- [ ] Log rotation working
- [ ] Uptime monitoring active

### Weekly Tasks (Semi-automated)
- [ ] Review performance logs
- [ ] Check error tracking (Sentry)
- [ ] Update security packages
- [ ] Clean old log files
- [ ] Test backup integrity

### Monthly Tasks (Manual)
- [ ] SSL certificate renewal check
- [ ] Database performance review
- [ ] Security audit
- [ ] Dependency updates review
- [ ] Backup restoration test

### Quarterly Tasks
- [ ] Full security scan
- [ ] Performance optimization
- [ ] Disaster recovery test
- [ ] Documentation updates

## 🔧 Common Maintenance Commands

```bash
# PM2 management
pm2 list                    # Check process status
pm2 logs --lines 100       # View recent logs
pm2 reload all              # Zero-downtime restart
pm2 reset all              # Reset restart counters
pm2 flush                   # Clear log files

# System monitoring
htop                        # Interactive process viewer
iotop                       # I/O monitoring
netstat -tlnp              # Network connections
df -h                       # Disk usage
free -h                     # Memory usage

# Nginx management
sudo nginx -t               # Test configuration
sudo systemctl reload nginx # Reload configuration
sudo systemctl status nginx # Check status
sudo tail -f /var/log/nginx/error.log

# SSL certificate management
sudo certbot renew --dry-run    # Test renewal
sudo certbot certificates       # List certificates
sudo systemctl status certbot.timer # Check auto-renewal
```

## 🎯 Performance Optimization

### 1. Database Query Optimization

```bash
# Enable query analysis (if available)
cd /srv/crm/backend
npm run db:analyze  # If implemented

# Monitor slow queries via Supabase dashboard
```

### 2. Node.js Performance Tuning

```bash
# Adjust PM2 configuration if needed
pm2 delete all
# Edit ecosystem.config.cjs to adjust:
# - instances (CPU cores * 2)
# - max_memory_restart
# - node_args (e.g., --max-old-space-size=2048)

pm2 start ecosystem.config.cjs --env production
```

### 3. Nginx Optimization

Add to nginx configuration for better performance:

```nginx
# Enable gzip compression
gzip on;
gzip_vary on;
gzip_min_length 1024;

# Add browser caching for static assets
location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

## ✅ Monitoring Setup Completion

After setting up monitoring:

- [ ] PM2 log rotation active
- [ ] System log rotation configured  
- [ ] External uptime monitoring set up
- [ ] Error tracking configured (optional)
- [ ] Automated health checks running
- [ ] Performance monitoring active
- [ ] Alert system configured
- [ ] Backup strategy implemented

🎉 **Your CRM system now has comprehensive monitoring and maintenance!** 🎉

Your production deployment is complete and production-ready!