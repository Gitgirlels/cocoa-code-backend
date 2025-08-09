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

// ADD DATABASE CONNECTION TEST
const { sequelize, Client, Project, Payment } = require('./models');

async function testDatabaseConnection() {
  try {
    console.log('🔄 Testing database connection...');
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
    
    // Test table creation/sync
    await sequelize.sync({ alter: false });
    console.log('✅ Database tables are ready.');
    
    const clientCount = await Client.count();
    const projectCount = await Project.count();
    console.log(`📈 Current data: ${clientCount} clients, ${projectCount} projects`);
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
    return false;
  }
}

// ADD THE MISSING fixDatabaseSchema FUNCTION
async function fixDatabaseSchema() {
  try {
    console.log('🔧 Fixing database schema issues...');
    
    // Force update the database schema to match models
    await sequelize.sync({ alter: true });
    console.log('✅ Database schema synchronized successfully');
    
    // Test that the fix worked by checking table structure
    const [results] = await sequelize.query("DESCRIBE projects");
    const statusColumn = results.find(col => col.Field === 'status');
    console.log('✅ Status column definition:', statusColumn);
    
    return true;
  } catch (error) {
    console.error('❌ Schema fix failed:', error);
    return false;
  }
}

// IMPORT AND USE EXISTING ROUTE FILES
try {
  const bookingRoutes = require('./routes/bookings');
  const adminRoutes = require('./routes/admin');
  const clientRoutes = require('./routes/clients');
  const paymentRoutes = require('./routes/payments');

  // USE ROUTES - This will make your admin panel work!
  app.use('/api/bookings', bookingRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/clients', clientRoutes);
  app.use('/api/payments', paymentRoutes);
  
  console.log('✅ All route files loaded successfully');
} catch (error) {
  console.error('❌ Error loading route files:', error.message);
  console.log('📝 Falling back to direct routes in server.js');
}

// KEEP ALL YOUR EXISTING DIRECT BOOKING ROUTES AS BACKUP
console.log('📝 Setting up backup booking routes...');

// GET availability
app.get('/api/bookings/availability/:month', (req, res) => {
  console.log('📅 Availability check for:', req.params.month);
  
  // For now, always return available
  res.json({
    available: true,
    currentBookings: 0,
    month: req.params.month,
    maxBookings: 99999,
    unlimited: true,
    note: 'No booking limits - always available'
  });
});

// POST booking - SIMPLIFIED VERSION (your existing code)
app.post('/api/bookings', async (req, res) => {
  console.log('📝 BOOKING REQUEST RECEIVED!');
  
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
    
    // Try to use database models if available
    if (Client && Project) {
      try {
        console.log('💾 Attempting to save to database...');
        
        // Create or find client
        const [client, created] = await Client.findOrCreate({
          where: { email: clientEmail },
          defaults: { 
            name: clientName, 
            email: clientEmail 
          }
        });
        
        console.log(`✅ Client ${created ? 'created' : 'found'}:`, client.id);
        
        // Create project
        const project = await Project.create({
          clientId: client.id,
          projectType: projectType || 'custom',
          specifications: projectSpecs || 'No specifications provided',
          websiteType: 'other',
          primaryColor: '#8B4513',
          secondaryColor: '#D2B48C', 
          accentColor: '#CD853F',
          basePrice: 0,
          totalPrice: 0,
          bookingMonth: bookingMonth || null,
          status: 'pending'
        });
        
        console.log('✅ Project saved to database:', project.id);
        
        // Try to send email
        try {
          const { sendBookingConfirmation } = require('./services/emailService');
          await sendBookingConfirmation(project, client);
          console.log('✅ Booking confirmation email sent');
        } catch (emailError) {
          console.warn('⚠️ Email sending failed:', emailError.message);
        }
        
        return res.status(201).json({
          message: 'Booking created successfully and saved to database!',
          projectId: project.id,
          clientId: client.id,
          bookingDetails: {
            clientName,
            clientEmail,
            projectSpecs,
            bookingMonth,
            projectType
          },
          timestamp: new Date().toISOString(),
          databaseSaved: true
        });
        
      } catch (dbError) {
        console.error('❌ Database save failed:', dbError.message);
        // Fall through to test mode below
      }
    }
    
    // Fallback to test mode if database fails
    const projectId = 'PROJ-' + Date.now();
    const clientId = 'CLIENT-' + Date.now();
    
    console.log('⚠️ Using test mode - booking not saved to database');
    
    res.status(201).json({
      message: 'Booking created successfully (test mode - not saved to database)',
      projectId: projectId,
      clientId: clientId,
      bookingDetails: {
        clientName,
        clientEmail,
        projectSpecs,
        bookingMonth,
        projectType
      },
      timestamp: new Date().toISOString(),
      databaseSaved: false,
      warning: 'Database connection issue - booking not permanently saved'
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
app.get('/api/bookings/debug', async (req, res) => {
  console.log('🔍 Debug info requested');
  
  try {
    if (!Project || !Client) {
      return res.json({
        message: 'Database models not available',
        modelsAvailable: false,
        totalProjects: 0,
        bookingsByMonth: {},
        allProjects: [],
        timestamp: new Date().toISOString(),
        routes: [
          'GET /api/health',
          'GET /api/test', 
          'GET /api/bookings/availability/:month',
          'POST /api/bookings',
          'POST /api/bookings/test',
          'GET /api/bookings/debug'
        ]
      });
    }

    const projects = await Project.findAll({
      include: [{ model: Client, as: 'client' }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    const summary = {};
    projects.forEach(project => {
      if (project.bookingMonth) {
        summary[project.bookingMonth] = (summary[project.bookingMonth] || 0) + 1;
      }
    });
    
    // ✅ ENSURE allProjects IS ALWAYS AN ARRAY WITH PROPER DATA
    const allProjectsData = projects.map(p => ({
      id: p.id,
      projectType: p.projectType,
      client: p.client ? {
        name: p.client.name,
        email: p.client.email
      } : { name: 'Unknown', email: 'Unknown' },
      status: p.status,
      bookingMonth: p.bookingMonth,
      totalPrice: p.totalPrice,
      projectSpecs: p.specifications, // ✅ INCLUDE PROJECT SPECS
      specifications: p.specifications, // ✅ BACKUP FIELD
      items: p.items || [], // ✅ INCLUDE ITEMS IF AVAILABLE
      createdAt: p.createdAt
    }));
    
    res.json({
      totalProjects: projects.length,
      bookingsByMonth: summary,
      recentProject: allProjectsData[0] || null,
      allProjects: allProjectsData, // ✅ ALWAYS AN ARRAY
      modelsAvailable: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      totalProjects: 0,
      bookingsByMonth: {},
      allProjects: [], // ✅ ALWAYS RETURN ARRAY EVEN ON ERROR
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ BACKUP APPROVE/DECLINE ROUTES (SIMPLIFIED - NO INCLUDES)
console.log('📝 Setting up backup approve/decline routes...');

// QUICK FIX: Add this to your server.js file
// This adds better error handling to your existing decline route

// ✅ ENHANCED DECLINE ROUTE - Add this to replace your existing decline route
app.post('/api/bookings/:id/decline', async (req, res) => {
  try {
    console.log(`❌ [DECLINE] Processing booking ${req.params.id}`);
    
    // Validate booking ID
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      console.error('❌ Invalid booking ID:', req.params.id);
      return res.status(400).json({ 
        error: 'Invalid booking ID',
        received: req.params.id
      });
    }
    
    // Check if database models are available
    if (!Project) {
      console.error('❌ Project model not available');
      return res.status(500).json({ 
        error: 'Database models not available',
        details: 'Project model is undefined'
      });
    }

    // Test database connection first
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection verified for decline');
    } catch (dbTestError) {
      console.error('❌ Database connection test failed:', dbTestError.message);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: 'Unable to connect to database'
      });
    }

    // Find the project with detailed error handling
    let project;
    try {
      project = await Project.findByPk(projectId);
      console.log('📋 Project lookup result:', project ? `Found ID ${project.id}` : 'Not found');
    } catch (findError) {
      console.error('❌ Database error finding project:', findError.message);
      console.error('Full error:', findError);
      return res.status(500).json({ 
        error: 'Database query failed',
        details: findError.message
      });
    }
    
    if (!project) {
      console.log(`❌ Booking ${projectId} not found in database`);
      return res.status(404).json({ 
        error: 'Booking not found',
        id: projectId,
        message: 'No booking exists with this ID'
      });
    }

    console.log(`📋 Found booking ${projectId}, current status: ${project.status}`);

    // Update project status with detailed error handling
    try {
      const updateResult = await project.update({ 
        status: 'declined'
      });
      
      console.log(`✅ Booking ${projectId} status updated to 'declined'`);
      console.log('Update result:', updateResult.status);
      
    } catch (updateError) {
      console.error('❌ Failed to update project status:', updateError.message);
      console.error('Full update error:', updateError);
      return res.status(500).json({ 
        error: 'Failed to update booking status',
        details: updateError.message
      });
    }

    // Try to send decline email (don't fail if this doesn't work)
    try {
      if (Client) {
        const client = await Client.findByPk(project.clientId);
        if (client) {
          const { sendDeclineEmail } = require('./services/emailService');
          await sendDeclineEmail(client);
          console.log('📩 Decline email sent successfully');
        } else {
          console.warn('⚠️ Client not found for email notification');
        }
      }
    } catch (emailError) {
      console.warn('⚠️ Decline email failed (but booking was declined):', emailError.message);
    }

    // Success response
    const response = {
      success: true, 
      message: 'Booking declined successfully',
      projectId: project.id,
      status: project.status,
      timestamp: new Date().toISOString()
    };

    console.log(`🎉 Decline completed successfully:`, response);
    res.json(response);

  } catch (error) {
    console.error('❌ [DECLINE] Unexpected error:', error.message);
    console.error('Full error stack:', error.stack);
    console.error('Request details:', {
      id: req.params.id,
      body: req.body,
      headers: req.headers
    });
    
    res.status(500).json({ 
      error: 'Unexpected error during decline',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ ENHANCED APPROVE ROUTE - Add this to replace your existing approve route  
app.post('/api/bookings/:id/approve', async (req, res) => {
  try {
    console.log(`✅ [APPROVE] Processing booking ${req.params.id}`);
    
    // Validate booking ID
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId)) {
      console.error('❌ Invalid booking ID:', req.params.id);
      return res.status(400).json({ 
        error: 'Invalid booking ID',
        received: req.params.id
      });
    }
    
    // Check if database models are available
    if (!Project) {
      console.error('❌ Project model not available');
      return res.status(500).json({ 
        error: 'Database models not available',
        details: 'Project model is undefined'
      });
    }

    // Test database connection first
    try {
      await sequelize.authenticate();
      console.log('✅ Database connection verified for approval');
    } catch (dbTestError) {
      console.error('❌ Database connection test failed:', dbTestError.message);
      return res.status(500).json({ 
        error: 'Database connection failed',
        details: 'Unable to connect to database'
      });
    }

    // Find the project with detailed error handling
    let project;
    try {
      project = await Project.findByPk(projectId);
      console.log('📋 Project lookup result:', project ? `Found ID ${project.id}` : 'Not found');
    } catch (findError) {
      console.error('❌ Database error finding project:', findError.message);
      return res.status(500).json({ 
        error: 'Database query failed',
        details: findError.message
      });
    }
    
    if (!project) {
      console.log(`❌ Booking ${projectId} not found in database`);
      return res.status(404).json({ 
        error: 'Booking not found',
        id: projectId,
        message: 'No booking exists with this ID'
      });
    }

    console.log(`📋 Found booking ${projectId}, current status: ${project.status}`);

    // Update project status with detailed error handling
    try {
      await project.update({ 
        status: 'approved'
      });
      
      console.log(`✅ Booking ${projectId} status updated to 'approved'`);
      
    } catch (updateError) {
      console.error('❌ Failed to update project status:', updateError.message);
      return res.status(500).json({ 
        error: 'Failed to update booking status',
        details: updateError.message
      });
    }

    // Try to send approval email (don't fail if this doesn't work)
    try {
      if (Client) {
        const client = await Client.findByPk(project.clientId);
        if (client) {
          const { sendApprovalEmail } = require('./services/emailService');
          await sendApprovalEmail(project, client);
          console.log('✅ Approval email sent successfully');
        } else {
          console.warn('⚠️ Client not found for email notification');
        }
      }
    } catch (emailError) {
      console.warn('⚠️ Approval email failed (but booking was approved):', emailError.message);
    }

    // Success response
    res.json({ 
      success: true, 
      message: 'Booking approved successfully',
      projectId: project.id,
      status: project.status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [APPROVE] Unexpected error:', error.message);
    console.error('Full error stack:', error.stack);
    
    res.status(500).json({ 
      error: 'Unexpected error during approval',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// ✅ TEST THE ROUTES
app.get('/api/bookings/:id/test', async (req, res) => {
  try {
    console.log(`🧪 Testing booking ${req.params.id}`);
    
    if (!Project) {
      return res.json({ 
        error: 'Database models not available',
        id: req.params.id
      });
    }

    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.json({ 
        error: 'Booking not found',
        id: req.params.id
      });
    }

    res.json({
      success: true,
      project: {
        id: project.id,
        status: project.status,
        type: project.projectType
      }
    });

  } catch (error) {
    console.error('❌ Test booking error:', error);
    res.status(500).json({ 
      error: 'Test failed',
      details: error.message 
    });
  }
});

// Payments test endpoint
app.get('/api/payments/test-stripe', (req, res) => {
  console.log('💳 Stripe test requested');
  
  res.json({
    message: 'Stripe test endpoint',
    hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
    hasStripeWebhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Root route with complete API documentation
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
      '/api/bookings/:id/approve',
      '/api/bookings/:id/decline',
      '/api/bookings/:id/test',
      
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
        '/api/admin/stats',
        '/api/bookings/:id/approve',
        '/api/bookings/:id/decline'
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
        '/api/bookings/debug',
        '/api/bookings/:id/test'
      ]
    }
  });
});

// Catch-all route for unknown endpoints
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
      'POST /api/bookings/:id/approve',
      'POST /api/bookings/:id/decline',
      'GET /api/bookings/:id/test',
      
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

// Start server with enhanced diagnostics
app.listen(PORT, '0.0.0.0', async () => {
  console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // Test database connection
  const dbConnected = await testDatabaseConnection();
  
  if (!dbConnected) {
    console.error('⚠️ WARNING: Database not connected - bookings will not be saved permanently!');
    console.error('Check your DATABASE_URL environment variable');
    console.error('Bookings will work in test mode but won\'t be saved to database');
  } else {
    console.log('✅ Database connected - bookings will be saved properly');
  }
  
  // Test email configuration
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.error('⚠️ WARNING: Email not configured - no confirmation emails will be sent!');
    console.error('Set EMAIL_USER and EMAIL_PASS environment variables');
    console.error('EMAIL_USER should be: cocoacodeco@gmail.com');
    console.error('EMAIL_PASS should be: Gmail app password (16 characters)');
  } else {
    console.log('✅ Email service configured');
  }
  
  // Test Stripe configuration
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('⚠️ WARNING: Stripe not configured - payments will not work!');
    console.error('Set STRIPE_SECRET_KEY environment variable');
  } else {
    console.log('✅ Stripe configured');
  }
  
  console.log('📋 Available routes:');
  console.log('  GET  /');
  console.log('  GET  /api/health');
  console.log('  GET  /api/test');
  console.log('  POST /api/bookings');
  console.log('  POST /api/bookings/test');
  console.log('  GET  /api/bookings/debug');
  console.log('  GET  /api/bookings/availability/:month');
  console.log('  POST /api/bookings/:id/approve');
  console.log('  POST /api/bookings/:id/decline');
  console.log('  GET  /api/bookings/:id/test');
  console.log('  GET  /api/admin/stats');
  console.log('  GET  /api/clients');
  console.log('  POST /api/payments/create-intent');
  console.log('🎉 Server ready to receive requests!');
});

module.exports = app;