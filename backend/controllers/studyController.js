const StudySession = require('../models/StudySession');
const Task = require('../models/Task');
const Progress = require('../models/Progress');
const Flashcard = require('../models/Flashcard');

exports.startStudySession = async (req, res) => {
  try {
    const { subject, topic, goals } = req.body;
    
    const session = new StudySession({
      userId: req.userId,
      subject,
      topic,
      startTime: new Date(),
      goals: goals || []
    });
    
    await session.save();
    
    res.json({
      success: true,
      session,
      message: 'Study session started'
    });
  } catch (error) {
    console.error('Start study session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start study session'
    });
  }
};

exports.endStudySession = async (req, res) => {
  try {
    const { sessionId, productivityScore, notes, goalsAchieved, distractions } = req.body;
    
    const session = await StudySession.findOne({
      _id: sessionId,
      userId: req.userId
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }
    
    const endTime = new Date();
    const duration = Math.round((endTime - session.startTime) / (1000 * 60)); // in minutes
    
    session.endTime = endTime;
    session.duration = duration;
    session.productivityScore = productivityScore;
    session.notes = notes;
    session.goalsAchieved = goalsAchieved || [];
    session.distractions = distractions || [];
    
    await session.save();
    
    // Update progress
    await updateDailyProgress(req.userId, session.subject, duration);
    
    res.json({
      success: true,
      session,
      message: 'Study session ended'
    });
  } catch (error) {
    console.error('End study session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end study session'
    });
  }
};

exports.getStudySessions = async (req, res) => {
  try {
    const { startDate, endDate, subject, limit = 50 } = req.query;
    
    const filter = {
      userId: req.userId,
      notes: { $not: /^Pomodoro session stopped early/ }
    };
    
    if (startDate || endDate) {
      filter.startTime = {};
      if (startDate) filter.startTime.$gte = new Date(startDate);
      if (endDate) filter.startTime.$lte = new Date(endDate);
    }
    
    if (subject) {
      filter.subject = subject;
    }
    
    const sessions = await StudySession.find(filter)
      .sort({ startTime: -1 })
      .limit(parseInt(limit));
    
    const stats = await calculateStudyStats(req.userId, filter);
    
    res.json({
      success: true,
      sessions,
      stats
    });
  } catch (error) {
    console.error('Get study sessions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study sessions'
    });
  }
};

exports.createTask = async (req, res) => {
  try {
    const taskData = {
      ...req.body,
      userId: req.userId
    };
    
    const task = new Task(taskData);
    await task.save();
    
    res.status(201).json({
      success: true,
      task,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Create task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create task'
    });
  }
};

exports.updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    const updates = req.body;
    
    const task = await Task.findOneAndUpdate(
      { _id: taskId, userId: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    // If task is marked as completed, set completedAt
    if (updates.status === 'completed' && !task.completedAt) {
      task.completedAt = new Date();
      await task.save();
    }
    
    res.json({
      success: true,
      task,
      message: 'Task updated successfully'
    });
  } catch (error) {
    console.error('Update task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update task'
    });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const { status, subject, priority, dueDate, sortBy = 'dueDate', sortOrder = 'asc' } = req.query;
    
    const filter = { userId: req.userId };
    
    if (status) filter.status = status;
    if (subject) filter.subject = subject;
    if (priority) filter.priority = priority;
    if (dueDate) filter.dueDate = { $lte: new Date(dueDate) };
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const tasks = await Task.find(filter).sort(sort);
    
    // Calculate task statistics
    const total = tasks.length;
    const completed = tasks.filter(t => t.status === 'completed').length;
    const overdue = tasks.filter(t => t.status === 'overdue').length;
    const inProgress = tasks.filter(t => t.status === 'in-progress').length;
    
    res.json({
      success: true,
      tasks,
      stats: {
        total,
        completed,
        overdue,
        inProgress,
        completionRate: total > 0 ? (completed / total) * 100 : 0
      }
    });
  } catch (error) {
    console.error('Get tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tasks'
    });
  }
};

