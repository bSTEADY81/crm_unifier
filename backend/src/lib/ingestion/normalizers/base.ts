import crypto from 'crypto';
import { 
  RawProviderMessage, 
  NormalizedMessage, 
  NormalizedContact, 
  ChannelNormalizerConfig,
  IngestionError,
  NormalizedAttachment
} from '../types.js';
import { validateNormalizedMessage } from '../schemas.js';
import { IdentityModel } from '../../../models/identity.js';

export abstract class BaseNormalizer {
  protected config: ChannelNormalizerConfig;

  constructor(config: ChannelNormalizerConfig) {
    this.config = config;
  }

  abstract normalize(rawMessage: RawProviderMessage): Promise<NormalizedMessage>;

  protected abstract extractFromContact(payload: Record<string, any>): Promise<NormalizedContact>;
  protected abstract extractToContact(payload: Record<string, any>): Promise<NormalizedContact>;
  protected abstract extractBody(payload: Record<string, any>): string | undefined;
  protected abstract extractTimestamp(payload: Record<string, any>): Date;
  protected abstract extractAttachments(payload: Record<string, any>): Promise<NormalizedAttachment[]>;
  protected abstract generateThreadKey(rawMessage: RawProviderMessage): string;

  protected async createNormalizedContact(
    rawValue: string, 
    type: 'phone' | 'email' | 'social',
    provider?: string
  ): Promise<NormalizedContact> {
    const normalizedValue = await IdentityModel.normalizeValue(type, rawValue);
    
    return {
      identifier: normalizedValue,
      normalizedValue,
      rawValue,
      type,
      verified: false,
      provider
    };
  }

  protected generateMessageHash(
    providerMessageId: string,
    body: string | undefined,
    from: string,
    to: string,
    timestamp: Date
  ): string {
    const content = [
      providerMessageId,
      body || '',
      from,
      to,
      timestamp.toISOString()
    ].join('|');
    
    return crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('hex');
  }

  protected determineMessageDirection(
    from: NormalizedContact, 
    to: NormalizedContact, 
    businessNumber?: string
  ): 'inbound' | 'outbound' {
    // If we have a business number configured, use it to determine direction
    if (businessNumber) {
      const normalizedBusinessNumber = businessNumber.replace(/\D/g, '');
      const fromNormalized = from.normalizedValue.replace(/\D/g, '');
      const toNormalized = to.normalizedValue.replace(/\D/g, '');
      
      if (fromNormalized.endsWith(normalizedBusinessNumber) || 
          fromNormalized === normalizedBusinessNumber) {
        return 'outbound';
      }
      if (toNormalized.endsWith(normalizedBusinessNumber) || 
          toNormalized === normalizedBusinessNumber) {
        return 'inbound';
      }
    }

    // Default heuristics based on channel
    switch (this.config.channelType) {
      case 'sms':
      case 'whatsapp':
        // For SMS/WhatsApp, typically customer messages are inbound
        return 'inbound';
      case 'email':
        // For email, we'll need more sophisticated logic in the specific normalizer
        return 'inbound';
      default:
        return 'inbound';
    }
  }

  protected async validateAndReturn(normalized: NormalizedMessage): Promise<NormalizedMessage> {
    try {
      return validateNormalizedMessage(normalized);
    } catch (error) {
      throw new IngestionError(
        'VALIDATION_FAILED',
        `Normalized message failed validation: ${error instanceof Error ? error.message : 'Unknown error'}`,
        normalized.providerId,
        normalized.providerMessageId,
        { validationError: error }
      );
    }
  }

  protected parseTimestamp(timestampValue: string | number | Date): Date {
    if (timestampValue instanceof Date) {
      return timestampValue;
    }
    
    if (typeof timestampValue === 'number') {
      // Handle both seconds and milliseconds timestamps
      const timestamp = timestampValue > 9999999999 ? timestampValue : timestampValue * 1000;
      return new Date(timestamp);
    }
    
    if (typeof timestampValue === 'string') {
      // Try parsing as ISO string first
      const isoDate = new Date(timestampValue);
      if (!isNaN(isoDate.getTime())) {
        return isoDate;
      }
      
      // Try parsing as Unix timestamp
      const numericValue = parseInt(timestampValue, 10);
      if (!isNaN(numericValue)) {
        const timestamp = numericValue > 9999999999 ? numericValue : numericValue * 1000;
        return new Date(timestamp);
      }
    }
    
    // Fallback to current time if parsing fails
    return new Date();
  }

  protected extractContentType(mimeType?: string, filename?: string): 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' {
    if (!mimeType && !filename) {
      return 'text';
    }

    const mime = (mimeType || '').toLowerCase();
    const ext = filename ? filename.split('.').pop()?.toLowerCase() : '';

    if (mime.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) {
      return 'image';
    }
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext || '')) {
      return 'audio';
    }
    if (mime.startsWith('video/') || ['mp4', 'avi', 'mov', 'webm'].includes(ext || '')) {
      return 'video';
    }
    if (mime.includes('application/') || ['pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext || '')) {
      return 'document';
    }

    return 'text';
  }

  protected sanitizePhoneNumber(phoneNumber: string): string {
    // Remove all non-numeric characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Add country code if missing (assumes US +1 for now)
    if (digits.length === 10) {
      return `+1${digits}`;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`;
    }
    
    // If it already starts with +, keep it as is
    if (phoneNumber.startsWith('+')) {
      return phoneNumber.replace(/\D/g, '').replace(/^(\d)/, '+$1');
    }
    
    // Default case - add + prefix
    return `+${digits}`;
  }

  protected sanitizeEmailAddress(email: string): string {
    return email.toLowerCase().trim();
  }

  protected sanitizeSocialHandle(handle: string): string {
    return handle.replace(/^@/, '').toLowerCase().trim();
  }
}