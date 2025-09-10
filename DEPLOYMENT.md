# Production Deployment Guide

## Prerequisites
- Hostinger VPS (Ubuntu 20.04+)
- Supabase account for PostgreSQL
- Redis Cloud account
- Domain names configured

## Infrastructure Overview
- **Frontend**: Vercel (Next.js)
- **Backend**: Hostinger VPS (Node.js + PM2)
- **Database**: Supabase (PostgreSQL)
- **Queue**: Redis Cloud
- **SSL**: Let's Encrypt via Certbot

## 1. Server Setup (Hostinger VPS)

### System Dependencies
```bash
sudo apt update && sudo apt install -y nginx ufw git curl
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

### Firewall Configuration
```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

### Create Application Directory
```bash
sudo mkdir -p /srv/crm /var/log/crm
sudo chown $USER:$USER /srv/crm /var/log/crm
```

## 2. Application Deployment

### Clone Repository
```bash
cd /srv/crm
git clone <your-repo-url> .
cd backend
```

### Install Dependencies & Build
```bash
npm ci                    # Install ALL dependencies (including dev)
npx prisma generate       # Generate Prisma client
npm run build            # TypeScript compilation
npm prune --omit=dev     # Optional: remove dev deps after build
```

### Environment Configuration
```bash
cp /path/to/.env.production .env
# Edit .env with actual values:
# - DATABASE_URL from Supabase
# - REDIS_URL from Redis Cloud
# - JWT_SECRET (generate new)
# - NEXTAUTH_SECRET (match frontend)

# CRITICAL: Secure the environment file
chmod 600 .env
chown $USER:$USER .env
```

### Database Migration
```bash
# CRITICAL: Backup before migration
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d-%H%M).sql

# Check migration status and deploy
npx prisma migrate status
npx prisma migrate deploy
npx prisma db seed  # Optional: seed initial data
```

### PM2 Process Management
```bash
# Copy ecosystem config to server
cp /path/to/ecosystem.config.cjs /srv/crm/
pm2 start ecosystem.config.cjs --env production
pm2 save
pm2 startup  # Follow instructions to enable auto-start
```

## 3. Nginx Configuration

### Create Site Configuration
```bash
sudo nano /etc/nginx/sites-available/crm
```

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    location /.well-known/acme-challenge/ { 
        root /var/www/html; 
    }
    location / { 
        return 301 https://$host$request_uri; 
    }
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    client_max_body_size 10M;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        
        # Additional settings
        proxy_read_timeout 3600;  # For SSE/long polling
        proxy_connect_timeout 60;
        proxy_send_timeout 60;
    }

    location /health {
        proxy_pass http://127.0.0.1:3001/health;
        access_log off;
    }
}
```

### Enable Site & SSL
```bash
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# Install Certbot & Get SSL Certificate
sudo snap install core; sudo snap refresh core
sudo snap install --classic certbot
sudo certbot certonly --nginx -d api.yourdomain.com
sudo systemctl reload nginx
```

## 4. Frontend Deployment (Vercel)

### Environment Variables in Vercel Dashboard
```
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXTAUTH_SECRET=<same-as-backend>
```

### Custom Domain
- Point `app.yourdomain.com` to Vercel
- Automatic SSL via Vercel

## 5. Database & Queue Setup

### Supabase Database
1. Create new project in Supabase dashboard
2. Copy connection string to `DATABASE_URL`
3. Enable daily backups in dashboard

### Redis Cloud
1. Create free Redis instance
2. Copy connection string to `REDIS_URL`
3. Configure memory limit as needed

## 6. Early Monitoring Setup

### Install PM2 Log Rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true
```

### Error Tracking (Setup Before Deployment)
```bash
# Add Sentry/Rollbar to environment variables
# Configure error tracking in production
echo "SENTRY_DSN=your-sentry-dsn" >> .env
```

## 7. Monitoring & Health Checks

### Process Monitoring
```bash
pm2 list                 # Check process status
pm2 logs                 # View logs
pm2 monit               # Real-time monitoring
```

### Health Check Endpoints
- API: `https://api.yourdomain.com/health`
- Frontend: `https://app.yourdomain.com`

### Log Management
```bash
# Application logs
tail -f /var/log/crm/api-out.log
tail -f /var/log/crm/worker-out.log

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

## 8. Deployment Checklist

### Pre-deployment
- [ ] Contract tests passing (95%+ required)
- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificates valid

### Deployment Steps
- [ ] Backend built and deployed
- [ ] PM2 processes running
- [ ] Nginx configured and reloaded
- [ ] Frontend deployed to Vercel
- [ ] Database migrated
- [ ] Health checks passing

### Post-deployment
- [ ] End-to-end testing
- [ ] Performance monitoring
- [ ] Error tracking setup
- [ ] Backup verification

## 9. Maintenance Commands

### Application Updates
```bash
cd /srv/crm
git pull origin main
cd backend
npm ci --production
npm run build
npx prisma generate
npx prisma migrate deploy
pm2 reload ecosystem.config.cjs --env production
```

### Database Backup
```bash
# Manual backup
pg_dump $DATABASE_URL > backup-$(date +%Y%m%d).sql

# Automated via Supabase dashboard (recommended)
```

### Log Rotation
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

## 10. Troubleshooting

### Common Issues
- **503 errors**: Check PM2 process status
- **SSL issues**: Verify certbot renewal
- **Database connection**: Check Supabase connectivity
- **Queue failures**: Verify Redis Cloud connection

### Debug Commands
```bash
# Check process status
pm2 status
pm2 logs --lines 50

# Test database connection
npm run prisma:migrate status

# Test API endpoints
curl https://api.yourdomain.com/health
```

## Security Notes
- Keep all dependencies updated
- Regular security audits
- Monitor access logs
- Use strong secrets (32+ characters)
- Enable fail2ban for SSH protection