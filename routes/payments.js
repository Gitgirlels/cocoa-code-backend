const express = require('express');
const router = express.Router();
const { Payment, Project } = require('../models');

// Create payment intent (simplified for demo)
router.post('/create-intent', async (req, res) => {
  try {
    const { amount, projectId, paymentMethod } = req.body;

    if (paymentMethod === 'stripe' || paymentMethod === 'credit') {
      // In production, integrate with actual Stripe API
      res.json({
        clientSecret: 'demo_client_secret_' + Date.now(),
        paymentIntentId: 'demo_payment_' + Date.now()
      });
    } else {
      res.json({ message: 'Payment method not implemented yet' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Confirm payment
router.post('/confirm', async (req, res) => {
  try {
    const { projectId, paymentIntentId, paymentMethod, amount } = req.body;

    // Create payment record
    const payment = await Payment.create({
      projectId,
      amount,
      paymentMethod,
      paymentStatus: 'completed',
      stripePaymentId: paymentIntentId
    });

    // Update project status
    await Project.update(
      { status: 'in_progress' },
      { where: { id: projectId } }
    );

    res.json({ 
      message: 'Payment confirmed successfully',
      paymentId: payment.id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
