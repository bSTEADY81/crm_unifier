# Feature Specification: Unified CRM Correspondence Platform

**Feature Branch**: `001-build-a-web`  
**Created**: 2025-09-09  
**Status**: Draft  
**Input**: User description: "Build a web CRM that unifies all client correspondence by customer. Single customer timeline across channels including Twilio SMS, Gmail, Twilio Voice, WhatsApp Cloud API, Instagram Messaging, Facebook Messenger. Read-only MVP with ingest and display only. Admin connection management and webhook configuration. Basic search, filters, tags, staff assignment. Identity resolution linking phones, emails, social handles. Canonical message model with audit logging meeting Australia Privacy Act requirements."

## Execution Flow (main)
```
1. Parse user description from Input
   → Feature: Unified CRM for multi-channel customer correspondence
2. Extract key concepts from description
   → Actors: customers, admin users, staff members
   → Actions: view timeline, connect providers, configure webhooks, search/filter, assign staff, link identities
   → Data: messages, customers, identities, provider connections, audit logs
   → Constraints: read-only MVP, Australia Privacy Act compliance
3. For each unclear aspect:
   → Admin authentication method not specified
   → Staff permission model not defined
   → Data retention periods for compliance
4. Fill User Scenarios & Testing section
   → Admin connects communication providers
   → Staff views unified customer timeline
   → System ingests messages from multiple channels
5. Generate Functional Requirements
   → Each requirement mapped to success criteria
6. Identify Key Entities
   → Customers, Messages, Identities, Providers, Audit Events
7. Run Review Checklist
   → WARN: Some clarifications needed for complete spec
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing

### Primary User Story
As a customer service representative, I need to see all communications with a customer in one unified timeline, regardless of which channel they used (SMS, email, voice, social media), so I can provide informed and consistent support without switching between multiple systems.

### Acceptance Scenarios
1. **Given** a customer has contacted support via SMS and email, **When** a staff member searches for that customer, **Then** all messages appear in a single chronological timeline
2. **Given** an admin has connected Twilio SMS and Gmail, **When** a new SMS arrives from a customer, **Then** it appears in that customer's timeline within seconds
3. **Given** multiple phone numbers and email addresses belong to the same person, **When** an admin links these identities, **Then** all associated messages merge into one customer timeline
4. **Given** a staff member needs to find recent interactions, **When** they apply filters for date range and channel, **Then** only matching messages are displayed
5. **Given** compliance requirements exist, **When** any data access occurs, **Then** an audit log entry is created with user, action, and timestamp

### Edge Cases
- What happens when webhook delivery fails? System must show integration health status
- How does system handle duplicate messages? Must use provider message IDs for idempotency
- What if identity linking is incorrect? Admin must be able to unlink identities
- How are orphaned messages handled? Messages without customer match go to unassigned queue

## Requirements

### Functional Requirements
- **FR-001**: System MUST display a unified timeline of all customer correspondence across all connected channels
- **FR-002**: System MUST support ingestion from Twilio SMS, Gmail, Twilio Voice (call logs/recordings), WhatsApp Cloud API, Instagram Messaging, and Facebook Messenger
- **FR-003**: System MUST operate as read-only in MVP phase (no outbound message sending)
- **FR-004**: Admin users MUST be able to connect communication providers and configure webhook endpoints
- **FR-005**: System MUST provide search functionality across customer names, message content, and identifiers
- **FR-006**: Users MUST be able to filter messages by date range, channel, and custom tags
- **FR-007**: Staff MUST be able to assign conversations to team members for follow-up
- **FR-008**: System MUST perform identity resolution to link phone numbers, email addresses, and social handles to a single customer profile
- **FR-009**: System MUST store messages using a canonical model containing: id, channel, direction, from, to, customer_id, thread_key, timestamp, body, attachments, provider metadata, and status
- **FR-010**: System MUST use provider message IDs to ensure idempotent storage (no duplicates)
- **FR-011**: System MUST display integration health status on admin connections page
- **FR-012**: System MUST create audit logs for all data access and modifications
- **FR-013**: System MUST implement retention controls compliant with Australia Privacy Act requirements
- **FR-014**: System MUST authenticate admin users via [NEEDS CLARIFICATION: authentication method not specified - email/password, SSO, OAuth?]
- **FR-015**: System MUST define staff permissions for [NEEDS CLARIFICATION: permission model not specified - view only, assign, tag, admin?]
- **FR-016**: System MUST retain customer data for [NEEDS CLARIFICATION: retention period not specified for Privacy Act compliance]
- **FR-017**: System MUST verify webhook signatures from providers to ensure message authenticity

### Non-Functional Requirements
- **NFR-001**: System explicitly excludes marketing automation capabilities
- **NFR-002**: System explicitly excludes bulk campaign functionality
- **NFR-003**: System explicitly excludes complex analytics beyond basic search and filters

### Key Entities
- **Customer**: Represents an individual with whom the organization communicates; has multiple identities across channels
- **Identity**: A specific identifier (phone, email, social handle) that belongs to a customer
- **Message**: A single communication event from any channel, stored in canonical format
- **Conversation**: A thread or grouping of related messages, identified by thread_key
- **Provider**: An external communication service (Twilio, Gmail, etc.) that sends messages to the system
- **Attachment**: Media files associated with messages (images, documents, voice recordings)
- **User**: System users including admin and staff members with different permission levels
- **Audit Event**: A record of system access or modification for compliance tracking
- **Webhook**: Configured endpoint for receiving messages from providers

---

## Review & Acceptance Checklist

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [ ] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous (except marked items)
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

### Success Criteria Validation
- [x] Local demo shows unified timeline per customer (FR-001)
- [x] Live ingestion from Twilio SMS and Gmail (FR-002)
- [x] Idempotent storage using provider message IDs (FR-010)
- [x] Admin connections page shows health of each integration (FR-011)

---

## Execution Status

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed (with clarifications needed)

---

## Deliverables Tracking

Based on the specified deliverables, the following additional specifications will be created:

### specs/overview.md
- Scope definition and boundaries
- Success metrics and KPIs
- Project phases and milestones
- Stakeholder mapping

### specs/data-model.md
- **customers** table: customer profiles and metadata
- **identities** table: phone numbers, emails, social handles linked to customers
- **conversations** table: thread groupings for related messages
- **messages** table: canonical message storage
- **attachments** table: media and document storage
- **users** table: system users and roles
- **events** table: audit and system events
- **webhooks** table: provider webhook configurations

### specs/security.md
- Webhook signature verification protocols
- PII handling and encryption requirements
- Audit event specifications
- Access control and authentication
- Data retention and deletion policies
- Australia Privacy Act compliance measures

### specs/ingestion.md
- Provider-specific contracts and data formats
- Normalization rules for canonical message model
- Webhook endpoint specifications
- Error handling and retry logic
- Rate limiting and throttling
- Health check and monitoring requirements

---