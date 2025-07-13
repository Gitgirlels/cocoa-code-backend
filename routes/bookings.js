const express = require('express');
const router = express.Router();
const Client = require('../models/Client');  // You'll create this next
const Project = require('../models/Project'); // You'll create this next


// 📅 Check availability for a month
router.get('/availability/:month', async (req, res) => {
  try {
    const { month } = req.params;

    const bookingCount = await Project.count({
      where: { bookingMonth: month }
    });

    const isAvailable = bookingCount < 4;
    res.json({ available: isAvailable, currentBookings: bookingCount });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 📝 Create a booking
router.post('/', async (req, res) => {
  try {
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

    // Check month availability
    const bookingCount = await Project.count({ where: { bookingMonth } });
    if (bookingCount >= 4) {
      return res.status(400).json({ error: 'Month is fully booked' });
    }

    // Create/find client
    const [client] = await Client.findOrCreate({
      where: { email: clientEmail },
      defaults: { name: clientName, email: clientEmail }
    });

    // Create project
    const project = await Project.create({
      clientId: client.id,
      projectType,
      specifications: projectSpecs,
      websiteType,
      primaryColor,
      secondaryColor,
      accentColor,
      basePrice,
      totalPrice,
      bookingMonth
    });


    res.status(201).json({
      message: 'Booking created successfully',
      projectId: project.id
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
