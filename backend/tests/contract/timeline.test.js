import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import app from '../../src/app';
const prisma = new PrismaClient();
describe('GET /customers/{id}/timeline - Contract Test', () => {
    let authToken;
    let testUser;
    let testCustomer;
    let testProvider;
    let testConversation;
    let testMessages;
    let timestamp;
    beforeAll(async () => {
        // Create test user for authentication
        testUser = await prisma.user.upsert({
            where: { email: 'timeline-test@example.com' },
            update: {},
            create: {
                email: 'timeline-test@example.com',
                name: 'Timeline Test User',
                role: 'staff',
                metadata: {
                    createdBy: 'contract-test',
                    passwordHash: await bcrypt.hash('TestPass123!', 12)
                }
            }
        });
        // Create auth token
        authToken = jwt.sign({ userId: testUser.id, email: testUser.email, role: testUser.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
        // Create test customer
        testCustomer = await prisma.customer.create({
            data: {
                name: 'Timeline Customer',
                displayName: 'Timeline',
                metadata: { source: 'contract-test' }
            }
        });
        // Create test provider
        testProvider = await prisma.provider.upsert({
            where: { name: 'Test Provider Contract' },
            update: {},
            create: {
                name: 'Test Provider Contract',
                type: 'twilio_sms',
                status: 'active',
                config: { encrypted: true }
            }
        });
        // Create test conversation
        testConversation = await prisma.conversation.create({
            data: {
                threadKey: 'timeline-test-thread',
                customerId: testCustomer.id,
                channel: 'sms',
                status: 'active'
            }
        });
        // Create test messages with varied timestamps and channels
        timestamp = Date.now();
        const message1 = await prisma.message.create({
            data: {
                providerMessageId: `msg-001-${timestamp}`,
                providerId: testProvider.id,
                customerId: testCustomer.id,
                conversationId: testConversation.id,
                channel: 'sms',
                direction: 'inbound',
                fromIdentifier: '+12345678901',
                toIdentifier: '+10987654321',
                threadKey: 'timeline-test-thread',
                timestamp: new Date('2024-01-15T10:00:00Z'),
                body: 'Hello, I need help with my account.',
                status: 'processed',
                providerMeta: { messageId: 'sms-001' }
            }
        });
        const message2 = await prisma.message.create({
            data: {
                providerMessageId: `msg-002-${timestamp}`,
                providerId: testProvider.id,
                customerId: testCustomer.id,
                conversationId: testConversation.id,
                channel: 'sms',
                direction: 'outbound',
                fromIdentifier: '+10987654321',
                toIdentifier: '+12345678901',
                threadKey: 'timeline-test-thread',
                timestamp: new Date('2024-01-15T10:05:00Z'),
                body: 'Hi! I\'d be happy to help you. What specific issue are you experiencing?',
                status: 'processed',
                providerMeta: { messageId: 'sms-002' }
            }
        });
        const message3 = await prisma.message.create({
            data: {
                providerMessageId: `msg-003-${timestamp}`,
                providerId: testProvider.id,
                customerId: testCustomer.id,
                conversationId: testConversation.id,
                channel: 'email',
                direction: 'inbound',
                fromIdentifier: 'customer@example.com',
                toIdentifier: 'support@company.com',
                threadKey: 'email-thread-001',
                timestamp: new Date('2024-01-15T14:30:00Z'),
                body: 'Follow-up email with additional details about the account issue.',
                status: 'processed',
                providerMeta: { messageId: 'email-001', subject: 'Account Issue Follow-up' }
            }
        });
        testMessages = [message1, message2, message3];
    });
    afterAll(async () => {
        await prisma.$disconnect();
    });
    describe('GET /api/v1/customers/{customerId}/timeline', () => {
        it('should return customer message timeline with all messages', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual({
                customerId: testCustomer.id,
                messages: expect.arrayContaining([
                    {
                        id: testMessages[0].id,
                        providerMessageId: `msg-001-${timestamp}`,
                        customerId: testCustomer.id,
                        conversationId: testConversation.id,
                        channel: 'sms',
                        direction: 'inbound',
                        from: '+12345678901',
                        to: '+10987654321',
                        timestamp: '2024-01-15T10:00:00.000Z',
                        body: 'Hello, I need help with my account.',
                        status: 'processed',
                        providerMeta: { messageId: 'sms-001' },
                        attachments: []
                    },
                    {
                        id: testMessages[1].id,
                        providerMessageId: `msg-002-${timestamp}`,
                        customerId: testCustomer.id,
                        conversationId: testConversation.id,
                        channel: 'sms',
                        direction: 'outbound',
                        from: '+10987654321',
                        to: '+12345678901',
                        timestamp: '2024-01-15T10:05:00.000Z',
                        body: 'Hi! I\'d be happy to help you. What specific issue are you experiencing?',
                        status: 'processed',
                        providerMeta: { messageId: 'sms-002' },
                        attachments: []
                    },
                    {
                        id: testMessages[2].id,
                        providerMessageId: `msg-003-${timestamp}`,
                        customerId: testCustomer.id,
                        conversationId: testConversation.id,
                        channel: 'email',
                        direction: 'inbound',
                        from: 'customer@example.com',
                        to: 'support@company.com',
                        timestamp: '2024-01-15T14:30:00.000Z',
                        body: 'Follow-up email with additional details about the account issue.',
                        status: 'processed',
                        providerMeta: { messageId: 'email-001', subject: 'Account Issue Follow-up' },
                        attachments: []
                    }
                ]),
                pagination: {
                    page: 1,
                    limit: expect.any(Number),
                    total: 3,
                    totalPages: 1
                }
            });
            // Verify messages are sorted by timestamp (descending - newest first)
            const messages = response.body.messages;
            expect(new Date(messages[0].timestamp).getTime()).toBeGreaterThanOrEqual(new Date(messages[1].timestamp).getTime());
        });
        it('should filter messages by channel', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline?channel=sms`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body.messages).toHaveLength(2);
            expect(response.body.messages.every((m) => m.channel === 'sms')).toBe(true);
            expect(response.body.pagination.total).toBe(2);
        });
        it('should filter messages by date range', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline?from=2024-01-15T10:00:00Z&to=2024-01-15T10:30:00Z`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body.messages).toHaveLength(2);
            // Verify all messages are within the specified range
            response.body.messages.forEach((message) => {
                const timestamp = new Date(message.timestamp);
                expect(timestamp.getTime()).toBeGreaterThanOrEqual(new Date('2024-01-15T10:00:00Z').getTime());
                expect(timestamp.getTime()).toBeLessThanOrEqual(new Date('2024-01-15T10:30:00Z').getTime());
            });
        });
        it('should handle pagination parameters', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline?page=1&limit=2`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body.messages).toHaveLength(2);
            expect(response.body.pagination).toEqual({
                page: 1,
                limit: 2,
                total: 3,
                totalPages: 2
            });
        });
        it('should return empty timeline for customer with no messages', async () => {
            const emptyCustomer = await prisma.customer.create({
                data: {
                    name: 'Empty Timeline Customer',
                    metadata: { source: 'contract-test' }
                }
            });
            const response = await request(app)
                .get(`/api/v1/customers/${emptyCustomer.id}/timeline`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            expect(response.body).toEqual({
                customerId: emptyCustomer.id,
                messages: [],
                nextCursor: null,
                pagination: {
                    page: 1,
                    limit: expect.any(Number),
                    total: 0,
                    totalPages: 0
                }
            });
            // Clean up
            await prisma.customer.delete({
                where: { id: emptyCustomer.id }
            });
        });
        it('should return 404 for non-existent customer', async () => {
            const nonExistentId = '550e8400-e29b-41d4-a716-446655440000';
            const response = await request(app)
                .get(`/api/v1/customers/${nonExistentId}/timeline`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(404);
            expect(response.body).toEqual({
                error: 'Not Found',
                message: 'Customer not found'
            });
        });
        it('should return 400 for invalid UUID format', async () => {
            const response = await request(app)
                .get('/api/v1/customers/invalid-uuid/timeline')
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'customerId',
                        message: expect.stringContaining('valid UUID')
                    })
                ])
            });
        });
        it('should validate channel parameter', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline?channel=invalid-channel`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'channel',
                        message: 'valid email'
                    })
                ])
            });
        });
        it('should validate date format for from/to parameters', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline?from=invalid-date&to=also-invalid`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'from',
                        message: expect.stringContaining('valid date')
                    }),
                    expect.objectContaining({
                        field: 'to',
                        message: expect.stringContaining('valid date')
                    })
                ])
            });
        });
        it('should require authentication', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline`)
                .expect('Content-Type', /json/)
                .expect(401);
            expect(response.body).toEqual({
                error: 'Unauthorized',
                message: 'Authentication required'
            });
        });
        it('should reject invalid Bearer token', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline`)
                .set('Authorization', 'Bearer invalid-token')
                .expect('Content-Type', /json/)
                .expect(401);
            expect(response.body).toEqual({
                error: 'Unauthorized',
                message: 'Invalid or expired token'
            });
        });
        it('should validate pagination limits', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline?page=0&limit=1001`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        field: 'page',
                        message: 'Page must be at least 1'
                    }),
                    expect.objectContaining({
                        field: 'limit',
                        message: 'Limit must be between 1 and 1000'
                    })
                ])
            });
        });
        it('should handle logical date range validation', async () => {
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline?from=2024-01-20T00:00:00Z&to=2024-01-15T00:00:00Z`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(400);
            expect(response.body).toEqual({
                error: 'Validation failed',
                details: expect.arrayContaining([
                    expect.objectContaining({
                        message: expect.stringContaining('from date must be before to date')
                    })
                ])
            });
        });
        it('should include message attachments when present', async () => {
            // Create a message with an attachment
            const messageWithAttachment = await prisma.message.create({
                data: {
                    providerMessageId: 'msg-004',
                    providerId: testProvider.id,
                    customerId: testCustomer.id,
                    conversationId: testConversation.id,
                    channel: 'email',
                    direction: 'inbound',
                    fromIdentifier: 'customer@example.com',
                    toIdentifier: 'support@company.com',
                    threadKey: 'email-thread-002',
                    timestamp: new Date('2024-01-16T09:00:00Z'),
                    body: 'Please find the attached document.',
                    status: 'processed',
                    providerMeta: { messageId: 'email-002', subject: 'Document Attached' }
                }
            });
            const attachment = await prisma.attachment.create({
                data: {
                    messageId: messageWithAttachment.id,
                    type: 'image/png',
                    filename: 'screenshot.png',
                    size: 1024000,
                    storageUrl: 'https://storage.example.com/files/screenshot.png',
                    metadata: { width: 1920, height: 1080 }
                }
            });
            const response = await request(app)
                .get(`/api/v1/customers/${testCustomer.id}/timeline`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect('Content-Type', /json/)
                .expect(200);
            const messageWithAttachments = response.body.messages.find((m) => m.id === messageWithAttachment.id);
            expect(messageWithAttachments.attachments).toHaveLength(1);
            expect(messageWithAttachments.attachments[0]).toEqual({
                id: attachment.id,
                messageId: expect.any(String),
                type: 'image/png',
                filename: 'screenshot.png',
                size: 1024000,
                storageUrl: 'https://storage.example.com/files/screenshot.png',
                thumbnailUrl: null,
                createdAt: expect.any(String),
                metadata: { width: 1920, height: 1080 }
            });
            // Clean up - use deleteMany for idempotent cleanup
            await prisma.attachment.deleteMany({ where: { id: attachment.id } });
            await prisma.message.deleteMany({ where: { id: messageWithAttachment.id } });
        });
    });
});
//# sourceMappingURL=timeline.test.js.map