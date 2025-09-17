import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateSchema, validateJson } from '../middleware/validation';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { ProviderFactory, ProviderService } from '../services/providers/ProviderFactory';

const router = Router();
const prisma = new PrismaClient();

// Provider schemas for validation
const providerParamsSchema = z.object({
  params: z.object({
    providerId: z.string().uuid('Must be a valid UUID')
  }),
  query: z.any().optional(),
  body: z.any().optional()
});

const providerListSchema = z.object({
  query: z.object({
    page: z.string().optional().transform(val => val ? parseInt(val, 10) : 1)
      .refine(val => val >= 1, 'Page must be at least 1'),
    limit: z.string().optional().transform(val => val ? parseInt(val, 10) : 50)
      .refine(val => val >= 1 && val <= 100, 'Limit must be between 1 and 100'),
    type: z.enum(['sms', 'email', 'voice', 'whatsapp', 'facebook', 'instagram']).optional(),
    status: z.enum(['active', 'inactive', 'error']).optional()
  }).partial(),
  body: z.any().optional(),
  params: z.any().optional()
});

const createProviderSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Provider name is required').max(255, 'Name exceeds maximum length'),
    type: z.enum(['sms', 'email', 'voice', 'whatsapp', 'facebook', 'instagram']),
    config: z.object({
      accountSid: z.string().optional(),
      authToken: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().email().optional(),
      apiKey: z.string().optional(),
      webhookUrl: z.string().url().optional()
    }),
    description: z.string().max(500, 'Description exceeds maximum length').optional()
  }),
  query: z.any().optional(),
  params: z.any().optional()
});

const updateProviderSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'Provider name is required').max(255, 'Name exceeds maximum length').optional(),
    config: z.object({
      accountSid: z.string().optional(),
      authToken: z.string().optional(),
      phoneNumber: z.string().optional(),
      email: z.string().email().optional(),
      apiKey: z.string().optional(),
      webhookUrl: z.string().url().optional()
    }).optional(),
    description: z.string().max(500, 'Description exceeds maximum length').optional(),
    isActive: z.boolean().optional()
  }),
  query: z.any().optional(),
  params: z.object({
    providerId: z.string().uuid('Must be a valid UUID')
  })
});

// GET /providers - List providers with filtering and pagination
router.get('/',
  requireAuth,
  validateSchema(providerListSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page = 1, limit = 50, type, status } = req.query;

      const where: any = {};
      if (type) where.type = type;
      if (status) where.status = status;

      const [providers, totalCount] = await Promise.all([
        prisma.provider.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            _count: {
              select: { messages: true }
            }
          }
        }),
        prisma.provider.count({ where })
      ]);

      // Get status for each provider
      const providersWithStatus = await Promise.all(
        providers.map(async (provider) => {
          let providerStatus = null;
          let statistics = { messagesSent: 0, messagesReceived: 0 };

          try {
            // Initialize adapter if not exists
            if (!ProviderFactory.getAdapter(provider.id)) {
              ProviderFactory.createAdapter(provider.id, {
                type: provider.type as any,
                credentials: provider.config as Record<string, string>,
                settings: {}
              });
            }

            // Get real-time status
            providerStatus = await ProviderService.getStatus(provider.id);
            
            // Get message statistics from database
            const messageStats = await prisma.message.groupBy({
              by: ['direction'],
              where: { providerId: provider.id },
              _count: true
            });

            messageStats.forEach(stat => {
              if (stat.direction === 'outbound') {
                statistics.messagesSent = stat._count;
              } else if (stat.direction === 'inbound') {
                statistics.messagesReceived = stat._count;
              }
            });

          } catch (error) {
            console.error(`Error getting status for provider ${provider.id}:`, error);
          }

          // Mask sensitive config data
          const maskedConfig = { ...provider.config as any };
          if (maskedConfig.authToken) maskedConfig.authToken = '***';
          if (maskedConfig.accessToken) maskedConfig.accessToken = '***';
          if (maskedConfig.apiKey) maskedConfig.apiKey = '***';

          return {
            id: provider.id,
            name: provider.name,
            type: provider.type,
            status: provider.status,
            config: maskedConfig,
            isActive: provider.status === 'active',
            messageCount: provider._count.messages,
            lastHealthCheck: provider.lastHealthCheck,
            errorMessage: provider.errorMessage,
            createdAt: provider.createdAt,
            updatedAt: provider.updatedAt,
            statistics,
            connectionStatus: providerStatus
          };
        })
      );

      res.status(200).json({
        providers: providersWithStatus,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limit)
        }
      });
    } catch (error) {
      console.error('Get providers error:', error);
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to retrieve providers'
      });
    }
  }
);

// GET /providers/:providerId - Get specific provider
router.get('/:providerId',
  requireAuth,
  validateSchema(providerParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { providerId } = req.params;

      // TODO: Implement actual database query
      const mockProvider = {
        id: providerId,
        name: 'Twilio SMS',
        type: 'sms',
        status: 'active',
        config: {
          accountSid: 'AC*********************',
          phoneNumber: '+15551234567',
          webhookUrl: 'https://api.example.com/webhooks/twilio'
        },
        description: 'Primary SMS provider using Twilio',
        isActive: true,
        messageCount: 1250,
        lastUsed: new Date(Date.now() - 3600000).toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        statistics: {
          messagesDelivered: 1200,
          messagesFailed: 50,
          deliveryRate: 96.0,
          averageResponseTime: 850
        }
      };

      res.status(200).json(mockProvider);
    } catch (error) {
      console.error('Get provider error:', error);
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to retrieve provider'
      });
    }
  }
);

// POST /providers - Create new provider
router.post('/',
  requireAuth,
  validateJson,
  validateSchema(createProviderSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { name, type, config, description } = req.body;

      // 1. Check if provider with same name already exists
      const existingProvider = await prisma.provider.findFirst({
        where: { name }
      });

      if (existingProvider) {
        res.status(409).json({
          error: 'provider_already_exists',
          message: 'A provider with this name already exists'
        });
        return;
      }

      // 2. Validate and test provider configuration
      let testResult = null;
      try {
        // Create temporary adapter to test connection
        const tempId = `temp-${Date.now()}`;
        ProviderFactory.createAdapter(tempId, {
          type: type as any,
          credentials: config as Record<string, string>,
          settings: {}
        });
        
        testResult = await ProviderService.testConnection(tempId);
        
        // Clean up temporary adapter
        ProviderFactory.removeAdapter(tempId);
        
        if (!testResult.success) {
          res.status(400).json({
            error: 'provider_connection_failed',
            message: `Provider connection test failed: ${testResult.message}`,
            details: testResult.details
          });
          return;
        }
      } catch (testError) {
        console.error('Provider connection test failed:', testError);
        res.status(400).json({
          error: 'provider_connection_failed',
          message: 'Unable to connect to provider with provided credentials'
        });
        return;
      }

      // 3. Create provider record in database
      const newProvider = await prisma.provider.create({
        data: {
          name,
          type: type as any,
          status: 'active',
          config: config,
          description: description || null,
          lastHealthCheck: new Date()
        }
      });

      // 4. Initialize adapter for the new provider
      ProviderFactory.createAdapter(newProvider.id, {
        type: newProvider.type as any,
        credentials: newProvider.config as Record<string, string>,
        settings: {}
      });

      // 5. Mask sensitive config data in response
      const maskedConfig = { ...newProvider.config as any };
      if (maskedConfig.authToken) maskedConfig.authToken = '***';
      if (maskedConfig.accessToken) maskedConfig.accessToken = '***';
      if (maskedConfig.apiKey) maskedConfig.apiKey = '***';
      if (maskedConfig.clientSecret) maskedConfig.clientSecret = '***';
      if (maskedConfig.appSecret) maskedConfig.appSecret = '***';

      res.status(201).json({
        id: newProvider.id,
        name: newProvider.name,
        type: newProvider.type,
        status: newProvider.status,
        config: maskedConfig,
        description: newProvider.description,
        isActive: newProvider.status === 'active',
        messageCount: 0,
        lastHealthCheck: newProvider.lastHealthCheck,
        createdAt: newProvider.createdAt,
        updatedAt: newProvider.updatedAt,
        connectionTest: testResult
      });
    } catch (error) {
      console.error('Create provider error:', error);
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to create provider'
      });
    }
  }
);

