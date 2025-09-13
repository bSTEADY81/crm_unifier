#!/bin/bash

# Railway Deployment Script for CRM Unifier Backend

set -e

echo "🚀 Deploying CRM Unifier Backend to Railway"

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    bash <(curl -fsSL https://railway.app/install.sh)
fi

# Login to Railway (if not already logged in)
echo "🔐 Checking Railway authentication..."
railway whoami || railway login

# Create or connect to Railway project
echo "📦 Setting up Railway project..."
if [ ! -f .railway/project.json ]; then
    echo "Creating new Railway project..."
    railway init
else
    echo "Using existing Railway project..."
fi

# Add PostgreSQL database service
echo "🗄️ Adding PostgreSQL database..."
railway add --service postgresql

# Add Redis service
echo "🔴 Adding Redis service..."
railway add --service redis

# Generate secrets
echo "🔐 Generating secrets..."
JWT_SECRET=$(openssl rand -base64 32)
PII_KEY=$(openssl rand -base64 32 | cut -c1-32)

# Set environment variables
echo "⚙️ Setting environment variables..."
railway variables set NODE_ENV=production
railway variables set PORT=3001
railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set NEXTAUTH_SECRET="$JWT_SECRET"
railway variables set FRONTEND_URL="https://crm-unifier-frontend.vercel.app"
railway variables set CORS_ORIGINS="https://crm-unifier-frontend.vercel.app,https://crm-unifier-frontend-git-main-bjs-projects-4a11c607.vercel.app"
railway variables set LOG_LEVEL=info
railway variables set LOG_FORMAT=json
railway variables set RATE_LIMIT_WINDOW_MS=900000
railway variables set RATE_LIMIT_MAX_REQUESTS=100
railway variables set JSON_LIMIT_BYTES=1048576
railway variables set FORM_LIMIT_BYTES=65536
railway variables set AUDIT_RETENTION_DAYS=2555
railway variables set PII_ENCRYPTION_KEY="$PII_KEY"

# Deploy the application
echo "🚀 Deploying application..."
railway up

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
sleep 30

# Get the deployment URL
RAILWAY_URL=$(railway domain)
if [ -z "$RAILWAY_URL" ]; then
    echo "🌐 Generating Railway domain..."
    railway domain add
    RAILWAY_URL=$(railway domain)
fi

# Update BACKEND_URL and WEBHOOK_BASE_URL
railway variables set BACKEND_URL="https://$RAILWAY_URL"
railway variables set WEBHOOK_BASE_URL="https://$RAILWAY_URL"

# Run database migrations
echo "📊 Running database migrations..."
railway run npm run prisma:generate
railway run npm run prisma:deploy
railway run npm run prisma:seed

# Check health endpoint
echo "🏥 Checking health endpoint..."
sleep 10
curl -f "https://$RAILWAY_URL/health" || echo "⚠️ Health check failed - check logs"

echo ""
echo "✅ Deployment completed!"
echo "🌐 Backend URL: https://$RAILWAY_URL"
echo "🏥 Health Check: https://$RAILWAY_URL/health"
echo "📋 API Docs: https://$RAILWAY_URL/api/v1"
echo ""
echo "🔐 Generated Secrets (save these):"
echo "JWT_SECRET: $JWT_SECRET"
echo "PII_ENCRYPTION_KEY: $PII_KEY"
echo ""
echo "Next steps:"
echo "1. Update Vercel environment variables with backend URL"
echo "2. Configure provider API keys in Railway dashboard"
echo "3. Test authentication flow"
echo ""