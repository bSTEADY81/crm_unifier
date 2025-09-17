import crypto from 'crypto';
import axios from 'axios';
import { 
  BaseProviderAdapter, 
  SendMessageRequest, 
  SendMessageResponse, 
  WebhookPayload, 
  ProcessedMessage, 
  ProviderStatus, 
  ConnectionTestResult 
} from './types';

export class WhatsAppAdapter extends BaseProviderAdapter {
  private readonly apiUrl = 'https://graph.facebook.com/v17.0';
  private accessToken: string;
  private phoneNumberId: string;
  private webhookVerifyToken: string;

  constructor(providerId: string, config: any) {
    super(providerId, config);
    this.accessToken = config.credentials.accessToken;
    this.phoneNumberId = config.credentials.phoneNumberId;
    this.webhookVerifyToken = config.credentials.webhookVerifyToken;
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      const formattedTo = this.formatPhoneNumber(request.to);
      
      const payload: any = {
        messaging_product: 'whatsapp',
        to: formattedTo,
        type: request.type || 'text',
      };

      if (request.type === 'text' || !request.type) {
        payload.text = { body: request.content };
      } else if (request.attachments && request.attachments.length > 0) {
        const attachment = request.attachments[0];
        payload[attachment.type] = {
          link: attachment.url,
          caption: request.content || ''
        };
      }

      const response = await axios.post(
        `${this.apiUrl}/${this.phoneNumberId}/messages`,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        messageId: this.generateMessageId(),
        providerId: response.data.messages?.[0]?.id,
        timestamp: new Date()
      };

    } catch (error: any) {
      console.error('WhatsApp send message error:', error.response?.data || error.message);
      return {
        success: false,
        messageId: this.generateMessageId(),
        error: error.response?.data?.error?.message || error.message,
        timestamp: new Date()
      };
    }
  }

  async processWebhook(payload: WebhookPayload): Promise<ProcessedMessage[]> {
    const messages: ProcessedMessage[] = [];

    try {
      const data = payload.data;
      
      // WhatsApp webhook verification
      if (data.hub && data.hub.verify_token === this.webhookVerifyToken) {
        return messages; // Return empty for verification
      }

      // Process message webhooks
      if (data.entry) {
        for (const entry of data.entry) {
          if (entry.changes) {
            for (const change of entry.changes) {
              if (change.value?.messages) {
                for (const message of change.value.messages) {
                  const processedMessage = await this.processInboundMessage(message, change.value);
                  if (processedMessage) {
                    messages.push(processedMessage);
                  }
                }
              }

              // Handle status updates
              if (change.value?.statuses) {
                console.log('WhatsApp status update:', change.value.statuses);
                // TODO: Update message status in database
              }
            }
          }
        }
      }

    } catch (error) {
      console.error('WhatsApp webhook processing error:', error);
    }

    return messages;
  }

  private async processInboundMessage(message: any, value: any): Promise<ProcessedMessage | null> {
    try {
      let content = '';
      let attachments: any[] = [];
      let messageType = 'text';

      // Extract message content based on type
      if (message.text) {
        content = message.text.body;
        messageType = 'text';
      } else if (message.image) {
        content = message.image.caption || '';
        messageType = 'image';
        attachments.push({
          id: message.image.id,
          type: 'image',
          url: await this.getMediaUrl(message.image.id),
          mimeType: message.image.mime_type
        });
      } else if (message.document) {
        content = message.document.caption || message.document.filename || '';
        messageType = 'document';
        attachments.push({
          id: message.document.id,
          type: 'document',
          url: await this.getMediaUrl(message.document.id),
          filename: message.document.filename,
          mimeType: message.document.mime_type
        });
      } else if (message.audio) {
        content = 'Voice message';
        messageType = 'audio';
        attachments.push({
          id: message.audio.id,
          type: 'audio',
          url: await this.getMediaUrl(message.audio.id),
          mimeType: message.audio.mime_type
        });
      } else if (message.video) {
        content = message.video.caption || 'Video';
        messageType = 'video';
        attachments.push({
          id: message.video.id,
          type: 'video',
          url: await this.getMediaUrl(message.video.id),
          mimeType: message.video.mime_type
        });
      }

      // Get contact info for the sender
      const contact = value.contacts?.find((c: any) => c.wa_id === message.from);
      const senderName = contact?.profile?.name || message.from;

      return {
        providerMessageId: message.id,
        channel: 'whatsapp',
        direction: 'inbound',
        fromIdentifier: message.from,
        toIdentifier: value.metadata?.phone_number_id || '',
        content,
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        metadata: {
          type: messageType,
          senderName,
          whatsappId: message.from
        },
        attachments
      };

    } catch (error) {
      console.error('Error processing WhatsApp inbound message:', error);
      return null;
    }
  }

  private async getMediaUrl(mediaId: string): Promise<string> {
    try {
      const response = await axios.get(
        `${this.apiUrl}/${mediaId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );
      
      return response.data.url;
    } catch (error) {
      console.error('Error getting WhatsApp media URL:', error);
      return '';
    }
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Test by getting phone number info
      const response = await axios.get(
        `${this.apiUrl}/${this.phoneNumberId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`
          }
        }
      );

      if (response.data.display_phone_number) {
        return {
          success: true,
          message: `Connected to WhatsApp Business ${response.data.display_phone_number}`,
          details: {
            phoneNumber: response.data.display_phone_number,
            verifiedName: response.data.verified_name
          },
          timestamp: new Date()
        };
      }

      return {
        success: false,
        message: 'Unable to verify WhatsApp Business connection',
        timestamp: new Date()
      };

    } catch (error: any) {
      return {
        success: false,
        message: `WhatsApp connection test failed: ${error.response?.data?.error?.message || error.message}`,
        timestamp: new Date()
      };
    }
  }

  async getStatus(): Promise<ProviderStatus> {
    const testResult = await this.testConnection();
    
    return {
      isConnected: testResult.success,
      lastHealthCheck: new Date(),
      error: testResult.success ? undefined : testResult.message,
      statistics: {
        messagesSent: 0, // TODO: Implement from database
        messagesReceived: 0, // TODO: Implement from database
      }
    };
  }

  validateWebhookSignature(payload: WebhookPayload): boolean {
    try {
      const signature = payload.headers['x-hub-signature-256'];
      if (!signature) return false;

      const expectedSignature = crypto
        .createHmac('sha256', this.webhookVerifyToken)
        .update(JSON.stringify(payload.data))
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      console.error('WhatsApp signature validation error:', error);
      return false;
    }
  }
}