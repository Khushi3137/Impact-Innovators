const Flashcard = require('../models/Flashcard');

exports.createFlashcard = async (req, res) => {
  try {
    const flashcardData = {
      ...req.body,
      userId: req.userId
    };
    
    const flashcard = new Flashcard(flashcardData);
    await flashcard.save();
    
    res.status(201).json({
      success: true,
      flashcard,
      message: 'Flashcard created successfully'
    });
  } catch (error) {
    console.error('Create flashcard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create flashcard'
    });
  }
};

exports.bulkCreateFlashcards = async (req, res) => {
  try {
    const { flashcards } = req.body;
    
    const flashcardsWithUserId = flashcards.map(flashcard => ({
      ...flashcard,
      userId: req.userId
    }));
    
    const createdFlashcards = await Flashcard.insertMany(flashcardsWithUserId);
    
    res.status(201).json({
      success: true,
      flashcards: createdFlashcards,
      count: createdFlashcards.length,
      message: 'Flashcards created successfully'
    });
  } catch (error) {
    console.error('Bulk create flashcards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create flashcards'
    });
  }
};

exports.getFlashcards = async (req, res) => {
  try {
    const { subject, difficulty, tags, limit = 50, page = 1, review = false } = req.query;
    
    const filter = { userId: req.userId };
    
    if (subject) filter.subject = subject;
    if (difficulty) filter.difficulty = difficulty;
    if (tags) filter.tags = { $in: tags.split(',') };
    
    if (review) {
      filter.nextReviewDate = { $lte: new Date() };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const flashcards = await Flashcard.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ nextReviewDate: 1, createdAt: -1 });
    
    const total = await Flashcard.countDocuments(filter);
    
    // Calculate review statistics
    const dueForReview = await Flashcard.countDocuments({
      ...filter,
      nextReviewDate: { $lte: new Date() }
    });
    
    const easyCount = await Flashcard.countDocuments({ ...filter, difficulty: 'easy' });
    const mediumCount = await Flashcard.countDocuments({ ...filter, difficulty: 'medium' });
    const hardCount = await Flashcard.countDocuments({ ...filter, difficulty: 'hard' });
    
    res.json({
      success: true,
      flashcards,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      stats: {
        total,
        dueForReview,
        byDifficulty: {
          easy: easyCount,
          medium: mediumCount,
          hard: hardCount
        }
      }
    });
  } catch (error) {
    console.error('Get flashcards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flashcards'
    });
  }
};

exports.updateFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const flashcard = await Flashcard.findOneAndUpdate(
      { _id: id, userId: req.userId },
      { $set: updates },
      { new: true, runValidators: true }
    );
    
    if (!flashcard) {
      return res.status(404).json({
        success: false,
        message: 'Flashcard not found'
      });
    }
    
    res.json({
      success: true,
      flashcard,
      message: 'Flashcard updated successfully'
    });
  } catch (error) {
    console.error('Update flashcard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update flashcard'
    });
  }
};

exports.reviewFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    const { performance } = req.body; // 0-5 scale (0: forgot, 5: perfect)
    
    const flashcard = await Flashcard.findOne({ _id: id, userId: req.userId });
    
    if (!flashcard) {
      return res.status(404).json({
        success: false,
        message: 'Flashcard not found'
      });
    }
    
    // Add review record
    flashcard.reviews.push({
      date: new Date(),
      performance: Math.min(5, Math.max(0, performance))
    });
    
    // Update spaced repetition algorithm (SM-2 like)
    if (performance >= 3) {
      // Good performance
      if (flashcard.interval === 1) {
        flashcard.interval = 6;
      } else {
        flashcard.interval = Math.round(flashcard.interval * flashcard.easeFactor);
      }
      
      // Adjust ease factor
      flashcard.easeFactor += 0.1 - (5 - performance) * (0.08 + (5 - performance) * 0.02);
      flashcard.easeFactor = Math.max(1.3, flashcard.easeFactor);
    } else {
      // Poor performance
      flashcard.interval = 1;
      flashcard.easeFactor = Math.max(1.3, flashcard.easeFactor - 0.2);
    }
    
    // Set next review date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + flashcard.interval);
    flashcard.nextReviewDate = nextReview;
    
    // Update difficulty based on performance history
    const recentReviews = flashcard.reviews.slice(-5);
    const avgPerformance = recentReviews.reduce((sum, r) => sum + r.performance, 0) / recentReviews.length;
    
    if (avgPerformance >= 4) {
      flashcard.difficulty = 'easy';
    } else if (avgPerformance >= 2.5) {
      flashcard.difficulty = 'medium';
    } else {
      flashcard.difficulty = 'hard';
    }
    
    await flashcard.save();
    
    res.json({
      success: true,
      flashcard,
      nextReviewDate: flashcard.nextReviewDate,
      message: 'Review recorded successfully'
    });
  } catch (error) {
    console.error('Review flashcard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record review'
    });
  }
};

