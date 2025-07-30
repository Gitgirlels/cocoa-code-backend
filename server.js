require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// IMPORTANT: Add this for Railway deployment
app.set('trust proxy', true);

// Health check endpoint - FIRST for Railway
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Cocoa Code API is running!',
    env: process.env.NODE_ENV || 'development'
  });
});

// Rate limiting - More permissive for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  }
});

app.use(limiter);

// Security middleware - Updated for better CORS support
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: false // Disable CSP for now to avoid blocking issues
}));

// FIXED: Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'https://gitgirlels.github.io',
      'https://cocoa-code.netlify.app',
      'https://cocoa-code-backend-production.up.railway.app'
    ];
    
    // More permissive origin checking
    const isAllowed = origin.includes('localhost') || 
                     origin.includes('127.0.0.1') || 
                     origin.includes('railway.app') ||
                     origin.includes('netlify.app') ||
                     origin.includes('github.io') ||
                     allowedOrigins.includes(origin);
    
    if (isAllowed) {
      return callback(null, true);
    }
    
    // Log rejected origins for debugging
    console.log(`🚫 CORS rejected origin: ${origin}`);
    callback(null, true); // Allow anyway for now - remove in production
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.headers.origin || 'none'}`);
  next();
});

// Root route
app.get('/', (req, res) => {
  res.json({
    message: '🍫 Welcome to Cocoa Code API!',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/api/health',
      bookings: '/api/bookings',
      availability: '/api/bookings/availability/:month',
      clients: '/api/clients',
      admin: '/api/admin',
      payments: '/api/payments'
    }
  });
});

// Initialize database with error handling
let db = null;
let dbInitialized = false;

async function initializeDatabase() {
  if (dbInitialized) return db;
  
  try {
    const { sequelize } = require('./models');
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    
    // Use alter: true for Railway to handle schema changes
    await sequelize.sync({ alter: true });
    console.log('✅ Database models synchronized');
    
    dbInitialized = true;
    db = { sequelize };
    return db;
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    // Continue without DB for basic health checks
    return null;
  }
}

// FIXED: Improved route loading with better error handling
async function loadRoutes() {
  try {
    // Initialize database first
    await initializeDatabase();
    
    // Load routes with try-catch for each
    try {
      const bookingsRouter = require('./routes/bookings');
      app.use('/api/bookings', bookingsRouter);
      console.log('✅ Bookings routes loaded');
    } catch (error) {
      console.error('❌ Failed to load bookings routes:', error.message);
      // Add fallback route
      app.use('/api/bookings', (req, res) => {
        res.status(503).json({ 
          error: 'Bookings service temporarily unavailable',
          details: 'Route loading failed'
        });
      });
    }
    
    try {
      const paymentsRouter = require('./routes/payments');
      app.use('/api/payments', paymentsRouter);
      console.log('✅ Payments routes loaded');
    } catch (error) {
      console.error('❌ Failed to load payments routes:', error.message);
      app.use('/api/payments', (req, res) => {
        res.status(503).json({ 
          error: 'Payment service temporarily unavailable',
          details: 'Route loading failed'
        });
      });
    }
    
    try {
      const clientsRouter = require('./routes/clients');
      app.use('/api/clients', clientsRouter);
      console.log('✅ Clients routes loaded');
    } catch (error) {
      console.error('❌ Failed to load clients routes:', error.message);
    }
    
    try {
      const adminRouter = require('./routes/admin');
      app.use('/api/admin', adminRouter);
      console.log('✅ Admin routes loaded');
    } catch (error) {
      console.error('❌ Failed to load admin routes:', error.message);
    }
    
    console.log('✅ Route loading completed');
    
  } catch (error) {
    console.error('❌ Critical error loading routes:', error.message);
  }
}

// FIXED: Add test endpoints for debugging
app.get('/api/test', (req, res) => {
  res.json({
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString(),
    database: dbInitialized ? 'connected' : 'not connected',
    environment: process.env.NODE_ENV || 'development'
  });
});

// Simple booking endpoint for testing
app.post('/api/bookings/test', async (req, res) => {
  try {
    console.log('📝 Test booking received:', req.body);
    
    // Simple validation
    const { clientName, clientEmail } = req.body;
    if (!clientName || !clientEmail) {
      return res.status(400).json({
        error: 'Missing required fields: clientName and clientEmail'
      });
    }
    
    // Return success response
    res.status(201).json({
      message: 'Test booking successful',
      projectId: 'TEST-' + Date.now(),
      clientId: 'CLIENT-' + Date.now(),
      data: req.body,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Test booking error:', error);
    res.status(500).json({
      error: 'Test booking failed',
      details: error.message
    });
  }
});

// Add Stripe test endpoint
app.get('/api/payments/test-stripe', (req, res) => {
  const hasStripeKey = !!process.env.STRIPE_SECRET_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;
  
  res.json({
    message: hasStripeKey ? 'Stripe configuration found' : 'Stripe not configured',
    hasStripeKey,
    hasWebhookSecret,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Catch-all for unknown routes
app.use('*', (req, res) => {
  console.log(`❓ Unknown route accessed: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      '/api/health',
      '/api/test',
      '/api/bookings',
      '/api/bookings/test',
      '/api/admin',
      '/api/clients',
      '/api/payments',
      '/api/payments/test-stripe'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  console.error('Stack:', err.stack);
  
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start server and load routes
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📊 Database URL: ${process.env.DATABASE_URL ? 'configured' : 'not configured'}`);
  console.log(`💳 Stripe: ${process.env.STRIPE_SECRET_KEY ? 'configured' : 'not configured'}`);
  
  // Load routes after server starts
  await loadRoutes();
  
  console.log('🎉 Server initialization complete!');
});

// Graceful shutdown handlers
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  if (db?.sequelize) {
    db.sequelize.close();
  }
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  if (db?.sequelize) {
    db.sequelize.close();
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  if (db?.sequelize) {
    db.sequelize.close();
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

module.exports = app;