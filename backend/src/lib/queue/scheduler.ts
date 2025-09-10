import { CronJob } from 'cron';
import logger from '../logger.js';
import { queueManager } from './manager.js';
import { queueMonitor } from './monitor.js';
import {
  QueueName,
  QUEUE_NAMES,
  ArchiveJobData,
  HealthCheckJobData,
  NotificationJobData
} from './types.js';

export interface ScheduledJob {
  id: string;
  name: string;
  cronPattern: string;
  queueName: QueueName;
  jobData: any;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  runCount: number;
  failureCount: number;
}

export interface ScheduleOptions {
  enabled?: boolean;
  timezone?: string;
  retryOnFailure?: boolean;
  maxRetries?: number;
  onComplete?: (job: ScheduledJob) => void;
  onError?: (job: ScheduledJob, error: Error) => void;
}

export class JobScheduler {
  private static instance: JobScheduler;
  private scheduledJobs: Map<string, ScheduledJob> = new Map();
  private cronJobs: Map<string, CronJob> = new Map();
  private isRunning = false;

  private constructor() {}

  static getInstance(): JobScheduler {
    if (!JobScheduler.instance) {
      JobScheduler.instance = new JobScheduler();
    }
    return JobScheduler.instance;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Job scheduler already running');
      return;
    }

    try {
      // Set up default scheduled jobs
      await this.setupDefaultScheduledJobs();

      // Start all enabled scheduled jobs
      for (const [id, scheduledJob] of this.scheduledJobs.entries()) {
        if (scheduledJob.enabled) {
          await this.startScheduledJob(id);
        }
      }

      this.isRunning = true;
      logger.info('Job scheduler started successfully', {
        totalJobs: this.scheduledJobs.size,
        activeJobs: Array.from(this.cronJobs.keys()).length
      });

    } catch (error) {
      logger.error('Failed to start job scheduler:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    try {
      // Stop all cron jobs
      for (const cronJob of this.cronJobs.values()) {
        cronJob.stop();
      }

      this.cronJobs.clear();
      this.isRunning = false;

      logger.info('Job scheduler stopped');

    } catch (error) {
      logger.error('Error stopping job scheduler:', error);
      throw error;
    }
  }

  private async setupDefaultScheduledJobs(): Promise<void> {
    // Health checks every 5 minutes
    await this.scheduleJob(
      'health-check-system',
      'System Health Check',
      '*/5 * * * *', // Every 5 minutes
      QUEUE_NAMES.HEALTH_CHECK,
      {
        services: ['database', 'redis'],
        notifyOnFailure: true,
        thresholds: {
          responseTime: 1000,
          errorRate: 0.05
        }
      } as HealthCheckJobData,
      { enabled: true }
    );

    // Archive old conversations weekly (Sundays at 2 AM)
    await this.scheduleJob(
      'archive-conversations',
      'Weekly Conversation Archive',
      '0 2 * * 0',
      QUEUE_NAMES.MAINTENANCE,
      {
        type: 'conversations',
        olderThan: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        batchSize: 1000,
        dryRun: false
      } as ArchiveJobData,
      { enabled: true }
    );

    // Archive old messages monthly (1st of month at 3 AM)
    await this.scheduleJob(
      'archive-messages',
      'Monthly Message Archive',
      '0 3 1 * *',
      QUEUE_NAMES.MAINTENANCE,
      {
        type: 'messages',
        olderThan: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(), // 180 days
        batchSize: 5000,
        dryRun: false
      } as ArchiveJobData,
      { enabled: true }
    );

    // Archive audit events weekly (Saturdays at 1 AM)
    await this.scheduleJob(
      'archive-audit-events',
      'Weekly Audit Event Archive',
      '0 1 * * 6',
      QUEUE_NAMES.MAINTENANCE,
      {
        type: 'audit_events',
        olderThan: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        batchSize: 2000,
        dryRun: false
      } as ArchiveJobData,
      { enabled: true }
    );

    // Queue metrics report daily at 9 AM
    await this.scheduleJob(
      'daily-metrics-report',
      'Daily Queue Metrics Report',
      '0 9 * * *',
      QUEUE_NAMES.NOTIFICATIONS,
      {
        type: 'internal',
        recipient: 'admin',
        subject: 'Daily Queue Metrics Report',
        body: 'Daily metrics report will be generated',
        metadata: {
          reportType: 'queue_metrics',
          automated: true
        }
      } as NotificationJobData,
      { enabled: true }
    );

    logger.info('Default scheduled jobs configured', {
      count: this.scheduledJobs.size
    });
  }

  async scheduleJob(
    id: string,
    name: string,
    cronPattern: string,
    queueName: QueueName,
    jobData: any,
    options: ScheduleOptions = {}
  ): Promise<void> {
    try {
      const scheduledJob: ScheduledJob = {
        id,
        name,
        cronPattern,
        queueName,
        jobData,
        enabled: options.enabled !== false,
        runCount: 0,
        failureCount: 0
      };

      this.scheduledJobs.set(id, scheduledJob);

      if (scheduledJob.enabled && this.isRunning) {
        await this.startScheduledJob(id, options);
      }

      logger.info('Scheduled job configured', {
        id,
        name,
        cronPattern,
        queueName,
        enabled: scheduledJob.enabled
      });

    } catch (error) {
      logger.error('Failed to schedule job:', error);
      throw error;
    }
  }

