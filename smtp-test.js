// smtp-test.js
require('dotenv').config();
const nodemailer = require('nodemailer');

// --- same config as your emailService.js ---
const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
const port = Number(process.env.EMAIL_PORT || 587);
const secure = port === 465;

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  requireTLS: port === 587,
  connectionTimeout: 10000,
  socketTimeout: 15000,
  tls: { servername: host },
  family: 4,
});

(async () => {
  try {
    await transporter.verify();
    console.log('✅ SMTP is ready!');
  } catch (err) {
    console.error('❌ SMTP verify failed:', err.message);
  } finally {
    process.exit();
  }
})();