// PUT /providers/:providerId - Update provider
router.put('/:providerId',
  requireAuth,
  validateJson,
  validateSchema(updateProviderSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { providerId } = req.params;
      const { name, config, description, isActive } = req.body;

      // 1. Check if provider exists
      const existingProvider = await prisma.provider.findUnique({
        where: { id: providerId }
      });

      if (!existingProvider) {
        res.status(404).json({
          error: 'provider_not_found',
          message: 'Provider not found'
        });
        return;
      }

      // 2. Check if another provider with the same name exists (if name is being changed)
      if (name && name !== existingProvider.name) {
        const nameConflict = await prisma.provider.findFirst({
          where: { 
            name,
            id: { not: providerId }
          }
        });

        if (nameConflict) {
          res.status(409).json({
            error: 'provider_name_exists',
            message: 'A provider with this name already exists'
          });
          return;
        }
      }

      // 3. Test new configuration if credentials are being updated
      let testResult = null;
      const newConfig = config ? { ...existingProvider.config as any, ...config } : existingProvider.config;
      
      if (config) {
        try {
          // Create temporary adapter to test connection
          const tempId = `temp-${Date.now()}`;
          ProviderFactory.createAdapter(tempId, {
            type: existingProvider.type as any,
            credentials: newConfig as Record<string, string>,
            settings: {}
          });
          
          testResult = await ProviderService.testConnection(tempId);
          
          // Clean up temporary adapter
          ProviderFactory.removeAdapter(tempId);
          
          if (!testResult.success) {
            res.status(400).json({
              error: 'provider_connection_failed',
              message: `Provider connection test failed: ${testResult.message}`,
              details: testResult.details
            });
            return;
          }
        } catch (testError) {
          console.error('Provider connection test failed:', testError);
          res.status(400).json({
            error: 'provider_connection_failed',
            message: 'Unable to connect to provider with updated credentials'
          });
          return;
        }
      }

      // 4. Prepare update data
      const updateData: any = {
        updatedAt: new Date()
      };

      if (name !== undefined) updateData.name = name;
      if (config !== undefined) {
        updateData.config = newConfig;
        updateData.lastHealthCheck = new Date();
      }
      if (description !== undefined) updateData.description = description;
      if (isActive !== undefined) {
        updateData.status = isActive ? 'active' : 'inactive';
      }

      // 5. Update provider in database
      const updatedProvider = await prisma.provider.update({
        where: { id: providerId },
        data: updateData,
        include: {
          _count: {
            select: { messages: true }
          }
        }
      });

      // 6. Update or recreate adapter if config changed
      if (config || isActive !== undefined) {
        // Remove existing adapter
        ProviderFactory.removeAdapter(providerId);
        
        // Create new adapter if provider is active
        if (updatedProvider.status === 'active') {
          ProviderFactory.createAdapter(providerId, {
            type: updatedProvider.type as any,
            credentials: updatedProvider.config as Record<string, string>,
            settings: {}
          });
        }
      }

      // 7. Mask sensitive config data in response
      const maskedConfig = { ...updatedProvider.config as any };
      if (maskedConfig.authToken) maskedConfig.authToken = '***';
      if (maskedConfig.accessToken) maskedConfig.accessToken = '***';
      if (maskedConfig.apiKey) maskedConfig.apiKey = '***';
      if (maskedConfig.clientSecret) maskedConfig.clientSecret = '***';
      if (maskedConfig.appSecret) maskedConfig.appSecret = '***';

      res.status(200).json({
        id: updatedProvider.id,
        name: updatedProvider.name,
        type: updatedProvider.type,
        status: updatedProvider.status,
        config: maskedConfig,
        description: updatedProvider.description,
        isActive: updatedProvider.status === 'active',
        messageCount: updatedProvider._count.messages,
        lastHealthCheck: updatedProvider.lastHealthCheck,
        errorMessage: updatedProvider.errorMessage,
        createdAt: updatedProvider.createdAt,
        updatedAt: updatedProvider.updatedAt,
        connectionTest: testResult
      });
    } catch (error) {
      console.error('Update provider error:', error);
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to update provider'
      });
    }
  }
);

