import { Router, Request, Response } from 'express';
import { SecureUserModel } from '../models/user-secure';
import { validateSchema, validateJson, loginSchema } from '../middleware/validation';
import { passwordResetRateLimit } from '../middleware/security';

const router = Router();

// Enhanced login with security features
router.post('/login', 
  validateJson,
  validateSchema(loginSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await SecureUserModel.login({
        email,
        password,
        ipAddress,
        userAgent
      });

      // Set refresh token as httpOnly cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });

      res.status(200).json({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn,
        user: result.user
      });
    } catch (error) {
      console.error('Login error:', error);
      
      if (error instanceof Error && 
          (error.message.includes('Invalid credentials') || 
           error.message.includes('locked') ||
           error.message.includes('blocked'))) {
        res.status(401).json({
          error: 'unauthorized',
          message: error.message
        });
        return;
      }

      res.status(500).json({
        error: 'internal_server_error',
        message: 'Login failed'
      });
    }
  }
);

// Token refresh endpoint
router.post('/refresh',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      
      if (!refreshToken) {
        res.status(401).json({
          error: 'unauthorized',
          message: 'Refresh token required'
        });
        return;
      }

      const ipAddress = req.ip;
      const userAgent = req.get('User-Agent');

      const result = await SecureUserModel.refreshToken(refreshToken, ipAddress, userAgent);

      // Set new refresh token
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      res.status(200).json({
        accessToken: result.accessToken,
        expiresIn: result.expiresIn
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      
      res.status(401).json({
        error: 'unauthorized',
        message: 'Invalid or expired refresh token'
      });
    }
  }
);

// Logout endpoint
router.post('/logout',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body.refreshToken;
      
      if (refreshToken) {
        await SecureUserModel.logout(refreshToken);
      }

      // Clear refresh token cookie
      res.clearCookie('refreshToken');

      res.status(200).json({
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Logout failed'
      });
    }
  }
);

// Logout from all sessions
router.post('/logout-all',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        res.status(400).json({
          error: 'bad_request',
          message: 'User ID required'
        });
        return;
      }

      await SecureUserModel.logoutAllSessions(userId);
      
      res.clearCookie('refreshToken');

      res.status(200).json({
        message: 'Logged out from all sessions'
      });
    } catch (error) {
      console.error('Logout all error:', error);
      
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Logout failed'
      });
    }
  }
);

// Password reset request
router.post('/password-reset-request',
  passwordResetRateLimit,
  validateJson,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      
      if (!email) {
        res.status(400).json({
          error: 'bad_request',
          message: 'Email is required'
        });
        return;
      }

      // TODO: Implement password reset logic
      // For now, return success regardless to prevent email enumeration
      res.status(200).json({
        message: 'If an account with this email exists, a password reset link has been sent'
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Password reset failed'
      });
    }
  }
);

// Get user sessions
router.get('/sessions',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.query;
      
      if (!userId || typeof userId !== 'string') {
        res.status(400).json({
          error: 'bad_request',
          message: 'User ID required'
        });
        return;
      }

      const sessions = await SecureUserModel.getUserSessions(userId);
      
      res.status(200).json({
        sessions: sessions.map(session => ({
          id: session.id,
          type: session.type,
          ipAddress: session.ipAddress,
          userAgent: session.userAgent,
          createdAt: session.createdAt,
          lastUsed: session.lastUsed
        }))
      });
    } catch (error) {
      console.error('Get sessions error:', error);
      
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to get sessions'
      });
    }
  }
);

export default router;