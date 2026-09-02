const Resource = require('../models/Resource');
const StudyGroup = require('../models/StudyGroup');


const User = require('../models/User');

exports.uploadResource = async (req, res) => {
  try {
    const { title, description, type, subject, tags, isPublic, groupId } = req.body;
    
    let url = req.body.url;
    
    // If file is uploaded via multer
    if (req.file) {
      url = `/uploads/${req.file.filename}`;
    }
    
    const resourceData = {
      title,
      description,
      type,
      subject,
      url,
      uploadedBy: req.userId,
      tags: tags ? tags.split(',') : [],
      isPublic: isPublic !== undefined ? isPublic : true
    };
    
    // If associated with a group
    if (groupId) {
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
          message: 'Only group members can upload resources'
        });
      }
      
      resourceData.isPublic = false; // Group resources are private by default
    }
    
    const resource = new Resource(resourceData);
    await resource.save();
    
    res.status(201).json({
      success: true,
      resource,
      message: 'Resource uploaded successfully'
    });
  } catch (error) {
    console.error('Upload resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload resource'
    });
  }
};

exports.getResources = async (req, res) => {
  try {
    const { subject, type, tags, uploadedBy, sortBy = 'createdAt', sortOrder = 'desc', 
            page = 1, limit = 20, groupId } = req.query;
    
    const filter = {};
    
    // Public resources or user's private resources
    filter.$or = [
      { isPublic: true },
      { uploadedBy: req.userId }
    ];
    
    if (subject) {
      filter.subject = new RegExp(subject, 'i');
    }
    
    if (type) {
      filter.type = type;
    }
    
    if (tags) {
      filter.tags = { $in: tags.split(',') };
    }
    
    if (uploadedBy) {
      filter.uploadedBy = uploadedBy;
    }
    
    // If fetching group resources
    if (groupId) {
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
          message: 'Access denied to group resources'
        });
      }
      
      // Get resources uploaded by group members
      const memberIds = group.members.map(member => member.userId);
      filter.uploadedBy = { $in: memberIds };
      filter.isPublic = false; // Group resources are private
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const resources = await Resource.find(filter)
      .populate('uploadedBy', 'name email college')
      .populate('ratings.userId', 'name')
      .skip(skip)
      .limit(parseInt(limit))
      .sort(sort);
    
    const total = await Resource.countDocuments(filter);
    
    // Get recommended resources based on user's subjects
    const user = await User.findById(req.userId);
    let recommended = [];
    
    if (user && user.studyPreferences?.preferredSubjects?.length > 0) {
      recommended = await Resource.find({
        subject: { $in: user.studyPreferences.preferredSubjects },
        isPublic: true,
        averageRating: { $gte: 4 }
      })
      .populate('uploadedBy', 'name email')
      .limit(5)
      .sort({ averageRating: -1, downloads: -1 });
    }
    
    res.json({
      success: true,
      resources,
      recommended,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get resources error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resources'
    });
  }
};

exports.rateResource = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { rating, review } = req.body;
    
    const resource = await Resource.findById(resourceId);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check if user has already rated
    const existingRatingIndex = resource.ratings.findIndex(
      r => r.userId.toString() === req.userId.toString()
    );
    
    if (existingRatingIndex !== -1) {
      // Update existing rating
      resource.ratings[existingRatingIndex].rating = rating;
      resource.ratings[existingRatingIndex].review = review;
      resource.ratings[existingRatingIndex].createdAt = new Date();
    } else {
      // Add new rating
      resource.ratings.push({
        userId: req.userId,
        rating,
        review,
        createdAt: new Date()
      });
    }
    
    await resource.save();
    
    res.json({
      success: true,
      averageRating: resource.averageRating,
      totalRatings: resource.ratings.length,
      message: 'Rating submitted successfully'
    });
  } catch (error) {
    console.error('Rate resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating'
    });
  }
};

