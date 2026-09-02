const express = require('express');
const router = express.Router();
const groupController = require('../controllers/groupController');
const { authMiddleware } = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Study groups
router.post('/', groupController.createGroup);
router.get('/', groupController.getGroups);
router.get('/my-groups', groupController.getUserGroups);
router.get('/:groupId', groupController.getGroupDetails);
router.put('/:groupId', groupController.updateGroup);
router.delete('/:groupId', groupController.deleteGroup);

// Group membership
router.post('/:groupId/join', groupController.joinGroup);
router.post('/:groupId/leave', groupController.leaveGroup);
router.post('/:groupId/members/:userId/role', groupController.updateMemberRole);
router.delete('/:groupId/members/:userId', groupController.removeMember);

// Group resources and announcements
router.post('/:groupId/resources', groupController.addResource);
router.get('/:groupId/resources', groupController.getGroupResources);
router.post('/:groupId/announcements', groupController.createAnnouncement);
router.get('/:groupId/announcements', groupController.getAnnouncements);

// Group schedule
router.put('/:groupId/schedule', groupController.updateSchedule);
router.get('/:groupId/schedule', groupController.getSchedule);

// Group chat (would integrate with Socket.io)
router.get('/:groupId/messages', groupController.getMessages);
router.post('/:groupId/messages', groupController.sendMessage);
// In routes/groupRoutes.js, add these new routes:

// Additional group routes
router.get('/:groupId/members', groupController.getGroupMembers);
router.get('/search/groups', groupController.searchGroups);
router.get('/:groupId/analytics', groupController.getGroupAnalytics);
module.exports = router;