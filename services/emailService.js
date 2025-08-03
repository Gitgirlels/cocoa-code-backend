const nodemailer = require('nodemailer');

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

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

// ✅ Approval email
const sendApprovalEmail = async (booking, client) => {
  try {
    const transporter = createTransporter();
    const receiptRows = buildReceiptTable(booking.items, booking.totalPrice);

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: client.email,
      subject: '✅ Cocoa Code - Your Booking Has Been Approved',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px;">
          <h1 style="color: #8B4513;">🎉 Good news, ${client.name}!</h1>
          <p>Your project booking has been <strong>approved</strong>. We’re now processing your payment and will begin work shortly.</p>
          
          <h2 style="margin-top: 20px;">📋 Order Details</h2>
          <table style="width: 100%; border-collapse: collapse;">
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
          <p><strong>Project Specs:</strong> ${booking.projectSpecs}</p>
          
          <p style="margin-top: 20px;">You'll receive another email once the project starts.</p>
          <p style="color: #654321;">– Cocoa Code Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Approval email sent to:', client.email);
    return true;

  } catch (error) {
    console.error('❌ Failed to send approval email:', error);
    return false;
  }
};

// ❌ Decline email
const sendDeclineEmail = async (client) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: client.email,
      subject: '⚠️ Cocoa Code - Your Booking Request Was Declined',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #FFEEEE; padding: 20px; border-radius: 15px;">
          <h2 style="color: #B22222;">Hi ${client.name},</h2>
          <p>We’ve reviewed your request but unfortunately, we were unable to accept your project at this time.</p>
          <p><strong>No payment has been taken</strong> from your card.</p>
          <p>You’re welcome to reply to this email if you'd like to discuss alternative options or modify your request.</p>
          <p style="margin-top: 20px; color: #B22222;">– Cocoa Code Team</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('📩 Decline email sent to:', client.email);
    return true;

  } catch (error) {
    console.error('❌ Failed to send decline email:', error);
    return false;
  }
};

module.exports = {
  sendApprovalEmail,
  sendDeclineEmail
};
