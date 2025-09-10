import { EventEmitter } from 'events';
import { queueManager } from './manager.js';
import { queueWorker } from './worker.js';
import logger from '../logger.js';
import { QueueName, QUEUE_NAMES, QueueMetrics, QueueEvents, QueueEventHandler } from './types.js';

export interface QueueHealthStatus {
  queueName: QueueName;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  metrics: QueueMetrics;
  issues: string[];
  recommendations: string[];
}

export interface SystemHealth {
  overall: 'healthy' | 'warning' | 'critical';
  queues: QueueHealthStatus[];
  worker: {
    isRunning: boolean;
    stats: Record<QueueName, any>;
  };
  timestamp: Date;
}

export class QueueMonitor extends EventEmitter {
  private static instance: QueueMonitor;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private eventHandlers: Map<string, QueueEventHandler<any>> = new Map();

  // Health check thresholds
  private readonly thresholds = {
    failureRate: {
      warning: 0.05, // 5%
      critical: 0.15 // 15%
    },
    queueBacklog: {
      warning: 1000,
      critical: 5000
    },
    stalledJobs: {
      warning: 10,
      critical: 50
    },
    averageProcessingTime: {
      warning: 30000, // 30 seconds
      critical: 120000 // 2 minutes
    }
  };

  private constructor() {
    super();
  }

  static getInstance(): QueueMonitor {
    if (!QueueMonitor.instance) {
      QueueMonitor.instance = new QueueMonitor();
    }
    return QueueMonitor.instance;
  }

