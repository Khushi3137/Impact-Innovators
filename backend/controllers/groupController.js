const StudyGroup = require('../models/StudyGroup');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendGroupInviteEmail } = require('../utils/emailService');

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizeInviteEmails = (emails = []) => {
  const list = Array.isArray(emails)
    ? emails
    : String(emails)
      .split(',')
      .map(email => email.trim());

  return [...new Set(list.map(email => email.toLowerCase()).filter(email => emailRegex.test(email)))];
};

const sameId = (value, id) => {
  const current = value?._id || value;
  return current?.toString() === id?.toString();
};

const isGroupMember = (group, userId) =>
  group.members.some(member => sameId(member.userId, userId));

const getUserRole = (group, userId) =>
  group.members.find(member => sameId(member.userId, userId))?.role;

const isGroupAdmin = (group, userId) =>
  ['admin', 'moderator'].includes(getUserRole(group, userId));

const addViewerStatus = (group, userId) => {
  const plainGroup = typeof group.toObject === 'function' ? group.toObject() : group;
  const isMember = plainGroup.members?.some(member => sameId(member.userId, userId));
  const pendingRequest = plainGroup.joinRequests?.some(request =>
    sameId(request.userId, userId) && request.status === 'pending'
  );

  return {
    ...plainGroup,
    viewerStatus: isMember ? 'member' : pendingRequest ? 'requested' : 'available'
  };
};

const sendGroupInvites = async ({ group, emails, inviter }) => {
  if (!emails.length) return { sent: [], failed: [] };

  const existingInviteEmails = new Set(
    (group.invitations || []).map(invitation => invitation.email.toLowerCase())
  );

  const newEmails = emails.filter(email => !existingInviteEmails.has(email));

  newEmails.forEach(email => {
    group.invitations.push({
      email,
      invitedBy: inviter._id
    });
  });

  await group.save();

  const users = await User.find({ email: { $in: newEmails } }).select('_id email');

  await Promise.all(users.map(user => Notification.create({
    userId: user._id,
    type: 'group_invite',
    title: 'Study group invitation',
    message: `${inviter.name || inviter.email} invited you to join ${group.name}`,
    data: {
      groupId: group._id,
      groupName: group.name
    },
    priority: 'medium'
  })));

  const results = await Promise.all(
    newEmails.map(async email => ({
      email,
      sent: await sendGroupInviteEmail({ email, group, inviter })
    }))
  );

  return {
    sent: results.filter(result => result.sent).map(result => result.email),
    failed: results.filter(result => !result.sent).map(result => result.email)
  };
};

exports.createGroup = async (req, res) => {
  try {
    const { name, description, subject, isPublic, maxMembers, inviteEmails } = req.body;
    const normalizedName = name?.trim();

    if (!normalizedName) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required'
      });
    }

    const creatorEmail = req.user.email?.toLowerCase();
    const emails = normalizeInviteEmails(inviteEmails).filter(email => email !== creatorEmail);
    
    const group = new StudyGroup({
      name: normalizedName,
      description,
      subject: subject?.trim() || 'General',
      creatorId: req.userId,
      members: [{
        userId: req.userId,
        role: 'admin',
        joinedAt: new Date()
      }],
      settings: {
        isPublic: isPublic !== undefined ? isPublic : true,
        maxMembers: maxMembers || 50
      }
    });
    
    await group.save();

    let inviteSummary = { sent: [], failed: [] };

    try {
      inviteSummary = await sendGroupInvites({
        group,
        emails,
        inviter: req.user
      });
    } catch (inviteError) {
      console.error('Create group invite error:', inviteError);
      inviteSummary = { sent: [], failed: emails };
    }
    
    res.status(201).json({
      success: true,
      group,
      invites: inviteSummary,
      message: 'Study group created successfully. You were added as group admin.'
    });
  } catch (error) {
    console.error('Create group error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: Object.values(error.errors).map(item => item.message).join(', ')
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create study group'
    });
  }
};

