import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger.js';

const logger = createLogger('prisma');

// Global prisma instance to prevent multiple connections in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [
      { emit: 'event', level: 'query' },
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'info' },
      { emit: 'event', level: 'warn' },
    ],
    errorFormat: 'pretty',
  });

// Log database queries in development
if (process.env.NODE_ENV === 'development') {
  prisma.$on('query', (e) => {
    logger.debug({
      query: e.query,
      params: e.params,
      duration: e.duration,
    }, 'Database query executed');
  });
}

// Log database errors
prisma.$on('error', (e) => {
  logger.error({ target: e.target }, 'Database error occurred');
});

// Log database info
prisma.$on('info', (e) => {
  logger.info({ target: e.target, message: e.message }, 'Database info');
});

// Log database warnings
prisma.$on('warn', (e) => {
  logger.warn({ target: e.target, message: e.message }, 'Database warning');
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
process.on('beforeExit', async () => {
  logger.info('Disconnecting from database...');
  await prisma.$disconnect();
});

export default prisma;