import { PrismaClient, Conversation, Customer, Message, ConversationAssignment, User, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export type ConversationWithRelations = Conversation & {
  customer: Customer;
  messages: Message[];
  assignment?: ConversationAssignment & {
    user: User;
    assigner: User;
  } | null;
};

export type CreateConversationData = {
  threadKey: string;
  customerId: string;
  channel: 'sms' | 'email' | 'voice' | 'whatsapp' | 'facebook' | 'instagram';
  tags?: string[];
  status?: 'active' | 'archived' | 'assigned';
};

export type UpdateConversationData = {
  tags?: string[];
  status?: 'active' | 'archived' | 'assigned';
  lastMessageAt?: Date;
};

export type ConversationSearchParams = {
  customerId?: string;
  channel?: 'sms' | 'email' | 'voice' | 'whatsapp' | 'facebook' | 'instagram';
  status?: 'active' | 'archived' | 'assigned';
  assignedUserId?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
};

export type ConversationListResult = {
  data: ConversationWithRelations[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AssignConversationData = {
  userId: string;
  assignedBy: string;
  notes?: string;
};

export class ConversationModel {
  static async create(data: CreateConversationData): Promise<ConversationWithRelations> {
    // Check if conversation with threadKey already exists
    const existing = await prisma.conversation.findUnique({
      where: { threadKey: data.threadKey }
    });

    if (existing) {
      throw new Error(`Conversation with thread key ${data.threadKey} already exists`);
    }

    const conversation = await prisma.conversation.create({
      data: {
        threadKey: data.threadKey,
        customerId: data.customerId,
        channel: data.channel,
        tags: data.tags || [],
        status: data.status || 'active'
      },
      include: {
        customer: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 10 // Latest 10 messages
        },
        assignment: {
          include: {
            user: true,
            assigner: true
          }
        }
      }
    });

    return conversation;
  }

  static async findById(id: string): Promise<ConversationWithRelations | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { id },
      include: {
        customer: true,
        messages: {
          orderBy: { timestamp: 'desc' }
        },
        assignment: {
          include: {
            user: true,
            assigner: true
          }
        }
      }
    });

    return conversation;
  }

  static async findByIdOrThrow(id: string): Promise<ConversationWithRelations> {
    const conversation = await this.findById(id);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    return conversation;
  }

  static async findByThreadKey(threadKey: string): Promise<ConversationWithRelations | null> {
    const conversation = await prisma.conversation.findUnique({
      where: { threadKey },
      include: {
        customer: true,
        messages: {
          orderBy: { timestamp: 'desc' }
        },
        assignment: {
          include: {
            user: true,
            assigner: true
          }
        }
      }
    });

    return conversation;
  }

  static async update(id: string, data: UpdateConversationData): Promise<ConversationWithRelations> {
    const conversation = await prisma.conversation.update({
      where: { id },
      data: {
        ...(data.tags !== undefined && { tags: data.tags }),
        ...(data.status && { status: data.status }),
        ...(data.lastMessageAt && { lastMessageAt: data.lastMessageAt })
      },
      include: {
        customer: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 10
        },
        assignment: {
          include: {
            user: true,
            assigner: true
          }
        }
      }
    });

    return conversation;
  }

  static async delete(id: string): Promise<void> {
    await prisma.conversation.delete({
      where: { id }
    });
  }

  static async list(params: ConversationSearchParams = {}): Promise<ConversationListResult> {
    const {
      customerId,
      channel,
      status,
      assignedUserId,
      tags,
      search,
      page = 1,
      limit = 50
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.ConversationWhereInput = {
      ...(customerId && { customerId }),
      ...(channel && { channel }),
      ...(status && { status }),
      ...(assignedUserId && {
        assignment: {
          userId: assignedUserId
        }
      }),
      ...(tags && tags.length > 0 && {
        tags: {
          hasEvery: tags
        }
      }),
      ...(search && {
        OR: [
          { customer: { name: { contains: search, mode: 'insensitive' } } },
          { threadKey: { contains: search, mode: 'insensitive' } },
          { messages: { some: { body: { contains: search, mode: 'insensitive' } } } }
        ]
      })
    };

    // Execute queries in parallel
    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        include: {
          customer: true,
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 1 // Just the latest message for list view
          },
          assignment: {
            include: {
              user: true,
              assigner: true
            }
          }
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.conversation.count({ where })
    ]);

    return {
      data: conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async assign(conversationId: string, data: AssignConversationData): Promise<ConversationWithRelations> {
    // Use transaction to ensure consistency
    const result = await prisma.$transaction(async (tx) => {
      // Remove existing assignment if any
      await tx.conversationAssignment.deleteMany({
        where: { conversationId }
      });

      // Create new assignment
      await tx.conversationAssignment.create({
        data: {
          conversationId,
          userId: data.userId,
          assignedBy: data.assignedBy,
          notes: data.notes
        }
      });

      // Update conversation status
      await tx.conversation.update({
        where: { id: conversationId },
        data: { status: 'assigned' }
      });

      // Return updated conversation
      return tx.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: {
          customer: true,
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 10
          },
          assignment: {
            include: {
              user: true,
              assigner: true
            }
          }
        }
      });
    });

    return result;
  }

  static async unassign(conversationId: string): Promise<ConversationWithRelations> {
    const result = await prisma.$transaction(async (tx) => {
      // Remove assignment
      await tx.conversationAssignment.deleteMany({
        where: { conversationId }
      });

      // Update conversation status back to active
      await tx.conversation.update({
        where: { id: conversationId },
        data: { status: 'active' }
      });

      // Return updated conversation
      return tx.conversation.findUniqueOrThrow({
        where: { id: conversationId },
        include: {
          customer: true,
          messages: {
            orderBy: { timestamp: 'desc' },
            take: 10
          },
          assignment: null
        }
      });
    });

    return result;
  }

  static async addTags(id: string, newTags: string[]): Promise<ConversationWithRelations> {
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id }
    });

    const uniqueTags = Array.from(new Set([...conversation.tags, ...newTags]));

    return this.update(id, { tags: uniqueTags });
  }

  static async removeTags(id: string, tagsToRemove: string[]): Promise<ConversationWithRelations> {
    const conversation = await prisma.conversation.findUniqueOrThrow({
      where: { id }
    });

    const updatedTags = conversation.tags.filter(tag => !tagsToRemove.includes(tag));

    return this.update(id, { tags: updatedTags });
  }

  static async updateLastMessageAt(id: string, timestamp: Date): Promise<void> {
    await prisma.conversation.update({
      where: { id },
      data: { lastMessageAt: timestamp }
    });
  }

  static async findByCustomerId(customerId: string): Promise<Conversation[]> {
    const conversations = await prisma.conversation.findMany({
      where: { customerId },
      orderBy: { lastMessageAt: 'desc' }
    });

    return conversations;
  }

  static async findAssignedToUser(userId: string): Promise<ConversationWithRelations[]> {
    const conversations = await prisma.conversation.findMany({
      where: {
        assignment: {
          userId
        }
      },
      include: {
        customer: true,
        messages: {
          orderBy: { timestamp: 'desc' },
          take: 1
        },
        assignment: {
          include: {
            user: true,
            assigner: true
          }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });

    return conversations;
  }

  static async archive(id: string): Promise<ConversationWithRelations> {
    return this.update(id, { status: 'archived' });
  }

  static async unarchive(id: string): Promise<ConversationWithRelations> {
    return this.update(id, { status: 'active' });
  }

  static async getStats() {
    const [
      totalConversations,
      activeConversations,
      assignedConversations,
      archivedConversations,
      conversationsByChannel,
      unassignedConversations,
      recentConversations
    ] = await Promise.all([
      prisma.conversation.count(),
      prisma.conversation.count({ where: { status: 'active' } }),
      prisma.conversation.count({ where: { status: 'assigned' } }),
      prisma.conversation.count({ where: { status: 'archived' } }),
      prisma.conversation.groupBy({
        by: ['channel'],
        _count: { _all: true }
      }),
      prisma.conversation.count({
        where: {
          AND: [
            { status: 'active' },
            { assignment: null }
          ]
        }
      }),
      prisma.conversation.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    return {
      totalConversations,
      activeConversations,
      assignedConversations,
      archivedConversations,
      conversationsByChannel: conversationsByChannel.reduce((acc, item) => {
        acc[item.channel] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      unassignedConversations,
      recentConversations
    };
  }

  static async exists(id: string): Promise<boolean> {
    const count = await prisma.conversation.count({
      where: { id }
    });
    return count > 0;
  }

  static async existsByThreadKey(threadKey: string): Promise<boolean> {
    const count = await prisma.conversation.count({
      where: { threadKey }
    });
    return count > 0;
  }

  static async findOrCreateByThreadKey(
    threadKey: string,
    data: Omit<CreateConversationData, 'threadKey'>
  ): Promise<ConversationWithRelations> {
    const existing = await this.findByThreadKey(threadKey);
    if (existing) {
      return existing;
    }

    return this.create({ ...data, threadKey });
  }

  static async getAllTags(): Promise<string[]> {
    const conversations = await prisma.conversation.findMany({
      select: { tags: true }
    });

    const allTags = conversations.flatMap(conv => conv.tags);
    return Array.from(new Set(allTags)).sort();
  }
}

export default ConversationModel;