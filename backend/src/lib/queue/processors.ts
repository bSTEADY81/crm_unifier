import { Job } from 'bullmq';
import logger from '../logger.js';
import { IngestionPipeline } from '../ingestion/pipeline.js';
import {
  WebhookJobData,
  WebhookJobResult,
  MessageIngestionJobData,
  MessageIngestionJobResult,
  NotificationJobData,
  NotificationJobResult,
  ArchiveJobData,
  HealthCheckJobData
} from './types.js';
import { RawProviderMessage } from '../ingestion/types.js';

export class WebhookProcessor {
  static async processWebhook(job: Job<WebhookJobData>): Promise<WebhookJobResult> {
    const startTime = Date.now();
    const { webhookId, providerId, providerType, payload, headers, signature, retry } = job.data;

    try {
      logger.info('Processing webhook job', {
        jobId: job.id,
        webhookId,
        providerId,
        providerType,
        attempt: job.attemptsMade + 1
      });

      // Update job progress
      await job.updateProgress(10);

      // Create raw message from webhook data
      const rawMessage: RawProviderMessage = {
        id: webhookId,
        providerId,
        providerType,
        channel: inferChannelFromProvider(providerType),
        payload,
        headers,
        timestamp: new Date(),
        signature
      };

      await job.updateProgress(30);

      // Process through ingestion pipeline
      const ingestionResult = await IngestionPipeline.processMessage(rawMessage, {
        skipDuplicateCheck: false,
        skipIdentityResolution: false,
        skipThreading: false,
        createNewCustomers: true
      });

      await job.updateProgress(80);

      if (!ingestionResult.success) {
        throw new Error(`Ingestion failed: ${ingestionResult.error?.message}`);
      }

      const processingTime = Date.now() - startTime;

      await job.updateProgress(100);

      const result: WebhookJobResult = {
        success: true,
        messageId: ingestionResult.messageId,
        processingTime,
        metrics: {
          stagesCompleted: ingestionResult.metrics?.stagesCompleted || [],
          identityResolved: !!ingestionResult.customerId,
          conversationCreated: !!ingestionResult.conversationId
        }
      };

      logger.info('Webhook job completed successfully', {
        jobId: job.id,
        webhookId,
        messageId: result.messageId,
        processingTime
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorResult: WebhookJobResult = {
        success: false,
        processingTime,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: {
            webhookId,
            providerId,
            providerType,
            attempt: job.attemptsMade + 1,
            maxAttempts: job.opts.attempts || 1
          }
        }
      };

      logger.error('Webhook job failed', {
        jobId: job.id,
        webhookId,
        error: errorResult.error,
        processingTime
      });

      throw error; // Re-throw to let BullMQ handle retries
    }
  }
}

export class MessageProcessor {
  static async processMessage(job: Job<MessageIngestionJobData>): Promise<MessageIngestionJobResult> {
    const startTime = Date.now();
    const { 
      messageId, 
      providerId, 
      providerMessageId, 
      providerType, 
      channel, 
      payload, 
      priority,
      options = {}
    } = job.data;

    try {
      logger.info('Processing message ingestion job', {
        jobId: job.id,
        messageId,
        providerId,
        providerMessageId,
        priority,
        attempt: job.attemptsMade + 1
      });

      await job.updateProgress(10);

      // Create raw message
      const rawMessage: RawProviderMessage = {
        id: providerMessageId,
        providerId,
        providerType,
        channel,
        payload,
        headers: {},
        timestamp: new Date()
      };

      await job.updateProgress(30);

      // Process with custom options
      const ingestionResult = await IngestionPipeline.processMessage(rawMessage, {
        skipDuplicateCheck: options.skipDuplicateCheck || false,
        skipIdentityResolution: options.skipIdentityResolution || false,
        skipThreading: options.skipThreading || false,
        createNewCustomers: options.createNewCustomers !== false
      });

      await job.updateProgress(90);

      if (!ingestionResult.success) {
        throw new Error(`Message processing failed: ${ingestionResult.error?.message}`);
      }

      const processingTime = Date.now() - startTime;

      await job.updateProgress(100);

      const result: MessageIngestionJobResult = {
        success: true,
        messageId: ingestionResult.messageId,
        customerId: ingestionResult.customerId,
        conversationId: ingestionResult.conversationId,
        processingTime
      };

      logger.info('Message ingestion job completed', {
        jobId: job.id,
        messageId: result.messageId,
        customerId: result.customerId,
        processingTime
      });

      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorResult: MessageIngestionJobResult = {
        success: false,
        processingTime,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          details: {
            messageId,
            providerId,
            providerMessageId,
            attempt: job.attemptsMade + 1
          }
        }
      };

      logger.error('Message ingestion job failed', {
        jobId: job.id,
        messageId,
        error: errorResult.error,
        processingTime
      });

      throw error;
    }
  }
}

