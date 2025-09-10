import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { createLogger } from './logger.js';

const logger = createLogger('db-utils');

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<{ 
  connected: boolean; 
  latency: number; 
  error?: string;
}> {
  const startTime = Date.now();
  
  try {
    await prisma.$queryRaw`SELECT 1`;
    const latency = Date.now() - startTime;
    
    logger.debug({ latency }, 'Database health check passed');
    
    return {
      connected: true,
      latency
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logger.error({ error: errorMessage, latency }, 'Database health check failed');
    
    return {
      connected: false,
      latency,
      error: errorMessage
    };
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats() {
  try {
    const stats = await prisma.$queryRaw<Array<{
      table_name: string;
      row_count: number;
    }>>`
      SELECT 
        schemaname,
        tablename as table_name,
        n_tup_ins + n_tup_upd + n_tup_del as row_count
      FROM pg_stat_user_tables 
      ORDER BY row_count DESC;
    `;

    return stats;
  } catch (error) {
    logger.error({ error }, 'Failed to get database statistics');
    throw error;
  }
}

/**
 * Execute database transaction with retry logic
 */
export async function executeTransaction<T>(
  fn: (prisma: Prisma.TransactionClient) => Promise<T>,
  maxRetries: number = 3
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        maxWait: 5000, // 5 seconds
        timeout: 10000, // 10 seconds
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');
      
      // Don't retry on certain errors
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        // Don't retry constraint violations, unique violations, etc.
        if (['P2002', 'P2003', 'P2025'].includes(error.code)) {
          throw error;
        }
      }

      if (attempt === maxRetries) {
        break;
      }

      // Exponential backoff
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
      logger.warn(
        { attempt, maxRetries, delay, error: lastError.message },
        'Transaction failed, retrying'
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  logger.error(
    { maxRetries, error: lastError.message },
    'Transaction failed after all retries'
  );
  throw lastError;
}

/**
 * Pagination helper
 */
export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export function getPaginationParams(options: PaginationOptions) {
  const page = Math.max(1, options.page ?? 1);
  const limit = Math.min(100, Math.max(1, options.limit ?? 20));
  const skip = (page - 1) * limit;

  return {
    skip,
    take: limit,
    page,
    limit
  };
}

export function buildPaginationResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): PaginationResult<T> {
  const totalPages = Math.ceil(total / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }
  };
}

/**
 * Search helper for full-text search
 */
export function buildSearchQuery(searchTerm: string): string {
  if (!searchTerm.trim()) {
    return '';
  }

  // Clean and prepare search term for PostgreSQL full-text search
  const cleaned = searchTerm
    .trim()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' & ') + ':*';

  return cleaned;
}