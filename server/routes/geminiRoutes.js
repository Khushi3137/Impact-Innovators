const express = require('express');
const router = express.Router();
const geminiController = require('../controllers/geminiController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { geminiLimiter } = require('../middleware/rateLimiter');

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
router.post('/p', geminiController.processUploadedFile);



module.exports = router;