import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const validateJson = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    const contentType = req.headers['content-type'];
    
    if (!contentType || !contentType.includes('application/json')) {
      res.status(400).json({
        error: 'Bad Request',
        message: 'Content-Type must be application/json'
      });
      return;
    }
  }

  next();
};

export const validateSchema = <T>(schema: z.ZodSchema<T>) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = schema.safeParse({
        body: req.body,
        query: req.query,
        params: req.params
      });

      if (!result.success) {
        const errors = result.error.errors.map(error => {
          // Get the field name (remove prefixes for cleaner field names)
          let field = error.path.join('.');
          field = field.replace(/^(body\.|params\.|query\.)/, '');
          
          // Normalize common messages to match API spec
          let message = error.message;
          
          // Email validation
          if (message.toLowerCase().includes("email") && message.toLowerCase().includes("valid")) {
            message = "valid email";
          }
          
          // Password validation  
          if (message.toLowerCase().includes("at least") && message.toLowerCase().includes("6")) {
            message = "password must be at least 6";
          }
          if (message.toLowerCase().includes("at least") && message.toLowerCase().includes("8")) {
            message = "must be at least 8 characters";  
          }
          
          // UUID validation
          if (message.toLowerCase().includes("valid uuid")) {
            message = "valid UUID";
          }
          
          // Date validation
          if (message.toLowerCase().includes("invalid") && message.toLowerCase().includes("date")) {
            message = "valid datetime";
          }
          
          // Required field validation
          if (message === "Required") {
            message = "required";
          }
          
          return { field, message };
        });

        res.status(400).json({
          error: 'Validation failed',
          details: errors
        });
        return;
      }

      // Replace request objects with validated data
      req.body = result.data.body;
      req.query = result.data.query;
      req.params = result.data.params;

      next();
    } catch (error) {
      console.error('Validation error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Validation failed'
      });
      return;
    }
  };
};

// Common validation schemas
export const paginationSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1)
      .refine(val => val >= 1, 'Page must be at least 1'),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50)
      .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
  }).partial(),
  body: z.any().optional(),
  params: z.any().optional()
});

export const uuidSchema = z.string().uuid('Must be a valid UUID');

export const loginSchema = z.object({
  body: z.object({
    email: z.string().email('Must be a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters')
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const customerCreateSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Name cannot be empty').max(255, 'Name exceeds maximum length of 255 characters'),
    displayName: z.string().max(100, 'Display name exceeds maximum length of 100 characters').optional(),
    metadata: z.record(z.any()).optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

export const customerListSchema = z.object({
  query: z.object({
    search: z.string().max(255, 'Search query must be less than 255 characters').optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1)
      .refine(val => val >= 1, 'Page must be at least 1'),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50)
      .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100')
  }).partial(),
  body: z.any().optional(),
  params: z.any().optional()
});

export const customerParamsSchema = z.object({
  params: z.object({
    customerId: uuidSchema
  }),
  query: z.any().optional(),
  body: z.any().optional()
});

export const timelineQuerySchema = z.object({
  params: z.object({
    customerId: uuidSchema
  }),
  query: z.object({
    channel: z.enum(['sms', 'email', 'voice', 'whatsapp', 'facebook', 'instagram']).optional(),
    from: z.string().datetime('Invalid from date format').optional(),
    to: z.string().datetime('Invalid to date format').optional(),
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1)
      .refine(val => val >= 1, 'Page must be at least 1'),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50)
      .refine(val => val >= 1 && val <= 1000, 'Limit must be between 1 and 1000')
  }).partial().refine(data => {
    if (data.from && data.to) {
      return new Date(data.from) < new Date(data.to);
    }
    return true;
  }, 'from date must be before to date'),
  body: z.any().optional()
});

export const handleValidationError = (
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (error instanceof SyntaxError && 'body' in error) {
    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid JSON format'
    });
    return;
  }

  next(error);
};