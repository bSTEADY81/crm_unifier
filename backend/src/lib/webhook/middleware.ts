import { Request, Response, NextFunction } from 'express';
import logger from '../logger.js';
import { WebhookSignatureVerifier, VerificationConfig, WebhookHeaders } from './signature-verification.js';

export interface WebhookRequest extends Request {
  webhookVerification?: {
    valid: boolean;
    providerId?: string;
    error?: string;
    timestamp?: number;
  };
  rawBody?: string;
}

export interface WebhookMiddlewareOptions {
  getSecret: (providerId: string, providerType: string) => Promise<string> | string;
  tolerance?: number;
  algorithm?: string;
  encoding?: BufferEncoding;
  skipVerification?: (req: Request) => boolean;
  onVerificationFailure?: (req: WebhookRequest, res: Response, error: string) => void;
}

/**
 * Express middleware for webhook signature verification
 */
export function createWebhookVerificationMiddleware(options: WebhookMiddlewareOptions) {
  return async (req: WebhookRequest, res: Response, next: NextFunction) => {
    try {
      // Skip verification if explicitly requested
      if (options.skipVerification && options.skipVerification(req)) {
        logger.debug('Webhook signature verification skipped', {
          url: req.url,
          method: req.method
        });
        return next();
      }

      // Extract provider information from URL or headers
      const providerInfo = extractProviderInfo(req);
      if (!providerInfo) {
        const error = 'Unable to determine webhook provider';
        logger.warn(error, { url: req.url });
        return handleVerificationFailure(req, res, error, options.onVerificationFailure);
      }

      const { providerId, providerType } = providerInfo;

      // Get the webhook secret
      const secret = await options.getSecret(providerId, providerType);
      if (!secret) {
        const error = `No webhook secret configured for provider ${providerId}`;
        logger.warn(error);
        return handleVerificationFailure(req, res, error, options.onVerificationFailure);
      }

      // Get raw body - should be set by a previous middleware
      const rawBody = req.rawBody || req.body;
      if (!rawBody) {
        const error = 'No raw body available for signature verification';
        logger.warn(error, { url: req.url });
        return handleVerificationFailure(req, res, error, options.onVerificationFailure);
      }

      const payload = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody);

      // Create verification config
      const config: VerificationConfig = {
        secret,
        tolerance: options.tolerance,
        algorithm: options.algorithm,
        encoding: options.encoding
      };

      // Extract headers for verification
      const webhookHeaders: WebhookHeaders = {
        signature: req.headers['signature'] as string,
        'x-signature': req.headers['x-signature'] as string,
        'x-twilio-signature': req.headers['x-twilio-signature'] as string,
        'x-hub-signature-256': req.headers['x-hub-signature-256'] as string,
        'x-slack-signature': req.headers['x-slack-signature'] as string,
        'x-slack-request-timestamp': req.headers['x-slack-request-timestamp'] as string,
        'x-goog-channel-token': req.headers['x-goog-channel-token'] as string,
        authorization: req.headers['authorization'] as string
      };

      // Get full webhook URL for providers that need it (like Twilio)
      const webhookUrl = getFullWebhookUrl(req);

      // Verify the signature
      const verificationResult = WebhookSignatureVerifier.verifyWebhookSignature(
        providerType,
        payload,
        webhookHeaders,
        config,
        webhookUrl
      );

      // Store verification result in request object
      req.webhookVerification = verificationResult;

      if (verificationResult.valid) {
        logger.debug('Webhook signature verified successfully', {
          providerId,
          providerType,
          url: req.url
        });
        return next();
      } else {
        const error = verificationResult.error || 'Signature verification failed';
        logger.warn('Webhook signature verification failed', {
          providerId,
          providerType,
          error,
          url: req.url,
          timestamp: verificationResult.timestamp
        });
        return handleVerificationFailure(req, res, error, options.onVerificationFailure);
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown verification error';
      logger.error('Webhook verification middleware error:', error);
      return handleVerificationFailure(req, res, errorMessage, options.onVerificationFailure);
    }
  };
}

/**
 * Middleware to capture raw body for signature verification
 */