export class NotificationProcessor {
  static async processNotification(job: Job<NotificationJobData>): Promise<NotificationJobResult> {
    const startTime = Date.now();
    const { type, recipient, subject, body, metadata } = job.data;

    try {
      logger.info('Processing notification job', {
        jobId: job.id,
        type,
        recipient,
        subject,
        attempt: job.attemptsMade + 1
      });

      await job.updateProgress(20);

      let deliveryId: string;
      let deliveredAt: string;

      switch (type) {
        case 'email':
          ({ deliveryId, deliveredAt } = await this.sendEmail(recipient, subject, body, metadata));
          break;
        case 'sms':
          ({ deliveryId, deliveredAt } = await this.sendSMS(recipient, body, metadata));
          break;
        case 'webhook':
          ({ deliveryId, deliveredAt } = await this.sendWebhook(recipient, body, metadata));
          break;
        case 'internal':
          ({ deliveryId, deliveredAt } = await this.sendInternal(recipient, body, metadata));
          break;
        default:
          throw new Error(`Unsupported notification type: ${type}`);
      }

      await job.updateProgress(100);

      const result: NotificationJobResult = {
        success: true,
        deliveryId,
        deliveredAt
      };

      logger.info('Notification job completed', {
        jobId: job.id,
        type,
        recipient,
        deliveryId
      });

      return result;

    } catch (error) {
      const errorResult: NotificationJobResult = {
        success: false,
        error: {
          code: error instanceof Error ? error.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : 'Unknown error occurred'
        }
      };

      logger.error('Notification job failed', {
        jobId: job.id,
        type,
        recipient,
        error: errorResult.error
      });

      throw error;
    }
  }

  private static async sendEmail(recipient: string, subject: string | undefined, body: string, metadata?: Record<string, any>) {
    // TODO: Implement email sending with nodemailer
    // For now, return mock data
    logger.info('Sending email notification', { recipient, subject });
    return {
      deliveryId: `email_${Date.now()}`,
      deliveredAt: new Date().toISOString()
    };
  }

  private static async sendSMS(recipient: string, body: string, metadata?: Record<string, any>) {
    // TODO: Implement SMS sending with Twilio
    logger.info('Sending SMS notification', { recipient });
    return {
      deliveryId: `sms_${Date.now()}`,
      deliveredAt: new Date().toISOString()
    };
  }

  private static async sendWebhook(url: string, body: string, metadata?: Record<string, any>) {
    // TODO: Implement webhook POST request
    logger.info('Sending webhook notification', { url });
    return {
      deliveryId: `webhook_${Date.now()}`,
      deliveredAt: new Date().toISOString()
    };
  }

  private static async sendInternal(recipient: string, body: string, metadata?: Record<string, any>) {
    // TODO: Implement internal notification system
    logger.info('Sending internal notification', { recipient });
    return {
      deliveryId: `internal_${Date.now()}`,
      deliveredAt: new Date().toISOString()
    };
  }
}

