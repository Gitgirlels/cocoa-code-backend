require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = Number(process.env.PORT) || 5000;

app.enable('trust proxy'); // Railway / proxies

// Allowlist: add/remove as you need
const allowlist = [
  'https://www.cocoacode.dev',
  'https://cocoacode.dev',            // harmless even if apex redirects
  'https://cocoa-code.netlify.app',   // Netlify production/preview
  'http://localhost:3000',
  'http://localhost:5000',
  'http://127.0.0.1:5500',
  'http://localhost:5500'
];

const corsOptions = {
  origin(origin, cb) {
    if (!origin) return cb(null, true);           // curl/Postman/no-origin
    return cb(null, allowlist.includes(origin));  // true => allowed, false => blocked
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // preflight with same rules

// (Optional) force HTTPS in production
app.use((req, res, next) => {
  const xf = req.headers['x-forwarded-proto'];
  if (req.secure || xf === 'https') return next();
  return res.redirect(308, 'https://' + req.headers.host + req.originalUrl);
});

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

// POST booking - FIXED VERSION WITH PROPER EMAIL
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
        
        // ✅ FIXED: Try to send booking confirmation email
let emailSent = false;
try {
  const { sendBookingConfirmation } = require('./services/emailService');
  
  console.log(`📧 Attempting to send email to: ${client.email}`); // Debug log
  console.log('📧 Debug email data:');
console.log('- Client email:', client.email);
console.log('- Client object:', client);
console.log('- Project ID:', project.id);
  // ✅ CORRECT: Call with proper parameters INCLUDING 'to' field
  await sendBookingConfirmation({
    to: client.email,  // ← This was missing!
    client: {
      name: client.name,
      email: client.email
    },
    project: {
      id: project.id,
      projectType: project.projectType,
      totalPrice: project.totalPrice,
      bookingMonth: project.bookingMonth
    },
    projectSpecs: project.specifications
  });
  
  emailSent = true;
  console.log('✅ Booking confirmation email sent successfully');
} catch (emailError) {
  console.error('❌ Email sending failed:', emailError.message);
  console.error('Email error details:', emailError);
}
        
        return res.status(201).json({
          message: 'Booking created successfully and saved to database!',
          projectId: project.id,
          clientId: client.id,
          emailSent: emailSent, // ✅ Fixed: properly declared variable
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
      emailSent: false, // ✅ Fixed: properly declared
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

// ✅ FIXED DECLINE ROUTE WITH PROPER EMAIL
app.post('/api/bookings/:id/decline', async (req, res) => {
  try {
    console.log(`❌ [DECLINE-FIXED] Processing booking ${req.params.id}`);
    
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({ 
        error: 'Invalid booking ID',
        received: req.params.id,
        parsed: projectId
      });
    }

    if (!Project) {
      return res.status(500).json({ 
        error: 'Database models not available' 
      });
    }

    // Find the project with client data
    let project;
    try {
      project = await Project.findByPk(projectId, {
        include: [{ model: Client, as: 'client' }]
      });
    } catch (findError) {
      console.error('❌ Find error:', findError.message);
      return res.status(500).json({ 
        error: 'Database find failed',
        details: findError.message 
      });
    }
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Booking not found',
        id: projectId
      });
    }

    console.log(`📋 Current project status: ${project.status}`);

    // 🎯 TRY MULTIPLE UPDATE METHODS
    let updateSuccess = false;
    let finalStatus = null;

    // Method 1: Standard Sequelize update
    try {
      await project.update({ status: 'declined' });
      await project.reload();
      finalStatus = project.status;
      updateSuccess = true;
      console.log('✅ Method 1 (Sequelize update) succeeded');
    } catch (updateError1) {
      console.warn('⚠️ Method 1 failed:', updateError1.message);
      
      // Method 2: Direct property update + save
      try {
        project.status = 'declined';
        await project.save();
        finalStatus = project.status;
        updateSuccess = true;
        console.log('✅ Method 2 (direct save) succeeded');
      } catch (updateError2) {
        console.warn('⚠️ Method 2 failed:', updateError2.message);
        
        // Method 3: Raw SQL update as last resort
        try {
          await sequelize.query(
            'UPDATE projects SET status = :status WHERE id = :id',
            {
              replacements: { status: 'declined', id: projectId },
              type: sequelize.QueryTypes.UPDATE
            }
          );
          
          // Verify the update worked
          const [results] = await sequelize.query(
            'SELECT status FROM projects WHERE id = :id',
            {
              replacements: { id: projectId },
              type: sequelize.QueryTypes.SELECT
            }
          );
          
          if (results && results.status === 'declined') {
            finalStatus = 'declined';
            updateSuccess = true;
            console.log('✅ Method 3 (raw SQL) succeeded');
          }
        } catch (updateError3) {
          console.error('❌ All update methods failed:', updateError3.message);
        }
      }
    }

    if (!updateSuccess) {
      return res.status(500).json({ 
        error: 'Failed to update booking status',
        details: 'All update methods failed',
        currentStatus: project.status,
        emailSent: false
      });
    }

    console.log(`🎉 Booking ${projectId} successfully declined. Status: ${finalStatus}`);

    // 📧 TRY TO SEND DECLINE EMAIL - FIXED
    let emailSent = false;
    let emailError = null;

    try {
      if (project.client && project.client.email) {
        console.log(`📧 Sending decline email to: ${project.client.email}`);
        
        const { sendDeclineEmail } = require('./services/emailService');
        
        // ✅ CORRECT: Call sendDeclineEmail (not sendBookingConfirmation)
        await sendDeclineEmail({
          to: project.client.email,
          client: {
            name: project.client.name,
            email: project.client.email
          },
          project: {
            id: project.id,
            projectType: project.projectType,
            bookingMonth: project.bookingMonth,
            totalPrice: project.totalPrice
          }
        });
        
        emailSent = true;
        console.log('✅ Decline email sent successfully');
      } else {
        console.warn('⚠️ No client email found - cannot send decline email');
        emailError = 'Client email not available';
      }
    } catch (emailSendError) {
      console.error('❌ Email sending failed:', emailSendError.message);
      emailError = emailSendError.message;
    }

    res.json({ 
      success: true, 
      message: 'Booking declined successfully',
      projectId: projectId,
      status: finalStatus,
      emailSent: emailSent,
      emailError: emailError,
      method: updateSuccess ? 'database_updated' : 'unknown'
    });

  } catch (error) {
    console.error('❌ [DECLINE-FIXED] Critical error:', error);
    res.status(500).json({ 
      error: 'Critical system error',
      details: error.message,
      emailSent: false
    });
  }
});

