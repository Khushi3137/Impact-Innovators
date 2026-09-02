const { google } = require('googleapis');
const User = require('../models/User');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const getCalendarClient = async (userId) => {
  const user = await User.findById(userId);
  if (!user || !user.googleTokens) {
    throw new Error('Google Calendar not connected');
  }

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI || 'http://localhost:5000/api/calendar/callback'
  );

  oAuth2Client.setCredentials(user.googleTokens);
  return google.calendar({ version: 'v3', auth: oAuth2Client });
};

exports.getAuthUrl = async (req, res) => {
  try {
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/auth/google/callback'
    );

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent'
    });

    res.json({ success: true, authUrl });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.handleCallback = async (req, res) => {
  try {
    const { code } = req.query;
    const userId = req.userId;

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'http://localhost:3000/auth/google/callback'
    );

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Save tokens to user
    await User.findByIdAndUpdate(userId, {
      googleTokens: tokens
    });

    res.json({ success: true, message: 'Calendar connected successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.createStudyEvent = async (req, res) => {
  try {
    const { summary, description, start, end, reminders } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user.googleTokens) {
      return res.status(400).json({ 
        success: false, 
        message: 'Google Calendar not connected' 
      });
    }

    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oAuth2Client.setCredentials(user.googleTokens);

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const event = {
      summary: `📚 Study: ${summary}`,
      description: description || 'Study session created via Student Assistant',
      start: {
        dateTime: new Date(start).toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(end).toISOString(),
        timeZone: 'UTC',
      },
      reminders: reminders || {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 10 }
        ],
      },
      colorId: '2', // Blue color for study
    };

    const result = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({
      success: true,
      event: result.data,
      message: 'Study event created successfully'
    });
  } catch (error) {
    console.error('Calendar Error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.syncStudySchedule = async (req, res) => {
  try {
    const { studySessions } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    const oAuth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oAuth2Client.setCredentials(user.googleTokens);
    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const createdEvents = [];

    for (const session of studySessions) {
      const event = {
        summary: `📚 ${session.subject}: ${session.topic}`,
        description: `Study session\nGoals: ${session.goals.join(', ')}\nNotes: ${session.notes}`,
        start: { dateTime: session.startTime, timeZone: 'UTC' },
        end: { dateTime: session.endTime, timeZone: 'UTC' },
        colorId: session.subject.toLowerCase().includes('exam') ? '11' : '2'
      };

      const result = await calendar.events.insert({
        calendarId: 'primary',
        resource: event,
      });

      createdEvents.push(result.data);
    }

    res.json({
      success: true,
      count: createdEvents.length,
      events: createdEvents
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

exports.getUpcomingEvents = async (req, res) => {
  try {
    const { maxResults = 10, timeMin, timeMax } = req.query;
    const userId = req.userId;

    const calendar = await getCalendarClient(userId);

    const params = {
      calendarId: 'primary',
      maxResults: parseInt(maxResults),
      singleEvents: true,
      orderBy: 'startTime',
      timeZone: 'UTC'
    };

    // Add time range if provided
    if (timeMin) params.timeMin = new Date(timeMin).toISOString();
    else params.timeMin = new Date().toISOString();
    
    if (timeMax) params.timeMax = new Date(timeMax).toISOString();

    const response = await calendar.events.list(params);
    const events = response.data.items;

    // Filter study events (events with 📚 emoji or containing "Study" in summary)
    const studyEvents = events.filter(event => 
      event.summary?.includes('📚') || 
      event.summary?.toLowerCase().includes('study') ||
      event.description?.toLowerCase().includes('study')
    );

    // Format events for response
    const formattedEvents = events.map(event => ({
      id: event.id,
      summary: event.summary,
      description: event.description,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      location: event.location,
      isStudyEvent: studyEvents.some(e => e.id === event.id),
      colorId: event.colorId,
      status: event.status,
      created: event.created,
      updated: event.updated
    }));

    res.json({
      success: true,
      events: formattedEvents,
      studyEvents: formattedEvents.filter(e => e.isStudyEvent),
      total: formattedEvents.length,
      studyCount: formattedEvents.filter(e => e.isStudyEvent).length,
      timeRange: {
        start: params.timeMin,
        end: params.timeMax
      }
    });
  } catch (error) {
    console.error('Get events error:', error);
    
    if (error.message.includes('not connected')) {
      return res.status(400).json({
        success: false,
        message: 'Google Calendar not connected. Please connect first.',
        code: 'CALENDAR_NOT_CONNECTED'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch calendar events',
      error: error.message
    });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;

    const calendar = await getCalendarClient(userId);

    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId
    });

    res.json({
      success: true,
      message: 'Calendar event deleted successfully',
      eventId
    });
  } catch (error) {
    console.error('Delete event error:', error);

    if (error.message.includes('not connected')) {
      return res.status(400).json({
        success: false,
        message: 'Google Calendar not connected'
      });
    }

    if (error.code === 404) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete calendar event',
      error: error.message
    });
  }
};

// Additional useful calendar functions:

exports.updateEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    const updates = req.body;
    const userId = req.userId;

    const calendar = await getCalendarClient(userId);

    // First get the event to update
    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId
    });

    // Update with new data
    const updatedEvent = {
      ...event.data,
      ...updates,
      updated: new Date().toISOString()
    };

    const result = await calendar.events.update({
      calendarId: 'primary',
      eventId: eventId,
      resource: updatedEvent
    });

    res.json({
      success: true,
      event: result.data,
      message: 'Event updated successfully'
    });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update event',
      error: error.message
    });
  }
};

