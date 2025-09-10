export type ChannelType = 'sms' | 'email' | 'voice' | 'whatsapp' | 'facebook' | 'instagram';
export type MessageDirection = 'inbound' | 'outbound';
export type IngestionStatus = 'pending' | 'processing' | 'success' | 'failed' | 'duplicate';

export interface RawProviderMessage {
  providerId: string;
  providerMessageId: string;
  providerType: string;
  channel: ChannelType;
  timestamp: Date | string;
  payload: Record<string, any>;
  webhookSignature?: string;
  rawHeaders?: Record<string, string>;
}

export interface NormalizedContact {
  identifier: string;
  normalizedValue: string;
  rawValue: string;
  type: 'phone' | 'email' | 'social';
  verified?: boolean;
  provider?: string;
}

export interface NormalizedMessage {
  providerMessageId: string;
  providerId: string;
  channel: ChannelType;
  direction: MessageDirection;
  from: NormalizedContact;
  to: NormalizedContact;
  timestamp: Date;
  body?: string;
  contentType?: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location';
  threadKey?: string;
  providerMeta: Record<string, any>;
  attachments?: NormalizedAttachment[];
  messageHash: string;
}

export interface NormalizedAttachment {
  type: string;
  filename?: string;
  size?: number;
  mimeType?: string;
  url: string;
  thumbnailUrl?: string;
  metadata?: Record<string, any>;
}

export interface IdentityResolution {
  customerId?: string;
  isNewCustomer: boolean;
  confidence: number;
  matchedIdentities: Array<{
    identityId: string;
    type: 'phone' | 'email' | 'social';
    value: string;
    customerId: string;
  }>;
  suggestedName?: string;
}

export interface ThreadingContext {
  threadKey: string;
  conversationId?: string;
  isNewConversation: boolean;
  relatedMessages: string[];
}

export interface IngestionResult {
  status: IngestionStatus;
  messageId?: string;
  normalizedMessage?: NormalizedMessage;
  identityResolution?: IdentityResolution;
  threadingContext?: ThreadingContext;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  processingMetrics: {
    startTime: Date;
    endTime?: Date;
    durationMs?: number;
    stagesCompleted: string[];
    stagesFailed?: string[];
  };
}

export interface ChannelNormalizerConfig {
  channelType: ChannelType;
  providerType: string;
  identityExtractor: 'phone' | 'email' | 'social';
  threadingStrategy: 'phone_based' | 'conversation_id' | 'email_thread' | 'social_mention';
  duplicateWindow: number; // minutes
  supportedContentTypes: string[];
}

export interface TwilioSMSPayload {
  MessageSid: string;
  AccountSid: string;
  From: string;
  To: string;
  Body: string;
  DateSent?: string;
  Direction?: string;
  Status?: string;
  NumMedia?: string;
  MediaUrl0?: string;
  MediaContentType0?: string;
  SmsStatus?: string;
  NumSegments?: string;
}

export interface WhatsAppPayload {
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: 'whatsapp';
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        messages?: Array<{
          id: string;
          from: string;
          timestamp: string;
          type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location';
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string; caption?: string };
          audio?: { id: string; mime_type: string; sha256: string };
          video?: { id: string; mime_type: string; sha256: string; caption?: string };
          document?: { id: string; mime_type: string; sha256: string; filename?: string; caption?: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          context?: {
            from: string;
            id: string;
          };
        }>;
        statuses?: Array<{
          id: string;
          status: 'sent' | 'delivered' | 'read' | 'failed';
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

export interface GmailPayload {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: Array<{
      name: string;
      value: string;
    }>;
    body: {
      attachmentId?: string;
      size: number;
      data?: string;
    };
    parts?: Array<{
      partId: string;
      mimeType: string;
      filename: string;
      headers: Array<{
        name: string;
        value: string;
      }>;
      body: {
        attachmentId?: string;
        size: number;
        data?: string;
      };
    }>;
  };
  sizeEstimate: number;
}

export interface NormalizationError extends Error {
  code: 'INVALID_PAYLOAD' | 'PROVIDER_NOT_SUPPORTED' | 'IDENTITY_RESOLUTION_FAILED' | 
        'DUPLICATE_MESSAGE' | 'THREADING_FAILED' | 'VALIDATION_FAILED' | 'UNKNOWN_ERROR';
  providerId: string;
  providerMessageId?: string;
  details?: Record<string, any>;
}

export class IngestionError extends Error implements NormalizationError {
  public code: NormalizationError['code'];
  public providerId: string;
  public providerMessageId?: string;
  public details?: Record<string, any>;

  constructor(
    code: NormalizationError['code'],
    message: string,
    providerId: string,
    providerMessageId?: string,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'IngestionError';
    this.code = code;
    this.providerId = providerId;
    this.providerMessageId = providerMessageId;
    this.details = details;
  }
}