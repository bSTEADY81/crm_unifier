# CRM Unifier - Production Deployment Checklist

## Overview
Complete checklist to deploy CRM Unifier to production with Railway backend and Vercel frontend.

## Phase 1: Backend Deployment (Railway) 

### ✅ Pre-deployment Setup
- [x] Created `railway.json` configuration
- [x] Created `Procfile` for process management
- [x] Created `.env.production.template` with all required variables
- [x] Created automated deployment script (`deploy-railway.sh`)
- [x] Created comprehensive Railway deployment guide

### 🔄 Manual Railway Deployment Required
**Note**: Railway CLI requires interactive login, so manual deployment via dashboard is needed.

**Follow**: `RAILWAY_DEPLOYMENT_GUIDE.md`

#### Backend Deployment Steps
- [ ] Create Railway project from GitHub repository
- [ ] Add PostgreSQL database service
- [ ] Add Redis cache service
- [ ] Configure all environment variables (see template)
- [ ] Generate and set JWT secrets and encryption keys
- [ ] Deploy backend application
- [ ] Get Railway domain URL
- [ ] Update BACKEND_URL and WEBHOOK_BASE_URL variables
- [ ] Run database migrations (`prisma:deploy`)
- [ ] Run database seeds (`prisma:seed`)
- [ ] Verify health endpoint: `https://your-domain/health`
- [ ] Verify API endpoint: `https://your-domain/api/v1`

#### Required Environment Variables for Railway
```bash
# Generate these securely:
JWT_SECRET=<openssl rand -base64 32>
PII_ENCRYPTION_KEY=<openssl rand -base64 32 | cut -c1-32>

# App configuration:
NODE_ENV=production
PORT=3001
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}

# Update after deployment:
BACKEND_URL=https://your-railway-domain
WEBHOOK_BASE_URL=https://your-railway-domain
FRONTEND_URL=https://your-vercel-domain
CORS_ORIGINS=https://your-vercel-domain,https://preview-domains
```

## Phase 2: Frontend Deployment (Vercel)

### ✅ Pre-deployment Setup  
- [x] Fixed all Next.js build issues
- [x] Resolved styled-jsx compatibility problems
- [x] Created custom error pages
- [x] Optimized Next.js configuration
- [x] Created production environment configuration
- [x] Created comprehensive Vercel deployment guide

### 🔄 Vercel Deployment
**Follow**: `VERCEL_DEPLOYMENT_GUIDE.md`

#### Frontend Deployment Steps
- [ ] Deploy to Vercel from GitHub (root directory: `frontend/`)
- [ ] Configure environment variables in Vercel
- [ ] Get Vercel domain URL  
- [ ] Update frontend environment variables with Railway backend URL
- [ ] Verify build completes successfully
- [ ] Test frontend loads correctly

#### Required Environment Variables for Vercel
```bash
# Update with actual domains:
NEXT_PUBLIC_API_URL=https://your-railway-domain/api/v1
NEXTAUTH_URL=https://your-vercel-domain
NEXTAUTH_SECRET=<same-as-backend-JWT_SECRET>
NODE_ENV=production
```

## Phase 3: Integration & Testing

### Domain Synchronization
- [ ] Update Railway CORS_ORIGINS with Vercel domain
- [ ] Update Railway FRONTEND_URL with Vercel domain
- [ ] Update Vercel NEXT_PUBLIC_API_URL with Railway domain
- [ ] Ensure NEXTAUTH_SECRET matches between frontend/backend

### Authentication Testing
- [ ] Test login with admin credentials: `admin@example.com / AdminPass123!`
- [ ] Test login with staff credentials: `staff@example.com / StaffPass123!`
- [ ] Test login with viewer credentials: `viewer@example.com / ViewerPass123!`
- [ ] Verify authentication persists on page refresh
- [ ] Test logout functionality
- [ ] Test protected route access control

### API Connectivity Testing
- [ ] Test health endpoint: `GET /health`
- [ ] Test API root: `GET /api/v1`
- [ ] Test customer endpoints (with auth)
- [ ] Verify CORS allows frontend requests
- [ ] Test error handling (404, 500 pages)

### End-to-End Testing
**Use Playwright to test the complete application flow:**

