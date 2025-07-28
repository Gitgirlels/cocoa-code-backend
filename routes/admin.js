const express = require('express');
const router = express.Router();
const { Client, Project, Payment } = require('../models');

// Admin dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const totalClients = await Client.count();
    const totalProjects = await Project.count();
    const totalPayments = await Payment.count();
    
    const recentProjects = await Project.findAll({
      include: [{ model: Client, as: 'client' }],
      order: [['createdAt', 'DESC']],
      limit: 10
    });
    
    res.json({
      stats: {
        totalClients,
        totalProjects,
        totalPayments
      },
      recentProjects
    });
  } catch (error) {
    console.error('❌ Admin stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Test endpoint
router.get('/test', (req, res) => {
  res.json({
    message: 'Admin routes working!',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;