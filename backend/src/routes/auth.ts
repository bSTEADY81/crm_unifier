import { Router, Request, Response } from 'express';
import { UserModel } from '../models/user';
import { validateSchema, validateJson, loginSchema } from '../middleware/validation';

const router = Router();

router.post('/login', 
  validateJson,
  validateSchema(loginSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email, password } = req.body;

      const result = await UserModel.login({ email, password });

      res.status(200).json({
        token: result.token,
        user: result.user
      });
    } catch (error) {
      console.error('Login error:', error);
      
      if (error instanceof Error && 
          (error.message === 'Invalid credentials' || error.message === 'User has no password set')) {
        res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid credentials'
        });
        return;
      }

      res.status(500).json({
        error: 'internal_server_error'
      });
    }
  }
);

export default router;