exports.downloadResource = async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    const resource = await Resource.findById(resourceId);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check access
    if (!resource.isPublic && resource.uploadedBy.toString() !== req.userId.toString()) {
      // Check if user is in same group
      const groups = await StudyGroup.find({
        'members.userId': req.userId
      });
      
      const groupMemberIds = groups.flatMap(g => g.members.map(m => m.userId.toString()));
      
      if (!groupMemberIds.includes(resource.uploadedBy.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this resource'
        });
      }
    }
    
    // Increment download count
    resource.downloads += 1;
    await resource.save();
    
    // Log download (could be stored in a separate downloads collection)
    
    res.json({
      success: true,
      downloadUrl: resource.url,
      resource: {
        title: resource.title,
        description: resource.description,
        type: resource.type,
        format: resource.format
      },
      message: 'Download initiated'
    });
  } catch (error) {
    console.error('Download resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download resource'
    });
  }
};

exports.getResourceStats = async (req, res) => {
  try {
    const userId = req.userId;
    
    // User's uploaded resources
    const userResources = await Resource.find({ uploadedBy: userId });
    
    // Most downloaded resources
    const popularResources = await Resource.find({ isPublic: true })
      .sort({ downloads: -1 })
      .limit(10)
      .populate('uploadedBy', 'name');
    
    // Resources by subject
    const resourcesBySubject = await Resource.aggregate([
      { $match: { isPublic: true } },
      { $group: {
        _id: '$subject',
        count: { $sum: 1 },
        avgRating: { $avg: '$averageRating' },
        totalDownloads: { $sum: '$downloads' }
      }},
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);
    
    // Recent resources
    const recentResources = await Resource.find({ isPublic: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('uploadedBy', 'name');
    
    res.json({
      success: true,
      stats: {
        userUploads: userResources.length,
        userDownloads: userResources.reduce((sum, r) => sum + r.downloads, 0),
        userAvgRating: userResources.length > 0 ? 
          userResources.reduce((sum, r) => sum + r.averageRating, 0) / userResources.length : 0,
        popularResources,
        resourcesBySubject,
        recentResources
      }
    });
  } catch (error) {
    console.error('Get resource stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource statistics'
    });
  }
};





exports.getUserResources = async (req, res) => {
  try {
    const { type, subject, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const filter = { uploadedBy: req.userId };
    
    if (type) filter.type = type;
    if (subject) filter.subject = new RegExp(subject, 'i');
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const resources = await Resource.find(filter)
      .populate('uploadedBy', 'name email')
      .populate('ratings.userId', 'name')
      .sort(sort);
    
    // Calculate statistics for user's resources
    const totalResources = resources.length;
    const totalDownloads = resources.reduce((sum, r) => sum + (r.downloads || 0), 0);
    const avgRating = resources.length > 0 ? 
      resources.reduce((sum, r) => sum + (r.averageRating || 0), 0) / resources.length : 0;
    
    res.json({
      success: true,
      resources,
      stats: {
        total: totalResources,
        totalDownloads,
        averageRating: avgRating,
        byType: resources.reduce((acc, r) => {
          acc[r.type] = (acc[r.type] || 0) + 1;
          return acc;
        }, {}),
        bySubject: resources.reduce((acc, r) => {
          acc[r.subject] = (acc[r.subject] || 0) + 1;
          return acc;
        }, {})
      }
    });
  } catch (error) {
    console.error('Get user resources error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user resources'
    });
  }
};

exports.getResourceDetails = async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    const resource = await Resource.findById(resourceId)
      .populate('uploadedBy', 'name email college')
      .populate('ratings.userId', 'name email')
      .populate('recommendations', 'title subject averageRating');
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check access
    if (!resource.isPublic && resource.uploadedBy._id.toString() !== req.userId.toString()) {
      // Check if user is in same group
      const groups = await StudyGroup.find({
        'members.userId': req.userId
      });
      
      const groupMemberIds = groups.flatMap(g => g.members.map(m => m.userId.toString()));
      
      if (!groupMemberIds.includes(resource.uploadedBy._id.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this resource'
        });
      }
    }
    
    // Check if user has bookmarked this resource
    const user = await User.findById(req.userId);
    const isBookmarked = user?.bookmarkedResources?.includes(resourceId) || false;
    
    // Check if user has rated this resource
    const userRating = resource.ratings.find(r => 
      r.userId._id.toString() === req.userId.toString()
    );
    
    res.json({
      success: true,
      resource,
      userInfo: {
        isBookmarked,
        userRating: userRating ? {
          rating: userRating.rating,
          review: userRating.review,
          date: userRating.createdAt
        } : null,
        canEdit: resource.uploadedBy._id.toString() === req.userId.toString()
      }
    });
  } catch (error) {
    console.error('Get resource details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource details'
    });
  }
};

