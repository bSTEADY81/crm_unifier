# CRITICAL: Railway Deployment Fix for Registration Endpoint

## Problem
The production Railway deployment at https://crmunifier-production.up.railway.app is missing the `/api/v1/auth/register` endpoint, returning 404.

## Solution Steps

### 1. Railway Dashboard Actions Required:

1. **Go to Railway Dashboard** at https://railway.app/dashboard
2. **Click on `crm_unifier` service** (showing "2 Changes")
3. **Go to Variables tab** and ensure these are set:
   ```
   NODE_ENV=production
   PORT=3001
   JWT_SECRET=MKslAKiFU66Aq7jhVOBpyxlehd935TDbXREI7zo+8Zk=
   NEXTAUTH_SECRET=MKslAKiFU66Aq7jhVOBpyxlehd935TDbXREI7zo+8Zk=
   PII_ENCRYPTION_KEY=9dLZRjyBpcBJJUeihocUBSZ/b4EcYGpr
   FRONTEND_URL=https://crm-unifier-kappa.vercel.app
   CORS_ORIGINS=https://crm-unifier-kappa.vercel.app,http://localhost:3000
   ```

4. **Go to Settings tab** and verify:
   - Build Command: `npm install`
   - Start Command: `cd backend && npm start`
   - Root Directory: `/` (repository root)

5. **Trigger Deployment**:
   - Click "Deploy" button OR
   - Go to "Deployments" tab and click "Redeploy" on the latest commit

### 2. Verify Backend Code Has Auth Routes

The backend ALREADY has the registration endpoint in the code:
- File: `backend/src/routes/auth.ts` (lines 61-135)
- Route: `router.post('/register', ...)` 
- Mounted at: `/api/v1/auth` in `backend/src/app.ts` (line 129)

### 3. Post-Deployment Verification

After Railway deploys (takes ~2-3 minutes), test:

```bash
# Test registration endpoint
curl -X POST https://crmunifier-production.up.railway.app/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "email": "test@example.com", "password": "testpassword123"}'

# Should return either:
# - Success: {"accessToken": "...", "user": {...}}
# - Error: {"error": "conflict", "message": "User already exists"}
# NOT: {"error": "Not Found", "message": "Route POST /api/v1/auth/register not found"}
```

### 4. Frontend Deployment (if needed)

The frontend at Vercel already has the fixes:
- Response format mapping (accessToken → token)
- Enhanced error handling
- Better error messages

If frontend needs redeployment:
1. Commit frontend changes: `git add frontend/src && git commit -m "Fix auth response mapping"`
2. Push to trigger Vercel: `git push origin main`

## Why This Will Work

1. **Backend code EXISTS** - The registration endpoint is already in the committed code
2. **Railway config is CORRECT** - railway.toml points to the right backend directory
3. **The "2 Changes" in Railway** - Indicates uncommitted deployment changes need to be deployed
4. **Environment variables** - Adding the JWT secrets will enable authentication to work

## Expected Result

✅ Registration endpoint will be accessible at `/api/v1/auth/register`
✅ Users can register new accounts
✅ Frontend will display proper error messages
✅ Authentication flow will work completely

## Manual Railway Deployment Alternative

If automatic deployment doesn't work:

1. In Railway dashboard, go to your service
2. Click "Settings" → "Deploy" 
3. Select "Deploy from GitHub"
4. Choose branch: `main`
5. Click "Deploy Now"

This will force Railway to rebuild and deploy the latest code with the registration endpoint.