const express = require('express');
const router = express.Router();
const flashcardController = require('../controllers/flashcardController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Flashcards CRUD
router.post('/', flashcardController.createFlashcard);
router.post('/bulk', flashcardController.bulkCreateFlashcards);
router.get('/', flashcardController.getFlashcards);
router.get('/stats', flashcardController.getFlashcardStats);
router.get('/:id', flashcardController.getFlashcard);
router.put('/:id', flashcardController.updateFlashcard);
router.delete('/:id', flashcardController.deleteFlashcard);

// Flashcards review system
router.post('/:id/review', flashcardController.reviewFlashcard);
router.get('/review/due', flashcardController.getDueFlashcards);
router.post('/review/session', flashcardController.startReviewSession);
router.post('/review/session/end', flashcardController.endReviewSession);

// Import/Export
router.post('/import', flashcardController.importFlashcards);
router.get('/export', flashcardController.exportFlashcards);
// In routes/flashcardRoutes.js, add these new routes:

// Additional flashcard routes
router.get('/metrics', flashcardController.getFlashcardMetrics);
router.get('/search', flashcardController.searchFlashcards);
router.post('/:flashcardId/reset', flashcardController.resetFlashcardProgress);
module.exports = router;