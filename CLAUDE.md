# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CRM Unifier is a unified customer correspondence platform that consolidates communication channels (SMS, email, voice, social media) into a single timeline view. The system consists of a TypeScript backend API and a Next.js frontend, with PostgreSQL and Redis for data storage and queueing.

## Development Commands

### Environment Setup
```bash
make setup              # Full environment setup
make quick-setup        # Quick setup with env copy
make start              # Start core services (postgres, redis)
make start-all          # Start all services including dev tools
```

### Development Servers
```bash
make dev-backend        # Backend API on :3001
make dev-frontend       # Frontend on :3000  
make dev-worker         # Queue worker process
```

### Database Operations  
```bash
make db-setup           # Initialize with migrations and seed
make db-studio          # Open Prisma Studio on :5555
make db-reset           # Reset database (destructive)

# Direct Prisma commands (from backend/)
npm run prisma:migrate  # Run migrations
npm run prisma:generate # Generate client
npm run prisma:seed     # Seed database
npm run prisma:studio   # Open Studio
```

### Testing
```bash
make test               # Run all tests
make test-e2e           # Run Playwright E2E tests
make test-setup         # Setup test environment

# Backend testing (from backend/)
npm run test:watch      # TDD mode
npm run test:unit       # Unit tests
npm run test:integration # Integration tests
npm run test:contract   # API contract tests
npm run test:performance # Performance tests

# Frontend testing (from frontend/)
npm run test:e2e        # Playwright tests
npm run test:e2e:headed # Headed mode
npm run test:e2e:debug  # Debug mode
```

### Utilities
```bash
make health             # Check service status
make health-full        # Full health check with URLs
make logs               # View all logs
make clean              # Clean containers and artifacts
```

## Architecture Overview

### Monorepo Structure
- **`backend/`**: TypeScript Express API with Prisma ORM
- **`frontend/`**: Next.js 14 with App Router and React 18
- **`shared/`**: Shared TypeScript types across services
- **`specs/`**: Feature specifications and documentation

### Backend Architecture
- **Express App**: Security-hardened with Helmet, CORS, rate limiting
- **Database Layer**: Prisma ORM with PostgreSQL
- **Queue System**: BullMQ with Redis backend
- **Core Libraries**: Modular `@crm/*` packages for specific domains
  - `@crm/ingestion`: Message normalization and storage
  - `@crm/identity`: Customer identity resolution
  - `@crm/webhooks`: Provider webhook processing
  - `@crm/audit`: Compliance and audit logging

### Frontend Architecture
- **Next.js App Router**: File-based routing in `src/app/`
- **Authentication**: NextAuth with JWT tokens
- **Client State**: React Context for auth, React Query for server state
- **UI Components**: Radix UI primitives with Tailwind CSS
- **Type Safety**: Strict TypeScript with Zod validation

### Key Design Patterns

#### Client/Server Separation in Next.js
The frontend uses a client wrapper pattern to prevent server-side rendering issues:
- `src/app/Providers.tsx`: Client-side context wrapper with `'use client'`
- `src/app/layout.tsx`: Server component that imports the client wrapper
- Error pages (`error.tsx`, `not-found.tsx`) are properly marked as client/server components

#### Security-First Backend
- Multiple layers of security middleware (helmet, CORS, rate limiting)
- Input validation with Zod schemas  
- SQL injection prevention
- Request size limits and timeouts
- Comprehensive security logging

#### Test-Driven Development
- Contract tests validate API endpoints
- Integration tests use real Docker containers
- E2E tests cover full user workflows
- TDD workflow: tests written before implementation

### Database Schema Patterns
- UUID primary keys for all entities
- Standardized timestamps (`created_at`, `updated_at`)
- Soft deletes with `deleted_at`
- JSONB columns for flexible metadata
- Enums for constrained values (message types, statuses, etc.)

### Provider Integration
The system integrates with multiple communication providers through a unified webhook system:
- Twilio (SMS/Voice): `/api/v1/webhooks/twilio`
- Gmail: `/api/v1/webhooks/gmail` 
- WhatsApp: `/api/v1/webhooks/whatsapp`
- Social platforms: Facebook, Instagram webhooks

Each provider requires signature verification and has specific payload formats handled by the ingestion library.

## Development Workflow

### TDD Methodology
1. Write failing tests first (contract → integration → unit)
2. Implement minimal code to pass tests
3. Refactor while keeping tests green
4. Maintain 80%+ coverage on critical paths

### Service Development
```bash
# Start dependencies
make start

# TDD backend development  
cd backend && npm run test:watch

# Start frontend in parallel
make dev-frontend
```

### Environment Configuration
- Copy `.env.example` to `.env.local` for local development
- Docker Compose provides consistent PostgreSQL and Redis instances  
- All services configured to work together out of the box

## Key Libraries and Tools

### Backend Stack
- **Express**: Web framework with security middleware
- **Prisma**: Type-safe database ORM
- **BullMQ**: Redis-based job queuing
- **Vitest**: Fast unit testing framework
- **Zod**: Runtime type validation
- **Pino**: Structured logging

### Frontend Stack  
- **Next.js 14**: React framework with App Router
- **Tailwind CSS**: Utility-first CSS framework
- **Radix UI**: Accessible component primitives
- **React Query**: Server state management
- **React Hook Form**: Form handling with validation
- **Playwright**: End-to-end testing

### Development Services
| Service | Port | Purpose |
|---------|------|---------|
| Frontend | 3000 | Next.js web app |
| Backend API | 3001 | Express server |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache and queues |
| Prisma Studio | 5555 | Database GUI |
| pgAdmin | 5050 | PostgreSQL admin (optional) |
| Mailpit | 8025 | Email testing (optional) |

## Common Patterns

### Authentication Flow
- NextAuth handles OAuth and JWT tokens
- Backend validates JWTs on protected routes
- Frontend uses auth context for user state
- Protected pages check authentication in layouts

### Message Processing Pipeline
1. **Webhook Receipt**: Provider sends webhook to `/api/v1/webhooks/{provider}`
2. **Signature Validation**: Verify webhook authenticity  
3. **Ingestion**: Normalize message format via `@crm/ingestion`
4. **Identity Resolution**: Link message to customer via `@crm/identity`
5. **Storage**: Persist to database with audit trail
6. **Real-time Updates**: Notify frontend via SSE/WebSocket

### Error Handling
- Structured error responses with consistent schema
- Client-side error boundaries for React components
- Server-side error middleware with security logging
- Graceful fallbacks for external service failures

## Security Considerations

### Data Protection
- Column-level encryption for PII (planned)
- Audit logging for all data access
- GDPR-compliant data retention policies
- Secure webhook signature verification

### Application Security
- CSRF protection via NextAuth
- XSS prevention with content security policies
- SQL injection prevention through Prisma
- Rate limiting on API endpoints
- Input sanitization and validation