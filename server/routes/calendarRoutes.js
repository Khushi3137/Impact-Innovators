const express = require('express');
const router = express.Router();
const calendarController = require('../controllers/calendarController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Google Calendar integration

router.get('/auth-url', calendarController.getAuthUrl);
router.get('/callback', calendarController.handleCallback);
router.post('/event', calendarController.createStudyEvent);
router.post('/sync-schedule', calendarController.syncStudySchedule);
router.get('/events', calendarController.getUpcomingEvents);
router.delete('/event/:eventId', calendarController.deleteEvent);

// Additional calendar routes
router.put('/event/:eventId', calendarController.updateEvent);
router.get('/event/:eventId', calendarController.getEventDetails);
router.post('/recurring-event', calendarController.createRecurringStudyEvent);
router.get('/colors', calendarController.getCalendarColors);
router.delete('/clear-study-events', calendarController.clearStudyEvents);

module.exports = router;