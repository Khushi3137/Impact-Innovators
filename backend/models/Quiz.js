const mongoose = require('mongoose');

const quizQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  options: {
    type: [String],
    default: []
  },
  correctAnswer: {
    type: String,
    default: ''
  },
  explanation: {
    type: String,
    default: ''
  },
  category: {
    type: String,
    default: ''
  },
  difficulty: {
    type: String,
    default: 'medium'
  }
}, { _id: false });

const quizAttemptSchema = new mongoose.Schema({
  score: {
    type: Number,
    required: true
  },
  total: {
    type: Number,
    required: true
  },
  answers: {
    type: Map,
    of: String,
    default: {}
  },
  submittedAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

const quizSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  topic: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    default: 'General',
    trim: true
  },
  difficulty: {
    type: String,
    default: 'medium'
  },
  questions: {
    type: [quizQuestionSchema],
    default: []
  },
  attempts: {
    type: [quizAttemptSchema],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Quiz', quizSchema);
