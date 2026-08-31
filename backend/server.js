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
const quizRoutes = require('./routes/quizRoutes');
const groupRoutes = require('./routes/groupRoutes');
const resourceRoutes = require('./routes/resourceRoutes');
const uploadRoutes = require('./routes/uploadRoutes');

// Middleware
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const server = http.createServer(app);
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);

/* ===================== SOCKET.IO ===================== */

const io = socketIo(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

/* ===================== MIDDLEWARE ===================== */

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true
}));


app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(logger.requestLogger);

// Rate limiting (apply early)
app.use(apiLimiter);

/* ===================== ROUTES ===================== */

app.use('/api/auth', authRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/upload', uploadRoutes);
//app.use('/api/test', require('./routes/testRoutes'));

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
      'quizzes',
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

  socket.on('join-study-room', (roomId, callback) => {
    if (!roomId || typeof roomId !== 'string') {
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Room ID is required' });
      }
      return;
    }

    const normalizedRoomId = roomId.trim();

    if (!normalizedRoomId) {
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Room ID is required' });
      }
      return;
    }

    socket.join(normalizedRoomId);

    const joinedEvent = {
      id: `join-${socket.id}-${Date.now()}`,
      roomId: normalizedRoomId,
      userId: socket.id,
      type: 'system',
      message: 'A student joined the room',
      timestamp: new Date().toISOString()
    };

    socket.to(normalizedRoomId).emit('user-joined', joinedEvent);

    if (typeof callback === 'function') {
      callback({ success: true, roomId: normalizedRoomId });
    }
  });

  socket.on('leave-study-room', (roomId) => {
    if (roomId && typeof roomId === 'string') {
      socket.leave(roomId.trim());
    }
  });

  socket.on('study-room-message', ({ roomId, message, sender = 'Student' }, callback) => {
    if (!roomId || !message || typeof roomId !== 'string' || typeof message !== 'string') {
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Room ID and message are required' });
      }
      return;
    }

    const normalizedRoomId = roomId.trim();
    const normalizedMessage = message.trim();

    if (!normalizedRoomId || !normalizedMessage) {
      if (typeof callback === 'function') {
        callback({ success: false, message: 'Room ID and message are required' });
      }
      return;
    }

    const messageEvent = {
      id: `msg-${socket.id}-${Date.now()}`,
      roomId: normalizedRoomId,
      userId: socket.id,
      sender,
      type: 'message',
      message: normalizedMessage,
      timestamp: new Date().toISOString()
    };

    io.to(normalizedRoomId).emit('study-room-message', messageEvent);

    if (typeof callback === 'function') {
      callback({ success: true, message: messageEvent });
    }
  });

  socket.on('study-session-update', ({ roomId, sessionData }) => {
    if (!roomId) return;

    const updateEvent = {
      id: `update-${socket.id}-${Date.now()}`,
      roomId,
      userId: socket.id,
      type: 'update',
      message: sessionData,
      timestamp: new Date().toISOString()
    };

    io.to(roomId).emit('session-updated', updateEvent);
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

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

if (!mongoUri) {
  console.warn('MongoDB URI is not configured. Set MONGODB_URI in .env before using database routes.');
} else {
  mongoose
    .connect(mongoUri)
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => console.error('MongoDB error:', err));
}

/* ===================== PRODUCTION ===================== */

if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '..', 'frontend', 'dist');

  app.use(express.static(clientBuildPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
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

const gracefulShutdown = async (signal) => {
  try {
    console.log(`${signal} received. Shutting down server...`);
    
    // Stop accepting new connections
    server.close(async () => {
      console.log('HTTP server closed');

      // Close MongoDB connection properly
      await mongoose.connection.close();
      console.log('MongoDB connection closed');

      process.exit(0);
    });
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C

module.exports = { app, server, io };
