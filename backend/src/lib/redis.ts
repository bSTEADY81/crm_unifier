import Redis from 'ioredis';
import { config } from '../config/index.js';
import logger from './logger.js';

class RedisManager {
  private static instance: RedisManager;
  private redisClient: Redis | null = null;
  private subscriberClient: Redis | null = null;
  private publisherClient: Redis | null = null;

  private constructor() {}

  static getInstance(): RedisManager {
    if (!RedisManager.instance) {
      RedisManager.instance = new RedisManager();
    }
    return RedisManager.instance;
  }

  async connect(): Promise<void> {
    try {
      // Parse Redis URL
      const redisUrl = config.redis.url;
      const redisOptions = {
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        family: 4, // IPv4
        connectTimeout: 10000,
        commandTimeout: 5000
      };

      // Main Redis client for general operations
      this.redisClient = new Redis(redisUrl, {
        ...redisOptions,
        connectionName: 'crm-main'
      });

      // Dedicated client for pub/sub subscriptions
      this.subscriberClient = new Redis(redisUrl, {
        ...redisOptions,
        connectionName: 'crm-subscriber'
      });

      // Dedicated client for publishing
      this.publisherClient = new Redis(redisUrl, {
        ...redisOptions,
        connectionName: 'crm-publisher'
      });

      // Set up event handlers
      this.setupEventHandlers(this.redisClient, 'main');
      this.setupEventHandlers(this.subscriberClient, 'subscriber');
      this.setupEventHandlers(this.publisherClient, 'publisher');

      // Connect all clients
      await Promise.all([
        this.redisClient.connect(),
        this.subscriberClient.connect(),
        this.publisherClient.connect()
      ]);

      logger.info('Redis clients connected successfully');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  private setupEventHandlers(client: Redis, name: string): void {
    client.on('connect', () => {
      logger.info(`Redis ${name} client connected`);
    });

    client.on('ready', () => {
      logger.info(`Redis ${name} client ready`);
    });

    client.on('error', (error) => {
      logger.error(`Redis ${name} client error:`, error);
    });

    client.on('close', () => {
      logger.warn(`Redis ${name} client connection closed`);
    });

    client.on('reconnecting', () => {
      logger.info(`Redis ${name} client reconnecting`);
    });
  }

  getClient(): Redis {
    if (!this.redisClient) {
      throw new Error('Redis client not initialized. Call connect() first.');
    }
    return this.redisClient;
  }

  getSubscriberClient(): Redis {
    if (!this.subscriberClient) {
      throw new Error('Redis subscriber client not initialized. Call connect() first.');
    }
    return this.subscriberClient;
  }

  getPublisherClient(): Redis {
    if (!this.publisherClient) {
      throw new Error('Redis publisher client not initialized. Call connect() first.');
    }
    return this.publisherClient;
  }

  async disconnect(): Promise<void> {
    try {
      const clients = [this.redisClient, this.subscriberClient, this.publisherClient];
      await Promise.all(
        clients.map(client => client?.quit())
      );
      
      this.redisClient = null;
      this.subscriberClient = null;
      this.publisherClient = null;
      
      logger.info('All Redis clients disconnected');
    } catch (error) {
      logger.error('Error disconnecting Redis clients:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<{ status: string; latency: number }> {
    try {
      const start = Date.now();
      await this.getClient().ping();
      const latency = Date.now() - start;
      
      return {
        status: 'healthy',
        latency
      };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return {
        status: 'unhealthy',
        latency: -1
      };
    }
  }

  async flushTestDatabase(): Promise<void> {
    // Only allow flushing in test environment
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Database flush only allowed in test environment');
    }
    
    await this.getClient().flushdb();
    logger.info('Test Redis database flushed');
  }
}

// Export singleton instance
export const redisManager = RedisManager.getInstance();

// Helper function to get Redis connection for BullMQ
export function getRedisConnection(): Redis {
  return redisManager.getClient();
}

// Export Redis instance directly for convenience
export { Redis };
export default redisManager;