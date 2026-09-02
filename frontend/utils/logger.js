const winston = require('winston');
const path = require('path');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create logger instance
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Add request logging middleware
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      user: req.userId || 'anonymous',
      ip: req.ip
    });
  });
  
  next();
};

// Log error function
const logError = (error, context = {}) => {
  logger.error({
    message: error.message,
    stack: error.stack,
    context
  });
};

// Log API usage
const logApiUsage = (userId, endpoint, details = {}) => {
  logger.info({
    type: 'api_usage',
    userId,
    endpoint,
    details,
    timestamp: new Date().toISOString()
  });
};

// Log AI usage
const logAiUsage = (userId, model, tokens, cost) => {
  logger.info({
    type: 'ai_usage',
    userId,
    model,
    tokens,
    cost,
    timestamp: new Date().toISOString()
  });
};

module.exports ={
  logger,requestLogger,logError,logApiUsage,logAiUsage
};