exports.getProgress = async (req, res) => {
  try {
    const { period = 'week', subject } = req.query;
    
    let startDate = new Date();
    const endDate = new Date();
    
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
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(startDate.getDate() - 7);
    }
    
    const filter = {
      userId: req.userId,
      date: { $gte: startDate, $lte: endDate }
    };
    
    if (subject) {
      filter.subject = subject;
    }
    
    const progressData = await Progress.find(filter).sort({ date: 1 });
    
    // Calculate overall statistics
    const overallStats = await calculateOverallProgress(req.userId, startDate, endDate);
    
    res.json({
      success: true,
      progress: progressData,
      overallStats,
      period
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch progress data'
    });
  }
};

// Helper functions
const updateDailyProgress = async (userId, subject, studyTime) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let progress = await Progress.findOne({
      userId,
      subject,
      date: { $gte: today, $lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) }
    });
    
    if (!progress) {
      progress = new Progress({
        userId,
        subject,
        date: today,
        metrics: {
          studyTime: 0,
          tasksCompleted: 0,
          flashcardsReviewed: 0
        }
      });
    }
    
    progress.metrics.studyTime += studyTime;
    await progress.save();
  } catch (error) {
    console.error('Update daily progress error:', error);
  }
};

const calculateStudyStats = async (userId, filter) => {
  try {
    const sessions = await StudySession.find(filter);
    
    const totalSessions = sessions.length;
    const totalStudyTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    const avgSessionLength = totalSessions > 0 ? totalStudyTime / totalSessions : 0;
    const avgProductivity = sessions.filter(s => s.productivityScore)
      .reduce((sum, session) => sum + session.productivityScore, 0) / 
      (sessions.filter(s => s.productivityScore).length || 1);
    
    // Group by subject
    const bySubject = {};
    sessions.forEach(session => {
      if (!bySubject[session.subject]) {
        bySubject[session.subject] = {
          totalTime: 0,
          sessions: 0,
          avgProductivity: 0
        };
      }
      bySubject[session.subject].totalTime += session.duration || 0;
      bySubject[session.subject].sessions += 1;
      if (session.productivityScore) {
        bySubject[session.subject].avgProductivity = 
          ((bySubject[session.subject].avgProductivity || 0) + session.productivityScore) / 2;
      }
    });
    
    // Daily streak
    const dates = [...new Set(sessions.map(s => s.startTime.toISOString().split('T')[0]))];
    const streak = calculateStreak(dates);
    
    return {
      totalSessions,
      totalStudyTime,
      avgSessionLength,
      avgProductivity,
      bySubject,
      streak,
      uniqueStudyDays: dates.length
    };
  } catch (error) {
    console.error('Calculate study stats error:', error);
    return {};
  }
};

const calculateOverallProgress = async (userId, startDate, endDate) => {
  try {
    const sessions = await StudySession.find({
      userId,
      startTime: { $gte: startDate, $lte: endDate }
    });
    
    const tasks = await Task.find({
      userId,
      updatedAt: { $gte: startDate, $lte: endDate }
    });
    
    const totalStudyTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    
    // Calculate focus score (based on productivity and consistency)
    const productiveSessions = sessions.filter(s => s.productivityScore >= 7);
    const focusScore = sessions.length > 0 ? 
      (productiveSessions.length / sessions.length) * 100 : 0;
    
    return {
      totalStudyTime,
      completedTasks,
      totalTasks,
      taskCompletionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      averageDailyStudyTime: totalStudyTime / Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))),
      focusScore
    };
  } catch (error) {
    console.error('Calculate overall progress error:', error);
    return {};
  }
};

const calculateStreak = (dates) => {
  if (dates.length === 0) return 0;
  
  const sortedDates = dates.sort((a, b) => new Date(b) - new Date(a));
  let streak = 1;
  let currentDate = new Date(sortedDates[0]);
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(currentDate);
    prevDate.setDate(prevDate.getDate() - 1);
    
    const compareDate = new Date(sortedDates[i]);
    compareDate.setHours(0, 0, 0, 0);
    prevDate.setHours(0, 0, 0, 0);
    
    if (compareDate.getTime() === prevDate.getTime()) {
      streak++;
      currentDate = new Date(sortedDates[i]);
    } else {
      break;
    }
  }
  
  return streak;
};

// Add these missing functions to your studyController.js

exports.getSessionDetails = async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await StudySession.findOne({
      _id: sessionId,
      userId: req.userId
    });
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found'
      });
    }
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Get session details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session details'
    });
  }
};

