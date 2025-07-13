const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email provider (e.g., 'hotmail', 'outlook')
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const sendBookingConfirmation = async (clientEmail, clientName, project) => {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: clientEmail,
    subject: '🎉 Your Cocoa Code Project is Confirmed!',
    html: `
      <h2>Hi ${clientName}!</h2>
      <p>Thank you for choosing Cocoa Code for your <strong>${project.projectType}</strong> project!</p>
      <p><strong>Project Details:</strong></p>
      <ul>
        <li>Project Type: ${project.projectType}</li>
        <li>Scheduled Month: ${project.bookingMonth}</li>
        <li>Total Price: $${project.totalPrice} AUD</li>
      </ul>
      <p>I'll be in touch within 24 hours to discuss your project requirements.</p>
      <p>Best regards,<br><strong>Cocoa Code Team</strong></p>
    `
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendBookingConfirmation };
