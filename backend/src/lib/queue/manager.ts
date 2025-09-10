import { Queue, QueueEvents, FlowProducer } from 'bullmq';
import { getRedisConnection } from '../redis.js';
import logger from '../logger.js';
import {
  QueueName,
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  QueueJobOptions,
  WebhookJobData,
  MessageIngestionJobData,
  NotificationJobData,
  ArchiveJobData,
  HealthCheckJobData,
  QueueMetrics,
  JobPriority
} from './types.js';

export class QueueManager {
  private static instance: QueueManager;
  private queues: Map<QueueName, Queue> = new Map();
  private queueEvents: Map<QueueName, QueueEvents> = new Map();
  private flowProducer: FlowProducer | null = null;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }
    return QueueManager.instance;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Queue manager already initialized');
      return;
    }

    try {
      const connection = getRedisConnection();

      // Initialize all queues
      for (const queueName of Object.values(QUEUE_NAMES)) {
        const queue = new Queue(queueName, {
          connection: connection.duplicate(),
          defaultJobOptions: DEFAULT_JOB_OPTIONS[queueName]
        });

        const queueEvents = new QueueEvents(queueName, {
          connection: connection.duplicate()
        });

        this.queues.set(queueName, queue);
        this.queueEvents.set(queueName, queueEvents);

        // Set up event listeners
        this.setupQueueEventListeners(queueName, queueEvents);
      }

      // Initialize flow producer for complex job workflows
      this.flowProducer = new FlowProducer({
        connection: connection.duplicate()
      });

      this.isInitialized = true;
      logger.info('Queue manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize queue manager:', error);
      throw error;
    }
  }

  private setupQueueEventListeners(queueName: QueueName, queueEvents: QueueEvents): void {
    queueEvents.on('completed', ({ jobId, returnvalue }) => {
      logger.info(`Job completed in ${queueName}`, { jobId, returnvalue });
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.error(`Job failed in ${queueName}`, { jobId, failedReason });
    });

    queueEvents.on('retrying', ({ jobId, attemptsMade }) => {
      logger.warn(`Job retrying in ${queueName}`, { jobId, attemptsMade });
    });

    queueEvents.on('stalled', ({ jobId }) => {
      logger.warn(`Job stalled in ${queueName}`, { jobId });
    });

    queueEvents.on('progress', ({ jobId, data }) => {
      logger.debug(`Job progress in ${queueName}`, { jobId, progress: data });
    });
  }

  getQueue(queueName: QueueName): Queue {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not initialized`);
    }
    return queue;
  }

  async addWebhookJob(
    data: WebhookJobData, 
    options: QueueJobOptions = {}
  ): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.WEBHOOK_INGESTION);
    const jobOptions = { ...DEFAULT_JOB_OPTIONS[QUEUE_NAMES.WEBHOOK_INGESTION], ...options };
    
    const job = await queue.add('process-webhook', data, jobOptions);
    
    logger.info('Webhook job added', { 
      jobId: job.id, 
      providerId: data.providerId,
      providerType: data.providerType
    });
    
    return job.id!;
  }

  async addMessageIngestionJob(
    data: MessageIngestionJobData,
    options: QueueJobOptions = {}
  ): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.MESSAGE_PROCESSING);
    const jobOptions = { ...DEFAULT_JOB_OPTIONS[QUEUE_NAMES.MESSAGE_PROCESSING], ...options };
    
    // Set priority based on data priority field
    if (data.priority) {
      switch (data.priority) {
        case 'critical':
          jobOptions.priority = JobPriority.CRITICAL;
          break;
        case 'high':
          jobOptions.priority = JobPriority.HIGH;
          break;
        case 'low':
          jobOptions.priority = JobPriority.LOW;
          break;
        default:
          jobOptions.priority = JobPriority.NORMAL;
      }
    }

    const job = await queue.add('process-message', data, jobOptions);
    
    logger.info('Message ingestion job added', {
      jobId: job.id,
      providerId: data.providerId,
      providerMessageId: data.providerMessageId,
      priority: data.priority || 'normal'
    });
    
    return job.id!;
  }

  async addNotificationJob(
    data: NotificationJobData,
    options: QueueJobOptions = {}
  ): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.NOTIFICATIONS);
    const jobOptions = { ...DEFAULT_JOB_OPTIONS[QUEUE_NAMES.NOTIFICATIONS], ...options };
    
    // Handle scheduled notifications
    if (data.scheduledFor) {
      const scheduledTime = new Date(data.scheduledFor);
      const delay = scheduledTime.getTime() - Date.now();
      if (delay > 0) {
        jobOptions.delay = delay;
      }
    }

    const job = await queue.add(`notify-${data.type}`, data, jobOptions);
    
    logger.info('Notification job added', {
      jobId: job.id,
      type: data.type,
      recipient: data.recipient,
      scheduledFor: data.scheduledFor
    });
    
    return job.id!;
  }

  async addMaintenanceJob(
    jobType: string,
    data: ArchiveJobData | HealthCheckJobData,
    options: QueueJobOptions = {}
  ): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.MAINTENANCE);
    const jobOptions = { ...DEFAULT_JOB_OPTIONS[QUEUE_NAMES.MAINTENANCE], ...options };
    
    const job = await queue.add(jobType, data, jobOptions);
    
    logger.info('Maintenance job added', {
      jobId: job.id,
      jobType,
      data
    });
    
    return job.id!;
  }

  async addHealthCheckJob(
    data: HealthCheckJobData,
    options: QueueJobOptions = {}
  ): Promise<string> {
    const queue = this.getQueue(QUEUE_NAMES.HEALTH_CHECK);
    const jobOptions = { ...DEFAULT_JOB_OPTIONS[QUEUE_NAMES.HEALTH_CHECK], ...options };
    
    const job = await queue.add('health-check', data, jobOptions);
    
    logger.info('Health check job added', {
      jobId: job.id,
      services: data.services
    });
    
    return job.id!;
  }

  // Create a flow of dependent jobs
  async addJobFlow(flowDefinition: {
    name: string;
    queueName: QueueName;
    data: any;
    opts?: QueueJobOptions;
    children?: Array<{
      name: string;
      queueName: QueueName;
      data: any;
      opts?: QueueJobOptions;
    }>;
  }): Promise<string> {
    if (!this.flowProducer) {
      throw new Error('Flow producer not initialized');
    }

    const flow = await this.flowProducer.add({
      name: flowDefinition.name,
      queueName: flowDefinition.queueName,
      data: flowDefinition.data,
      opts: flowDefinition.opts,
      children: flowDefinition.children
    });

    logger.info('Job flow added', {
      flowId: flow.job.id,
      name: flowDefinition.name,
      childrenCount: flowDefinition.children?.length || 0
    });

    return flow.job.id!;
  }

  async getQueueMetrics(queueName: QueueName): Promise<QueueMetrics> {
    const queue = this.getQueue(queueName);
    
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(), 
      queue.getCompleted(),
      queue.getFailed(),
      queue.getDelayed()
    ]);

    const isPaused = await queue.isPaused();

    return {
      queueName,
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
      paused: isPaused
    };
  }

  async getAllQueueMetrics(): Promise<QueueMetrics[]> {
    const metrics: QueueMetrics[] = [];
    
    for (const queueName of Object.values(QUEUE_NAMES)) {
      const queueMetrics = await this.getQueueMetrics(queueName);
      metrics.push(queueMetrics);
    }
    
    return metrics;
  }

  async pauseQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.pause();
    logger.info(`Queue ${queueName} paused`);
  }

  async resumeQueue(queueName: QueueName): Promise<void> {
    const queue = this.getQueue(queueName);
    await queue.resume();
    logger.info(`Queue ${queueName} resumed`);
  }

  async clearQueue(queueName: QueueName, status: 'completed' | 'failed' | 'active' | 'waiting' = 'completed'): Promise<void> {
    const queue = this.getQueue(queueName);
    
    switch (status) {
      case 'completed':
        await queue.clean(0, 'completed');
        break;
      case 'failed':
        await queue.clean(0, 'failed');
        break;
      case 'active':
        await queue.clean(0, 'active');
        break;
      case 'waiting':
        await queue.clean(0, 'waiting');
        break;
    }
    
    logger.info(`Cleared ${status} jobs from queue ${queueName}`);
  }

  async retryFailedJobs(queueName: QueueName, limit = 100): Promise<number> {
    const queue = this.getQueue(queueName);
    const failedJobs = await queue.getFailed(0, limit);
    
    let retriedCount = 0;
    for (const job of failedJobs) {
      try {
        await job.retry();
        retriedCount++;
      } catch (error) {
        logger.error(`Failed to retry job ${job.id}:`, error);
      }
    }
    
    logger.info(`Retried ${retriedCount} failed jobs in queue ${queueName}`);
    return retriedCount;
  }

  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down queue manager...');
      
      // Close all queues
      for (const queue of this.queues.values()) {
        await queue.close();
      }
      
      // Close all queue events
      for (const queueEvents of this.queueEvents.values()) {
        await queueEvents.close();
      }
      
      // Close flow producer
      if (this.flowProducer) {
        await this.flowProducer.close();
      }
      
      this.queues.clear();
      this.queueEvents.clear();
      this.flowProducer = null;
      this.isInitialized = false;
      
      logger.info('Queue manager shutdown complete');
    } catch (error) {
      logger.error('Error during queue manager shutdown:', error);
      throw error;
    }
  }
}

// Export singleton instance
export const queueManager = QueueManager.getInstance();
export default queueManager;