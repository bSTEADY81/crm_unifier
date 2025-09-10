import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { config } from './config/index.js';
import { logger } from './lib/logger.js';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.cors.origins,
  credentials: true
}));

// Rate limiting
app.use(rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP'
}));

// Logging
app.use(pinoHttp({ logger }));

// Body parsing with size limits
const jsonLimit = Number(process.env.JSON_LIMIT_BYTES ?? 262144);
const formLimit = Number(process.env.FORM_LIMIT_BYTES ?? 65536);

app.use(express.json({
  limit: jsonLimit,
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
import { handleValidationError } from './middleware/validation';

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/customers', customerRoutes);

app.get('/api/v1', (req, res) => {
  res.json({ 
    message: 'CRM Unifier API v1',
    docs: '/api/v1/docs'
  });
});

// Handle JSON parsing errors
app.use(handleValidationError);

// Error handling
app.use((err: any, req: any, res: any, next: any) => {
  // Handle payload too large errors
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'payload_too_large',
      message: 'payload exceeds limit'
    });
  }

  logger.error({ err, req: req.id }, 'Unhandled error');
  res.status(500).json({ 
    error: 'internal_error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
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