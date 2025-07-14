// routes/admin.js
const express = require('express');
const router = express.Router();
const { Project, Client, Payment } = require('../models');


// Get all projects
router.get('/projects', async (req, res) => {
    try {
        const projects = await Project.findAll({
            include: [Client],
            order: [['createdAt', 'DESC']]
        });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update project status
router.put('/projects/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        await Project.update({ status }, { where: { id } });
        res.json({ message: 'Status updated successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get dashboard stats
router.get('/stats', async (req, res) => {
    try {
        const totalProjects = await Project.count();
        const activeProjects = await Project.count({
            where: { status: 'in_progress' }
        });
        const totalRevenue = await Payment.sum('amount', {
            where: { paymentStatus: 'completed' }
        });
        
        res.json({
            totalProjects,
            activeProjects,
            totalRevenue: totalRevenue || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