exports.updateResource = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const updates = req.body;
    
    const resource = await Resource.findById(resourceId);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check if user is the uploader
    if (resource.uploadedBy.toString() !== req.userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Only the uploader can update this resource'
      });
    }
    
    // Allowed updates
    const allowedUpdates = ['title', 'description', 'subject', 'tags', 'isPublic'];
    const updateData = {};
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        if (field === 'tags' && typeof updates[field] === 'string') {
          updateData[field] = updates[field].split(',');
        } else {
          updateData[field] = updates[field];
        }
      }
    });
    
    const updatedResource = await Resource.findByIdAndUpdate(
      resourceId,
      { $set: updateData },
      { new: true, runValidators: true }
    )
    .populate('uploadedBy', 'name email');
    
    res.json({
      success: true,
      resource: updatedResource,
      message: 'Resource updated successfully'
    });
  } catch (error) {
    console.error('Update resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update resource'
    });
  }
};

exports.deleteResource = async (req, res) => {
  try {
    const { resourceId } = req.params;
    
    const resource = await Resource.findById(resourceId);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check if user is the uploader or admin
    if (resource.uploadedBy.toString() !== req.userId.toString()) {
      // Check if user is admin (you might want to add admin role check)
      return res.status(403).json({
        success: false,
        message: 'Only the uploader can delete this resource'
      });
    }
    
    // TODO: Delete the actual file from storage if exists
    
    await Resource.findByIdAndDelete(resourceId);
    
    res.json({
      success: true,
      message: 'Resource deleted successfully',
      resourceId
    });
  } catch (error) {
    console.error('Delete resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete resource'
    });
  }
};

exports.bookmarkResource = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { action = 'toggle' } = req.body; // 'add', 'remove', or 'toggle'
    
    const resource = await Resource.findById(resourceId);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Initialize bookmarkedResources if it doesn't exist
    if (!user.bookmarkedResources) {
      user.bookmarkedResources = [];
    }
    
    const isBookmarked = user.bookmarkedResources.includes(resourceId);
    let message = '';
    
    if (action === 'add' || (action === 'toggle' && !isBookmarked)) {
      if (!isBookmarked) {
        user.bookmarkedResources.push(resourceId);
        message = 'Resource bookmarked successfully';
      } else {
        message = 'Resource already bookmarked';
      }
    } else if (action === 'remove' || (action === 'toggle' && isBookmarked)) {
      user.bookmarkedResources = user.bookmarkedResources.filter(
        id => id.toString() !== resourceId
      );
      message = 'Resource removed from bookmarks';
    }
    
    await user.save();
    
    res.json({
      success: true,
      isBookmarked: action === 'remove' ? false : !isBookmarked,
      message,
      bookmarksCount: user.bookmarkedResources.length
    });
  } catch (error) {
    console.error('Bookmark resource error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to bookmark resource'
    });
  }
};