exports.getTaskDetails = async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await Task.findOne({
      _id: taskId,
      userId: req.userId
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      task
    });
  } catch (error) {
    console.error('Get task details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch task details'
    });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;
    
    const task = await Task.findOneAndDelete({
      _id: taskId,
      userId: req.userId
    });
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Task deleted successfully',
      taskId
    });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete task'
    });
  }
};

exports.getStudyStats = async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    
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
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate.setMonth(startDate.getMonth() - 1);
    }
    
    const filter = {
      userId: req.userId,
      startTime: { $gte: startDate }
    };
    
    const stats = await calculateStudyStats(req.userId, filter);
    
    // Get additional statistics
    const tasks = await Task.find({
      userId: req.userId,
      createdAt: { $gte: startDate }
    });
    
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const overdueTasks = tasks.filter(t => t.status === 'overdue').length;
    
    res.json({
      success: true,
      stats: {
        ...stats,
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          overdue: overdueTasks,
          completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        },
        period,
        dateRange: {
          start: startDate,
          end: new Date()
        }
      }
    });
  } catch (error) {
    console.error('Get study stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study statistics'
    });
  }
};

exports.getDashboardData = async (req, res) => {
  try {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const sessionFilter = {
      userId: req.userId,
      startTime: { $gte: weekStart },
      notes: { $not: /^Pomodoro session stopped early/ }
    };

    const [sessions, tasks, allFlashcards, streakSessions, todaySessions] = await Promise.all([
      StudySession.find(sessionFilter).sort({ startTime: -1 }).limit(100),
      Task.find({ userId: req.userId }).sort({ dueDate: 1 }),
      Flashcard.find({ userId: req.userId }),
      StudySession.find({ userId: req.userId }).sort({ startTime: -1 }).limit(100),
      StudySession.find({
        userId: req.userId,
        startTime: { $gte: todayStart, $lt: tomorrowStart }
      })
    ]);

    const studyStats = await calculateStudyStats(req.userId, sessionFilter);
    const totalTasks = tasks.length;
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const overdueTasks = tasks.filter(task => task.status === 'overdue').length;
    const inProgressTasks = tasks.filter(task => task.status === 'in-progress').length;

    const now = new Date();
    const totalFlashcards = allFlashcards.length;
    const dueForReview = allFlashcards.filter(card => card.nextReviewDate <= now).length;
    const flashcardsBySubject = {};

    allFlashcards.forEach(card => {
      if (!flashcardsBySubject[card.subject]) {
        flashcardsBySubject[card.subject] = {
          total: 0,
          easy: 0,
          medium: 0,
          hard: 0,
          due: 0
        };
      }

      flashcardsBySubject[card.subject].total += 1;
      flashcardsBySubject[card.subject][card.difficulty] += 1;

      if (card.nextReviewDate <= now) {
        flashcardsBySubject[card.subject].due += 1;
      }
    });

    const masteryScore = totalFlashcards > 0
      ? (allFlashcards.filter(card =>
          card.reviews.length >= 3 &&
          card.reviews.slice(-3).every(review => review.performance >= 4)
        ).length / totalFlashcards) * 100
      : 0;

    const recentReviews = allFlashcards
      .flatMap(card => {
        const latestReview = card.reviews[card.reviews.length - 1];

        if (!latestReview || latestReview.date < todayStart) {
          return [];
        }

        return [{
          cardId: card._id,
          question: card.question,
          performance: latestReview.performance,
          date: latestReview.date
        }];
      })
      .sort((a, b) => b.date - a.date)
      .slice(0, 10);

    const streakDates = [...new Set(streakSessions.map(session => session.startTime.toISOString().split('T')[0]))];
    const todayKey = new Date().toISOString().split('T')[0];
    const todayTasks = tasks.filter(task => {
      if (!task.dueDate) return false;

      const dueDate = new Date(task.dueDate);
      return dueDate >= todayStart && dueDate < tomorrowStart;
    });

    res.json({
      success: true,
      studyStats: {
        ...studyStats,
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          overdue: overdueTasks,
          inProgress: inProgressTasks,
          completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        },
        period: 'week',
        dateRange: {
          start: weekStart,
          end: now
        }
      },
      sessions,
      tasks,
      taskStats: {
        total: totalTasks,
        completed: completedTasks,
        overdue: overdueTasks,
        inProgress: inProgressTasks,
        completionRate: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
      },
      flashcardStats: {
        total: totalFlashcards,
        dueForReview,
        bySubject: flashcardsBySubject,
        masteryScore,
        recentReviews,
        averageReviewsPerCard: totalFlashcards > 0
          ? allFlashcards.reduce((sum, card) => sum + card.reviews.length, 0) / totalFlashcards
          : 0
      },
      streak: {
        streak: calculateStreak(streakDates),
        hasStudiedToday: streakDates.includes(todayKey),
        totalStudyDays: streakDates.length,
        currentStreakStart: streakDates.length > 0 ? streakDates[0] : null,
        longestStreak: calculateLongestStreak(streakDates),
        dates: streakDates
      },
      today: {
        date: todayStart.toISOString().split('T')[0],
        studyTime: todaySessions.reduce((sum, session) => sum + (session.duration || 0), 0),
        sessions: todaySessions.length,
        tasks: {
          total: todayTasks.length,
          completed: todayTasks.filter(task => task.status === 'completed').length,
          pending: todayTasks.filter(task => task.status !== 'completed').length
        },
        isOnTrack: todaySessions.reduce((sum, session) => sum + (session.duration || 0), 0) >= 240
      }
    });
  } catch (error) {
    console.error('Get dashboard data error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
};

exports.getStudyStreak = async (req, res) => {
  try {
    const sessions = await StudySession.find({
      userId: req.userId
    }).sort({ startTime: -1 }).limit(100);
    
    const dates = [...new Set(sessions.map(s => s.startTime.toISOString().split('T')[0]))];
    const streak = calculateStreak(dates);
    
    // Get current streak info
    const today = new Date().toISOString().split('T')[0];
    const hasStudiedToday = dates.includes(today);
    
    res.json({
      success: true,
      streak,
      hasStudiedToday,
      totalStudyDays: dates.length,
      currentStreakStart: dates.length > 0 ? dates[0] : null,
      longestStreak: calculateLongestStreak(dates),
      dates
    });
  } catch (error) {
    console.error('Get study streak error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study streak'
    });
  }
};

