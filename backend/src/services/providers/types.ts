export interface ProviderConfig {
  type: 'whatsapp' | 'twilio' | 'facebook' | 'instagram' | 'gmail';
  credentials: Record<string, string>;
  settings: Record<string, any>;
}

export interface MessagePayload {
  id: string;
  from: string;
  to: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
  metadata?: Record<string, any>;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  type: 'image' | 'document' | 'audio' | 'video';
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

export interface SendMessageRequest {
  to: string;
  content: string;
  type?: 'text' | 'image' | 'document' | 'audio' | 'video';
  attachments?: MessageAttachment[];
  metadata?: Record<string, any>;
}

export interface SendMessageResponse {
  success: boolean;
  messageId: string;
  providerId?: string;
  error?: string;
  timestamp: Date;
}

export interface WebhookPayload {
  providerId: string;
  signature?: string;
  timestamp: Date;
  data: any;
  headers: Record<string, string>;
}

export interface ProcessedMessage {
  providerMessageId: string;
  customerId?: string;
  channel: string;
  direction: 'inbound' | 'outbound';
  fromIdentifier: string;
  toIdentifier: string;
  content: string;
  timestamp: Date;
  metadata: Record<string, any>;
  attachments: MessageAttachment[];
}

export interface ProviderStatus {
  isConnected: boolean;
  lastHealthCheck: Date;
  error?: string;
  statistics: {
    messagesSent: number;
    messagesReceived: number;
    lastMessageAt?: Date;
  };
}

export interface ConnectionTestResult {
  success: boolean;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export abstract class BaseProviderAdapter {
  protected config: ProviderConfig;
  protected providerId: string;

  constructor(providerId: string, config: ProviderConfig) {
    this.providerId = providerId;
    this.config = config;
  }

  abstract sendMessage(request: SendMessageRequest): Promise<SendMessageResponse>;
  abstract processWebhook(payload: WebhookPayload): Promise<ProcessedMessage[]>;
  abstract testConnection(): Promise<ConnectionTestResult>;
  abstract getStatus(): Promise<ProviderStatus>;
  abstract validateWebhookSignature(payload: WebhookPayload): boolean;

  protected formatPhoneNumber(phone: string): string {
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Add country code if missing (assume US)
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    // Add + if missing
    if (!phone.startsWith('+')) {
      return `+${cleaned}`;
    }
    
    return phone;
  }

  protected generateMessageId(): string {
    return `${this.config.type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}