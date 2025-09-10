import { BaseNormalizer } from './base.js';
import { 
  RawProviderMessage, 
  NormalizedMessage, 
  NormalizedContact, 
  TwilioSMSPayload,
  NormalizedAttachment,
  IngestionError
} from '../types.js';
import { validateTwilioPayload } from '../schemas.js';

export class TwilioSMSNormalizer extends BaseNormalizer {
  constructor() {
    super({
      channelType: 'sms',
      providerType: 'twilio_sms',
      identityExtractor: 'phone',
      threadingStrategy: 'phone_based',
      duplicateWindow: 5, // 5 minutes
      supportedContentTypes: ['text/plain', 'image/jpeg', 'image/png', 'image/gif']
    });
  }

  async normalize(rawMessage: RawProviderMessage): Promise<NormalizedMessage> {
    try {
      // Validate the Twilio SMS payload
      const payload = validateTwilioPayload(rawMessage.payload);
      
      // Extract contacts
      const [fromContact, toContact] = await Promise.all([
        this.extractFromContact(payload),
        this.extractToContact(payload)
      ]);

      // Extract message content
      const body = this.extractBody(payload);
      const timestamp = this.extractTimestamp(payload);
      const attachments = await this.extractAttachments(payload);
      
      // Determine content type
      const contentType = attachments.length > 0 
        ? this.extractContentType(attachments[0].type) 
        : 'text';

      // Generate thread key and message hash
      const threadKey = this.generateThreadKey(rawMessage);
      const messageHash = this.generateMessageHash(
        payload.MessageSid,
        body,
        fromContact.normalizedValue,
        toContact.normalizedValue,
        timestamp
      );

      // Determine message direction
      const direction = this.determineMessageDirection(fromContact, toContact);

      const normalized: NormalizedMessage = {
        providerMessageId: payload.MessageSid,
        providerId: rawMessage.providerId,
        channel: 'sms',
        direction,
        from: fromContact,
        to: toContact,
        timestamp,
        body,
        contentType,
        threadKey,
        providerMeta: {
          accountSid: payload.AccountSid,
          smsStatus: payload.SmsStatus,
          numSegments: payload.NumSegments ? parseInt(payload.NumSegments, 10) : 1,
          direction: payload.Direction,
          dateReceived: rawMessage.timestamp,
          originalPayload: payload
        },
        attachments: attachments.length > 0 ? attachments : undefined,
        messageHash
      };

      return await this.validateAndReturn(normalized);
    } catch (error) {
      if (error instanceof IngestionError) {
        throw error;
      }
      
      throw new IngestionError(
        'INVALID_PAYLOAD',
        `Failed to normalize Twilio SMS message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rawMessage.providerId,
        rawMessage.providerMessageId,
        { originalError: error, payload: rawMessage.payload }
      );
    }
  }

  protected async extractFromContact(payload: TwilioSMSPayload): Promise<NormalizedContact> {
    const phoneNumber = this.sanitizePhoneNumber(payload.From);
    return await this.createNormalizedContact(phoneNumber, 'phone', 'twilio');
  }

  protected async extractToContact(payload: TwilioSMSPayload): Promise<NormalizedContact> {
    const phoneNumber = this.sanitizePhoneNumber(payload.To);
    return await this.createNormalizedContact(phoneNumber, 'phone', 'twilio');
  }

  protected extractBody(payload: TwilioSMSPayload): string | undefined {
    return payload.Body && payload.Body.trim() !== '' ? payload.Body : undefined;
  }

  protected extractTimestamp(payload: TwilioSMSPayload): Date {
    if (payload.DateSent) {
      return this.parseTimestamp(payload.DateSent);
    }
    // Fallback to current time if no timestamp provided
    return new Date();
  }

  protected async extractAttachments(payload: TwilioSMSPayload): Promise<NormalizedAttachment[]> {
    const attachments: NormalizedAttachment[] = [];
    
    const numMedia = payload.NumMedia ? parseInt(payload.NumMedia, 10) : 0;
    
    for (let i = 0; i < numMedia; i++) {
      const mediaUrl = payload[`MediaUrl${i}` as keyof TwilioSMSPayload] as string;
      const mediaContentType = payload[`MediaContentType${i}` as keyof TwilioSMSPayload] as string;
      
      if (mediaUrl) {
        attachments.push({
          type: mediaContentType || 'application/octet-stream',
          mimeType: mediaContentType,
          url: mediaUrl,
          metadata: {
            mediaIndex: i,
            twilioMediaUrl: mediaUrl
          }
        });
      }
    }
    
    return attachments;
  }

  protected generateThreadKey(rawMessage: RawProviderMessage): string {
    const payload = rawMessage.payload as TwilioSMSPayload;
    
    // For SMS, create a thread key based on the phone numbers
    // Sort the numbers to ensure consistent thread keys regardless of direction
    const fromNumber = this.sanitizePhoneNumber(payload.From);
    const toNumber = this.sanitizePhoneNumber(payload.To);
    const numbers = [fromNumber, toNumber].sort();
    
    return `sms:${numbers[0]}:${numbers[1]}`;
  }

  protected determineMessageDirection(
    from: NormalizedContact, 
    to: NormalizedContact
  ): 'inbound' | 'outbound' {
    // For Twilio SMS, we need to determine which number is our business number
    // This would typically be configured per provider instance
    // For now, we'll use a simple heuristic: shorter numbers are typically business numbers
    
    const fromDigits = from.normalizedValue.replace(/\D/g, '');
    const toDigits = to.normalizedValue.replace(/\D/g, '');
    
    // If "to" number is shorter, it's likely our business number (outbound)
    if (toDigits.length < fromDigits.length) {
      return 'outbound';
    }
    
    // If "from" number is shorter, it's likely our business number (inbound)
    if (fromDigits.length < toDigits.length) {
      return 'inbound';
    }
    
    // Default to inbound for customer messages
    return 'inbound';
  }
}