// emailService.js
// ------------------------------------------------------------
// SMTP email helper for Cocoa Code (Gmail SMTP)
// - Uses only EMAIL_USER (your Gmail) + EMAIL_PASS (Gmail App Password)
// - Verifies SMTP once at boot and logs readiness
// - Keeps your exact HTML templates for: Confirmation, Approval, Decline, Payment
// - Includes sendAdminNotification (defaults to EMAIL_USER)
// ------------------------------------------------------------

require('dotenv').config();
const nodemailer = require('nodemailer');

// ---------- ENV ----------
const FROM_NAME    = process.env.FROM_NAME || 'Cocoa Code';
const EMAIL_USER   = process.env.EMAIL_USER;            // e.g. cocoacodeco@gmail.com
const EMAIL_PASS   = process.env.EMAIL_PASS;            // 16-char Gmail App Password
const EMAIL_HOST   = process.env.EMAIL_HOST || 'smtp.gmail.com';
const EMAIL_PORT   = Number(process.env.EMAIL_PORT || 465); // 465=SSL, 587=STARTTLS
const EMAIL_SECURE = String(process.env.EMAIL_SECURE ?? 'true').toLowerCase() !== 'false';

if (!EMAIL_USER || !EMAIL_PASS) {
  console.warn('⚠️  EMAIL_USER/EMAIL_PASS not set. SMTP will fail until configured.');
}

// ---------- TRANSPORTER (single, reused) ----------
const transporter = nodemailer.createTransport({
  host: EMAIL_HOST,
  port: EMAIL_PORT,
  secure: EMAIL_SECURE, // true for 465, false for 587 (uses STARTTLS)
  auth: { user: EMAIL_USER, pass: EMAIL_PASS },
  pool: true,
  maxConnections: 2,
  maxMessages: 50,
});

// Verify SMTP once at startup (skip during tests)
if (process.env.NODE_ENV !== 'test') {
  (async () => {
    try {
      await transporter.verify();
      console.log('✅ SMTP ready to send');
    } catch (e) {
      console.error('❌ SMTP verify failed:', e.message);
    }
  })();
}

// ---------- SMALL HELPERS ----------
function safe(v, fallback = '—') {
  if (v === null || v === undefined) return fallback;
  return String(v);
}
function getProjectSpecs(project = {}) {
  const s = project.projectSpecs || project.specs || project.description || project.requirements || '';
  if (Array.isArray(s)) return s.join(', ');
  return s || '—';
}
function buildReceiptRows(project = {}) {
  const items = project.items || project.services || project.orderItems;
  if (Array.isArray(items) && items.length) {
    return items.map(it => `
      <tr>
        <td style="padding:8px;border:1px solid #654321;">${safe(it.name || it.service || 'Service')}</td>
        <td style="padding:8px;border:1px solid #654321;">$${safe(it.price || it.amount || 0)} AUD</td>
      </tr>
    `).join('');
  }
  const total = project.totalPrice ?? project.total ?? '';
  return total !== '' ? `
      <tr>
        <td style="padding:8px;border:1px solid #654321;">Project Total</td>
        <td style="padding:8px;border:1px solid #654321;">$${safe(total)} AUD</td>
      </tr>
  ` : '';
}

// Low-level sender used by all helpers
async function sendEmail({ to, subject, html, text, replyTo }) {
  const mail = {
    from: `${FROM_NAME} <${EMAIL_USER}>`, // MUST match authenticated account (or approved alias)
    to,
    replyTo: replyTo || EMAIL_USER,       // safe default
    subject,
    text,
    html,
  };

  const info = await transporter.sendMail(mail);
  console.log('✉️  SMTP accepted:', info.accepted, 'rejected:', info.rejected, 'response:', info.response);
  return info;
}

// ---------------- TEMPLATED SENDERS ----------------

