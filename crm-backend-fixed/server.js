const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Trust proxy (for Railway deployment)
app.set('trust proxy', 1);

// Compression middleware
app.use(compression());

// Logging middleware
app.use(morgan('combined'));

// Security middleware
const securityMiddleware = require('./middleware/security-middleware');
securityMiddleware(app);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API Routes
const apiRouter = express.Router();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '0.1.0'
  });
});

// API base route
apiRouter.get('/', (req, res) => {
  res.json({
    message: 'CRM Unifier API v1',
    docs: '/api/v1/docs'
  });
});

// Customers endpoints
apiRouter.get('/customers', (req, res) => {
  // Check for authentication header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).send('Access denied');
  }
  
  // In production, verify the token here
  // For now, return mock data
  res.json({
    customers: [
      { id: 1, name: 'John Doe', email: 'john@example.com' },
      { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
    ]
  });
});

apiRouter.post('/customers', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).send('Access denied');
  }
  
  // Validate request body
  const { name, email } = req.body;
  
  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required' });
  }
  
  // In production, save to database
  res.status(201).json({
    id: Date.now(),
    name,
    email,
    createdAt: new Date().toISOString()
  });
});

// Messages endpoints
apiRouter.get('/messages', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).send('Access denied');
  }
  
  res.json({
    messages: [
      { id: 1, subject: 'Welcome', from: 'system@crm.com', date: new Date().toISOString() }
    ]
  });
});

// Providers endpoints
apiRouter.get('/providers', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(403).send('Access denied');
  }
  
  res.json({
    providers: [
      { id: 1, name: 'Email Provider', type: 'email', status: 'active' },
      { id: 2, name: 'SMS Provider', type: 'sms', status: 'active' }
    ]
  });
});

// API documentation endpoint
apiRouter.get('/docs', (req, res) => {
  res.json({
    title: 'CRM Unifier API Documentation',
    version: 'v1',
    endpoints: {
      health: {
        method: 'GET',
        path: '/health',
        description: 'Health check endpoint',
        authentication: false
      },
      customers: {
        list: {
          method: 'GET',
          path: '/api/v1/customers',
          description: 'List all customers',
          authentication: true
        },
        create: {
          method: 'POST',
          path: '/api/v1/customers',
          description: 'Create a new customer',
          authentication: true,
          body: {
            name: 'string',
            email: 'string'
          }
        }
      },
      messages: {
        list: {
          method: 'GET',
          path: '/api/v1/messages',
          description: 'List all messages',
          authentication: true
        }
      },
      providers: {
        list: {
          method: 'GET',
          path: '/api/v1/providers',
          description: 'List all providers',
          authentication: true
        }
      }
    }
  });
});

// Mount API router
app.use('/api/v1', apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`API: http://localhost:${PORT}/api/v1`);
});