  private async startScheduledJob(id: string, options: ScheduleOptions = {}): Promise<void> {
    const scheduledJob = this.scheduledJobs.get(id);
    if (!scheduledJob) {
      throw new Error(`Scheduled job not found: ${id}`);
    }

    try {
      const cronJob = new CronJob(
        scheduledJob.cronPattern,
        async () => {
          await this.executeScheduledJob(id, options);
        },
        null,
        false,
        options.timezone || 'UTC'
      );

      // Calculate next run time
      scheduledJob.nextRun = cronJob.nextDate().toJSDate();

      this.cronJobs.set(id, cronJob);
      cronJob.start();

      logger.info('Scheduled job started', {
        id: scheduledJob.id,
        name: scheduledJob.name,
        nextRun: scheduledJob.nextRun
      });

    } catch (error) {
      logger.error(`Failed to start scheduled job ${id}:`, error);
      throw error;
    }
  }

  private async executeScheduledJob(id: string, options: ScheduleOptions = {}): Promise<void> {
    const scheduledJob = this.scheduledJobs.get(id);
    if (!scheduledJob) {
      logger.error(`Scheduled job not found: ${id}`);
      return;
    }

    try {
      logger.info('Executing scheduled job', {
        id: scheduledJob.id,
        name: scheduledJob.name,
        queueName: scheduledJob.queueName
      });

      scheduledJob.lastRun = new Date();
      scheduledJob.runCount++;

      // Add job to appropriate queue
      let jobId: string;
      switch (scheduledJob.queueName) {
        case QUEUE_NAMES.HEALTH_CHECK:
          jobId = await queueManager.addHealthCheckJob(
            scheduledJob.jobData as HealthCheckJobData
          );
          break;
        case QUEUE_NAMES.MAINTENANCE:
          jobId = await queueManager.addMaintenanceJob(
            getMaintenanceJobType(scheduledJob.jobData),
            scheduledJob.jobData
          );
          break;
        case QUEUE_NAMES.NOTIFICATIONS:
          jobId = await queueManager.addNotificationJob(
            scheduledJob.jobData as NotificationJobData
          );
          break;
        default:
          throw new Error(`Unsupported queue for scheduled job: ${scheduledJob.queueName}`);
      }

      // Update next run time
      const cronJob = this.cronJobs.get(id);
      if (cronJob) {
        scheduledJob.nextRun = cronJob.nextDate().toJSDate();
      }

      logger.info('Scheduled job executed successfully', {
        id: scheduledJob.id,
        jobId,
        nextRun: scheduledJob.nextRun
      });

      // Call completion callback if provided
      if (options.onComplete) {
        try {
          options.onComplete(scheduledJob);
        } catch (callbackError) {
          logger.error('Error in scheduled job completion callback:', callbackError);
        }
      }

    } catch (error) {
      scheduledJob.failureCount++;
      logger.error('Scheduled job execution failed', {
        id: scheduledJob.id,
        name: scheduledJob.name,
        error: error instanceof Error ? error.message : 'Unknown error',
        failureCount: scheduledJob.failureCount
      });

      // Call error callback if provided
      if (options.onError) {
        try {
          options.onError(scheduledJob, error as Error);
        } catch (callbackError) {
          logger.error('Error in scheduled job error callback:', callbackError);
        }
      }

      // Retry logic if enabled
      if (options.retryOnFailure && scheduledJob.failureCount < (options.maxRetries || 3)) {
        logger.info(`Retrying scheduled job ${id} in 5 minutes`);
        setTimeout(() => {
          this.executeScheduledJob(id, options);
        }, 5 * 60 * 1000); // Retry in 5 minutes
      }
    }
  }

  async enableJob(id: string): Promise<void> {
    const scheduledJob = this.scheduledJobs.get(id);
    if (!scheduledJob) {
      throw new Error(`Scheduled job not found: ${id}`);
    }

    scheduledJob.enabled = true;

    if (this.isRunning && !this.cronJobs.has(id)) {
      await this.startScheduledJob(id);
    }

    logger.info(`Scheduled job enabled: ${id}`);
  }

  async disableJob(id: string): Promise<void> {
    const scheduledJob = this.scheduledJobs.get(id);
    if (!scheduledJob) {
      throw new Error(`Scheduled job not found: ${id}`);
    }

    scheduledJob.enabled = false;

    const cronJob = this.cronJobs.get(id);
    if (cronJob) {
      cronJob.stop();
      this.cronJobs.delete(id);
    }

    logger.info(`Scheduled job disabled: ${id}`);
  }

  async removeJob(id: string): Promise<void> {
    await this.disableJob(id);
    this.scheduledJobs.delete(id);
    logger.info(`Scheduled job removed: ${id}`);
  }

  getScheduledJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values());
  }

  getScheduledJob(id: string): ScheduledJob | undefined {
    return this.scheduledJobs.get(id);
  }

  getRunningJobs(): string[] {
    return Array.from(this.cronJobs.keys());
  }

  isSchedulerRunning(): boolean {
    return this.isRunning;
  }
}

// Helper function to determine maintenance job type
function getMaintenanceJobType(jobData: any): string {
  if (jobData.type) {
    return `archive-${jobData.type}`;
  }
  return 'maintenance';
}

// Export singleton instance
export const jobScheduler = JobScheduler.getInstance();
export default jobScheduler;