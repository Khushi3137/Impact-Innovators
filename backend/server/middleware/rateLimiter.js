const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Authentication rate limiter
const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 login attempts per hour
  message: {
    success: false,
    message: 'Too many login attempts, please try again after an hour'
  }
});

// Gemini AI rate limiter
const geminiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // Limit each user to 30 requests per minute
  keyGenerator: (req) => req.userId, // Limit per user
  message: {
    success: false,
    message: 'Too many requests to AI service, please wait a moment'
  }
});

module.exports = { apiLimiter, authLimiter, geminiLimiter };