exports.joinGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    const isMember = isGroupMember(group, req.userId);
    
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'Already a member of this group'
      });
    }

    const pendingRequest = group.joinRequests.find(request =>
      sameId(request.userId, req.userId) && request.status === 'pending'
    );

    if (pendingRequest) {
      return res.json({
        success: false,
        requested: true,
        message: 'Join request is already pending'
      });
    }

    if (group.members.length >= group.settings.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Group is full'
      });
    }

    group.joinRequests.push({
      userId: req.userId,
      status: 'pending',
      requestedAt: new Date()
    });

    await group.save();

    const adminIds = group.members
      .filter(member => ['admin', 'moderator'].includes(member.role))
      .map(member => member.userId);

    await Promise.all(adminIds.map(userId => Notification.create({
      userId,
      type: 'system',
      title: 'New group join request',
      message: `${req.user.name || req.user.email} requested to join ${group.name}`,
      data: {
        groupId: group._id,
        groupName: group.name,
        requesterId: req.userId
      },
      priority: 'medium'
    })));
    
    res.json({
      success: true,
      requested: true,
      group,
      message: 'Join request sent. You will be added after an admin accepts it.'
    });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join group'
    });
  }
};

exports.getPendingJoinRequests = async (req, res) => {
  try {
    const groups = await StudyGroup.find({
      members: {
        $elemMatch: {
          userId: req.userId,
          role: { $in: ['admin', 'moderator'] }
        }
      },
      'joinRequests.status': 'pending'
    })
      .populate('joinRequests.userId', 'name email college major year')
      .sort({ createdAt: -1 });

    const requests = groups.flatMap(group => {
      if (!isGroupAdmin(group, req.userId)) return [];

      return group.joinRequests
        .filter(request => request.status === 'pending')
        .map(request => ({
          groupId: group._id,
          groupName: group.name,
          requestId: request._id,
          requestedAt: request.requestedAt,
          user: request.userId
        }));
    });

    res.json({
      success: true,
      requests,
      count: requests.length
    });
  } catch (error) {
    console.error('Get pending join requests error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch join requests'
    });
  }
};

exports.acceptJoinRequest = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!isGroupAdmin(group, req.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can accept join requests'
      });
    }

    const request = group.joinRequests.find(item =>
      sameId(item.userId, userId) && item.status === 'pending'
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Pending join request not found'
      });
    }

    if (group.members.length >= group.settings.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Group is full'
      });
    }

    if (!isGroupMember(group, userId)) {
      group.members.push({
        userId,
        role: 'member',
        joinedAt: new Date()
      });
    }

    request.status = 'accepted';
    request.respondedAt = new Date();
    request.respondedBy = req.userId;

    await group.save();

    await Notification.create({
      userId,
      type: 'system',
      title: 'Group request accepted',
      message: `Your request to join ${group.name} was accepted`,
      data: {
        groupId: group._id,
        groupName: group.name
      },
      priority: 'medium'
    });

    const updatedGroup = await StudyGroup.findById(groupId)
      .populate('creatorId', 'name email')
      .populate('members.userId', 'name email')
      .populate('joinRequests.userId', 'name email');

    res.json({
      success: true,
      group: updatedGroup,
      message: 'Join request accepted'
    });
  } catch (error) {
    console.error('Accept join request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept join request'
    });
  }
};

exports.rejectJoinRequest = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const group = await StudyGroup.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    if (!isGroupAdmin(group, req.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can reject join requests'
      });
    }

    const request = group.joinRequests.find(item =>
      sameId(item.userId, userId) && item.status === 'pending'
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Pending join request not found'
      });
    }

    request.status = 'rejected';
    request.respondedAt = new Date();
    request.respondedBy = req.userId;

    await group.save();

    res.json({
      success: true,
      message: 'Join request rejected'
    });
  } catch (error) {
    console.error('Reject join request error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject join request'
    });
  }
};

