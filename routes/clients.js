const express = require('express');
const router = express.Router();
const { Client } = require('../models');

// 🔹 Get all clients
router.get('/', async (req, res) => {
  try {
    const clients = await Client.findAll({ order: [['createdAt', 'DESC']] });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Get a single client by ID
router.get('/:id', async (req, res) => {
  try {
    const client = await Client.findByPk(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    res.json(client);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 Create a new client
router.post('/', async (req, res) => {
  try {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 🔹 Update a client
router.put('/:id', async (req, res) => {
  try {
    const [updated] = await Client.update(req.body, {
      where: { id: req.params.id }
    });
    if (!updated) return res.status(404).json({ error: 'Client not found' });
    res.json({ message: 'Client updated successfully' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// 🔹 Delete a client
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Client.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ error: 'Client not found' });
    res.json({ message: 'Client deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
