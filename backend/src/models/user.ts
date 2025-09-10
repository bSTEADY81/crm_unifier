import { PrismaClient, User, AuditEvent, ConversationAssignment, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export type UserWithRelations = User & {
  auditEvents?: AuditEvent[];
  assignedConversations?: ConversationAssignment[];
};

export type CreateUserData = {
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'viewer';
  password?: string;
  metadata?: Prisma.JsonValue;
};

export type UpdateUserData = {
  email?: string;
  name?: string;
  role?: 'admin' | 'staff' | 'viewer';
  metadata?: Prisma.JsonValue;
  lastLogin?: Date;
};

export type UserSearchParams = {
  role?: 'admin' | 'staff' | 'viewer';
  search?: string;
  page?: number;
  limit?: number;
};

export type UserListResult = {
  data: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type LoginResult = {
  user: Omit<User, 'id'> & { id: string };
  token: string;
};

export class UserModel {
  static async create(data: CreateUserData): Promise<User> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error(`User with email ${data.email} already exists`);
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (data.password) {
      hashedPassword = await bcrypt.hash(data.password, 12);
    }

    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        role: data.role,
        metadata: {
          ...data.metadata,
          ...(hashedPassword && { passwordHash: hashedPassword })
        }
      }
    });

    return user;
  }

  static async findById(id: string): Promise<UserWithRelations | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        auditEvents: {
          orderBy: { timestamp: 'desc' },
          take: 10 // Latest 10 audit events
        },
        conversationAssignments: {
          include: {
            conversation: {
              include: {
                customer: true
              }
            }
          },
          orderBy: { assignedAt: 'desc' },
          take: 10 // Latest 10 assignments
        }
      }
    });

    return user;
  }

  static async findByIdOrThrow(id: string): Promise<UserWithRelations> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }
    return user;
  }

  static async findByEmail(email: string): Promise<User | null> {
    const user = await prisma.user.findUnique({
      where: { email }
    });

    return user;
  }

  static async update(id: string, data: UpdateUserData): Promise<User> {
    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.email && { email: data.email }),
        ...(data.name && { name: data.name }),
        ...(data.role && { role: data.role }),
        ...(data.metadata !== undefined && { metadata: data.metadata }),
        ...(data.lastLogin && { lastLogin: data.lastLogin })
      }
    });

    return user;
  }

  static async delete(id: string): Promise<void> {
    await prisma.user.delete({
      where: { id }
    });
  }

  static async list(params: UserSearchParams = {}): Promise<UserListResult> {
    const {
      role,
      search,
      page = 1,
      limit = 50
    } = params;

    const skip = (page - 1) * limit;

    // Build where clause
    const where: Prisma.UserWhereInput = {
      ...(role && { role }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } }
        ]
      })
    };

    // Execute queries in parallel
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.user.count({ where })
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  static async login(credentials: LoginCredentials): Promise<LoginResult> {
    const { email, password } = credentials;

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Extract password hash from metadata
    const storedHash = (user.metadata as any)?.passwordHash;
    if (!storedHash) {
      throw new Error('User has no password set');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, storedHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    // Update last login (safely ignore if user no longer exists)
    try {
      await this.updateLastLogin(user.id);
    } catch (updateError) {
      // Ignore "Record to update not found" errors - user might have been cleaned up
      if (!(updateError instanceof Error && updateError.message.includes('Record to update not found'))) {
        throw updateError;
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role
      },
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    // Return user with metadata (excluding sensitive fields like passwordHash and lastLogin)
    const safeMetadata = { ...user.metadata } as any;
    delete safeMetadata.passwordHash;
    
    const { lastLogin, ...userWithoutLastLogin } = user;
    
    return {
      user: { ...userWithoutLastLogin, metadata: safeMetadata },
      token
    };
  }

  static async updatePassword(id: string, newPassword: string): Promise<User> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    const user = await prisma.user.findUniqueOrThrow({
      where: { id }
    });

    return this.update(id, {
      metadata: {
        ...user.metadata,
        passwordHash: hashedPassword
      }
    });
  }

  static async updateLastLogin(id: string): Promise<User> {
    return this.update(id, { lastLogin: new Date() });
  }

  static async validateToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid or expired token');
    }
  }

  static async findByRole(role: 'admin' | 'staff' | 'viewer'): Promise<User[]> {
    const users = await prisma.user.findMany({
      where: { role },
      orderBy: { name: 'asc' }
    });

    return users;
  }

  static async getActiveUsers(daysBack: number = 30): Promise<User[]> {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
    
    const users = await prisma.user.findMany({
      where: {
        lastLogin: {
          gte: cutoffDate
        }
      },
      orderBy: { lastLogin: 'desc' }
    });

    return users;
  }

  static async getUserAssignments(userId: string): Promise<ConversationAssignment[]> {
    const assignments = await prisma.conversationAssignment.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            customer: true,
            messages: {
              orderBy: { timestamp: 'desc' },
              take: 1
            }
          }
        },
        assigner: true
      },
      orderBy: { assignedAt: 'desc' }
    });

    return assignments;
  }

  static async getStats() {
    const [
      totalUsers,
      usersByRole,
      activeUsers,
      recentLogins,
      usersWithAssignments
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ['role'],
        _count: { _all: true }
      }),
      prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Last 30 days
          }
        }
      }),
      prisma.user.count({
        where: {
          lastLogin: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        }
      }),
      prisma.user.count({
        where: {
          conversationAssignments: {
            some: {}
          }
        }
      })
    ]);

    return {
      totalUsers,
      usersByRole: usersByRole.reduce((acc, item) => {
        acc[item.role] = item._count._all;
        return acc;
      }, {} as Record<string, number>),
      activeUsers,
      recentLogins,
      usersWithAssignments
    };
  }

  static async exists(id: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { id }
    });
    return count > 0;
  }

  static async existsByEmail(email: string): Promise<boolean> {
    const count = await prisma.user.count({
      where: { email: email.toLowerCase() }
    });
    return count > 0;
  }

  static async hasPermission(userId: string, requiredRole: 'admin' | 'staff' | 'viewer'): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    if (!user) {
      return false;
    }

    // Define role hierarchy
    const roleHierarchy = {
      admin: 3,
      staff: 2,
      viewer: 1
    };

    return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
  }

  static async generatePasswordResetToken(email: string): Promise<string> {
    const user = await this.findByEmail(email);
    if (!user) {
      throw new Error('User not found');
    }

    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '1h' }
    );

    // Store the reset token in user metadata
    await this.update(user.id, {
      metadata: {
        ...user.metadata,
        resetToken,
        resetTokenCreated: new Date().toISOString()
      }
    });

    return resetToken;
  }

  static async resetPassword(resetToken: string, newPassword: string): Promise<User> {
    try {
      const decoded = jwt.verify(resetToken, process.env.JWT_SECRET!) as any;
      
      if (decoded.type !== 'password_reset') {
        throw new Error('Invalid reset token');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId }
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Verify the token matches the one in metadata
      const storedToken = (user.metadata as any)?.resetToken;
      if (storedToken !== resetToken) {
        throw new Error('Invalid reset token');
      }

      // Update password and clear reset token
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      
      const updatedUser = await this.update(user.id, {
        metadata: {
          ...user.metadata,
          passwordHash: hashedPassword,
          resetToken: null,
          resetTokenCreated: null
        }
      });

      return updatedUser;
    } catch (error) {
      throw new Error('Invalid or expired reset token');
    }
  }
}

export default UserModel;