import { PrismaClient, Identity, Customer, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export type IdentityWithCustomer = Identity & {
  customer: Customer;
};

export type CreateIdentityData = {
  customerId: string;
  type: 'phone' | 'email' | 'social';
  value: string;
  rawValue: string;
  provider?: string;
  verified?: boolean;
};

export type UpdateIdentityData = {
  rawValue?: string;
  provider?: string;
  verified?: boolean;
};

export type IdentitySearchParams = {
  customerId?: string;
  type?: 'phone' | 'email' | 'social';
  verified?: boolean;
  provider?: string;
  search?: string;
  page?: number;
  limit?: number;
};

export type IdentityListResult = {
  data: IdentityWithCustomer[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export class IdentityModel {
  static async create(data: CreateIdentityData): Promise<Identity> {
    // Check if identity already exists (unique constraint on type + value)
    const existing = await prisma.identity.findUnique({
      where: {
        type_value: {
          type: data.type,
          value: data.value
        }
      }
    });

    if (existing) {
      throw new Error(`Identity of type ${data.type} with value ${data.value} already exists`);
    }

    const identity = await prisma.identity.create({
      data: {
        customerId: data.customerId,
        type: data.type,
        value: data.value,
        rawValue: data.rawValue,
        provider: data.provider,
        verified: data.verified || false
      }
    });

    return identity;
  }

  static async findById(id: string): Promise<IdentityWithCustomer | null> {
    const identity = await prisma.identity.findUnique({
      where: { id },
      include: {
        customer: true
      }
    });

    return identity;
  }

  static async findByIdOrThrow(id: string): Promise<IdentityWithCustomer> {
    const identity = await this.findById(id);
    if (!identity) {
      throw new Error('Identity not found');
    }
    return identity;
  }

  static async findByTypeAndValue(
    type: 'phone' | 'email' | 'social',
    value: string
  ): Promise<IdentityWithCustomer | null> {
    const identity = await prisma.identity.findUnique({
      where: {
        type_value: {
          type,
          value
        }
      },
      include: {
        customer: true
      }
    });

    return identity;
  }

  static async findByCustomerId(customerId: string): Promise<Identity[]> {
    const identities = await prisma.identity.findMany({
      where: { customerId },
      orderBy: { linkedAt: 'desc' }
    });

    return identities;
  }

  static async update(id: string, data: UpdateIdentityData): Promise<Identity> {
    const identity = await prisma.identity.update({
      where: { id },
      data: {
        ...(data.rawValue !== undefined && { rawValue: data.rawValue }),
        ...(data.provider !== undefined && { provider: data.provider }),
        ...(data.verified !== undefined && { verified: data.verified })
      }
    });

    return identity;
  }

  static async delete(id: string): Promise<void> {
    await prisma.identity.delete({
      where: { id }
    });
  }

  static async list(params: IdentitySearchParams = {}): Promise<IdentityListResult> {
    const {
      customerId,
      type,
      verified,
      provider,
      search,
      page = 1,
      limit = 50
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.IdentityWhereInput = {
      ...(customerId && { customerId }),
      ...(type && { type }),
      ...(verified !== undefined && { verified }),
      ...(provider && { provider }),
      ...(search && {
        OR: [
          { value: { contains: search, mode: 'insensitive' } },
          { rawValue: { contains: search, mode: 'insensitive' } },
          { customer: { name: { contains: search, mode: 'insensitive' } } }
        ]
      })
    };

    // Execute queries in parallel
    const [identities, total] = await Promise.all([
      prisma.identity.findMany({
        where,
        include: {
          customer: true
        },
        orderBy: { linkedAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.identity.count({ where })
    ]);

    return {
      data: identities,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async verify(id: string): Promise<Identity> {
    const identity = await prisma.identity.update({
      where: { id },
      data: { verified: true }
    });

    return identity;
  }

  static async unverify(id: string): Promise<Identity> {
    const identity = await prisma.identity.update({
      where: { id },
      data: { verified: false }
    });

    return identity;
  }

  static async transferToCustomer(identityId: string, newCustomerId: string): Promise<Identity> {
    // Check if the new customer would have a duplicate identity
    const identity = await prisma.identity.findUniqueOrThrow({
      where: { id: identityId }
    });

    const existingDuplicate = await prisma.identity.findFirst({
      where: {
        customerId: newCustomerId,
        type: identity.type,
        value: identity.value,
        id: { not: identityId } // Exclude the current identity
      }
    });

    if (existingDuplicate) {
      throw new Error(`Customer already has an identity of type ${identity.type} with value ${identity.value}`);
    }

    const updatedIdentity = await prisma.identity.update({
      where: { id: identityId },
      data: { 
        customerId: newCustomerId,
        linkedAt: new Date() // Update linked timestamp
      }
    });

    return updatedIdentity;
  }

  static async findDuplicates(
    type: 'phone' | 'email' | 'social',
    value: string
  ): Promise<Identity[]> {
    const identities = await prisma.identity.findMany({
      where: {
        type,
        value: { equals: value, mode: 'insensitive' }
      },
      include: {
        customer: true
      }
    });

    return identities;
  }

  static async normalizeValue(type: 'phone' | 'email' | 'social', rawValue: string): Promise<string> {
    switch (type) {
      case 'phone':
        // Remove all non-digits and add + prefix if not present
        const digits = rawValue.replace(/\D/g, '');
        return digits.startsWith('1') ? `+${digits}` : `+1${digits}`;
      
      case 'email':
        // Lowercase and trim
        return rawValue.toLowerCase().trim();
      
      case 'social':
        // Remove @ prefix if present and lowercase
        return rawValue.replace(/^@/, '').toLowerCase().trim();
      
      default:
        return rawValue.trim();
    }
  }

  static async findPotentialMatches(
    type: 'phone' | 'email' | 'social',
    value: string
  ): Promise<Identity[]> {
    const normalizedValue = await this.normalizeValue(type, value);
    
    let whereCondition: Prisma.IdentityWhereInput;

    switch (type) {
      case 'phone':
        // For phone numbers, also check without country code
        const withoutCountryCode = normalizedValue.replace(/^\+1/, '');
        whereCondition = {
          type: 'phone',
          OR: [
            { value: normalizedValue },
            { value: withoutCountryCode },
            { rawValue: { contains: withoutCountryCode } }
          ]
        };
        break;
      
      case 'email':
        whereCondition = {
          type: 'email',
          value: { equals: normalizedValue, mode: 'insensitive' }
        };
        break;
      
      case 'social':
        whereCondition = {
          type: 'social',
          OR: [
            { value: normalizedValue },
            { value: `@${normalizedValue}` },
            { rawValue: { contains: normalizedValue, mode: 'insensitive' } }
          ]
        };
        break;
      
      default:
        whereCondition = { type, value: normalizedValue };
    }

    const identities = await prisma.identity.findMany({
      where: whereCondition,
      include: {
        customer: true
      },
      orderBy: { linkedAt: 'desc' }
    });

    return identities;
  }

  static async getStats() {
    const [
      totalIdentities,
      verifiedIdentities,
      identitiesByType,
      orphanedIdentities
    ] = await Promise.all([
      prisma.identity.count(),
      prisma.identity.count({ where: { verified: true } }),
      prisma.identity.groupBy({
        by: ['type'],
        _count: { _all: true }
      }),
      prisma.identity.count({
        where: {
          customer: null
        }
      })
    ]);

    return {
      totalIdentities,
      verifiedIdentities,
      identitiesByType: identitiesByType.reduce((acc, item) => {
        acc[item.type] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      orphanedIdentities
    };
  }

  static async exists(id: string): Promise<boolean> {
    const count = await prisma.identity.count({
      where: { id }
    });
    return count > 0;
  }

  static async existsForCustomer(customerId: string, type: string, value: string): Promise<boolean> {
    const count = await prisma.identity.count({
      where: {
        customerId,
        type: type as any,
        value
      }
    });
    return count > 0;
  }
}

export default IdentityModel;