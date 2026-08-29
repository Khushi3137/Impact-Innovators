const { google } = require('googleapis');

const getOAuth2Client = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/calendar/callback'
  );
};

const getCalendarClient = (credentials) => {
  const oAuth2Client = getOAuth2Client();
  if (credentials) {
    oAuth2Client.setCredentials(credentials);
  }
  return google.calendar({ version: 'v3', auth: oAuth2Client });
};

// Scopes for different Google APIs
const SCOPES = {
  calendar: ['https://www.googleapis.com/auth/calendar'],
  drive: ['https://www.googleapis.com/auth/drive.file'],
  userInfo: ['https://www.googleapis.com/auth/userinfo.profile', 'https://www.googleapis.com/auth/userinfo.email']
};

module.exports = {
  getOAuth2Client,
  getCalendarClient,
  SCOPES
};