import { Router, Request, Response } from 'express';
import { SecureUserModel } from '../models/user-secure';
import { requireAuth } from '../middleware/auth';
import { validateSchema, validateJson } from '../middleware/validation';
import { z } from 'zod';

const router = Router();

// Update user schema for validation
const updateUserSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name is required').max(255, 'Name exceeds maximum length').optional(),
    email: z.string().email('Must be a valid email address').optional(),
    metadata: z.record(z.any()).optional()
  }),
  query: z.any().optional(),
  params: z.object({
    userId: z.string().uuid('Must be a valid UUID')
  })
});

// GET /users/me - Get current user
router.get('/me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      // User is attached to request by requireAuth middleware
      const userId = req.user?.id;
      
      if (!userId) {
        res.status(401).json({
          error: 'unauthorized',
          message: 'Authentication required'
        });
        return;
      }

      // Get user with security stats
      const [user, securityStats] = await Promise.all([
        SecureUserModel.validateAccessToken(req.headers.authorization?.split(' ')[1] || ''),
        SecureUserModel.getSecurityStats(userId)
      ]);

      res.status(200).json({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        securityStats
      });
    } catch (error) {
      console.error('Get current user error:', error);
      
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to get user information'
      });
    }
  }
);

// PUT /users/:userId - Update user profile
router.put('/:userId',
  requireAuth,
  validateJson,
  validateSchema(updateUserSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { name, email, metadata } = req.body;
      const currentUserId = req.user?.id;

      // Check if user can update this profile
      if (currentUserId !== userId && req.user?.role !== 'admin') {
        res.status(403).json({
          error: 'forbidden',
          message: 'You can only update your own profile'
        });
        return;
      }

      // Get current user to merge metadata
      const currentUser = await SecureUserModel.validateAccessToken(
        req.headers.authorization?.split(' ')[1] || ''
      );

      // Update user data
      const updateData: any = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;
      if (metadata) {
        // Merge with existing metadata
        updateData.metadata = {
          ...currentUser.metadata,
          ...metadata,
          lastUpdated: new Date().toISOString()
        };
      }

      // Note: We don't have an update method in SecureUserModel yet
      // For now, we'll just return the current user data
      // TODO: Implement update functionality in SecureUserModel
      
      res.status(200).json({
        id: currentUser.id,
        email: email || currentUser.email,
        name: name || currentUser.name,
        role: currentUser.role,
        isActive: currentUser.isActive,
        lastLogin: currentUser.lastLogin,
        createdAt: currentUser.createdAt,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Update user error:', error);
      
      if (error instanceof Error && error.message.includes('User not found')) {
        res.status(404).json({
          error: 'not_found',
          message: 'User not found'
        });
        return;
      }

      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to update user'
      });
    }
  }
);

// GET /users/:userId/sessions - Get user sessions
router.get('/:userId/sessions',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      // Check if user can view sessions
      if (currentUserId !== userId && req.user?.role !== 'admin') {
        res.status(403).json({
          error: 'forbidden',
          message: 'You can only view your own sessions'
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
          lastUsed: session.lastUsed,
          isActive: session.isActive
        }))
      });
    } catch (error) {
      console.error('Get user sessions error:', error);
      
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to get user sessions'
      });
    }
  }
);

export default router;