import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { createHash, randomBytes } from 'crypto';
import DOMPurify from 'isomorphic-dompurify';

// Enhanced rate limiting for different endpoint types
export const createRateLimiter = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: {
      error: 'rate_limit_exceeded',
      message: options.message || 'Too many requests from this IP'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    // Use memory store for now, should be Redis in production
    store: undefined // Uses default memory store
  });
};

// Strict rate limiting for authentication endpoints
export const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many authentication attempts, please try again later',
  skipSuccessfulRequests: true
});

// General API rate limiting
export const apiRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: 'API rate limit exceeded'
});

// Aggressive rate limiting for password reset
export const passwordResetRateLimit = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // 3 attempts per hour
  message: 'Too many password reset attempts'
});

// CSRF Protection Middleware
interface CSRFRequest extends Request {
  csrfToken?: string;
}

export const csrfProtection = (req: CSRFRequest, res: Response, next: NextFunction) => {
  // Skip CSRF for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // Skip CSRF for API key authenticated requests
  if (req.headers['x-api-key']) {
    return next();
  }

  const token = req.headers['x-csrf-token'] as string;
  const sessionToken = req.session?.csrfToken;

  if (!token || !sessionToken || token !== sessionToken) {
    return res.status(403).json({
      error: 'csrf_token_invalid',
      message: 'Invalid or missing CSRF token'
    });
  }

  next();
};

// Generate CSRF token
export const generateCSRFToken = (): string => {
  return randomBytes(32).toString('hex');
};

// Request sanitization middleware
export const sanitizeInput = (req: Request, res: Response, next: NextFunction) => {
  // Sanitize request body
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }

  next();
};

// Recursive object sanitization
function sanitizeObject(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        // Remove potentially dangerous HTML/JS
        sanitized[key] = DOMPurify.sanitize(value, { 
          ALLOWED_TAGS: [],
          ALLOWED_ATTR: []
        });
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized;
  }
  
  return obj;
}

// SQL injection prevention (additional layer beyond Prisma)
export const preventSQLInjection = (req: Request, res: Response, next: NextFunction) => {
  const sqlPatterns = [
    /(\b(ALTER|CREATE|DELETE|DROP|EXEC(UTE)?|INSERT( +INTO)?|MERGE|SELECT|UPDATE|UNION( +ALL)?)\b)/i,
    /(;|\s|^)(\s)*(exec|execute)\s*(\(|\[)/i,
    /(\b(sp_|xp_)\w+\b)|(\bMSTR\b)/i,
    /(\b(CHAR|NCHAR|VARCHAR|NVARCHAR)\s*\(\s*\d+\s*\))/i
  ];

  const checkForSQLInjection = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (Array.isArray(value)) {
      return value.some(item => checkForSQLInjection(item));
    }
    if (value && typeof value === 'object') {
      return Object.values(value).some(val => checkForSQLInjection(val));
    }
    return false;
  };

  if (checkForSQLInjection(req.body) || checkForSQLInjection(req.query)) {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'Potentially dangerous input detected'
    });
  }

  next();
};

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval'", // unsafe-eval needed for development
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "child-src 'none'",
    "worker-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "manifest-src 'self'"
  ].join('; ');

  res.setHeader('Content-Security-Policy', csp);
  res.setHeader('X-Content-Security-Policy', csp);
  res.setHeader('X-WebKit-CSP', csp);

  // Additional security headers
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS (only in production)
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }

  // Remove potentially revealing headers
  res.removeHeader('X-Powered-By');
  res.setHeader('Server', 'CRM-API');

  next();
};

// Request logging with security events
export const securityLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    };

    // Log security-relevant events
    if (res.statusCode === 429) {
      console.warn('SECURITY: Rate limit exceeded', logData);
    } else if (res.statusCode === 401) {
      console.warn('SECURITY: Unauthorized access attempt', logData);
    } else if (res.statusCode === 403) {
      console.warn('SECURITY: Forbidden access attempt', logData);
    } else if (req.url.includes('admin') && res.statusCode >= 400) {
      console.warn('SECURITY: Admin endpoint access attempt', logData);
    }
  });

  next();
};

// Payload size validation
export const validatePayloadSize = (maxSize: number = 1024 * 1024) => { // 1MB default
  return (req: Request, res: Response, next: NextFunction) => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > maxSize) {
      return res.status(413).json({
        error: 'payload_too_large',
        message: `Payload exceeds maximum size of ${maxSize} bytes`
      });
    }

    next();
  };
};

// API key validation middleware
export const validateAPIKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'] as string;
  
  if (!apiKey) {
    return res.status(401).json({
      error: 'api_key_required',
      message: 'API key is required'
    });
  }

  // In production, validate against stored API keys
  const validAPIKeys = process.env.API_KEYS?.split(',') || [];
  
  if (!validAPIKeys.includes(apiKey)) {
    return res.status(401).json({
      error: 'invalid_api_key',
      message: 'Invalid API key'
    });
  }

  next();
};

// Request timeout middleware
export const requestTimeout = (timeoutMs: number = 30000) => { // 30 seconds default
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          error: 'request_timeout',
          message: 'Request timeout'
        });
      }
    }, timeoutMs);

    res.on('finish', () => {
      clearTimeout(timeout);
    });

    next();
  };
};