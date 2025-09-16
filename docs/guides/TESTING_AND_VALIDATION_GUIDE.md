# Testing & Validation Guide

## 🧪 Comprehensive System Testing

### 1. Infrastructure Health Checks

```bash
# Test all endpoints from server
curl -I https://api.yourdomain.com/health
curl -I https://app.yourdomain.com

# Check SSL certificates
openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com

# Test DNS resolution
dig api.yourdomain.com
dig app.yourdomain.com

# Check server resources
free -h           # Memory
df -h             # Disk space  
pm2 list          # Process status
sudo systemctl status nginx  # Nginx status
```

### 2. Backend API Testing

```bash
# Health endpoint (should return 200)
curl -s https://api.yourdomain.com/health | jq

# API version info (if available)
curl -s https://api.yourdomain.com/api/v1/ | jq

# Authentication endpoints
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}'

# Protected endpoints (with auth token)
# Replace TOKEN with actual JWT from login response
curl -H "Authorization: Bearer TOKEN" \
  https://api.yourdomain.com/api/v1/users/profile
```

### 3. Database Connectivity Testing

```bash
# Test from server
cd /srv/crm/backend

# Check migration status
npx prisma migrate status

# Test database queries
npx prisma db push --accept-data-loss  # Only if safe!

# Query test accounts
npx prisma studio --port 5555 &
# Visit: http://server-ip:5555 (temporarily)
```

### 4. Frontend Application Testing

#### Browser Testing Checklist

1. **Visit Frontend URL**
   - Go to: `https://app.yourdomain.com`
   - Should load without SSL warnings

2. **Authentication Flow**
   - Click "Sign In" or navigate to login page
   - Use test account: `admin@example.com` / `AdminPass123!`
   - Should successfully authenticate and redirect

3. **API Integration**
   - Check browser Network tab for API calls
   - Calls should go to `https://api.yourdomain.com/api/v1/...`
   - Should receive proper responses (not CORS errors)

4. **Core Functionality** (if implemented)
   - Test dashboard loading
   - Test any CRUD operations
   - Test real-time features (if any)

### 5. Performance Testing

```bash
# API response times
curl -o /dev/null -s -w "Total time: %{time_total}s\n" \
  https://api.yourdomain.com/health

# Load testing (simple)
for i in {1..10}; do
  curl -s https://api.yourdomain.com/health > /dev/null &
done
wait

# Monitor server resources during load
htop  # or
pm2 monit
```

### 6. Security Testing

```bash
# Test HTTPS redirect
curl -I http://api.yourdomain.com/health
# Should return 301/302 redirect to HTTPS

# Test security headers
curl -I https://api.yourdomain.com/ | grep -E "(Strict-Transport|X-Frame|X-Content)"

# Test SSL configuration
# Use: https://www.ssllabs.com/ssltest/
# Enter: api.yourdomain.com

# Test for common vulnerabilities
curl https://api.yourdomain.com/admin  # Should return 404 or auth required
curl https://api.yourdomain.com/.env   # Should return 404
```

## 🔍 Integration Testing

### End-to-End Workflow Test

1. **Complete User Journey**
   ```bash
   # 1. Register new user (if registration enabled)
   curl -X POST https://api.yourdomain.com/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"TestPass123!","name":"Test User"}'

   # 2. Login
   TOKEN=$(curl -X POST https://api.yourdomain.com/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"TestPass123!"}' \
     -s | jq -r '.token')

   # 3. Test authenticated endpoints
   curl -H "Authorization: Bearer $TOKEN" \
     https://api.yourdomain.com/api/v1/users/profile

   # 4. Test main application features
   # (Add specific API calls based on your application)
   ```

### Provider Integration Testing (if configured)

```bash
# Test webhook endpoints (if providers configured)
curl -X POST https://api.yourdomain.com/api/v1/webhooks/twilio \
  -H "Content-Type: application/json" \
  -d '{"test":"webhook"}'

# Should return appropriate webhook handling response
```

### Database Integration

```bash
# Test database operations from API
cd /srv/crm/backend

# Run integration tests if available
npm run test:integration

# Or test database manually
npx prisma db seed  # Re-run seeding
npx prisma studio --port 5555
```

## 📊 Monitoring & Observability

### 1. Log Analysis