// DELETE /providers/:providerId - Deactivate provider
router.delete('/:providerId',
  requireAuth,
  validateSchema(providerParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { providerId } = req.params;

      // 1. Check if provider exists
      const existingProvider = await prisma.provider.findUnique({
        where: { id: providerId },
        include: {
          _count: {
            select: { 
              messages: true,
              conversations: {
                where: { status: 'active' }
              }
            }
          }
        }
      });

      if (!existingProvider) {
        res.status(404).json({
          error: 'provider_not_found',
          message: 'Provider not found'
        });
        return;
      }

      // 2. Check if provider has active conversations
      if (existingProvider._count.conversations > 0) {
        res.status(409).json({
          error: 'provider_has_active_conversations',
          message: `Cannot deactivate provider with ${existingProvider._count.conversations} active conversations. Please reassign or close conversations first.`,
          details: {
            activeConversations: existingProvider._count.conversations,
            totalMessages: existingProvider._count.messages
          }
        });
        return;
      }

      // 3. Soft delete (deactivate) provider
      const deactivatedProvider = await prisma.provider.update({
        where: { id: providerId },
        data: {
          status: 'inactive',
          errorMessage: 'Provider manually deactivated',
          updatedAt: new Date()
        }
      });

      // 4. Remove adapter from memory
      ProviderFactory.removeAdapter(providerId);

      // 5. Create audit event
      if (req.user?.id) {
        await prisma.auditEvent.create({
          data: {
            userId: req.user.id,
            action: 'provider.deactivated',
            resourceType: 'provider',
            resourceId: providerId,
            metadata: {
              providerName: deactivatedProvider.name,
              providerType: deactivatedProvider.type,
              messageCount: existingProvider._count.messages,
              deactivatedAt: new Date().toISOString()
            }
          }
        });
      }

      res.status(200).json({
        id: providerId,
        name: deactivatedProvider.name,
        type: deactivatedProvider.type,
        status: 'inactive',
        deactivatedAt: deactivatedProvider.updatedAt,
        deactivatedBy: req.user?.id,
        messageCount: existingProvider._count.messages,
        message: 'Provider has been successfully deactivated'
      });
    } catch (error) {
      console.error('Delete provider error:', error);
      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to deactivate provider'
      });
    }
  }
);

// POST /providers/:providerId/test - Test provider connection
router.post('/:providerId/test',
  requireAuth,
  validateSchema(providerParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { providerId } = req.params;

      // Get provider from database
      const provider = await prisma.provider.findUnique({
        where: { id: providerId }
      });

      if (!provider) {
        res.status(404).json({
          error: 'provider_not_found',
          message: 'Provider not found'
        });
        return;
      }

      // Initialize adapter if not exists
      if (!ProviderFactory.getAdapter(provider.id)) {
        ProviderFactory.createAdapter(provider.id, {
          type: provider.type as any,
          credentials: provider.config as Record<string, string>,
          settings: {}
        });
      }

      const startTime = Date.now();
      const testResult = await ProviderService.testConnection(providerId);
      const responseTime = Date.now() - startTime;

      // Update provider health check
      await prisma.provider.update({
        where: { id: providerId },
        data: {
          lastHealthCheck: new Date(),
          status: testResult.success ? 'active' : 'error',
          errorMessage: testResult.success ? null : testResult.message
        }
      });

      res.status(200).json({
        providerId,
        status: testResult.success ? 'success' : 'failed',
        message: testResult.message,
        details: testResult.details,
        responseTime,
        testedAt: testResult.timestamp
      });
    } catch (error) {
      console.error('Test provider error:', error);
      
      // Update provider status to error
      try {
        await prisma.provider.update({
          where: { id: req.params.providerId },
          data: {
            lastHealthCheck: new Date(),
            status: 'error',
            errorMessage: error instanceof Error ? error.message : 'Unknown error occurred'
          }
        });
      } catch (updateError) {
        console.error('Failed to update provider status:', updateError);
      }

      res.status(500).json({
        error: 'internal_server_error',
        message: 'Failed to test provider'
      });
    }
  }
);

export default router;