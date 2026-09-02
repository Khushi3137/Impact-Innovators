const cron = require('node-cron');
const Task = require('../models/Task');
const User = require('../models/User');
const Progress = require('../models/Progress');
const StudySession = require('../models/StudySession');
const { sendStudyReminder, sendWeeklyReport } = require('./emailService');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiPro = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

class Scheduler {
  constructor() {
    this.tasks = [];
    this.initScheduledJobs();
  }

  initScheduledJobs() {
    // Check for due tasks every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      await this.checkDueTasks();
    });

    // Send daily study reminders at 8 AM
    cron.schedule('0 8 * * *', async () => {
      await this.sendDailyReminders();
    });

    // Generate weekly reports on Sunday at 9 PM
    cron.schedule('0 21 * * 0', async () => {
      await this.generateWeeklyReports();
    });

    // Clean up old data every day at 2 AM
    cron.schedule('0 2 * * *', async () => {
      await this.cleanupOldData();
    });

    // Update progress statistics every hour
    cron.schedule('0 * * * *', async () => {
      await this.updateProgressStats();
    });

    console.log('Scheduler initialized with scheduled jobs');
  }

  async checkDueTasks() {
    try {
      const now = new Date();
      const reminderTime = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

      const tasks = await Task.find({
        dueDate: { $lte: reminderTime, $gte: now },
        status: { $nin: ['completed', 'overdue'] },
        'reminders.sent': false
      }).populate('userId', 'email name');

      for (const task of tasks) {
        // Send reminder
        await sendStudyReminder(task.userId, task);
        
        // Mark reminder as sent
        task.reminders.push({
          time: now,
          sent: true
        });
        
        await task.save();
        
        console.log(`Sent reminder for task: ${task.title} to ${task.userId.email}`);
      }
    } catch (error) {
      console.error('Error checking due tasks:', error);
    }
  }

  async sendDailyReminders() {
    try {
      // Get users with study preferences
      const users = await User.find({
        'studyPreferences.dailyGoalHours': { $gt: 0 }
      });

      for (const user of users) {
        // Check yesterday's study time
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        const today = new Date(yesterday);
        today.setDate(today.getDate() + 1);

        const sessions = await StudySession.find({
          userId: user._id,
          startTime: { $gte: yesterday, $lt: today }
        });

        const totalStudyTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        const goalTime = user.studyPreferences.dailyGoalHours * 60;

        // Only send reminder if study time was less than goal
        if (totalStudyTime < goalTime) {
          const tasks = await Task.find({
            userId: user._id,
            dueDate: { $gte: today, $lte: new Date(today.getTime() + 24 * 60 * 60 * 1000) },
            status: { $nin: ['completed', 'overdue'] }
          });

          // Generate personalized study suggestion using Gemini
          let suggestion = '';
          try {
            const prompt = `
              Generate a brief, motivating daily study reminder for a college student.
              Yesterday they studied for ${Math.round(totalStudyTime / 60)} hours (goal: ${user.studyPreferences.dailyGoalHours} hours).
              Today they have ${tasks.length} tasks due.
              Subject focus: ${user.studyPreferences.preferredSubjects?.join(', ') || 'various subjects'}
              Keep it encouraging and actionable (max 2 sentences).
            `;

            const result = await geminiPro.generateContent(prompt);
            const response = await result.response;
            suggestion = response.text();
          } catch (aiError) {
            console.error('Error generating AI suggestion:', aiError);
            suggestion = 'Remember to focus on your studies today! You have tasks waiting for your attention.';
          }

          // Send email
          const mailOptions = {
            from: `"Student Assistant" <${process.env.SMTP_USER}>`,
            to: user.email,
            subject: 'Your Daily Study Plan 📚',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1976d2;">Good Morning, ${user.name}! ☀️</h2>
                <p>Here's your study plan for today:</p>
                
                <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">📊 Yesterday's Progress</h3>
                  <p>Study time: <strong>${Math.round(totalStudyTime / 60)} hours</strong> (Goal: ${user.studyPreferences.dailyGoalHours} hours)</p>
                  ${totalStudyTime < goalTime ? 
                    `<p style="color: #d32f2f;">You were ${Math.round((goalTime - totalStudyTime) / 60)} hours short of your goal. Let's do better today! 💪</p>` : 
                    '<p style="color: #388e3c;">Great job meeting your study goal! 🎉</p>'
                  }
                </div>
                
                ${tasks.length > 0 ? `
                <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">📝 Today's Tasks (${tasks.length})</h3>
                  <ul>
                    ${tasks.slice(0, 5).map(task => `
                      <li><strong>${task.title}</strong> - ${task.subject} (Due: ${new Date(task.dueDate).toLocaleTimeString()})</li>
                    `).join('')}
                  </ul>
                  ${tasks.length > 5 ? `<p>... and ${tasks.length - 5} more tasks</p>` : ''}
                </div>
                ` : ''}
                
                <div style="background-color: #f3e5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                  <h3 style="margin-top: 0;">💡 Daily Tip</h3>
                  <p>${suggestion}</p>
                </div>
                
                <p>Remember to take regular breaks and stay hydrated! 💧</p>
                <p>You've got this! 🚀</p>
                <p>Best regards,<br>The Student Assistant Team</p>
              </div>
            `
          };

          // In production, you would send the email here
          console.log(`Would send daily reminder to: ${user.email}`);
        }
      }
    } catch (error) {
      console.error('Error sending daily reminders:', error);
    }
  }

  async generateWeeklyReports() {
    try {
      const users = await User.find({ isVerified: true });

      for (const user of users) {
        // Calculate start and end of week
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - 7);
        startOfWeek.setHours(0, 0, 0, 0);

        // Get weekly stats
        const sessions = await StudySession.find({
          userId: user._id,
          startTime: { $gte: startOfWeek }
        });

        const tasks = await Task.find({
          userId: user._id,
          updatedAt: { $gte: startOfWeek },
          status: 'completed'
        });

        const progress = await Progress.find({
          userId: user._id,
          date: { $gte: startOfWeek }
        });

        const totalStudyTime = sessions.reduce((sum, session) => sum + (session.duration || 0), 0);
        const tasksCompleted = tasks.length;
        const flashcardsReviewed = progress.reduce((sum, p) => sum + (p.metrics?.flashcardsReviewed || 0), 0);

        // Calculate streak
        const studyDays = [...new Set(sessions.map(s => s.startTime.toISOString().split('T')[0]))];
        const streak = this.calculateStreak(studyDays);

        // Generate AI insights
        let insights = [];
        try {
          const prompt = `
            Analyze this student's weekly study performance and provide 2-3 brief, constructive insights:
            - Total study time: ${Math.round(totalStudyTime / 60)} hours
            - Tasks completed: ${tasksCompleted}
            - Study days this week: ${studyDays.length}
            - Subjects studied: ${[...new Set(sessions.map(s => s.subject))].join(', ')}
            
            Focus on:
            1. What they did well
            2. One area for improvement
            3. A practical tip for next week
            
            Keep each insight to one sentence. Format as bullet points.
          `;

          const result = await geminiPro.generateContent(prompt);
          const response = await result.response;
          insights = response.text().split('\n').filter(line => line.trim()).slice(0, 3);
        } catch (aiError) {
          console.error('Error generating insights:', aiError);
          insights = [
            'You maintained consistent study sessions this week.',
            'Consider varying your study subjects for better retention.',
            'Try the Pomodoro technique for improved focus next week.'
          ];
        }

        const stats = {
          totalStudyTime: Math.round(totalStudyTime / 60),
          tasksCompleted,
          flashcardsReviewed,
          streak,
          studyDays: studyDays.length,
          insights
        };

        // Send weekly report
        await sendWeeklyReport(user, stats);
        console.log(`Generated weekly report for: ${user.email}`);
      }
    } catch (error) {
      console.error('Error generating weekly reports:', error);
    }
  }

  async cleanupOldData() {
    try {
      // Delete study sessions older than 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const deletedSessions = await StudySession.deleteMany({
        startTime: { $lt: ninetyDaysAgo }
      });

      // Delete completed tasks older than 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedTasks = await Task.deleteMany({
        status: 'completed',
        completedAt: { $lt: thirtyDaysAgo }
      });

      console.log(`Cleaned up: ${deletedSessions.deletedCount} sessions, ${deletedTasks.deletedCount} tasks`);
    } catch (error) {
      console.error('Error cleaning up old data:', error);
    }
  }

  async updateProgressStats() {
    try {
      // Update user's overall progress statistics
      const users = await User.find();

      for (const user of users) {
        // Calculate current streak
        const sessions = await StudySession.find({
          userId: user._id
        }).sort({ startTime: -1 }).limit(100);

        const dates = [...new Set(sessions.map(s => s.startTime.toISOString().split('T')[0]))];
        const streak = this.calculateStreak(dates);

        // Update user's progress metrics
        await User.findByIdAndUpdate(user._id, {
          $set: {
            'progressMetrics.streak': streak,
            'progressMetrics.totalStudyHours': sessions.reduce((sum, s) => sum + (s.duration || 0), 0) / 60,
            'progressMetrics.lastUpdated': new Date()
          }
        });
      }

      console.log('Updated progress stats for all users');
    } catch (error) {
      console.error('Error updating progress stats:', error);
    }
  }

  calculateStreak(dates) {
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
  }
}

module.exports = Scheduler;