// Pomodoro timer functions
exports.startPomodoro = async (req, res) => {
  try {
    const { duration = 25, subject, topic, taskId } = req.body;
    
    const session = new StudySession({
      userId: req.userId,
      subject: subject || 'General',
      topic: topic || 'Pomodoro focus session',
      startTime: new Date(),
      resources: taskId ? [{ type: 'task', url: String(taskId) }] : []
    });
    
    await session.save();
    
    res.json({
      success: true,
      session: {
        id: session._id,
        _id: session._id,
        subject: session.subject,
        topic: session.topic,
        startTime: session.startTime,
        plannedDuration: parseInt(duration),
        status: 'active',
        type: 'pomodoro'
      },
      message: `Pomodoro session started for ${duration} minutes`,
      endTime: new Date(Date.now() + duration * 60 * 1000)
    });
  } catch (error) {
    console.error('Start pomodoro error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start pomodoro session'
    });
  }
};

exports.endPomodoro = async (req, res) => {
  try {
    const { sessionId, completed = true, interruptions = 0 } = req.body;

    const session = await StudySession.findOne({
      _id: sessionId,
      userId: req.userId
    });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Study session not found'
      });
    }

    const endTime = new Date();
    const duration = Math.max(1, Math.round((endTime - session.startTime) / (1000 * 60)));

    if (!completed) {
      await StudySession.deleteOne({ _id: session._id, userId: req.userId });

      return res.json({
        success: true,
        session: null,
        message: 'Pomodoro session cancelled'
      });
    }

    session.endTime = endTime;
    session.duration = duration;
    session.productivityScore = 8;
    session.notes = 'Pomodoro session completed';
    session.distractions = interruptions ? [`${interruptions} interruptions`] : [];

    await session.save();
    await updateDailyProgress(req.userId, session.subject, duration);
    
    res.json({
      success: true,
      session,
      message: `Pomodoro session ${completed ? 'completed' : 'cancelled'}`
    });
  } catch (error) {
    console.error('End pomodoro error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end pomodoro session'
    });
  }
};

