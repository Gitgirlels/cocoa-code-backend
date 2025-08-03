// services/emailService.js - Fixed version
const nodemailer = require('nodemailer');

// ✅ Correct transporter function
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail', // or your preferred email service
    auth: {
      user: process.env.EMAIL_USER, // your email address
      pass: process.env.EMAIL_PASS  // your Gmail app password
    }
  });
};

// ✅ Send booking confirmation email
const sendBookingConfirmation = async (booking, client) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: client.email,
      cc: process.env.EMAIL_USER, 
      subject: '🎉 Your Cocoa Code Project is Confirmed!',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #654321; font-size: 2.5rem;">🍫 Cocoa Code</h1>
            <p style="color: #8B4513; font-size: 1.2rem;">Where great websites are crafted with sweetness</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #8B4513; margin-bottom: 20px;">
            <h2 style="color: #654321; margin-bottom: 15px;">🎉 Booking Confirmed!</h2>
            <p>Hi ${client.name},</p>
            <p>Thank you for choosing Cocoa Code! Your project has been confirmed and we're excited to start working with you.</p>
            
            <div style="background: #D2B48C; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #654321; margin-top: 0;">📋 Project Details</h3>
              <p><strong>Project ID:</strong> ${booking.id}</p>
              <p><strong>Service:</strong> ${booking.projectType}</p>
              <p><strong>Total Amount:</strong> $${booking.totalPrice} AUD</p>
              <p><strong>Booking Month:</strong> ${booking.bookingMonth}</p>
              <p><strong>Status:</strong> ${booking.status}</p>
            </div>
            
            <h3 style="color: #654321;">🚀 What Happens Next?</h3>
            <ul style="color: #654321;">
              <li>We'll start working on your project within 1-2 business days</li>
              <li>You'll receive progress updates via email throughout development</li>
              <li>Expected completion: 1-2 weeks from project start</li>
              <li>You'll get 4 support sessions included with your package</li>
            </ul>
            
            <div style="background: #CD853F; color: white; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center;">
              <h4 style="margin: 0; color: white;">Need to contact us?</h4>
              <p style="margin: 5px 0; color: white;">Reply to this email or visit our website</p>
            </div>
            
            <p style="margin-top: 20px;">Thanks again for choosing Cocoa Code!</p>
            <p style="color: #8B4513;"><em>The Cocoa Code Team ☕</em></p>
          </div>
          
          <div style="text-align: center; color: #8B4513; font-size: 0.9rem;">
            <p>&copy; 2025 Cocoa Code. All rights reserved.</p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Booking confirmation email sent to:', client.email);
    return true;

  } catch (error) {
    console.error('❌ Failed to send booking confirmation email:', error);
    return false;
  }
};

// ✅ Send payment confirmation email
const sendPaymentConfirmation = async (payment, project, client) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: client.email,
      subject: '💳 Payment Confirmed - Cocoa Code',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #654321; font-size: 2.5rem;">🍫 Cocoa Code</h1>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #8B4513;">
            <h2 style="color: #654321; margin-bottom: 15px;">💳 Payment Confirmed!</h2>
            <p>Hi ${client.name},</p>
            <p>Your payment has been successfully processed. Your project is now officially underway!</p>
            
            <div style="background: #D2B48C; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #654321; margin-top: 0;">💰 Payment Details</h3>
              <p><strong>Amount:</strong> $${payment.amount} AUD</p>
              <p><strong>Payment ID:</strong> ${payment.id}</p>
              <p><strong>Project ID:</strong> ${project.id}</p>
              <p><strong>Status:</strong> ${payment.paymentStatus}</p>
            </div>
            
            <p>We'll begin work on your ${project.projectType} project immediately and keep you updated on our progress.</p>
            <p>Thank you for your business!</p>
            <p style="color: #8B4513;"><em>The Cocoa Code Team ☕</em></p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Payment confirmation email sent to:', client.email);
    return true;

  } catch (error) {
    console.error('❌ Failed to send payment confirmation email:', error);
    return false;
  }
};

module.exports = {
  sendBookingConfirmation,
  sendPaymentConfirmation
};
