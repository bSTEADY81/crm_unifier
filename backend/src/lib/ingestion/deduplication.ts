import crypto from 'crypto';
import { MessageModel } from '../../models/message.js';
import { 
  NormalizedMessage, 
  RawProviderMessage,
  IngestionError 
} from './types.js';

export interface DeduplicationOptions {
  checkProviderDuplicates?: boolean;
  checkContentDuplicates?: boolean;
  contentSimilarityThreshold?: number;
  timeWindowMinutes?: number;
  ignoreTimestampDifference?: boolean;
}

export interface DuplicationCheckResult {
  isDuplicate: boolean;
  duplicateType: 'provider_id' | 'content_hash' | 'similar_content' | 'none';
  existingMessageId?: string;
  confidence: number;
  reason?: string;
}

export class MessageDeduplicator {
  private static defaultOptions: Required<DeduplicationOptions> = {
    checkProviderDuplicates: true,
    checkContentDuplicates: true,
    contentSimilarityThreshold: 0.9,
    timeWindowMinutes: 60,
    ignoreTimestampDifference: false
  };

  static async checkForDuplicate(
    normalizedMessage: NormalizedMessage,
    rawMessage: RawProviderMessage,
    options: DeduplicationOptions = {}
  ): Promise<DuplicationCheckResult> {
    const opts = { ...this.defaultOptions, ...options };
    
    try {
      // Check 1: Provider message ID duplicate
      if (opts.checkProviderDuplicates) {
        const providerDuplicate = await this.checkProviderIdDuplicate(
          normalizedMessage.providerId,
          normalizedMessage.providerMessageId
        );
        
        if (providerDuplicate.isDuplicate) {
          return providerDuplicate;
        }
      }

      // Check 2: Content hash duplicate
      if (opts.checkContentDuplicates) {
        const contentDuplicate = await this.checkContentHashDuplicate(
          normalizedMessage,
          opts.timeWindowMinutes
        );
        
        if (contentDuplicate.isDuplicate) {
          return contentDuplicate;
        }

        // Check 3: Similar content duplicate (fuzzy matching)
        const similarContentDuplicate = await this.checkSimilarContentDuplicate(
          normalizedMessage,
          opts.contentSimilarityThreshold,
          opts.timeWindowMinutes
        );
        
        if (similarContentDuplicate.isDuplicate) {
          return similarContentDuplicate;
        }
      }

      return {
        isDuplicate: false,
        duplicateType: 'none',
        confidence: 0.0
      };
    } catch (error) {
      throw new IngestionError(
        'DUPLICATE_MESSAGE',
        `Failed to check for duplicates: ${error instanceof Error ? error.message : 'Unknown error'}`,
        normalizedMessage.providerId,
        normalizedMessage.providerMessageId,
        { error, normalizedMessage: this.sanitizeMessageForLogging(normalizedMessage) }
      );
    }
  }

  static async checkProviderIdDuplicate(
    providerId: string,
    providerMessageId: string
  ): Promise<DuplicationCheckResult> {
    const existingMessage = await MessageModel.findByProviderMessageId(
      providerId,
      providerMessageId
    );

    if (existingMessage) {
      return {
        isDuplicate: true,
        duplicateType: 'provider_id',
        existingMessageId: existingMessage.id,
        confidence: 1.0,
        reason: `Message with provider ID ${providerId} and provider message ID ${providerMessageId} already exists`
      };
    }

    return {
      isDuplicate: false,
      duplicateType: 'none',
      confidence: 0.0
    };
  }

  static async checkContentHashDuplicate(
    message: NormalizedMessage,
    timeWindowMinutes: number
  ): Promise<DuplicationCheckResult> {
    // Look for messages with the same hash within the time window
    const timeWindow = new Date(Date.now() - (timeWindowMinutes * 60 * 1000));
    
    // We need to query messages with similar characteristics and check their providerMeta
    // Since we don't have a messageHash field in the database, we'll need to implement this differently
    // For now, we'll use a combination of from/to identifiers and body content
    
    const potentialDuplicates = await MessageModel.list({
      from: timeWindow,
      search: message.body,
      limit: 20 // Limit to avoid performance issues
    });

    for (const existingMessage of potentialDuplicates.data) {
      // Check if this message has the same hash in its providerMeta
      const existingHash = (existingMessage.providerMeta as any)?.messageHash;
      if (existingHash === message.messageHash) {
        return {
          isDuplicate: true,
          duplicateType: 'content_hash',
          existingMessageId: existingMessage.id,
          confidence: 1.0,
          reason: `Message with identical content hash found within ${timeWindowMinutes} minute window`
        };
      }
    }

    return {
      isDuplicate: false,
      duplicateType: 'none',
      confidence: 0.0
    };
  }

