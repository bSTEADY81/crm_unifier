import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { MessageDeduplicator, IdempotencyManager } from '../../../src/lib/ingestion/deduplication.js';
import { createRawMessage } from '../../../src/lib/ingestion/index.js';
import { NormalizedMessage, RawProviderMessage } from '../../../src/lib/ingestion/types.js';

const prisma = new PrismaClient();

describe('MessageDeduplicator', () => {
  let testProviderId: string;
  let testCustomerId: string;

  beforeAll(async () => {
    // Create test provider
    const provider = await prisma.provider.create({
      data: {
        name: 'Test Provider for Deduplication',
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
  });

  afterAll(async () => {
    // Clean up all test messages
    await prisma.message.deleteMany({ where: { providerId: testProviderId } });
    await prisma.customer.delete({ where: { id: testCustomerId } });
    await prisma.provider.delete({ where: { id: testProviderId } });
    await prisma.$disconnect();
  });

  describe('checkProviderIdDuplicate', () => {
    it('should detect duplicate provider message IDs', async () => {
      // Create a message in the database
      await prisma.message.create({
        data: {
          providerMessageId: 'SM-duplicate-test-001',
          providerId: testProviderId,
          customerId: testCustomerId,
          channel: 'sms',
          direction: 'inbound',
          fromIdentifier: '+1234567890',
          toIdentifier: '+0987654321',
          timestamp: new Date(),
          body: 'Original message',
          status: 'processed',
          providerMeta: {}
        }
      });

      const result = await MessageDeduplicator.checkProviderIdDuplicate(
        testProviderId,
        'SM-duplicate-test-001'
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateType).toBe('provider_id');
      expect(result.confidence).toBe(1.0);
      expect(result.existingMessageId).toBeDefined();
    });

    it('should not detect duplicate for unique provider message ID', async () => {
      const result = await MessageDeduplicator.checkProviderIdDuplicate(
        testProviderId,
        'SM-unique-message-001'
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.duplicateType).toBe('none');
      expect(result.confidence).toBe(0.0);
    });
  });

  describe('checkForDuplicate', () => {
    it('should perform comprehensive duplicate check', async () => {
      const normalizedMessage: NormalizedMessage = {
        providerMessageId: 'SM-duplicate-test-001', // This already exists
        providerId: testProviderId,
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
        body: 'Duplicate message test',
        contentType: 'text',
        threadKey: 'sms:+0987654321:+1234567890',
        providerMeta: {},
        messageHash: 'test-hash-123'
      };

      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-duplicate-test-001',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {}
      });

      const result = await MessageDeduplicator.checkForDuplicate(
        normalizedMessage,
        rawMessage
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateType).toBe('provider_id');
    });

    it('should detect content hash duplicates', async () => {
      // Create a message with specific content
      const testMessage = await prisma.message.create({
        data: {
          providerMessageId: 'SM-content-original',
          providerId: testProviderId,
          customerId: testCustomerId,
          channel: 'sms',
          direction: 'inbound',
          fromIdentifier: '+1555123456',
          toIdentifier: '+1555654321',
          timestamp: new Date(),
          body: 'This is a unique message content for testing',
          status: 'processed',
          providerMeta: { messageHash: 'content-hash-456' }
        }
      });

      const normalizedMessage: NormalizedMessage = {
        providerMessageId: 'SM-content-duplicate',
        providerId: testProviderId,
        channel: 'sms',
        direction: 'inbound',
        from: {
          identifier: '+1555123456',
          normalizedValue: '+1555123456',
          rawValue: '+1555123456',
          type: 'phone',
          provider: 'twilio'
        },
        to: {
          identifier: '+1555654321',
          normalizedValue: '+1555654321',
          rawValue: '+1555654321',
          type: 'phone',
          provider: 'twilio'
        },
        timestamp: new Date(),
        body: 'This is a unique message content for testing', // Same content
        contentType: 'text',
        threadKey: 'sms:+1555123456:+1555654321',
        providerMeta: {},
        messageHash: 'content-hash-456' // Same hash
      };

      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-content-duplicate',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {}
      });

      const result = await MessageDeduplicator.checkForDuplicate(
        normalizedMessage,
        rawMessage,
        { checkContentDuplicates: true, timeWindowMinutes: 60 }
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateType).toBe('content_hash');

      // Clean up
      await prisma.message.delete({ where: { id: testMessage.id } });
    });

    it('should detect similar content duplicates', async () => {
      // Create a message with similar content
      await prisma.message.create({
        data: {
          providerMessageId: 'SM-similar-original',
          providerId: testProviderId,
          customerId: testCustomerId,
          channel: 'sms',
          direction: 'inbound',
          fromIdentifier: '+1666123456',
          toIdentifier: '+1666654321',
          timestamp: new Date(),
          body: 'Hello, how are you doing today?',
          status: 'processed',
          providerMeta: {}
        }
      });

      const normalizedMessage: NormalizedMessage = {
        providerMessageId: 'SM-similar-duplicate',
        providerId: testProviderId,
        channel: 'sms',
        direction: 'inbound',
        from: {
          identifier: '+1666123456',
          normalizedValue: '+1666123456',
          rawValue: '+1666123456',
          type: 'phone',
          provider: 'twilio'
        },
        to: {
          identifier: '+1666654321',
          normalizedValue: '+1666654321',
          rawValue: '+1666654321',
          type: 'phone',
          provider: 'twilio'
        },
        timestamp: new Date(),
        body: 'Hello, how are you doing today!!', // Very similar content
        contentType: 'text',
        threadKey: 'sms:+1666123456:+1666654321',
        providerMeta: {},
        messageHash: 'different-hash-789'
      };

      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-similar-duplicate',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {}
      });

      const result = await MessageDeduplicator.checkForDuplicate(
        normalizedMessage,
        rawMessage,
        { 
          checkContentDuplicates: true, 
          contentSimilarityThreshold: 0.85,
          timeWindowMinutes: 60 
        }
      );

      expect(result.isDuplicate).toBe(true);
      expect(result.duplicateType).toBe('similar_content');
      expect(result.confidence).toBeGreaterThan(0.85);
    });

    it('should not detect duplicates outside time window', async () => {
      // Create a message from 2 hours ago
      const oldTimestamp = new Date(Date.now() - (2 * 60 * 60 * 1000));
      await prisma.message.create({
        data: {
          providerMessageId: 'SM-old-message',
          providerId: testProviderId,
          customerId: testCustomerId,
          channel: 'sms',
          direction: 'inbound',
          fromIdentifier: '+1777123456',
          toIdentifier: '+1777654321',
          timestamp: oldTimestamp,
          body: 'This is an old message',
          status: 'processed',
          providerMeta: {}
        }
      });

      const normalizedMessage: NormalizedMessage = {
        providerMessageId: 'SM-new-message',
        providerId: testProviderId,
        channel: 'sms',
        direction: 'inbound',
        from: {
          identifier: '+1777123456',
          normalizedValue: '+1777123456',
          rawValue: '+1777123456',
          type: 'phone',
          provider: 'twilio'
        },
        to: {
          identifier: '+1777654321',
          normalizedValue: '+1777654321',
          rawValue: '+1777654321',
          type: 'phone',
          provider: 'twilio'
        },
        timestamp: new Date(),
        body: 'This is an old message', // Same content but outside time window
        contentType: 'text',
        threadKey: 'sms:+1777123456:+1777654321',
        providerMeta: {},
        messageHash: 'old-message-hash'
      };

      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-new-message',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {}
      });

      const result = await MessageDeduplicator.checkForDuplicate(
        normalizedMessage,
        rawMessage,
        { 
          checkContentDuplicates: true, 
          timeWindowMinutes: 60 // 1 hour window, message is 2 hours old
        }
      );

      expect(result.isDuplicate).toBe(false);
      expect(result.duplicateType).toBe('none');
    });
  });

  describe('generateContentFingerprint', () => {
    it('should generate consistent fingerprints for same content', async () => {
      const message: NormalizedMessage = {
        providerMessageId: 'SM-fingerprint-test',
        providerId: testProviderId,
        channel: 'sms',
        direction: 'inbound',
        from: {
          identifier: '+1234567890',
          normalizedValue: '+1234567890',
          rawValue: '+1234567890',
          type: 'phone',
          provider: 'twilio'
        },
        to: {
          identifier: '+0987654321',
          normalizedValue: '+0987654321',
          rawValue: '+0987654321',
          type: 'phone',
          provider: 'twilio'
        },
        timestamp: new Date(),
        body: 'Fingerprint test message',
        contentType: 'text',
        threadKey: 'test-thread',
        providerMeta: {},
        messageHash: 'test-hash'
      };

      const fingerprint1 = MessageDeduplicator.generateContentFingerprint(message);
      const fingerprint2 = MessageDeduplicator.generateContentFingerprint(message);

      expect(fingerprint1).toBe(fingerprint2);
      expect(fingerprint1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it('should generate different fingerprints for different content', async () => {
      const message1: NormalizedMessage = {
        providerMessageId: 'SM-fingerprint-1',
        providerId: testProviderId,
        channel: 'sms',
        direction: 'inbound',
        from: {
          identifier: '+1234567890',
          normalizedValue: '+1234567890',
          rawValue: '+1234567890',
          type: 'phone',
          provider: 'twilio'
        },
        to: {
          identifier: '+0987654321',
          normalizedValue: '+0987654321',
          rawValue: '+0987654321',
          type: 'phone',
          provider: 'twilio'
        },
        timestamp: new Date(),
        body: 'First message',
        contentType: 'text',
        threadKey: 'test-thread',
        providerMeta: {},
        messageHash: 'test-hash-1'
      };

      const message2: NormalizedMessage = {
        ...message1,
        body: 'Second message',
        messageHash: 'test-hash-2'
      };

      const fingerprint1 = MessageDeduplicator.generateContentFingerprint(message1);
      const fingerprint2 = MessageDeduplicator.generateContentFingerprint(message2);

      expect(fingerprint1).not.toBe(fingerprint2);
    });
  });

  describe('ensureIdempotency', () => {
    it('should detect existing messages for idempotency', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-duplicate-test-001', // This already exists
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {}
      });

      const normalizedMessage: NormalizedMessage = {
        providerMessageId: 'SM-duplicate-test-001',
        providerId: testProviderId,
        channel: 'sms',
        direction: 'inbound',
        from: {
          identifier: '+1234567890',
          normalizedValue: '+1234567890',
          rawValue: '+1234567890',
          type: 'phone',
          provider: 'twilio'
        },
        to: {
          identifier: '+0987654321',
          normalizedValue: '+0987654321',
          rawValue: '+0987654321',
          type: 'phone',
          provider: 'twilio'
        },
        timestamp: new Date(),
        contentType: 'text',
        threadKey: 'test-thread',
        providerMeta: {},
        messageHash: 'test-hash'
      };

      const result = await MessageDeduplicator.ensureIdempotency(rawMessage, normalizedMessage);

      expect(result.isIdempotent).toBe(true);
      expect(result.existingMessageId).toBeDefined();
    });

    it('should allow new messages for idempotency', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-new-unique-message',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {}
      });

      const normalizedMessage: NormalizedMessage = {
        providerMessageId: 'SM-new-unique-message',
        providerId: testProviderId,
        channel: 'sms',
        direction: 'inbound',
        from: {
          identifier: '+1234567890',
          normalizedValue: '+1234567890',
          rawValue: '+1234567890',
          type: 'phone',
          provider: 'twilio'
        },
        to: {
          identifier: '+0987654321',
          normalizedValue: '+0987654321',
          rawValue: '+0987654321',
          type: 'phone',
          provider: 'twilio'
        },
        timestamp: new Date(),
        contentType: 'text',
        threadKey: 'test-thread',
        providerMeta: {},
        messageHash: 'test-hash'
      };

      const result = await MessageDeduplicator.ensureIdempotency(rawMessage, normalizedMessage);

      expect(result.isIdempotent).toBe(false);
      expect(result.existingMessageId).toBeUndefined();
    });
  });
});

