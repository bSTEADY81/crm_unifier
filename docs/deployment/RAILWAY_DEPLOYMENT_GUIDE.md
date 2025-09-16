# Railway Deployment Guide for CRM Unifier Backend

Since Railway CLI requires interactive authentication, follow these manual steps to deploy the backend:

## Prerequisites
1. Railway account: https://railway.app
2. GitHub repository connected to Railway

## Step 1: Create Railway Project

1. Go to https://railway.app/dashboard
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Connect and select your `crm-unifier` repository
5. Choose the root directory (where Procfile is located)

## Step 2: Add Database Services

### PostgreSQL Database
1. In your Railway project dashboard, click "Add Service"
2. Select "Database" → "PostgreSQL"
3. Railway will automatically provision and configure PostgreSQL
4. Note the connection details from the Variables tab

### Redis Service  
1. Click "Add Service" again
2. Select "Database" → "Redis"
3. Railway will automatically provision Redis
4. Note the connection details from the Variables tab

## Step 3: Configure Environment Variables

In your Railway project, go to Variables tab and add:

### Required Production Variables
```bash
# App Configuration
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://crm-unifier-frontend.vercel.app
CORS_ORIGINS=https://crm-unifier-frontend.vercel.app,https://crm-unifier-frontend-git-main-bjs-projects-4a11c607.vercel.app

# Security (generate these)
JWT_SECRET=<GENERATE_32_CHAR_SECRET>
NEXTAUTH_SECRET=<SAME_AS_JWT_SECRET>
PII_ENCRYPTION_KEY=<GENERATE_32_CHAR_KEY>

# Logging & Security
LOG_LEVEL=info
LOG_FORMAT=json
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
JSON_LIMIT_BYTES=1048576
FORM_LIMIT_BYTES=65536
AUDIT_RETENTION_DAYS=2555

# Database URLs (Railway provides these automatically)
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Webhook Configuration (update after deployment)
BACKEND_URL=https://<your-railway-domain>
WEBHOOK_BASE_URL=https://<your-railway-domain>
```

### Generate Secrets
Run these commands locally to generate secure secrets:
```bash
# JWT Secret
openssl rand -base64 32

# PII Encryption Key (exactly 32 characters)
openssl rand -base64 32 | cut -c1-32
```

## Step 4: Configure Build Settings

1. In Railway project settings, set:
   - **Build Command**: `cd backend && npm install`
   - **Start Command**: `cd backend && npm start`
   - **Root Directory**: `/` (root of repo)

2. Railway will use the `Procfile` we created:
   ```
   web: cd backend && npm start
   worker: cd backend && npm run worker
   ```

## Step 5: Deploy

1. Railway will automatically deploy when you push to your connected branch
2. Or manually trigger deployment from Railway dashboard
3. Monitor build logs for any issues

## Step 6: Post-Deployment Setup

### 1. Get Railway Domain
1. Go to Settings tab in your Railway project
2. Under "Domains", generate a Railway domain or add custom domain
3. Note the URL (e.g., `https://crm-unifier-production.up.railway.app`)

### 2. Update Environment Variables
Update these variables with your actual Railway domain:
```bash
BACKEND_URL=https://your-railway-domain.railway.app
WEBHOOK_BASE_URL=https://your-railway-domain.railway.app
```

### 3. Run Database Migrations
In Railway dashboard, go to your web service and open the console/terminal:
```bash
npm run prisma:generate
npm run prisma:deploy
npm run prisma:seed
```

Or use Railway CLI locally (after manual login):
```bash
railway run npm run prisma:generate
railway run npm run prisma:deploy
railway run npm run prisma:seed
```

## Step 7: Verify Deployment

1. Check health endpoint: `https://your-domain/health`
2. Check API docs: `https://your-domain/api/v1`
3. Test authentication endpoints

## Step 8: Update Vercel Frontend

In your Vercel project settings, update these environment variables:
```bash
NEXT_PUBLIC_API_URL=https://your-railway-domain.railway.app
NEXTAUTH_URL=https://crm-unifier-frontend.vercel.app
NEXTAUTH_SECRET=<same-as-backend-jwt-secret>
```

## Provider API Keys (Optional)

Add these to Railway environment variables if you need provider integrations:

```bash
# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=

# Gmail
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# Facebook/Instagram
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_PAGE_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
INSTAGRAM_ACCESS_TOKEN=
```

## Troubleshooting

### Build Fails
- Check build logs in Railway dashboard
- Ensure all dependencies are in `backend/package.json`
- Verify build command: `cd backend && npm install`

### App Won't Start
- Check start command: `cd backend && npm start`
- Verify `backend/src/index.ts` exists and exports app
- Check environment variables are set correctly

### Database Connection Issues
- Ensure DATABASE_URL is set to `${{Postgres.DATABASE_URL}}`
- Check PostgreSQL service is running in Railway dashboard
- Verify Prisma schema matches database structure

### CORS Errors
- Update CORS_ORIGINS with your actual frontend URLs
- Ensure FRONTEND_URL matches your Vercel deployment URL

## Production Checklist

- [ ] PostgreSQL database provisioned
- [ ] Redis cache provisioned  
- [ ] All environment variables configured
- [ ] Secrets generated and stored securely
- [ ] Database migrations run successfully
- [ ] Health endpoint responding
- [ ] API endpoints accessible
- [ ] CORS configured for frontend domain
- [ ] Frontend environment variables updated
- [ ] Authentication flow tested
- [ ] Provider integrations configured (if needed)

## Security Notes

- Never commit secrets to version control
- Use Railway's secret management for sensitive variables
- Regularly rotate JWT secrets and API keys
- Monitor logs for suspicious activity
- Keep dependencies updated

---

**Next Steps**: Once backend is deployed, update the frontend environment variables and test the complete authentication flow.