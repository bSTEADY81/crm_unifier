import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';
import {
  securityHeaders,
  apiRateLimit,
  authRateLimit,
  sanitizeInput,
  preventSQLInjection,
  securityLogger,
  validatePayloadSize,
  requestTimeout
} from './middleware/security.js';

const app = express();

// Trust proxy for accurate client IPs
app.set('trust proxy', 1);

// Request timeout
app.use(requestTimeout(30000)); // 30 seconds

// Security logging
app.use(securityLogger);

// Enhanced security headers
app.use(securityHeaders);

// Enhanced Helmet configuration
app.use(helmet({
  contentSecurityPolicy: false, // We handle CSP in securityHeaders
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

// CORS with enhanced configuration
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, etc.)
    if (!origin) return callback(null, true);
    
    if (config.cors.origins.includes(origin)) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-API-Key'],
  exposedHeaders: ['X-CSRF-Token']
}));

// General API rate limiting
app.use('/api/', apiRateLimit);

// Logging
app.use(pinoHttp({ logger }));

// Cookie parsing
app.use(cookieParser());

// Input validation and sanitization
app.use(sanitizeInput);
app.use(preventSQLInjection);

// Payload size validation - smaller, more secure limits
app.use(validatePayloadSize(1024 * 1024)); // 1MB max

// Body parsing with enhanced security
const jsonLimit = Number(process.env.JSON_LIMIT_BYTES ?? 1048576); // 1MB default
const formLimit = Number(process.env.FORM_LIMIT_BYTES ?? 65536); // 64KB default

app.use(express.json({
  limit: jsonLimit,
  strict: true, // Only parse arrays and objects
  verify: (_req: any, _res, buf) => {
    if (buf.length >= jsonLimit) {
      const err: any = new Error("payload too large");
      err.type = "entity.too.large";
      throw err;
    }
  }
}));

app.use(express.urlencoded({
  extended: false,
  limit: formLimit,
  parameterLimit: 100, // Limit number of parameters
  verify: (_req: any, _res, buf) => {
    if (buf.length >= formLimit) {
      const err: any = new Error("payload too large");
      err.type = "entity.too.large";
      throw err;
    }
  }
}));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0'
  });
});

// Import routes
import authRoutes from './routes/auth';
import customerRoutes from './routes/customers';
import userRoutes from './routes/users';
import messageRoutes from './routes/messages';
import conversationRoutes from './routes/conversations';
import providerRoutes from './routes/providers';
import webhookRoutes from './routes/webhooks';
import { handleValidationError } from './middleware/validation';

// API routes with enhanced security
app.use('/api/v1/auth', authRateLimit, authRoutes); // Strict rate limiting for auth
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/messages', messageRoutes);
app.use('/api/v1/conversations', conversationRoutes);
app.use('/api/v1/providers', providerRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

app.get('/api/v1', (req, res) => {
  res.json({ 
    message: 'CRM Unifier API v1',
    docs: '/api/v1/docs',
    version: '1.1.0'
  });
});

// Handle JSON parsing errors
app.use(handleValidationError);

// Enhanced error handling with security
app.use((err: any, req: any, res: any, next: any) => {
  // Handle payload too large errors
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'payload_too_large',
      message: 'Request payload exceeds size limit'
    });
  }

  // Handle CORS errors
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      error: 'cors_error',
      message: 'Cross-origin request not allowed'
    });
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request data'
    });
  }

  // Handle authentication errors
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      error: 'unauthorized',
      message: 'Authentication required'
    });
  }

  // Log error details (but don't expose to client)
  logger.error({ 
    err: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
    },
    req: {
      id: req.id,
      method: req.method,
      url: req.url,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    }
  }, 'Unhandled error');
  
  // Return generic error to prevent information leakage
  res.status(500).json({ 
    error: 'internal_server_error',
    message: 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`
  });
});

export default app;