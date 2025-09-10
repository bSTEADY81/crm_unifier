import { 
  RawProviderMessage, 
  NormalizedMessage, 
  IngestionResult, 
  IngestionStatus,
  IngestionError 
} from './types.js';
import { NormalizerFactory } from './normalizers/index.js';
import { IdentityResolver } from './identity-resolver.js';
import { MessageDeduplicator, IdempotencyManager } from './deduplication.js';
import { ConversationGrouper } from './threading.js';
import { MessageModel } from '../../models/message.js';
import { validateRawProviderMessage, validateIngestionResult } from './schemas.js';

export interface PipelineOptions {
  skipDuplicateCheck?: boolean;
  skipIdentityResolution?: boolean;
  skipThreading?: boolean;
  createNewCustomers?: boolean;
  strictValidation?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
}

export interface PipelineStage {
  name: string;
  startTime: Date;
  endTime?: Date;
  success: boolean;
  error?: Error;
  metadata?: Record<string, any>;
}

export class MessageIngestionPipeline {
  private static defaultOptions: Required<PipelineOptions> = {
    skipDuplicateCheck: false,
    skipIdentityResolution: false,
    skipThreading: false,
    createNewCustomers: true,
    strictValidation: true,
    maxRetries: 3,
    timeoutMs: 30000
  };

