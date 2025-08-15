const nodemailer = require('nodemailer');

// Create a correctly configured Gmail transporter
const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: Number(process.env.EMAIL_PORT || 465), // 465 = SSL
    secure: String(process.env.EMAIL_SECURE || 'true') === 'true',
    auth: {
      user: process.env.EMAIL_USER, // e.g. cocoacodeco@gmail.com
      pass: process.env.EMAIL_PASS  // 16-char Gmail App Password
    }
  });

// ✅ Run once at boot to check creds/connectivity
(async () => {
  try {
    const t = createTransporter();
    await t.verify();
    console.log('✅ SMTP ready to send');
  } catch (e) {
    console.error('❌ SMTP verify failed:', e.message);
  }
})();


// Helper function to build receipt table from items
const buildReceiptTable = (items, totalPrice) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return `<tr><td colspan="2" style="padding: 8px;">No order details available</td></tr>`;
  }

  const rows = items.map(item => `
    <tr>
      <td style="padding: 8px; border: 1px solid #ddd;">${item.name || 'Service'}</td>
      <td style="padding: 8px; border: 1px solid #ddd;">$${item.price || 0} AUD</td>
    </tr>
  `).join('');

  return `
    ${rows}
    <tr style="font-weight: bold; background: #f8f9fa;">
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>Total</strong></td>
      <td style="padding: 8px; border: 1px solid #ddd;"><strong>$${totalPrice} AUD</strong></td>
    </tr>
  `;
};

// Helper function to get project specs safely
const getProjectSpecs = (project) => {
  return project.projectSpecs || project.specifications || 'No project specifications provided';
};

