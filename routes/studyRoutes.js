const express = require('express');
const router = express.Router();
const studyController = require('../controllers/studyController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Study sessions
router.post('/session/start', studyController.startStudySession);
router.post('/session/end', studyController.endStudySession);
router.get('/sessions', studyController.getStudySessions);
router.get('/session/:sessionId', studyController.getSessionDetails);

// Tasks
router.post('/tasks', studyController.createTask);
router.get('/tasks', studyController.getTasks);
router.get('/tasks/:taskId', studyController.getTaskDetails);
router.put('/tasks/:taskId', studyController.updateTask);
router.delete('/tasks/:taskId', studyController.deleteTask);

// Progress tracking
router.get('/progress', studyController.getProgress);
router.get('/stats', studyController.getStudyStats);
router.get('/streak', studyController.getStudyStreak);

// Pomodoro timer
router.post('/pomodoro/start', studyController.startPomodoro);
router.post('/pomodoro/end', studyController.endPomodoro);
router.get('/pomodoro/stats', studyController.getPomodoroStats);



router.get('/today', studyController.getTodayProgress);
router.get('/recommendations', studyController.getStudyRecommendations);
module.exports = router;