export function captureRawBodyMiddleware(options: { limit?: string } = {}) {
  return (req: WebhookRequest, res: Response, next: NextFunction) => {
    if (req.headers['content-type']?.includes('application/json') ||
        req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
      
      const chunks: Buffer[] = [];
      
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });
      
      req.on('end', () => {
        req.rawBody = Buffer.concat(chunks).toString('utf8');
        next();
      });
      
      req.on('error', (error) => {
        logger.error('Error capturing raw body:', error);
        next(error);
      });
    } else {
      next();
    }
  };
}

/**
 * Extract provider information from request
 */
function extractProviderInfo(req: Request): { providerId: string; providerType: string } | null {
  // Try to extract from URL path
  const urlParts = req.path.split('/');
  const webhookIndex = urlParts.findIndex(part => part === 'webhook' || part === 'webhooks');
  
  if (webhookIndex !== -1 && urlParts.length > webhookIndex + 1) {
    const providerType = urlParts[webhookIndex + 1];
    
    // Extract provider ID from query params or path
    let providerId = req.query.providerId as string || req.params.providerId;
    
    // For some providers, use default IDs
    if (!providerId) {
      switch (providerType.toLowerCase()) {
        case 'twilio':
        case 'twilio-sms':
          providerId = 'twilio-main';
          break;
        case 'whatsapp':
        case 'twilio-whatsapp':
          providerId = 'whatsapp-main';
          break;
        case 'facebook':
          providerId = 'facebook-main';
          break;
        case 'instagram':
          providerId = 'instagram-main';
          break;
        case 'slack':
          providerId = 'slack-main';
          break;
        case 'google':
        case 'gmail':
          providerId = 'gmail-main';
          break;
        default:
          providerId = `${providerType}-main`;
      }
    }
    
    return { providerId, providerType };
  }

  // Try to extract from headers
  const userAgent = req.headers['user-agent']?.toLowerCase() || '';
  if (userAgent.includes('twilio')) {
    return { providerId: 'twilio-main', providerType: 'twilio' };
  }
  if (userAgent.includes('facebook')) {
    return { providerId: 'facebook-main', providerType: 'facebook' };
  }
  if (userAgent.includes('slack')) {
    return { providerId: 'slack-main', providerType: 'slack' };
  }

  // Try to extract from specific headers
  if (req.headers['x-twilio-signature']) {
    return { providerId: 'twilio-main', providerType: 'twilio' };
  }
  if (req.headers['x-hub-signature-256']) {
    // Could be Facebook, WhatsApp, or Instagram
    const referer = req.headers['referer']?.toLowerCase() || '';
    if (referer.includes('whatsapp')) {
      return { providerId: 'whatsapp-main', providerType: 'whatsapp' };
    }
    return { providerId: 'facebook-main', providerType: 'facebook' };
  }
  if (req.headers['x-slack-signature']) {
    return { providerId: 'slack-main', providerType: 'slack' };
  }
  if (req.headers['x-goog-channel-token']) {
    return { providerId: 'gmail-main', providerType: 'google' };
  }

  return null;
}

/**
 * Construct full webhook URL for verification
 */
function getFullWebhookUrl(req: Request): string {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost';
  return `${protocol}://${host}${req.url}`;
}

/**
 * Handle verification failure
 */
function handleVerificationFailure(
  req: WebhookRequest,
  res: Response,
  error: string,
  onFailure?: (req: WebhookRequest, res: Response, error: string) => void
): void {
  if (onFailure) {
    onFailure(req, res, error);
  } else {
    // Default failure response
    res.status(401).json({
      error: 'Webhook signature verification failed',
      message: error,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Create a simple verification function for use in routes
 */
export function createSimpleVerifier(
  getSecret: (providerId: string, providerType: string) => string
) {
  return (providerType: string, payload: string, headers: any, webhookUrl?: string) => {
    const providerId = `${providerType}-main`;
    const secret = getSecret(providerId, providerType);
    
    const config: VerificationConfig = { secret };
    const webhookHeaders: WebhookHeaders = headers;
    
    return WebhookSignatureVerifier.verifyWebhookSignature(
      providerType,
      payload,
      webhookHeaders,
      config,
      webhookUrl
    );
  };
}

export { WebhookSignatureVerifier };