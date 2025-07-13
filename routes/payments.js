const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Payment = require('../models/Payment');
const Project = require('../models/Project');

// Create payment intent
router.post('/create-intent', async (req, res) => {
    try {
        const { amount, projectId, paymentMethod } = req.body;

        if (paymentMethod === 'stripe') {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount * 100, // Convert to cents
                currency: 'aud',
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            res.json({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id
            });
        } else {
            // Handle PayPal/Afterpay integration here
            res.json({ message: 'Payment method not implemented yet' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Confirm payment
router.post('/confirm', async (req, res) => {
    try {
        const { projectId, paymentIntentId, paymentMethod } = req.body;

        // Create payment record
        const payment = await Payment.create({
            projectId,
            amount: req.body.amount,
            paymentMethod,
            paymentStatus: 'completed',
            stripePaymentId: paymentIntentId
        });

        // Update project status
        await Project.update(
            { status: 'in_progress' },
            { where: { id: projectId } }
        );

        res.json({ message: 'Payment confirmed successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
