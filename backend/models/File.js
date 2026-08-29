const mongoose = require('mongoose');

const FileSchema = new mongoose.Schema({
  originalName: String,
  storagePath: String,
  mimeType: String,
  size: Number,
  category: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('File', FileSchema);
