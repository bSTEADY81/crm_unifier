import { PrismaClient, Message, Attachment, Customer, Provider, Conversation, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export type MessageWithRelations = Message & {
  provider: Provider;
  customer?: Customer | null;
  conversation?: Conversation | null;
  attachments: Attachment[];
};

export type CreateMessageData = {
  providerMessageId: string;
  providerId: string;
  customerId?: string;
  conversationId?: string;
  channel: 'sms' | 'email' | 'voice' | 'whatsapp' | 'facebook' | 'instagram';
  direction: 'inbound' | 'outbound';
  fromIdentifier: string;
  toIdentifier: string;
  threadKey?: string;
  timestamp: Date;
  body?: string;
  providerMeta?: Prisma.JsonValue;
  status?: 'received' | 'processed' | 'failed';
};

export type UpdateMessageData = {
  customerId?: string;
  conversationId?: string;
  body?: string;
  status?: 'received' | 'processed' | 'failed';
  providerMeta?: Prisma.JsonValue;
};

export type MessageSearchParams = {
  customerId?: string;
  conversationId?: string;
  providerId?: string;
  channel?: 'sms' | 'email' | 'voice' | 'whatsapp' | 'facebook' | 'instagram';
  direction?: 'inbound' | 'outbound';
  status?: 'received' | 'processed' | 'failed';
  from?: Date;
  to?: Date;
  search?: string;
  page?: number;
  limit?: number;
};

export type MessageListResult = {
  data: MessageWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class MessageModel {
  static async create(data: CreateMessageData): Promise<MessageWithRelations> {
    // Check for duplicate message (same provider + providerMessageId)
    const existing = await prisma.message.findUnique({
      where: {
        providerId_providerMessageId: {
          providerId: data.providerId,
          providerMessageId: data.providerMessageId
        }
      }
    });

    if (existing) {
      throw new Error(`Message with provider ID ${data.providerId} and provider message ID ${data.providerMessageId} already exists`);
    }

    const message = await prisma.message.create({
      data: {
        providerMessageId: data.providerMessageId,
        providerId: data.providerId,
        customerId: data.customerId,
        conversationId: data.conversationId,
        channel: data.channel,
        direction: data.direction,
        fromIdentifier: data.fromIdentifier,
        toIdentifier: data.toIdentifier,
        threadKey: data.threadKey,
        timestamp: data.timestamp,
        body: data.body,
        providerMeta: data.providerMeta || {},
        status: data.status || 'received'
      },
      include: {
        provider: true,
        customer: true,
        conversation: true,
        attachments: true
      }
    });

    return message;
  }

  static async findById(id: string): Promise<MessageWithRelations | null> {
    const message = await prisma.message.findUnique({
      where: { id },
      include: {
        provider: true,
        customer: true,
        conversation: true,
        attachments: true
      }
    });

    return message;
  }

  static async findByIdOrThrow(id: string): Promise<MessageWithRelations> {
    const message = await this.findById(id);
    if (!message) {
      throw new Error('Message not found');
    }
    return message;
  }

  static async findByProviderMessageId(
    providerId: string,
    providerMessageId: string
  ): Promise<MessageWithRelations | null> {
    const message = await prisma.message.findUnique({
      where: {
        providerId_providerMessageId: {
          providerId,
          providerMessageId
        }
      },
      include: {
        provider: true,
        customer: true,
        conversation: true,
        attachments: true
      }
    });

    return message;
  }

  static async update(id: string, data: UpdateMessageData): Promise<MessageWithRelations> {
    const message = await prisma.message.update({
      where: { id },
      data: {
        ...(data.customerId !== undefined && { customerId: data.customerId }),
        ...(data.conversationId !== undefined && { conversationId: data.conversationId }),
        ...(data.body !== undefined && { body: data.body }),
        ...(data.status && { status: data.status }),
        ...(data.providerMeta !== undefined && { providerMeta: data.providerMeta })
      },
      include: {
        provider: true,
        customer: true,
        conversation: true,
        attachments: true
      }
    });

    return message;
  }

  static async delete(id: string): Promise<void> {
    await prisma.message.delete({
      where: { id }
    });
  }

  static async list(params: MessageSearchParams = {}): Promise<MessageListResult> {
    const {
      customerId,
      conversationId,
      providerId,
      channel,
      direction,
      status,
      from,
      to,
      search,
      page = 1,
      limit = 50
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.MessageWhereInput = {
      ...(customerId && { customerId }),
      ...(conversationId && { conversationId }),
      ...(providerId && { providerId }),
      ...(channel && { channel }),
      ...(direction && { direction }),
      ...(status && { status }),
      ...(from || to) && {
        timestamp: {
          ...(from && { gte: from }),
          ...(to && { lte: to })
        }
      },
      ...(search && {
        OR: [
          { body: { contains: search, mode: 'insensitive' } },
          { fromIdentifier: { contains: search, mode: 'insensitive' } },
          { toIdentifier: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } }
        ]
      })
    };

    // Execute queries in parallel
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          provider: true,
          customer: true,
          conversation: true,
          attachments: true
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.message.count({ where })
    ]);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async findByThreadKey(threadKey: string): Promise<MessageWithRelations[]> {
    const messages = await prisma.message.findMany({
      where: { threadKey },
      include: {
        provider: true,
        customer: true,
        conversation: true,
        attachments: true
      },
      orderBy: { timestamp: 'asc' }
    });

    return messages;
  }

  static async findByCustomerTimeline(
    customerId: string,
    options: {
      channel?: 'sms' | 'email' | 'voice' | 'whatsapp' | 'facebook' | 'instagram';
      from?: Date;
      to?: Date;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const {
      channel,
      from,
      to,
      page = 1,
      limit = 50
    } = options;

    const skip = (page - 1) * limit;

    const where: Prisma.MessageWhereInput = {
      customerId,
      ...(channel && { channel }),
      ...(from || to) && {
        timestamp: {
          ...(from && { gte: from }),
          ...(to && { lte: to })
        }
      }
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          provider: true,
          customer: true,
          conversation: true,
          attachments: true
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.message.count({ where })
    ]);

    return {
      customerId,
      messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async markAsProcessed(id: string): Promise<MessageWithRelations> {
    return this.update(id, { status: 'processed' });
  }

  static async markAsFailed(id: string): Promise<MessageWithRelations> {
    return this.update(id, { status: 'failed' });
  }

  static async linkToCustomer(id: string, customerId: string): Promise<MessageWithRelations> {
    return this.update(id, { customerId });
  }

  static async linkToConversation(id: string, conversationId: string): Promise<MessageWithRelations> {
    return this.update(id, { conversationId });
  }

  static async findUnprocessed(limit: number = 100): Promise<MessageWithRelations[]> {
    const messages = await prisma.message.findMany({
      where: { status: 'received' },
      include: {
        provider: true,
        customer: true,
        conversation: true,
        attachments: true
      },
      orderBy: { timestamp: 'asc' },
      take: limit
    });

    return messages;
  }

  static async findDuplicates(
    providerId: string,
    providerMessageId: string
  ): Promise<MessageWithRelations[]> {
    const messages = await prisma.message.findMany({
      where: {
        providerId,
        providerMessageId
      },
      include: {
        provider: true,
        customer: true,
        conversation: true,
        attachments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return messages;
  }

  static async getStats() {
    const [
      totalMessages,
      processedMessages,
      failedMessages,
      messagesByChannel,
      messagesByDirection,
      recentMessages
    ] = await Promise.all([
      prisma.message.count(),
      prisma.message.count({ where: { status: 'processed' } }),
      prisma.message.count({ where: { status: 'failed' } }),
      prisma.message.groupBy({
        by: ['channel'],
        _count: { _all: true }
      }),
      prisma.message.groupBy({
        by: ['direction'],
        _count: { _all: true }
      }),
      prisma.message.count({
        where: {
          timestamp: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    return {
      totalMessages,
      processedMessages,
      failedMessages,
      messagesByChannel: messagesByChannel.reduce((acc, item) => {
        acc[item.channel] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      messagesByDirection: messagesByDirection.reduce((acc, item) => {
        acc[item.direction] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      recentMessages
    };
  }

  static async exists(id: string): Promise<boolean> {
    const count = await prisma.message.count({
      where: { id }
    });
    return count > 0;
  }

  static async existsByProviderMessageId(
    providerId: string,
    providerMessageId: string
  ): Promise<boolean> {
    const count = await prisma.message.count({
      where: {
        providerId,
        providerMessageId
      }
    });
    return count > 0;
  }

  static async fullTextSearch(query: string, options: {
    customerId?: string;
    channel?: string;
    from?: Date;
    to?: Date;
    page?: number;
    limit?: number;
  } = {}): Promise<MessageListResult> {
    const {
      customerId,
      channel,
      from,
      to,
      page = 1,
      limit = 50
    } = options;

    const skip = (page - 1) * limit;

    const where: Prisma.MessageWhereInput = {
      ...(customerId && { customerId }),
      ...(channel && { channel: channel as any }),
      ...(from || to) && {
        timestamp: {
          ...(from && { gte: from }),
          ...(to && { lte: to })
        }
      },
      OR: [
        { body: { contains: query, mode: 'insensitive' } },
        { fromIdentifier: { contains: query, mode: 'insensitive' } },
        { toIdentifier: { contains: query, mode: 'insensitive' } }
      ]
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          provider: true,
          customer: true,
          conversation: true,
          attachments: true
        },
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit
      }),
      prisma.message.count({ where })
    ]);

    return {
      data: messages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }
}

export default MessageModel;