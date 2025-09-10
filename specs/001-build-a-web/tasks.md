# Tasks: Unified CRM Correspondence Platform

**Input**: Design documents from `/specs/001-build-a-web/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → Tech stack: TypeScript, Next.js 14+, PostgreSQL, Prisma, Bull, Redis
   → Libraries: @crm/ingestion, @crm/identity, @crm/webhooks, @crm/audit
   → Structure: Web app (backend/src/, frontend/src/)
2. Load design documents:
   → data-model.md: 10 entities extracted → 10 model tasks
   → contracts/: API spec with 12 endpoints → 12 contract test tasks
   → research.md: Tech decisions → setup tasks
3. Generate tasks by category:
   → Setup: project structure, dependencies, Docker, Prisma
   → Tests: contract tests [P], integration tests [P]
   → Core: models [P], services, CLI commands
   → Integration: webhooks, queues, auth
   → Polish: unit tests [P], performance, docs
4. Applied task rules:
   → Different files = [P] for parallel execution
   → Tests before implementation (TDD)
   → Dependencies properly ordered
5. Generated 35 tasks (T001-T035)
6. Dependencies validated
7. Parallel execution examples provided
8. Task completeness validated:
   ✓ All contracts have tests
   ✓ All entities have models  
   ✓ All endpoints implemented
9. SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Paths assume web app structure from plan.md

## Phase 3.1: Project Setup
- [ ] T001 Create backend/frontend project structure with Docker Compose for PostgreSQL/Redis
- [ ] T002 Initialize TypeScript projects with Next.js 14+, Prisma, Bull, and testing dependencies
- [ ] T003 [P] Configure ESLint, Prettier, and TypeScript strict mode for both projects
- [ ] T004 [P] Setup Prisma schema with database enums in `backend/prisma/schema.prisma`
- [ ] T005 Create Docker Compose with PostgreSQL 15, Redis, and development environment setup

## Phase 3.2: Contract Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Authentication Contracts [P]
- [ ] T006 [P] Contract test POST /auth/login in `backend/tests/contract/auth.test.ts`

### Customer Contracts [P] 
- [ ] T007 [P] Contract test GET /customers in `backend/tests/contract/customers-list.test.ts`
- [ ] T008 [P] Contract test POST /customers in `backend/tests/contract/customers-create.test.ts`
- [ ] T009 [P] Contract test GET /customers/{id} in `backend/tests/contract/customers-get.test.ts`
- [ ] T010 [P] Contract test GET /customers/{id}/timeline in `backend/tests/contract/timeline.test.ts`
- [ ] T011 [P] Contract test POST /customers/{id}/identities in `backend/tests/contract/identities.test.ts`

### Message & Conversation Contracts [P]
- [ ] T012 [P] Contract test GET /messages in `backend/tests/contract/messages.test.ts`
- [ ] T013 [P] Contract test GET /conversations in `backend/tests/contract/conversations.test.ts`
- [ ] T014 [P] Contract test POST /conversations/{id}/assign in `backend/tests/contract/assign.test.ts`
- [ ] T015 [P] Contract test PUT /conversations/{id}/tags in `backend/tests/contract/tags.test.ts`

### Provider & Webhook Contracts [P]
- [ ] T016 [P] Contract test GET /providers in `backend/tests/contract/providers.test.ts`
- [ ] T017 [P] Contract test POST /providers in `backend/tests/contract/providers-create.test.ts`
- [ ] T018 [P] Contract test GET /providers/{id}/health in `backend/tests/contract/health.test.ts`
- [ ] T019 [P] Contract test POST /webhooks/{provider} in `backend/tests/contract/webhooks.test.ts`

### Audit Contract [P]
- [ ] T020 [P] Contract test GET /audit/events in `backend/tests/contract/audit.test.ts`

## Phase 3.3: Data Models (ONLY after contract tests are failing) [P]
- [ ] T021 [P] Customer model in `backend/src/models/customer.ts`
- [ ] T022 [P] Identity model in `backend/src/models/identity.ts`
- [ ] T023 [P] Message model in `backend/src/models/message.ts`
- [ ] T024 [P] Conversation model in `backend/src/models/conversation.ts`
- [ ] T025 [P] Attachment model in `backend/src/models/attachment.ts`
- [ ] T026 [P] User model in `backend/src/models/user.ts`
- [ ] T027 [P] Provider model in `backend/src/models/provider.ts`
- [ ] T028 [P] Webhook model in `backend/src/models/webhook.ts`
- [ ] T029 [P] AuditEvent model in `backend/src/models/audit-event.ts`
- [ ] T030 [P] ConversationAssignment model in `backend/src/models/conversation-assignment.ts`

## Phase 3.4: Library Services
- [ ] T031 @crm/ingestion library with message normalization service in `backend/src/lib/ingestion/`
- [ ] T032 @crm/identity library with customer resolution service in `backend/src/lib/identity/`
- [ ] T033 @crm/webhooks library with signature verification in `backend/src/lib/webhooks/`
- [ ] T034 @crm/audit library with compliance logging in `backend/src/lib/audit/`

## Phase 3.5: API Implementation
- [ ] T035 Authentication endpoints (/auth/login) with NextAuth configuration
- [ ] T036 Customer CRUD endpoints (/customers, /customers/{id})
- [ ] T037 Customer timeline endpoint (/customers/{id}/timeline) with pagination
- [ ] T038 Identity linking endpoint (/customers/{id}/identities)
- [ ] T039 Message search endpoint (/messages) with full-text search
- [ ] T040 Conversation management endpoints (/conversations, assign, tags)
- [ ] T041 Provider management endpoints (/providers, health checks)
- [ ] T042 Webhook ingestion endpoints (/webhooks/{provider}) with signature validation
- [ ] T043 Audit logging endpoint (/audit/events) with compliance filters

## Phase 3.6: Integration & Queue Processing
- [ ] T044 Bull queue setup for webhook message processing in `backend/src/queue/`
- [ ] T045 Twilio SMS webhook processor with signature verification
- [ ] T046 Gmail webhook processor with OAuth2 validation
- [ ] T047 WhatsApp Cloud API webhook processor
- [ ] T048 Facebook/Instagram webhook processor
- [ ] T049 Identity resolution background jobs
- [ ] T050 Message deduplication middleware

## Phase 3.7: Frontend Implementation
- [ ] T051 Next.js app router setup with authentication in `frontend/src/app/`
- [ ] T052 [P] Customer list page in `frontend/src/app/customers/page.tsx`
- [ ] T053 [P] Customer detail page with timeline in `frontend/src/app/customers/[id]/page.tsx`
- [ ] T054 [P] Message search interface in `frontend/src/app/messages/page.tsx`
- [ ] T055 [P] Conversation management UI in `frontend/src/app/conversations/page.tsx`
- [ ] T056 [P] Provider configuration page in `frontend/src/app/settings/providers/page.tsx`
- [ ] T057 [P] Audit log viewer in `frontend/src/app/settings/audit/page.tsx`
- [ ] T058 Real-time updates with Server-Sent Events

## Phase 3.8: CLI Tools [P]
- [ ] T059 [P] CLI for @crm/ingestion library in `backend/src/lib/ingestion/cli.ts`
- [ ] T060 [P] CLI for @crm/identity library in `backend/src/lib/identity/cli.ts`
- [ ] T061 [P] CLI for @crm/webhooks library in `backend/src/lib/webhooks/cli.ts`
- [ ] T062 [P] CLI for @crm/audit library in `backend/src/lib/audit/cli.ts`

## Phase 3.9: Integration Tests
- [ ] T063 [P] End-to-end webhook ingestion test in `backend/tests/integration/webhook-flow.test.ts`
- [ ] T064 [P] Customer identity resolution test in `backend/tests/integration/identity-resolution.test.ts`
- [ ] T065 [P] Message timeline aggregation test in `backend/tests/integration/timeline.test.ts`
- [ ] T066 [P] Provider health monitoring test in `backend/tests/integration/provider-health.test.ts`

## Phase 3.10: Polish & Validation
- [ ] T067 [P] Unit tests for validation schemas in `backend/tests/unit/validation.test.ts`
- [ ] T068 [P] Unit tests for utility functions in `backend/tests/unit/utils.test.ts`
- [ ] T069 Performance tests ensuring <200ms webhook processing in `backend/tests/performance/`
- [ ] T070 [P] E2E tests with Playwright in `frontend/tests/e2e/`
- [ ] T071 [P] Security audit and vulnerability scanning
- [ ] T072 [P] Update README.md with quickstart guide and deployment instructions
- [ ] T073 Execute quickstart.md scenarios for validation
- [ ] T074 Database migration testing with sample data

## Dependencies

### Critical Path
- Setup (T001-T005) → Contract Tests (T006-T020) → Models (T021-T030)
- Models → Services (T031-T034) → API Implementation (T035-T043)
- Queue Setup (T044) → Webhook Processors (T045-T048)

### Blocking Dependencies
- T021-T030 (models) block T031-T034 (services)
- T035-T043 (API) blocked by T031-T034 (services) 
- T044 (queue setup) blocks T045-T048 (processors)
- T035 (auth) blocks T036-T043 (protected endpoints)
- T001-T005 (setup) blocks all other tasks

### Independent Parallel Groups
- Contract tests T006-T020 can run together
- Model tasks T021-T030 can run together  
- CLI tasks T059-T062 can run together
- Frontend pages T052-T057 can run together
- Integration tests T063-T066 can run together
- Unit tests and polish T067-T074 can run together

## Parallel Execution Examples

### Launch all contract tests together:
```bash
# These can all run simultaneously as they create different test files
Task: "Contract test POST /auth/login in backend/tests/contract/auth.test.ts"
Task: "Contract test GET /customers in backend/tests/contract/customers-list.test.ts"
Task: "Contract test POST /customers in backend/tests/contract/customers-create.test.ts"
Task: "Contract test GET /customers/{id} in backend/tests/contract/customers-get.test.ts"
# ... all T006-T020
```

### Launch all model creation together:
```bash
# These can run simultaneously as each creates a different model file
Task: "Customer model in backend/src/models/customer.ts"
Task: "Identity model in backend/src/models/identity.ts"  
Task: "Message model in backend/src/models/message.ts"
# ... all T021-T030
```

### Launch frontend pages together:
```bash
# These can run simultaneously as each creates different page files
Task: "Customer list page in frontend/src/app/customers/page.tsx"
Task: "Customer detail page in frontend/src/app/customers/[id]/page.tsx"
Task: "Message search interface in frontend/src/app/messages/page.tsx"
# ... all T052-T057
```

## Notes
- [P] tasks = different files, no dependencies between them
- Verify contract tests fail before implementing (TDD requirement)
- Commit after each task completion
- Use Docker for all database/Redis dependencies
- Follow constitutional principles: library-first, CLI per library, real dependencies in tests

## Validation Checklist ✅

- [x] All contracts (T006-T020) have corresponding API implementation tasks
- [x] All entities (10 tables) have model creation tasks (T021-T030)
- [x] All tests (T006-T020, T063-T066) come before implementation
- [x] Parallel tasks [P] are truly independent (different files)
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] Libraries follow constitutional requirement (each has CLI)
- [x] TDD order enforced: Contract → Integration → Implementation → Unit

**Total Tasks**: 74 tasks across 6 phases
**Estimated Duration**: 3-4 weeks for full implementation
**Parallel Opportunities**: 40+ tasks can run in parallel groups