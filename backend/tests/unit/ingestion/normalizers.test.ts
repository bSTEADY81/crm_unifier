import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { TwilioSMSNormalizer, WhatsAppNormalizer, GmailNormalizer } from '../../../src/lib/ingestion/normalizers/index.js';
import { createRawMessage } from '../../../src/lib/ingestion/index.js';
import { RawProviderMessage } from '../../../src/lib/ingestion/types.js';

const prisma = new PrismaClient();

describe('Message Normalizers', () => {
  let testProviderId: string;

  beforeAll(async () => {
    // Create test provider
    const provider = await prisma.provider.create({
      data: {
        name: 'Test Provider for Normalizers',
        type: 'twilio_sms',
        status: 'active',
        config: { encrypted: true }
      }
    });
    testProviderId = provider.id;
  });

  afterAll(async () => {
    await prisma.provider.delete({ where: { id: testProviderId } });
    await prisma.$disconnect();
  });

  describe('TwilioSMSNormalizer', () => {
    const normalizer = new TwilioSMSNormalizer();

    it('should normalize a basic Twilio SMS message', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-twilio-test-001',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-twilio-test-001',
          AccountSid: 'AC-test-account',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'Hello from Twilio!',
          DateSent: '2023-10-01T10:00:00Z',
          Status: 'received',
          NumMedia: '0'
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.providerMessageId).toBe('SM-twilio-test-001');
      expect(normalized.providerId).toBe(testProviderId);
      expect(normalized.channel).toBe('sms');
      expect(normalized.direction).toBe('inbound');
      expect(normalized.from.normalizedValue).toBe('+1234567890');
      expect(normalized.to.normalizedValue).toBe('+0987654321');
      expect(normalized.body).toBe('Hello from Twilio!');
      expect(normalized.contentType).toBe('text');
      expect(normalized.messageHash).toBeDefined();
      expect(normalized.threadKey).toContain('sms:');
      expect(normalized.providerMeta.accountSid).toBe('AC-test-account');
    });

    it('should handle SMS with media attachments', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-twilio-media-001',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-twilio-media-001',
          AccountSid: 'AC-test-account',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'Check out this image!',
          DateSent: '2023-10-01T10:00:00Z',
          Status: 'received',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/image.jpg',
          MediaContentType0: 'image/jpeg'
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.attachments).toBeDefined();
      expect(normalized.attachments).toHaveLength(1);
      expect(normalized.attachments![0].type).toBe('image/jpeg');
      expect(normalized.attachments![0].url).toBe('https://api.twilio.com/media/image.jpg');
      expect(normalized.contentType).toBe('image');
    });

    it('should normalize phone numbers correctly', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-phone-normalize',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-phone-normalize',
          AccountSid: 'AC-test-account',
          From: '(555) 123-4567', // US format
          To: '+1-555-987-6543',  // International format
          Body: 'Phone normalization test',
          DateSent: '2023-10-01T10:00:00Z',
          Status: 'received',
          NumMedia: '0'
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.from.normalizedValue).toBe('+15551234567');
      expect(normalized.to.normalizedValue).toBe('+15559876543');
    });

    it('should generate consistent thread keys', async () => {
      const rawMessage1: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-thread-001',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-thread-001',
          AccountSid: 'AC-test-account',
          From: '+1234567890',
          To: '+0987654321',
          Body: 'First message',
          DateSent: '2023-10-01T10:00:00Z',
          Status: 'received',
          NumMedia: '0'
        }
      });

      const rawMessage2: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-thread-002',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-thread-002',
          AccountSid: 'AC-test-account',
          From: '+0987654321', // Reversed direction
          To: '+1234567890',
          Body: 'Reply message',
          DateSent: '2023-10-01T10:01:00Z',
          Status: 'received',
          NumMedia: '0'
        }
      });

      const normalized1 = await normalizer.normalize(rawMessage1);
      const normalized2 = await normalizer.normalize(rawMessage2);

      // Thread keys should be the same regardless of direction
      expect(normalized1.threadKey).toBe(normalized2.threadKey);
      expect(normalized1.threadKey).toContain('sms:+0987654321:+1234567890');
    });

    it('should handle missing or empty body', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'SM-empty-body',
        providerType: 'twilio_sms',
        channel: 'sms',
        payload: {
          MessageSid: 'SM-empty-body',
          AccountSid: 'AC-test-account',
          From: '+1234567890',
          To: '+0987654321',
          Body: '',
          DateSent: '2023-10-01T10:00:00Z',
          Status: 'received',
          NumMedia: '0'
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.body).toBeUndefined();
      expect(normalized.contentType).toBe('text');
    });
  });

  describe('WhatsAppNormalizer', () => {
    const normalizer = new WhatsAppNormalizer();

    it('should normalize a basic WhatsApp text message', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'WA-text-001',
        providerType: 'whatsapp',
        channel: 'whatsapp',
        payload: {
          entry: [{
            id: 'entry-id-001',
            changes: [{
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+1234567890',
                  phone_number_id: 'phone-id-001'
                },
                messages: [{
                  id: 'WA-text-001',
                  from: '+0987654321',
                  timestamp: '1696147200',
                  type: 'text',
                  text: { body: 'Hello from WhatsApp!' }
                }]
              },
              field: 'messages'
            }]
          }]
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.providerMessageId).toBe('WA-text-001');
      expect(normalized.channel).toBe('whatsapp');
      expect(normalized.direction).toBe('inbound');
      expect(normalized.from.normalizedValue).toBe('+0987654321');
      expect(normalized.to.normalizedValue).toBe('+1234567890');
      expect(normalized.body).toBe('Hello from WhatsApp!');
      expect(normalized.contentType).toBe('text');
      expect(normalized.threadKey).toContain('whatsapp:');
    });

    it('should handle WhatsApp image messages', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'WA-image-001',
        providerType: 'whatsapp',
        channel: 'whatsapp',
        payload: {
          entry: [{
            id: 'entry-id-001',
            changes: [{
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+1234567890',
                  phone_number_id: 'phone-id-001'
                },
                messages: [{
                  id: 'WA-image-001',
                  from: '+0987654321',
                  timestamp: '1696147200',
                  type: 'image',
                  image: {
                    id: 'image-id-001',
                    mime_type: 'image/jpeg',
                    sha256: 'sha256hash',
                    caption: 'Check this out!'
                  }
                }]
              },
              field: 'messages'
            }]
          }]
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.contentType).toBe('image');
      expect(normalized.body).toBe('Check this out!');
      expect(normalized.attachments).toBeDefined();
      expect(normalized.attachments).toHaveLength(1);
      expect(normalized.attachments![0].type).toBe('image/jpeg');
      expect(normalized.attachments![0].metadata?.whatsappId).toBe('image-id-001');
    });

    it('should handle WhatsApp location messages', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'WA-location-001',
        providerType: 'whatsapp',
        channel: 'whatsapp',
        payload: {
          entry: [{
            id: 'entry-id-001',
            changes: [{
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+1234567890',
                  phone_number_id: 'phone-id-001'
                },
                messages: [{
                  id: 'WA-location-001',
                  from: '+0987654321',
                  timestamp: '1696147200',
                  type: 'location',
                  location: {
                    latitude: -23.5505,
                    longitude: -46.6333,
                    name: 'São Paulo, SP',
                    address: 'São Paulo, State of São Paulo, Brazil'
                  }
                }]
              },
              field: 'messages'
            }]
          }]
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.contentType).toBe('location');
      expect(normalized.body).toContain('Location: -23.5505, -46.6333');
      expect(normalized.body).toContain('São Paulo, SP');
    });

    it('should handle context for replies', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'WA-reply-001',
        providerType: 'whatsapp',
        channel: 'whatsapp',
        payload: {
          entry: [{
            id: 'entry-id-001',
            changes: [{
              value: {
                messaging_product: 'whatsapp',
                metadata: {
                  display_phone_number: '+1234567890',
                  phone_number_id: 'phone-id-001'
                },
                messages: [{
                  id: 'WA-reply-001',
                  from: '+0987654321',
                  timestamp: '1696147200',
                  type: 'text',
                  text: { body: 'This is a reply' },
                  context: {
                    from: '+1234567890',
                    id: 'WA-original-001'
                  }
                }]
              },
              field: 'messages'
            }]
          }]
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.threadKey).toContain('WA-original-001');
      expect(normalized.providerMeta.context).toBeDefined();
    });
  });

  describe('GmailNormalizer', () => {
    const normalizer = new GmailNormalizer();

    it('should normalize a basic Gmail message', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'gmail-msg-001',
        providerType: 'gmail',
        channel: 'email',
        payload: {
          id: 'gmail-msg-001',
          threadId: 'gmail-thread-001',
          labelIds: ['INBOX', 'UNREAD'],
          snippet: 'This is a test email message...',
          historyId: '12345',
          internalDate: '1696147200000',
          payload: {
            partId: '',
            mimeType: 'text/plain',
            filename: '',
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Subject', value: 'Test Email Subject' },
              { name: 'Date', value: 'Mon, 1 Oct 2023 10:00:00 +0000' }
            ],
            body: {
              size: 100,
              data: Buffer.from('Hello from Gmail!').toString('base64url')
            }
          },
          sizeEstimate: 1024
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.providerMessageId).toBe('gmail-msg-001');
      expect(normalized.channel).toBe('email');
      expect(normalized.from.normalizedValue).toBe('sender@example.com');
      expect(normalized.to.normalizedValue).toBe('recipient@example.com');
      expect(normalized.body).toBe('Hello from Gmail!');
      expect(normalized.contentType).toBe('text');
      expect(normalized.threadKey).toBe('gmail:gmail-thread-001');
      expect(normalized.providerMeta.subject).toBe('Test Email Subject');
    });

    it('should handle Gmail messages with attachments', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'gmail-attach-001',
        providerType: 'gmail',
        channel: 'email',
        payload: {
          id: 'gmail-attach-001',
          threadId: 'gmail-thread-002',
          labelIds: ['INBOX'],
          snippet: 'Email with attachment',
          historyId: '12346',
          internalDate: '1696147200000',
          payload: {
            partId: '',
            mimeType: 'multipart/mixed',
            filename: '',
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Subject', value: 'Email with Attachment' }
            ],
            body: { size: 0 },
            parts: [
              {
                partId: '0',
                mimeType: 'text/plain',
                filename: '',
                headers: [],
                body: {
                  size: 50,
                  data: Buffer.from('Email body text').toString('base64url')
                }
              },
              {
                partId: '1',
                mimeType: 'application/pdf',
                filename: 'document.pdf',
                headers: [],
                body: {
                  attachmentId: 'attachment-001',
                  size: 1024
                }
              }
            ]
          },
          sizeEstimate: 2048
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.body).toBe('Email body text');
      expect(normalized.contentType).toBe('document');
      expect(normalized.attachments).toBeDefined();
      expect(normalized.attachments).toHaveLength(1);
      expect(normalized.attachments![0].filename).toBe('document.pdf');
      expect(normalized.attachments![0].type).toBe('application/pdf');
    });

    it('should parse email addresses from headers correctly', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'gmail-parse-001',
        providerType: 'gmail',
        channel: 'email',
        payload: {
          id: 'gmail-parse-001',
          threadId: 'gmail-thread-003',
          labelIds: ['INBOX'],
          snippet: 'Email parsing test',
          historyId: '12347',
          internalDate: '1696147200000',
          payload: {
            partId: '',
            mimeType: 'text/plain',
            filename: '',
            headers: [
              { name: 'From', value: 'John Doe <john.doe@example.com>' },
              { name: 'To', value: 'Jane Smith <jane.smith@example.com>' },
              { name: 'Subject', value: 'Email Parsing Test' }
            ],
            body: {
              size: 20,
              data: Buffer.from('Test email body').toString('base64url')
            }
          },
          sizeEstimate: 512
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.from.normalizedValue).toBe('john.doe@example.com');
      expect(normalized.to.normalizedValue).toBe('jane.smith@example.com');
    });

    it('should fallback to snippet when body is not available', async () => {
      const rawMessage: RawProviderMessage = createRawMessage({
        providerId: testProviderId,
        providerMessageId: 'gmail-snippet-001',
        providerType: 'gmail',
        channel: 'email',
        payload: {
          id: 'gmail-snippet-001',
          threadId: 'gmail-thread-004',
          labelIds: ['INBOX'],
          snippet: 'This is the email snippet fallback',
          historyId: '12348',
          internalDate: '1696147200000',
          payload: {
            partId: '',
            mimeType: 'text/plain',
            filename: '',
            headers: [
              { name: 'From', value: 'sender@example.com' },
              { name: 'To', value: 'recipient@example.com' },
              { name: 'Subject', value: 'Snippet Test' }
            ],
            body: { size: 0 } // No body data
          },
          sizeEstimate: 256
        }
      });

      const normalized = await normalizer.normalize(rawMessage);

      expect(normalized.body).toBe('This is the email snippet fallback');
    });
  });
});