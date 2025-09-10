# CRM Unifier - Quick Start Guide

**Version**: 0.1.0  
**Last Updated**: 2025-09-09

## Prerequisites

- Node.js 20+ and npm 10+
- Docker and Docker Compose
- PostgreSQL client (optional, for direct DB access)
- Ngrok or similar (for webhook testing)

## 1. Environment Setup

### Clone and Install
```bash
# Clone the repository
git clone <repository-url>
cd crm-unifier

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
```

### Configure Environment
Edit `.env.local` with your settings:
```env
# Database
DATABASE_URL="postgresql://crm:password@localhost:5432/crm_unifier"

# Auth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generate-with-openssl-rand-base64-32>"

# Redis
REDIS_URL="redis://localhost:6379"

# Providers (add as needed)
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
GMAIL_CLIENT_ID="xxxxxx.apps.googleusercontent.com"
GMAIL_CLIENT_SECRET="xxxxxxxxxxxxxxxxxxxxxxxx"
```

## 2. Database Setup

### Start Services
```bash
# Start PostgreSQL and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

### Initialize Database
```bash
# Run migrations
npx prisma migrate dev

# Seed initial data (creates admin user)
npx prisma db seed

# Verify database
npx prisma studio  # Opens at http://localhost:5555
```

Default admin credentials:
- Email: admin@example.com
- Password: AdminPass123!

## 3. Start Development Servers

### Terminal 1: Backend API
```bash
npm run dev:backend
# API runs at http://localhost:3001
# API docs at http://localhost:3001/api-docs
```

### Terminal 2: Frontend UI
```bash
npm run dev:frontend
# UI runs at http://localhost:3000
```

### Terminal 3: Queue Worker
```bash
npm run dev:worker
# Processes webhook messages
```

## 4. Configure Your First Provider

### Login to Admin Panel
1. Navigate to http://localhost:3000
2. Login with admin credentials
3. Go to Settings → Providers

### Setup Twilio SMS
1. Click "Add Provider"
2. Select "Twilio SMS"
3. Enter your Twilio credentials:
   - Account SID
   - Auth Token
   - Phone Number
4. Click "Test Connection"
5. Copy the webhook URL shown

### Configure Twilio Webhook
1. Login to Twilio Console
2. Navigate to Phone Numbers → Manage → Active Numbers
3. Select your phone number
4. Set webhook URL for "A message comes in":
   ```
   https://your-ngrok-url.ngrok.io/api/v1/webhooks/twilio
   ```
5. Set HTTP method to POST
6. Save configuration

## 5. Test Message Ingestion

### Send Test SMS
1. Send an SMS to your Twilio number from any phone
2. Check the dashboard at http://localhost:3000/messages
3. Message should appear within seconds

### Verify in Database
```bash
# Connect to database
docker exec -it crm-postgres psql -U crm -d crm_unifier

# Check messages
SELECT * FROM messages ORDER BY created_at DESC LIMIT 5;
```

## 6. Customer Identity Linking

### Create Customer
1. Go to Customers → Add Customer
2. Enter customer details:
   - Name: John Doe
   - Display Name: John

### Link Phone Number
1. Click on the customer
2. Go to Identities tab
3. Add Identity:
   - Type: Phone
   - Value: +1234567890 (the SMS sender number)
4. Save

### View Unified Timeline
1. Return to customer profile
2. Timeline tab now shows all messages from that phone
3. Future messages auto-associate with this customer

## 7. Testing Other Providers

### Gmail Integration
```bash
# Follow OAuth setup in provider config
# Requires Google Cloud Console setup
# See docs/providers/gmail.md for details
```

### WhatsApp Cloud API
```bash
# Requires Meta Business verification
# See docs/providers/whatsapp.md for setup
```

## 8. Basic Operations

### Search Messages
```bash
# Via UI
Navigate to Messages → Enter search term

# Via API
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/messages?q=hello"
```

### Filter by Channel
```bash
# Via UI
Messages → Filter → Channel → Select SMS/Email/etc

# Via API
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/customers/UUID/timeline?channel=sms"
```

### Assign Conversation
```bash
# Via UI
Conversations → Select → Assign to Staff

# Via API
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId":"STAFF_UUID"}' \
  "http://localhost:3001/api/v1/conversations/UUID/assign"
```

## 9. Health Monitoring

### Check Provider Status
```bash
# Via UI
Settings → Providers → View health indicators

# Via API
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/providers/UUID/health"
```

### View Audit Logs
```bash
# Via UI
Settings → Audit Logs

# Via API
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/v1/audit/events"
```

## 10. Running Tests

### Unit Tests
```bash
npm run test:unit
```

### Integration Tests
```bash
# Ensure Docker services are running
npm run test:integration
```

### E2E Tests
```bash
# Start all services first
npm run test:e2e
```

### Contract Tests
```bash
# Verify API contracts
npm run test:contracts
```

## Troubleshooting

### Messages Not Appearing
1. Check webhook URL is accessible (use ngrok for local testing)
2. Verify provider credentials in Settings
3. Check worker logs: `docker logs crm-worker`
4. Verify webhook signatures in audit logs

### Database Connection Issues
```bash
# Reset database
docker-compose down -v
docker-compose up -d
npx prisma migrate reset --force
```

### Provider Health Check Failures
1. Verify API credentials are correct
2. Check network connectivity
3. Review error messages in provider details
4. Check audit logs for detailed errors

## Next Steps

1. **Add Staff Users**: Create accounts for team members
2. **Configure More Providers**: Add email, voice, social channels
3. **Setup Identity Rules**: Configure auto-linking patterns
4. **Customize Tags**: Create tag taxonomy for conversations
5. **Configure Retention**: Set up compliance policies

## Support Resources

- API Documentation: http://localhost:3001/api-docs
- Database Explorer: http://localhost:5555 (Prisma Studio)
- Queue Dashboard: http://localhost:3001/admin/queues
- Logs: `docker-compose logs -f`

## Quick CLI Commands

```bash
# Create admin user
npm run cli -- user:create --email admin@example.com --role admin

# Test provider connection
npm run cli -- provider:test --type twilio --config config.json

# Import historical messages
npm run cli -- import:messages --file messages.csv --provider twilio

# Generate API token
npm run cli -- auth:token --email user@example.com

# Check system health
npm run cli -- health:check
```

---
*For production deployment, see `/docs/deployment.md`*