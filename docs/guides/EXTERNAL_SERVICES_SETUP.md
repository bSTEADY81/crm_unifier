# External Services Setup Guide

## 🚀 Quick Setup Instructions

### 1. Supabase (Database) - 10 minutes

1. **Create Account & Project**
   - Go to https://supabase.com
   - Sign up/Login with GitHub
   - Click "New Project"
   - Choose organization and enter:
     - Name: `crm-unifier-prod`
     - Database Password: (generate strong password)
     - Region: (choose closest to your Hostinger server)
   - Wait 2-3 minutes for project creation

2. **Get Connection String**
   - Go to Settings → Database
   - Scroll to "Connection String" section
   - Copy the "URI" format string
   - It looks like: `postgresql://postgres:[password]@[host]:5432/postgres`

3. **Enable Backups**
   - Go to Settings → Database → Backups
   - Enable "Point in Time Recovery"
   - Set retention period to 7 days minimum

4. **Update .env.production**
   ```bash
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@[YOUR-HOST]:5432/postgres?sslmode=require
   ```

### 2. Redis Cloud (Queue) - 5 minutes

1. **Create Account & Database**
   - Go to https://redis.com
   - Sign up for free account
   - Click "New database"
   - Choose:
     - Name: `crm-queue`
     - Plan: Fixed 30MB (free)
     - Provider: AWS (or preferred)
     - Region: (closest to Hostinger server)

2. **Get Connection URL**
   - Click on your database name
   - Go to "Configuration" tab
   - Copy "Redis URL" (format: `redis://:[password]@[host]:[port]`)

3. **Update .env.production**
   ```bash
   REDIS_URL=redis://:[YOUR-PASSWORD]@[YOUR-HOST]:[PORT]
   ```

### 3. Domain Configuration

Update the following in `.env.production`:
```bash
# Replace 'yourdomain.com' with your actual domain
CORS_ORIGINS=https://app.yourdomain.com,https://yourdomain.com
WEBHOOK_BASE_URL=https://api.yourdomain.com
```

### 4. Security Keys ✅ COMPLETED

Already generated and configured:
- JWT_SECRET: `7U/LyHeygaBOts8z6NuEj1MP5dOU1DSBdAqR3QIvEvI=`
- NEXTAUTH_SECRET: `JAjEBx5Su3jGAiQgJnLAwW+ndr8v61nqQ81zDthckHg=`
- PII_ENCRYPTION_KEY: `8+xBgPKUTwR/MZmefW214Xud0gkHn+JAFB6Wh8YHFi8=`

**IMPORTANT**: Use the same NEXTAUTH_SECRET value in your Vercel frontend environment variables!

### 5. Optional: Error Tracking (Sentry)

If you want error tracking:
1. Create account at https://sentry.io
2. Create new project for Node.js
3. Get DSN from project settings
4. Add to `.env.production`: `SENTRY_DSN=your-dsn-here`

## Next Steps

1. ✅ Complete external services setup above
2. 🔄 Deploy frontend to Vercel (Phase 2)
3. 🔄 Configure DNS records (Phase 3)
4. 🔄 Deploy backend to Hostinger (Phase 4)

## Troubleshooting

**Supabase Connection Issues:**
- Ensure password doesn't contain special characters that need URL encoding
- Verify region matches your server location for best performance
- Test connection: `psql "postgresql://user:pass@host:5432/postgres"`

**Redis Connection Issues:**
- Verify the URL format includes the colon before password: `redis://:[password]@host:port`
- Test connection: `redis-cli -u redis://:[password]@host:port ping`

## Security Notes

- ✅ All sensitive keys are properly generated
- ✅ Environment file will be secured on server (chmod 600)
- ✅ SSL/TLS enforced for all database connections
- ✅ CORS properly configured for production domains