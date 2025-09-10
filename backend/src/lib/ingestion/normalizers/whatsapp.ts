import { BaseNormalizer } from './base.js';
import { 
  RawProviderMessage, 
  NormalizedMessage, 
  NormalizedContact, 
  WhatsAppPayload,
  NormalizedAttachment,
  IngestionError
} from '../types.js';
import { validateWhatsAppPayload } from '../schemas.js';

export class WhatsAppNormalizer extends BaseNormalizer {
  constructor() {
    super({
      channelType: 'whatsapp',
      providerType: 'whatsapp',
      identityExtractor: 'phone',
      threadingStrategy: 'conversation_id',
      duplicateWindow: 3, // 3 minutes
      supportedContentTypes: [
        'text/plain', 
        'image/jpeg', 
        'image/png', 
        'audio/ogg', 
        'audio/mp4', 
        'video/mp4', 
        'application/pdf'
      ]
    });
  }

  async normalize(rawMessage: RawProviderMessage): Promise<NormalizedMessage> {
    try {
      // Validate the WhatsApp payload
      const payload = validateWhatsAppPayload(rawMessage.payload);
      
      // WhatsApp webhook can contain multiple entries and changes
      // We'll process the first message in the first entry
      const entry = payload.entry[0];
      const change = entry.changes[0];
      const messages = change.value.messages;
      
      if (!messages || messages.length === 0) {
        throw new IngestionError(
          'INVALID_PAYLOAD',
          'No messages found in WhatsApp payload',
          rawMessage.providerId,
          rawMessage.providerMessageId
        );
      }

      const message = messages[0];
      const businessPhoneNumberId = change.value.metadata.phone_number_id;
      const businessDisplayNumber = change.value.metadata.display_phone_number;

      // Extract contacts
      const [fromContact, toContact] = await Promise.all([
        this.extractFromContact({ ...message, businessDisplayNumber }),
        this.extractToContact({ businessDisplayNumber, businessPhoneNumberId })
      ]);

      // Extract message content
      const body = this.extractBody(message);
      const timestamp = this.extractTimestamp(message);
      const attachments = await this.extractAttachments(message);
      
      // Determine content type based on WhatsApp message type
      const contentType = this.mapWhatsAppTypeToContentType(message.type);

      // Generate thread key and message hash
      const threadKey = this.generateThreadKey(rawMessage);
      const messageHash = this.generateMessageHash(
        message.id,
        body,
        fromContact.normalizedValue,
        toContact.normalizedValue,
        timestamp
      );

      const normalized: NormalizedMessage = {
        providerMessageId: message.id,
        providerId: rawMessage.providerId,
        channel: 'whatsapp',
        direction: 'inbound', // WhatsApp business messages from customers are always inbound
        from: fromContact,
        to: toContact,
        timestamp,
        body,
        contentType,
        threadKey,
        providerMeta: {
          whatsappType: message.type,
          businessPhoneNumberId,
          businessDisplayNumber,
          context: message.context,
          entryId: entry.id,
          originalPayload: message
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
        `Failed to normalize WhatsApp message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rawMessage.providerId,
        rawMessage.providerMessageId,
        { originalError: error, payload: rawMessage.payload }
      );
    }
  }

  protected async extractFromContact(payload: any): Promise<NormalizedContact> {
    const phoneNumber = this.sanitizePhoneNumber(payload.from);
    return await this.createNormalizedContact(phoneNumber, 'phone', 'whatsapp');
  }

  protected async extractToContact(payload: any): Promise<NormalizedContact> {
    // For WhatsApp, the "to" is always our business number
    const phoneNumber = this.sanitizePhoneNumber(payload.businessDisplayNumber);
    return await this.createNormalizedContact(phoneNumber, 'phone', 'whatsapp');
  }

  protected extractBody(payload: any): string | undefined {
    switch (payload.type) {
      case 'text':
        return payload.text?.body;
      case 'image':
      case 'video':
      case 'document':
        return payload[payload.type]?.caption;
      case 'location':
        const location = payload.location;
        return location ? 
          `Location: ${location.latitude}, ${location.longitude}${location.name ? ` (${location.name})` : ''}` : 
          undefined;
      default:
        return undefined;
    }
  }

  protected extractTimestamp(payload: any): Date {
    return this.parseTimestamp(payload.timestamp);
  }

  protected async extractAttachments(payload: any): Promise<NormalizedAttachment[]> {
    const attachments: NormalizedAttachment[] = [];
    
    switch (payload.type) {
      case 'image':
        if (payload.image) {
          attachments.push({
            type: payload.image.mime_type,
            mimeType: payload.image.mime_type,
            url: `whatsapp://media/${payload.image.id}`, // This would need to be resolved via WhatsApp API
            metadata: {
              whatsappId: payload.image.id,
              sha256: payload.image.sha256,
              caption: payload.image.caption
            }
          });
        }
        break;
        
      case 'audio':
        if (payload.audio) {
          attachments.push({
            type: payload.audio.mime_type,
            mimeType: payload.audio.mime_type,
            url: `whatsapp://media/${payload.audio.id}`,
            metadata: {
              whatsappId: payload.audio.id,
              sha256: payload.audio.sha256
            }
          });
        }
        break;
        
      case 'video':
        if (payload.video) {
          attachments.push({
            type: payload.video.mime_type,
            mimeType: payload.video.mime_type,
            url: `whatsapp://media/${payload.video.id}`,
            metadata: {
              whatsappId: payload.video.id,
              sha256: payload.video.sha256,
              caption: payload.video.caption
            }
          });
        }
        break;
        
      case 'document':
        if (payload.document) {
          attachments.push({
            type: payload.document.mime_type,
            filename: payload.document.filename,
            mimeType: payload.document.mime_type,
            url: `whatsapp://media/${payload.document.id}`,
            metadata: {
              whatsappId: payload.document.id,
              sha256: payload.document.sha256,
              caption: payload.document.caption
            }
          });
        }
        break;
    }
    
    return attachments;
  }

  protected generateThreadKey(rawMessage: RawProviderMessage): string {
    const payload = rawMessage.payload as WhatsAppPayload;
    const entry = payload.entry[0];
    const change = entry.changes[0];
    const message = change.value.messages?.[0];
    
    if (!message) {
      throw new IngestionError(
        'INVALID_PAYLOAD',
        'No message found for thread key generation',
        rawMessage.providerId,
        rawMessage.providerMessageId
      );
    }

    // For WhatsApp, use the customer phone number and business number
    const customerNumber = this.sanitizePhoneNumber(message.from);
    const businessNumber = this.sanitizePhoneNumber(change.value.metadata.display_phone_number);
    
    // If this is a reply to a previous message, use the context
    if (message.context?.from) {
      return `whatsapp:${businessNumber}:${customerNumber}:${message.context.id}`;
    }
    
    // Otherwise create a new thread based on the phone numbers
    return `whatsapp:${businessNumber}:${customerNumber}`;
  }

  private mapWhatsAppTypeToContentType(
    whatsappType: string
  ): 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' {
    switch (whatsappType) {
      case 'text':
        return 'text';
      case 'image':
        return 'image';
      case 'audio':
        return 'audio';
      case 'video':
        return 'video';
      case 'document':
        return 'document';
      case 'location':
        return 'location';
      default:
        return 'text';
    }
  }
}