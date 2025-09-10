# Research & Technical Decisions

**Feature**: Unified CRM Correspondence Platform  
**Date**: 2025-09-09  
**Phase**: 0 - Research & Discovery

## Executive Summary
This document captures research findings and technical decisions for building a read-only CRM that unifies customer correspondence across multiple channels. All previously identified NEEDS CLARIFICATION items have been resolved through research and best practice analysis.

## Architecture Decisions

### 1. Authentication Method
**Decision**: NextAuth.js with email/password + optional OAuth providers  
**Rationale**: 
- Flexible authentication supporting both simple and enterprise needs
- Built-in session management and CSRF protection
- Easy to add SSO providers later
**Alternatives Considered**:
- Auth0/Clerk: More expensive for small teams
- Custom JWT: More development effort, security risks

### 2. Permission Model  
**Decision**: Role-Based Access Control (RBAC) with three tiers
- Admin: Full system access, provider connections, user management
- Staff: View messages, assign conversations, add tags, no admin functions
- Viewer: Read-only access to assigned customers only
**Rationale**: Simple model covering identified use cases without over-engineering
**Alternatives Considered**:
- ABAC: Too complex for MVP
- Simple admin/user: Insufficient granularity for teams

### 3. Data Retention Policy
**Decision**: 7-year retention with configurable purge rules
**Rationale**: 
- Australia Privacy Act requires records for 7 years after last interaction
- Configurable rules allow compliance with other jurisdictions
- Soft delete with audit trail for first 30 days
**Alternatives Considered**:
- Indefinite retention: Privacy/storage concerns
- 2-year minimum: Non-compliant with regulations

## Technology Stack Research

### Frontend Framework
**Decision**: Next.js 14+ with App Router
**Rationale**:
- Server components reduce client bundle size
- Built-in API routes for webhooks
- Excellent TypeScript support
- ISR for dashboard performance
**Best Practices**:
- Use server components by default
- Client components only for interactivity
- Implement proper loading/error boundaries

### Database & ORM
**Decision**: PostgreSQL with Prisma ORM
**Rationale**:
- JSONB support for provider metadata
- Full-text search capabilities
- Robust transaction support for idempotency
- Prisma provides type safety and migrations
**Best Practices**:
- Use database transactions for webhook processing
- Index on provider_message_id for deduplication
- Partition messages table by month for performance

### Message Queue
**Decision**: Bull with Redis backend
**Rationale**:
- Reliable webhook processing with retries
- Built-in job scheduling for polling-based providers
- Dashboard for monitoring queue health
**Best Practices**:
- Separate queues per provider
- Exponential backoff for retries
- Dead letter queue for failed messages

### Real-time Updates
**Decision**: Server-Sent Events (SSE)
**Rationale**:
- Simpler than WebSockets for one-way updates
- Built-in reconnection
- Works through proxies/CDNs
**Alternatives Considered**:
- WebSockets: Overkill for read-only MVP
- Polling: Poor UX, higher server load

## Provider Integration Patterns

### Webhook Security
**Research Findings**:
- Twilio: X-Twilio-Signature header validation
- Meta (FB/IG/WhatsApp): X-Hub-Signature-256 with SHA256
- Gmail: OAuth2 with push notifications via Pub/Sub

**Implementation Pattern**:
```typescript
interface WebhookValidator {
  validate(headers: Headers, body: string): boolean;
}

class TwilioValidator implements WebhookValidator {
  validate(headers, body) {
    // Signature validation logic
  }
}
```

### Message Normalization
**Canonical Model Mapping**:
| Provider | Channel | ID Field | Thread Key | Attachments |
|----------|---------|----------|------------|-------------|
| Twilio SMS | sms | MessageSid | From+To | MediaUrl[] |
| Gmail | email | Message-ID | Thread-ID | Parts[] |
| WhatsApp | whatsapp | MessageId | ChatId | Media{} |
| Meta | facebook/instagram | mid | conversation_id | attachments[] |

### Identity Resolution Strategy
**Algorithm**:
1. Exact match on normalized phone/email
2. Fuzzy match on name (Levenshtein distance < 3)
3. Social handle linking via provider APIs
4. Manual admin override capability

**Data Structure**:
```typescript
interface Identity {
  id: string;
  customerId: string;
  type: 'phone' | 'email' | 'social';
  value: string; // normalized
  rawValue: string; // original
  provider?: string;
  verified: boolean;
  linkedAt: Date;
}
```

## Compliance & Security

### Australia Privacy Act Requirements
**Key Findings**:
- APP 11: Security of personal information
- APP 12: Access and correction rights
- APP 13: Overseas disclosure restrictions

**Implementation Requirements**:
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Audit log of all data access
- Data export functionality
- Right to correction workflow

### Audit Logging Schema
```typescript
interface AuditEvent {
  id: string;
  timestamp: Date;
  userId: string;
  action: string; // e.g., 'message.view', 'customer.search'
  resourceType: string;
  resourceId: string;
  metadata: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}
```

## Performance Optimizations

### Database Indexes
```sql
-- Fast message lookups
CREATE INDEX idx_messages_customer_timestamp ON messages(customer_id, timestamp DESC);
CREATE UNIQUE INDEX idx_messages_provider_id ON messages(provider_message_id, provider);

-- Identity resolution
CREATE INDEX idx_identities_value ON identities(type, value);

-- Audit compliance
CREATE INDEX idx_audit_user_timestamp ON audit_events(user_id, timestamp DESC);
```

### Caching Strategy
- Redis for session storage (NextAuth)
- PostgreSQL query caching for customer timelines
- CDN for static assets
- No caching of PII data

## Development Workflow

### Local Development Setup
```bash
# Docker services
docker-compose up -d postgres redis

# Environment setup
cp .env.example .env.local

# Database setup
npx prisma migrate dev
npx prisma db seed

# Run development servers
npm run dev:backend  # Port 3001
npm run dev:frontend # Port 3000
```

### Testing Infrastructure
- GitHub Actions for CI/CD
- Docker containers for test databases
- Playwright for E2E with real provider webhooks
- Coverage requirements: 80% for critical paths

## Risk Mitigation

### Identified Risks & Mitigations
1. **Webhook overwhelming**: Rate limiting, queue throttling
2. **Data loss**: Idempotent processing, message deduplication
3. **PII exposure**: Column-level encryption, access controls
4. **Provider API changes**: Version pinning, contract tests
5. **Identity mismatching**: Manual review queue, undo capability

## Next Steps
With all technical decisions made and NEEDS CLARIFICATION items resolved, the project is ready to proceed to Phase 1 (Design & Contracts). The chosen stack balances simplicity with scalability, ensuring the MVP can be delivered quickly while maintaining a path to production readiness.

---
*Research completed: 2025-09-09*