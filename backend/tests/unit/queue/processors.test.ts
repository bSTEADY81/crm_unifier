import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Job } from 'bullmq';
import {
  WebhookProcessor,
  MessageProcessor,
  NotificationProcessor,
  MaintenanceProcessor,
  HealthCheckProcessor
} from '../../../src/lib/queue/processors.js';
import { IngestionPipeline } from '../../../src/lib/ingestion/pipeline.js';
import {
  WebhookJobData,
  MessageIngestionJobData,
  NotificationJobData,
  ArchiveJobData,
  HealthCheckJobData
} from '../../../src/lib/queue/types.js';

// Mock the ingestion pipeline
vi.mock('../../../src/lib/ingestion/pipeline.js', () => ({
  IngestionPipeline: {
    processMessage: vi.fn()
  }
}));

// Mock logger
vi.mock('../../../src/lib/logger.js', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('Queue Processors', () => {
  // Mock job helper
  const createMockJob = <T>(data: T, jobId: string = 'test-job-123'): Job<T> => {
    const startTime = Date.now();
    return {
      id: jobId,
      data,
      attemptsMade: 0,
      opts: { attempts: 3 },
      updateProgress: vi.fn().mockResolvedValue(undefined),
      processedOn: startTime
    } as unknown as Job<T>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('WebhookProcessor', () => {
    describe('processWebhook', () => {
      it('should process webhook successfully', async () => {
        const webhookData: WebhookJobData = {
          webhookId: 'wh_123',
          providerId: 'twilio_test',
          providerType: 'twilio-sms',
          timestamp: new Date().toISOString(),
          payload: { From: '+1234567890', Body: 'Test message' },
          headers: { 'X-Twilio-Signature': 'test-signature' }
        };

        const mockJob = createMockJob(webhookData);

        // Mock successful ingestion
        vi.mocked(IngestionPipeline.processMessage).mockResolvedValue({
          success: true,
          messageId: 'msg_456',
          customerId: 'cust_789',
          conversationId: 'conv_101',
          metrics: {
            processingTime: 150,
            stagesCompleted: ['validation', 'normalization', 'identity_resolution']
          }
        });

        const result = await WebhookProcessor.processWebhook(mockJob);

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('msg_456');
        expect(result.processingTime).toBeGreaterThan(0);
        expect(result.metrics?.identityResolved).toBe(true);
        expect(result.metrics?.conversationCreated).toBe(true);

        // Verify progress updates
        expect(mockJob.updateProgress).toHaveBeenCalledWith(10);
        expect(mockJob.updateProgress).toHaveBeenCalledWith(30);
        expect(mockJob.updateProgress).toHaveBeenCalledWith(80);
        expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
      });

      it('should handle ingestion failure', async () => {
        const webhookData: WebhookJobData = {
          webhookId: 'wh_124',
          providerId: 'whatsapp_test',
          providerType: 'whatsapp',
          timestamp: new Date().toISOString(),
          payload: { messages: [{ text: { body: 'Test' } }] },
          headers: {}
        };

        const mockJob = createMockJob(webhookData);

        // Mock ingestion failure
        vi.mocked(IngestionPipeline.processMessage).mockResolvedValue({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid message format',
            stage: 'validation'
          },
          metrics: { processingTime: 50 }
        });

        await expect(WebhookProcessor.processWebhook(mockJob))
          .rejects.toThrow('Ingestion failed: Invalid message format');
      });

      it('should handle processing errors', async () => {
        const webhookData: WebhookJobData = {
          webhookId: 'wh_125',
          providerId: 'email_test',
          providerType: 'gmail',
          timestamp: new Date().toISOString(),
          payload: { subject: 'Test' },
          headers: {}
        };

        const mockJob = createMockJob(webhookData);

        // Mock ingestion throwing error
        vi.mocked(IngestionPipeline.processMessage).mockRejectedValue(
          new Error('Database connection failed')
        );

        await expect(WebhookProcessor.processWebhook(mockJob))
          .rejects.toThrow('Database connection failed');
      });

      it('should include retry information in error details', async () => {
        const webhookData: WebhookJobData = {
          webhookId: 'wh_126',
          providerId: 'slack_test',
          providerType: 'slack',
          timestamp: new Date().toISOString(),
          payload: { event: { text: 'Test' } },
          headers: {},
          retry: {
            attempt: 2,
            maxAttempts: 3,
            previousError: 'Network timeout'
          }
        };

        const mockJob = createMockJob(webhookData);
        mockJob.attemptsMade = 2;

        vi.mocked(IngestionPipeline.processMessage).mockRejectedValue(
          new Error('Still failing')
        );

        try {
          await WebhookProcessor.processWebhook(mockJob);
        } catch (error) {
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toBe('Still failing');
        }
      });
    });
  });

  describe('MessageProcessor', () => {
    describe('processMessage', () => {
      it('should process message with default options', async () => {
        const messageData: MessageIngestionJobData = {
          providerId: 'gmail_test',
          providerMessageId: 'msg_123',
          providerType: 'gmail',
          channel: 'email',
          payload: { subject: 'Test Email', body: 'Content' },
          timestamp: new Date().toISOString(),
          priority: 'normal'
        };

        const mockJob = createMockJob(messageData);

        vi.mocked(IngestionPipeline.processMessage).mockResolvedValue({
          success: true,
          messageId: 'processed_msg_456',
          customerId: 'cust_789',
          conversationId: 'conv_101'
        });

        const result = await MessageProcessor.processMessage(mockJob);

        expect(result.success).toBe(true);
        expect(result.messageId).toBe('processed_msg_456');
        expect(result.customerId).toBe('cust_789');
        expect(result.conversationId).toBe('conv_101');

        // Verify ingestion was called with correct options
        expect(IngestionPipeline.processMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'msg_123',
            providerId: 'gmail_test',
            providerType: 'gmail'
          }),
          {
            skipDuplicateCheck: false,
            skipIdentityResolution: false,
            skipThreading: false,
            createNewCustomers: true
          }
        );
      });

      it('should process message with custom options', async () => {
        const messageData: MessageIngestionJobData = {
          providerId: 'sms_test',
          providerMessageId: 'sms_789',
          providerType: 'twilio-sms',
          channel: 'sms',
          payload: { From: '+1234567890', Body: 'Test' },
          timestamp: new Date().toISOString(),
          priority: 'high',
          options: {
            skipDuplicateCheck: true,
            skipIdentityResolution: false,
            skipThreading: true,
            createNewCustomers: false
          }
        };

        const mockJob = createMockJob(messageData);

        vi.mocked(IngestionPipeline.processMessage).mockResolvedValue({
          success: true,
          messageId: 'processed_sms_789'
        });

        const result = await MessageProcessor.processMessage(mockJob);

        expect(result.success).toBe(true);

        // Verify custom options were used
        expect(IngestionPipeline.processMessage).toHaveBeenCalledWith(
          expect.any(Object),
          {
            skipDuplicateCheck: true,
            skipIdentityResolution: false,
            skipThreading: true,
            createNewCustomers: false
          }
        );
      });

      it('should handle message processing failure', async () => {
        const messageData: MessageIngestionJobData = {
          providerId: 'test_provider',
          providerMessageId: 'msg_fail',
          providerType: 'test',
          channel: 'test',
          payload: {},
          timestamp: new Date().toISOString()
        };

        const mockJob = createMockJob(messageData);

        vi.mocked(IngestionPipeline.processMessage).mockResolvedValue({
          success: false,
          error: {
            code: 'DUPLICATE_MESSAGE',
            message: 'Message already processed'
          }
        });

        await expect(MessageProcessor.processMessage(mockJob))
          .rejects.toThrow('Message processing failed: Message already processed');
      });
    });
  });

  describe('NotificationProcessor', () => {
    describe('processNotification', () => {
      it('should process email notification', async () => {
        const notificationData: NotificationJobData = {
          type: 'email',
          recipient: 'test@example.com',
          subject: 'Test Notification',
          body: 'This is a test notification',
          metadata: { priority: 'high' }
        };

        const mockJob = createMockJob(notificationData);

        const result = await NotificationProcessor.processNotification(mockJob);

        expect(result.success).toBe(true);
        expect(result.deliveryId).toMatch(/^email_\d+$/);
        expect(result.deliveredAt).toBeDefined();
      });

      it('should process SMS notification', async () => {
        const notificationData: NotificationJobData = {
          type: 'sms',
          recipient: '+1234567890',
          body: 'SMS notification',
          metadata: { campaign: 'test' }
        };

        const mockJob = createMockJob(notificationData);

        const result = await NotificationProcessor.processNotification(mockJob);

        expect(result.success).toBe(true);
        expect(result.deliveryId).toMatch(/^sms_\d+$/);
      });

      it('should process webhook notification', async () => {
        const notificationData: NotificationJobData = {
          type: 'webhook',
          recipient: 'https://api.example.com/webhook',
          body: '{"event": "notification"}',
          metadata: { retries: 3 }
        };

        const mockJob = createMockJob(notificationData);

        const result = await NotificationProcessor.processNotification(mockJob);

        expect(result.success).toBe(true);
        expect(result.deliveryId).toMatch(/^webhook_\d+$/);
      });

      it('should process internal notification', async () => {
        const notificationData: NotificationJobData = {
          type: 'internal',
          recipient: 'admin-team',
          body: 'System alert: High memory usage',
          metadata: { severity: 'warning' }
        };

        const mockJob = createMockJob(notificationData);

        const result = await NotificationProcessor.processNotification(mockJob);

        expect(result.success).toBe(true);
        expect(result.deliveryId).toMatch(/^internal_\d+$/);
      });

      it('should handle unsupported notification type', async () => {
        const notificationData = {
          type: 'unsupported',
          recipient: 'test',
          body: 'test'
        } as any;

        const mockJob = createMockJob(notificationData);

        await expect(NotificationProcessor.processNotification(mockJob))
          .rejects.toThrow('Unsupported notification type: unsupported');
      });
    });
  });

  describe('MaintenanceProcessor', () => {
    describe('processArchive', () => {
      it('should process conversation archive job', async () => {
        const archiveData: ArchiveJobData = {
          type: 'conversations',
          olderThan: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
          batchSize: 100,
          dryRun: false
        };

        const mockJob = createMockJob(archiveData);

        await expect(MaintenanceProcessor.processArchive(mockJob))
          .resolves.not.toThrow();

        expect(mockJob.updateProgress).toHaveBeenCalledWith(50);
      });

      it('should process message archive job with dry run', async () => {
        const archiveData: ArchiveJobData = {
          type: 'messages',
          olderThan: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
          batchSize: 500,
          dryRun: true
        };

        const mockJob = createMockJob(archiveData);

        await expect(MaintenanceProcessor.processArchive(mockJob))
          .resolves.not.toThrow();
      });

      it('should process audit event archive job', async () => {
        const archiveData: ArchiveJobData = {
          type: 'audit_events',
          olderThan: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          batchSize: 200
        };

        const mockJob = createMockJob(archiveData);

        await expect(MaintenanceProcessor.processArchive(mockJob))
          .resolves.not.toThrow();
      });

      it('should handle unsupported archive type', async () => {
        const archiveData = {
          type: 'unsupported',
          olderThan: new Date().toISOString()
        } as any;

        const mockJob = createMockJob(archiveData);

        await expect(MaintenanceProcessor.processArchive(mockJob))
          .rejects.toThrow('Unsupported archive type: unsupported');
      });
    });
  });

  describe('HealthCheckProcessor', () => {
    describe('processHealthCheck', () => {
      it('should process health check for multiple services', async () => {
        const healthCheckData: HealthCheckJobData = {
          services: ['database', 'redis'],
          notifyOnFailure: true,
          thresholds: {
            responseTime: 1000,
            errorRate: 0.05
          }
        };

        const mockJob = createMockJob(healthCheckData);

        await expect(HealthCheckProcessor.processHealthCheck(mockJob))
          .resolves.not.toThrow();

        // Verify progress updates for each service
        expect(mockJob.updateProgress).toHaveBeenCalledWith(0); // First service (0/2 * 90)
        expect(mockJob.updateProgress).toHaveBeenCalledWith(45); // Second service (1/2 * 90)
        expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
      });

      it('should process health check for single service', async () => {
        const healthCheckData: HealthCheckJobData = {
          services: ['external-api'],
          notifyOnFailure: false
        };

        const mockJob = createMockJob(healthCheckData);

        await expect(HealthCheckProcessor.processHealthCheck(mockJob))
          .resolves.not.toThrow();
      });

      it('should handle health check with no thresholds', async () => {
        const healthCheckData: HealthCheckJobData = {
          services: ['database']
        };

        const mockJob = createMockJob(healthCheckData);

        await expect(HealthCheckProcessor.processHealthCheck(mockJob))
          .resolves.not.toThrow();
      });

      it('should handle unknown service gracefully', async () => {
        const healthCheckData: HealthCheckJobData = {
          services: ['unknown-service'],
          notifyOnFailure: true
        };

        const mockJob = createMockJob(healthCheckData);

        // Should not throw, but may log warnings about unknown services
        await expect(HealthCheckProcessor.processHealthCheck(mockJob))
          .resolves.not.toThrow();
      });
    });
  });
});