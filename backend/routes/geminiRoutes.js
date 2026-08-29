const express = require('express');
const router = express.Router();
const geminiController = require('../controllers/geminiController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { geminiLimiter } = require('../middleware/rateLimiter');
const { uploadSingle } = require('../utils/fileUpload');

const handleFileUpload = (req, res, next) => {
  uploadSingle('file')(req, res, (error) => {
    if (!error) return next();

    return res.status(400).json({
      success: false,
      message: error.message || 'Unable to upload file'
    });
  });
};

// All routes require authentication and rate limiting
router.use(authMiddleware);
router.use(geminiLimiter);

// Gemini AI endpoints
router.post('/ask', geminiController.askGemini);
router.post('/explain', geminiController.explainConcept);
router.post('/study-plan', geminiController.generateStudyPlan);
router.post('/flashcards', geminiController.generateFlashcards);
router.post('/summarize', geminiController.summarizeText);
router.post('/quiz', geminiController.generateQuiz);
router.post('/solve', geminiController.solveProblem);
router.post('/practice-questions', geminiController.generatePracticeQuestions);
router.post('/check-answer', geminiController.checkAnswer);
router.post('/process-file', handleFileUpload, geminiController.processUploadedFile);



module.exports = router;
