const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { validateRequest } = require('../middleware/validationMiddleware');
const { authLimiter } = require('../middleware/rateLimiter');
const {authMiddleware}=require('../middleware/authMiddleware')
// Validation rules
const registerValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('college').notEmpty().withMessage('College is required'),
  body('major').notEmpty().withMessage('Major is required'),
  body('year').isInt({ min: 1, max: 5 }).withMessage('Year must be between 1 and 5')
];

const loginValidation = [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
];

// Public routes
router.post('/register', registerValidation, validateRequest, authController.register);
router.post('/login', authLimiter, loginValidation, validateRequest, authController.login);
router.post('/google', authController.googleAuth);

// Protected routes (require authentication)
router.get('/profile', authMiddleware, authController.getProfile);
router.put('/profile', authMiddleware, authController.updateProfile);
router.put('/preferences', authMiddleware, authController.updateStudyPreferences);

module.exports = router;