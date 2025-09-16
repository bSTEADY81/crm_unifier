# Backend Deployment Guide

## 🚀 Database Migration & Application Startup

### 1. Database Migration (CRITICAL STEP)

```bash
# Navigate to backend directory
cd /srv/crm/backend

# IMPORTANT: Test database connection first
npx prisma migrate status

# If connection successful, deploy migrations
npx prisma migrate deploy

# Seed the database with initial data (includes test accounts)
npx prisma db seed

# Verify seeding was successful
npx prisma studio --port 5555 &
STUDIO_PID=$!
echo "Visit http://your-server-ip:5555 to verify data"
echo "Press Ctrl+C to continue after verification"
sleep 10
kill $STUDIO_PID
```

### 2. Start Services with PM2

```bash
# Copy PM2 ecosystem configuration
cp ../ecosystem.config.cjs .

# Start both API and worker processes
pm2 start ecosystem.config.cjs --env production

# Save PM2 process list (for auto-restart on reboot)
pm2 save

# Configure PM2 to start on system boot
pm2 startup
# IMPORTANT: Run the command that PM2 outputs!

# Check process status
pm2 list
# Both crm-api and crm-worker should show "online" status

# Monitor logs in real-time (optional)
pm2 logs --lines 20
```

### 3. Test Backend Services

```bash
# Test API health endpoint locally
curl http://localhost:3001/health

# Check if both processes are consuming reasonable resources
pm2 monit

# View detailed process information
pm2 show crm-api
pm2 show crm-worker
```

## 🔧 PM2 Management Commands

### Essential PM2 Commands

```bash
# View all processes
pm2 list

# View logs
pm2 logs                 # All processes
pm2 logs crm-api         # Specific process
pm2 logs --lines 50      # Last 50 lines

# Restart services
pm2 restart crm-api      # Restart API
pm2 restart crm-worker   # Restart worker
pm2 restart all          # Restart all

# Stop services
pm2 stop crm-api
pm2 stop all

# Reload services (zero-downtime)
pm2 reload crm-api

# Delete processes (removes from PM2)
pm2 delete crm-api
pm2 delete all

# Monitor in real-time
pm2 monit
```

### Application Updates

```bash
# For future deployments (after initial setup)
cd /srv/crm

# Pull latest code
git pull origin main

# Update dependencies
cd backend
npm ci

# Generate Prisma client (if schema changed)
npx prisma generate

# Run new migrations (if any)
npx prisma migrate deploy

# Reload services with zero downtime
pm2 reload ecosystem.config.cjs --env production
```

## 📊 Process Configuration Details

### Ecosystem Configuration (ecosystem.config.cjs)

```javascript
module.exports = {
  apps: [
    {
      name: "crm-api",           // Main API server
      instances: 2,             // 2 instances for load balancing
      exec_mode: "cluster",     // Cluster mode for performance
      max_memory_restart: "1G", // Restart if memory > 1GB
      port: 3001               // API port
    },
    {
      name: "crm-worker",       // Background job processor
      instances: 1,             // Single instance for queue processing
      exec_mode: "fork",        // Fork mode for worker
      max_memory_restart: "500M" // Restart if memory > 500MB
    }
  ]
}
```

### Expected Process Status

```bash
pm2 list
```

Should show:
```
┌─────┬────────────┬─────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┬──────────┬──────────┬──────────┬──────────┐
│ id  │ name       │ namespace   │ version │ mode    │ pid      │ uptime │ ↺    │ status    │ cpu      │ mem      │ user     │ watching │
├─────┼────────────┼─────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┼──────────┼──────────┼──────────┼──────────┤
│ 0   │ crm-api    │ default     │ 1.0.0   │ cluster │ 1234     │ 2m     │ 0    │ online    │ 0%       │ 45.2mb   │ user     │ disabled │
│ 1   │ crm-api    │ default     │ 1.0.0   │ cluster │ 1235     │ 2m     │ 0    │ online    │ 0%       │ 46.1mb   │ user     │ disabled │
│ 2   │ crm-worker │ default     │ 1.0.0   │ fork    │ 1236     │ 2m     │ 0    │ online    │ 0%       │ 32.1mb   │ user     │ disabled │
└─────┴────────────┴─────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┴──────────┴──────────┴──────────┴──────────┘
```

## 🔍 Log Management

### Log Locations

- **PM2 Logs**: `/var/log/crm/`
  - `api-out.log` - API stdout
  - `api-error.log` - API stderr  
  - `worker-out.log` - Worker stdout
  - `worker-error.log` - Worker stderr

### Log Rotation Setup

```bash
# Install PM2 log rotation module
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M      # Max file size
pm2 set pm2-logrotate:retain 7          # Keep 7 rotated files
pm2 set pm2-logrotate:compress true     # Compress old logs
pm2 set pm2-logrotate:dateFormat YYYY-MM-DD_HH-mm-ss

# Verify configuration
pm2 conf pm2-logrotate
```

### Viewing Logs

```bash
# Real-time logs
pm2 logs

# Last 100 lines from all processes
pm2 logs --lines 100

# Filter by process
pm2 logs crm-api --lines 50

# Filter by log level (if using structured logging)
pm2 logs crm-api | grep ERROR

# Raw log files
tail -f /var/log/crm/api-out.log
tail -f /var/log/crm/worker-error.log
```

## 🚨 Troubleshooting

### Common Issues

#### Processes Won't Start
```bash
# Check for port conflicts
sudo netstat -tlnp | grep :3001

# Check environment file
cat .env | grep -v '#'

# Test database connection
npx prisma migrate status

# Check PM2 configuration
pm2 show crm-api
```

#### Database Connection Issues
```bash
# Test direct connection
npx prisma db pull

# Check environment variables
echo $DATABASE_URL

# Verify Supabase connectivity
curl -I https://your-supabase-project.supabase.co
```

#### Memory Issues
```bash
# Check system memory
free -h

# Check process memory usage  
pm2 monit

# Adjust max_memory_restart if needed
pm2 delete all
# Edit ecosystem.config.cjs memory limits
pm2 start ecosystem.config.cjs --env production
```

#### Queue/Worker Issues
```bash
# Check Redis connectivity
redis-cli -u $REDIS_URL ping

# Monitor worker logs specifically
pm2 logs crm-worker --lines 50

# Restart worker only
pm2 restart crm-worker
```

## ✅ Verification Checklist

Before proceeding to Nginx setup:

- [ ] Database migrations deployed successfully
- [ ] Seed data created (test accounts available)
- [ ] PM2 shows both processes as "online"
- [ ] Health endpoint responds: `curl http://localhost:3001/health`
- [ ] API logs show no critical errors
- [ ] Worker logs show Redis connection established
- [ ] Process auto-restart configured
- [ ] Log rotation configured

## 📝 Next Steps

After backend deployment:

1. ✅ Backend services running on server
2. 🔄 Configure Nginx reverse proxy
3. 🔄 Set up SSL certificates  
4. 🔄 Test external API access
5. 🔄 Verify frontend-backend integration

The backend is now ready for reverse proxy configuration!