exports.getPendingInvitations = async (req, res) => {
  try {
    const email = req.user.email?.toLowerCase();

    if (!email) {
      return res.json({
        success: true,
        invitations: [],
        count: 0
      });
    }

    const groups = await StudyGroup.find({
      invitations: {
        $elemMatch: {
          email,
          status: 'pending'
        }
      }
    })
      .populate('creatorId', 'name email')
      .sort({ createdAt: -1 });

    const invitations = groups.map(group => {
      const invitation = group.invitations.find(invite => invite.email === email && invite.status === 'pending');

      return {
        groupId: group._id,
        groupName: group.name,
        subject: group.subject,
        invitedAt: invitation?.invitedAt,
        invitedBy: group.creatorId,
        memberCount: group.members.length
      };
    });

    res.json({
      success: true,
      invitations,
      count: invitations.length
    });
  } catch (error) {
    console.error('Get pending invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group invitations'
    });
  }
};

exports.acceptGroupInvite = async (req, res) => {
  try {
    const { groupId } = req.params;
    const email = req.user.email?.toLowerCase();

    const group = await StudyGroup.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const invitation = group.invitations.find(invite =>
      invite.email === email && invite.status === 'pending'
    );

    if (!invitation) {
      return res.status(403).json({
        success: false,
        message: 'No pending invitation found for your email'
      });
    }

    const isMember = isGroupMember(group, req.userId);

    if (!isMember) {
      if (group.members.length >= group.settings.maxMembers) {
        return res.status(400).json({
          success: false,
          message: 'Group is full'
        });
      }

      group.members.push({
        userId: req.userId,
        role: 'member',
        joinedAt: new Date()
      });
    }

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();

    await group.save();

    res.json({
      success: true,
      group,
      message: `You joined ${group.name}`
    });
  } catch (error) {
    console.error('Accept group invite error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept group invitation'
    });
  }
};

exports.inviteToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const emails = normalizeInviteEmails(req.body.emails || req.body.inviteEmails);

    if (!emails.length) {
      return res.status(400).json({
        success: false,
        message: 'Add at least one valid email address'
      });
    }

    const group = await StudyGroup.findById(groupId);

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }

    const isAdmin = isGroupAdmin(group, req.userId);

    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only group admins can invite members'
      });
    }

    const inviteSummary = await sendGroupInvites({
      group,
      emails,
      inviter: req.user
    });

    res.json({
      success: true,
      invites: inviteSummary,
      group,
      message: inviteSummary.sent.length
        ? 'Group invitations sent'
        : 'Invitations saved, but email delivery needs SMTP configuration'
    });
  } catch (error) {
    console.error('Invite to group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send group invitations'
    });
  }
};

exports.getGroups = async (req, res) => {
  try {
    const { subject, isPublic, page = 1, limit = 20 } = req.query;
    
    const filter = {};
    
    if (subject) {
      filter.subject = new RegExp(subject, 'i');
    }
    
    if (isPublic !== undefined) {
      filter['settings.isPublic'] = isPublic === 'true';
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const groups = await StudyGroup.find(filter)
      .populate('creatorId', 'name email')
      .populate('members.userId', 'name email')
      .populate('joinRequests.userId', 'name email')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await StudyGroup.countDocuments(filter);
    
    // Get user's groups
    const userGroups = await StudyGroup.find({
      'members.userId': req.userId
    }).populate('creatorId', 'name email');
    
    res.json({
      success: true,
      groups: groups.map(group => addViewerStatus(group, req.userId)),
      userGroups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch groups'
    });
  }
};

exports.getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await StudyGroup.findById(groupId)
      .populate('creatorId', 'name email college major')
      .populate('members.userId', 'name email college major year')
      .populate('resources.uploadedBy', 'name email')
      .populate('announcements.createdBy', 'name email');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = isGroupMember(group, req.userId);
    
    if (!isMember && !group.settings.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Group is private.'
      });
    }
    
    res.json({
      success: true,
      group,
      isMember,
      isAdmin: getUserRole(group, req.userId) === 'admin'
    });
  } catch (error) {
    console.error('Get group details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group details'
    });
  }
};