exports.deleteFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    
    const flashcard = await Flashcard.findOneAndDelete({ _id: id, userId: req.userId });
    
    if (!flashcard) {
      return res.status(404).json({
        success: false,
        message: 'Flashcard not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Flashcard deleted successfully'
    });
  } catch (error) {
    console.error('Delete flashcard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete flashcard'
    });
  }
};

exports.getFlashcardStats = async (req, res) => {
  try {
    const userId = req.userId;
    
    // Get today's date at midnight
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get all flashcards
    const allFlashcards = await Flashcard.find({ userId });
    
    // Calculate statistics
    const total = allFlashcards.length;
    const dueForReview = allFlashcards.filter(f => f.nextReviewDate <= new Date()).length;
    
    // Group by subject
    const bySubject = {};
    allFlashcards.forEach(card => {
      if (!bySubject[card.subject]) {
        bySubject[card.subject] = {
          total: 0,
          easy: 0,
          medium: 0,
          hard: 0,
          due: 0
        };
      }
      bySubject[card.subject].total++;
      bySubject[card.subject][card.difficulty]++;
      if (card.nextReviewDate <= new Date()) {
        bySubject[card.subject].due++;
      }
    });
    
    // Calculate mastery score
    const masteryScore = total > 0 ? 
      (allFlashcards.filter(card => 
        card.reviews.length >= 3 && 
        card.reviews.slice(-3).every(r => r.performance >= 4)
      ).length / total) * 100 : 0;
    
    // Get recent reviews
    const recentReviews = [];
    allFlashcards.forEach(card => {
      if (card.reviews.length > 0) {
        const latestReview = card.reviews[card.reviews.length - 1];
        if (latestReview.date >= today) {
          recentReviews.push({
            cardId: card._id,
            question: card.question,
            performance: latestReview.performance,
            date: latestReview.date
          });
        }
      }
    });
    
    // Sort recent reviews by date
    recentReviews.sort((a, b) => b.date - a.date);
    
    res.json({
      success: true,
      stats: {
        total,
        dueForReview,
        bySubject,
        masteryScore,
        recentReviews: recentReviews.slice(0, 10),
        averageReviewsPerCard: total > 0 ? 
          allFlashcards.reduce((sum, card) => sum + card.reviews.length, 0) / total : 0
      }
    });
  } catch (error) {
    console.error('Get flashcard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flashcard statistics'
    });
  }
};

exports.importFlashcards = async (req, res) => {
  try {
    const { format, data } = req.body;
    
    if (format === 'csv' && data) {
      // Parse CSV data (simplified)
      const lines = data.split('\n');
      const headers = lines[0].split(',');
      const flashcards = [];
      
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',');
        if (values.length >= 2) {
          flashcards.push({
            question: values[0],
            answer: values[1],
            subject: values[2] || 'General',
            difficulty: values[3] || 'medium',
            tags: values[4] ? values[4].split(';') : [],
            userId: req.userId
          });
        }
      }
      
      const created = await Flashcard.insertMany(flashcards);
      
      res.json({
        success: true,
        count: created.length,
        message: `Imported ${created.length} flashcards successfully`
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported import format'
      });
    }
  } catch (error) {
    console.error('Import flashcards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import flashcards'
    });
  }
};

// Add these missing functions to your flashcardController.js

exports.getFlashcard = async (req, res) => {
  try {
    const { id } = req.params;
    
    const flashcard = await Flashcard.findOne({
      _id: id,
      userId: req.userId
    });
    
    if (!flashcard) {
      return res.status(404).json({
        success: false,
        message: 'Flashcard not found'
      });
    }
    
    res.json({
      success: true,
      flashcard
    });
  } catch (error) {
    console.error('Get flashcard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flashcard'
    });
  }
};