exports.getEventDetails = async (req, res) => {
  try {
    const { eventId } = req.params;
    const userId = req.userId;

    const calendar = await getCalendarClient(userId);

    const event = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId
    });

    res.json({
      success: true,
      event: event.data
    });
  } catch (error) {
    console.error('Get event details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch event details',
      error: error.message
    });
  }
};

exports.createRecurringStudyEvent = async (req, res) => {
  try {
    const { 
      summary, 
      description, 
      startTime, 
      endTime, 
      recurrence,
      subject,
      topic
    } = req.body;
    
    const userId = req.userId;

    const calendar = await getCalendarClient(userId);

    const event = {
      summary: `📚 ${subject || 'Study'}: ${summary}`,
      description: `Study session: ${topic || ''}\n${description || ''}`,
      start: {
        dateTime: new Date(startTime).toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: new Date(endTime).toISOString(),
        timeZone: 'UTC',
      },
      recurrence: recurrence ? [recurrence] : [],
      colorId: '2', // Blue for study
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'popup', minutes: 30 },
          { method: 'popup', minutes: 10 }
        ],
      }
    };

    const result = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    res.json({
      success: true,
      event: result.data,
      message: 'Recurring study event created successfully'
    });
  } catch (error) {
    console.error('Create recurring event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create recurring event',
      error: error.message
    });
  }
};

exports.getCalendarColors = async (req, res) => {
  try {
    const userId = req.userId;
    const calendar = await getCalendarClient(userId);

    const colors = await calendar.colors.get({});

    res.json({
      success: true,
      eventColors: colors.data.event,
      calendarColors: colors.data.calendar
    });
  } catch (error) {
    console.error('Get colors error:', error);
    // Return default colors if API fails
    res.json({
      success: true,
      eventColors: {
        '1': { background: '#a4bdfc', foreground: '#1d1d1d' }, // Lavender
        '2': { background: '#7ae7bf', foreground: '#1d1d1d' }, // Sage
        '3': { background: '#dbadff', foreground: '#1d1d1d' }, // Grape
        '4': { background: '#ff887c', foreground: '#1d1d1d' }, // Flamingo
        '5': { background: '#fbd75b', foreground: '#1d1d1d' }, // Banana
        '6': { background: '#ffb878', foreground: '#1d1d1d' }, // Tangerine
        '7': { background: '#46d6db', foreground: '#1d1d1d' }, // Peacock
        '8': { background: '#e1e1e1', foreground: '#1d1d1d' }, // Graphite
        '9': { background: '#5484ed', foreground: '#ffffff' }, // Blueberry
        '10': { background: '#51b749', foreground: '#ffffff' }, // Basil
        '11': { background: '#dc2127', foreground: '#ffffff' }  // Tomato
      },
      note: 'Using default colors due to API error'
    });
  }
};

exports.clearStudyEvents = async (req, res) => {
  try {
    const userId = req.userId;
    const calendar = await getCalendarClient(userId);

    // Get all events
    const response = await calendar.events.list({
      calendarId: 'primary',
      maxResults: 2500, // Maximum allowed
      timeMin: new Date().toISOString()
    });

    // Filter study events
    const studyEvents = response.data.items.filter(event => 
      event.summary?.includes('📚') || 
      event.summary?.toLowerCase().includes('study')
    );

    // Delete all study events
    const deletePromises = studyEvents.map(event => 
      calendar.events.delete({
        calendarId: 'primary',
        eventId: event.id
      }).catch(err => {
        console.log(`Failed to delete event ${event.id}:`, err.message);
        return null;
      })
    );

    await Promise.all(deletePromises);

    res.json({
      success: true,
      message: `Deleted ${studyEvents.length} study events`,
      count: studyEvents.length,
      deletedEvents: studyEvents.map(e => ({ id: e.id, summary: e.summary }))
    });
  } catch (error) {
    console.error('Clear events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear study events',
      error: error.message
    });
  }
};