// Webhook signature verification utilities
export {
  WebhookSignatureVerifier,
  type VerificationConfig,
  type VerificationResult,
  type WebhookHeaders
} from './signature-verification.js';

// Express middleware for webhook verification
export {
  createWebhookVerificationMiddleware,
  captureRawBodyMiddleware,
  createSimpleVerifier,
  type WebhookRequest,
  type WebhookMiddlewareOptions
} from './middleware.js';

// Re-export for convenience
export { default as SignatureVerifier } from './signature-verification.js';