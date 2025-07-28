const express = require('express');
const router = express.Router();
const { Client, Project } = require('../models');

// Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await Client.findAll({
      include: [{ 
        model: Project, 
        as: 'projects',
        attributes: ['id', 'projectType', 'status', 'totalPrice', 'createdAt']
      }],
      order: [['createdAt', 'DESC']]
    });
    
    res.json({
      clients,
      total: clients.length
    });
  } catch (error) {
    console.error('❌ Get clients error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single client
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id, {
      include: [{ 
        model: Project, 
        as: 'projects'
      }]
    });
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    res.json(client);
  } catch (error) {
    console.error('❌ Get client error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;