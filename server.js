require('dotenv').config(); // 🔼 at the top before anything else

const rateLimit = require('express-rate-limit');
const express = require('express');
const cors = require('cors');
const { sequelize } = require('./models');

const app = express();
const PORT = process.env.PORT || 5000;

// Health check endpoint - MUST be before other middleware for Railway
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Cocoa Code API is running!',
    env: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Cocoa Code API is running!',
    env: process.env.NODE_ENV || 'development'
  });
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Increased limit for development
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting
app.use(limiter);

// Security middleware
const helmet = require('helmet');
app.use(helmet({
  crossOriginEmbedderPolicy: false // Fix for Railway deployment
}));

// 🔥 CORS Configuration - More permissive for Railway
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'https://gitgirlels.github.io',
      'https://cocoa-code.netlify.app',
      'file://'
    ];
    
    // Allow any localhost or Railway domains
    if (origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('railway.app') ||
        origin.includes('netlify.app') ||
        origin.includes('github.io') ||
        allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(null, true); // More permissive for development
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Parse JSON and URL-encoded data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('📦 Request body keys:', Object.keys(req.body));
  }
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
      admin: '/api/admin'
    }
  });
});

// Routes
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/admin', require('./routes/admin'));

// Catch-all route for debugging - MUST be after other routes
app.get('*', (req, res) => {
  console.log(`🤔 Unknown route requested: ${req.method} ${req.path}`);
  res.status(404).json({ 
    error: 'Route not found',
    requestedPath: req.path,
    method: req.method,
    availableRoutes: [
      'GET /',
      'GET /health',
      'GET /api/health',
      'GET /api/bookings/availability/:month',
      'POST /api/bookings',
      'GET /api/clients',
      'POST /api/clients',
      'GET /api/admin/projects',
      'GET /api/admin/stats'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Database connection and sync
async function initializeDatabase() {
  try {
    console.log('🔄 Initializing database connection...');
    
    // Test database connection with timeout
    await Promise.race([
      sequelize.authenticate(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Database connection timeout')), 10000)
      )
    ]);
    
    console.log('✅ Connected to database successfully');
    
    // Sync models (create tables if they don't exist)
    await sequelize.sync({ alter: false }); // Changed to false for production
    console.log('✅ All models synced');
    
    // Log current bookings for debugging (with error handling)
    try {
      const { Project } = require('./models');
      const bookings = await Project.findAll({ 
        attributes: ['bookingMonth'],
        raw: true,
        limit: 10 // Limit for performance
      });
      
      console.log('📊 Current bookings in database:', 
        bookings.map(b => b.bookingMonth).filter(Boolean)
      );
    } catch (dbError) {
      console.log('⚠️ Could not fetch bookings (database may be empty):', dbError.message);
    }
    
  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    
    // Don't exit in production - let the app run without DB for health checks
    if (process.env.NODE_ENV === 'production') {
      console.log('⚠️ Running without database in production mode');
    } else {
      process.exit(1);
    }
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  try {
    await sequelize.close();
    console.log('✅ Database connection closed');
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
  }
  process.exit(0);
});

// Initialize database then start server
const startServer = async () => {
  try {
    // Start server first for Railway health checks
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
      console.log(`🔍 API Health Check: http://localhost:${PORT}/api/health`);
      console.log(`📅 Availability Check: http://localhost:${PORT}/api/bookings/availability/July%202025`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // Initialize database after server starts
    await initializeDatabase();

    return server;
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

startServer();