// ✅ BOOKING CONFIRMATION EMAIL (when booking is first submitted)
const sendBookingConfirmation = async (project, client) => {
  try {
    const transporter = createTransporter();
    const projectSpecs = getProjectSpecs(project);
    
    const mailOptions = {
      from: `Cocoa Code <${process.env.EMAIL_USER}>`,
      to: client.email,
      subject: '📝 Cocoa Code - Booking Request Received',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px; border: 2px solid #8B4513;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #8B4513; margin: 0;">🍫 Cocoa Code</h1>
            <p style="color: #654321; margin: 5px 0;">cocoacode.dev</p>
          </div>
          
          <h2 style="color: #8B4513;">Thank you, ${client.name}!</h2>
          <p>We've received your project booking request and are currently reviewing it.</p>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">📋 Your Booking Details</h3>
            <p><strong>Project ID:</strong> ${project.id}</p>
            <p><strong>Project Type:</strong> ${project.projectType || 'Custom'}</p>
            <p><strong>Total Price:</strong> $${project.totalPrice || 0} AUD</p>
            <p><strong>Booking Month:</strong> ${project.bookingMonth || 'To be determined'}</p>
            <p><strong>Status:</strong> Pending Review</p>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #8B4513;">
            <h4 style="color: #654321; margin-top: 0;">Project Specifications:</h4>
            <p style="font-style: italic;">${projectSpecs}</p>
          </div>
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #155724; margin-top: 0;">🔍 What happens next?</h3>
            <ul style="color: #155724; margin: 0; padding-left: 20px;">
              <li>We'll review your project request within 24 hours</li>
              <li>You'll receive an approval/decline notification via email</li>
              <li>If approved, your payment will be processed automatically</li>
              <li>Work begins immediately after payment confirmation</li>
              <li>Expected completion: 1-2 weeks from project start</li>
            </ul>
          </div>
          
          <p><strong>💳 Payment Status:</strong> Your card details are saved securely. No payment will be processed until we approve your booking.</p>
          
          <hr style="border: 1px solid #D2B48C; margin: 30px 0;">
          <p style="color: #654321; font-size: 14px; text-align: center;">
            Questions? Reply to this email or contact us at <a href="mailto:hello@cocoacode.dev" style="color: #8B4513;">hello@cocoacode.dev</a><br>
            <strong>Cocoa Code</strong> • Professional Web Development • cocoacode.dev
          </p>
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

// ✅ APPROVAL EMAIL (when admin approves the booking)
const sendApprovalEmail = async (project, client) => {
  try {
    const transporter = createTransporter();
    const projectSpecs = getProjectSpecs(project);
    
    // Build receipt table if items are available
    const receiptRows = project.items ? buildReceiptTable(project.items, project.totalPrice) : `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${project.projectType || 'Custom Project'}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">$${project.totalPrice || 0} AUD</td>
      </tr>
    `;

    const mailOptions = {
      from: `Cocoa Code <${process.env.EMAIL_USER}>`,
      to: client.email,
      subject: '✅ Cocoa Code - Your Project Has Been Approved!',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px; border: 2px solid #8B4513;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #8B4513; margin: 0;">🍫 Cocoa Code</h1>
            <p style="color: #654321; margin: 5px 0;">cocoacode.dev</p>
          </div>
          
          <h2 style="color: #28a745;">🎉 Great news, ${client.name}!</h2>
          <p>Your project booking has been <strong style="color: #28a745;">APPROVED</strong>! We're excited to work with you.</p>
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #155724; margin-top: 0;">💳 Payment Processing</h3>
            <p style="color: #155724; margin: 0;">Your payment is now being processed using the card details you provided. You'll receive a separate payment confirmation email shortly.</p>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #dee2e6;">
            <h3 style="color: #8B4513; margin-top: 0;">📋 Project Summary</h3>
            <p><strong>Project ID:</strong> ${project.id}</p>
            <p><strong>Project Type:</strong> ${project.projectType || 'Custom'}</p>
            <p><strong>Booking Month:</strong> ${project.bookingMonth || 'As soon as possible'}</p>
            <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">APPROVED</span></p>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #8B4513;">
            <h4 style="color: #654321; margin-top: 0;">Your Project Specifications:</h4>
            <p style="font-style: italic;">${projectSpecs}</p>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #8B4513; margin-top: 0;">💰 Order Details</h3>
            <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
              <thead>
                <tr style="background: #8B4513; color: white;">
                  <th style="text-align: left; padding: 8px; border: 1px solid #654321;">Service</th>
                  <th style="text-align: left; padding: 8px; border: 1px solid #654321;">Price</th>
                </tr>
              </thead>
              <tbody>
                ${receiptRows}
              </tbody>
            </table>
          </div>
          
          <div style="background: #e8f4fd; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">🚀 What happens next?</h3>
            <ul style="color: #0c5460; margin: 0; padding-left: 20px;">
              <li><strong>Payment Processing:</strong> Your card will be charged within the next hour</li>
              <li><strong>Project Kickoff:</strong> Work begins immediately after payment confirmation</li>
              <li><strong>Progress Updates:</strong> You'll receive regular email updates with progress photos</li>
              <li><strong>Timeline:</strong> Expected completion within 1-2 weeks</li>
              <li><strong>Support:</strong> 4 included support sessions + unlimited bug fixes for 1 month</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <p style="color: #654321; font-size: 18px; font-weight: bold;">Thank you for choosing Cocoa Code!</p>
            <p style="color: #654321;">We can't wait to bring your vision to life! ✨</p>
          </div>
          
          <hr style="border: 1px solid #D2B48C; margin: 30px 0;">
          <p style="color: #654321; font-size: 14px; text-align: center;">
            Questions about your project? Reply to this email or contact us at <a href="mailto:hello@cocoacode.dev" style="color: #8B4513;">hello@cocoacode.dev</a><br>
            <strong>Cocoa Code</strong> • Professional Web Development • cocoacode.dev
          </p>
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

// ❌ DECLINE EMAIL (when admin declines the booking)
const sendDeclineEmail = async (client, project = null) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: `Cocoa Code <${process.env.EMAIL_USER}>`,
      to: client.email,
      subject: '❌ Cocoa Code - Project Booking Update',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #FFEEEE; padding: 20px; border-radius: 15px; border: 2px solid #dc3545;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #8B4513; margin: 0;">🍫 Cocoa Code</h1>
            <p style="color: #654321; margin: 5px 0;">cocoacode.dev</p>
          </div>
          
          <h2 style="color: #dc3545;">Hi ${client.name},</h2>
          <p>Thank you for your interest in working with Cocoa Code. After reviewing your project request, we're unable to move forward with your booking at this time.</p>
          
          ${project ? `
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <h4 style="color: #654321; margin-top: 0;">Your Request Details:</h4>
            <p><strong>Project ID:</strong> ${project.id}</p>
            <p><strong>Project Type:</strong> ${project.projectType || 'Custom'}</p>
            <p><strong>Requested Month:</strong> ${project.bookingMonth || 'Not specified'}</p>
          </div>
          ` : ''}
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #155724; margin-top: 0;">💳 Payment Information</h3>
            <p style="color: #155724; margin: 0;"><strong>No payment has been processed.</strong> Your card details have been securely removed from our system.</p>
          </div>
          
          <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #856404; margin-top: 0;">🤝 Alternative Options</h3>
            <p style="color: #856404; margin-bottom: 10px;">We'd love to work with you in the future! Consider these options:</p>
            <ul style="color: #856404; margin: 0; padding-left: 20px;">
              <li>Modify your project scope or requirements</li>
              <li>Choose a different timeline that works better</li>
              <li>Contact us to discuss alternative approaches</li>
              <li>Resubmit your booking at a later date</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0; padding: 20px; background: white; border-radius: 8px;">
            <p style="color: #654321; margin-bottom: 15px;">We appreciate your interest and hope to work with you soon!</p>
            <a href="https://cocoacode.dev" style="background: #8B4513; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Visit Our Website</a>
          </div>
          
          <hr style="border: 1px solid #D2B48C; margin: 30px 0;">
          <p style="color: #654321; font-size: 14px; text-align: center;">
            Questions or want to discuss alternatives? Reply to this email or contact us at <a href="mailto:hello@cocoacode.dev" style="color: #8B4513;">hello@cocoacode.dev</a><br>
            <strong>Cocoa Code</strong> • Professional Web Development • cocoacode.dev
          </p>
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

// 💳 PAYMENT CONFIRMATION EMAIL (when payment is successfully processed)
const sendPaymentConfirmation = async (payment, project, client) => {
  try {
    const transporter = createTransporter();
    const projectSpecs = getProjectSpecs(project);

    const mailOptions = {
      from: `Cocoa Code <${process.env.EMAIL_USER}>`,
      to: client.email,
      subject: '💳 Cocoa Code - Payment Confirmed, Project Starting!',
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px; border: 2px solid #28a745;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #8B4513; margin: 0;">🍫 Cocoa Code</h1>
            <p style="color: #654321; margin: 5px 0;">cocoacode.dev</p>
          </div>
          
          <h2 style="color: #28a745;">🎉 Payment Confirmed, ${client.name}!</h2>
          <p>Your payment has been successfully processed and your project is now starting!</p>
          
          <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #155724; margin-top: 0;">💳 Payment Details</h3>
            <p style="color: #155724;"><strong>Amount Charged:</strong> $${payment.amount || project.totalPrice} AUD</p>
            <p style="color: #155724;"><strong>Payment ID:</strong> ${payment.id}</p>
            <p style="color: #155724;"><strong>Status:</strong> Successfully Processed</p>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #dee2e6;">
            <h3 style="color: #8B4513; margin-top: 0;">🚀 Your Project is Now Live!</h3>
            <p><strong>Project ID:</strong> ${project.id}</p>
            <p><strong>Project Type:</strong> ${project.projectType || 'Custom'}</p>
            <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">IN PROGRESS</span></p>
            <p><strong>Expected Completion:</strong> 1-2 weeks</p>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #8B4513;">
            <h4 style="color: #654321; margin-top: 0;">Project Specifications:</h4>
            <p style="font-style: italic;">${projectSpecs}</p>
          </div>
          
          <div style="background: #e8f4fd; border: 1px solid #bee5eb; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <h3 style="color: #0c5460; margin-top: 0;">📅 What to expect:</h3>
            <ul style="color: #0c5460; margin: 0; padding-left: 20px;">
              <li><strong>Progress Updates:</strong> Regular emails with screenshots and progress photos</li>
              <li><strong>Your Input:</strong> We'll ask for your feedback at key milestones</li>
              <li><strong>Timeline:</strong> Most projects complete within 1-2 weeks</li>
              <li><strong>Support:</strong> 4 included support sessions during development</li>
              <li><strong>After Launch:</strong> Unlimited bug fixes for 1 month</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0; padding: 20px; background: #fff3cd; border-radius: 8px;">
            <h3 style="color: #856404; margin-top: 0;">🎨 Let's Create Something Amazing!</h3>
            <p style="color: #856404; margin: 0;">Our team is excited to bring your vision to life. You'll hear from us soon with the first progress update!</p>
          </div>
          
          <hr style="border: 1px solid #D2B48C; margin: 30px 0;">
          <p style="color: #654321; font-size: 14px; text-align: center;">
            Questions about your project? Reply to this email or contact us at <a href="mailto:hello@cocoacode.dev" style="color: #8B4513;">hello@cocoacode.dev</a><br>
            <strong>Cocoa Code</strong> • Professional Web Development • cocoacode.dev
          </p>
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

// 📧 ADMIN NOTIFICATION EMAIL (when new booking comes in)
const sendAdminNotification = async (project, client) => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || process.env.EMAIL_USER;
    const transporter = createTransporter();
    const projectSpecs = getProjectSpecs(project);

    const mailOptions = {
      from: `Cocoa Code System <${process.env.EMAIL_USER}>`,
      to: adminEmail,
      subject: `🔔 New Booking Request - ${client.name} (${project.projectType})`,
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px; border: 2px solid #ffc107;">
          <h1 style="color: #8B4513; text-align: center;">🔔 New Booking Alert</h1>
          
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #ffc107;">
            <h3 style="color: #856404; margin-top: 0;">Client Information</h3>
            <p><strong>Name:</strong> ${client.name}</p>
            <p><strong>Email:</strong> ${client.email}</p>
            <p><strong>Submission Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #8B4513;">
            <h3 style="color: #654321; margin-top: 0;">Project Details</h3>
            <p><strong>Project ID:</strong> ${project.id}</p>
            <p><strong>Type:</strong> ${project.projectType || 'Custom'}</p>
            <p><strong>Price:</strong> $${project.totalPrice || 0} AUD</p>
            <p><strong>Requested Month:</strong> ${project.bookingMonth || 'ASAP'}</p>
            <p><strong>Status:</strong> <span style="background: #fff3cd; padding: 4px 8px; border-radius: 4px;">PENDING REVIEW</span></p>
          </div>
          
          <div style="background: white; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #17a2b8;">
            <h3 style="color: #0c5460; margin-top: 0;">Project Specifications</h3>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; font-style: italic;">
              ${projectSpecs}
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://cocoacode.dev/admin" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px;">✅ Approve</a>
            <a href="https://cocoacode.dev/admin" style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px;">❌ Decline</a>
          </div>
          
          <p style="color: #654321; font-size: 14px; text-align: center; margin-top: 30px;">
            <strong>Action Required:</strong> Please review this booking in your admin panel within 24 hours.
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('🔔 Admin notification email sent');
    return true;

  } catch (error) {
    console.error('❌ Failed to send admin notification:', error);
    return false;
  }
};

module.exports = {
  sendBookingConfirmation,
  sendApprovalEmail,
  sendDeclineEmail, 
  sendPaymentConfirmation,
  sendAdminNotification
};