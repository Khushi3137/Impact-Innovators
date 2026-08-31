const Quiz = require('../models/Quiz');

exports.getQuizzes = async (req, res) => {
  try {
    const quizzes = await Quiz.find({ userId: req.userId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .limit(100);

    res.json({
      success: true,
      quizzes
    });
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch quizzes'
    });
  }
};

exports.recordQuizAttempt = async (req, res) => {
  try {
    const { id } = req.params;
    const { score, total, answers = {} } = req.body;

    const quiz = await Quiz.findOne({ _id: id, userId: req.userId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    quiz.attempts.push({
      score: Math.max(0, Number(score) || 0),
      total: Math.max(0, Number(total) || quiz.questions.length),
      answers
    });

    await quiz.save();

    res.json({
      success: true,
      quiz,
      message: 'Quiz score saved'
    });
  } catch (error) {
    console.error('Record quiz attempt error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save quiz score'
    });
  }
};

exports.deleteQuiz = async (req, res) => {
  try {
    const { id } = req.params;
    const quiz = await Quiz.findOneAndDelete({ _id: id, userId: req.userId });

    if (!quiz) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    res.json({
      success: true,
      message: 'Quiz deleted'
    });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete quiz'
    });
  }
};
