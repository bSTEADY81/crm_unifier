import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for production testing
 * Validates that production services are accessible before running tests
 */
async function globalSetup(_config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Get production URLs from environment or use defaults
  const frontendUrl = process.env['PRODUCTION_FRONTEND_URL'] || 'https://crm-unifier-frontend.vercel.app';
  const backendUrl = process.env['PRODUCTION_BACKEND_URL'] || 'https://crm-unifier-backend.up.railway.app';
  
  console.log('🔍 Validating production services...');
  
  // Test frontend accessibility
  try {
    console.log(`Testing frontend: ${frontendUrl}`);
    const response = await page.goto(frontendUrl, { waitUntil: 'networkidle' });
    if (!response?.ok()) {
      throw new Error(`Frontend not accessible: ${response?.status()}`);
    }
    console.log('✅ Frontend is accessible');
  } catch (error) {
    console.error('❌ Frontend accessibility test failed:', error);
    throw error;
  }

  // Test backend health endpoint
  try {
    console.log(`Testing backend health: ${backendUrl}/health`);
    const response = await page.request.get(`${backendUrl}/health`);
    if (!response.ok()) {
      throw new Error(`Backend health check failed: ${response.status()}`);
    }
    const health = await response.json();
    console.log('✅ Backend health check passed:', health.status);
  } catch (error) {
    console.error('❌ Backend health check failed:', error);
    throw error;
  }

  // Test backend API endpoint
  try {
    console.log(`Testing backend API: ${backendUrl}/api/v1`);
    const response = await page.request.get(`${backendUrl}/api/v1`);
    if (!response.ok()) {
      throw new Error(`Backend API not accessible: ${response.status()}`);
    }
    console.log('✅ Backend API is accessible');
  } catch (error) {
    console.error('❌ Backend API accessibility test failed:', error);
    throw error;
  }

  await browser.close();
  
  console.log('🚀 Production services validated successfully!');
  console.log('📋 Test Configuration:');
  console.log(`   Frontend URL: ${frontendUrl}`);
  console.log(`   Backend URL: ${backendUrl}`);
}

export default globalSetup;