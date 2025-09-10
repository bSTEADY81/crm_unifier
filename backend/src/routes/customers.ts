import { Router, Request, Response } from 'express';
import { CustomerModel } from '../models/customer';
import { requireAuth, requireStaff } from '../middleware/auth';
import { 
  validateSchema, 
  validateJson, 
  customerCreateSchema, 
  customerListSchema,
  customerParamsSchema,
  timelineQuerySchema
} from '../middleware/validation';
import { requireUuidParam } from '../middleware/validators';

const router = Router();

// String normalization utility
const clean = (s?: string | null) => s?.trim().replace(/\s+/g, ' ') || undefined;

// GET /customers - List customers with search and pagination
router.get('/', 
  requireAuth,
  validateSchema(customerListSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { search, page, limit } = req.query;

      // Trim and bound inputs
      const boundedLimit = Math.min(Math.max(Number(limit) || 25, 1), 100);
      const boundedPage = Math.max(Number(page) || 1, 1);

      const result = await CustomerModel.list({
        search: search as string,
        page: boundedPage,
        limit: boundedLimit
      });

      res.status(200).json(result);
    } catch (error) {
      console.error('Customer list error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve customers'
      });
    }
  }
);

// POST /customers - Create new customer
router.post('/',
  requireAuth,
  requireStaff,
  validateJson,
  validateSchema(customerCreateSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, displayName, metadata } = req.body;

      // Normalize string inputs
      const cleanName = clean(name);
      const cleanDisplayName = clean(displayName);

      const customer = await CustomerModel.create({
        name: cleanName!,
        displayName: cleanDisplayName,
        metadata
      });

      res.status(201).json(customer);
    } catch (error) {
      console.error('Customer creation error:', error);
      
      if (error instanceof Error) {
        // Handle specific validation errors
        if (error.message.includes('violates check constraint') || 
            error.message.includes('invalid input')) {
          res.status(400).json({
            error: 'Validation failed',
            message: error.message
          });
          return;
        }
      }

      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create customer'
      });
    }
  }
);

// GET /customers/:customerId - Get customer details
router.get('/:customerId',
  requireAuth,
  requireUuidParam('customerId'),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;

      const customer = await CustomerModel.findById(customerId);

      if (!customer) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Customer not found'
        });
        return;
      }

      res.status(200).json(customer);
    } catch (error) {
      console.error('Customer detail error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve customer'
      });
    }
  }
);

// GET /customers/:customerId/timeline - Get customer message timeline
router.get('/:customerId/timeline',
  requireAuth,
  requireUuidParam('customerId'),
  validateSchema(timelineQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const { channel, from, to, page, limit } = req.query;

      // Validate date formats if provided
      if (from) {
        const fromDate = new Date(from as string);
        if (Number.isNaN(+fromDate)) {
          res.status(400).json({
            error: 'validation_error',
            details: [{ field: 'from', message: 'valid datetime' }]
          });
          return;
        }
      }
      
      if (to) {
        const toDate = new Date(to as string);
        if (Number.isNaN(+toDate)) {
          res.status(400).json({
            error: 'validation_error',
            details: [{ field: 'to', message: 'valid datetime' }]
          });
          return;
        }
      }

      // Check if customer exists
      const customerExists = await CustomerModel.exists(customerId);
      if (!customerExists) {
        res.status(404).json({
          error: 'Not Found',
          message: 'Customer not found'
        });
        return;
      }

      // Trim and bound inputs
      const boundedLimit = Math.min(Math.max(Number(limit) || 50, 1), 1000);
      const boundedPage = Math.max(Number(page) || 1, 1);

      const timeline = await CustomerModel.getMessageTimeline(customerId, {
        channel: channel as any,
        from: from ? new Date(from as string) : undefined,
        to: to ? new Date(to as string) : undefined,
        page: boundedPage,
        limit: boundedLimit
      });

      // Add nextCursor only when there are more items
      const result = {
        ...timeline,
        nextCursor: timeline.messages.length === boundedLimit ? 
          timeline.messages[timeline.messages.length - 1]?.id : null
      };

      res.status(200).json(result);
    } catch (error) {
      console.error('Customer timeline error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to retrieve customer timeline'
      });
    }
  }
);

export default router;