  static async processMessage(
    rawMessage: RawProviderMessage,
    options: PipelineOptions = {}
  ): Promise<IngestionResult> {
    const opts = { ...this.defaultOptions, ...options };
    const processingMetrics = {
      startTime: new Date(),
      endTime: undefined as Date | undefined,
      durationMs: undefined as number | undefined,
      stagesCompleted: [] as string[],
      stagesFailed: [] as string[]
    };

    let normalizedMessage: NormalizedMessage | undefined;
    let status: IngestionStatus = 'processing';

    try {
      // Stage 1: Validate Raw Message
      processingMetrics.stagesCompleted.push('validation');
      await this.validateRawMessage(rawMessage, opts);

      // Stage 2: Generate Idempotency Key
      processingMetrics.stagesCompleted.push('idempotency_check');
      const idempotencyKey = IdempotencyManager.generateIdempotencyKey(
        rawMessage.providerId,
        rawMessage.providerMessageId,
        typeof rawMessage.timestamp === 'string' ? new Date(rawMessage.timestamp) : rawMessage.timestamp
      );

      // Check if we've already processed this message
      const existingMessageId = await IdempotencyManager.checkIdempotency(idempotencyKey);
      if (existingMessageId) {
        processingMetrics.endTime = new Date();
        processingMetrics.durationMs = processingMetrics.endTime.getTime() - processingMetrics.startTime.getTime();
        
        return {
          status: 'duplicate',
          messageId: existingMessageId,
          processingMetrics,
          error: {
            code: 'DUPLICATE_MESSAGE',
            message: 'Message already processed',
            details: { idempotencyKey }
          }
        };
      }

      // Stage 3: Normalize Message
      processingMetrics.stagesCompleted.push('normalization');
      normalizedMessage = await this.normalizeMessage(rawMessage);

      // Stage 4: Check for Duplicates (if not skipped)
      if (!opts.skipDuplicateCheck) {
        processingMetrics.stagesCompleted.push('duplicate_check');
        const duplicateCheck = await MessageDeduplicator.checkForDuplicate(
          normalizedMessage,
          rawMessage
        );

        if (duplicateCheck.isDuplicate) {
          processingMetrics.endTime = new Date();
          processingMetrics.durationMs = processingMetrics.endTime.getTime() - processingMetrics.startTime.getTime();

          return {
            status: 'duplicate',
            messageId: duplicateCheck.existingMessageId,
            normalizedMessage,
            processingMetrics,
            error: {
              code: 'DUPLICATE_MESSAGE',
              message: duplicateCheck.reason || 'Duplicate message detected',
              details: { duplicateType: duplicateCheck.duplicateType, confidence: duplicateCheck.confidence }
            }
          };
        }
      }

      // Stage 5: Identity Resolution (if not skipped)
      let identityResolution;
      let customerId: string | undefined;

      if (!opts.skipIdentityResolution) {
        processingMetrics.stagesCompleted.push('identity_resolution');
        
        // Resolve customer identity from the message sender
        const customerContact = normalizedMessage.direction === 'inbound' ? 
          normalizedMessage.from : 
          normalizedMessage.to;

        identityResolution = await IdentityResolver.resolveIdentity(customerContact, {
          createNewCustomer: opts.createNewCustomers
        });

        // Create or link the identity
        const identityResult = await IdentityResolver.createOrLinkIdentity(
          customerContact,
          identityResolution
        );

        customerId = identityResult.customerId;
      }

      // Stage 6: Thread/Conversation Grouping (if not skipped)
      let threadingContext;
      let conversationId: string | undefined;

      if (!opts.skipThreading && customerId && normalizedMessage.threadKey) {
        processingMetrics.stagesCompleted.push('threading');
        
        threadingContext = await ConversationGrouper.groupIntoConversation(
          normalizedMessage,
          customerId
        );

        conversationId = threadingContext.conversationId;
      }

      // Stage 7: Persist Message
      processingMetrics.stagesCompleted.push('persistence');
      
      const messageData = {
        providerMessageId: normalizedMessage.providerMessageId,
        providerId: normalizedMessage.providerId,
        customerId,
        conversationId,
        channel: normalizedMessage.channel,
        direction: normalizedMessage.direction,
        fromIdentifier: normalizedMessage.from.normalizedValue,
        toIdentifier: normalizedMessage.to.normalizedValue,
        threadKey: normalizedMessage.threadKey,
        timestamp: normalizedMessage.timestamp,
        body: normalizedMessage.body,
        status: 'processed' as const,
        providerMeta: {
          ...normalizedMessage.providerMeta,
          messageHash: normalizedMessage.messageHash,
          contentType: normalizedMessage.contentType,
          fromContact: normalizedMessage.from,
          toContact: normalizedMessage.to
        }
      };

      const persistedMessage = await MessageModel.create(messageData);

      // Stage 8: Update Conversation Activity (if we have a conversation)
      if (conversationId) {
        processingMetrics.stagesCompleted.push('conversation_update');
        await ConversationGrouper.updateConversationActivity(
          conversationId,
          normalizedMessage.timestamp
        );
      }

      // Mark as processed in idempotency manager
      IdempotencyManager.markAsProcessed(idempotencyKey, persistedMessage.id);

      status = 'success';
      processingMetrics.endTime = new Date();
      processingMetrics.durationMs = processingMetrics.endTime.getTime() - processingMetrics.startTime.getTime();

      const result: IngestionResult = {
        status,
        messageId: persistedMessage.id,
        normalizedMessage,
        identityResolution,
        threadingContext,
        processingMetrics
      };

      // Validate the result before returning (if strict validation enabled)
      if (opts.strictValidation) {
        return validateIngestionResult(result);
      }

      return result;

    } catch (error) {
      status = 'failed';
      processingMetrics.endTime = new Date();
      processingMetrics.durationMs = processingMetrics.endTime.getTime() - processingMetrics.startTime.getTime();

      // Determine which stage failed
      const lastStage = processingMetrics.stagesCompleted[processingMetrics.stagesCompleted.length - 1];
      if (lastStage) {
        processingMetrics.stagesFailed = [lastStage];
      }

      const ingestionError = error instanceof IngestionError ? error : new IngestionError(
        'UNKNOWN_ERROR',
        `Pipeline processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rawMessage.providerId,
        rawMessage.providerMessageId,
        { originalError: error, lastStage }
      );

      return {
        status,
        normalizedMessage,
        processingMetrics,
        error: {
          code: ingestionError.code,
          message: ingestionError.message,
          details: ingestionError.details
        }
      };
    }
  }

  private static async validateRawMessage(
    rawMessage: RawProviderMessage,
    options: Required<PipelineOptions>
  ): Promise<void> {
    try {
      validateRawProviderMessage(rawMessage);
    } catch (error) {
      throw new IngestionError(
        'VALIDATION_FAILED',
        `Raw message validation failed: ${error instanceof Error ? error.message : 'Unknown validation error'}`,
        rawMessage.providerId,
        rawMessage.providerMessageId,
        { validationError: error }
      );
    }

    // Check if provider type is supported
    if (!NormalizerFactory.isProviderSupported(rawMessage.providerType)) {
      throw new IngestionError(
        'PROVIDER_NOT_SUPPORTED',
        `Provider type '${rawMessage.providerType}' is not supported`,
        rawMessage.providerId,
        rawMessage.providerMessageId,
        { supportedProviders: NormalizerFactory.getSupportedProviders() }
      );
    }
  }

  private static async normalizeMessage(rawMessage: RawProviderMessage): Promise<NormalizedMessage> {
    try {
      const normalizer = NormalizerFactory.getNormalizer(rawMessage.providerType);
      return await normalizer.normalize(rawMessage);
    } catch (error) {
      if (error instanceof IngestionError) {
        throw error;
      }
      
      throw new IngestionError(
        'INVALID_PAYLOAD',
        `Message normalization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rawMessage.providerId,
        rawMessage.providerMessageId,
        { originalError: error }
      );
    }
  }