exports.getComments = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    const resource = await Resource.findById(resourceId)
      .populate('comments.userId', 'name email')
      .select('comments');
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check access
    if (!resource.isPublic && resource.uploadedBy.toString() !== req.userId.toString()) {
      // Check group access
      const groups = await StudyGroup.find({ 'members.userId': req.userId });
      const groupMemberIds = groups.flatMap(g => g.members.map(m => m.userId.toString()));
      
      if (!groupMemberIds.includes(resource.uploadedBy.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to resource comments'
        });
      }
    }
    
    let comments = resource.comments || [];
    
    // Sort comments
    comments.sort((a, b) => {
      const aValue = a[sortBy] || a.createdAt;
      const bValue = b[sortBy] || b.createdAt;
      
      if (sortOrder === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
    
    // Apply limit
    if (limit) {
      comments = comments.slice(0, parseInt(limit));
    }
    
    res.json({
      success: true,
      comments,
      count: comments.length,
      resourceId,
      totalComments: resource.comments?.length || 0
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch comments'
    });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { resourceId } = req.params;
    const { content, parentCommentId } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Comment content is required'
      });
    }
    
    const resource = await Resource.findById(resourceId);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Check access
    if (!resource.isPublic && resource.uploadedBy.toString() !== req.userId.toString()) {
      // Check group access
      const groups = await StudyGroup.find({ 'members.userId': req.userId });
      const groupMemberIds = groups.flatMap(g => g.members.map(m => m.userId.toString()));
      
      if (!groupMemberIds.includes(resource.uploadedBy.toString())) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to comment on this resource'
        });
      }
    }
    
    // Initialize comments array if it doesn't exist
    if (!resource.comments) {
      resource.comments = [];
    }
    
    const newComment = {
      userId: req.userId,
      content: content.trim(),
      createdAt: new Date(),
      likes: 0,
      likedBy: []
    };
    
    // If it's a reply to another comment
    if (parentCommentId) {
      const parentComment = resource.comments.id(parentCommentId);
      if (!parentComment) {
        return res.status(404).json({
          success: false,
          message: 'Parent comment not found'
        });
      }
      
      if (!parentComment.replies) {
        parentComment.replies = [];
      }
      
      newComment.parentCommentId = parentCommentId;
      parentComment.replies.push(newComment);
    } else {
      // It's a top-level comment
      resource.comments.push(newComment);
    }
    
    await resource.save();
    
    // Populate user info for response
    const savedResource = await Resource.findById(resourceId)
      .populate('comments.userId', 'name email')
      .populate('comments.replies.userId', 'name email');
    
    const addedComment = parentCommentId 
      ? savedResource.comments.id(parentCommentId)?.replies?.slice(-1)[0]
      : savedResource.comments.slice(-1)[0];
    
    res.status(201).json({
      success: true,
      comment: addedComment,
      message: 'Comment added successfully'
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add comment'
    });
  }
};

exports.getRecommendations = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Get user's study preferences
    const user = await User.findById(req.userId);
    const preferredSubjects = user?.studyPreferences?.preferredSubjects || [];
    
    let recommendations = [];
    
    if (preferredSubjects.length > 0) {
      // Recommend resources based on user's preferred subjects
      recommendations = await Resource.find({
        subject: { $in: preferredSubjects },
        isPublic: true,
        averageRating: { $gte: 3.5 }
      })
      .populate('uploadedBy', 'name email')
      .sort({ averageRating: -1, downloads: -1 })
      .limit(parseInt(limit));
    } else {
      // If no preferences, recommend popular resources
      recommendations = await Resource.find({ 
        isPublic: true,
        averageRating: { $gte: 4 }
      })
      .populate('uploadedBy', 'name email')
      .sort({ downloads: -1, averageRating: -1 })
      .limit(parseInt(limit));
    }
    
    // If not enough recommendations, add more popular ones
    if (recommendations.length < limit) {
      const additional = await Resource.find({
        isPublic: true,
        _id: { $nin: recommendations.map(r => r._id) }
      })
      .populate('uploadedBy', 'name email')
      .sort({ downloads: -1 })
      .limit(parseInt(limit) - recommendations.length);
      
      recommendations = [...recommendations, ...additional];
    }
    
    res.json({
      success: true,
      recommendations,
      count: recommendations.length,
      basedOn: preferredSubjects.length > 0 ? 'Your study preferences' : 'Popular resources'
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recommendations'
    });
  }
};