exports.getDueFlashcards = async (req, res) => {
  try {
    const { subject, difficulty, limit = 20 } = req.query;
    
    const filter = {
      userId: req.userId,
      nextReviewDate: { $lte: new Date() }
    };
    
    if (subject) filter.subject = subject;
    if (difficulty) filter.difficulty = difficulty;
    
    const flashcards = await Flashcard.find(filter)
      .sort({ nextReviewDate: 1, difficulty: 1 })
      .limit(parseInt(limit));
    
    const totalDue = await Flashcard.countDocuments(filter);
    
    res.json({
      success: true,
      flashcards,
      count: flashcards.length,
      totalDue,
      subject: subject || 'all',
      difficulty: difficulty || 'all'
    });
  } catch (error) {
    console.error('Get due flashcards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch due flashcards'
    });
  }
};

exports.startReviewSession = async (req, res) => {
  try {
    const { subject, limit = 20, sessionType = 'spaced' } = req.body;
    
    const filter = {
      userId: req.userId
    };
    
    if (subject) filter.subject = subject;
    
    // Get flashcards based on session type
    let flashcards;
    if (sessionType === 'spaced') {
      // Spaced repetition: get due cards
      filter.nextReviewDate = { $lte: new Date() };
      flashcards = await Flashcard.find(filter)
        .sort({ nextReviewDate: 1 })
        .limit(parseInt(limit));
    } else if (sessionType === 'new') {
      // New cards: cards with 0 or 1 reviews
      flashcards = await Flashcard.find({
        ...filter,
        $or: [
          { reviews: { $size: 0 } },
          { reviews: { $size: 1 } }
        ]
      })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    } else if (sessionType === 'difficult') {
      // Difficult cards: cards with difficulty 'hard'
      filter.difficulty = 'hard';
      flashcards = await Flashcard.find(filter)
        .sort({ nextReviewDate: 1 })
        .limit(parseInt(limit));
    } else {
      // Mixed: all cards
      flashcards = await Flashcard.find(filter)
        .sort({ nextReviewDate: 1 })
        .limit(parseInt(limit));
    }
    
    // Create session record (in a real app, you'd save this to a ReviewSession model)
    const session = {
      id: 'review-session-' + Date.now(),
      userId: req.userId,
      startTime: new Date(),
      flashcards: flashcards.map(card => card._id),
      sessionType,
      subject: subject || 'all',
      totalCards: flashcards.length
    };
    
    res.json({
      success: true,
      session,
      flashcards,
      message: `Review session started with ${flashcards.length} cards`
    });
  } catch (error) {
    console.error('Start review session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start review session'
    });
  }
};

exports.endReviewSession = async (req, res) => {
  try {
    const { sessionId, reviewedCards, totalTime, averagePerformance } = req.body;
    
    // In a real app, you would update the ReviewSession model
    // For now, return a demo response
    
    res.json({
      success: true,
      session: {
        id: sessionId || 'review-session-' + Date.now(),
        endTime: new Date(),
        reviewedCards: reviewedCards || [],
        totalTime: totalTime || 0, // in minutes
        averagePerformance: averagePerformance || 0,
        status: 'completed'
      },
      message: 'Review session completed successfully',
      stats: {
        cardsReviewed: reviewedCards?.length || 0,
        timeSpent: totalTime || 0,
        performance: averagePerformance || 0
      }
    });
  } catch (error) {
    console.error('End review session error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end review session'
    });
  }
};