  static async processMessageBatch(
    rawMessages: RawProviderMessage[],
    options: PipelineOptions = {}
  ): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];
    const batchStartTime = new Date();

    for (const rawMessage of rawMessages) {
      try {
        const result = await this.processMessage(rawMessage, options);
        results.push(result);
      } catch (error) {
        // Create a failed result for this message
        const processingMetrics = {
          startTime: batchStartTime,
          endTime: new Date(),
          durationMs: Date.now() - batchStartTime.getTime(),
          stagesCompleted: [],
          stagesFailed: ['batch_processing']
        };

        const ingestionError = error instanceof IngestionError ? error : new IngestionError(
          'UNKNOWN_ERROR',
          `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          rawMessage.providerId,
          rawMessage.providerMessageId,
          { originalError: error }
        );

        results.push({
          status: 'failed',
          processingMetrics,
          error: {
            code: ingestionError.code,
            message: ingestionError.message,
            details: ingestionError.details
          }
        });
      }
    }

    return results;
  }

  static async retryFailedMessage(
    rawMessage: RawProviderMessage,
    options: PipelineOptions = {}
  ): Promise<IngestionResult> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= opts.maxRetries; attempt++) {
      try {
        const result = await this.processMessage(rawMessage, {
          ...opts,
          maxRetries: 1 // Prevent infinite recursion
        });

        if (result.status === 'success' || result.status === 'duplicate') {
          return result;
        }

        lastError = new Error(result.error?.message || 'Unknown error');
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
      }

      // Wait before retrying (exponential backoff)
      if (attempt < opts.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // All retries failed
    throw new IngestionError(
      'UNKNOWN_ERROR',
      `Message processing failed after ${opts.maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
      rawMessage.providerId,
      rawMessage.providerMessageId,
      { maxRetries: opts.maxRetries, lastError }
    );
  }

  static getProcessingStats(): {
    totalProcessed: number;
    successRate: number;
    averageProcessingTime: number;
    commonErrors: Array<{ code: string; count: number }>;
  } {
    // In a real implementation, this would query metrics from a database or cache
    // For now, return placeholder data
    return {
      totalProcessed: 0,
      successRate: 0.95,
      averageProcessingTime: 150, // ms
      commonErrors: [
        { code: 'DUPLICATE_MESSAGE', count: 15 },
        { code: 'INVALID_PAYLOAD', count: 8 },
        { code: 'IDENTITY_RESOLUTION_FAILED', count: 3 }
      ]
    };
  }
}

export default MessageIngestionPipeline;