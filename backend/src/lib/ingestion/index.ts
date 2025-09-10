// Main ingestion library exports
export * from './types.js';
export * from './schemas.js';

// Normalizers
export * from './normalizers/index.js';
export { BaseNormalizer } from './normalizers/base.js';
export { TwilioSMSNormalizer } from './normalizers/twilio-sms.js';
export { WhatsAppNormalizer } from './normalizers/whatsapp.js';
export { GmailNormalizer } from './normalizers/gmail.js';

// Core services
export { IdentityResolver } from './identity-resolver.js';
export { MessageDeduplicator, IdempotencyManager } from './deduplication.js';
export { ConversationGrouper } from './threading.js';
export { MessageIngestionPipeline } from './pipeline.js';

// Main pipeline function for easy usage
import { MessageIngestionPipeline, PipelineOptions } from './pipeline.js';
import { RawProviderMessage, IngestionResult } from './types.js';

/**
 * Process a single message through the ingestion pipeline
 * 
 * @param rawMessage - Raw message from provider webhook
 * @param options - Optional pipeline configuration
 * @returns Promise<IngestionResult> - Processing result with normalized message and metadata
 * 
 * @example
 * ```typescript
 * import { processMessage } from '@crm/ingestion';
 * 
 * const rawMessage = {
 *   providerId: 'uuid-here',
 *   providerMessageId: 'twilio-message-sid',
 *   providerType: 'twilio_sms',
 *   channel: 'sms',
 *   timestamp: new Date(),
 *   payload: twilioWebhookPayload
 * };
 * 
 * const result = await processMessage(rawMessage);
 * console.log(`Message processed: ${result.status}, ID: ${result.messageId}`);
 * ```
 */
export async function processMessage(
  rawMessage: RawProviderMessage,
  options?: PipelineOptions
): Promise<IngestionResult> {
  return MessageIngestionPipeline.processMessage(rawMessage, options);
}

/**
 * Process multiple messages in batch
 * 
 * @param rawMessages - Array of raw messages from provider webhooks
 * @param options - Optional pipeline configuration
 * @returns Promise<IngestionResult[]> - Array of processing results
 * 
 * @example
 * ```typescript
 * import { processMessageBatch } from '@crm/ingestion';
 * 
 * const results = await processMessageBatch(rawMessages);
 * const successCount = results.filter(r => r.status === 'success').length;
 * console.log(`Processed ${results.length} messages, ${successCount} successful`);
 * ```
 */
export async function processMessageBatch(
  rawMessages: RawProviderMessage[],
  options?: PipelineOptions
): Promise<IngestionResult[]> {
  return MessageIngestionPipeline.processMessageBatch(rawMessages, options);
}

/**
 * Get supported provider types
 * 
 * @returns Array of supported provider type strings
 */
export function getSupportedProviders(): string[] {
  return require('./normalizers/index.js').NormalizerFactory.getSupportedProviders();
}

/**
 * Check if a provider type is supported
 * 
 * @param providerType - Provider type to check
 * @returns boolean - Whether the provider is supported
 */
export function isProviderSupported(providerType: string): boolean {
  return require('./normalizers/index.js').NormalizerFactory.isProviderSupported(providerType);
}

/**
 * Get the channel type for a given provider
 * 
 * @param providerType - Provider type
 * @returns Channel type or null if provider not supported
 */
export function getChannelForProvider(providerType: string) {
  return require('./normalizers/index.js').NormalizerFactory.getChannelForProvider(providerType);
}

/**
 * Utility function to create a raw provider message object
 * 
 * @param params - Message parameters
 * @returns RawProviderMessage object
 */
export function createRawMessage(params: {
  providerId: string;
  providerMessageId: string;
  providerType: string;
  channel: string;
  payload: Record<string, any>;
  timestamp?: Date | string;
  webhookSignature?: string;
  rawHeaders?: Record<string, string>;
}): RawProviderMessage {
  return {
    providerId: params.providerId,
    providerMessageId: params.providerMessageId,
    providerType: params.providerType,
    channel: params.channel as any,
    timestamp: params.timestamp || new Date(),
    payload: params.payload,
    webhookSignature: params.webhookSignature,
    rawHeaders: params.rawHeaders
  };
}

/**
 * Library version and metadata
 */
export const INGESTION_LIBRARY_VERSION = '1.0.0';
export const SUPPORTED_CHANNELS = ['sms', 'email', 'voice', 'whatsapp', 'facebook', 'instagram'] as const;
export const SUPPORTED_PROVIDERS = ['twilio_sms', 'whatsapp', 'gmail'] as const;