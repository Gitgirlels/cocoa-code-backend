const nodemailer = require('nodemailer');

// ✅ Correct transporter
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// ✅ Helper: build receipt table from items array
const buildReceiptTable = (items, totalPrice) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return `<tr><td colspan="2" style="padding: 8px;">No order details available</td></tr>`;
  }

  const rows = items.map(item => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.name}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">$${item.price} AUD</td>
    </tr>
  `).join('');

  return `
    ${rows}
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${totalPrice} AUD</strong></td>
    </tr>
  `;
};

// ✅ Booking confirmation email
const sendBookingConfirmation = async (booking, client) => {
  try {
    const transporter = createTransporter();

    const receiptRows = buildReceiptTable(booking.items, booking.totalPrice);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: client.email,
      subject: '🎉 Cocoa Code - Your Project Booking Confirmation',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #654321;">🍫 Cocoa Code</h1>
            <p style="color: #8B4513;">Where great websites are crafted with sweetness</p>
          </div>
          
          <div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #8B4513;">
            <h2 style="color: #654321;">📋 Booking Confirmation</h2>
            <p>Hi ${client.name},</p>
            <p>Thank you for booking with Cocoa Code! Here are your order details:</p>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr>
                  <th style="text-align:left; padding:8px; border:1px solid #ddd;">Service</th>
                  <th style="text-align:left; padding:8px; border:1px solid #ddd;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${receiptRows}
              </tbody>
            </table>
            
            <p style="margin-top: 15px;"><strong>Booking Month:</strong> ${booking.bookingMonth}</p>
            <p><strong>Status:</strong> ${booking.status}</p>
            <p><strong>Project Specs:</strong> ${booking.projectSpecs}</p>
            
            <div style="margin-top: 20px; background: #CD853F; color: white; padding: 10px; border-radius: 5px; text-align: center;">
              We'll be in touch soon to finalize your project details!
            </div>
          </div>
          
          <p style="text-align: center; margin-top: 20px; color: #8B4513;">The Cocoa Code Team ☕</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Detailed booking confirmation email sent to:', client.email);
    return true;

  } catch (error) {
    console.error('❌ Failed to send booking confirmation email:', error);
    return false;
  }
};

// ✅ Payment confirmation email
const sendPaymentConfirmation = async (payment, project, client) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: client.email,
      subject: '💳 Payment Confirmation - Cocoa Code',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #654321;">🍫 Cocoa Code</h1>
          </div>
          <div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #8B4513;">
            <h2 style="color: #654321;">💳 Payment Successful!</h2>
            <p>Hi ${client.name},</p>
            <p>Your payment has been processed successfully for your ${project.projectType} project.</p>
            <p><strong>Amount Paid:</strong> $${payment.amount} AUD</p>
            <p><strong>Payment Status:</strong> ${payment.paymentStatus}</p>
            <p><strong>Project ID:</strong> ${project.id}</p>
            <p>We’ll begin work on your project immediately and keep you updated!</p>
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
