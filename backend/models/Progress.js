const mongoose = require('mongoose');

const progressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  metrics: {
    studyTime: {
      type: Number, // in minutes
      default: 0
    },
    tasksCompleted: {
      type: Number,
      default: 0
    },
    flashcardsReviewed: {
      type: Number,
      default: 0
    },
    quizScore: {
      type: Number,
      default: 0
    },
    focusScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    }
  },
  goals: [{
    goal: String,
    achieved: Boolean,
    progress: Number
  }],
  insights: [{
    type: String
  }],
  challenges: [{
    challenge: String,
    solution: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
progressSchema.index({ userId: 1, date: 1, subject: 1 });

module.exports = mongoose.model('Progress', progressSchema);