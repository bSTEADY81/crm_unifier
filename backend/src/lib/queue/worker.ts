import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../redis.js';
import logger from '../logger.js';
import {
  QUEUE_NAMES,
  QueueName,
  WebhookJobData,
  MessageIngestionJobData,
  NotificationJobData,
  ArchiveJobData,
  HealthCheckJobData
} from './types.js';
import {
  WebhookProcessor,
  MessageProcessor,
  NotificationProcessor,
  MaintenanceProcessor,
  HealthCheckProcessor
} from './processors.js';

export class QueueWorker {
  private static instance: QueueWorker;
  private workers: Map<QueueName, Worker> = new Map();
  private isRunning = false;

  private constructor() {}

  static getInstance(): QueueWorker {
    if (!QueueWorker.instance) {
      QueueWorker.instance = new QueueWorker();
    }
    return QueueWorker.instance;
  }

  async start(concurrency: Record<QueueName, number> = {}): Promise<void> {
    if (this.isRunning) {
      logger.warn('Queue worker already running');
      return;
    }

    try {
      const connection = getRedisConnection();

      // Default concurrency settings
      const defaultConcurrency = {
        [QUEUE_NAMES.WEBHOOK_INGESTION]: 10,
        [QUEUE_NAMES.MESSAGE_PROCESSING]: 5,
        [QUEUE_NAMES.NOTIFICATIONS]: 3,
        [QUEUE_NAMES.MAINTENANCE]: 1,
        [QUEUE_NAMES.HEALTH_CHECK]: 1
      };

      // Initialize workers for each queue
      await this.initializeWebhookWorker(connection, concurrency[QUEUE_NAMES.WEBHOOK_INGESTION] || defaultConcurrency[QUEUE_NAMES.WEBHOOK_INGESTION]);
      await this.initializeMessageWorker(connection, concurrency[QUEUE_NAMES.MESSAGE_PROCESSING] || defaultConcurrency[QUEUE_NAMES.MESSAGE_PROCESSING]);
      await this.initializeNotificationWorker(connection, concurrency[QUEUE_NAMES.NOTIFICATIONS] || defaultConcurrency[QUEUE_NAMES.NOTIFICATIONS]);
      await this.initializeMaintenanceWorker(connection, concurrency[QUEUE_NAMES.MAINTENANCE] || defaultConcurrency[QUEUE_NAMES.MAINTENANCE]);
      await this.initializeHealthCheckWorker(connection, concurrency[QUEUE_NAMES.HEALTH_CHECK] || defaultConcurrency[QUEUE_NAMES.HEALTH_CHECK]);

      this.isRunning = true;
      logger.info('Queue workers started successfully', {
        workers: Array.from(this.workers.keys()),
        concurrency: { ...defaultConcurrency, ...concurrency }
      });

    } catch (error) {
      logger.error('Failed to start queue workers:', error);
      throw error;
    }
  }

  private async initializeWebhookWorker(connection: any, concurrency: number): Promise<void> {
    const worker = new Worker(
      QUEUE_NAMES.WEBHOOK_INGESTION,
      async (job: Job<WebhookJobData>) => {
        return await WebhookProcessor.processWebhook(job);
      },
      {
        connection: connection.duplicate(),
        concurrency,
        removeOnComplete: 50,
        removeOnFail: 20,
        stalledInterval: 30000,
        maxStalledCount: 3
      }
    );

    this.setupWorkerEventListeners(worker, QUEUE_NAMES.WEBHOOK_INGESTION);
    this.workers.set(QUEUE_NAMES.WEBHOOK_INGESTION, worker);

    logger.info(`Webhook ingestion worker initialized with concurrency ${concurrency}`);
  }

  private async initializeMessageWorker(connection: any, concurrency: number): Promise<void> {
    const worker = new Worker(
      QUEUE_NAMES.MESSAGE_PROCESSING,
      async (job: Job<MessageIngestionJobData>) => {
        return await MessageProcessor.processMessage(job);
      },
      {
        connection: connection.duplicate(),
        concurrency,
        removeOnComplete: 100,
        removeOnFail: 50,
        stalledInterval: 30000,
        maxStalledCount: 3
      }
    );

    this.setupWorkerEventListeners(worker, QUEUE_NAMES.MESSAGE_PROCESSING);
    this.workers.set(QUEUE_NAMES.MESSAGE_PROCESSING, worker);

    logger.info(`Message processing worker initialized with concurrency ${concurrency}`);
  }

  private async initializeNotificationWorker(connection: any, concurrency: number): Promise<void> {
    const worker = new Worker(
      QUEUE_NAMES.NOTIFICATIONS,
      async (job: Job<NotificationJobData>) => {
        return await NotificationProcessor.processNotification(job);
      },
      {
        connection: connection.duplicate(),
        concurrency,
        removeOnComplete: 25,
        removeOnFail: 10,
        stalledInterval: 60000,
        maxStalledCount: 2
      }
    );

    this.setupWorkerEventListeners(worker, QUEUE_NAMES.NOTIFICATIONS);
    this.workers.set(QUEUE_NAMES.NOTIFICATIONS, worker);

    logger.info(`Notification worker initialized with concurrency ${concurrency}`);
  }

