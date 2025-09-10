import crypto from 'crypto';
import logger from '../logger.js';

export interface VerificationConfig {
  secret: string;
  tolerance?: number; // in seconds, for timestamp verification
  algorithm?: string; // default: 'sha256'
  encoding?: BufferEncoding; // default: 'hex'
}

export interface VerificationResult {
  valid: boolean;
  error?: string;
  timestamp?: number;
  providerId?: string;
}

export interface WebhookHeaders {
  signature?: string;
  timestamp?: string;
  [key: string]: string | undefined;
}

export class WebhookSignatureVerifier {
  private static readonly DEFAULT_TOLERANCE = 300; // 5 minutes
  private static readonly DEFAULT_ALGORITHM = 'sha256';
  private static readonly DEFAULT_ENCODING: BufferEncoding = 'hex';

  /**
   * Verify Twilio webhook signature
   * Twilio uses: X-Twilio-Signature = base64(sha1(url + postBody, secret))
   */
  static verifyTwilioSignature(
    url: string,
    payload: string,
    receivedSignature: string,
    config: VerificationConfig
  ): VerificationResult {
    try {
      if (!receivedSignature) {
        return { valid: false, error: 'Missing X-Twilio-Signature header' };
      }

      // Twilio uses SHA1, not SHA256
      const expectedSignature = crypto
        .createHmac('sha1', config.secret)
        .update(url + payload, 'utf8')
        .digest('base64');

      const isValid = receivedSignature.length === expectedSignature.length &&
        crypto.timingSafeEqual(
          Buffer.from(receivedSignature),
          Buffer.from(expectedSignature)
        );

      logger.debug('Twilio signature verification', {
        url: url.replace(/\?.+/, ''), // Remove query params for logging
        payloadLength: payload.length,
        isValid,
        expectedSignature: expectedSignature.substring(0, 10) + '...',
        receivedSignature: receivedSignature.substring(0, 10) + '...'
      });

      return {
        valid: isValid,
        error: isValid ? undefined : 'Invalid signature',
        providerId: 'twilio'
      };

    } catch (error) {
      logger.error('Twilio signature verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
        providerId: 'twilio'
      };
    }
  }

  /**
   * Verify WhatsApp Business webhook signature (also from Meta/Facebook)
   * Uses: X-Hub-Signature-256 = sha256=hex(hmac_sha256(secret, body))
   */
  static verifyWhatsAppSignature(
    payload: string,
    receivedSignature: string,
    config: VerificationConfig
  ): VerificationResult {
    try {
      if (!receivedSignature) {
        return { valid: false, error: 'Missing X-Hub-Signature-256 header' };
      }

      // Remove 'sha256=' prefix if present
      const cleanSignature = receivedSignature.replace(/^sha256=/, '');

      const expectedSignature = crypto
        .createHmac('sha256', config.secret)
        .update(payload, 'utf8')
        .digest('hex');

      const isValid = cleanSignature.length === expectedSignature.length &&
        crypto.timingSafeEqual(
          Buffer.from(cleanSignature, 'hex'),
          Buffer.from(expectedSignature, 'hex')
        );

      logger.debug('WhatsApp signature verification', {
        payloadLength: payload.length,
        isValid,
        expectedSignature: expectedSignature.substring(0, 10) + '...',
        receivedSignature: cleanSignature.substring(0, 10) + '...'
      });

      return {
        valid: isValid,
        error: isValid ? undefined : 'Invalid signature',
        providerId: 'whatsapp'
      };

    } catch (error) {
      logger.error('WhatsApp signature verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
        providerId: 'whatsapp'
      };
    }
  }

  /**
   * Verify Facebook/Instagram webhook signature
   * Uses same format as WhatsApp: X-Hub-Signature-256
   */
  static verifyFacebookSignature(
    payload: string,
    receivedSignature: string,
    config: VerificationConfig
  ): VerificationResult {
    const result = this.verifyWhatsAppSignature(payload, receivedSignature, config);
    return { ...result, providerId: 'facebook' };
  }