  async startMonitoring(intervalMs: number = 30000): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Queue monitoring already active');
      return;
    }

    this.setupEventListeners();
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Error during health check:', error);
        this.emit('error', error);
      }
    }, intervalMs);

    this.isMonitoring = true;
    logger.info(`Queue monitoring started with ${intervalMs}ms interval`);
  }

  async stopMonitoring(): Promise<void> {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.removeEventListeners();
    this.isMonitoring = false;
    logger.info('Queue monitoring stopped');
  }

  private setupEventListeners(): void {
    // Set up event handlers for each queue type
    for (const queueName of Object.values(QUEUE_NAMES)) {
      this.setupQueueEventHandlers(queueName);
    }
  }

  private removeEventListeners(): void {
    // Clean up event handlers
    this.eventHandlers.clear();
  }

  private setupQueueEventHandlers(queueName: QueueName): void {
    const completedHandler: QueueEventHandler<'job:completed'> = (data) => {
      logger.debug(`Job completed monitoring event`, data);
      this.emit('job:completed', data);
    };

    const failedHandler: QueueEventHandler<'job:failed'> = (data) => {
      logger.warn(`Job failed monitoring event`, data);
      this.emit('job:failed', data);
      
      // Check if we need to trigger alerts
      this.checkFailureThresholds(queueName, data);
    };

    const retryHandler: QueueEventHandler<'job:retrying'> = (data) => {
      logger.info(`Job retrying monitoring event`, data);
      this.emit('job:retrying', data);
    };

    // Store handlers for cleanup
    this.eventHandlers.set(`${queueName}:completed`, completedHandler);
    this.eventHandlers.set(`${queueName}:failed`, failedHandler);
    this.eventHandlers.set(`${queueName}:retrying`, retryHandler);
  }

  private async checkFailureThresholds(queueName: QueueName, failureData: any): Promise<void> {
    try {
      const metrics = await queueManager.getQueueMetrics(queueName);
      const failureRate = metrics.failed / (metrics.completed + metrics.failed);
      
      if (failureRate >= this.thresholds.failureRate.critical) {
        this.emit('alert:critical', {
          type: 'high_failure_rate',
          queueName,
          failureRate,
          threshold: this.thresholds.failureRate.critical,
          failureData
        });
      } else if (failureRate >= this.thresholds.failureRate.warning) {
        this.emit('alert:warning', {
          type: 'elevated_failure_rate',
          queueName,
          failureRate,
          threshold: this.thresholds.failureRate.warning,
          failureData
        });
      }
    } catch (error) {
      logger.error('Error checking failure thresholds:', error);
    }
  }

  async performHealthCheck(): Promise<SystemHealth> {
    try {
      // Get metrics for all queues
      const allMetrics = await queueManager.getAllQueueMetrics();
      
      // Get worker status
      const workerStats = queueWorker.getWorkerStats();
      const isWorkerRunning = queueWorker.isWorkerRunning();

      // Analyze health for each queue
      const queueHealthStatuses = await Promise.all(
        allMetrics.map(metrics => this.analyzeQueueHealth(metrics))
      );

      // Determine overall system health
      const overallHealth = this.determineOverallHealth(queueHealthStatuses, isWorkerRunning);

      const systemHealth: SystemHealth = {
        overall: overallHealth,
        queues: queueHealthStatuses,
        worker: {
          isRunning: isWorkerRunning,
          stats: workerStats
        },
        timestamp: new Date()
      };

      // Emit health check result
      this.emit('health:check', systemHealth);

      // Check for alerts
      this.checkHealthAlerts(systemHealth);

      return systemHealth;

    } catch (error) {
      logger.error('Health check failed:', error);
      throw error;
    }
  }

  private async analyzeQueueHealth(metrics: QueueMetrics): Promise<QueueHealthStatus> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';

    // Check queue backlog
    const totalBacklog = metrics.waiting + metrics.delayed;
    if (totalBacklog >= this.thresholds.queueBacklog.critical) {
      status = 'critical';
      issues.push(`Critical queue backlog: ${totalBacklog} jobs`);
      recommendations.push('Consider increasing worker concurrency or scaling workers');
    } else if (totalBacklog >= this.thresholds.queueBacklog.warning) {
      status = status === 'critical' ? 'critical' : 'warning';
      issues.push(`High queue backlog: ${totalBacklog} jobs`);
      recommendations.push('Monitor queue processing rate');
    }

    // Check failure rate
    const total = metrics.completed + metrics.failed;
    if (total > 0) {
      const failureRate = metrics.failed / total;
      if (failureRate >= this.thresholds.failureRate.critical) {
        status = 'critical';
        issues.push(`Critical failure rate: ${(failureRate * 100).toFixed(1)}%`);
        recommendations.push('Investigate job failures and fix underlying issues');
      } else if (failureRate >= this.thresholds.failureRate.warning) {
        status = status === 'critical' ? 'critical' : 'warning';
        issues.push(`Elevated failure rate: ${(failureRate * 100).toFixed(1)}%`);
        recommendations.push('Monitor error patterns and consider improving error handling');
      }
    }

    // Check if queue is paused
    if (metrics.paused) {
      status = 'critical';
      issues.push('Queue is paused');
      recommendations.push('Resume queue processing');
    }

    // Check average processing time (if available)
    if (metrics.averageProcessingTime) {
      if (metrics.averageProcessingTime >= this.thresholds.averageProcessingTime.critical) {
        status = 'critical';
        issues.push(`Very slow processing: ${Math.round(metrics.averageProcessingTime / 1000)}s average`);
        recommendations.push('Optimize job processing logic or increase resources');
      } else if (metrics.averageProcessingTime >= this.thresholds.averageProcessingTime.warning) {
        status = status === 'critical' ? 'critical' : 'warning';
        issues.push(`Slow processing: ${Math.round(metrics.averageProcessingTime / 1000)}s average`);
        recommendations.push('Monitor processing performance');
      }
    }

    return {
      queueName: metrics.queueName as QueueName,
      status,
      metrics,
      issues,
      recommendations
    };
  }

  private determineOverallHealth(
    queueHealthStatuses: QueueHealthStatus[],
    isWorkerRunning: boolean
  ): 'healthy' | 'warning' | 'critical' {
    // If worker is not running, system is critical
    if (!isWorkerRunning) {
      return 'critical';
    }

    // Check queue statuses
    const criticalQueues = queueHealthStatuses.filter(q => q.status === 'critical');
    const warningQueues = queueHealthStatuses.filter(q => q.status === 'warning');

    if (criticalQueues.length > 0) {
      return 'critical';
    }

    if (warningQueues.length > 0) {
      return 'warning';
    }

    return 'healthy';
  }

  private checkHealthAlerts(systemHealth: SystemHealth): void {
    // Emit alerts based on system health
    if (systemHealth.overall === 'critical') {
      this.emit('alert:critical', {
        type: 'system_health',
        message: 'System health is critical',
        details: systemHealth
      });
    } else if (systemHealth.overall === 'warning') {
      this.emit('alert:warning', {
        type: 'system_health',
        message: 'System health needs attention',
        details: systemHealth
      });
    }

    // Check for specific queue issues
    for (const queueHealth of systemHealth.queues) {
      if (queueHealth.status === 'critical') {
        this.emit('alert:critical', {
          type: 'queue_health',
          queueName: queueHealth.queueName,
          message: `Queue ${queueHealth.queueName} is in critical state`,
          issues: queueHealth.issues,
          recommendations: queueHealth.recommendations
        });
      }
    }

    // Check worker status
    if (!systemHealth.worker.isRunning) {
      this.emit('alert:critical', {
        type: 'worker_down',
        message: 'Queue worker is not running',
        recommendations: ['Restart the queue worker service']
      });
    }
  }

  // Manual controls for queue management
  async pauseQueue(queueName: QueueName): Promise<void> {
    await queueManager.pauseQueue(queueName);
    await queueWorker.pause(queueName);
    
    this.emit('queue:paused', { queueName });
    logger.info(`Queue ${queueName} paused via monitor`);
  }

  async resumeQueue(queueName: QueueName): Promise<void> {
    await queueManager.resumeQueue(queueName);
    await queueWorker.resume(queueName);
    
    this.emit('queue:resumed', { queueName });
    logger.info(`Queue ${queueName} resumed via monitor`);
  }

  async retryFailedJobs(queueName: QueueName, limit: number = 100): Promise<number> {
    const retriedCount = await queueManager.retryFailedJobs(queueName, limit);
    
    this.emit('jobs:retried', { queueName, count: retriedCount });
    logger.info(`Retried ${retriedCount} failed jobs in queue ${queueName}`);
    
    return retriedCount;
  }

  async clearQueue(queueName: QueueName, status: 'completed' | 'failed' | 'active' | 'waiting' = 'completed'): Promise<void> {
    await queueManager.clearQueue(queueName, status);
    
    this.emit('queue:cleared', { queueName, status });
    logger.info(`Cleared ${status} jobs from queue ${queueName}`);
  }

  getMonitoringStatus(): { isMonitoring: boolean; intervalMs?: number } {
    return {
      isMonitoring: this.isMonitoring,
      intervalMs: this.monitoringInterval ? 30000 : undefined // Default interval
    };
  }
}

// Export singleton instance
export const queueMonitor = QueueMonitor.getInstance();
export default queueMonitor;