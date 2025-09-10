import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables - Railway provides them directly, .env for local development
try {
  dotenv.config();
} catch (error) {
  // Railway doesn't need .env file, variables are provided directly
  console.log('No .env file found, using environment variables from Railway');
}

// Debug: Log which critical env vars are available (without values for security)
console.log('Environment check:', {
  hasDatabase: !!process.env.DATABASE_URL,
  databaseLength: process.env.DATABASE_URL?.length,
  hasRedis: !!process.env.REDIS_URL,
  redisLength: process.env.REDIS_URL?.length,
  hasJwtSecret: !!process.env.JWT_SECRET,
  jwtSecretLength: process.env.JWT_SECRET?.length,
  hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
  nextAuthSecretLength: process.env.NEXTAUTH_SECRET?.length,
  hasPiiKey: !!process.env.PII_ENCRYPTION_KEY,
  piiKeyLength: process.env.PII_ENCRYPTION_KEY?.length,
  nodeEnv: process.env.NODE_ENV,
  port: process.env.PORT
});

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3001').transform(Number),
  
  // Database - more flexible validation for PostgreSQL URLs with encoded chars
  DATABASE_URL: z.string().min(10),
  DATABASE_URL_TEST: z.string().url().optional(),
  
  // Redis - more flexible validation for Redis URLs
  REDIS_URL: z.string().min(10),
  REDIS_URL_TEST: z.string().url().optional(),
  
  // Auth
  NEXTAUTH_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  
  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  
  // Rate limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('900000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('100').transform(Number),
  
  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),
  
  // Webhook
  WEBHOOK_BASE_URL: z.string().url().optional(),
  
  // Audit
  AUDIT_RETENTION_DAYS: z.string().default('2555').transform(Number),
  PII_ENCRYPTION_KEY: z.string().min(32).optional(),
});

const env = configSchema.parse(process.env);

export const config = {
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  
  database: {
    url: env.DATABASE_URL,
    testUrl: env.DATABASE_URL_TEST || env.DATABASE_URL.replace('crm_unifier', 'crm_unifier_test')
  },
  
  redis: {
    url: env.REDIS_URL,
    testUrl: env.REDIS_URL_TEST || env.REDIS_URL.replace('6379', '6380')
  },
  
  auth: {
    nextAuthSecret: env.NEXTAUTH_SECRET,
    jwtSecret: env.JWT_SECRET
  },
  
  cors: {
    origins: env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  },
  
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS
  },
  
  logging: {
    level: env.LOG_LEVEL,
    format: env.LOG_FORMAT
  },
  
  webhook: {
    baseUrl: env.WEBHOOK_BASE_URL
  },
  
  audit: {
    retentionDays: env.AUDIT_RETENTION_DAYS,
    piiEncryptionKey: env.PII_ENCRYPTION_KEY
  }
};