exports.exportFlashcards = async (req, res) => {
  try {
    const { format = 'csv', subject } = req.query;
    
    const filter = { userId: req.userId };
    if (subject) filter.subject = subject;
    
    const flashcards = await Flashcard.find(filter)
      .sort({ subject: 1, difficulty: 1, nextReviewDate: 1 });
    
    if (format === 'csv') {
      // Convert to CSV
      const headers = ['Question', 'Answer', 'Subject', 'Difficulty', 'Tags', 'Next Review', 'Reviews Count'];
      const csvRows = [headers.join(',')];
      
      flashcards.forEach(card => {
        const row = [
          `"${card.question.replace(/"/g, '""')}"`,
          `"${card.answer.replace(/"/g, '""')}"`,
          `"${card.subject}"`,
          `"${card.difficulty}"`,
          `"${card.tags.join(';')}"`,
          `"${card.nextReviewDate.toISOString().split('T')[0]}"`,
          card.reviews.length
        ];
        csvRows.push(row.join(','));
      });
      
      const csvContent = csvRows.join('\n');
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=flashcards-${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csvContent);
      
    } else if (format === 'json') {
      // Convert to JSON
      const jsonData = flashcards.map(card => ({
        question: card.question,
        answer: card.answer,
        subject: card.subject,
        difficulty: card.difficulty,
        tags: card.tags,
        nextReviewDate: card.nextReviewDate,
        reviewsCount: card.reviews.length
      }));
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=flashcards-${new Date().toISOString().split('T')[0]}.json`);
      res.json(jsonData);
      
    } else {
      res.status(400).json({
        success: false,
        message: 'Unsupported export format. Use "csv" or "json".'
      });
    }
  } catch (error) {
    console.error('Export flashcards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export flashcards'
    });
  }
};

// Additional useful flashcard functions

exports.getFlashcardMetrics = async (req, res) => {
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
    
    // Get all flashcards for the user
    const flashcards = await Flashcard.find({ userId: req.userId });
    
    // Calculate various metrics
    const totalCards = flashcards.length;
    const totalReviews = flashcards.reduce((sum, card) => sum + card.reviews.length, 0);
    
    // Reviews in the selected period
    const recentReviews = flashcards.flatMap(card => 
      card.reviews
        .filter(review => review.date >= startDate)
        .map(review => ({ ...review.toObject(), cardId: card._id, subject: card.subject }))
    );
    
    // Group by day for chart data
    const reviewsByDay = {};
    recentReviews.forEach(review => {
      const day = review.date.toISOString().split('T')[0];
      if (!reviewsByDay[day]) {
        reviewsByDay[day] = { count: 0, totalPerformance: 0 };
      }
      reviewsByDay[day].count++;
      reviewsByDay[day].totalPerformance += review.performance;
    });
    
    const chartData = Object.entries(reviewsByDay)
      .map(([date, data]) => ({
        date,
        reviews: data.count,
        avgPerformance: data.count > 0 ? data.totalPerformance / data.count : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    
    res.json({
      success: true,
      metrics: {
        totalCards,
        totalReviews,
        avgReviewsPerCard: totalCards > 0 ? totalReviews / totalCards : 0,
        recentReviews: recentReviews.length,
        avgRecentPerformance: recentReviews.length > 0 ? 
          recentReviews.reduce((sum, r) => sum + r.performance, 0) / recentReviews.length : 0,
        period,
        chartData
      }
    });
  } catch (error) {
    console.error('Get flashcard metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch flashcard metrics'
    });
  }
};

exports.searchFlashcards = async (req, res) => {
  try {
    const { query, subject, difficulty, tags, limit = 20 } = req.query;
    
    const filter = { userId: req.userId };
    
    if (subject) filter.subject = subject;
    if (difficulty) filter.difficulty = difficulty;
    if (tags) filter.tags = { $in: tags.split(',') };
    
    if (query) {
      // Search in question and answer fields
      filter.$or = [
        { question: { $regex: query, $options: 'i' } },
        { answer: { $regex: query, $options: 'i' } },
        { explanation: { $regex: query, $options: 'i' } }
      ];
    }
    
    const flashcards = await Flashcard.find(filter)
      .sort({ nextReviewDate: 1 })
      .limit(parseInt(limit));
    
    res.json({
      success: true,
      flashcards,
      count: flashcards.length,
      query: query || null,
      filters: { subject, difficulty, tags }
    });
  } catch (error) {
    console.error('Search flashcards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search flashcards'
    });
  }
};

exports.resetFlashcardProgress = async (req, res) => {
  try {
    const { flashcardId } = req.params;
    
    const flashcard = await Flashcard.findOne({
      _id: flashcardId,
      userId: req.userId
    });
    
    if (!flashcard) {
      return res.status(404).json({
        success: false,
        message: 'Flashcard not found'
      });
    }
    
    // Reset spaced repetition data
    flashcard.reviews = [];
    flashcard.interval = 1;
    flashcard.easeFactor = 2.5;
    flashcard.nextReviewDate = new Date();
    flashcard.difficulty = 'medium';
    
    await flashcard.save();
    
    res.json({
      success: true,
      flashcard,
      message: 'Flashcard progress reset successfully'
    });
  } catch (error) {
    console.error('Reset flashcard progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reset flashcard progress'
    });
  }
};