exports.getTrendingResources = async (req, res) => {
  try {
    const { period = 'week', limit = 10 } = req.query;
    
    let startDate = new Date();
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    // In a real app, you might want to track views/downloads per period
    // For now, we'll use overall popularity with some randomness for demo
    
    const trendingResources = await Resource.find({
      isPublic: true,
      createdAt: { $gte: startDate }
    })
    .populate('uploadedBy', 'name email')
    .sort({ 
      downloads: -1,
      averageRating: -1,
      createdAt: -1 
    })
    .limit(parseInt(limit));
    
    // Calculate trend score (simplified)
    const resourcesWithTrend = trendingResources.map(resource => ({
      ...resource.toObject(),
      trendScore: calculateTrendScore(resource, period)
    }));
    
    // Sort by trend score
    resourcesWithTrend.sort((a, b) => b.trendScore - a.trendScore);
    
    res.json({
      success: true,
      resources: resourcesWithTrend,
      period,
      count: resourcesWithTrend.length,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error('Get trending resources error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch trending resources'
    });
  }
};

// Helper function to calculate trend score
const calculateTrendScore = (resource, period) => {
  // Simplified trend calculation
  // In a real app, you would consider downloads/views per time period
  const baseScore = resource.downloads || 0;
  const ratingBonus = (resource.averageRating || 0) * 10;
  const recencyBonus = period === 'day' ? 50 : period === 'week' ? 30 : 10;
  
  return baseScore + ratingBonus + recencyBonus + Math.random() * 20;
};

// Additional useful resource functions

exports.getBookmarkedResources = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate({
        path: 'bookmarkedResources',
        populate: {
          path: 'uploadedBy',
          select: 'name email'
        }
      });
    
    if (!user || !user.bookmarkedResources) {
      return res.json({
        success: true,
        resources: [],
        count: 0
      });
    }
    
    res.json({
      success: true,
      resources: user.bookmarkedResources,
      count: user.bookmarkedResources.length
    });
  } catch (error) {
    console.error('Get bookmarked resources error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookmarked resources'
    });
  }
};

exports.likeComment = async (req, res) => {
  try {
    const { resourceId, commentId } = req.params;
    
    const resource = await Resource.findById(resourceId);
    
    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }
    
    // Find the comment (could be in replies too)
    let comment = resource.comments.id(commentId);
    let isReply = false;
    
    // If not found in top-level comments, check replies
    if (!comment) {
      for (const topComment of resource.comments) {
        if (topComment.replies) {
          const reply = topComment.replies.id(commentId);
          if (reply) {
            comment = reply;
            isReply = true;
            break;
          }
        }
      }
    }
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Comment not found'
      });
    }
    
    // Toggle like
    const userId = req.userId.toString();
    const likeIndex = comment.likedBy.indexOf(userId);
    
    if (likeIndex === -1) {
      // Like the comment
      comment.likedBy.push(userId);
      comment.likes += 1;
    } else {
      // Unlike the comment
      comment.likedBy.splice(likeIndex, 1);
      comment.likes -= 1;
    }
    
    await resource.save();
    
    res.json({
      success: true,
      likes: comment.likes,
      isLiked: likeIndex === -1, // If it wasn't liked before, now it is
      message: likeIndex === -1 ? 'Comment liked' : 'Comment unliked'
    });
  } catch (error) {
    console.error('Like comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like comment'
    });
  }
};