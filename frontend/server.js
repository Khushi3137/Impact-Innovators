require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

// Utils
const logger = require('./utils/logger');
const Scheduler = require('./utils/scheduler');

// Routes
const authRoutes = require('./routes/authRoutes');
const geminiRoutes = require('./routes/geminiRoutes');
const calendarRoutes = require('./routes/calendarRoutes');
const studyRoutes = require('./routes/studyRoutes');
const flashcardRoutes = require('./routes/flashcardRoutes');
const groupRoutes = require('./routes/groupRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Middleware
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);

/* ===================== SOCKET.IO ===================== */

const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

/* ===================== MIDDLEWARE ===================== */

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ["GET", "POST","PUT","DELETE"],
  credentials: true
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(logger.requestLogger);

// Rate limiting (apply early)
app.use(apiLimiter);

/* ===================== ROUTES ===================== */

app.use('/api/auth', authRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/test', require('./routes/testRoutes'));

/* ===================== HEALTH CHECK ===================== */

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    services: [
      'auth',
      'study',
      'gemini',
      'flashcards',
      'calendar',
      'resources',
      'groups',
      'files'
    ]
  });
});

/* ===================== SOCKET EVENTS ===================== */

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join-study-room', (roomId) => {
    socket.join(roomId);
    socket.to(roomId).emit('user-joined', {
      userId: socket.id,
      timestamp: new Date()
    });
  });

  socket.on('study-session-update', ({ roomId, sessionData }) => {
    socket.to(roomId).emit('session-updated', sessionData);
  });

  socket.on('group-message', ({ groupId, message, userId }) => {
    io.to(groupId).emit('new-group-message', {
      userId,
      message,
      timestamp: new Date()
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

/* ===================== DATABASE ===================== */

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB error:', err));

/* ===================== PRODUCTION ===================== */

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/build', 'index.html'));
  });
}

/* ===================== ERROR HANDLING ===================== */

app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

/* ===================== START SERVER ===================== */

const PORT = process.env.PORT || 5000;

// Start scheduler (safe)
new Scheduler();

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

/* ===================== GRACEFUL SHUTDOWN ===================== */

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down...');
  server.close(() => {
    mongoose.connection.close(false, () => {
      process.exit(0);
    });
  });
});

module.exports = { app, server, io };
