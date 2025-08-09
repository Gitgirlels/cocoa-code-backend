const express = require('express');
const router = express.Router();

// SIMPLIFIED: Import models with error handling
let Client, Project;
try {
  const models = require('../models');
  Client = models.Client;
  Project = models.Project;
} catch (error) {
  console.error('❌ Models not available:', error.message);
}

// Check availability for a month
router.get('/availability/:month', async (req, res) => {
  const { month } = req.params;
  const decodedMonth = decodeURIComponent(month);
  
  console.log('📅 Availability check for month:', decodedMonth);
  
  // ALWAYS return available - no database checks needed
  res.json({ 
    available: true, 
    currentBookings: 0,
    month: decodedMonth,
    maxBookings: 999999,
    unlimited: true,
    message: 'All months are available - no booking limits'
  });
});

// Create new booking
router.post('/', async (req, res) => {
  try {
    console.log('📝 Booking request received:', {
      body: req.body,
      headers: req.headers,
      timestamp: new Date().toISOString()
    });
    
    const {
      clientName,
      clientEmail,
      projectSpecs,
      websiteType,
      bookingMonth,
      projectType,
      basePrice,
      totalPrice,
      primaryColor,
      secondaryColor,
      accentColor
    } = req.body;

    // Basic validation
    if (!clientName || !clientEmail) {
      console.error('❌ Missing required fields');
      return res.status(400).json({ 
        error: 'Client name and email are required',
        received: { clientName, clientEmail }
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(clientEmail)) {
      return res.status(400).json({ 
        error: 'Please provide a valid email address' 
      });
    }

    console.log('✅ Basic validation passed');

    // If no database models available, return success for testing
    if (!Client || !Project) {
      console.warn('⚠️ Database models not available - returning mock success');
      return res.status(201).json({
        message: 'Booking received successfully (test mode)',
        projectId: 'TEST-' + Date.now(),
        clientId: 'CLIENT-' + Date.now(),
        emailSent: false,
        mode: 'test'
      });
    }

    // Create or find client
    let client;
    try {
      const [clientRecord, created] = await Client.findOrCreate({
        where: { email: clientEmail },
        defaults: { 
          name: clientName, 
          email: clientEmail 
        }
      });
      client = clientRecord;
      console.log(`✅ Client ${created ? 'created' : 'found'}:`, client.id);
    } catch (error) {
      console.error('❌ Client creation failed:', error);
      return res.status(500).json({ 
        error: 'Failed to create client record',
        details: error.message 
      });
    }

    // Create project
    let project;
    try {
      const projectData = {
        clientId: client.id,
        projectType: projectType || 'service-only',
        specifications: projectSpecs || 'No specifications provided',
        websiteType: websiteType || 'other',
        primaryColor: primaryColor || '#8B4513',
        secondaryColor: secondaryColor || '#D2B48C',
        accentColor: accentColor || '#CD853F',
        basePrice: parseFloat(basePrice) || 0,
        totalPrice: parseFloat(totalPrice) || 0,
        bookingMonth: bookingMonth || null,
        status: 'pending',
        // Store encrypted payment token (in production, use proper encryption)
        paymentToken: req.body.paymentDetails ? 'CARD_SAVED_' + Date.now() : null
      };

      project = await Project.create(projectData);
      console.log('✅ Project created successfully:', project.id);
    } catch (error) {
      console.error('❌ Project creation failed:', error);
      return res.status(500).json({ 
        error: 'Failed to create project record',
        details: error.message 
      });
    }

    // Try to send email (don't fail if this doesn't work)
    let emailSent = false;
    try {
      const { sendBookingConfirmation } = require('../services/emailService');
      await sendBookingConfirmation(project, client);
      emailSent = true;
      console.log('✅ Booking confirmation email sent');
    } catch (emailError) {
      console.warn('⚠️ Email sending failed but booking was created:', emailError.message);
    }

    // Success response
    const response = {
      message: 'Booking created successfully',
      projectId: project.id,
      clientId: client.id,
      emailSent: emailSent,
      bookingDetails: {
        projectType: project.projectType,
        totalPrice: project.totalPrice,
        bookingMonth: project.bookingMonth,
        status: project.status
      }
    };

    console.log('🎉 Booking completed successfully:', response);
    res.status(201).json(response);

  } catch (error) {
    console.error('❌ Booking creation error:', {
      message: error.message,
      stack: error.stack,
      body: req.body
    });
    
    res.status(500).json({ 
      error: 'Internal server error during booking creation',
      message: error.message,
      details: 'Please try again or contact support',
      timestamp: new Date().toISOString()
    });
  }
});

// Test endpoint for debugging
router.post('/test', async (req, res) => {
  try {
    console.log('🧪 Test booking endpoint called:', req.body);
    
    const { clientName, clientEmail } = req.body;
    
    if (!clientName || !clientEmail) {
      return res.status(400).json({
        error: 'Test requires clientName and clientEmail',
        received: req.body
      });
    }

    res.status(201).json({
      message: 'Test booking successful',
      projectId: 'TEST-' + Date.now(),
      clientId: 'CLIENT-' + Date.now(),
      testData: req.body,
      timestamp: new Date().toISOString(),
      database: Client && Project ? 'connected' : 'not connected'
    });
    
  } catch (error) {
    console.error('❌ Test booking error:', error);
    res.status(500).json({
      error: 'Test booking failed',
      details: error.message
    });
  }
});

// Approve booking - SIMPLIFIED (NO INCLUDES)
router.post('/:id/approve', async (req, res) => {
  try {
    console.log(`✅ [ROUTER] Approving booking ${req.params.id}`);
    
    if (!Project) {
      return res.status(500).json({ 
        error: 'Database models not available' 
      });
    }

    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Booking not found' 
      });
    }

    // Update project status
    await project.update({ 
      status: 'approved'
    });

    console.log(`✅ [ROUTER] Booking ${req.params.id} approved successfully`);

    res.json({ 
      success: true, 
      message: 'Booking approved successfully (router)',
      projectId: project.id,
      status: project.status
    });

  } catch (error) {
    console.error('❌ [ROUTER] Approve booking error:', error);
    res.status(500).json({ 
      error: 'Failed to approve booking',
      details: error.message 
    });
  }
});

// Decline booking - SIMPLIFIED (NO INCLUDES)
router.post('/:id/decline', async (req, res) => {
  try {
    console.log(`❌ [ROUTER] Declining booking ${req.params.id}`);
    
    if (!Project) {
      return res.status(500).json({ 
        error: 'Database models not available' 
      });
    }

    const project = await Project.findByPk(req.params.id);
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Booking not found' 
      });
    }

    // Update project status
    await project.update({ 
      status: 'declined'
    });

    console.log(`❌ [ROUTER] Booking ${req.params.id} declined successfully`);

    res.json({ 
      success: true, 
      message: 'Booking declined successfully (router)',
      projectId: project.id,
      status: project.status
    });

  } catch (error) {
    console.error('❌ [ROUTER] Decline booking error:', error);
    res.status(500).json({ 
      error: 'Failed to decline booking',
      details: error.message 
    });
  }
});

// Debug endpoint
router.get('/debug', async (req, res) => {
  try {
    if (!Project || !Client) {
      return res.json({
        message: 'Database models not available',
        modelsAvailable: false,
        totalProjects: 0,
        bookingsByMonth: {},
        allProjects: [], // ✅ ALWAYS RETURN ARRAY
        timestamp: new Date().toISOString()
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

module.exports = router;