// 🎯 FIXED APPROVE ROUTE WITH EMAIL
app.post('/api/bookings/:id/approve', async (req, res) => {
  try {
    console.log(`✅ [APPROVE-FIXED] Processing booking ${req.params.id}`);
    
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({ 
        error: 'Invalid booking ID',
        received: req.params.id,
        parsed: projectId
      });
    }

    if (!Project) {
      return res.status(500).json({ 
        error: 'Database models not available' 
      });
    }

    // Find the project with client data
    let project;
    try {
      project = await Project.findByPk(projectId, {
        include: [{ model: Client, as: 'client' }]
      });
    } catch (findError) {
      console.error('❌ Find error:', findError.message);
      return res.status(500).json({ 
        error: 'Database find failed',
        details: findError.message 
      });
    }
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Booking not found',
        id: projectId
      });
    }

    console.log(`📋 Current project status: ${project.status}`);

    // 🎯 TRY MULTIPLE UPDATE METHODS
    let updateSuccess = false;
    let finalStatus = null;

    // Method 1: Standard Sequelize update
    try {
      await project.update({ status: 'approved' });
      await project.reload();
      finalStatus = project.status;
      updateSuccess = true;
      console.log('✅ Method 1 (Sequelize update) succeeded');
    } catch (updateError1) {
      console.warn('⚠️ Method 1 failed:', updateError1.message);
      
      // Method 2: Direct property update + save
      try {
        project.status = 'approved';
        await project.save();
        finalStatus = project.status;
        updateSuccess = true;
        console.log('✅ Method 2 (direct save) succeeded');
      } catch (updateError2) {
        console.warn('⚠️ Method 2 failed:', updateError2.message);
        
        // Method 3: Raw SQL update
        try {
          await sequelize.query(
            'UPDATE projects SET status = :status WHERE id = :id',
            {
              replacements: { status: 'approved', id: projectId },
              type: sequelize.QueryTypes.UPDATE
            }
          );
          
          // Verify the update worked
          const [results] = await sequelize.query(
            'SELECT status FROM projects WHERE id = :id',
            {
              replacements: { id: projectId },
              type: sequelize.QueryTypes.SELECT
            }
          );
          
          if (results && results.status === 'approved') {
            finalStatus = 'approved';
            updateSuccess = true;
            console.log('✅ Method 3 (raw SQL) succeeded');
          }
        } catch (updateError3) {
          console.error('❌ All update methods failed:', updateError3.message);
        }
      }
    }

    if (!updateSuccess) {
      return res.status(500).json({ 
        error: 'Failed to update booking status',
        details: 'All update methods failed',
        currentStatus: project.status,
        emailSent: false
      });
    }

    console.log(`🎉 Booking ${projectId} successfully approved. Status: ${finalStatus}`);

    // 📧 TRY TO SEND APPROVAL EMAIL
    let emailSent = false;
    let emailError = null;

    try {
      if (project.client && project.client.email) {
        console.log(`📧 Sending approval email to: ${project.client.email}`);
        
        const { sendApprovalEmail } = require('./services/emailService');
        
        // Call the email service with proper parameters
        await sendApprovalEmail({
          to: project.client.email,
          client: {
            name: project.client.name,
            email: project.client.email
          },
          project: {
            id: project.id,
            projectType: project.projectType,
            bookingMonth: project.bookingMonth,
            totalPrice: project.totalPrice,
            projectSpecs: project.specifications
          },
          projectSpecs: project.specifications
        });
        
        emailSent = true;
        console.log('✅ Approval email sent successfully');
      } else {
        console.warn('⚠️ No client email found - cannot send approval email');
        emailError = 'Client email not available';
      }
    } catch (emailSendError) {
      console.error('❌ Email sending failed:', emailSendError.message);
      emailError = emailSendError.message;
    }

    res.json({ 
      success: true, 
      message: 'Booking approved successfully',
      projectId: projectId,
      status: finalStatus,
      emailSent: emailSent,
      emailError: emailError,
      method: updateSuccess ? 'database_updated' : 'unknown'
    });

  } catch (error) {
    console.error('❌ [APPROVE-FIXED] Critical error:', error);
    res.status(500).json({ 
      error: 'Critical system error',
      details: error.message,
      emailSent: false
    });
  }
});