describe('IdempotencyManager', () => {
  describe('generateIdempotencyKey', () => {
    it('should generate consistent keys for same input', () => {
      const providerId = 'test-provider-001';
      const providerMessageId = 'test-message-001';
      const timestamp = new Date('2023-10-01T10:00:00Z');

      const key1 = IdempotencyManager.generateIdempotencyKey(
        providerId, 
        providerMessageId, 
        timestamp
      );
      const key2 = IdempotencyManager.generateIdempotencyKey(
        providerId, 
        providerMessageId, 
        timestamp
      );

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it('should generate different keys for different inputs', () => {
      const providerId = 'test-provider-001';
      const timestamp = new Date('2023-10-01T10:00:00Z');

      const key1 = IdempotencyManager.generateIdempotencyKey(
        providerId, 
        'message-001', 
        timestamp
      );
      const key2 = IdempotencyManager.generateIdempotencyKey(
        providerId, 
        'message-002', 
        timestamp
      );

      expect(key1).not.toBe(key2);
    });
  });

  describe('checkIdempotency and markAsProcessed', () => {
    it('should track processed messages in memory cache', async () => {
      const idempotencyKey = 'test-key-123';
      const messageId = 'msg-123';

      // Initially should not be found
      const result1 = await IdempotencyManager.checkIdempotency(idempotencyKey);
      expect(result1).toBeNull();

      // Mark as processed
      IdempotencyManager.markAsProcessed(idempotencyKey, messageId);

      // Should now be found
      const result2 = await IdempotencyManager.checkIdempotency(idempotencyKey);
      expect(result2).toBe(messageId);
    });

    it('should clear expired entries', () => {
      const idempotencyKey = 'test-key-456';
      const messageId = 'msg-456';

      IdempotencyManager.markAsProcessed(idempotencyKey, messageId);
      IdempotencyManager.clearExpiredEntries();

      // After clearing, should not be found
      const result = IdempotencyManager.checkIdempotency(idempotencyKey);
      expect(result).resolves.toBeNull();
    });
  });
});