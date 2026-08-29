const express = require('express');
const router = express.Router();
const { sendVerificationEmail } = require('../utils/emailService');

router.get('/test-email', async (req, res) => {
  try {
    await sendVerificationEmail(
      { email: 'YOUR_EMAIL@gmail.com', name: 'Palak' },
      'dummy-token-123'
    );
    res.send('Email sent');
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;