- [ ] User registration flow
- [ ] User login flow  
- [ ] Dashboard navigation
- [ ] Customer management features
- [ ] Responsive design on mobile
- [ ] Error page handling
- [ ] Authentication redirects

## Phase 4: Production Hardening

### Security Configuration
- [ ] Verify all secrets are properly configured
- [ ] Check CORS is restrictive to production domains only
- [ ] Ensure rate limiting is enabled
- [ ] Verify input validation is active
- [ ] Check security headers are applied
- [ ] Review audit logging configuration

### Monitoring Setup
- [ ] Configure Railway logging
- [ ] Set up Vercel deployment monitoring
- [ ] Test error handling and logging
- [ ] Verify health check endpoint responds
- [ ] Set up uptime monitoring (optional)

### Performance Optimization
- [ ] Verify database connection pooling
- [ ] Check Redis caching is working
- [ ] Test API response times
- [ ] Verify frontend bundle optimization
- [ ] Check image optimization settings

## Phase 5: Provider Integrations (Optional)

### Communication Providers
- [ ] Configure Twilio for SMS/Voice
- [ ] Set up Gmail integration
- [ ] Configure WhatsApp Business API
- [ ] Set up Facebook/Instagram webhooks
- [ ] Test webhook endpoints
- [ ] Verify signature validation

### Webhook Configuration
- [ ] Update provider webhook URLs to Railway backend
- [ ] Test webhook delivery and processing
- [ ] Verify message ingestion pipeline
- [ ] Test customer identity resolution

## Phase 6: Background Jobs & Workers

### Queue System Setup
- [ ] Verify Redis queue connection
- [ ] Configure BullMQ workers on Railway
- [ ] Test background job processing
- [ ] Set up job monitoring and retry policies
- [ ] Configure job queue dashboard (optional)

## Deployment Commands Reference

### Railway (via dashboard)
1. Deploy from GitHub repository
2. Configure environment variables via UI
3. Use Railway console for database migrations:
   ```bash
   npm run prisma:generate
   npm run prisma:deploy  
   npm run prisma:seed
   ```

### Vercel (via CLI or dashboard)
```bash
# From frontend/ directory
cd frontend
npx vercel --prod

# Or deploy via Vercel dashboard from GitHub
```

### Local Testing Against Production
```bash
# Test against production backend
cd frontend
NEXT_PUBLIC_API_URL=https://your-railway-domain/api/v1 npm run dev

# Run E2E tests against production
npm run test:e2e:production
```

## Rollback Plan

### If Backend Deployment Fails
1. Check Railway build logs for errors
2. Verify environment variables are correct
3. Check database connectivity
4. Review Procfile and start commands

### If Frontend Deployment Fails
1. Check Vercel build logs
2. Verify Next.js configuration
3. Test build locally first
4. Check environment variables

### If Authentication Breaks
1. Verify JWT secrets match between services
2. Check CORS configuration
3. Verify NEXTAUTH_URL is correct
4. Test with fresh browser session

## Success Criteria

### Backend (Railway)
- ✅ Health endpoint returns 200 OK
- ✅ API endpoints respond correctly
- ✅ Database migrations completed
- ✅ Authentication system works
- ✅ CORS configured for frontend domain

### Frontend (Vercel)  
- ✅ All pages load without errors
- ✅ Build completes successfully
- ✅ Authentication flow works end-to-end
- ✅ API calls reach backend successfully
- ✅ Responsive design works on mobile

### Integration
- ✅ Complete user journey works (register → login → dashboard → logout)
- ✅ Error handling displays appropriate messages
- ✅ Security measures are active and working
- ✅ Performance is acceptable (< 3s page loads)

---

## Current Status
- ✅ **Phase 1**: Backend preparation completed
- 🔄 **Phase 2**: Manual Railway deployment required
- ⏳ **Phase 3**: Pending backend deployment
- ⏳ **Phase 4**: Pending integration testing
- ⏳ **Phase 5**: Optional provider setup
- ⏳ **Phase 6**: Background job configuration

**Next Action**: Deploy backend to Railway following the Railway Deployment Guide, then proceed with frontend deployment and integration testing.