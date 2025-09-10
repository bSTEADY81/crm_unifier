import { z } from 'zod';

export const ChannelTypeSchema = z.enum(['sms', 'email', 'voice', 'whatsapp', 'facebook', 'instagram']);
export const MessageDirectionSchema = z.enum(['inbound', 'outbound']);
export const IngestionStatusSchema = z.enum(['pending', 'processing', 'success', 'failed', 'duplicate']);

export const NormalizedContactSchema = z.object({
  identifier: z.string().min(1, 'Contact identifier is required'),
  normalizedValue: z.string().min(1, 'Normalized value is required'),
  rawValue: z.string().min(1, 'Raw value is required'),
  type: z.enum(['phone', 'email', 'social']),
  verified: z.boolean().optional(),
  provider: z.string().optional()
});

export const NormalizedAttachmentSchema = z.object({
  type: z.string().min(1, 'Attachment type is required'),
  filename: z.string().optional(),
  size: z.number().int().min(0).optional(),
  mimeType: z.string().optional(),
  url: z.string().url('Invalid attachment URL'),
  thumbnailUrl: z.string().url().optional(),
  metadata: z.record(z.any()).optional()
});

export const NormalizedMessageSchema = z.object({
  providerMessageId: z.string().min(1, 'Provider message ID is required'),
  providerId: z.string().uuid('Invalid provider ID format'),
  channel: ChannelTypeSchema,
  direction: MessageDirectionSchema,
  from: NormalizedContactSchema,
  to: NormalizedContactSchema,
  timestamp: z.date(),
  body: z.string().optional(),
  contentType: z.enum(['text', 'image', 'audio', 'video', 'document', 'location']).optional(),
  threadKey: z.string().optional(),
  providerMeta: z.record(z.any()),
  attachments: z.array(NormalizedAttachmentSchema).optional(),
  messageHash: z.string().min(1, 'Message hash is required')
});

export const IdentityResolutionSchema = z.object({
  customerId: z.string().uuid().optional(),
  isNewCustomer: z.boolean(),
  confidence: z.number().min(0).max(1),
  matchedIdentities: z.array(z.object({
    identityId: z.string().uuid(),
    type: z.enum(['phone', 'email', 'social']),
    value: z.string(),
    customerId: z.string().uuid()
  })),
  suggestedName: z.string().optional()
});

export const ThreadingContextSchema = z.object({
  threadKey: z.string().min(1, 'Thread key is required'),
  conversationId: z.string().uuid().optional(),
  isNewConversation: z.boolean(),
  relatedMessages: z.array(z.string().uuid())
});

export const IngestionResultSchema = z.object({
  status: IngestionStatusSchema,
  messageId: z.string().uuid().optional(),
  normalizedMessage: NormalizedMessageSchema.optional(),
  identityResolution: IdentityResolutionSchema.optional(),
  threadingContext: ThreadingContextSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.any()).optional()
  }).optional(),
  processingMetrics: z.object({
    startTime: z.date(),
    endTime: z.date().optional(),
    durationMs: z.number().int().min(0).optional(),
    stagesCompleted: z.array(z.string()),
    stagesFailed: z.array(z.string()).optional()
  })
});

export const RawProviderMessageSchema = z.object({
  providerId: z.string().uuid('Invalid provider ID format'),
  providerMessageId: z.string().min(1, 'Provider message ID is required'),
  providerType: z.string().min(1, 'Provider type is required'),
  channel: ChannelTypeSchema,
  timestamp: z.union([z.date(), z.string().datetime()]),
  payload: z.record(z.any()),
  webhookSignature: z.string().optional(),
  rawHeaders: z.record(z.string()).optional()
});

export const TwilioSMSPayloadSchema = z.object({
  MessageSid: z.string().min(1, 'MessageSid is required'),
  AccountSid: z.string().min(1, 'AccountSid is required'),
  From: z.string().min(1, 'From number is required'),
  To: z.string().min(1, 'To number is required'),
  Body: z.string(),
  DateSent: z.string().optional(),
  Direction: z.string().optional(),
  Status: z.string().optional(),
  NumMedia: z.string().optional(),
  MediaUrl0: z.string().url().optional(),
  MediaContentType0: z.string().optional(),
  SmsStatus: z.string().optional(),
  NumSegments: z.string().optional()
});

