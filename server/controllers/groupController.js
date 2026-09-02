const StudyGroup = require('../models/StudyGroup');
const User = require('../models/User');

exports.createGroup = async (req, res) => {
  try {
    const { name, description, subject, isPublic, maxMembers } = req.body;
    
    const group = new StudyGroup({
      name,
      description,
      subject,
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
    
    res.status(201).json({
      success: true,
      group,
      message: 'Study group created successfully'
    });
  } catch (error) {
    console.error('Create group error:', error);
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
    
    // Check if already a member
    const isMember = group.members.some(member => 
      member.userId.toString() === req.userId.toString()
    );
    
    if (isMember) {
      return res.status(400).json({
        success: false,
        message: 'Already a member of this group'
      });
    }
    
    // Check if group is full
    if (group.members.length >= group.settings.maxMembers) {
      return res.status(400).json({
        success: false,
        message: 'Group is full'
      });
    }
    
    // Add user to group
    group.members.push({
      userId: req.userId,
      role: 'member',
      joinedAt: new Date()
    });
    
    await group.save();
    
    res.json({
      success: true,
      group,
      message: 'Joined group successfully'
    });
  } catch (error) {
    console.error('Join group error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join group'
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
      groups,
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
    const isMember = group.members.some(member => 
      member.userId._id.toString() === req.userId.toString()
    );
    
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
      isAdmin: group.members.some(member => 
        member.userId._id.toString() === req.userId.toString() && 
        member.role === 'admin'
      )
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
    const isMember = group.members.some(member => 
      member.userId.toString() === req.userId.toString()
    );
    
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
    const userRole = group.members.find(member => 
      member.userId.toString() === req.userId.toString()
    )?.role;
    
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
    const isAdmin = group.members.some(member => 
      member.userId.toString() === req.userId.toString() && 
      member.role === 'admin'
    );
    
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
    const isAdmin = group.members.some(member => 
      member.userId.toString() === req.userId.toString() && 
      member.role === 'admin'
    );
    
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
    const userRole = group.members.find(member => 
      member.userId.toString() === req.userId.toString()
    )?.role;
    
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
    const memberIndex = group.members.findIndex(member => 
      member.userId.toString() === req.userId.toString()
    );
    
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
    const requesterRole = group.members.find(member => 
      member.userId.toString() === req.userId.toString()
    )?.role;
    
    if (requesterRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only group admin can update member roles'
      });
    }
    
    // Find and update the member
    const memberIndex = group.members.findIndex(member => 
      member.userId.toString() === userId.toString()
    );
    
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
    const requesterRole = group.members.find(member => 
      member.userId.toString() === req.userId.toString()
    )?.role;
    
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
    const memberIndex = group.members.findIndex(member => 
      member.userId.toString() === userId.toString()
    );
    
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
    const isMember = group.members.some(member => 
      member.userId._id.toString() === req.userId.toString()
    );
    
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
    const isMember = group.members.some(member => 
      member.userId._id.toString() === req.userId.toString()
    );
    
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
    const isMember = group.members.some(member => 
      member.userId._id.toString() === req.userId.toString()
    );
    
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
      .populate('members.userId', 'name email');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = group.members.some(member => 
      member.userId._id.toString() === req.userId.toString()
    );
    
    if (!isMember && !group.settings.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to group messages'
      });
    }
    
    // In a real app, you would fetch from a separate Message model
    // For now, return demo messages
    const demoMessages = [
      {
        id: 'msg-1',
        userId: req.userId,
        userName: 'You',
        message: 'Welcome to the study group!',
        timestamp: new Date(Date.now() - 86400000),
        type: 'text'
      },
      {
        id: 'msg-2',
        userId: 'demo-user-1',
        userName: 'Study Partner',
        message: 'Let\'s schedule our next study session',
        timestamp: new Date(Date.now() - 43200000),
        type: 'text'
      }
    ];
    
    res.json({
      success: true,
      messages: demoMessages,
      count: demoMessages.length,
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
    
    const group = await StudyGroup.findById(groupId);
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = group.members.some(member => 
      member.userId.toString() === req.userId.toString()
    );
    
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'Only group members can send messages'
      });
    }
    
    // In a real app, you would save to a Message model and use Socket.io
    // For now, return a demo response
    
    const newMessage = {
      id: 'msg-' + Date.now(),
      userId: req.userId,
      message,
      type,
      timestamp: new Date(),
      groupId
    };
    
    // TODO: Emit socket event for real-time messaging
    // io.to(groupId).emit('new_message', newMessage);
    
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
      .select('members name');
    
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Group not found'
      });
    }
    
    // Check if user is a member
    const isMember = group.members.some(member => 
      member.userId._id.toString() === req.userId.toString()
    );
    
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
    const isAdmin = group.members.some(member => 
      member.userId._id.toString() === req.userId.toString() && 
      member.role === 'admin'
    );
    
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