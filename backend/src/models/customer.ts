import { PrismaClient, Customer, Identity, Prisma } from '@prisma/client';
import { normalizePhoneE164 } from '../lib/phone';

const prisma = new PrismaClient();

// Identity sorting utility for deterministic ordering
// email > phone > social, then lexicographic by value
function sortIdentities(identities: Identity[]): Identity[] {
  const typeRank = (type: string) => {
    switch (type) {
      case 'email': return 0;
      case 'phone': return 1; 
      case 'social': return 2;
      default: return 3;
    }
  };

  return identities.sort((a, b) => {
    const rankDiff = typeRank(a.type) - typeRank(b.type);
    if (rankDiff !== 0) return rankDiff;
    return a.value.localeCompare(b.value);
  });
}


export type CustomerWithIdentities = Customer & {
  identities: Identity[];
};

export type CreateCustomerData = {
  name: string;
  displayName?: string;
  metadata?: Prisma.JsonValue;
};

export type UpdateCustomerData = {
  name?: string;
  displayName?: string;
  metadata?: Prisma.JsonValue;
};

export type CustomerSearchParams = {
  search?: string;
  page?: number;
  limit?: number;
};

export type CustomerListResult = {
  data: CustomerWithIdentities[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class CustomerModel {
  static async create(data: CreateCustomerData): Promise<CustomerWithIdentities> {
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        displayName: data.displayName || null,
        metadata: data.metadata || {}
      },
      include: {
        identities: {
          select: { id: true, type: true, value: true, rawValue: true, provider: true, verified: true, linkedAt: true },
          orderBy: [{ linkedAt: 'desc' }, { id: 'desc' }]
        }
      }
    });

    customer.identities = sortIdentities(customer.identities);
    return customer;
  }

  static async findById(id: string): Promise<CustomerWithIdentities | null> {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        identities: {
          select: { id: true, type: true, value: true, rawValue: true, provider: true, verified: true, linkedAt: true },
          orderBy: [{ linkedAt: 'desc' }, { id: 'desc' }]
        }
      }
    });

    if (customer) {
      customer.identities = sortIdentities(customer.identities);
    }
    return customer;
  }

  static async findByIdOrThrow(id: string): Promise<CustomerWithIdentities> {
    const customer = await this.findById(id);
    if (!customer) {
      throw new Error('Customer not found');
    }
    return customer;
  }

  static async update(id: string, data: UpdateCustomerData): Promise<CustomerWithIdentities> {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.metadata !== undefined && { metadata: data.metadata })
      },
      include: {
        identities: {
          select: { id: true, type: true, value: true, rawValue: true, provider: true, verified: true, linkedAt: true },
          orderBy: [{ linkedAt: 'desc' }, { id: 'desc' }]
        }
      }
    });

    customer.identities = sortIdentities(customer.identities);
    return customer;
  }

  static async delete(id: string): Promise<void> {
    await prisma.customer.delete({
      where: { id }
    });
  }

  static async list(params: CustomerSearchParams = {}): Promise<CustomerListResult> {
    const {
      search,
      page = 1,
      limit = 50
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause for search with phone normalization
    const q = (search ?? "").trim();
    const qPhone = normalizePhoneE164(q);
    const where: Prisma.CustomerWhereInput = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { displayName: { contains: q, mode: 'insensitive' } },
            // Phone search on normalized and raw values
            { identities: { some: { type: "phone", value: { contains: qPhone, mode: "insensitive" } } } },
            { identities: { some: { value: { contains: q, mode: "insensitive" } } } },
            { identities: { some: { rawValue: { contains: q, mode: "insensitive" } } } }
          ]
        }
      : {};

    // Execute queries in parallel
    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: {
          identities: {
            select: { id: true, type: true, value: true, rawValue: true, provider: true, verified: true, linkedAt: true },
            orderBy: [{ linkedAt: 'desc' }, { id: 'desc' }]
          }
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip,
        take: limit
      }),
      prisma.customer.count({ where })
    ]);

    // Apply deterministic identity sorting to all customers
    customers.forEach(customer => {
      customer.identities = sortIdentities(customer.identities);
    });

    return {
      data: customers,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async findByIdentity(
    type: 'email' | 'phone' | 'social',
    value: string
  ): Promise<CustomerWithIdentities | null> {
    const customer = await prisma.customer.findFirst({
      where: {
        identities: {
          some: {
            type,
            value: { equals: value, mode: 'insensitive' }
          }
        }
      },
      include: {
        identities: {
          select: { id: true, type: true, value: true, rawValue: true, provider: true, verified: true, linkedAt: true },
          orderBy: [{ linkedAt: 'desc' }, { id: 'desc' }]
        }
      }
    });

    if (customer) {
      customer.identities = sortIdentities(customer.identities);
    }
    return customer;
  }

  static async linkIdentity(customerId: string, identityData: {
    type: 'email' | 'phone' | 'social';
    value: string;
    rawValue: string;
    provider?: string;
    verified?: boolean;
  }): Promise<Identity> {
    // Check if identity already exists for this customer
    const existingIdentity = await prisma.identity.findFirst({
      where: {
        customerId,
        type: identityData.type,
        value: identityData.value
      }
    });

    if (existingIdentity) {
      throw new Error(`Identity of type ${identityData.type} with value ${identityData.value} already exists for this customer`);
    }

    const identity = await prisma.identity.create({
      data: {
        customerId,
        type: identityData.type,
        value: identityData.value,
        rawValue: identityData.rawValue,
        provider: identityData.provider,
        verified: identityData.verified || false
      }
    });

    return identity;
  }

  static async unlinkIdentity(customerId: string, identityId: string): Promise<void> {
    await prisma.identity.delete({
      where: {
        id: identityId,
        customerId // Ensure identity belongs to the customer
      }
    });
  }

  static async getMessageTimeline(
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

    // Build where clause
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

    // Execute queries in parallel
    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        include: {
          attachments: true
        },
        // Contract expects oldest-first
        orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
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

  static async exists(id: string): Promise<boolean> {
    const count = await prisma.customer.count({
      where: { id }
    });
    return count > 0;
  }

  static async getStats() {
    const [
      totalCustomers,
      customersWithIdentities,
      customersWithMessages,
      recentCustomers
    ] = await Promise.all([
      prisma.customer.count(),
      prisma.customer.count({
        where: {
          identities: {
            some: {}
          }
        }
      }),
      prisma.customer.count({
        where: {
          messages: {
            some: {}
          }
        }
      }),
      prisma.customer.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      })
    ]);

    return {
      totalCustomers,
      customersWithIdentities,
      customersWithMessages,
      recentCustomers
    };
  }
}

export default CustomerModel;