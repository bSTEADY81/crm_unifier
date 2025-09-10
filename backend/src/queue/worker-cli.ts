#!/usr/bin/env tsx

import { config } from '../config/index.js';
import logger from '../lib/logger.js';
import { redisManager } from '../lib/redis.js';
import { queueWorker } from '../lib/queue/worker.js';
import { queueManager } from '../lib/queue/manager.js';

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.info('Force shutdown initiated');
    process.exit(1);
  }

  isShuttingDown = true;
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    // Stop accepting new jobs
    await queueWorker.stop();
    logger.info('Queue worker stopped');

    // Close queue manager
    await queueManager.shutdown();
    logger.info('Queue manager shutdown');

    // Disconnect from Redis
    await redisManager.disconnect();
    logger.info('Redis disconnected');

    logger.info('Graceful shutdown completed');
    process.exit(0);

  } catch (error) {
    logger.error('Error during graceful shutdown:', error);
    process.exit(1);
  }
}

// Setup signal handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  gracefulShutdown('uncaughtException').catch(() => process.exit(1));
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  gracefulShutdown('unhandledRejection').catch(() => process.exit(1));
});

async function startWorker(): Promise<void> {
  try {
    logger.info('Starting CRM Unifier Queue Worker...');
    logger.info(`Node environment: ${config.node.env}`);
    logger.info(`Redis URL: ${config.redis.url.replace(/\/\/.*@/, '//***@')}`); // Hide credentials

    // Connect to Redis
    await redisManager.connect();
    logger.info('Connected to Redis');

    // Initialize queue manager
    await queueManager.initialize();
    logger.info('Queue manager initialized');

    // Parse concurrency settings from environment
    const concurrency = parseConcurrencySettings();
    logger.info('Worker concurrency settings:', concurrency);

    // Start queue workers
    await queueWorker.start(concurrency);
    logger.info('Queue workers started successfully');

    // Log worker status
    const workerStats = queueWorker.getWorkerStats();
    logger.info('Worker status:', workerStats);

    logger.info('🚀 CRM Unifier Queue Worker is running!');

    // Keep the process alive
    process.on('SIGTERM', () => {});
    process.on('SIGINT', () => {});

  } catch (error) {
    logger.error('Failed to start queue worker:', error);
    process.exit(1);
  }
}

function parseConcurrencySettings() {
  const settings: Record<string, number> = {};
  
  // Read from environment variables
  const webhookConcurrency = parseInt(process.env.WEBHOOK_WORKER_CONCURRENCY || '10');
  const messageConcurrency = parseInt(process.env.MESSAGE_WORKER_CONCURRENCY || '5');
  const notificationConcurrency = parseInt(process.env.NOTIFICATION_WORKER_CONCURRENCY || '3');
  const maintenanceConcurrency = parseInt(process.env.MAINTENANCE_WORKER_CONCURRENCY || '1');
  const healthCheckConcurrency = parseInt(process.env.HEALTH_CHECK_WORKER_CONCURRENCY || '1');

  if (!isNaN(webhookConcurrency)) settings['webhook-ingestion'] = webhookConcurrency;
  if (!isNaN(messageConcurrency)) settings['message-processing'] = messageConcurrency;
  if (!isNaN(notificationConcurrency)) settings['notifications'] = notificationConcurrency;
  if (!isNaN(maintenanceConcurrency)) settings['maintenance'] = maintenanceConcurrency;
  if (!isNaN(healthCheckConcurrency)) settings['health-check'] = healthCheckConcurrency;

  return settings;
}

// Start the worker if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startWorker().catch((error) => {
    logger.error('Worker startup failed:', error);
    process.exit(1);
  });
}