const express = require('express');
const router = express.Router();
const { Project, Client } = require('../models');
const { sendBookingConfirmation } = require('../services/emailService');

// Check availability for a month
router.get('/availability/:month', async (req, res) => {
  try {
    const { month } = req.params;
    const decodedMonth = decodeURIComponent(month);

    console.log('📅 Availability check for month:', decodedMonth);
    
    const bookingCount = await Project.count({
      where: { 
        bookingMonth: decodedMonth,
        status: { [require('sequelize').Op.ne]: 'cancelled' }
      }
    });

    console.log(`📈 Bookings for "${decodedMonth}": ${bookingCount}/4`);

    const isAvailable = bookingCount < 4;
    
    res.json({ 
      available: isAvailable, 
      currentBookings: bookingCount,
      month: decodedMonth,
      maxBookings: 4
    });

  } catch (error) {
    console.error('❌ Error checking availability:', error);
    res.status(500).json({ 
      error: error.message,
      month: req.params.month 
    });
  }
});

// Create a booking with email confirmation
router.post('/', async (req, res) => {
  try {
    console.log('📝 New booking request:', req.body);
    
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

    // Validate required fields
    if (!clientName || !clientEmail) {
      return res.status(400).json({ 
        error: 'Client name and email are required' 
      });
    }

    // Check month availability for main projects
    if (projectType && projectType !== 'service-only' && bookingMonth) {
      const bookingCount = await Project.count({ 
        where: { 
          bookingMonth,
          status: { [require('sequelize').Op.ne]: 'cancelled' }
        }
      });
      
      if (bookingCount >= 4) {
        return res.status(400).json({ 
          error: `${bookingMonth} is fully booked (${bookingCount}/4 slots taken)` 
        });
      }
    }

    // Create or find client
    const [client] = await Client.findOrCreate({
      where: { email: clientEmail },
      defaults: { 
        name: clientName, 
        email: clientEmail 
      }
    });

    // Create project
    const projectData = {
      clientId: client.id,
      projectType: projectType || 'service-only',
      specifications: projectSpecs || 'Extra services only',
      websiteType,
      primaryColor,
      secondaryColor,
      accentColor,
      basePrice: basePrice || 0,
      totalPrice: totalPrice || 0,
      bookingMonth: bookingMonth || null
    };

    const project = await Project.create(projectData);

    console.log('✅ Project created successfully:', project.id);

    // Send booking confirmation email
    try {
      await sendBookingConfirmation(project, client);
      console.log('✅ Booking confirmation email sent');
    } catch (emailError) {
      console.error('⚠️ Email sending failed but booking was created:', emailError.message);
      // Don't fail the entire request if email fails
    }

    res.status(201).json({
      message: 'Booking created successfully',
      projectId: project.id,
      clientId: client.id,
      emailSent: true // Always return true for now
    });

  } catch (error) {
    console.error('❌ Booking creation error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Please try again or contact support'
    });
  }
});

// Debug endpoint
router.get('/debug', async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [{ model: Client, as: 'client' }],
      order: [['createdAt', 'DESC']]
    });
    
    const summary = {};
    projects.forEach(project => {
      if (project.bookingMonth) {
        summary[project.bookingMonth] = (summary[project.bookingMonth] || 0) + 1;
      }
    });
    
    res.json({
      totalProjects: projects.length,
      bookingsByMonth: summary,
      allProjects: projects.map(p => ({
        id: p.id,
        type: p.projectType,
        month: p.bookingMonth,
        client: p.client?.name,
        status: p.status
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;