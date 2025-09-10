import { BaseNormalizer } from './base.js';
import { 
  RawProviderMessage, 
  NormalizedMessage, 
  NormalizedContact, 
  GmailPayload,
  NormalizedAttachment,
  IngestionError
} from '../types.js';
import { validateGmailPayload } from '../schemas.js';

export class GmailNormalizer extends BaseNormalizer {
  constructor() {
    super({
      channelType: 'email',
      providerType: 'gmail',
      identityExtractor: 'email',
      threadingStrategy: 'email_thread',
      duplicateWindow: 10, // 10 minutes
      supportedContentTypes: [
        'text/plain', 
        'text/html',
        'image/jpeg', 
        'image/png', 
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    });
  }

  async normalize(rawMessage: RawProviderMessage): Promise<NormalizedMessage> {
    try {
      // Validate the Gmail payload
      const payload = validateGmailPayload(rawMessage.payload);
      
      // Extract email headers
      const headers = this.extractHeaders(payload);
      const fromEmail = headers.get('from');
      const toEmail = headers.get('to');
      const subject = headers.get('subject');
      
      if (!fromEmail || !toEmail) {
        throw new IngestionError(
          'INVALID_PAYLOAD',
          'Missing required From or To headers in Gmail message',
          rawMessage.providerId,
          payload.id
        );
      }

      // Extract contacts
      const [fromContact, toContact] = await Promise.all([
        this.extractFromContact({ email: fromEmail }),
        this.extractToContact({ email: toEmail })
      ]);

      // Extract message content
      const body = this.extractBody(payload);
      const timestamp = this.extractTimestamp(payload);
      const attachments = await this.extractAttachments(payload);
      
      // Determine content type
      const contentType = attachments.length > 0 ? 'document' : 'text';

      // Generate thread key and message hash
      const threadKey = this.generateThreadKey(rawMessage);
      const messageHash = this.generateMessageHash(
        payload.id,
        body,
        fromContact.normalizedValue,
        toContact.normalizedValue,
        timestamp
      );

      // Determine message direction
      const direction = this.determineEmailDirection(fromContact, toContact);

      const normalized: NormalizedMessage = {
        providerMessageId: payload.id,
        providerId: rawMessage.providerId,
        channel: 'email',
        direction,
        from: fromContact,
        to: toContact,
        timestamp,
        body,
        contentType,
        threadKey,
        providerMeta: {
          gmailThreadId: payload.threadId,
          subject,
          snippet: payload.snippet,
          labelIds: payload.labelIds,
          historyId: payload.historyId,
          sizeEstimate: payload.sizeEstimate,
          headers: Object.fromEntries(headers),
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
        `Failed to normalize Gmail message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        rawMessage.providerId,
        rawMessage.providerMessageId,
        { originalError: error, payload: rawMessage.payload }
      );
    }
  }

  protected async extractFromContact(payload: any): Promise<NormalizedContact> {
    const emailAddress = this.parseEmailAddress(payload.email);
    return await this.createNormalizedContact(emailAddress, 'email', 'gmail');
  }

  protected async extractToContact(payload: any): Promise<NormalizedContact> {
    const emailAddress = this.parseEmailAddress(payload.email);
    return await this.createNormalizedContact(emailAddress, 'email', 'gmail');
  }

  protected extractBody(payload: GmailPayload): string | undefined {
    // Try to extract body from the main payload
    if (payload.payload.body.data) {
      return this.decodeBase64UrlSafe(payload.payload.body.data);
    }
    
    // If no body in main payload, check parts for text content
    if (payload.payload.parts) {
      for (const part of payload.payload.parts) {
        if (part.mimeType === 'text/plain' && part.body.data) {
          return this.decodeBase64UrlSafe(part.body.data);
        }
      }
      
      // Fallback to HTML content if no plain text
      for (const part of payload.payload.parts) {
        if (part.mimeType === 'text/html' && part.body.data) {
          const htmlContent = this.decodeBase64UrlSafe(part.body.data);
          return this.extractTextFromHtml(htmlContent);
        }
      }
    }
    
    // Fallback to snippet if no body content found
    return payload.snippet;
  }

  protected extractTimestamp(payload: GmailPayload): Date {
    // Gmail internalDate is in milliseconds
    const timestamp = parseInt(payload.internalDate, 10);
    return new Date(timestamp);
  }

  protected async extractAttachments(payload: GmailPayload): Promise<NormalizedAttachment[]> {
    const attachments: NormalizedAttachment[] = [];
    
    if (payload.payload.parts) {
      for (const part of payload.payload.parts) {
        if (part.filename && part.filename.length > 0 && part.body.attachmentId) {
          attachments.push({
            type: part.mimeType,
            filename: part.filename,
            size: part.body.size,
            mimeType: part.mimeType,
            url: `gmail://attachment/${part.body.attachmentId}`, // This would need Gmail API resolution
            metadata: {
              attachmentId: part.body.attachmentId,
              partId: part.partId,
              headers: Object.fromEntries(
                part.headers.map(h => [h.name.toLowerCase(), h.value])
              )
            }
          });
        }
      }
    }
    
    return attachments;
  }

  protected generateThreadKey(rawMessage: RawProviderMessage): string {
    const payload = rawMessage.payload as GmailPayload;
    
    // Use Gmail's thread ID for consistent threading
    return `gmail:${payload.threadId}`;
  }

  private extractHeaders(payload: GmailPayload): Map<string, string> {
    const headers = new Map<string, string>();
    
    for (const header of payload.payload.headers) {
      headers.set(header.name.toLowerCase(), header.value);
    }
    
    return headers;
  }

  private parseEmailAddress(emailString: string): string {
    // Handle "Name <email@domain.com>" format
    const emailMatch = emailString.match(/<([^>]+)>/);
    if (emailMatch) {
      return this.sanitizeEmailAddress(emailMatch[1]);
    }
    
    // Handle plain email address
    return this.sanitizeEmailAddress(emailString);
  }

  private decodeBase64UrlSafe(data: string): string {
    try {
      // Gmail uses URL-safe base64 encoding
      const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
      const padding = '='.repeat((4 - base64.length % 4) % 4);
      return Buffer.from(base64 + padding, 'base64').toString('utf8');
    } catch (error) {
      return data; // Return original if decoding fails
    }
  }

  private extractTextFromHtml(html: string): string {
    // Simple HTML to text conversion
    // In production, you might want to use a proper HTML parser
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private determineEmailDirection(
    from: NormalizedContact, 
    to: NormalizedContact
  ): 'inbound' | 'outbound' {
    // This would typically check against configured business email addresses
    // For now, we'll use a simple heuristic based on common business domains
    const businessDomains = ['gmail.com', 'company.com']; // This would be configurable
    
    const fromDomain = from.normalizedValue.split('@')[1];
    const toDomain = to.normalizedValue.split('@')[1];
    
    // If the "from" domain is in our business domains, it's outbound
    if (businessDomains.includes(fromDomain)) {
      return 'outbound';
    }
    
    // If the "to" domain is in our business domains, it's inbound
    if (businessDomains.includes(toDomain)) {
      return 'inbound';
    }
    
    // Default to inbound for customer emails
    return 'inbound';
  }
}