import { describe, it, expect, vi } from 'vitest';
import crypto from 'crypto';
import { WebhookSignatureVerifier } from '../../../src/lib/webhook/signature-verification.js';
// Mock logger
vi.mock('../../../src/lib/logger.js', () => ({
    default: {
        debug: vi.fn(),
        error: vi.fn()
    }
}));
describe('WebhookSignatureVerifier', () => {
    const testSecret = 'test-secret-key-12345';
    const testPayload = '{"message": "Hello, World!", "timestamp": 1234567890}';
    const testUrl = 'https://example.com/webhook/twilio';
    describe('verifyTwilioSignature', () => {
        it('should verify valid Twilio signature', () => {
            // Generate expected Twilio signature
            const expectedSignature = crypto
                .createHmac('sha1', testSecret)
                .update(testUrl + testPayload, 'utf8')
                .digest('base64');
            const config = { secret: testSecret };
            const result = WebhookSignatureVerifier.verifyTwilioSignature(testUrl, testPayload, expectedSignature, config);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.providerId).toBe('twilio');
        });
        it('should reject invalid Twilio signature', () => {
            const invalidSignature = 'invalid-signature';
            const config = { secret: testSecret };
            const result = WebhookSignatureVerifier.verifyTwilioSignature(testUrl, testPayload, invalidSignature, config);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid signature');
            expect(result.providerId).toBe('twilio');
        });
        it('should reject missing signature', () => {
            const config = { secret: testSecret };
            const result = WebhookSignatureVerifier.verifyTwilioSignature(testUrl, testPayload, '', config);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Missing X-Twilio-Signature header');
        });
    });
    describe('verifyWhatsAppSignature', () => {
        it('should verify valid WhatsApp signature', () => {
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(testPayload, 'utf8')
                .digest('hex');
            const config = { secret: testSecret };
            const result = WebhookSignatureVerifier.verifyWhatsAppSignature(testPayload, `sha256=${expectedSignature}`, config);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.providerId).toBe('whatsapp');
        });
        it('should verify signature without sha256 prefix', () => {
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(testPayload, 'utf8')
                .digest('hex');
            const config = { secret: testSecret };
            const result = WebhookSignatureVerifier.verifyWhatsAppSignature(testPayload, expectedSignature, config);
            expect(result.valid).toBe(true);
        });
        it('should reject invalid WhatsApp signature', () => {
            const config = { secret: testSecret };
            const result = WebhookSignatureVerifier.verifyWhatsAppSignature(testPayload, 'sha256=invalid-signature', config);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid signature');
        });
    });
    describe('verifySlackSignature', () => {
        it('should verify valid Slack signature', () => {
            const timestamp = Math.floor(Date.now() / 1000);
            const signingString = `v0:${timestamp}:${testPayload}`;
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(signingString, 'utf8')
                .digest('hex');
            const config = { secret: testSecret, tolerance: 300 };
            const headers = {
                'x-slack-signature': `v0=${expectedSignature}`,
                'x-slack-request-timestamp': timestamp.toString()
            };
            const result = WebhookSignatureVerifier.verifySlackSignature(testPayload, headers, config);
            expect(result.valid).toBe(true);
            expect(result.error).toBeUndefined();
            expect(result.timestamp).toBe(timestamp);
        });
        it('should reject expired Slack signature', () => {
            const oldTimestamp = Math.floor(Date.now() / 1000) - 400; // 400 seconds ago
            const signingString = `v0:${oldTimestamp}:${testPayload}`;
            const signature = crypto
                .createHmac('sha256', testSecret)
                .update(signingString, 'utf8')
                .digest('hex');
            const config = { secret: testSecret, tolerance: 300 };
            const headers = {
                'x-slack-signature': `v0=${signature}`,
                'x-slack-request-timestamp': oldTimestamp.toString()
            };
            const result = WebhookSignatureVerifier.verifySlackSignature(testPayload, headers, config);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Request too old');
        });
        it('should reject missing timestamp', () => {
            const config = { secret: testSecret };
            const headers = {
                'x-slack-signature': 'v0=somesignature'
            };
            const result = WebhookSignatureVerifier.verifySlackSignature(testPayload, headers, config);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Missing X-Slack-Request-Timestamp header');
        });
    });
    describe('verifyGoogleSignature', () => {
        it('should verify valid Google token', () => {
            const config = { secret: 'google-channel-token' };
            const headers = {
                'x-goog-channel-token': 'google-channel-token'
            };
            const result = WebhookSignatureVerifier.verifyGoogleSignature(testPayload, headers, config);
            expect(result.valid).toBe(true);
            expect(result.providerId).toBe('google');
        });
        it('should reject invalid Google token', () => {
            const config = { secret: 'correct-token' };
            const headers = {
                'x-goog-channel-token': 'wrong-token'
            };
            const result = WebhookSignatureVerifier.verifyGoogleSignature(testPayload, headers, config);
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Invalid token');
        });
    });
    describe('verifyHMACSignature', () => {
        it('should verify SHA256 HMAC signature', () => {
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(testPayload, 'utf8')
                .digest('hex');
            const config = {
                secret: testSecret,
                algorithm: 'sha256',
                encoding: 'hex'
            };
            const result = WebhookSignatureVerifier.verifyHMACSignature(testPayload, expectedSignature, config, 'test-provider');
            expect(result.valid).toBe(true);
            expect(result.providerId).toBe('test-provider');
        });
        it('should verify signature with sha256= prefix', () => {
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(testPayload, 'utf8')
                .digest('hex');
            const config = { secret: testSecret };
            const result = WebhookSignatureVerifier.verifyHMACSignature(testPayload, `sha256=${expectedSignature}`, config);
            expect(result.valid).toBe(true);
        });
        it('should verify base64 encoded signature', () => {
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(testPayload, 'utf8')
                .digest('base64');
            const config = {
                secret: testSecret,
                algorithm: 'sha256',
                encoding: 'base64'
            };
            const result = WebhookSignatureVerifier.verifyHMACSignature(testPayload, expectedSignature, config);
            expect(result.valid).toBe(true);
        });
    });
    describe('verifyWebhookSignature', () => {
        it('should route Twilio verification correctly', () => {
            const expectedSignature = crypto
                .createHmac('sha1', testSecret)
                .update(testUrl + testPayload, 'utf8')
                .digest('base64');
            const config = { secret: testSecret };
            const headers = { 'x-twilio-signature': expectedSignature };
            const result = WebhookSignatureVerifier.verifyWebhookSignature('twilio', testPayload, headers, config, testUrl);
            expect(result.valid).toBe(true);
            expect(result.providerId).toBe('twilio');
        });
        it('should route WhatsApp verification correctly', () => {
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(testPayload, 'utf8')
                .digest('hex');
            const config = { secret: testSecret };
            const headers = { 'x-hub-signature-256': `sha256=${expectedSignature}` };
            const result = WebhookSignatureVerifier.verifyWebhookSignature('whatsapp', testPayload, headers, config);
            expect(result.valid).toBe(true);
            expect(result.providerId).toBe('whatsapp');
        });
        it('should fallback to generic HMAC for unknown providers', () => {
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(testPayload, 'utf8')
                .digest('hex');
            const config = { secret: testSecret };
            const headers = { signature: expectedSignature };
            const result = WebhookSignatureVerifier.verifyWebhookSignature('custom-provider', testPayload, headers, config);
            expect(result.valid).toBe(true);
            expect(result.providerId).toBe('custom-provider');
        });
        it('should require webhook URL for Twilio', () => {
            const config = { secret: testSecret };
            const headers = { 'x-twilio-signature': 'some-signature' };
            const result = WebhookSignatureVerifier.verifyWebhookSignature('twilio', testPayload, headers, config
            // No webhookUrl provided
            );
            expect(result.valid).toBe(false);
            expect(result.error).toBe('Webhook URL required for Twilio verification');
        });
    });
    describe('generateSignature', () => {
        it('should generate Twilio signature', () => {
            const signature = WebhookSignatureVerifier.generateSignature('twilio', testPayload, testSecret, { url: testUrl });
            const expectedSignature = crypto
                .createHmac('sha1', testSecret)
                .update(testUrl + testPayload, 'utf8')
                .digest('base64');
            expect(signature).toBe(expectedSignature);
        });
        it('should generate WhatsApp signature', () => {
            const signature = WebhookSignatureVerifier.generateSignature('whatsapp', testPayload, testSecret);
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(testPayload, 'utf8')
                .digest('hex');
            expect(signature).toBe(`sha256=${expectedSignature}`);
        });
        it('should generate Slack signature', () => {
            const timestamp = Math.floor(Date.now() / 1000);
            const signature = WebhookSignatureVerifier.generateSignature('slack', testPayload, testSecret, { timestamp });
            const signingString = `v0:${timestamp}:${testPayload}`;
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(signingString, 'utf8')
                .digest('hex');
            expect(signature).toBe(`v0=${expectedSignature}`);
        });
        it('should generate generic signature', () => {
            const signature = WebhookSignatureVerifier.generateSignature('custom-provider', testPayload, testSecret, { algorithm: 'sha256', encoding: 'hex' });
            const expectedSignature = crypto
                .createHmac('sha256', testSecret)
                .update(testPayload, 'utf8')
                .digest('hex');
            expect(signature).toBe(expectedSignature);
        });
        it('should throw error when URL required but not provided', () => {
            expect(() => {
                WebhookSignatureVerifier.generateSignature('twilio', testPayload, testSecret
                // No URL provided
                );
            }).toThrow('URL required for Twilio signature generation');
        });
    });
    describe('edge cases and error handling', () => {
        it('should handle empty payload', () => {
            const config = { secret: testSecret };
            const signature = crypto
                .createHmac('sha256', testSecret)
                .update('', 'utf8')
                .digest('hex');
            const result = WebhookSignatureVerifier.verifyHMACSignature('', signature, config);
            expect(result.valid).toBe(true);
        });
        it('should handle Unicode payloads', () => {
            const unicodePayload = '{"message": "Hello 世界! 🌍", "emoji": "😀"}';
            const config = { secret: testSecret };
            const signature = crypto
                .createHmac('sha256', testSecret)
                .update(unicodePayload, 'utf8')
                .digest('hex');
            const result = WebhookSignatureVerifier.verifyHMACSignature(unicodePayload, signature, config);
            expect(result.valid).toBe(true);
        });
        it('should handle malformed hex signature gracefully', () => {
            const config = { secret: testSecret };
            const result = WebhookSignatureVerifier.verifyHMACSignature(testPayload, 'not-valid-hex', config);
            expect(result.valid).toBe(false);
        });
    });
});
//# sourceMappingURL=signature-verification.test.js.map