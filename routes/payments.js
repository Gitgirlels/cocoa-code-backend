const express = require('express');
const router = express.Router();
const { Payment, Project, Client } = require('../models');

// Initialize Stripe with your secret key
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// Create payment intent for Stripe
router.post('/create-intent', async (req, res) => {
  try {
    console.log('💳 Creating payment intent:', req.body);
    
    const { amount, projectId, paymentMethod = 'card', currency = 'aud' } = req.body;

    // Validate required fields
    if (!amount || !projectId) {
      return res.status(400).json({ 
        error: 'Missing required fields: amount and projectId' 
      });
    }

    // Validate amount (must be at least 50 cents in AUD)
    if (amount < 0.50) {
      return res.status(400).json({ 
        error: 'Amount must be at least $0.50 AUD' 
      });
    }

    // Get project details for payment description
    const project = await Project.findByPk(projectId, {
      include: [{ model: Client, as: 'client' }]
    });

    if (!project) {
      return res.status(404).json({ 
        error: 'Project not found' 
      });
    }

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
      metadata: {
        projectId: projectId.toString(),
        clientEmail: project.client?.email || 'unknown',
        projectType: project.projectType || 'unknown',
        environment: process.env.NODE_ENV || 'development'
      },
      description: `Cocoa Code - ${project.projectType} project for ${project.client?.name || 'Client'}`,
      receipt_email: project.client?.email,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    // Store payment record in database
    const payment = await Payment.create({
      projectId,
      amount,
      paymentMethod: 'stripe',
      paymentStatus: 'pending',
      stripePaymentId: paymentIntent.id,
      transactionReference: paymentIntent.client_secret
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      paymentId: payment.id,
      message: 'Payment intent created successfully'
    });

  } catch (error) {
    console.error('❌ Payment intent creation error:', error);
    
    // Handle specific Stripe errors
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ 
        error: 'Card was declined',
        details: error.message 
      });
    } else if (error.type === 'StripeRateLimitError') {
      return res.status(429).json({ 
        error: 'Too many requests made to the API too quickly' 
      });
    } else if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ 
        error: 'Invalid parameters were supplied to Stripe\'s API',
        details: error.message 
      });
    } else if (error.type === 'StripeAPIError') {
      return res.status(500).json({ 
        error: 'An error occurred internally with Stripe\'s API' 
      });
    } else if (error.type === 'StripeConnectionError') {
      return res.status(500).json({ 
        error: 'Some kind of error occurred during the HTTPS communication' 
      });
    } else if (error.type === 'StripeAuthenticationError') {
      return res.status(401).json({ 
        error: 'You probably used an incorrect API key' 
      });
    }

    res.status(500).json({ 
      error: 'Payment processing failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Confirm payment and update records
router.post('/confirm', async (req, res) => {
  try {
    console.log('✅ Confirming payment:', req.body);
    
    const { paymentIntentId, projectId } = req.body;

    if (!paymentIntentId) {
      return res.status(400).json({ 
        error: 'Payment intent ID is required' 
      });
    }

    // Retrieve payment intent from Stripe to verify status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    console.log('💰 Payment intent status:', paymentIntent.status);

    // Update payment record in database
    const payment = await Payment.findOne({
      where: { stripePaymentId: paymentIntentId }
    });

    if (!payment) {
      return res.status(404).json({ 
        error: 'Payment record not found' 
      });
    }

    // Update payment status based on Stripe response
    let paymentStatus = 'pending';
    let projectStatus = 'pending';

    switch (paymentIntent.status) {
      case 'succeeded':
        paymentStatus = 'completed';
        projectStatus = 'in_progress';
        break;
      case 'processing':
        paymentStatus = 'pending';
        projectStatus = 'pending';
        break;
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        paymentStatus = 'pending';
        projectStatus = 'pending';
        break;
      case 'canceled':
        paymentStatus = 'failed';
        projectStatus = 'cancelled';
        break;
      default:
        paymentStatus = 'failed';
        projectStatus = 'pending';
    }

    // Update payment record
    await payment.update({
      paymentStatus,
      transactionReference: paymentIntent.id
    });

    // Update project status if payment succeeded
    if (projectId && paymentStatus === 'completed') {
      await Project.update(
        { status: projectStatus },
        { where: { id: projectId } }
      );
    }

    console.log(`✅ Payment ${paymentIntentId} confirmed with status: ${paymentStatus}`);

    res.json({ 
      message: 'Payment confirmation processed',
      paymentId: payment.id,
      paymentStatus,
      projectStatus,
      stripeStatus: paymentIntent.status
    });

  } catch (error) {
    console.error('❌ Payment confirmation error:', error);
    res.status(500).json({ 
      error: 'Payment confirmation failed',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Handle Stripe webhooks (for production use)
router.post('/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature (you'll need to set STRIPE_WEBHOOK_SECRET in your env)
    if (process.env.STRIPE_WEBHOOK_SECRET) {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } else {
      console.warn('⚠️ No webhook secret configured, skipping signature verification');
      event = JSON.parse(req.body);
    }
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object;
        console.log('🎉 Payment succeeded via webhook:', paymentIntent.id);
        
        // Update payment status in database
        await Payment.update(
          { paymentStatus: 'completed' },
          { where: { stripePaymentId: paymentIntent.id } }
        );
        
        // Update project status
        if (paymentIntent.metadata.projectId) {
          await Project.update(
            { status: 'in_progress' },
            { where: { id: paymentIntent.metadata.projectId } }
          );
        }
        break;
        
      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object;
        console.log('❌ Payment failed via webhook:', failedPayment.id);
        
        await Payment.update(
          { paymentStatus: 'failed' },
          { where: { stripePaymentId: failedPayment.id } }
        );
        break;
        
      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  res.json({received: true});
});

// Get payment status
router.get('/status/:paymentId', async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    const payment = await Payment.findByPk(paymentId, {
      include: [{ 
        model: Project, 
        as: 'project',
        include: [{ model: Client, as: 'client' }]
      }]
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    // Also check Stripe status if we have a payment intent ID
    let stripeStatus = null;
    if (payment.stripePaymentId) {
      try {
        const paymentIntent = await stripe.paymentIntents.retrieve(payment.stripePaymentId);
        stripeStatus = paymentIntent.status;
      } catch (error) {
        console.warn('Could not retrieve Stripe payment status:', error.message);
      }
    }

    res.json({
      paymentId: payment.id,
      amount: payment.amount,
      status: payment.paymentStatus,
      stripeStatus,
      projectId: payment.projectId,
      createdAt: payment.createdAt,
      project: payment.project ? {
        id: payment.project.id,
        type: payment.project.projectType,
        status: payment.project.status,
        client: payment.project.client?.name
      } : null
    });

  } catch (error) {
    console.error('❌ Get payment status error:', error);
    res.status(500).json({ 
      error: 'Failed to retrieve payment status',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Add this to your routes/payments.js file:
router.get('/test-stripe', async (req, res) => {
  try {
    // Check if Stripe is properly configured
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({
        error: 'Stripe not configured',
        message: 'STRIPE_SECRET_KEY environment variable is missing'
      });
    }

    // Test Stripe connection by creating a test product
    const testProduct = await stripe.products.create({
      name: 'Test Connection',
      type: 'service',
      metadata: { test: 'true' }
    });

    // Immediately delete the test product
    await stripe.products.del(testProduct.id);

    res.json({
      message: '✅ Stripe connection successful',
      environment: process.env.NODE_ENV,
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET
    });

  } catch (error) {
    console.error('❌ Stripe connection test failed:', error);
    res.status(500).json({
      error: '❌ Stripe connection failed',
      details: error.message,
      suggestion: 'Check your STRIPE_SECRET_KEY environment variable'
    });
  }
});

module.exports = router;