exports.addResource = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, url, type } = req.body;
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = isGroupMember(group, req.userId);
    
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Only group members can add resources'
      });
    }
    
    group.resources.push({
      name,
      url,
      type,
      uploadedBy: req.userId,
      uploadedAt: new Date()
    });
    
    await group.save();
    
    res.json({
      success: true,
      resource: group.resources[group.resources.length - 1],
      message: 'Resource added successfully'
    });
  } catch (error) {
    console.error('Add resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add resource'
    });
  }
};

exports.createAnnouncement = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { title, content } = req.body;
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is admin/moderator
    const userRole = getUserRole(group, req.userId);
    
    if (!['admin', 'moderator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins and moderators can create announcements'
      });
    }
    
    group.announcements.push({
      title,
      content,
      createdBy: req.userId,
      createdAt: new Date()
    });
    
    await group.save();
    
    // TODO: Notify group members (could use Socket.io)
    
    res.json({
      success: true,
      announcement: group.announcements[group.announcements.length - 1],
      message: 'Announcement created successfully'
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create announcement'
    });
  }
};

exports.updateSchedule = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { schedule } = req.body;
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is admin
    const isAdmin = getUserRole(group, req.userId) === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can update schedule'
      });
    }
    
    group.schedule = schedule;
    await group.save();
    
    res.json({
      success: true,
      schedule: group.schedule,
      message: 'Schedule updated successfully'
    });
  } catch (error) {
    console.error('Update schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update schedule'
    });
  }
};

// Add these missing functions to your groupController.js

exports.getUserGroups = async (req, res) => {
  try {
    const groups = await StudyGroup.find({
      'members.userId': req.userId
    })
    .populate('creatorId', 'name email')
    .populate('members.userId', 'name email')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      groups,
      count: groups.length
    });
  } catch (error) {
    console.error('Get user groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user groups'
    });
  }
};

exports.updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const updates = req.body;
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is admin
    const isAdmin = getUserRole(group, req.userId) === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can update group details'
      });
    }
    
    // Update allowed fields
    const allowedUpdates = ['name', 'description', 'subject', 'settings'];
    const updateData = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'settings') {
          updateData['settings'] = { ...group.settings, ...updates.settings };
        } else {
          updateData[field] = updates[field];
        }
      }
    });
    
    const updatedGroup = await StudyGroup.findByIdAndUpdate(
      groupId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
    .populate('creatorId', 'name email')
    .populate('members.userId', 'name email');
    
    res.json({
      success: true,
      group: updatedGroup,
      message: 'Group updated successfully'
    });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update group'
    });
  }
};

exports.deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is admin or creator
    const userRole = getUserRole(group, req.userId);
    
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can delete the group'
      });
    }
    
    await StudyGroup.findByIdAndDelete(groupId);
    
    res.json({
      success: true,
      message: 'Group deleted successfully',
      groupId
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete group'
    });
  }
};

exports.leaveGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const memberIndex = group.members.findIndex(member => sameId(member.userId, req.userId));
    
    if (memberIndex === -1) {
      return res.status(400).json({
        success: false,
        message: 'You are not a member of this group'
      });
    }
    
    // Check if user is the last admin
    const userRole = group.members[memberIndex].role;
    if (userRole === 'admin') {
      const adminCount = group.members.filter(m => m.role === 'admin').length;
      if (adminCount === 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot leave as the only admin. Transfer admin role first or delete the group.'
        });
      }
    }
    
    // Remove user from group
    group.members.splice(memberIndex, 1);
    await group.save();
    
    res.json({
      success: true,
      message: 'Left group successfully',
      groupId
    });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to leave group'
    });
  }
};

