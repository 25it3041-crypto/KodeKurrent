const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// ── Send OTP (Bypassed for submission) ──────────────────────────────────────
router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    console.log(`[BYPASS] OTP send bypassed for: ${email}`);
    return res.json({ 
      success: true, 
      message: 'OTP sent successfully (Bypassed)',
      devOtp: '1234' // Screen par ya console me dekhne ke liye
    });
  } catch (error) {
    console.error('[Error]:', error);
    res.status(500).json({ error: 'Failed: ' + error.message });
  }
});

// ── Verify OTP (Bypassed for submission) ────────────────────────────────────
router.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  console.log(`[BYPASS] OTP verified successfully for: ${email}`);
  
  // Success - Direct session token de do
  const sessionToken = crypto.randomBytes(32).toString('hex');
  res.json({ success: true, sessionToken });
});

module.exports = router;