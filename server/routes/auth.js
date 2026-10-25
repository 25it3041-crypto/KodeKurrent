const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const crypto = require('crypto');

// In-memory OTP Store: email -> { otp, expiresAt, attempts }
const otpStore = new Map();

// Generate transporter dynamically
async function getTransporter() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Fallback Ethereal only if no SMTP credentials exist
  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
}

// ── Send OTP ──────────────────────────────────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    const cleanEmail = email.trim().toLowerCase();
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 mins

    otpStore.set(cleanEmail, { otp, expiresAt, attempts: 0 });

    const transporter = await getTransporter();
    const isRealSmtp = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || `"HireAI Portal" <${process.env.SMTP_USER}>`,
      to: cleanEmail,
      subject: `${otp} is your HireAI Verification Code`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #e2e8f0; rounded: 12px;">
          <h2 style="color: #4f46e5; margin-bottom: 8px;">HireAI Verification Code</h2>
          <p style="color: #475569; font-size: 14px;">Use the following 6-digit OTP to complete your login verification:</p>
          <div style="background-color: #f1f5f9; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #1e293b;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 12px;">This code is valid for 10 minutes. Do not share this code with anyone.</p>
        </div>
      `,
    });

    if (isRealSmtp) {
      console.log(`[SMTP] Real OTP email sent to ${cleanEmail}`);
      return res.json({ success: true, message: 'OTP sent to your email inbox' });
    } else {
      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`[Ethereal Test Mail] Preview: ${previewUrl}`);
      return res.json({
        success: true,
        previewUrl,
        devOtp: otp,
      });
    }
  } catch (error) {
    console.error('[SMTP Error]:', error);
    res.status(500).json({ error: 'Failed to send OTP email: ' + error.message });
  }
});

// ── Verify OTP ────────────────────────────────────────────────────────────────
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP are required' });

  const cleanEmail = email.trim().toLowerCase();
  const record = otpStore.get(cleanEmail);

  if (!record) {
    return res.status(400).json({ error: 'OTP expired or not requested. Please send again.' });
  }

  if (Date.now() > record.expiresAt) {
    otpStore.delete(cleanEmail);
    return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
  }

  if (record.attempts >= 5) {
    otpStore.delete(cleanEmail);
    return res.status(400).json({ error: 'Too many failed attempts. Please request a new OTP.' });
  }

  if (record.otp !== otp.trim()) {
    record.attempts += 1;
    return res.status(400).json({
      error: 'Invalid OTP code',
      attemptsLeft: 5 - record.attempts,
    });
  }

  // Success
  otpStore.delete(cleanEmail);
  const sessionToken = crypto.randomBytes(32).toString('hex');
  res.json({ success: true, sessionToken });
});

module.exports = router;