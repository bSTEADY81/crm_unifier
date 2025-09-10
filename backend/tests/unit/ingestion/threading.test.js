import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ConversationGrouper } from '../../../src/lib/ingestion/threading.js';
const prisma = new PrismaClient();
describe('ConversationGrouper', () => {
    let testCustomer1;
    let testCustomer2;
    let testConversation;
    beforeAll(async () => {
        // Create test customers
        testCustomer1 = await prisma.customer.create({
            data: {
                name: 'Threading Test Customer 1',
                metadata: { source: 'test' }
            }
        });
        testCustomer2 = await prisma.customer.create({
            data: {
                name: 'Threading Test Customer 2',
                metadata: { source: 'test' }
            }
        });
        // Create existing conversation
        testConversation = await prisma.conversation.create({
            data: {
                threadKey: 'sms:+1234567890:+0987654321',
                customerId: testCustomer1.id,
                channel: 'sms',
                lastMessageAt: new Date(Date.now() - (30 * 60 * 1000)), // 30 minutes ago
                tags: ['existing', 'test']
            }
        });
    });
    afterAll(async () => {
        // Clean up
        await prisma.message.deleteMany({
            where: {
                customerId: {
                    in: [testCustomer1.id, testCustomer2.id]
                }
            }
        });
        await prisma.conversation.deleteMany({
            where: {
                customerId: {
                    in: [testCustomer1.id, testCustomer2.id]
                }
            }
        });
        await prisma.customer.deleteMany({
            where: {
                id: {
                    in: [testCustomer1.id, testCustomer2.id]
                }
            }
        });
        await prisma.$disconnect();
    });
    describe('groupIntoConversation', () => {
        it('should find existing conversation by thread key', async () => {
            const normalizedMessage = {
                providerMessageId: 'SM-thread-test-001',
                providerId: 'test-provider-id',
                channel: 'sms',
                direction: 'inbound',
                from: {
                    identifier: '+1234567890',
                    normalizedValue: '+1234567890',
                    rawValue: '(234) 567-8901',
                    type: 'phone',
                    provider: 'twilio'
                },
                to: {
                    identifier: '+0987654321',
                    normalizedValue: '+0987654321',
                    rawValue: '(098) 765-4321',
                    type: 'phone',
                    provider: 'twilio'
                },
                timestamp: new Date(),
                body: 'Test message for existing thread',
                contentType: 'text',
                threadKey: 'sms:+1234567890:+0987654321', // Matches existing conversation
                providerMeta: {},
                messageHash: 'test-hash-001'
            };
            const result = await ConversationGrouper.groupIntoConversation(normalizedMessage, testCustomer1.id);
            expect(result.conversationId).toBe(testConversation.id);
            expect(result.isNewConversation).toBe(false);
            expect(result.threadKey).toBe('sms:+1234567890:+0987654321');
            expect(result.relatedMessages).toBeDefined();
        });
        it('should create new conversation for new thread key', async () => {
            const normalizedMessage = {
                providerMessageId: 'SM-new-thread-001',
                providerId: 'test-provider-id',
                channel: 'sms',
                direction: 'inbound',
                from: {
                    identifier: '+1555999888',
                    normalizedValue: '+1555999888',
                    rawValue: '(555) 999-888',
                    type: 'phone',
                    provider: 'twilio'
                },
                to: {
                    identifier: '+1555888999',
                    normalizedValue: '+1555888999',
                    rawValue: '(555) 888-999',
                    type: 'phone',
                    provider: 'twilio'
                },
                timestamp: new Date(),
                body: 'Test message for new thread',
                contentType: 'text',
                threadKey: 'sms:+1555888999:+1555999888', // New thread key
                providerMeta: {},
                messageHash: 'test-hash-002'
            };
            const result = await ConversationGrouper.groupIntoConversation(normalizedMessage, testCustomer2.id);
            expect(result.conversationId).toBeDefined();
            expect(result.conversationId).not.toBe(testConversation.id);
            expect(result.isNewConversation).toBe(true);
            expect(result.threadKey).toBe('sms:+1555888999:+1555999888');
            expect(result.relatedMessages).toHaveLength(0);
            // Verify new conversation was created
            const newConversation = await prisma.conversation.findUnique({
                where: { id: result.conversationId }
            });
            expect(newConversation).toBeDefined();
            expect(newConversation?.customerId).toBe(testCustomer2.id);
            expect(newConversation?.channel).toBe('sms');
            expect(newConversation?.threadKey).toBe('sms:+1555888999:+1555999888');
        });
        it('should find similar conversation when exact thread match not found', async () => {
            // Create a recent conversation for similarity matching
            const recentConversation = await prisma.conversation.create({
                data: {
                    threadKey: 'sms:+1666777888:+1666888777',
                    customerId: testCustomer1.id,
                    channel: 'sms',
                    lastMessageAt: new Date(Date.now() - (10 * 60 * 1000)), // 10 minutes ago
                    tags: ['recent', 'active']
                }
            });
            const normalizedMessage = {
                providerMessageId: 'SM-similar-thread-001',
                providerId: 'test-provider-id',
                channel: 'sms',
                direction: 'inbound',
                from: {
                    identifier: '+1666777888',
                    normalizedValue: '+1666777888',
                    rawValue: '(666) 777-888',
                    type: 'phone',
                    provider: 'twilio'
                },
                to: {
                    identifier: '+1666888777',
                    normalizedValue: '+1666888777',
                    rawValue: '(666) 888-777',
                    type: 'phone',
                    provider: 'twilio'
                },
                timestamp: new Date(),
                body: 'Test message for similar thread',
                contentType: 'text',
                threadKey: 'sms:+1666777888:+1666888777-variation', // Slightly different but similar
                providerMeta: {},
                messageHash: 'test-hash-003'
            };
            const result = await ConversationGrouper.groupIntoConversation(normalizedMessage, testCustomer1.id, { preferExistingThreads: true });
            expect(result.conversationId).toBe(recentConversation.id);
            expect(result.isNewConversation).toBe(false);
            // Clean up
            await prisma.conversation.delete({ where: { id: recentConversation.id } });
        });
        it('should skip conversation creation when disabled', async () => {
            const normalizedMessage = {
                providerMessageId: 'SM-no-conversation-001',
                providerId: 'test-provider-id',
                channel: 'sms',
                direction: 'inbound',
                from: {
                    identifier: '+1777888999',
                    normalizedValue: '+1777888999',
                    rawValue: '(777) 888-999',
                    type: 'phone',
                    provider: 'twilio'
                },
                to: {
                    identifier: '+1777999888',
                    normalizedValue: '+1777999888',
                    rawValue: '(777) 999-888',
                    type: 'phone',
                    provider: 'twilio'
                },
                timestamp: new Date(),
                body: 'Test message without conversation',
                contentType: 'text',
                threadKey: 'sms:+1777888999:+1777999888',
                providerMeta: {},
                messageHash: 'test-hash-004'
            };
            const result = await ConversationGrouper.groupIntoConversation(normalizedMessage, testCustomer2.id, { createNewConversation: false });
            expect(result.conversationId).toBeUndefined();
            expect(result.isNewConversation).toBe(false);
            expect(result.threadKey).toBe('sms:+1777888999:+1777999888');
            expect(result.relatedMessages).toHaveLength(0);
        });
        it('should generate appropriate initial tags for new conversation', async () => {
            const normalizedMessage = {
                providerMessageId: 'SM-tags-test-001',
                providerId: 'test-provider-id',
                channel: 'whatsapp',
                direction: 'inbound',
                from: {
                    identifier: '+1888999000',
                    normalizedValue: '+1888999000',
                    rawValue: '(888) 999-000',
                    type: 'phone',
                    provider: 'whatsapp'
                },
                to: {
                    identifier: '+1888000999',
                    normalizedValue: '+1888000999',
                    rawValue: '(888) 000-999',
                    type: 'phone',
                    provider: 'whatsapp'
                },
                timestamp: new Date(),
                body: 'Test message for tag generation',
                contentType: 'image',
                threadKey: 'whatsapp:+1888000999:+1888999000',
                providerMeta: {},
                messageHash: 'test-hash-005'
            };
            const result = await ConversationGrouper.groupIntoConversation(normalizedMessage, testCustomer2.id);
            // Verify conversation was created with proper tags
            const newConversation = await prisma.conversation.findUnique({
                where: { id: result.conversationId }
            });
            expect(newConversation?.tags).toContain('channel:whatsapp');
            expect(newConversation?.tags).toContain('direction:inbound');
            expect(newConversation?.tags).toContain('content:image');
        });
    });
    describe('generateThreadKey', () => {
        it('should generate consistent thread keys for SMS', () => {
            const key1 = ConversationGrouper.generateThreadKey('sms', '+1234567890', '+0987654321');
            const key2 = ConversationGrouper.generateThreadKey('sms', '+0987654321', // Reversed order
            '+1234567890');
            expect(key1).toBe(key2);
            expect(key1).toBe('sms:+0987654321:+1234567890'); // Sorted order
        });
        it('should generate thread keys for WhatsApp', () => {
            const key = ConversationGrouper.generateThreadKey('whatsapp', '+1234567890', '+0987654321');
            expect(key).toBe('whatsapp:+0987654321:+1234567890');
        });
        it('should use additional context for email thread keys', () => {
            const keyWithContext = ConversationGrouper.generateThreadKey('email', 'user@example.com', 'support@company.com', 'gmail-thread-123');
            expect(keyWithContext).toBe('email:gmail-thread-123');
            const keyWithoutContext = ConversationGrouper.generateThreadKey('email', 'user@example.com', 'support@company.com');
            expect(keyWithoutContext).toBe('email:support@company.com:user@example.com');
        });
        it('should use additional context for social channels', () => {
            const keyWithContext = ConversationGrouper.generateThreadKey('facebook', 'user123', 'page456', 'facebook-conversation-789');
            expect(keyWithContext).toBe('facebook:facebook-conversation-789');
        });
        it('should handle voice calls', () => {
            const key = ConversationGrouper.generateThreadKey('voice', '+1234567890', '+0987654321');
            expect(key).toBe('voice:+0987654321:+1234567890');
        });
    });
    describe('updateConversationActivity', () => {
        it('should update conversation last message timestamp', async () => {
            const newTimestamp = new Date();
            await ConversationGrouper.updateConversationActivity(testConversation.id, newTimestamp);
            const updatedConversation = await prisma.conversation.findUnique({
                where: { id: testConversation.id }
            });
            expect(updatedConversation?.lastMessageAt?.getTime())
                .toBe(newTimestamp.getTime());
        });
        it('should add new tags to conversation', async () => {
            const originalTags = ['existing', 'test'];
            const newTags = ['urgent', 'priority'];
            await ConversationGrouper.updateConversationActivity(testConversation.id, new Date(), newTags);
            const updatedConversation = await prisma.conversation.findUnique({
                where: { id: testConversation.id }
            });
            expect(updatedConversation?.tags).toEqual(expect.arrayContaining([...originalTags, ...newTags]));
        });
        it('should not add duplicate tags', async () => {
            const duplicateTags = ['existing', 'new-tag'];
            await ConversationGrouper.updateConversationActivity(testConversation.id, new Date(), duplicateTags);
            const updatedConversation = await prisma.conversation.findUnique({
                where: { id: testConversation.id }
            });
            // Should only have one instance of 'existing'
            const existingCount = updatedConversation?.tags?.filter(tag => tag === 'existing').length;
            expect(existingCount).toBe(1);
        });
    });
    describe('archiveInactiveConversations', () => {
        it('should archive conversations older than specified hours', async () => {
            // Create an old conversation
            const oldConversation = await prisma.conversation.create({
                data: {
                    threadKey: 'sms:+1999888777:+1999777888',
                    customerId: testCustomer1.id,
                    channel: 'sms',
                    lastMessageAt: new Date(Date.now() - (8 * 24 * 60 * 60 * 1000)), // 8 days ago
                    status: 'active',
                    tags: ['old']
                }
            });
            const archivedCount = await ConversationGrouper.archiveInactiveConversations(7 * 24); // 7 days
            expect(archivedCount).toBeGreaterThan(0);
            // Verify conversation was archived
            const archivedConversation = await prisma.conversation.findUnique({
                where: { id: oldConversation.id }
            });
            expect(archivedConversation?.status).toBe('archived');
        });
        it('should not archive recent conversations', async () => {
            // Create a recent conversation
            const recentConversation = await prisma.conversation.create({
                data: {
                    threadKey: 'sms:+1111222333:+1111333222',
                    customerId: testCustomer2.id,
                    channel: 'sms',
                    lastMessageAt: new Date(Date.now() - (2 * 60 * 60 * 1000)), // 2 hours ago
                    status: 'active',
                    tags: ['recent']
                }
            });
            await ConversationGrouper.archiveInactiveConversations(7 * 24); // 7 days
            // Verify conversation was NOT archived
            const activeConversation = await prisma.conversation.findUnique({
                where: { id: recentConversation.id }
            });
            expect(activeConversation?.status).toBe('active');
            // Clean up
            await prisma.conversation.delete({ where: { id: recentConversation.id } });
        });
    });
    describe('generateContextualThreadKey', () => {
        it('should add subject context for emails', () => {
            const baseKey = 'email:user@example.com:support@company.com';
            const contextualKey = ConversationGrouper.generateContextualThreadKey(baseKey, { subject: 'Re: Support Request #123' });
            expect(contextualKey).toContain(':subj:');
            expect(contextualKey).toMatch(/^email:user@example\.com:support@company\.com:subj:[a-f0-9]{8}$/);
        });
        it('should add reply context', () => {
            const baseKey = 'email:user@example.com:support@company.com';
            const contextualKey = ConversationGrouper.generateContextualThreadKey(baseKey, { replyToMessageId: 'msg-123-456' });
            expect(contextualKey).toBe('email:user@example.com:support@company.com:reply:msg-123-456');
        });
        it('should add conversation context', () => {
            const baseKey = 'whatsapp:+1234567890:+0987654321';
            const contextualKey = ConversationGrouper.generateContextualThreadKey(baseKey, { conversationId: 'conv-789-012' });
            expect(contextualKey).toBe('whatsapp:+1234567890:+0987654321:conv:conv-789-012');
        });
        it('should combine multiple context types', () => {
            const baseKey = 'email:user@example.com:support@company.com';
            const contextualKey = ConversationGrouper.generateContextualThreadKey(baseKey, {
                subject: 'Support Request',
                replyToMessageId: 'msg-456',
                conversationId: 'conv-789'
            });
            expect(contextualKey).toContain(':subj:');
            expect(contextualKey).toContain(':reply:msg-456');
            expect(contextualKey).toContain(':conv:conv-789');
        });
        it('should normalize email subjects consistently', () => {
            const baseKey = 'email:user@example.com:support@company.com';
            const key1 = ConversationGrouper.generateContextualThreadKey(baseKey, { subject: 'Support Request' });
            const key2 = ConversationGrouper.generateContextualThreadKey(baseKey, { subject: 'Re: Support Request' });
            const key3 = ConversationGrouper.generateContextualThreadKey(baseKey, { subject: 'FWD: Support Request' });
            // All should generate the same subject hash (Re: and FWD: prefixes removed)
            expect(key1.split(':subj:')[1]).toBe(key2.split(':subj:')[1]);
            expect(key1.split(':subj:')[1]).toBe(key3.split(':subj:')[1]);
        });
    });
});
//# sourceMappingURL=threading.test.js.map