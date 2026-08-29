const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  college: {
    type: String,
    required: true
  },
  major: {
    type: String,
    required: true
  },
  year: {
    type: Number,
    required: true
  },
  googleId: {
    type: String
  },
  googleTokens: {
    access_token: String,
    refresh_token: String,
    expiry_date: Number
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  studyPreferences: {
    dailyGoalHours: {
      type: Number,
      default: 4
    },
    preferredSubjects: [String],
    studyTimes: {
      morning: Boolean,
      afternoon: Boolean,
      evening: Boolean,
      night: Boolean
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },

  // In the User schema, add:
bookmarkedResources: [{
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Resource'
}]
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);