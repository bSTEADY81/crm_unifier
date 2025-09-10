# CRM Unifier Development Guidelines

Auto-generated from feature plans. Last updated: 2025-09-09

## Active Technologies
- **Backend**: TypeScript 5.x, Node.js 20+, Next.js 14+ API Routes
- **Frontend**: React 18+, Next.js App Router, Tailwind CSS
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Queue**: Bull with Redis backend
- **Testing**: Vitest, Playwright, Supertest
- **Real-time**: Server-Sent Events (SSE)

## Project Structure
```
backend/
├── src/
│   ├── models/        # Prisma models
│   ├── services/      # Business logic
│   ├── api/          # API routes
│   └── lib/          # Shared libraries
└── tests/
    ├── contract/     # API contract tests
    ├── integration/  # Service integration tests
    └── unit/        # Unit tests

frontend/
├── src/
│   ├── app/         # Next.js app directory
│   ├── components/  # React components  
│   ├── hooks/       # Custom React hooks
│   └── lib/        # Client utilities
└── tests/
    └── e2e/        # Playwright tests

shared/
└── types/          # Shared TypeScript types
```

## Key Libraries
- **@crm/ingestion**: Message normalization and storage
- **@crm/identity**: Customer identity resolution  
- **@crm/webhooks**: Provider webhook handling
- **@crm/audit**: Compliance and audit logging

## Development Commands
```bash
# Setup
npm install
docker-compose up -d
npx prisma migrate dev

# Development
npm run dev:backend   # API on :3001
npm run dev:frontend  # UI on :3000
npm run dev:worker   # Queue processor

# Testing
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:contracts

# Database
npx prisma studio    # GUI on :5555
npx prisma migrate dev
npx prisma db seed

# CLI Tools
npm run cli -- user:create
npm run cli -- provider:test
npm run cli -- health:check
```

## Code Style
- **TypeScript**: Strict mode enabled, no any types
- **React**: Functional components with hooks
- **API**: RESTful with OpenAPI spec
- **Database**: Migrations via Prisma
- **Testing**: TDD - tests before implementation
- **Commits**: Conventional commits format

## Testing Requirements
1. **Order**: Contract → Integration → E2E → Unit
2. **Coverage**: 80% minimum for critical paths
3. **Real Dependencies**: Use Docker containers, not mocks
4. **RED-GREEN-Refactor**: Tests must fail first

## Security Practices
- Environment variables for secrets
- Webhook signature verification
- CSRF protection via NextAuth
- Input validation with Zod
- Column-level encryption for PII
- Audit logging for all data access

## Performance Goals
- Webhook processing: <200ms
- Page load: <1s
- API response: <100ms p95
- Message deduplication via unique constraints
- Database indexes on search/filter fields

## Provider Integration
### Webhook Endpoints
- POST `/api/v1/webhooks/twilio`
- POST `/api/v1/webhooks/gmail`
- POST `/api/v1/webhooks/whatsapp`
- POST `/api/v1/webhooks/facebook`
- POST `/api/v1/webhooks/instagram`

### Signature Verification
- Twilio: X-Twilio-Signature
- Meta: X-Hub-Signature-256
- Gmail: OAuth2 bearer token

## Database Conventions
- UUID primary keys
- Timestamps: created_at, updated_at
- Soft deletes with deleted_at
- JSONB for flexible metadata
- Enums for fixed options

## API Conventions
- Version prefix: /api/v1
- Pagination: page, limit params
- Filtering: query params
- Errors: Consistent error schema
- Auth: Bearer token (JWT)

## Recent Changes
- **001-build-a-web**: Initial CRM platform setup with multi-channel ingestion, identity resolution, and audit logging

## Quick Fixes
```bash
# Reset database
docker-compose down -v && docker-compose up -d
npx prisma migrate reset --force

# Clear Redis cache  
docker exec crm-redis redis-cli FLUSHALL

# Rebuild dependencies
rm -rf node_modules package-lock.json
npm install
```

<!-- MANUAL ADDITIONS START -->
<!-- Add project-specific notes here -->
<!-- MANUAL ADDITIONS END -->

## Constitutional Principles
1. **Library-First**: Every feature as standalone library
2. **CLI Interface**: Each library exposes CLI
3. **Test-First**: TDD mandatory, tests before code
4. **Real Dependencies**: No mocks in integration tests
5. **Observability**: Structured logging throughout
6. **Simplicity**: Avoid unnecessary abstractions

---
*Reference: /specs/001-build-a-web/plan.md for full details*