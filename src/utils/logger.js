const winston = require('winston');
const path = require('path');
const fs = require('fs');

/**
 * Logger Utility
 * Purpose: Centralized logging for the entire application
 * Features: File logging, console output, different log levels
 */

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Helper: Safe stringify to handle circular references
const safeStringify = (obj) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) return "[Circular]";
      seen.add(value);
    }
    return value;
  }, 2);
};

// Custom log format
const customFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level.toUpperCase()}]: ${message}`;
    
    // Add stack trace for errors
    if (stack) {
      log += `\n${stack}`;
    }
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      log += `\nMeta: ${safeStringify(meta)}`;
    }
    
    return log;
  })
);

// Create winston logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: customFormat,
  defaultMeta: { 
    service: 'rag-chatbot',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880,
      maxFiles: 5,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// In production, don't log to console
if (process.env.NODE_ENV === 'production') {
  logger.remove(logger.transports.find(t => t.name === 'console'));
}

// Additional helper methods
logger.logRequest = function(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.get('User-Agent')
    };
    
    if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  });
  
  if (next) next();
};

logger.logError = function(error, context = {}) {
  logger.error('Application Error', {
    message: error.message,
    stack: error.stack,
    context: context,
    timestamp: new Date().toISOString()
  });
};

logger.logPerformance = function(operation, startTime, metadata = {}) {
  const duration = Date.now() - startTime;
  logger.info(`Performance: ${operation}`, {
    duration: `${duration}ms`,
    ...metadata
  });
};

// Log system startup
logger.info('Logger initialized', {
  logLevel: logger.level,
  environment: process.env.NODE_ENV,
  logsDirectory: logsDir
});

module.exports = logger;
