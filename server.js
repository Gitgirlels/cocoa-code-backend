require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

// Health check endpoint - FIRST for Railway
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
    message: 'Cocoa Code API is running!'
  });
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'https://gitgirlels.github.io',
      'https://cocoa-code.netlify.app'
    ];
    
    // Allow localhost, Railway, and known domains
    if (origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('railway.app') ||
        origin.includes('netlify.app') ||
        origin.includes('github.io') ||
        allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(null, true); // Allow all for development
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
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
      payments: '/api/payments'
    }
  });
});

// Initialize database connection
let dbInitialized = false;

async function initializeDatabase() {
  if (dbInitialized) return;
  
  try {
    const { sequelize } = require('./models');
    await sequelize.authenticate();
    console.log('✅ Database connected');
    
    await sequelize.sync({ alter: false });
    console.log('✅ Models synced');
    
    dbInitialized = true;
  } catch (error) {
    console.error('❌ Database error:', error.message);
    // Don't crash the app - let it run without DB for health checks
  }
}

// Routes - with error handling
try {
  app.use('/api/bookings', require('./routes/bookings'));
  console.log('✅ Bookings routes loaded');
} catch (error) {
  console.error('❌ Error loading bookings routes:', error.message);
}

try {
  app.use('/api/clients', require('./routes/clients'));
  console.log('✅ Clients routes loaded');
} catch (error) {
  console.error('❌ Error loading clients routes:', error.message);
}

try {
  app.use('/api/admin', require('./routes/admin'));
  console.log('✅ Admin routes loaded');
} catch (error) {
  console.error('❌ Error loading admin routes:', error.message);
}

// Add payments route with error handling
try {
  app.use('/api/payments', require('./routes/payments'));
  console.log('✅ Payments routes loaded');
} catch (error) {
  console.error('❌ Error loading payments routes:', error.message);
}

// Fallback booking route if main routes fail
app.post('/api/bookings', (req, res) => {
  console.log('📝 Fallback booking route hit');
  res.json({
    message: 'Booking received (fallback mode)',
    projectId: 'fallback-' + Date.now(),
    status: 'received'
  });
});

app.get('/api/bookings/availability/:month', (req, res) => {
  console.log('📅 Fallback availability check');
  res.json({
    available: true,
    currentBookings: 0,
    month: req.params.month,
    maxBookings: 4,
    mode: 'fallback'
  });
});

// Catch-all for unknown routes
app.use('*', (req, res) => {
  console.log(`🤔 Unknown route: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableRoutes: [
      'GET /',
      'GET /health',
      'GET /api/health',
      'POST /api/bookings',
      'GET /api/bookings/availability/:month',
      'POST /api/payments/create-intent',
      'POST /api/payments/confirm'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize database after server starts
  initializeDatabase();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection:', reason);
  process.exit(1);
});

module.exports = app;