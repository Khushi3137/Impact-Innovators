const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', quizController.getQuizzes);
router.post('/:id/attempts', quizController.recordQuizAttempt);
router.delete('/:id', quizController.deleteQuiz);

module.exports = router;
