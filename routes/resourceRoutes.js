const express = require('express');
const router = express.Router();
const multer = require('multer');
const resourceController = require('../controllers/resourceController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { validateFileUpload } = require('../middleware/validationMiddleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.use(authMiddleware);

// Resource management
router.post('/', upload.single('file'), validateFileUpload, resourceController.uploadResource);
router.get('/', resourceController.getResources);
router.get('/my-resources', resourceController.getUserResources);
router.get('/:resourceId', resourceController.getResourceDetails);
router.put('/:resourceId', resourceController.updateResource);
router.delete('/:resourceId', resourceController.deleteResource);

// Resource interactions
router.post('/:resourceId/rate', resourceController.rateResource);
router.post('/:resourceId/download', resourceController.downloadResource);
router.post('/:resourceId/bookmark', resourceController.bookmarkResource);
router.get('/:resourceId/comments', resourceController.getComments);
router.post('/:resourceId/comments', resourceController.addComment);

// Statistics and recommendations
router.get('/stats/overall', resourceController.getResourceStats);
router.get('/recommendations', resourceController.getRecommendations);
router.get('/trending', resourceController.getTrendingResources);
// In routes/resourceRoutes.js, add these new routes:

// Additional resource routes
router.get('/bookmarks', resourceController.getBookmarkedResources);
router.post('/:resourceId/comments/:commentId/like', resourceController.likeComment);
module.exports = router;