export const WhatsAppMessageSchema = z.object({
  id: z.string().min(1),
  from: z.string().min(1),
  timestamp: z.string().min(1),
  type: z.enum(['text', 'image', 'audio', 'video', 'document', 'location']),
  text: z.object({ body: z.string() }).optional(),
  image: z.object({ 
    id: z.string(), 
    mime_type: z.string(), 
    sha256: z.string(), 
    caption: z.string().optional() 
  }).optional(),
  audio: z.object({ 
    id: z.string(), 
    mime_type: z.string(), 
    sha256: z.string() 
  }).optional(),
  video: z.object({ 
    id: z.string(), 
    mime_type: z.string(), 
    sha256: z.string(), 
    caption: z.string().optional() 
  }).optional(),
  document: z.object({ 
    id: z.string(), 
    mime_type: z.string(), 
    sha256: z.string(), 
    filename: z.string().optional(), 
    caption: z.string().optional() 
  }).optional(),
  location: z.object({ 
    latitude: z.number(), 
    longitude: z.number(), 
    name: z.string().optional(), 
    address: z.string().optional() 
  }).optional(),
  context: z.object({
    from: z.string(),
    id: z.string()
  }).optional()
});

export const WhatsAppPayloadSchema = z.object({
  entry: z.array(z.object({
    id: z.string(),
    changes: z.array(z.object({
      value: z.object({
        messaging_product: z.literal('whatsapp'),
        metadata: z.object({
          display_phone_number: z.string(),
          phone_number_id: z.string()
        }),
        messages: z.array(WhatsAppMessageSchema).optional(),
        statuses: z.array(z.object({
          id: z.string(),
          status: z.enum(['sent', 'delivered', 'read', 'failed']),
          timestamp: z.string(),
          recipient_id: z.string()
        })).optional()
      }),
      field: z.string()
    }))
  }))
});

export const GmailPayloadSchema = z.object({
  id: z.string().min(1, 'Gmail message ID is required'),
  threadId: z.string().min(1, 'Gmail thread ID is required'),
  labelIds: z.array(z.string()),
  snippet: z.string(),
  historyId: z.string(),
  internalDate: z.string(),
  payload: z.object({
    partId: z.string(),
    mimeType: z.string(),
    filename: z.string(),
    headers: z.array(z.object({
      name: z.string(),
      value: z.string()
    })),
    body: z.object({
      attachmentId: z.string().optional(),
      size: z.number().int().min(0),
      data: z.string().optional()
    }),
    parts: z.array(z.object({
      partId: z.string(),
      mimeType: z.string(),
      filename: z.string(),
      headers: z.array(z.object({
        name: z.string(),
        value: z.string()
      })),
      body: z.object({
        attachmentId: z.string().optional(),
        size: z.number().int().min(0),
        data: z.string().optional()
      })
    })).optional()
  }),
  sizeEstimate: z.number().int().min(0)
});

export const ChannelNormalizerConfigSchema = z.object({
  channelType: ChannelTypeSchema,
  providerType: z.string().min(1),
  identityExtractor: z.enum(['phone', 'email', 'social']),
  threadingStrategy: z.enum(['phone_based', 'conversation_id', 'email_thread', 'social_mention']),
  duplicateWindow: z.number().int().min(1).max(1440), // 1 minute to 24 hours
  supportedContentTypes: z.array(z.string())
});

export function validateNormalizedMessage(message: unknown): z.infer<typeof NormalizedMessageSchema> {
  return NormalizedMessageSchema.parse(message);
}

export function validateRawProviderMessage(message: unknown): z.infer<typeof RawProviderMessageSchema> {
  return RawProviderMessageSchema.parse(message);
}

export function validateIngestionResult(result: unknown): z.infer<typeof IngestionResultSchema> {
  return IngestionResultSchema.parse(result);
}

export function validateTwilioPayload(payload: unknown): z.infer<typeof TwilioSMSPayloadSchema> {
  return TwilioSMSPayloadSchema.parse(payload);
}

export function validateWhatsAppPayload(payload: unknown): z.infer<typeof WhatsAppPayloadSchema> {
  return WhatsAppPayloadSchema.parse(payload);
}

export function validateGmailPayload(payload: unknown): z.infer<typeof GmailPayloadSchema> {
  return GmailPayloadSchema.parse(payload);
}