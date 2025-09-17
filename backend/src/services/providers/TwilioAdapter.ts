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

export class TwilioAdapter extends BaseProviderAdapter {
  private readonly apiUrl = 'https://api.twilio.com/2010-04-01/Accounts';
  private accountSid: string;
  private authToken: string;
  private phoneNumber: string;

  constructor(providerId: string, config: any) {
    super(providerId, config);
    this.accountSid = config.credentials.accountSid;
    this.authToken = config.credentials.authToken;
    this.phoneNumber = config.credentials.phoneNumber;
  }

  async sendMessage(request: SendMessageRequest): Promise<SendMessageResponse> {
    try {
      const formattedTo = this.formatPhoneNumber(request.to);
      const fromNumber = this.formatPhoneNumber(this.phoneNumber);
      
      const payload = new URLSearchParams();
      payload.append('To', formattedTo);
      payload.append('From', fromNumber);
      payload.append('Body', request.content);

      // Handle media attachments
      if (request.attachments && request.attachments.length > 0) {
        request.attachments.forEach((attachment, index) => {
          payload.append(`MediaUrl`, attachment.url);
        });
      }

      const response = await axios.post(
        `${this.apiUrl}/${this.accountSid}/Messages.json`,
        payload,
        {
          auth: {
            username: this.accountSid,
            password: this.authToken
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        success: true,
        messageId: this.generateMessageId(),
        providerId: response.data.sid,
        timestamp: new Date()
      };

    } catch (error: any) {
      console.error('Twilio send message error:', error.response?.data || error.message);
      return {
        success: false,
        messageId: this.generateMessageId(),
        error: error.response?.data?.message || error.message,
        timestamp: new Date()
      };
    }
  }

  async processWebhook(payload: WebhookPayload): Promise<ProcessedMessage[]> {
    const messages: ProcessedMessage[] = [];

    try {
      const data = payload.data;
      
      // Check if this is an inbound message
      if (data.MessageSid && data.Body !== undefined) {
        const processedMessage = this.processTwilioMessage(data);
        if (processedMessage) {
          messages.push(processedMessage);
        }
      }

      // Handle delivery status callbacks
      if (data.MessageStatus && data.MessageSid) {
        console.log('Twilio message status update:', {
          sid: data.MessageSid,
          status: data.MessageStatus,
          errorCode: data.ErrorCode
        });
        // TODO: Update message status in database
      }

    } catch (error) {
      console.error('Twilio webhook processing error:', error);
    }

    return messages;
  }

  private processTwilioMessage(data: any): ProcessedMessage | null {
    try {
      // Extract attachments from Twilio webhook
      const attachments = [];
      const numMedia = parseInt(data.NumMedia || '0');
      
      for (let i = 0; i < numMedia; i++) {
        const mediaUrl = data[`MediaUrl${i}`];
        const mediaType = data[`MediaContentType${i}`];
        
        if (mediaUrl) {
          attachments.push({
            id: `twilio_media_${i}`,
            type: this.getAttachmentType(mediaType),
            url: mediaUrl,
            mimeType: mediaType
          });
        }
      }

      return {
        providerMessageId: data.MessageSid,
        channel: 'sms',
        direction: 'inbound',
        fromIdentifier: data.From,
        toIdentifier: data.To,
        content: data.Body || '',
        timestamp: new Date(),
        metadata: {
          accountSid: data.AccountSid,
          messagingServiceSid: data.MessagingServiceSid,
          numSegments: data.NumSegments,
          price: data.Price,
          priceUnit: data.PriceUnit,
          apiVersion: data.ApiVersion
        },
        attachments
      };

    } catch (error) {
      console.error('Error processing Twilio inbound message:', error);
      return null;
    }
  }

  private getAttachmentType(mimeType: string): 'image' | 'document' | 'audio' | 'video' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'document';
  }

  async testConnection(): Promise<ConnectionTestResult> {
    try {
      // Test connection by getting account info
      const response = await axios.get(
        `${this.apiUrl}/${this.accountSid}.json`,
        {
          auth: {
            username: this.accountSid,
            password: this.authToken
          }
        }
      );

      if (response.data.status === 'active') {
        return {
          success: true,
          message: `Connected to Twilio account: ${response.data.friendly_name}`,
          details: {
            accountSid: response.data.sid,
            friendlyName: response.data.friendly_name,
            status: response.data.status
          },
          timestamp: new Date()
        };
      }

      return {
        success: false,
        message: 'Twilio account is not active',
        details: { status: response.data.status },
        timestamp: new Date()
      };

    } catch (error: any) {
      return {
        success: false,
        message: `Twilio connection test failed: ${error.response?.data?.message || error.message}`,
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
      const signature = payload.headers['x-twilio-signature'];
      if (!signature) return false;

      // Twilio signature validation
      const url = `https://${payload.headers.host}${payload.headers['x-original-uri'] || '/api/v1/webhooks/twilio'}`;
      
      // Build the data string from form parameters
      const data = typeof payload.data === 'string' ? payload.data : 
        Object.keys(payload.data)
          .sort()
          .map(key => `${key}=${payload.data[key]}`)
          .join('&');
      
      const dataString = url + data;
      
      const expectedSignature = crypto
        .createHmac('sha1', this.authToken)
        .update(dataString, 'utf-8')
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Twilio signature validation error:', error);
      return false;
    }
  }
}