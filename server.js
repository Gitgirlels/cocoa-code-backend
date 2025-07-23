require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 5000;

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

// Routes with database dependency
app.use('/api/bookings', async (req, res, next) => {
  try {
    if (!dbInitialized) {
      await initializeDatabase();
    }
    require('./routes/bookings')(req, res, next);
  } catch (error) {
    console.error('❌ Bookings route error:', error);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
});

app.use('/api/clients', async (req, res, next) => {
  try {
    if (!dbInitialized) {
      await initializeDatabase();
    }
    require('./routes/clients')(req, res, next);
  } catch (error) {
    console.error('❌ Clients route error:', error);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
});

app.use('/api/admin', async (req, res, next) => {
  try {
    if (!dbInitialized) {
      await initializeDatabase();
    }
    require('./routes/admin')(req, res, next);
  } catch (error) {
    console.error('❌ Admin route error:', error);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
});

app.use('/api/payments', async (req, res, next) => {
  try {
    if (!dbInitialized) {
      await initializeDatabase();
    }
    require('./routes/payments')(req, res, next);
  } catch (error) {
    console.error('❌ Payments route error:', error);
    res.status(503).json({ error: 'Service temporarily unavailable' });
  }
});

// Fallback routes
app.post('/api/bookings', (req, res) => {
  console.log('📝 Fallback booking route');
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
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method
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

// Start server
const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Initialize database after server starts
  await initializeDatabase();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    if (db?.sequelize) {
      db.sequelize.close();
    }
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, shutting down gracefully...');
  server.close(() => {
    if (db?.sequelize) {
      db.sequelize.close();
    }
    process.exit(0);
  });
});

module.exports = app;