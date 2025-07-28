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

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  trustProxy: true
});

app.use(limiter);

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5500',
      'http://localhost:5500',
      'https://gitgirlels.github.io',
      'https://cocoa-code.netlify.app'
    ];
    
    if (origin.includes('localhost') || 
        origin.includes('127.0.0.1') || 
        origin.includes('railway.app') ||
        origin.includes('netlify.app') ||
        origin.includes('github.io') ||
        allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(null, true);
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

// CORRECTED: Proper route loading function
async function loadRoutes() {
  try {
    // Initialize database first
    await initializeDatabase();
    
    // Load routes properly
    const bookingsRouter = require('./routes/bookings');
    const paymentsRouter = require('./routes/payments');
    
    // Use the routers
    app.use('/api/bookings', bookingsRouter);
    app.use('/api/payments', paymentsRouter);
    
    console.log('✅ All routes loaded successfully');
    
  } catch (error) {
    console.error('❌ Error loading routes:', error.message);
    
    // Fallback routes if main routes fail
    app.use('/api/bookings', (req, res) => {
      res.status(503).json({ 
        error: 'Bookings service temporarily unavailable',
        details: 'Database connection issue'
      });
    });
    
    app.use('/api/payments', (req, res) => {
      res.status(503).json({ 
        error: 'Payment service temporarily unavailable',
        details: 'Service configuration issue'
      });
    });
  }
}

// Fallback routes for testing
app.post('/api/bookings/fallback', (req, res) => {
  console.log('📝 Fallback booking route');
  res.json({
    message: 'Booking received (fallback mode)',
    projectId: 'fallback-' + Date.now(),
    status: 'received'
  });
});

app.get('/api/bookings/availability/fallback/:month', (req, res) => {
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
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    availableEndpoints: [
      '/api/health',
      '/api/bookings',
      '/api/payments',
      '/api/bookings/availability/:month'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// Start server and load routes
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Load routes after server starts
  await loadRoutes();
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

module.exports = app;