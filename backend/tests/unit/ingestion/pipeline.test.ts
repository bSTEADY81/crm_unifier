import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MessageIngestionPipeline } from '../../../src/lib/ingestion/pipeline.js';
import { createRawMessage } from '../../../src/lib/ingestion/index.js';
import { RawProviderMessage } from '../../../src/lib/ingestion/types.js';

const prisma = new PrismaClient();

describe('MessageIngestionPipeline', () => {
  let testProviderId: string;
  let testCustomerId: string;

  beforeAll(async () => {
    // Create test provider
    const provider = await prisma.provider.create({
      data: {
        name: 'Test Provider for Ingestion',
        type: 'twilio_sms',
        status: 'active',
        config: { encrypted: true }
      }
    });
    testProviderId = provider.id;

    // Create test customer
    const customer = await prisma.customer.create({
      data: {
        name: 'Test Customer',
        metadata: { source: 'test' }
      }
    });
    testCustomerId = customer.id;

    // Create test identity for customer (use unique phone number for tests)
    await prisma.identity.create({
      data: {
        customerId: testCustomerId,
        type: 'phone',
        value: '+1999111222',
        rawValue: '+1999111222',
        provider: 'twilio',
        verified: true
      }
    });
  });

  afterAll(async () => {
    // Clean up
    await prisma.identity.deleteMany({ where: { customerId: testCustomerId } });
    await prisma.customer.delete({ where: { id: testCustomerId } });
    await prisma.provider.delete({ where: { id: testProviderId } });
    await prisma.$disconnect();
  });

  beforeEach(() => {
    // Reset any mocks
    vi.clearAllMocks();
  });

  describe('processMessage', () => {
    it('should process a valid Twilio SMS message successfully', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-test-message-001',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-test-message-001',
          AccountSid: 'AC-test-account',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'Hello, this is a test message!',
          DateSent: new Date().toISOString(),
          Status: 'received',
          NumMedia: '0'
        }
      });

      const result = await MessageIngestionPipeline.processMessage(rawMessage);

      expect(result.status).toBe('success');
      expect(result.messageId).toBeDefined();
      expect(result.normalizedMessage).toBeDefined();
      expect(result.identityResolution).toBeDefined();
      expect(result.processingMetrics.stagesCompleted).toContain('normalization');
      expect(result.processingMetrics.stagesCompleted).toContain('identity_resolution');
      expect(result.processingMetrics.stagesCompleted).toContain('persistence');

      // Verify the message was persisted correctly
      const persistedMessage = await prisma.message.findUnique({
        where: { id: result.messageId! }
      });

      expect(persistedMessage).toBeDefined();
      expect(persistedMessage?.body).toBe('Hello, this is a test message!');
      expect(persistedMessage?.channel).toBe('sms');
      expect(persistedMessage?.direction).toBe('inbound');
    });

    it('should detect and prevent duplicate messages', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-duplicate-test-001',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-duplicate-test-001',
          AccountSid: 'AC-test-account',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'This message will be processed twice',
          DateSent: new Date().toISOString(),
          Status: 'received',
          NumMedia: '0'
        }
      });

      // Process the message first time
      const firstResult = await MessageIngestionPipeline.processMessage(rawMessage);
      expect(firstResult.status).toBe('success');

      // Process the same message again
      const secondResult = await MessageIngestionPipeline.processMessage(rawMessage);
      expect(secondResult.status).toBe('duplicate');
      expect(secondResult.error?.code).toBe('DUPLICATE_MESSAGE');
    });

    it('should handle invalid payload gracefully', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-invalid-payload',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          // Missing required fields
          MessageSid: 'SM-invalid-payload'
          // Missing From, To, AccountSid, etc.
        }
      });

      const result = await MessageIngestionPipeline.processMessage(rawMessage);

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('INVALID_PAYLOAD');
      expect(result.processingMetrics.stagesFailed).toBeDefined();
    });

    it('should handle unsupported provider type', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'unsupported-provider-001',
        providerType: 'unsupported_provider',
        channel: 'sms',
        payload: { test: 'data' }
      });

      const result = await MessageIngestionPipeline.processMessage(rawMessage);

      expect(result.status).toBe('failed');
      expect(result.error?.code).toBe('PROVIDER_NOT_SUPPORTED');
    });

    it('should skip stages when configured', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-skip-stages-test',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-skip-stages-test',
          AccountSid: 'AC-test-account',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'Test message with skipped stages',
          DateSent: new Date().toISOString(),
          Status: 'received',
          NumMedia: '0'
        }
      });

      const result = await MessageIngestionPipeline.processMessage(rawMessage, {
        skipDuplicateCheck: true,
        skipIdentityResolution: true,
        skipThreading: true
      });

      expect(result.status).toBe('success');
      expect(result.processingMetrics.stagesCompleted).toContain('normalization');
      expect(result.processingMetrics.stagesCompleted).toContain('persistence');
      expect(result.processingMetrics.stagesCompleted).not.toContain('duplicate_check');
      expect(result.processingMetrics.stagesCompleted).not.toContain('identity_resolution');
      expect(result.processingMetrics.stagesCompleted).not.toContain('threading');
    });

    it('should create new customer when identity resolution is enabled', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-new-customer-test',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-new-customer-test',
          AccountSid: 'AC-test-account',
          From: '+1555999888', // New phone number not in system
          To: '+0987654321',
          Body: 'Message from new customer',
          DateSent: new Date().toISOString(),
          Status: 'received',
          NumMedia: '0'
        }
      });

      const result = await MessageIngestionPipeline.processMessage(rawMessage, {
        createNewCustomers: true
      });

      expect(result.status).toBe('success');
      expect(result.identityResolution?.isNewCustomer).toBe(true);
      expect(result.identityResolution?.customerId).toBeDefined();

      // Verify new customer was created
      const newCustomer = await prisma.customer.findUnique({
        where: { id: result.identityResolution!.customerId! }
      });
      expect(newCustomer).toBeDefined();
      expect(newCustomer?.metadata).toEqual(expect.objectContaining({
        source: 'message_ingestion'
      }));

      // Clean up
      await prisma.identity.deleteMany({ 
        where: { customerId: result.identityResolution!.customerId! } 
      });
      await prisma.customer.delete({ 
        where: { id: result.identityResolution!.customerId! } 
      });
    });

    it('should group messages into conversations', async () => {
      const phoneNumber = '+1666777888';
      
      // Create customer and identity
      const testCustomer = await prisma.customer.create({
        data: {
          name: 'Threading Test Customer',
          metadata: { source: 'test' }
        }
      });

      await prisma.identity.create({
        data: {
          customerId: testCustomer.id,
          type: 'phone',
          value: phoneNumber,
          rawValue: phoneNumber,
          provider: 'twilio',
          verified: true
        }
      });

      // First message should create new conversation
      const firstMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-thread-test-001',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-thread-test-001',
          AccountSid: 'AC-test-account',
          From: phoneNumber,
          To: '+0987654321',
          Body: 'First message in conversation',
          DateSent: new Date().toISOString(),
          Status: 'received',
          NumMedia: '0'
        }
      });

      const firstResult = await MessageIngestionPipeline.processMessage(firstMessage);
      expect(firstResult.status).toBe('success');
      expect(firstResult.threadingContext?.isNewConversation).toBe(true);

      // Second message should use same conversation
      const secondMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-thread-test-002',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-thread-test-002',
          AccountSid: 'AC-test-account',
          From: phoneNumber,
          To: '+0987654321',
          Body: 'Second message in same conversation',
          DateSent: new Date().toISOString(),
          Status: 'received',
          NumMedia: '0'
        }
      });

      const secondResult = await MessageIngestionPipeline.processMessage(secondMessage);
      expect(secondResult.status).toBe('success');
      expect(secondResult.threadingContext?.isNewConversation).toBe(false);
      expect(secondResult.threadingContext?.conversationId)
        .toBe(firstResult.threadingContext?.conversationId);

      // Clean up
      await prisma.message.deleteMany({ 
        where: { customerId: testCustomer.id } 
      });
      await prisma.conversation.deleteMany({ 
        where: { customerId: testCustomer.id } 
      });
      await prisma.identity.deleteMany({ 
        where: { customerId: testCustomer.id } 
      });
      await prisma.customer.delete({ 
        where: { id: testCustomer.id } 
      });
    });
  });

  describe('processMessageBatch', () => {
    it('should process multiple messages in batch', async () => {
      const rawMessages: RawProviderMessage[] = [
        createRawMessage({
          providerId: testProviderId,
          providerMessageId: 'SM-batch-001',
          providerType: 'twilio_sms',
          channel: 'sms',
          payload: {
            MessageSid: 'SM-batch-001',
            AccountSid: 'AC-test-account',
            From: '+1234567890',
            To: '+0987654321',
            Body: 'Batch message 1',
            DateSent: new Date().toISOString(),
            Status: 'received',
            NumMedia: '0'
          }
        }),
        createRawMessage({
          providerId: testProviderId,
          providerMessageId: 'SM-batch-002',
          providerType: 'twilio_sms',
          channel: 'sms',
          payload: {
            MessageSid: 'SM-batch-002',
            AccountSid: 'AC-test-account',
            From: '+1234567890',
            To: '+0987654321',
            Body: 'Batch message 2',
            DateSent: new Date().toISOString(),
            Status: 'received',
            NumMedia: '0'
          }
        })
      ];

      const results = await MessageIngestionPipeline.processMessageBatch(rawMessages);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('success');
      expect(results[0].messageId).toBeDefined();
      expect(results[1].messageId).toBeDefined();
    });

    it('should handle mixed success and failure in batch', async () => {
      const rawMessages: RawProviderMessage[] = [
        // Valid message
        createRawMessage({
          providerId: testProviderId,
          providerMessageId: 'SM-batch-valid',
          providerType: 'twilio_sms',
          channel: 'sms',
          payload: {
            MessageSid: 'SM-batch-valid',
            AccountSid: 'AC-test-account',
            From: '+1234567890',
            To: '+0987654321',
            Body: 'Valid batch message',
            DateSent: new Date().toISOString(),
            Status: 'received',
            NumMedia: '0'
          }
        }),
        // Invalid message
        createRawMessage({
          providerId: testProviderId,
          providerMessageId: 'SM-batch-invalid',
          providerType: 'twilio_sms',
          channel: 'sms',
          payload: {
            MessageSid: 'SM-batch-invalid'
            // Missing required fields
          }
        })
      ];

      const results = await MessageIngestionPipeline.processMessageBatch(rawMessages);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('failed');
      expect(results[1].error?.code).toBe('INVALID_PAYLOAD');
    });
  });

  describe('retryFailedMessage', () => {
    it('should retry failed message processing', async () => {
      // Mock a temporarily failing condition
      const originalNormalize = MessageIngestionPipeline.processMessage;
      let attemptCount = 0;
      
      // Mock processMessage to fail first time, succeed second time
      const mockedProcess = vi.spyOn(MessageIngestionPipeline, 'processMessage')
        .mockImplementation(async (rawMessage, options = {}) => {
          attemptCount++;
          if (attemptCount === 1 && !options.maxRetries) {
            throw new Error('Temporary failure');
          }
          return originalNormalize.call(MessageIngestionPipeline, rawMessage, options);
        });

      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-retry-test',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-retry-test',
          AccountSid: 'AC-test-account',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'Retry test message',
          DateSent: new Date().toISOString(),
          Status: 'received',
          NumMedia: '0'
        }
      });

      const result = await MessageIngestionPipeline.retryFailedMessage(rawMessage, {
        maxRetries: 2
      });

      expect(result.status).toBe('success');
      expect(attemptCount).toBe(2); // Should have retried once
      
      mockedProcess.mockRestore();
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', () => {
      const stats = MessageIngestionPipeline.getProcessingStats();

      expect(stats).toHaveProperty('totalProcessed');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('averageProcessingTime');
      expect(stats).toHaveProperty('commonErrors');
      expect(Array.isArray(stats.commonErrors)).toBe(true);
    });
  });
});