const User = require('../models/User');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');

const getJwtSecret = () => {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (process.env.NODE_ENV !== 'production') {
    console.warn('JWT_SECRET is not configured. Using an insecure development-only fallback.');
    return 'development-only-jwt-secret';
  }

  throw new Error('JWT_SECRET is required in production');
};

const generateToken = (userId) => {
  return jwt.sign(
    { userId },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
};

const isDatabaseConnected = () => mongoose.connection.readyState === 1;

const sendDatabaseUnavailable = (res) => {
  return res.status(503).json({
    success: false,
    message: 'Database is not connected. Set MONGODB_URI in backend/.env and restart the backend server.'
  });
};

exports.register = async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return sendDatabaseUnavailable(res);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { name, email, password, college, major, year } = req.body;

    // Check if user exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Create user
    user = new User({
      name,
      email,
      password,
      college,
      major,
      year,
      isVerified: true
    });

    await user.save();

    // Generate token
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        major: user.major,
        year: user.year
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      msg:error
    });
  }
};

exports.login = async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return sendDatabaseUnavailable(res);
    }

    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        major: user.major,
        year: user.year
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

exports.googleAuth = async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return sendDatabaseUnavailable(res);
    }

    const { tokenId } = req.body;
    
    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
    
    const ticket = await client.verifyIdToken({
      idToken: tokenId,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;
    
    // Check if user exists
    let user = await User.findOne({ $or: [{ email }, { googleId }] });
    
    if (!user) {
      // Create new user
      user = new User({
        name,
        email,
        googleId,
        password: Math.random().toString(36).slice(-8), // Random password
        college: 'Not specified',
        major: 'Not specified',
        year: 1,
        isVerified: true
      });
      await user.save();
    } else {
      // Update googleId if not present
      if (!user.googleId) {
        user.googleId = googleId;
        await user.save();
      }
    }
    
    // Generate token
    const token = generateToken(user._id);
    
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        college: user.college,
        major: user.major,
        year: user.year,
        picture
      }
    });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Google authentication failed'
    });
  }
};

exports.getProfile = async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return sendDatabaseUnavailable(res);
    }

    const user = await User.findById(req.userId)
      .select('-password -googleTokens');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return sendDatabaseUnavailable(res);
    }

    const updates = req.body;
    
    // Remove fields that shouldn't be updated
    delete updates.password;
    delete updates.email;
    delete updates.googleId;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -googleTokens');
    
    res.json({
      success: true,
      user,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

exports.updateStudyPreferences = async (req, res) => {
  try {
    if (!isDatabaseConnected()) {
      return sendDatabaseUnavailable(res);
    }

    const { dailyGoalHours, preferredSubjects, studyTimes } = req.body;
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        $set: {
          'studyPreferences.dailyGoalHours': dailyGoalHours || 4,
          'studyPreferences.preferredSubjects': preferredSubjects || [],
          'studyPreferences.studyTimes': studyTimes || {}
        }
      },
      { new: true }
    ).select('-password');
    
    res.json({
      success: true,
      user,
      message: 'Study preferences updated successfully'
    });
  } catch (error) {
    console.error('Update study preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update study preferences'
    });
  }
};
