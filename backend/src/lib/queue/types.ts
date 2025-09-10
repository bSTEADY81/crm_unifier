export interface WebhookJobData {
  webhookId: string;
  providerId: string;
  providerType: string;
  timestamp: string;
  payload: Record<string, any>;
  headers: Record<string, string>;
  signature?: string;
  retry?: {
    attempt: number;
    maxAttempts: number;
    previousError?: string;
  };
}

export interface MessageIngestionJobData {
  messageId?: string;
  providerId: string;
  providerMessageId: string;
  providerType: string;
  channel: string;
  payload: Record<string, any>;
  timestamp: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  options?: {
    skipDuplicateCheck?: boolean;
    skipIdentityResolution?: boolean;
    skipThreading?: boolean;
    createNewCustomers?: boolean;
  };
}

export interface NotificationJobData {
  type: 'email' | 'sms' | 'webhook' | 'internal';
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, any>;
  scheduledFor?: string;
}

export interface ArchiveJobData {
  type: 'conversations' | 'messages' | 'audit_events';
  olderThan: string; // ISO date
  batchSize?: number;
  dryRun?: boolean;
}

export interface HealthCheckJobData {
  services: string[];
  notifyOnFailure?: boolean;
  thresholds?: {
    responseTime?: number;
    errorRate?: number;
  };
}

// Job priorities (higher number = higher priority)
export enum JobPriority {
  LOW = 1,
  NORMAL = 5,
  HIGH = 10,
  CRITICAL = 20
}

// Queue names
export const QUEUE_NAMES = {
  WEBHOOK_INGESTION: 'webhook-ingestion',
  MESSAGE_PROCESSING: 'message-processing', 
  NOTIFICATIONS: 'notifications',
  MAINTENANCE: 'maintenance',
  HEALTH_CHECK: 'health-check'
} as const;

export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];

// Job options for different queue types
export interface QueueJobOptions {
  priority?: JobPriority;
  delay?: number; // milliseconds
  attempts?: number;
  backoff?: {
    type: 'fixed' | 'exponential';
    delay: number;
  };
  removeOnComplete?: number;
  removeOnFail?: number;
  jobId?: string;
}

// Default job options by queue type
export const DEFAULT_JOB_OPTIONS: Record<QueueName, QueueJobOptions> = {
  [QUEUE_NAMES.WEBHOOK_INGESTION]: {
    priority: JobPriority.HIGH,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    },
    removeOnComplete: 50,
    removeOnFail: 20
  },
  [QUEUE_NAMES.MESSAGE_PROCESSING]: {
    priority: JobPriority.NORMAL,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 1000
    },
    removeOnComplete: 100,
    removeOnFail: 50
  },
  [QUEUE_NAMES.NOTIFICATIONS]: {
    priority: JobPriority.NORMAL,
    attempts: 3,
    backoff: {
      type: 'fixed',
      delay: 5000
    },
    removeOnComplete: 25,
    removeOnFail: 10
  },
  [QUEUE_NAMES.MAINTENANCE]: {
    priority: JobPriority.LOW,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 30000
    },
    removeOnComplete: 10,
    removeOnFail: 5
  },
  [QUEUE_NAMES.HEALTH_CHECK]: {
    priority: JobPriority.LOW,
    attempts: 2,
    backoff: {
      type: 'fixed',
      delay: 10000
    },
    removeOnComplete: 5,
    removeOnFail: 3
  }
};

// Job result interfaces
export interface WebhookJobResult {
  success: boolean;
  messageId?: string;
  processingTime: number;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  metrics?: {
    stagesCompleted: string[];
    identityResolved: boolean;
    conversationCreated: boolean;
  };
}

export interface MessageIngestionJobResult {
  success: boolean;
  messageId?: string;
  customerId?: string;
  conversationId?: string;
  processingTime: number;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface NotificationJobResult {
  success: boolean;
  deliveryId?: string;
  deliveredAt?: string;
  error?: {
    code: string;
    message: string;
  };
}

export interface QueueMetrics {
  queueName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  throughput?: {
    perSecond: number;
    perMinute: number;
    perHour: number;
  };
  averageProcessingTime?: number;
  failureRate?: number;
}

// Event types emitted by queues
export interface QueueEvents {
  'job:added': { jobId: string; queueName: string; data: any };
  'job:completed': { jobId: string; queueName: string; result: any; duration: number };
  'job:failed': { jobId: string; queueName: string; error: Error; failedReason: string };
  'job:retrying': { jobId: string; queueName: string; attempt: number; error: Error };
  'queue:paused': { queueName: string };
  'queue:resumed': { queueName: string };
  'queue:error': { queueName: string; error: Error };
}

export type QueueEventHandler<T extends keyof QueueEvents> = (data: QueueEvents[T]) => void | Promise<void>;