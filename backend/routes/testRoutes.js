const express = require('express');
const router = express.Router();

router.get('/test-email', async (req, res) => {
  res.status(410).json({
    message: 'Email verification has been removed.'
  });
});

module.exports = router;
