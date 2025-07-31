require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Trust proxy for Railway
app.set('trust proxy', true);

// CORS setup - Very permissive for debugging
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin'],
  credentials: true
}));

// Handle preflight requests
app.options('*', cors());

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Health check - FIRST
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check requested');
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Cocoa Code API is running!',
    env: process.env.NODE_ENV || 'development'
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  console.log('🧪 Test endpoint requested');
  res.json({
    message: 'Test endpoint working!',
    timestamp: new Date().toISOString(),
    server: 'running'
  });
});

// DIRECT BOOKING ROUTES - No separate router file for now
console.log('📝 Setting up booking routes...');

// GET availability
app.get('/api/bookings/availability/:month', (req, res) => {
  console.log('📅 Availability check for:', req.params.month);
  
  // For now, always return available
  res.json({
    available: true,
    currentBookings: 0,
    month: req.params.month,
    maxBookings: 4,
    note: 'Direct route - always available for testing'
  });
});

// POST booking - SIMPLIFIED VERSION
app.post('/api/bookings', async (req, res) => {
  console.log('📝 BOOKING REQUEST RECEIVED!');
  console.log('Request body:', req.body);
  console.log('Request headers:', req.headers);
  
  try {
    const { clientName, clientEmail, projectSpecs, bookingMonth, projectType } = req.body;
    
    // Basic validation
    if (!clientName || !clientEmail) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        error: 'Missing required fields: clientName and clientEmail',
        received: { clientName, clientEmail }
      });
    }
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      console.log('❌ Invalid email format');
      return res.status(400).json({
        error: 'Invalid email format'
      });
    }
    
    console.log('✅ Validation passed - creating booking...');
    
    // For now, just return success without database
    const projectId = 'PROJ-' + Date.now();
    const clientId = 'CLIENT-' + Date.now();
    
    console.log('✅ Booking created successfully!', { projectId, clientId });
    
    res.status(201).json({
      message: 'Booking created successfully',
      projectId: projectId,
      clientId: clientId,
      bookingDetails: {
        clientName,
        clientEmail,
        projectSpecs,
        bookingMonth,
        projectType
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Booking error:', error);
    res.status(500).json({
      error: 'Booking creation failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Test booking endpoint
app.post('/api/bookings/test', (req, res) => {
  console.log('🧪 Test booking requested:', req.body);
  
  res.status(201).json({
    message: 'Test booking successful',
    projectId: 'TEST-' + Date.now(),
    data: req.body,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint
app.get('/api/bookings/debug', (req, res) => {
  console.log('🔍 Debug info requested');
  
  res.json({
    message: 'Debug endpoint working',
    routes: [
      'GET /api/health',
      'GET /api/test', 
      'GET /api/bookings/availability/:month',
      'POST /api/bookings',
      'POST /api/bookings/test',
      'GET /api/bookings/debug'
    ],
    timestamp: new Date().toISOString()
  });
});

// Payments test endpoint
app.get('/api/payments/test-stripe', (req, res) => {
  console.log('💳 Stripe test requested');
  
  res.json({
    message: 'Stripe test endpoint',
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    timestamp: new Date().toISOString()
  });
});

// Replace the root route in your server.js with this complete version:

app.get('/', (req, res) => {
  res.json({
    message: '🍫 Welcome to Cocoa Code API!',
    status: 'running',
    timestamp: new Date().toISOString(),
    availableRoutes: [
      // Basic routes
      '/',
      '/api/health',
      '/api/test',
      
      // Booking routes
      '/api/bookings',
      '/api/bookings/test',
      '/api/bookings/debug',
      '/api/bookings/availability/:month',
      
      // Admin routes
      '/api/admin/login',
      '/api/admin/verify', 
      '/api/admin/inquiries',
      '/api/admin/inquiries/:id/status',
      '/api/admin/stats',
      
      // Client routes
      '/api/clients',
      '/api/clients/:id',
      
      // Payment routes
      '/api/payments/create-intent',
      '/api/payments/confirm',
      '/api/payments/webhook',
      '/api/payments/status/:paymentId',
      '/api/payments/test-stripe'
    ],
    routeCategories: {
      public: [
        '/api/health',
        '/api/test',
        '/api/bookings',
        '/api/bookings/availability/:month'
      ],
      admin: [
        '/api/admin/login',
        '/api/admin/verify',
        '/api/admin/inquiries',
        '/api/admin/inquiries/:id/status',
        '/api/admin/stats'
      ],
      clients: [
        '/api/clients',
        '/api/clients/:id'
      ],
      payments: [
        '/api/payments/create-intent',
        '/api/payments/confirm',
        '/api/payments/webhook',
        '/api/payments/status/:paymentId',
        '/api/payments/test-stripe'
      ],
      testing: [
        '/api/bookings/test',
        '/api/bookings/debug'
      ]
    }
  });
});

// Also update the catch-all route to include all endpoints:
app.use('*', (req, res) => {
  console.log(`❓ Unknown route: ${req.method} ${req.originalUrl}`);
  
  res.status(404).json({
    error: 'Route not found',
    requested: {
      method: req.method,
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    },
    availableRoutes: [
      // Basic
      'GET /',
      'GET /api/health',
      'GET /api/test',
      
      // Bookings
      'POST /api/bookings',
      'POST /api/bookings/test',
      'GET /api/bookings/debug',
      'GET /api/bookings/availability/:month',
      
      // Admin
      'POST /api/admin/login',
      'POST /api/admin/verify',
      'GET /api/admin/inquiries',
      'PUT /api/admin/inquiries/:id/status',
      'GET /api/admin/stats',
      
      // Clients
      'GET /api/clients',
      'GET /api/clients/:id',
      
      // Payments
      'POST /api/payments/create-intent',
      'POST /api/payments/confirm',
      'POST /api/payments/webhook',
      'GET /api/payments/status/:paymentId',
      'GET /api/payments/test-stripe'
    ],
    suggestion: 'Check the root endpoint (/) for a complete list of available routes'
  });
});
// Error handling
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message,
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log('📋 Available routes:');
  console.log('  GET  /', );
  console.log('  GET  /api/health');
  console.log('  GET  /api/test');
  console.log('  POST /api/bookings');
  console.log('  POST /api/bookings/test');
  console.log('  GET  /api/bookings/debug');
  console.log('  GET  /api/bookings/availability/:month');
  console.log('🎉 Server ready to receive requests!');
});

module.exports = app;