// ✅ Booking confirmation (your original template)
async function sendBookingConfirmation({ to, client = {}, project = {}, projectSpecs }) {
  const subject = '📝 Cocoa Code - Booking Request Received';
  const specs = projectSpecs ?? getProjectSpecs(project);

  const html = `
    <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px; border: 2px solid #8B4513;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #8B4513; margin: 0;">🍫 Cocoa Code</h1>
        <p style="color: #654321; margin: 5px 0;">cocoacode.dev</p>
      </div>
      
      <h2 style="color: #8B4513;">Thank you, ${safe(client.name, 'there')}!</h2>
      <p>We've received your project booking request and are currently reviewing it.</p>
      
      <div style="background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h3 style="color: #856404; margin-top: 0;">📋 Your Booking Details</h3>
        <p><strong>Project ID:</strong> ${safe(project.id)}</p>
        <p><strong>Project Type:</strong> ${safe(project.projectType, 'Custom')}</p>
        <p><strong>Total Price:</strong> $${safe(project.totalPrice || 0)} AUD</p>
        <p><strong>Booking Month:</strong> ${safe(project.bookingMonth, 'To be determined')}</p>
        <p><strong>Status:</strong> Pending Review</p>
      </div>
      
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #8B4513;">
        <h4 style="color: #654321; margin-top: 0;">Project Specifications:</h4>
        <p style="font-style: italic;">${specs}</p>
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
  `;

  const text = [
    `Cocoa Code – Booking request received`,
    `Name: ${safe(client.name)}`,
    `Project ID: ${safe(project.id)}`,
    `Project Type: ${safe(project.projectType, 'Custom')}`,
    `Total Price: $${safe(project.totalPrice || 0)} AUD`,
    `Booking Month: ${safe(project.bookingMonth, 'To be determined')}`,
    `Status: Pending Review`,
    `Project Specifications: ${specs}`,
  ].join('\n');

  return sendEmail({ to, subject, html, text });
}

// ✅ Approval email (your rich HTML with receipt table)
async function sendApprovalEmail({ to, client = {}, project = {}, projectSpecs, receiptRows }) {
  const subject = '✅ Cocoa Code - Project Booking Approved!';
  const specs = projectSpecs ?? getProjectSpecs(project);
  const rows  = receiptRows ?? buildReceiptRows(project);

  const html = `
    <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px; border: 2px solid #8B4513;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #8B4513; margin: 0;">🍫 Cocoa Code</h1>
        <p style="color: #654321; margin: 5px 0;">cocoacode.dev</p>
      </div>
      
      <h2 style="color: #28a745;">🎉 Great news, ${safe(client.name)}!</h2>
      <p>Your project booking has been <strong style="color: #28a745;">APPROVED</strong>! We're excited to work with you.</p>
      
      <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h3 style="color: #155724; margin-top: 0;">💳 Payment Processing</h3>
        <p style="color: #155724; margin: 0;">Your payment is now being processed using the card details you provided. You'll receive a separate payment confirmation email shortly.</p>
      </div>
      
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #dee2e6;">
        <h3 style="color: #8B4513; margin-top: 0;">📋 Project Summary</h3>
        <p><strong>Project ID:</strong> ${safe(project.id)}</p>
        <p><strong>Project Type:</strong> ${safe(project.projectType, 'Custom')}</p>
        <p><strong>Booking Month:</strong> ${safe(project.bookingMonth, 'As soon as possible')}</p>
        <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">APPROVED</span></p>
      </div>
      
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #8B4513;">
        <h4 style="color: #654321; margin-top: 0;">Your Project Specifications:</h4>
        <p style="font-style: italic;">${specs}</p>
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
            ${rows}
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
  `;

  const text = [
    `Cocoa Code – Booking APPROVED`,
    `Name: ${safe(client.name)}`,
    `Project ID: ${safe(project.id)}`,
    `Project Type: ${safe(project.projectType, 'Custom')}`,
    `Booking Month: ${safe(project.bookingMonth, 'ASAP')}`,
    `Status: APPROVED`,
    `Specs: ${specs}`,
  ].join('\n');

  return sendEmail({ to, subject, html, text });
}

