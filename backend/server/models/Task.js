const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String
  },
  subject: {
    type: String,
    required: true
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['todo', 'in-progress', 'completed', 'overdue'],
    default: 'todo'
  },
  dueDate: {
    type: Date,
    required: true
  },
  estimatedTime: {
    type: Number, // in minutes
    default: 60
  },
  completedAt: {
    type: Date
  },
  reminders: [{
    time: Date,
    sent: {
      type: Boolean,
      default: false
    }
  }],
  tags: [String],
  attachments: [{
    filename: String,
    url: String,
    type: String
  }],
  dependencies: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task'
  }],
  recurrence: {
    pattern: {
      type: String,
      enum: ['daily', 'weekly', 'monthly', 'none'],
      default: 'none'
    },
    interval: Number,
    endDate: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

taskSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  
  // Check if task is overdue
  if (this.dueDate < new Date() && this.status !== 'completed') {
    this.status = 'overdue';
  }
  
  next();
});

module.exports = mongoose.model('Task', taskSchema);