// 📧 ADD EMAIL TEST ROUTE
app.post('/api/test/email', async (req, res) => {
  try {
    console.log('📧 Testing email service...');
    
    const { to, type } = req.body;
    
    // Test SMTP connection first
    const { sendEmail } = require('./services/emailService');
    
    await sendEmail({
      to: to || 'test@example.com',
      subject: '🧪 Cocoa Code - Email Service Test',
      html: `
        <div style="font-family: 'Courier New', monospace; padding: 20px; background: #F5F5DC; border-radius: 10px;">
          <h2 style="color: #8B4513;">🍫 Email Service Test</h2>
          <p>This is a test email from Cocoa Code backend.</p>
          <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          <p><strong>Status:</strong> ✅ Email service is working!</p>
        </div>
      `,
      text: `Cocoa Code Email Service Test - ${new Date().toISOString()} - Email service is working!`
    });
    
    res.json({
      success: true,
      message: 'Email service test completed successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Email test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Email service test failed',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 🔍 ADD ROUTE TO GET BOOKING DETAILS (for the View Details button)
app.get('/api/bookings/:id/details', async (req, res) => {
  try {
    console.log(`🔍 Getting details for booking ${req.params.id}`);
    
    const projectId = parseInt(req.params.id);
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({ 
        error: 'Invalid booking ID' 
      });
    }

    if (!Project) {
      return res.status(500).json({ 
        error: 'Database models not available' 
      });
    }

    const project = await Project.findByPk(projectId, {
      include: [{ model: Client, as: 'client' }]
    });
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Booking not found' 
      });
    }

    res.json({
      success: true,
      project: {
        id: project.id,
        projectType: project.projectType,
        status: project.status,
        bookingMonth: project.bookingMonth,
        totalPrice: project.totalPrice,
        projectSpecs: project.specifications,
        specifications: project.specifications,
        items: project.items || [],
        createdAt: project.createdAt,
        updatedAt: project.updatedAt
      },
      client: {
        id: project.client?.id,
        name: project.client?.name,
        email: project.client?.email
      }
    });

  } catch (error) {
    console.error('❌ Get details error:', error);
    res.status(500).json({ 
      error: 'Failed to get booking details',
      details: error.message 
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
    ]
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
  console.log('  POST /api/test/email');
  console.log('🎉 Server ready to receive requests!');
});

module.exports = app;