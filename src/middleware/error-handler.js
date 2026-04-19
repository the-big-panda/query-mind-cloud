const logger = require('../utils/logger');

class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.timestamp = new Date();
  }
}

/**
 * Global error handler middleware for Express
 */
function errorHandler(err, req, res, next) {
  logger.error(`Error: ${err.message}`, err);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
      timestamp: err.timestamp,
    });
  }

  // Database error
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({
      error: 'Database service unavailable',
    });
  }

  // Default error
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
}

/**
 * 404 handler
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: 'Route not found',
    path: req.path,
  });
}

module.exports = {
  AppError,
  errorHandler,
  notFoundHandler,
};