exports.getPomodoroStats = async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    
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
    
    // In a real app, you would query PomodoroSession model
    // For demo, return sample stats
    res.json({
      success: true,
      stats: {
        totalSessions: 12,
        completedSessions: 10,
        totalTime: 300, // minutes
        averageSessionLength: 25,
        focusRate: 83.3,
        favoriteTime: '14:00-16:00',
        period,
        dailyAverage: 42.8 // minutes
      },
      breakdown: [
        { day: 'Mon', sessions: 3, time: 75 },
        { day: 'Tue', sessions: 2, time: 50 },
        { day: 'Wed', sessions: 4, time: 100 },
        { day: 'Thu', sessions: 1, time: 25 },
        { day: 'Fri', sessions: 2, time: 50 }
      ]
    });
  } catch (error) {
    console.error('Get pomodoro stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pomodoro statistics'
    });
  }
};

// Additional useful functions

exports.getTodayProgress = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Today's study sessions
    const todaySessions = await StudySession.find({
      userId: req.userId,
      startTime: { $gte: today, $lt: tomorrow }
    });
    
    const totalStudyTime = todaySessions.reduce((sum, session) => sum + (session.duration || 0), 0);
    
    // Today's tasks
    const todayTasks = await Task.find({
      userId: req.userId,
      dueDate: { $gte: today, $lt: tomorrow }
    });
    
    const completedTasks = todayTasks.filter(t => t.status === 'completed').length;
    
    res.json({
      success: true,
      today: {
        date: today.toISOString().split('T')[0],
        studyTime: totalStudyTime,
        sessions: todaySessions.length,
        tasks: {
          total: todayTasks.length,
          completed: completedTasks,
          pending: todayTasks.length - completedTasks
        },
        isOnTrack: totalStudyTime >= 240 // 4 hours goal
      }
    });
  } catch (error) {
    console.error('Get today progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch today\'s progress'
    });
  }
};

exports.getStudyRecommendations = async (req, res) => {
  try {
    // Analyze study patterns and give recommendations
    const sessions = await StudySession.find({
      userId: req.userId
    }).sort({ startTime: -1 }).limit(50);
    
    const tasks = await Task.find({
      userId: req.userId,
      status: { $in: ['todo', 'in-progress'] }
    }).sort({ dueDate: 1 }).limit(10);
    
    // Simple recommendation logic
    const recommendations = [];
    
    if (sessions.length === 0) {
      recommendations.push({
        type: 'getting_started',
        message: 'Start your first study session today!',
        priority: 'high'
      });
    }
    
    const today = new Date().toISOString().split('T')[0];
    const hasStudiedToday = sessions.some(s => 
      s.startTime.toISOString().split('T')[0] === today
    );
    
    if (!hasStudiedToday) {
      recommendations.push({
        type: 'daily_study',
        message: 'Complete at least 1 study session today to maintain your streak',
        priority: 'medium'
      });
    }
    
    const upcomingTasks = tasks.filter(t => 
      t.dueDate && new Date(t.dueDate) < new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    );
    
    if (upcomingTasks.length > 0) {
      recommendations.push({
        type: 'upcoming_deadline',
        message: `You have ${upcomingTasks.length} tasks due soon`,
        priority: 'high',
        tasks: upcomingTasks.map(t => t.title)
      });
    }
    
    res.json({
      success: true,
      recommendations,
      count: recommendations.length
    });
  } catch (error) {
    console.error('Get study recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch study recommendations'
    });
  }
};

// Helper function for longest streak
const calculateLongestStreak = (dates) => {
  if (dates.length === 0) return 0;
  
  const sortedDates = dates.sort((a, b) => new Date(a) - new Date(b));
  let longestStreak = 1;
  let currentStreak = 1;
  
  for (let i = 1; i < sortedDates.length; i++) {
    const prevDate = new Date(sortedDates[i - 1]);
    const currentDate = new Date(sortedDates[i]);
    
    prevDate.setDate(prevDate.getDate() + 1);
    
    if (prevDate.toISOString().split('T')[0] === currentDate.toISOString().split('T')[0]) {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 1;
    }
  }
  
  return longestStreak;
};
