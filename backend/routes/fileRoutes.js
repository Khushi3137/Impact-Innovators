const express = require('express');
const router = express.Router();
const { uploadSingle, uploadMultiple, getSupportedTypes } = require('../utils/fileUpload');
const geminiController = require('../controllers/geminiController');
const authMiddleware = require('../middleware/authMiddleware');

// All routes require authentication
router.use(authMiddleware.verifyToken);  // ✅ Make sure this function exists

// Get supported file types
router.get('/supported-types', (req, res) => {
  try {
    const supportedTypes = getSupportedTypes();
    res.json({
      success: true,
      supported: supportedTypes
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Process single file
router.post('/process', 
  uploadSingle('file'),
  geminiController.processUploadedFile
);

// Process multiple files
router.post('/process-multiple',
  uploadMultiple('files', 5),
  geminiController.processMultipleFiles
);

// Extract specific content type
router.post('/extract/:type',
  uploadSingle('file'),
  geminiController.extractFromFile
);

// Get file info (metadata only)
router.post('/info',
  uploadSingle('file'),
  geminiController.getFileInfo
);

// Test video processing
router.post('/test-video',
  uploadSingle('file'),
  geminiController.testVideoProcessing
);

// Test audio processing
router.post('/test-audio',
  uploadSingle('file'),
  geminiController.testAudioProcessing
);

// Delete uploaded file
router.delete('/delete',
  geminiController.deleteUploadedFile
);

module.exports = router;