  static async checkSimilarContentDuplicate(
    message: NormalizedMessage,
    similarityThreshold: number,
    timeWindowMinutes: number
  ): Promise<DuplicationCheckResult> {
    if (!message.body || message.body.trim().length === 0) {
      return {
        isDuplicate: false,
        duplicateType: 'none',
        confidence: 0.0
      };
    }

    const timeWindow = new Date(Date.now() - (timeWindowMinutes * 60 * 1000));
    
    // Find recent messages from/to the same contacts
    const potentialDuplicates = await MessageModel.list({
      from: timeWindow,
      limit: 50
    });

    for (const existingMessage of potentialDuplicates.data) {
      if (!existingMessage.body) continue;

      // Check if from/to identifiers match (in either direction)
      const sameContacts = this.haveSameContacts(message, existingMessage);
      if (!sameContacts) continue;

      // Calculate content similarity
      const similarity = this.calculateContentSimilarity(message.body, existingMessage.body);
      
      if (similarity >= similarityThreshold) {
        return {
          isDuplicate: true,
          duplicateType: 'similar_content',
          existingMessageId: existingMessage.id,
          confidence: similarity,
          reason: `Message with ${Math.round(similarity * 100)}% similar content found within ${timeWindowMinutes} minute window`
        };
      }
    }

    return {
      isDuplicate: false,
      duplicateType: 'none',
      confidence: 0.0
    };
  }

  private static haveSameContacts(message1: NormalizedMessage, message2: any): boolean {
    const m1From = message1.from.normalizedValue;
    const m1To = message1.to.normalizedValue;
    const m2From = message2.fromIdentifier;
    const m2To = message2.toIdentifier;

    // Check if contacts match in same direction
    if (m1From === m2From && m1To === m2To) {
      return true;
    }

    // Check if contacts match in reverse direction
    if (m1From === m2To && m1To === m2From) {
      return true;
    }

    return false;
  }

  private static calculateContentSimilarity(content1: string, content2: string): number {
    // Simple similarity calculation using Levenshtein distance
    const distance = this.levenshteinDistance(
      content1.toLowerCase().trim(),
      content2.toLowerCase().trim()
    );
    
    const maxLength = Math.max(content1.length, content2.length);
    if (maxLength === 0) return 1.0;
    
    return 1 - (distance / maxLength);
  }

  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

    for (let i = 0; i <= str1.length; i += 1) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= str2.length; j += 1) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator, // substitution
        );
      }
    }

    return matrix[str2.length][str1.length];
  }

  static generateContentFingerprint(message: NormalizedMessage): string {
    // Create a content fingerprint for more sophisticated duplicate detection
    const elements = [
      message.from.normalizedValue,
      message.to.normalizedValue,
      message.body || '',
      message.channel,
      message.contentType || 'text'
    ];

    // Add attachment hashes if present
    if (message.attachments && message.attachments.length > 0) {
      for (const attachment of message.attachments) {
        elements.push(attachment.type);
        elements.push(attachment.filename || '');
        elements.push(attachment.size?.toString() || '0');
      }
    }

    const content = elements.join('|');
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  }

  static async ensureIdempotency(
    rawMessage: RawProviderMessage,
    normalizedMessage: NormalizedMessage
  ): Promise<{ isIdempotent: boolean; existingMessageId?: string }> {
    // Check if we've already processed this exact raw message
    const existingByProviderId = await MessageModel.findByProviderMessageId(
      normalizedMessage.providerId,
      normalizedMessage.providerMessageId
    );

    if (existingByProviderId) {
      return {
        isIdempotent: true,
        existingMessageId: existingByProviderId.id
      };
    }

    return { isIdempotent: false };
  }

  private static sanitizeMessageForLogging(message: NormalizedMessage) {
    // Remove sensitive information for logging
    return {
      providerMessageId: message.providerMessageId,
      providerId: message.providerId,
      channel: message.channel,
      direction: message.direction,
      timestamp: message.timestamp,
      contentType: message.contentType,
      hasBody: !!message.body,
      bodyLength: message.body?.length || 0,
      attachmentCount: message.attachments?.length || 0
    };
  }
}

export class IdempotencyManager {
  private static processedMessages = new Map<string, string>();
  private static readonly MAX_CACHE_SIZE = 10000;
  private static readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  static generateIdempotencyKey(
    providerId: string,
    providerMessageId: string,
    timestamp: Date
  ): string {
    const elements = [
      providerId,
      providerMessageId,
      timestamp.toISOString()
    ];
    
    return crypto
      .createHash('sha256')
      .update(elements.join('|'), 'utf8')
      .digest('hex');
  }

  static async checkIdempotency(idempotencyKey: string): Promise<string | null> {
    // First check in-memory cache
    if (this.processedMessages.has(idempotencyKey)) {
      return this.processedMessages.get(idempotencyKey)!;
    }

    // Then check database (implementation would depend on having an idempotency table)
    // For now, we'll rely on the provider message ID uniqueness constraint
    return null;
  }

  static markAsProcessed(idempotencyKey: string, messageId: string): void {
    // Clean cache if it gets too large
    if (this.processedMessages.size >= this.MAX_CACHE_SIZE) {
      this.processedMessages.clear();
    }

    this.processedMessages.set(idempotencyKey, messageId);
  }

  static clearExpiredEntries(): void {
    // In a real implementation, this would clean up based on timestamp
    // For now, just clear the entire cache periodically
    this.processedMessages.clear();
  }
}

export default MessageDeduplicator;