  private async initializeMaintenanceWorker(connection: any, concurrency: number): Promise<void> {
    const worker = new Worker(
      QUEUE_NAMES.MAINTENANCE,
      async (job: Job<ArchiveJobData>) => {
        return await MaintenanceProcessor.processArchive(job);
      },
      {
        connection: connection.duplicate(),
        concurrency,
        removeOnComplete: 10,
        removeOnFail: 5,
        stalledInterval: 120000, // 2 minutes
        maxStalledCount: 1
      }
    );

    this.setupWorkerEventListeners(worker, QUEUE_NAMES.MAINTENANCE);
    this.workers.set(QUEUE_NAMES.MAINTENANCE, worker);

    logger.info(`Maintenance worker initialized with concurrency ${concurrency}`);
  }

  private async initializeHealthCheckWorker(connection: any, concurrency: number): Promise<void> {
    const worker = new Worker(
      QUEUE_NAMES.HEALTH_CHECK,
      async (job: Job<HealthCheckJobData>) => {
        return await HealthCheckProcessor.processHealthCheck(job);
      },
      {
        connection: connection.duplicate(),
        concurrency,
        removeOnComplete: 5,
        removeOnFail: 3,
        stalledInterval: 30000,
        maxStalledCount: 2
      }
    );

    this.setupWorkerEventListeners(worker, QUEUE_NAMES.HEALTH_CHECK);
    this.workers.set(QUEUE_NAMES.HEALTH_CHECK, worker);

    logger.info(`Health check worker initialized with concurrency ${concurrency}`);
  }

  private setupWorkerEventListeners(worker: Worker, queueName: QueueName): void {
    worker.on('completed', (job: Job, result: any) => {
      logger.info(`Job completed in ${queueName}`, {
        jobId: job.id,
        name: job.name,
        duration: Date.now() - job.processedOn!,
        result: typeof result === 'object' ? JSON.stringify(result) : result
      });
    });

    worker.on('failed', (job: Job | undefined, error: Error) => {
      logger.error(`Job failed in ${queueName}`, {
        jobId: job?.id,
        name: job?.name,
        attemptsMade: job?.attemptsMade,
        error: error.message,
        stack: error.stack
      });
    });

    worker.on('progress', (job: Job, progress: number | object) => {
      logger.debug(`Job progress in ${queueName}`, {
        jobId: job.id,
        name: job.name,
        progress
      });
    });

    worker.on('stalled', (jobId: string) => {
      logger.warn(`Job stalled in ${queueName}`, { jobId });
    });

    worker.on('error', (error: Error) => {
      logger.error(`Worker error in ${queueName}:`, error);
    });

    worker.on('ready', () => {
      logger.info(`Worker ready for ${queueName}`);
    });

    worker.on('drained', () => {
      logger.debug(`Queue ${queueName} drained`);
    });
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Queue worker not running');
      return;
    }

    try {
      logger.info('Stopping queue workers...');
      
      // Close all workers
      const closePromises = Array.from(this.workers.values()).map(worker => worker.close());
      await Promise.all(closePromises);

      this.workers.clear();
      this.isRunning = false;
      
      logger.info('All queue workers stopped');

    } catch (error) {
      logger.error('Error stopping queue workers:', error);
      throw error;
    }
  }

  async pause(queueName?: QueueName): Promise<void> {
    if (queueName) {
      const worker = this.workers.get(queueName);
      if (worker) {
        await worker.pause();
        logger.info(`Worker paused for ${queueName}`);
      }
    } else {
      // Pause all workers
      const pausePromises = Array.from(this.workers.values()).map(worker => worker.pause());
      await Promise.all(pausePromises);
      logger.info('All workers paused');
    }
  }

  async resume(queueName?: QueueName): Promise<void> {
    if (queueName) {
      const worker = this.workers.get(queueName);
      if (worker) {
        await worker.resume();
        logger.info(`Worker resumed for ${queueName}`);
      }
    } else {
      // Resume all workers
      const resumePromises = Array.from(this.workers.values()).map(worker => worker.resume());
      await Promise.all(resumePromises);
      logger.info('All workers resumed');
    }
  }

  getWorkerStats(): Record<QueueName, any> {
    const stats: Record<string, any> = {};
    
    for (const [queueName, worker] of this.workers.entries()) {
      stats[queueName] = {
        isRunning: worker.isRunning(),
        isPaused: worker.isPaused(),
        concurrency: worker.opts.concurrency
      };
    }
    
    return stats;
  }

  isWorkerRunning(): boolean {
    return this.isRunning;
  }
}

// Export singleton instance
export const queueWorker = QueueWorker.getInstance();
export default queueWorker;