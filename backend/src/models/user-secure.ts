import { PrismaClient, User, UserPassword, UserSession, LoginAttempt, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'crypto';

const prisma = new PrismaClient();

export type UserWithPassword = User & {
  password?: UserPassword;
  sessions?: UserSession[];
  loginAttempts?: LoginAttempt[];
};

export type CreateUserData = {
  email: string;
  name: string;
  role: 'admin' | 'staff' | 'viewer';
  password?: string;
  metadata?: Prisma.JsonValue;
};

export type LoginCredentials = {
  email: string;
  password: string;
  ipAddress: string;
  userAgent?: string;
};

export type LoginResult = {
  user: Omit<User, 'metadata'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

export class SecureUserModel {
  // Password configuration
  private static readonly BCRYPT_ROUNDS = 12;
  private static readonly PASSWORD_HISTORY_LENGTH = 5;
  private static readonly MAX_LOGIN_ATTEMPTS = 5;
  private static readonly LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
  private static readonly ACCESS_TOKEN_EXPIRY = '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = '7d';

  static async create(data: CreateUserData): Promise<User> {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() }
    });

    if (existingUser) {
      throw new Error(`User with email ${data.email} already exists`);
    }

    return await prisma.$transaction(async (tx) => {
      // Create user
      const user = await tx.user.create({
        data: {
          email: data.email.toLowerCase(),
          name: data.name,
          role: data.role,
          metadata: data.metadata || {}
        }
      });

      // Create password if provided
      if (data.password) {
        await this.setPasswordInTransaction(tx, user.id, data.password);
      }

      return user;
    });
  }

  static async setPassword(userId: string, password: string): Promise<void> {
    // Validate password strength
    this.validatePasswordStrength(password);

    const salt = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password + salt, this.BCRYPT_ROUNDS);

    // Get existing password for history
    const existingPassword = await prisma.userPassword.findUnique({
      where: { userId }
    });

    let passwordHistory: string[] = [];
    if (existingPassword) {
      passwordHistory = Array.isArray(existingPassword.passwordHistory) 
        ? existingPassword.passwordHistory as string[]
        : [];

      // Check if new password matches any recent passwords
      for (const oldHash of passwordHistory) {
        if (await bcrypt.compare(password + salt, oldHash)) {
          throw new Error('Password must be different from recent passwords');
        }
      }
    }

    // Add current password to history
    passwordHistory.unshift(passwordHash);
    passwordHistory = passwordHistory.slice(0, this.PASSWORD_HISTORY_LENGTH);

    await prisma.userPassword.upsert({
      where: { userId },
      update: {
        passwordHash,
        salt,
        algorithm: 'bcrypt',
        iterations: this.BCRYPT_ROUNDS,
        lastChanged: new Date(),
        passwordHistory
      },
      create: {
        userId,
        passwordHash,
        salt,
        algorithm: 'bcrypt',
        iterations: this.BCRYPT_ROUNDS,
        passwordHistory
      }
    });
  }

  static async setPasswordInTransaction(tx: any, userId: string, password: string): Promise<void> {
    // Validate password strength
    this.validatePasswordStrength(password);

    const salt = randomBytes(32).toString('hex');
    const passwordHash = await bcrypt.hash(password + salt, this.BCRYPT_ROUNDS);

    // For new users in transaction, there's no existing password
    const passwordHistory: string[] = [passwordHash];

    await tx.userPassword.create({
      data: {
        userId,
        passwordHash,
        salt,
        algorithm: 'bcrypt',
        iterations: this.BCRYPT_ROUNDS,
        passwordHistory
      }
    });
  }

  static validatePasswordStrength(password: string): void {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters long');
    }
    if (!/(?=.*[a-z])/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/(?=.*\d)/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    if (!/(?=.*[@$!%*?&])/.test(password)) {
      throw new Error('Password must contain at least one special character');
    }
  }

  static async login(credentials: LoginCredentials): Promise<LoginResult> {
    const { email, password, ipAddress, userAgent } = credentials;
    const emailLower = email.toLowerCase();

    // Check for account lockout
    await this.checkAccountLockout(emailLower, ipAddress);

    try {
      // Find user with password
      const user = await prisma.user.findUnique({
        where: { email: emailLower, isActive: true },
        include: { password: true }
      });

      if (!user || !user.password) {
        await this.recordLoginAttempt({
          email: emailLower,
          ipAddress,
          userAgent,
          success: false,
          failureReason: 'user_not_found'
        });
        throw new Error('Invalid credentials');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(
        password + user.password.salt, 
        user.password.passwordHash
      );

      if (!isValidPassword) {
        await this.recordLoginAttempt({
          userId: user.id,
          email: emailLower,
          ipAddress,
          userAgent,
          success: false,
          failureReason: 'invalid_password'
        });
        throw new Error('Invalid credentials');
      }

      // Generate tokens
      const tokens = await this.generateTokenPair(user, ipAddress, userAgent);

      // Record successful login
      await this.recordLoginAttempt({
        userId: user.id,
        email: emailLower,
        ipAddress,
        userAgent,
        success: true
      });

      // Update last login
      await prisma.user.update({
        where: { id: user.id },
        data: { lastLogin: new Date() }
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        },
        ...tokens
      };

    } catch (error) {
      if (error instanceof Error && error.message === 'Invalid credentials') {
        throw error;
      }
      throw new Error('Login failed');
    }
  }

  static async generateTokenPair(
    user: User, 
    ipAddress: string, 
    userAgent?: string
  ): Promise<TokenPair> {
    const now = new Date();
    
    // Generate access token
    const accessTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'access'
    };
    
    const accessToken = jwt.sign(
      accessTokenPayload,
      process.env.JWT_SECRET!,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token
    const refreshTokenPayload = {
      userId: user.id,
      type: 'refresh',
      jti: randomBytes(16).toString('hex') // Unique token ID
    };

    const refreshToken = jwt.sign(
      refreshTokenPayload,
      process.env.JWT_SECRET!,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    // Store refresh token in database
    const refreshTokenExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
    
    await prisma.userSession.create({
      data: {
        userId: user.id,
        token: createHash('sha256').update(refreshToken).digest('hex'),
        type: 'refresh',
        expiresAt: refreshTokenExpiry,
        ipAddress,
        userAgent
      }
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60 // 15 minutes in seconds
    };
  }

  static async refreshToken(
    refreshToken: string, 
    ipAddress: string, 
    userAgent?: string
  ): Promise<TokenPair> {
    try {
      const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET!) as any;
      
      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Find and validate stored session
      const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
      const session = await prisma.userSession.findFirst({
        where: {
          token: tokenHash,
          type: 'refresh',
          isActive: true,
          expiresAt: { gt: new Date() }
        },
        include: { user: true }
      });

      if (!session || !session.user.isActive) {
        throw new Error('Invalid or expired refresh token');
      }

      // Invalidate old refresh token
      await prisma.userSession.update({
        where: { id: session.id },
        data: { isActive: false }
      });

      // Generate new token pair
      return await this.generateTokenPair(session.user, ipAddress, userAgent);

    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  static async validateAccessToken(token: string): Promise<User> {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      
      if (decoded.type !== 'access') {
        throw new Error('Invalid token type');
      }

      const user = await prisma.user.findUnique({
        where: { id: decoded.userId, isActive: true }
      });

      if (!user) {
        throw new Error('User not found or inactive');
      }

      return user;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  static async logout(refreshToken: string): Promise<void> {
    const tokenHash = createHash('sha256').update(refreshToken).digest('hex');
    
    await prisma.userSession.updateMany({
      where: { token: tokenHash },
      data: { isActive: false }
    });
  }

  static async logoutAllSessions(userId: string): Promise<void> {
    await prisma.userSession.updateMany({
      where: { userId },
      data: { isActive: false }
    });
  }

  private static async checkAccountLockout(email: string, ipAddress: string): Promise<void> {
    const recentAttempts = await prisma.loginAttempt.count({
      where: {
        email,
        success: false,
        attemptedAt: {
          gte: new Date(Date.now() - this.LOCKOUT_DURATION)
        }
      }
    });

    if (recentAttempts >= this.MAX_LOGIN_ATTEMPTS) {
      throw new Error('Account temporarily locked due to too many failed login attempts');
    }

    // Also check IP-based lockout
    const recentIPAttempts = await prisma.loginAttempt.count({
      where: {
        ipAddress,
        success: false,
        attemptedAt: {
          gte: new Date(Date.now() - this.LOCKOUT_DURATION)
        }
      }
    });

    if (recentIPAttempts >= this.MAX_LOGIN_ATTEMPTS * 3) {
      throw new Error('IP address temporarily blocked due to suspicious activity');
    }
  }

  private static async recordLoginAttempt(data: {
    userId?: string;
    email: string;
    ipAddress: string;
    userAgent?: string;
    success: boolean;
    failureReason?: string;
  }): Promise<void> {
    await prisma.loginAttempt.create({
      data: {
        userId: data.userId,
        email: data.email,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: data.success,
        failureReason: data.failureReason
      }
    });
  }

  static async cleanupExpiredSessions(): Promise<void> {
    await prisma.userSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { isActive: false }
        ]
      }
    });
  }

  static async cleanupOldLoginAttempts(): Promise<void> {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days
    
    await prisma.loginAttempt.deleteMany({
      where: {
        attemptedAt: { lt: cutoff }
      }
    });
  }

  static async getUserSessions(userId: string): Promise<UserSession[]> {
    return await prisma.userSession.findMany({
      where: {
        userId,
        isActive: true,
        expiresAt: { gt: new Date() }
      },
      orderBy: { lastUsed: 'desc' }
    });
  }

  static async getSecurityStats(userId: string) {
    const [recentLogins, activeSessions, recentAttempts] = await Promise.all([
      prisma.loginAttempt.count({
        where: {
          userId,
          success: true,
          attemptedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }
      }),
      prisma.userSession.count({
        where: {
          userId,
          isActive: true,
          expiresAt: { gt: new Date() }
        }
      }),
      prisma.loginAttempt.count({
        where: {
          userId,
          success: false,
          attemptedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      })
    ]);

    return {
      recentLogins,
      activeSessions,
      recentFailedAttempts: recentAttempts
    };
  }
}

export default SecureUserModel;