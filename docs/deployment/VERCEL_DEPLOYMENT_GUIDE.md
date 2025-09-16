# Vercel Frontend Deployment Guide

## Prerequisites
- Vercel account: https://vercel.com
- Frontend build issues resolved (✅ completed)
- Railway backend deployed and accessible

## Step 1: Prepare Frontend for Deployment

The frontend has been optimized with build fixes:
- ✅ Fixed styled-jsx compatibility issues
- ✅ Created custom error pages
- ✅ Optimized Next.js configuration
- ✅ Production environment variables configured

## Step 2: Deploy via Vercel Dashboard

### Option A: Direct Deploy from GitHub
1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import your `crm-unifier` repository
4. Set **Root Directory** to `frontend/`
5. Vercel will auto-detect Next.js settings

### Option B: Deploy from Local (after Railway backend is live)
```bash
cd frontend
npx vercel --prod
```

## Step 3: Configure Environment Variables

In Vercel project settings → Environment Variables, add:

### Required Production Variables
```bash
# API Configuration (update with your Railway domain)
NEXT_PUBLIC_API_URL=https://your-railway-domain.railway.app/api/v1

# NextAuth Configuration (update with your Vercel domain)
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
NEXTAUTH_SECRET=<same-jwt-secret-as-backend>

# Production flag
NODE_ENV=production
```

### Getting Your Domains
- **Railway Backend**: Available in Railway project settings → Domains
- **Vercel Frontend**: Available in Vercel project settings → Domains

## Step 4: Build Configuration

Vercel should automatically detect these settings:
- **Framework Preset**: Next.js
- **Root Directory**: `frontend`
- **Build Command**: `npm run build` (auto-detected)
- **Output Directory**: `.next` (auto-detected)

## Step 5: Post-Deployment Verification

### 1. Check Build Success
- Monitor build logs in Vercel dashboard
- Ensure no build errors or warnings

### 2. Test Frontend Functionality
- Navigate to your Vercel domain
- Check all pages load correctly
- Verify responsive design works

### 3. Test Backend Connection
- Check that API calls reach your Railway backend
- Verify CORS is configured correctly
- Test authentication flow

## Step 6: Update Backend CORS

After deploying, update your Railway backend environment variables:
```bash
# In Railway project variables, update:
CORS_ORIGINS=https://your-vercel-domain.vercel.app,https://your-vercel-preview-domain.vercel.app
FRONTEND_URL=https://your-vercel-domain.vercel.app
```

## Step 7: Authentication Testing

### Test User Credentials
From the backend seed data:
```bash
# Admin User
Email: admin@example.com
Password: AdminPass123!

# Staff User  
Email: staff@example.com
Password: StaffPass123!

# Viewer User
Email: viewer@example.com
Password: ViewerPass123!
```

### Test Flow
1. Go to login page: `https://your-domain/login`
2. Try logging in with test credentials
3. Verify redirect to dashboard works
4. Check authentication persists on page refresh

## Production Domains

### Current Configuration
```bash
# Frontend (update these in Vercel)
NEXTAUTH_URL=https://frontend-7aei55ao9-bjs-projects-4a11c607.vercel.app
NEXT_PUBLIC_API_URL=https://crmunifier-production.up.railway.app/api/v1

# Backend (update these in Railway)  
FRONTEND_URL=https://frontend-7aei55ao9-bjs-projects-4a11c607.vercel.app
BACKEND_URL=https://crmunifier-production.up.railway.app
WEBHOOK_BASE_URL=https://crmunifier-production.up.railway.app
```

## Custom Domains (Optional)

### For Frontend (Vercel)
1. In Vercel project settings → Domains
2. Add custom domain (e.g., `app.yourdomain.com`)
3. Configure DNS as instructed

### For Backend (Railway)
1. In Railway project settings → Domains  
2. Add custom domain (e.g., `api.yourdomain.com`)
3. Configure DNS as instructed

## Environment Synchronization Checklist

- [ ] Railway backend deployed and accessible
- [ ] Railway domain noted and configured
- [ ] Vercel frontend deployed successfully
- [ ] Vercel domain noted and configured
- [ ] NEXT_PUBLIC_API_URL points to Railway backend
- [ ] NEXTAUTH_URL points to Vercel frontend
- [ ] NEXTAUTH_SECRET matches backend JWT_SECRET
- [ ] Backend CORS_ORIGINS includes Vercel domain
- [ ] Backend FRONTEND_URL points to Vercel domain
- [ ] Authentication flow tested end-to-end
- [ ] API connectivity verified
- [ ] Error pages display correctly
- [ ] Responsive design works on mobile

## Troubleshooting

### Build Failures
- Check build logs in Vercel dashboard
- Ensure all dependencies are in `frontend/package.json`  
- Verify Next.js configuration is correct

### API Connection Issues
- Check NEXT_PUBLIC_API_URL is correct
- Verify Railway backend is accessible
- Check CORS configuration in backend
- Test API endpoints directly

### Authentication Issues
- Verify NEXTAUTH_SECRET matches between frontend/backend
- Check NEXTAUTH_URL is correct
- Ensure backend JWT_SECRET is properly configured
- Test with different browsers/incognito mode

### CORS Errors
- Update backend CORS_ORIGINS with exact Vercel domain
- Include both production and preview domains
- Ensure no trailing slashes in URLs

---

**Status**: Ready for deployment once Railway backend is live and domains are configured.

**Next Steps**: 
1. Deploy backend to Railway following the Railway Deployment Guide
2. Get Railway domain and update environment variables
3. Deploy frontend to Vercel with updated API URL
4. Test complete authentication and API flow