const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService'); // adjust path if needed


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
    projectType: projectType || 'custom',
    specifications: projectSpecs || 'No specifications provided',
    websiteType: websiteType || 'other',
    primaryColor: primaryColor || '#8B4513',
    secondaryColor: secondaryColor || '#D2B48C', 
    accentColor: accentColor || '#CD853F',
    basePrice: parseFloat(basePrice) || 0,
    totalPrice: parseFloat(totalPrice) || 0,
    bookingMonth: bookingMonth || null,
    status: 'pending',
    items: req.body.items || [],
    subscription: req.body.subscription || 'basic' // Add this line
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
      await emailService.sendBookingConfirmation({
        to: client.email,              // ✅ required
        client,                        // { name, email, ... }
        project,                       // { id, projectType, totalPrice, bookingMonth, ... }
        projectSpecs: project.specifications // or whatever field holds the specs text
      });
      
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

// ✅ FIXED APPROVE ROUTE - Enhanced error handling
router.post('/:id/approve', async (req, res) => {
  try {
    console.log(`✅ [ROUTER] Approving booking ${req.params.id}`);
    
    // Validate booking ID
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      return res.status(400).json({ 
        error: 'Invalid booking ID',
        received: req.params.id
      });
    }
    
    if (!Project) {
      return res.status(500).json({ 
        error: 'Database models not available' 
      });
    }

    // Find project with error handling
    let project;
    try {
      project = await Project.findByPk(projectId);
      console.log('📋 Project lookup:', project ? `Found ID ${project.id}` : 'Not found');
    } catch (findError) {
      console.error('❌ Database error finding project:', findError.message);
      return res.status(500).json({ 
        error: 'Database query failed',
        details: findError.message 
      });
    }
    
    if (!project) {
      return res.status(404).json({ 
        error: 'Booking not found',
        id: projectId
      });
    }

    console.log(`📋 Current status: ${project.status}, updating to approved`);

    // Update project status with multiple methods
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
          const { sequelize } = require('../models');
          await sequelize.query(
            'UPDATE projects SET status = :status WHERE id = :id',
            {
              replacements: { status: 'approved', id: projectId },
              type: sequelize.QueryTypes.UPDATE
            }
          );
          
          finalStatus = 'approved';
          updateSuccess = true;
          console.log('✅ Method 3 (raw SQL) succeeded');
        } catch (updateError3) {
          console.error('❌ All update methods failed:', updateError3.message);
        }
      }
    }

    if (!updateSuccess) {
      return res.status(500).json({ 
        error: 'Failed to update booking status',
        details: 'All update methods failed'
      });
    }

    console.log(`✅ [ROUTER] Booking ${projectId} approved successfully`);

    // Try to send approval email (optional)
    try {
      if (Client) {
        const client = await Client.findByPk(project.clientId);
        if (client) {
          const { sendApprovalEmail } = require('../services/emailService');
          await emailService.sendApprovalEmail({
            to: client.email,
            client,
            project
          });
          
          console.log('✅ Approval email sent');
        }
      }
    } catch (emailError) {
      console.warn('⚠️ Approval email failed:', emailError.message);
    }

    res.json({ 
      success: true, 
      message: 'Booking approved successfully (router)',
      projectId: project.id,
      status: finalStatus
    });

  } catch (error) {
    console.error('❌ [ROUTER] Approve booking error:', error);
    res.status(500).json({ 
      error: 'Failed to approve booking',
      details: error.message 
    });
  }
});

// ✅ FIXED DECLINE ROUTE - Enhanced error handling
router.post('/:id/decline', async (req, res) => {
  try {
    console.log(`❌ [ROUTER] Declining booking ${req.params.id}`);

    // Validate booking ID
    const projectId = parseInt(req.params.id, 10);
    if (isNaN(projectId) || projectId <= 0) {
      console.error('❌ Invalid booking ID:', req.params.id);
      return res.status(400).json({ 
        error: 'Invalid booking ID', 
        received: req.params.id 
      });
    }

    // Ensure models exist
    if (!Project) {
      console.error('❌ Project model not available');
      return res.status(500).json({ 
        error: 'Database models not available' 
      });
    }

    // Find project without includes (avoid association issues)
    let project;
    try {
      project = await Project.findByPk(projectId);
      console.log('📋 Project lookup:', project ? `Found ID ${project.id}` : 'Not found');
    } catch (findErr) {
      console.error('❌ DB error on findByPk:', findErr.message);
      return res.status(500).json({ 
        error: 'Database query failed', 
        details: findErr.message 
      });
    }

    if (!project) {
      return res.status(404).json({ 
        error: 'Booking not found', 
        id: projectId 
      });
    }

    console.log(`📋 Current status: ${project.status}, updating to declined`);

    // Update status with multiple fallback methods
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
          const { sequelize } = require('../models');
          await sequelize.query(
            'UPDATE projects SET status = :status WHERE id = :id',
            {
              replacements: { status: 'declined', id: projectId },
              type: sequelize.QueryTypes.UPDATE
            }
          );
          
          finalStatus = 'declined';
          updateSuccess = true;
          console.log('✅ Method 3 (raw SQL) succeeded');
        } catch (updateError3) {
          console.error('❌ All update methods failed:', updateError3.message);
        }
      }
    }

    if (!updateSuccess) {
      return res.status(500).json({ 
        error: 'Failed to update booking status',
        details: 'All update methods failed'
      });
    }

    console.log(`✅ Booking ${projectId} status updated -> declined`);

    // Try to send decline email (non-fatal)
    try {
      if (Client && project.clientId) {
        const client = await Client.findByPk(project.clientId);
        if (client) {
          const { sendDeclineEmail } = require('../services/emailService');
          await emailService.sendDeclineEmail({
            to: client.email,
            client,
            project
          });
          
          console.log('📩 Decline email sent');
        }
      }
    } catch (emailErr) {
      console.warn('⚠️ Decline email failed (non-fatal):', emailErr.message);
    }

    // Success response
    return res.json({
      success: true,
      message: 'Booking declined successfully (router)',
      projectId: project.id,
      status: finalStatus
    });

  } catch (err) {
    console.error('❌ [ROUTER] Decline booking unexpected error:', err);
    return res.status(500).json({ 
      error: 'Unexpected error during decline', 
      details: err.message 
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
      projectSpecs: p.specifications,
      specifications: p.specifications,
      items: p.items || [],
      primaryColor: p.primaryColor,
      secondaryColor: p.secondaryColor,
      accentColor: p.accentColor,
      subscription: p.subscription, // Add this line
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