// ❌ Decline email (your rich HTML)
async function sendDeclineEmail({ to, client = {}, project = {} }) {
  const subject = '❌ Cocoa Code - Project Booking Update';

  const html = `
    <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #FFEEEE; padding: 20px; border-radius: 15px; border: 2px solid #dc3545;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #8B4513; margin: 0;">🍫 Cocoa Code</h1>
        <p style="color: #654321; margin: 5px 0;">cocoacode.dev</p>
      </div>
      
      <h2 style="color: #dc3545;">Hi ${safe(client.name)},</h2>
      <p>Thank you for your interest in working with Cocoa Code. After reviewing your project request, we're unable to move forward with your booking at this time.</p>
      
      ${project && (project.id || project.projectType || project.bookingMonth) ? `
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc3545;">
        <h4 style="color: #654321; margin-top: 0;">Your Request Details:</h4>
        <p><strong>Project ID:</strong> ${safe(project.id)}</p>
        <p><strong>Project Type:</strong> ${safe(project.projectType, 'Custom')}</p>
        <p><strong>Requested Month:</strong> ${safe(project.bookingMonth, 'Not specified')}</p>
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
  `;

  const text = [
    `Cocoa Code – Booking cannot be accepted`,
    `Name: ${safe(client.name)}`,
    project ? `Project ID: ${safe(project.id)}` : '',
    project ? `Type: ${safe(project.projectType, 'Custom')}` : '',
    project ? `Requested Month: ${safe(project.bookingMonth, 'Not specified')}` : '',
    `No payment has been processed.`,
  ].filter(Boolean).join('\n');

  return sendEmail({ to, subject, html, text });
}

// 💳 Payment confirmation email (your rich HTML)
async function sendPaymentConfirmation({ to, payment = {}, project = {}, client = {} }) {
  const subject = '💳 Cocoa Code - Payment Confirmed, Project Starting!';
  const specs = getProjectSpecs(project);

  const html = `
    <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #F5F5DC; padding: 20px; border-radius: 15px; border: 2px solid #28a745;">
      <div style="text-align: center; margin-bottom: 20px;">
        <h1 style="color: #8B4513; margin: 0;">🍫 Cocoa Code</h1>
        <p style="color: #654321; margin: 5px 0;">cocoacode.dev</p>
      </div>
      
      <h2 style="color: #28a745;">🎉 Payment Confirmed, ${safe(client.name)}!</h2>
      <p>Your payment has been successfully processed and your project is now starting!</p>
      
      <div style="background: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 15px; margin: 20px 0;">
        <h3 style="color: #155724; margin-top: 0;">💳 Payment Details</h3>
        <p style="color: #155724;"><strong>Amount Charged:</strong> $${safe(payment.amount ?? project.totalPrice ?? 0)} AUD</p>
        <p style="color: #155724;"><strong>Payment ID:</strong> ${safe(payment.id)}</p>
        <p style="color: #155724;"><strong>Status:</strong> Successfully Processed</p>
      </div>
      
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border: 1px solid #dee2e6;">
        <h3 style="color: #8B4513; margin-top: 0;">🚀 Your Project is Now Live!</h3>
        <p><strong>Project ID:</strong> ${safe(project.id)}</p>
        <p><strong>Project Type:</strong> ${safe(project.projectType, 'Custom')}</p>
        <p><strong>Status:</strong> <span style="color: #28a745; font-weight: bold;">IN PROGRESS</span></p>
        <p><strong>Expected Completion:</strong> 1-2 weeks</p>
      </div>
      
      <div style="background: white; border-radius: 8px; padding: 15px; margin: 20px 0; border-left: 4px solid #8B4513;">
        <h4 style="color: #654321; margin-top: 0;">Project Specifications:</h4>
        <p style="font-style: italic;">${specs}</p>
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
  `;

  const text = [
    `Cocoa Code – Payment confirmed`,
    `Name: ${safe(client.name)}`,
    `Project ID: ${safe(project.id)}`,
    `Amount: $${safe(payment.amount ?? project.totalPrice ?? 0)} AUD`,
    `Status: IN PROGRESS`,
  ].join('\n');

  return sendEmail({ to, subject, html, text });
}

// 📧 Admin notification (defaults to EMAIL_USER; pass {to} to override)
async function sendAdminNotification({ subject, html, text, to }) {
  return sendEmail({ to: to || EMAIL_USER, subject, html, text });
}

// ---------- EXPORTS ----------
module.exports = {
  sendEmail,
  sendBookingConfirmation,
  sendApprovalEmail,
  sendDeclineEmail,
  sendPaymentConfirmation,
  sendAdminNotification,
};
