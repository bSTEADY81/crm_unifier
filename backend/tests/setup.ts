import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { config } from '../src/config/index.js';
import { resetTestData, prisma } from './utils/db.js';

// Global test setup
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Use test database URLs
  if (config.nodeEnv === 'test') {
    process.env.DATABASE_URL = config.database.testUrl;
    process.env.REDIS_URL = config.redis.testUrl;
  }
});

afterAll(async () => {
  // Clean up test data and disconnect
  await resetTestData();
  await prisma.$disconnect();
});

beforeEach(async () => {
  // Skip cleanup for contract tests that manage their own data
  const testPath = expect.getState().testPath;
  const isContractTest = testPath && testPath.includes('/contract/');
  
  if (!isContractTest) {
    // Clean test data before each test for isolation
    await resetTestData();
  }
});

afterEach(async () => {
  // Additional cleanup after each test if needed
});