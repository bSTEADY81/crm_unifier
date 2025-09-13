import { Request, Response, NextFunction } from 'express';
import { SecureUserModel } from '../models/user-secure';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: 'admin' | 'staff' | 'viewer';
      };
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    name: string;
    role: 'admin' | 'staff' | 'viewer';
  };
}

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!authHeader.startsWith('Bearer ') || !token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token required'
      });
      return;
    }

    try {
      const user = await SecureUserModel.validateAccessToken(token);
      
      // Attach user to request
      req.user = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      };

      next();
    } catch (error) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Authentication failed'
    });
    return;
  }
};

export const requireRole = (requiredRole: 'admin' | 'staff' | 'viewer') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
      return;
    }

    // Define role hierarchy
    const roleHierarchy = {
      admin: 3,
      staff: 2,
      viewer: 1
    };

    if (roleHierarchy[req.user.role] < roleHierarchy[requiredRole]) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
      return;
    }

    next();
  };
};

export const requireAdmin = requireRole('admin');
export const requireStaff = requireRole('staff');
export const requireViewer = requireRole('viewer');