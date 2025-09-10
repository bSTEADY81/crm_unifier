import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { QueueManager } from '../../../src/lib/queue/manager.js';
import { redisManager } from '../../../src/lib/redis.js';
import { 
  QUEUE_NAMES, 
  WebhookJobData, 
  MessageIngestionJobData,
  NotificationJobData,
  HealthCheckJobData 
} from '../../../src/lib/queue/types.js';

// Mock Redis for testing
vi.mock('../../../src/lib/redis.js', () => ({
  redisManager: {
    connect: vi.fn(),
    disconnect: vi.fn(),
    getClient: vi.fn(() => ({
      duplicate: vi.fn(() => ({}))
    }))
  },
  getRedisConnection: vi.fn(() => ({
    duplicate: vi.fn(() => ({}))
  }))
}));

// Mock BullMQ
vi.mock('bullmq', () => {
  const mockJob = {
    id: 'test-job-123',
    add: vi.fn().mockResolvedValue({ id: 'test-job-123' })
  };

  return {
    Queue: vi.fn().mockImplementation(() => ({
      add: mockJob.add,
      getWaiting: vi.fn().mockResolvedValue([]),
      getActive: vi.fn().mockResolvedValue([]),
      getCompleted: vi.fn().mockResolvedValue([]),
      getFailed: vi.fn().mockResolvedValue([]),
      getDelayed: vi.fn().mockResolvedValue([]),
      isPaused: vi.fn().mockResolvedValue(false),
      pause: vi.fn().mockResolvedValue(undefined),
      resume: vi.fn().mockResolvedValue(undefined),
      clean: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    })),
    QueueEvents: vi.fn().mockImplementation(() => ({
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined)
    })),
    FlowProducer: vi.fn().mockImplementation(() => ({
      add: vi.fn().mockResolvedValue({ job: { id: 'flow-job-123' } }),
      close: vi.fn().mockResolvedValue(undefined)
    }))
  };
});

