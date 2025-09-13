import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for testing against production deployments
 * Usage: npx playwright test --config=playwright.config.production.ts
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 2,
  workers: 1,
  reporter: [['html', { outputDir: 'test-results/production' }]],
  
  use: {
    // Production frontend URL - update with your Vercel domain
    baseURL: process.env.PRODUCTION_FRONTEND_URL || 'https://crm-unifier-frontend.vercel.app',
    
    // Extended timeout for production testing
    actionTimeout: 10000,
    navigationTimeout: 30000,
    
    // Capture traces for all tests in production
    trace: 'on',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  // Test against production environment
  projects: [
    {
      name: 'production-chrome',
      use: { 
        ...devices['Desktop Chrome'],
        // Simulate production conditions
        ignoreHTTPSErrors: false,
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: 'production-mobile',
      use: { 
        ...devices['Pixel 5'],
        // Mobile production testing
        ignoreHTTPSErrors: false,
      },
    },
  ],

  // Global setup for production testing
  globalSetup: './tests/global-setup.production.ts',
  
  // No local server - testing against deployed services
  timeout: 60000,
});