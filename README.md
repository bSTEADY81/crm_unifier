# CRM Unifier

A unified CRM platform that consolidates customer correspondence across multiple communication channels (SMS, email, voice, social media) into a single timeline view.

## 🚀 Quick Start

```bash
# Clone and setup
git clone <repository-url>
cd crm-unifier

# Setup environment
make setup

# Start development
make start
```

## 📋 Project Structure

```
crm-unifier/
├── backend/                 # TypeScript API server
│   ├── src/
│   │   ├── models/         # Prisma models
│   │   ├── services/       # Business logic
│   │   ├── api/           # API routes
│   │   ├── lib/           # Core libraries (@crm/*)
│   │   └── queue/         # Background jobs
│   ├── tests/
│   │   ├── contract/      # API contract tests
│   │   ├── integration/   # Integration tests
│   │   ├── unit/         # Unit tests
│   │   └── performance/   # Performance tests
│   └── prisma/           # Database schema
├── frontend/               # Next.js web application
│   ├── src/
│   │   ├── app/          # Next.js app router
│   │   ├── components/   # React components
│   │   ├── hooks/        # Custom React hooks
│   │   └── lib/         # Client utilities
│   └── tests/
│       └── e2e/         # Playwright E2E tests
├── shared/                # Shared TypeScript types
└── specs/                # Feature specifications
```

## 🛠 Development

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL client (optional)

### Commands

```bash
# Environment
make setup          # Initial setup
make start          # Start all services
make stop           # Stop services
make restart        # Restart services

# Database  
make db-setup       # Initialize database
make db-studio      # Open Prisma Studio
make db-reset       # Reset database (destructive)

# Testing
make test-setup     # Setup test environment  
make test           # Run all tests
make test-e2e       # Run E2E tests

# Development
make dev-backend    # Start backend dev server
make dev-frontend   # Start frontend dev server  
make dev-worker     # Start queue worker

# Utilities
make logs           # View logs
make health         # Check service status
make clean          # Clean up everything
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js web application |
| Backend API | 3001 | TypeScript API server |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache & message queues |
| Prisma Studio | 5555 | Database GUI |

## 🏗 Architecture

### Core Libraries
- **@crm/ingestion**: Message normalization and storage
- **@crm/identity**: Customer identity resolution  
- **@crm/webhooks**: Provider webhook handling
- **@crm/audit**: Compliance and audit logging

### Supported Providers
- Twilio SMS
- Gmail
- Twilio Voice (call logs)
- WhatsApp Cloud API
- Instagram Messaging
- Facebook Messenger

### Key Features
- Unified customer timeline across all channels
- Real-time message ingestion via webhooks
- Identity resolution (linking phone, email, social)
- Staff assignment and conversation management
- Search and filtering capabilities
- Audit logging (Australia Privacy Act compliant)
- Provider health monitoring

## 🧪 Testing

### Test Strategy
1. **Contract Tests**: API endpoint validation
2. **Integration Tests**: Service interaction testing
3. **E2E Tests**: Full user workflow testing
4. **Unit Tests**: Component and utility testing

### TDD Workflow
```bash
# 1. Write failing tests first
cd backend && npm run test:watch

# 2. Implement to make tests pass
# 3. Refactor while keeping tests green
```

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env.local` and configure:

```env
# Database
DATABASE_URL="postgresql://crm:password@localhost:5432/crm_unifier"

# Auth  
NEXTAUTH_SECRET="your-secret-here"

# Provider APIs
TWILIO_ACCOUNT_SID="ACxxxxx"
GMAIL_CLIENT_ID="xxxxx.apps.googleusercontent.com"
# ... etc
```

### Provider Setup
1. Configure credentials in `.env.local`
2. Start services: `make start`
3. Configure webhooks in provider dashboards
4. Test ingestion with sample messages

## 📚 Documentation

- [Quickstart Guide](specs/001-build-a-web/quickstart.md)
- [API Documentation](http://localhost:3001/api-docs)
- [Data Model](specs/001-build-a-web/data-model.md)
- [Task Breakdown](specs/001-build-a-web/tasks.md)

## 🤝 Contributing

1. Follow TDD methodology (tests before code)
2. Use conventional commit format
3. Ensure all tests pass before PR
4. Update documentation for new features

## 📄 License

MIT License - see LICENSE file for details