describe('QueueManager', () => {
  let queueManager: QueueManager;

  beforeAll(async () => {
    queueManager = QueueManager.getInstance();
    await queueManager.initialize();
  });

  afterAll(async () => {
    await queueManager.shutdown();
  });

  describe('getInstance', () => {
    it('should return the same instance (singleton)', () => {
      const instance1 = QueueManager.getInstance();
      const instance2 = QueueManager.getInstance();
      
      expect(instance1).toBe(instance2);
    });
  });

  describe('initialize', () => {
    it('should initialize all queues successfully', async () => {
      // Already initialized in beforeAll
      expect(queueManager).toBeDefined();
    });

    it('should handle duplicate initialization gracefully', async () => {
      await expect(queueManager.initialize()).resolves.not.toThrow();
    });
  });

  describe('addWebhookJob', () => {
    it('should add webhook job successfully', async () => {
      const webhookData: WebhookJobData = {
        webhookId: 'wh_123',
        providerId: 'twilio_test',
        providerType: 'twilio-sms',
        timestamp: new Date().toISOString(),
        payload: { From: '+1234567890', Body: 'Test message' },
        headers: { 'X-Twilio-Signature': 'test-signature' }
      };

      const jobId = await queueManager.addWebhookJob(webhookData);
      
      expect(jobId).toBe('test-job-123');
    });

    it('should add webhook job with custom options', async () => {
      const webhookData: WebhookJobData = {
        webhookId: 'wh_124',
        providerId: 'whatsapp_test',
        providerType: 'whatsapp',
        timestamp: new Date().toISOString(),
        payload: { messages: [{ text: { body: 'Test WhatsApp' } }] },
        headers: { 'X-Hub-Signature-256': 'test-signature' }
      };

      const jobId = await queueManager.addWebhookJob(webhookData, {
        delay: 5000,
        attempts: 5
      });
      
      expect(jobId).toBe('test-job-123');
    });
  });

  describe('addMessageIngestionJob', () => {
    it('should add message ingestion job with normal priority', async () => {
      const messageData: MessageIngestionJobData = {
        providerId: 'gmail_test',
        providerMessageId: 'msg_123',
        providerType: 'gmail',
        channel: 'email',
        payload: { subject: 'Test Email', body: 'Test content' },
        timestamp: new Date().toISOString()
      };

      const jobId = await queueManager.addMessageIngestionJob(messageData);
      
      expect(jobId).toBe('test-job-123');
    });

    it('should add message ingestion job with critical priority', async () => {
      const messageData: MessageIngestionJobData = {
        providerId: 'sms_test',
        providerMessageId: 'msg_124',
        providerType: 'twilio-sms',
        channel: 'sms',
        payload: { From: '+1234567890', Body: 'Urgent message' },
        timestamp: new Date().toISOString(),
        priority: 'critical'
      };

      const jobId = await queueManager.addMessageIngestionJob(messageData);
      
      expect(jobId).toBe('test-job-123');
    });

    it('should add message ingestion job with processing options', async () => {
      const messageData: MessageIngestionJobData = {
        providerId: 'email_test',
        providerMessageId: 'msg_125',
        providerType: 'gmail',
        channel: 'email',
        payload: { subject: 'Test', body: 'Content' },
        timestamp: new Date().toISOString(),
        options: {
          skipDuplicateCheck: true,
          skipIdentityResolution: false,
          createNewCustomers: true
        }
      };

      const jobId = await queueManager.addMessageIngestionJob(messageData);
      
      expect(jobId).toBe('test-job-123');
    });
  });

  describe('addNotificationJob', () => {
    it('should add immediate notification job', async () => {
      const notificationData: NotificationJobData = {
        type: 'email',
        recipient: 'test@example.com',
        subject: 'Test Notification',
        body: 'This is a test notification',
        metadata: { source: 'test' }
      };

      const jobId = await queueManager.addNotificationJob(notificationData);
      
      expect(jobId).toBe('test-job-123');
    });

    it('should add scheduled notification job', async () => {
      const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now
      const notificationData: NotificationJobData = {
        type: 'sms',
        recipient: '+1234567890',
        body: 'Scheduled SMS notification',
        scheduledFor: scheduledTime.toISOString()
      };

      const jobId = await queueManager.addNotificationJob(notificationData);
      
      expect(jobId).toBe('test-job-123');
    });
  });

  describe('addMaintenanceJob', () => {
    it('should add archive job', async () => {
      const archiveData = {
        type: 'conversations' as const,
        olderThan: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        batchSize: 1000,
        dryRun: true
      };

      const jobId = await queueManager.addMaintenanceJob('archive-conversations', archiveData);
      
      expect(jobId).toBe('test-job-123');
    });
  });

  describe('addHealthCheckJob', () => {
    it('should add health check job', async () => {
      const healthCheckData: HealthCheckJobData = {
        services: ['database', 'redis'],
        notifyOnFailure: true,
        thresholds: {
          responseTime: 1000,
          errorRate: 0.05
        }
      };

      const jobId = await queueManager.addHealthCheckJob(healthCheckData);
      
      expect(jobId).toBe('test-job-123');
    });
  });

  describe('addJobFlow', () => {
    it('should add job flow with dependencies', async () => {
      const flowDefinition = {
        name: 'message-processing-flow',
        queueName: QUEUE_NAMES.MESSAGE_PROCESSING,
        data: { messageId: 'msg_123' },
        children: [
          {
            name: 'send-notification',
            queueName: QUEUE_NAMES.NOTIFICATIONS,
            data: { type: 'email', recipient: 'user@example.com', body: 'Message processed' }
          }
        ]
      };

      const flowId = await queueManager.addJobFlow(flowDefinition);
      
      expect(flowId).toBe('flow-job-123');
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const metrics = await queueManager.getQueueMetrics(QUEUE_NAMES.WEBHOOK_INGESTION);
      
      expect(metrics).toEqual({
        queueName: QUEUE_NAMES.WEBHOOK_INGESTION,
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
        paused: false
      });
    });
  });

  describe('getAllQueueMetrics', () => {
    it('should return metrics for all queues', async () => {
      const allMetrics = await queueManager.getAllQueueMetrics();
      
      expect(allMetrics).toHaveLength(5); // 5 queue types
      expect(allMetrics[0]).toHaveProperty('queueName');
      expect(allMetrics[0]).toHaveProperty('waiting');
      expect(allMetrics[0]).toHaveProperty('active');
    });
  });

  describe('queue control operations', () => {
    it('should pause and resume queue', async () => {
      await expect(queueManager.pauseQueue(QUEUE_NAMES.WEBHOOK_INGESTION))
        .resolves.not.toThrow();
      
      await expect(queueManager.resumeQueue(QUEUE_NAMES.WEBHOOK_INGESTION))
        .resolves.not.toThrow();
    });

    it('should clear completed jobs from queue', async () => {
      await expect(queueManager.clearQueue(QUEUE_NAMES.WEBHOOK_INGESTION, 'completed'))
        .resolves.not.toThrow();
    });

    it('should retry failed jobs', async () => {
      const retriedCount = await queueManager.retryFailedJobs(QUEUE_NAMES.WEBHOOK_INGESTION, 10);
      
      expect(retriedCount).toBe(0); // Mock returns empty failed jobs array
    });
  });

  describe('error handling', () => {
    it('should throw error for non-existent queue', () => {
      expect(() => {
        queueManager.getQueue('non-existent-queue' as any);
      }).toThrow('Queue non-existent-queue not initialized');
    });

    it('should handle job flow creation without flow producer', async () => {
      // Temporarily set flowProducer to null
      const originalFlowProducer = (queueManager as any).flowProducer;
      (queueManager as any).flowProducer = null;

      const flowDefinition = {
        name: 'test-flow',
        queueName: QUEUE_NAMES.MESSAGE_PROCESSING,
        data: {}
      };

      await expect(queueManager.addJobFlow(flowDefinition))
        .rejects.toThrow('Flow producer not initialized');

      // Restore flowProducer
      (queueManager as any).flowProducer = originalFlowProducer;
    });
  });
});