exports.updateMemberRole = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;
    
    if (!['admin', 'moderator', 'member'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Use admin, moderator, or member.'
      });
    }
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if requester is admin
    const requesterRole = getUserRole(group, req.userId);
    
    if (requesterRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can update member roles'
      });
    }
    
    // Find and update the member
    const memberIndex = group.members.findIndex(member => sameId(member.userId, userId));
    
    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in group'
      });
    }
    
    group.members[memberIndex].role = role;
    await group.save();
    
    res.json({
      success: true,
      message: `Member role updated to ${role}`,
      member: group.members[memberIndex]
    });
  } catch (error) {
    console.error('Update member role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update member role'
    });
  }
};

exports.removeMember = async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if requester is admin
    const requesterRole = getUserRole(group, req.userId);
    
    if (requesterRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can remove members'
      });
    }
    
    // Cannot remove yourself
    if (userId === req.userId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove yourself. Use leave group instead.'
      });
    }
    
    // Find and remove the member
    const memberIndex = group.members.findIndex(member => sameId(member.userId, userId));
    
    if (memberIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in group'
      });
    }
    
    const removedMember = group.members[memberIndex];
    group.members.splice(memberIndex, 1);
    await group.save();
    
    res.json({
      success: true,
      message: 'Member removed from group',
      removedMember
    });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove member'
    });
  }
};

exports.getGroupResources = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { type, uploadedBy, sortBy = 'uploadedAt', sortOrder = 'desc' } = req.query;
    
    const group = await StudyGroup.findById(groupId)
      .populate('resources.uploadedBy', 'name email')
      .populate('members.userId', 'name');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = isGroupMember(group, req.userId);
    
    if (!isMember && !group.settings.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to group resources'
      });
    }
    
    let resources = group.resources;
    
    // Apply filters
    if (type) {
      resources = resources.filter(r => r.type === type);
    }
    
    if (uploadedBy) {
      resources = resources.filter(r => 
        r.uploadedBy._id.toString() === uploadedBy.toString()
      );
    }
    
    // Sort resources
    resources.sort((a, b) => {
      const aValue = a[sortBy] || a.uploadedAt;
      const bValue = b[sortBy] || b.uploadedAt;
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    
    res.json({
      success: true,
      resources,
      count: resources.length,
      group: {
        id: group._id,
        name: group.name,
        isPublic: group.settings.isPublic
      }
    });
  } catch (error) {
    console.error('Get group resources error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group resources'
    });
  }
};

exports.getAnnouncements = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 20 } = req.query;
    
    const group = await StudyGroup.findById(groupId)
      .populate('announcements.createdBy', 'name email')
      .populate('members.userId', 'name');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = isGroupMember(group, req.userId);
    
    if (!isMember && !group.settings.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to group announcements'
      });
    }
    
    let announcements = group.announcements;
    
    // Sort by creation date (newest first)
    announcements.sort((a, b) => b.createdAt - a.createdAt);
    
    // Apply limit
    if (limit) {
      announcements = announcements.slice(0, parseInt(limit));
    }
    
    res.json({
      success: true,
      announcements,
      count: announcements.length,
      group: {
        id: group._id,
        name: group.name
      }
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch announcements'
    });
  }
};