```bash
# Check application logs
pm2 logs --lines 100

# Check for errors
pm2 logs | grep -i error

# Check Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# System logs
sudo journalctl -f -u nginx
sudo journalctl -f -u ssh
```

### 2. Performance Monitoring

```bash
# System resources
htop
iostat 1 5    # I/O statistics
sar 1 5       # System activity

# Application performance
pm2 monit     # Real-time process monitoring

# Memory usage per process
ps aux --sort=-%mem | head -10

# Network connections
sudo netstat -tlnp
```

### 3. Database Performance

```bash
# Check database connections (if accessible)
# This depends on your Supabase setup

# Check slow queries (if logging enabled)
# Monitor from Supabase dashboard

# Application database queries
cd /srv/crm/backend
npm run db:analyze  # If available
```

## 🎯 Test Scenarios

### Critical Path Testing

1. **User Authentication**
   - [ ] Login with valid credentials
   - [ ] Login with invalid credentials
   - [ ] JWT token validation
   - [ ] Session management

2. **API Functionality**
   - [ ] Health checks return 200
   - [ ] Protected routes require authentication
   - [ ] CORS configured properly
   - [ ] Rate limiting works (if enabled)

3. **Data Persistence**
   - [ ] Create operations save to database
   - [ ] Read operations return correct data
   - [ ] Update operations modify data
   - [ ] Delete operations remove data

4. **Frontend-Backend Integration**
   - [ ] API calls succeed from frontend
   - [ ] Authentication state persists
   - [ ] Error handling displays properly
   - [ ] Real-time features work (if any)

### Load Testing

```bash
# Simple load test
seq 1 50 | xargs -n1 -P10 -I{} curl -s https://api.yourdomain.com/health

# Monitor during load
pm2 monit

# Check for any crashed processes
pm2 list | grep -E "(error|stopped)"
```

## 🚨 Error Scenarios

### Test Error Handling

```bash
# Test invalid API endpoints
curl -I https://api.yourdomain.com/api/v1/nonexistent

# Test malformed requests
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"invalid":"json}'

# Test rate limiting (if enabled)
for i in {1..100}; do
  curl -s https://api.yourdomain.com/health > /dev/null
done
```

### Recovery Testing

```bash
# Test service recovery
pm2 stop crm-api
sleep 5
pm2 start crm-api

# Test database connectivity issues
# (Simulate by temporarily blocking Supabase in firewall - advanced)

# Test high memory usage
# (Monitor pm2 memory restart functionality)
```

## ✅ Final Validation Checklist

### Infrastructure
- [ ] DNS resolves correctly for both subdomains
- [ ] SSL certificates are valid and auto-renewing
- [ ] Nginx reverse proxy working
- [ ] Firewall configured properly
- [ ] PM2 processes running and auto-restart enabled

### Application
- [ ] Frontend loads at app.yourdomain.com
- [ ] Backend API accessible at api.yourdomain.com
- [ ] Health endpoints return success
- [ ] Authentication flow works end-to-end
- [ ] Database operations successful
- [ ] Logs show no critical errors

### Security
- [ ] HTTPS enforced (HTTP redirects)
- [ ] Security headers present
- [ ] SSL grade A or A+ (SSLLabs test)
- [ ] No sensitive data in logs
- [ ] Environment variables secured

### Performance
- [ ] API response times < 500ms
- [ ] Frontend load times < 3s
- [ ] No memory leaks in PM2 processes
- [ ] Database queries performing well

### Monitoring
- [ ] Log rotation configured
- [ ] Uptime monitoring set up (external)
- [ ] Error tracking configured (if Sentry)
- [ ] Backup strategy in place

## 🎉 Beta Launch Ready!

If all tests pass, your CRM system is ready for beta users!

### Beta Testing Instructions

Provide beta testers with:
- Frontend URL: `https://app.yourdomain.com`
- Test accounts:
  - Admin: `admin@example.com` / `AdminPass123!`
  - Staff: `staff@example.com` / `StaffPass123!`
  - Viewer: `viewer@example.com` / `ViewerPass123!`

### Support Information
- Status page: `https://api.yourdomain.com/health`
- Documentation: (provide links to your API docs)
- Support contact: (your email/support system)

🎊 **Congratulations! Your CRM system is now live in production!** 🎊