  /**
   * Verify Gmail/Google webhook signature (for Gmail API push notifications)
   * Uses JWT tokens in X-Goog-Channel-Token header
   */
  static verifyGoogleSignature(
    payload: string,
    headers: WebhookHeaders,
    config: VerificationConfig
  ): VerificationResult {
    try {
      const channelToken = headers['x-goog-channel-token'];
      if (!channelToken) {
        return { valid: false, error: 'Missing X-Goog-Channel-Token header' };
      }

      // Simple token comparison for now
      // In production, you might want to implement JWT verification
      const isValid = channelToken.length === config.secret.length &&
        crypto.timingSafeEqual(
          Buffer.from(channelToken),
          Buffer.from(config.secret)
        );

      logger.debug('Google signature verification', {
        payloadLength: payload.length,
        isValid,
        hasToken: !!channelToken
      });

      return {
        valid: isValid,
        error: isValid ? undefined : 'Invalid token',
        providerId: 'google'
      };

    } catch (error) {
      logger.error('Google signature verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
        providerId: 'google'
      };
    }
  }

  /**
   * Verify Slack webhook signature
   * Uses: X-Slack-Signature = v0=hex(hmac_sha256(secret, version:timestamp:body))
   */
  static verifySlackSignature(
    payload: string,
    headers: WebhookHeaders,
    config: VerificationConfig
  ): VerificationResult {
    try {
      const receivedSignature = headers['x-slack-signature'];
      const timestamp = headers['x-slack-request-timestamp'];

      if (!receivedSignature) {
        return { valid: false, error: 'Missing X-Slack-Signature header' };
      }

      if (!timestamp) {
        return { valid: false, error: 'Missing X-Slack-Request-Timestamp header' };
      }

      // Check timestamp tolerance
      const currentTime = Math.floor(Date.now() / 1000);
      const requestTime = parseInt(timestamp);
      const tolerance = config.tolerance || this.DEFAULT_TOLERANCE;

      if (Math.abs(currentTime - requestTime) > tolerance) {
        return { 
          valid: false, 
          error: `Request too old (${currentTime - requestTime}s)`,
          timestamp: requestTime
        };
      }

      // Remove 'v0=' prefix
      const cleanSignature = receivedSignature.replace(/^v0=/, '');

      // Create signing string: version:timestamp:body
      const signingString = `v0:${timestamp}:${payload}`;

      const expectedSignature = crypto
        .createHmac('sha256', config.secret)
        .update(signingString, 'utf8')
        .digest('hex');

      const isValid = crypto.timingSafeEqual(
        Buffer.from(cleanSignature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );

      logger.debug('Slack signature verification', {
        payloadLength: payload.length,
        timestamp: requestTime,
        timeDiff: currentTime - requestTime,
        isValid,
        expectedSignature: expectedSignature.substring(0, 10) + '...',
        receivedSignature: cleanSignature.substring(0, 10) + '...'
      });

      return {
        valid: isValid,
        error: isValid ? undefined : 'Invalid signature',
        timestamp: requestTime,
        providerId: 'slack'
      };

    } catch (error) {
      logger.error('Slack signature verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
        providerId: 'slack'
      };
    }
  }

  /**
   * Generic HMAC signature verification
   * Supports various algorithms and encodings
   */
  static verifyHMACSignature(
    payload: string,
    receivedSignature: string,
    config: VerificationConfig,
    providerId?: string
  ): VerificationResult {
    try {
      if (!receivedSignature) {
        return { valid: false, error: 'Missing signature header' };
      }

      const algorithm = config.algorithm || this.DEFAULT_ALGORITHM;
      const encoding = config.encoding || this.DEFAULT_ENCODING;

      // Clean signature (remove common prefixes)
      const cleanSignature = receivedSignature
        .replace(/^sha256=/, '')
        .replace(/^sha1=/, '')
        .replace(/^hmac-/, '');

      const expectedSignature = crypto
        .createHmac(algorithm, config.secret)
        .update(payload, 'utf8')
        .digest(encoding);

      let isValid = false;
      try {
        if (encoding === 'hex') {
          isValid = crypto.timingSafeEqual(
            Buffer.from(cleanSignature, 'hex'),
            Buffer.from(expectedSignature, 'hex')
          );
        } else {
          isValid = crypto.timingSafeEqual(
            Buffer.from(cleanSignature, encoding),
            Buffer.from(expectedSignature, encoding)
          );
        }
      } catch (bufferError) {
        // Fallback to string comparison if buffer conversion fails
        isValid = crypto.timingSafeEqual(
          Buffer.from(cleanSignature),
          Buffer.from(expectedSignature)
        );
      }

      logger.debug('Generic HMAC signature verification', {
        algorithm,
        encoding,
        payloadLength: payload.length,
        providerId,
        isValid,
        expectedSignature: expectedSignature.substring(0, 10) + '...',
        receivedSignature: cleanSignature.substring(0, 10) + '...'
      });

      return {
        valid: isValid,
        error: isValid ? undefined : 'Invalid signature',
        providerId
      };

    } catch (error) {
      logger.error('Generic HMAC signature verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
        providerId
      };
    }
  }

  /**
   * Verify webhook signature based on provider type
   * Routes to the appropriate verification method
   */
  static verifyWebhookSignature(
    providerType: string,
    payload: string,
    headers: WebhookHeaders,
    config: VerificationConfig,
    webhookUrl?: string
  ): VerificationResult {
    try {
      switch (providerType.toLowerCase()) {
        case 'twilio':
        case 'twilio-sms':
          if (!webhookUrl) {
            return { valid: false, error: 'Webhook URL required for Twilio verification' };
          }
          return this.verifyTwilioSignature(
            webhookUrl,
            payload,
            headers['x-twilio-signature'] || '',
            config
          );

        case 'whatsapp':
        case 'twilio-whatsapp':
          return this.verifyWhatsAppSignature(
            payload,
            headers['x-hub-signature-256'] || '',
            config
          );

        case 'facebook':
        case 'instagram':
          return this.verifyFacebookSignature(
            payload,
            headers['x-hub-signature-256'] || '',
            config
          );

        case 'google':
        case 'gmail':
          return this.verifyGoogleSignature(payload, headers, config);

        case 'slack':
          return this.verifySlackSignature(payload, headers, config);

        default:
          // Fallback to generic HMAC verification
          const signature = headers['signature'] || 
                            headers['x-signature'] || 
                            headers['x-hub-signature-256'] ||
                            headers['authorization'] ||
                            '';
          
          return this.verifyHMACSignature(payload, signature, config, providerType);
      }

    } catch (error) {
      logger.error('Webhook signature verification error:', error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : 'Unknown verification error',
        providerId: providerType
      };
    }
  }

  /**
   * Generate webhook signature for testing purposes
   */
  static generateSignature(
    providerType: string,
    payload: string,
    secret: string,
    options: {
      url?: string;
      timestamp?: number;
      algorithm?: string;
      encoding?: BufferEncoding;
    } = {}
  ): string {
    try {
      switch (providerType.toLowerCase()) {
        case 'twilio':
        case 'twilio-sms':
          if (!options.url) {
            throw new Error('URL required for Twilio signature generation');
          }
          return crypto
            .createHmac('sha1', secret)
            .update(options.url + payload, 'utf8')
            .digest('base64');

        case 'whatsapp':
        case 'facebook':
        case 'instagram':
          const whatsappSignature = crypto
            .createHmac('sha256', secret)
            .update(payload, 'utf8')
            .digest('hex');
          return `sha256=${whatsappSignature}`;

        case 'slack':
          const timestamp = options.timestamp || Math.floor(Date.now() / 1000);
          const signingString = `v0:${timestamp}:${payload}`;
          const slackSignature = crypto
            .createHmac('sha256', secret)
            .update(signingString, 'utf8')
            .digest('hex');
          return `v0=${slackSignature}`;

        default:
          const algorithm = options.algorithm || 'sha256';
          const encoding = options.encoding || 'hex';
          return crypto
            .createHmac(algorithm, secret)
            .update(payload, 'utf8')
            .digest(encoding);
      }

    } catch (error) {
      logger.error('Signature generation error:', error);
      throw error;
    }
  }
}

export default WebhookSignatureVerifier;