exports.getSchedule = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await StudyGroup.findById(groupId)
      .populate('members.userId', 'name');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = isGroupMember(group, req.userId);
    
    if (!isMember && !group.settings.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to group schedule'
      });
    }
    
    res.json({
      success: true,
      schedule: group.schedule || [],
      group: {
        id: group._id,
        name: group.name,
        subject: group.subject
      }
    });
  } catch (error) {
    console.error('Get schedule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch schedule'
    });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { limit = 50, before } = req.query;
    
    const group = await StudyGroup.findById(groupId)
      .populate('members.userId', 'name email')
      .populate('messages.senderId', 'name email');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = isGroupMember(group, req.userId);
    
    if (!isMember && !group.settings.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to group messages'
      });
    }
    
    const beforeDate = before ? new Date(before) : null;
    const maxMessages = Math.min(Math.max(parseInt(limit) || 50, 1), 100);

    const messages = (group.messages || [])
      .filter(message => !beforeDate || message.createdAt < beforeDate)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, maxMessages)
      .reverse()
      .map(message => ({
        id: message._id,
        _id: message._id,
        groupId: group._id,
        userId: message.senderId?._id || message.senderId,
        sender: message.senderName || message.senderId?.name || message.senderId?.email || 'Student',
        message: message.message,
        type: message.type || 'text',
        timestamp: message.createdAt
      }));
    
    res.json({
      success: true,
      messages,
      count: messages.length,
      group: {
        id: group._id,
        name: group.name,
        memberCount: group.members.length
      }
    });
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages'
    });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { message, type = 'text' } = req.body;
    const normalizedMessage = String(message || '').trim();

    if (!normalizedMessage) {
      return res.status(400).json({
        success: false,
        message: 'Message cannot be empty'
      });
    }
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = isGroupMember(group, req.userId);
    
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Only group members can send messages'
      });
    }
    
    group.messages.push({
      senderId: req.userId,
      senderName: req.user.name || req.user.email || 'Student',
      message: normalizedMessage,
      type
    });

    await group.save();

    const savedMessage = group.messages[group.messages.length - 1];
    const newMessage = {
      id: savedMessage._id,
      _id: savedMessage._id,
      userId: req.userId,
      sender: savedMessage.senderName,
      message: savedMessage.message,
      type: savedMessage.type,
      timestamp: savedMessage.createdAt,
      groupId
    };
    
    res.json({
      success: true,
      message: newMessage,
      sent: true,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Additional useful group functions

exports.getGroupMembers = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await StudyGroup.findById(groupId)
      .populate('members.userId', 'name email college major year')
      .select('members name settings');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = isGroupMember(group, req.userId);
    
    if (!isMember && !group.settings.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to member list'
      });
    }
    
    res.json({
      success: true,
      members: group.members,
      count: group.members.length,
      groupName: group.name
    });
  } catch (error) {
    console.error('Get group members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group members'
    });
  }
};

exports.searchGroups = async (req, res) => {
  try {
    const { query, subject, isPublic } = req.query;
    
    const filter = {};
    
    if (query) {
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ];
    }
    
    if (subject) {
      filter.subject = { $regex: subject, $options: 'i' };
    }
    
    if (isPublic !== undefined) {
      filter['settings.isPublic'] = isPublic === 'true';
    }
    
    const groups = await StudyGroup.find(filter)
      .populate('creatorId', 'name email')
      .populate('members.userId', 'name')
      .limit(20)
      .sort({ members: -1, createdAt: -1 });
    
    res.json({
      success: true,
      groups,
      count: groups.length,
      query,
      filters: { subject, isPublic }
    });
  } catch (error) {
    console.error('Search groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search groups'
    });
  }
};

exports.getGroupAnalytics = async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await StudyGroup.findById(groupId)
      .populate('members.userId', 'name')
      .populate('resources.uploadedBy', 'name');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is admin
    const isAdmin = getUserRole(group, req.userId) === 'admin';
    
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can view analytics'
      });
    }
    
    const analytics = {
      memberCount: group.members.length,
      resourceCount: group.resources.length,
      announcementCount: group.announcements.length,
      scheduleCount: group.schedule.length,
      createdAt: group.createdAt,
      activeMembers: group.members.length, // In real app, track activity
      resourceTypes: group.resources.reduce((acc, resource) => {
        acc[resource.type] = (acc[resource.type] || 0) + 1;
        return acc;
      }, {}),
      memberRoles: group.members.reduce((acc, member) => {
        acc[member.role] = (acc[member.role] || 0) + 1;
        return acc;
      }, {})
    };
    
    res.json({
      success: true,
      analytics,
      group: {
        id: group._id,
        name: group.name,
        subject: group.subject
      }
    });
  } catch (error) {
    console.error('Get group analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch group analytics'
    });
  }
};
