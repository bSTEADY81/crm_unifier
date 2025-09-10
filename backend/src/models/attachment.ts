import { PrismaClient, Attachment, Message, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export type AttachmentWithMessage = Attachment & {
  message: Message;
};

export type CreateAttachmentData = {
  messageId: string;
  type: string;
  filename?: string;
  size?: number;
  storageUrl: string;
  thumbnailUrl?: string;
  metadata?: Prisma.JsonValue;
};

export type UpdateAttachmentData = {
  type?: string;
  filename?: string;
  size?: number;
  storageUrl?: string;
  thumbnailUrl?: string;
  metadata?: Prisma.JsonValue;
};

export type AttachmentSearchParams = {
  messageId?: string;
  type?: string;
  filename?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type AttachmentListResult = {
  data: AttachmentWithMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class AttachmentModel {
  static async create(data: CreateAttachmentData): Promise<Attachment> {
    const attachment = await prisma.attachment.create({
      data: {
        messageId: data.messageId,
        type: data.type,
        filename: data.filename,
        size: data.size,
        storageUrl: data.storageUrl,
        thumbnailUrl: data.thumbnailUrl,
        metadata: data.metadata || {}
      }
    });

    return attachment;
  }

  static async findById(id: string): Promise<AttachmentWithMessage | null> {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
      include: {
        message: true
      }
    });

    return attachment;
  }

  static async findByIdOrThrow(id: string): Promise<AttachmentWithMessage> {
    const attachment = await this.findById(id);
    if (!attachment) {
      throw new Error('Attachment not found');
    }
    return attachment;
  }

  static async findByMessageId(messageId: string): Promise<Attachment[]> {
    const attachments = await prisma.attachment.findMany({
      where: { messageId },
      orderBy: { createdAt: 'asc' }
    });

    return attachments;
  }

  static async update(id: string, data: UpdateAttachmentData): Promise<Attachment> {
    const attachment = await prisma.attachment.update({
      where: { id },
      data: {
        ...(data.type && { type: data.type }),
        ...(data.filename !== undefined && { filename: data.filename }),
        ...(data.size !== undefined && { size: data.size }),
        ...(data.storageUrl && { storageUrl: data.storageUrl }),
        ...(data.thumbnailUrl !== undefined && { thumbnailUrl: data.thumbnailUrl }),
        ...(data.metadata !== undefined && { metadata: data.metadata })
      }
    });

    return attachment;
  }

  static async delete(id: string): Promise<void> {
    await prisma.attachment.delete({
      where: { id }
    });
  }

  static async deleteByMessageId(messageId: string): Promise<void> {
    await prisma.attachment.deleteMany({
      where: { messageId }
    });
  }

  static async list(params: AttachmentSearchParams = {}): Promise<AttachmentListResult> {
    const {
      messageId,
      type,
      filename,
      search,
      page = 1,
      limit = 50
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.AttachmentWhereInput = {
      ...(messageId && { messageId }),
      ...(type && { type: { contains: type, mode: 'insensitive' } }),
      ...(filename && { filename: { contains: filename, mode: 'insensitive' } }),
      ...(search && {
        OR: [
          { filename: { contains: search, mode: 'insensitive' } },
          { type: { contains: search, mode: 'insensitive' } },
          { message: {
            OR: [
              { fromIdentifier: { contains: search, mode: 'insensitive' } },
              { toIdentifier: { contains: search, mode: 'insensitive' } }
            ]
          }}
        ]
      })
    };

    // Execute queries in parallel
    const [attachments, total] = await Promise.all([
      prisma.attachment.findMany({
        where,
        include: {
          message: true
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.attachment.count({ where })
    ]);

    return {
      data: attachments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async findByType(type: string): Promise<Attachment[]> {
    const attachments = await prisma.attachment.findMany({
      where: {
        type: { contains: type, mode: 'insensitive' }
      },
      orderBy: { createdAt: 'desc' }
    });

    return attachments;
  }

  static async findLargeFiles(minSizeBytes: number = 10 * 1024 * 1024): Promise<AttachmentWithMessage[]> {
    const attachments = await prisma.attachment.findMany({
      where: {
        size: {
          gte: minSizeBytes
        }
      },
      include: {
        message: true
      },
      orderBy: { size: 'desc' }
    });

    return attachments;
  }

  static async getTotalStorageUsage(): Promise<number> {
    const result = await prisma.attachment.aggregate({
      _sum: {
        size: true
      }
    });

    return result._sum.size || 0;
  }

  static async getStorageUsageByType(): Promise<Record<string, number>> {
    const results = await prisma.attachment.groupBy({
      by: ['type'],
      _sum: {
        size: true
      },
      _count: {
        _all: true
      }
    });

    return results.reduce((acc, item) => {
      acc[item.type] = item._sum.size || 0;
      return acc;
    }, {} as Record<string, number>);
  }

  static async createMultiple(attachments: CreateAttachmentData[]): Promise<Attachment[]> {
    const createdAttachments = await Promise.all(
      attachments.map(data => this.create(data))
    );

    return createdAttachments;
  }

  static async findOrphanedAttachments(): Promise<AttachmentWithMessage[]> {
    // Find attachments where the referenced message doesn't exist
    const attachments = await prisma.attachment.findMany({
      include: {
        message: true
      },
      where: {
        message: null
      }
    });

    return attachments;
  }

  static async updateThumbnail(id: string, thumbnailUrl: string): Promise<Attachment> {
    return this.update(id, { thumbnailUrl });
  }

  static async getStats() {
    const [
      totalAttachments,
      totalStorageSize,
      attachmentsByType,
      attachmentsWithThumbnails,
      recentAttachments
    ] = await Promise.all([
      prisma.attachment.count(),
      prisma.attachment.aggregate({
        _sum: { size: true }
      }),
      prisma.attachment.groupBy({
        by: ['type'],
        _count: { _all: true }
      }),
      prisma.attachment.count({
        where: {
          thumbnailUrl: {
            not: null
          }
        }
      }),
      prisma.attachment.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      })
    ]);

    return {
      totalAttachments,
      totalStorageSize: totalStorageSize._sum.size || 0,
      attachmentsByType: attachmentsByType.reduce((acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      attachmentsWithThumbnails,
      recentAttachments
    };
  }

  static async exists(id: string): Promise<boolean> {
    const count = await prisma.attachment.count({
      where: { id }
    });
    return count > 0;
  }

  static async validateStorageUrl(storageUrl: string): Promise<boolean> {
    // Basic URL validation - in real implementation, you might want to 
    // check if the file actually exists at the storage location
    try {
      new URL(storageUrl);
      return true;
    } catch {
      return false;
    }
  }

  static async findByCustomer(customerId: string): Promise<AttachmentWithMessage[]> {
    const attachments = await prisma.attachment.findMany({
      where: {
        message: {
          customerId
        }
      },
      include: {
        message: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return attachments;
  }

  static async getTypeStats() {
    const stats = await prisma.attachment.groupBy({
      by: ['type'],
      _count: { _all: true },
      _sum: { size: true },
      _avg: { size: true }
    });

    return stats.map(stat => ({
      type: stat.type,
      count: stat._count._all,
      totalSize: stat._sum.size || 0,
      averageSize: Math.round(stat._avg.size || 0)
    }));
  }
}

export default AttachmentModel;