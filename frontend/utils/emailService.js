const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

exports.sendVerificationEmail = async (user, token) => {
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: `"Student Assistant" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'Verify Your Email - Student Assistant',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Welcome to Student Assistant!</h2>
        <p>Hi ${user.name},</p>
        <p>Thank you for registering. Please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Verify Email
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${verificationUrl}</p>
        <p>This link will expire in 24 hours.</p>
        <p>Best regards,<br>The Student Assistant Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Verification email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending verification email:', error);
  }
};

exports.sendPasswordResetEmail = async (user, token) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: `"Student Assistant" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'Password Reset Request - Student Assistant',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Password Reset</h2>
        <p>Hi ${user.name},</p>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetUrl}" style="background-color: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p>Or copy and paste this link in your browser:</p>
        <p style="word-break: break-all; color: #666;">${resetUrl}</p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request a password reset, you can safely ignore this email.</p>
        <p>Best regards,<br>The Student Assistant Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending password reset email:', error);
  }
};

exports.sendStudyReminder = async (user, task) => {
  const mailOptions = {
    from: `"Student Assistant" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: `Study Reminder: ${task.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Study Reminder ⏰</h2>
        <p>Hi ${user.name},</p>
        <p>This is a reminder for your upcoming study task:</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${task.title}</h3>
          ${task.description ? `<p>${task.description}</p>` : ''}
          <p><strong>Subject:</strong> ${task.subject}</p>
          <p><strong>Due:</strong> ${new Date(task.dueDate).toLocaleString()}</p>
          <p><strong>Priority:</strong> <span style="color: ${task.priority === 'high' ? '#d32f2f' : task.priority === 'medium' ? '#f57c00' : '#388e3c'}">${task.priority}</span></p>
        </div>
        <p>Remember to take breaks and stay hydrated! 💧</p>
        <p>You can do this! 💪</p>
        <p>Best regards,<br>The Student Assistant Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Study reminder sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending study reminder:', error);
  }
};

exports.sendWeeklyReport = async (user, stats) => {
  const mailOptions = {
    from: `"Student Assistant" <${process.env.SMTP_USER}>`,
    to: user.email,
    subject: 'Your Weekly Study Report 📊',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #1976d2;">Weekly Study Report</h2>
        <p>Hi ${user.name},</p>
        <p>Here's your study performance for this week:</p>
        
        <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">📈 Weekly Stats</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #1976d2;">${stats.totalStudyTime}</div>
              <div style="font-size: 12px; color: #666;">Minutes Studied</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #388e3c;">${stats.tasksCompleted}</div>
              <div style="font-size: 12px; color: #666;">Tasks Completed</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #f57c00;">${stats.flashcardsReviewed}</div>
              <div style="font-size: 12px; color: #666;">Flashcards Reviewed</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 24px; font-weight: bold; color: #7b1fa2;">${stats.streak}</div>
              <div style="font-size: 12px; color: #666;">Day Streak</div>
            </div>
          </div>
        </div>
        
        ${stats.insights && stats.insights.length > 0 ? `
        <div style="background-color: #e3f2fd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="margin-top: 0;">💡 AI Insights</h3>
          <ul style="margin-bottom: 0;">
            ${stats.insights.map(insight => `<li>${insight}</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        <p>Keep up the great work! 🎯</p>
        <p>Best regards,<br>The Student Assistant Team</p>
      </div>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Weekly report sent to ${user.email}`);
  } catch (error) {
    console.error('Error sending weekly report:', error);
  }
};