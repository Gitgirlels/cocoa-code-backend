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
    callback(null, true); // Allow all for debugging
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
    mode: 'MINIMAL TEST MODE'
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
  }
}

console.log('🧪 MINIMAL TEST MODE - Testing one route at a time');

// TEST ONLY ONE ROUTE AT A TIME
// Uncomment ONLY ONE route block to test

// TEST 1: Bookings route
try {
  console.log('🧪 Testing bookings route...');
  app.use('/api/bookings', require('./routes/bookings'));
  console.log('✅ Bookings routes loaded successfully');
} catch (error) {
  console.error('❌ BOOKINGS ROUTE FAILED:', error.message);
  console.error('❌ Stack:', error.stack);
}

// TEST 2: Clients route (COMMENT OUT BOOKINGS FIRST)
// try {
//   console.log('🧪 Testing clients route...');
//   app.use('/api/clients', require('./routes/clients'));
//   console.log('✅ Clients routes loaded successfully');
// } catch (error) {
//   console.error('❌ CLIENTS ROUTE FAILED:', error.message);
//   console.error('❌ Stack:', error.stack);
// }

// TEST 3: Admin route (COMMENT OUT OTHERS FIRST)
// try {
//   console.log('🧪 Testing admin route...');
//   app.use('/api/admin', require('./routes/admin'));
//   console.log('✅ Admin routes loaded successfully');
// } catch (error) {
//   console.error('❌ ADMIN ROUTE FAILED:', error.message);
//   console.error('❌ Stack:', error.stack);
// }

// Simple fallback routes
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test route working!' });
});

// Catch-all for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    method: req.method,
    mode: 'minimal-test'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  console.error('❌ Server stack:', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MINIMAL TEST SERVER running on http://0.0.0.0:${PORT}`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`🧪 Test endpoint: http://localhost:${PORT}/api/test`);
  
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

module.exports = app;