export class MaintenanceProcessor {
  static async processArchive(job: Job<ArchiveJobData>): Promise<void> {
    const { type, olderThan, batchSize = 1000, dryRun = false } = job.data;

    logger.info('Processing archive job', {
      jobId: job.id,
      type,
      olderThan,
      batchSize,
      dryRun
    });

    const cutoffDate = new Date(olderThan);
    let totalProcessed = 0;

    try {
      switch (type) {
        case 'conversations':
          totalProcessed = await this.archiveConversations(cutoffDate, batchSize, dryRun, job);
          break;
        case 'messages':
          totalProcessed = await this.archiveMessages(cutoffDate, batchSize, dryRun, job);
          break;
        case 'audit_events':
          totalProcessed = await this.archiveAuditEvents(cutoffDate, batchSize, dryRun, job);
          break;
        default:
          throw new Error(`Unsupported archive type: ${type}`);
      }

      logger.info('Archive job completed', {
        jobId: job.id,
        type,
        totalProcessed,
        dryRun
      });

    } catch (error) {
      logger.error('Archive job failed', {
        jobId: job.id,
        type,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private static async archiveConversations(
    cutoffDate: Date,
    batchSize: number,
    dryRun: boolean,
    job: Job
  ): Promise<number> {
    // TODO: Implement conversation archiving logic
    logger.info('Archiving conversations', { cutoffDate, batchSize, dryRun });
    await job.updateProgress(50);
    return 0;
  }

  private static async archiveMessages(
    cutoffDate: Date,
    batchSize: number,
    dryRun: boolean,
    job: Job
  ): Promise<number> {
    // TODO: Implement message archiving logic
    logger.info('Archiving messages', { cutoffDate, batchSize, dryRun });
    await job.updateProgress(50);
    return 0;
  }

  private static async archiveAuditEvents(
    cutoffDate: Date,
    batchSize: number,
    dryRun: boolean,
    job: Job
  ): Promise<number> {
    // TODO: Implement audit event archiving logic
    logger.info('Archiving audit events', { cutoffDate, batchSize, dryRun });
    await job.updateProgress(50);
    return 0;
  }
}

export class HealthCheckProcessor {
  static async processHealthCheck(job: Job<HealthCheckJobData>): Promise<void> {
    const { services, notifyOnFailure = true, thresholds = {} } = job.data;

    logger.info('Processing health check job', {
      jobId: job.id,
      services,
      thresholds
    });

    const results: Record<string, any> = {};
    let failedServices: string[] = [];

    try {
      for (const [index, service] of services.entries()) {
        await job.updateProgress(Math.round((index / services.length) * 90));

        const result = await this.checkService(service, thresholds);
        results[service] = result;

        if (!result.healthy) {
          failedServices.push(service);
        }

        logger.info(`Health check result for ${service}`, result);
      }

      await job.updateProgress(100);

      if (failedServices.length > 0 && notifyOnFailure) {
        // TODO: Send failure notifications
        logger.warn('Health check failures detected', { failedServices });
      }

      logger.info('Health check job completed', {
        jobId: job.id,
        totalServices: services.length,
        failedServices: failedServices.length
      });

    } catch (error) {
      logger.error('Health check job failed', {
        jobId: job.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  private static async checkService(
    service: string,
    thresholds: { responseTime?: number; errorRate?: number }
  ): Promise<{ healthy: boolean; responseTime: number; details: any }> {
    const startTime = Date.now();

    try {
      switch (service) {
        case 'database':
          return await this.checkDatabase(thresholds);
        case 'redis':
          return await this.checkRedis(thresholds);
        case 'external-api':
          return await this.checkExternalAPI(thresholds);
        default:
          throw new Error(`Unknown service: ${service}`);
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        healthy: false,
        responseTime,
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }

  private static async checkDatabase(thresholds: any) {
    // TODO: Implement database health check
    return { healthy: true, responseTime: 10, details: {} };
  }

  private static async checkRedis(thresholds: any) {
    // TODO: Implement Redis health check
    return { healthy: true, responseTime: 5, details: {} };
  }

  private static async checkExternalAPI(thresholds: any) {
    // TODO: Implement external API health check
    return { healthy: true, responseTime: 100, details: {} };
  }
}

// Helper function to infer channel from provider type
function inferChannelFromProvider(providerType: string): string {
  const channelMap: Record<string, string> = {
    'twilio-sms': 'sms',
    'twilio-whatsapp': 'whatsapp',
    'gmail': 'email',
    'facebook': 'facebook',
    'instagram': 'instagram'
  };
  return channelMap[providerType] || 'unknown';
}