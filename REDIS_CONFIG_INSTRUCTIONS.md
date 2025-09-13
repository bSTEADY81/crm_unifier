# Redis Configuration Instructions

## Problem
Authentication is failing with 500 errors because the backend can't connect to Redis for session management.

## Solution
Add REDIS_URL environment variable in Railway dashboard:

### Steps:
1. Go to Railway project: https://railway.com/project/723e9124-9980-48f6-b53d-fbd8df61302c
2. Click on `crm_unifier` service
3. Go to Variables tab
4. Add new variable:
   - **Name**: `REDIS_URL`
   - **Value**: `${{Redis.REDIS_URL}}`
5. Deploy the change

### Expected Result:
- Backend will connect to Railway Redis service
- Authentication will work with seeded users:
  - `admin@example.com` / `AdminPass123!`
  - `staff@example.com` / `StaffPass123!`
  - `viewer@example.com` / `ViewerPass123!`

### How to Test:
```bash
curl -X POST https://crmunifier-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"AdminPass123!"}'
```

Should return JWT tokens instead of 500 error.