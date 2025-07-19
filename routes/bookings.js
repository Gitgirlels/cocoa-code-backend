
const express = require('express');
const router = express.Router();
const { Project, Client } = require('../models');

// 📅 Check availability for a month
router.get('/availability/:month', async (req, res) => {
  try {
    const { month } = req.params;
    const decodedMonth = decodeURIComponent(month);

    console.log('📅 Availability check requested for month:', decodedMonth);
    
    // Get all bookings to see what's in the database
    const allBookings = await Project.findAll({ 
      attributes: ['id', 'bookingMonth', 'status'],
      raw: true 
    });
    
    console.log('📊 All bookings in database:', allBookings);

    // Count bookings for the specific month
    const bookingCount = await Project.count({
      where: { bookingMonth: decodedMonth }
    });

    console.log(`📈 Bookings for "${decodedMonth}": ${bookingCount}/4`);

    const isAvailable = bookingCount < 4;
    
    const response = { 
      available: isAvailable, 
      currentBookings: bookingCount,
      month: decodedMonth,
      maxBookings: 4
    };
    
    console.log('✅ Availability response:', response);
    res.json(response);

  } catch (error) {
    console.error('❌ Error checking availability:', error);
    res.status(500).json({ 
      error: error.message,
      month: req.params.month 
    });
  }
});

// 📝 Create a booking
router.post('/', async (req, res) => {
  try {
    console.log('📝 New booking request received:', req.body);
    
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
      accentColor,
      subscription,
      extraServices
    } = req.body;

    // Validate required fields
    if (!clientName || !clientEmail) {
      return res.status(400).json({ 
        error: 'Client name and email are required' 
      });
    }

    // Only check month availability if a main project service was selected
    if (projectType && projectType !== 'service-only' && bookingMonth) {
      const bookingCount = await Project.count({ where: { bookingMonth } });
      console.log(`📊 Current bookings for ${bookingMonth}: ${bookingCount}/4`);
      
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

    console.log('👤 Client:', client.id, client.name);

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

    console.log('📋 Creating project with data:', projectData);

    const project = await Project.create(projectData);

    console.log('✅ Project created successfully:', project.id);

    // Log updated booking count
    if (bookingMonth) {
      const newCount = await Project.count({ where: { bookingMonth } });
      console.log(`📈 Updated bookings for ${bookingMonth}: ${newCount}/4`);
    }

    res.status(201).json({
      message: 'Booking created successfully',
      projectId: project.id,
      clientId: client.id
    });

  } catch (error) {
    console.error('❌ Booking creation error:', error);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

// 📊 Get all bookings (for debugging)
router.get('/debug', async (req, res) => {
  try {
    const projects = await Project.findAll({
      include: [Client],
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
        client: p.Client?.name,
        status: p.status
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;