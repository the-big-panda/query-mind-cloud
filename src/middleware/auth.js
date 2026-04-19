const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../utils/logger');

/**
 * Generates a JWT token
 */
function generateToken(userId, email, userName) {
  const payload = {
    user_id: userId,
    userId: userId,
    userID: userId,
    email,
    username: userName,
    userName: userName,
  };

  const token = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRY,
  });

  return token;
}

/**
 * Verify JWT token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, config.JWT_SECRET);
  } catch (error) {
    logger.warn(`JWT verification failed: ${error.message}`);
    return null;
  }
}

/**
 * Extract token from WebSocket headers
 */
function extractTokenFromHeaders(headers) {
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Normalize user fields from token for compatibility
 */
function normalizeUserFields(decoded) {
  return {
    user_id: decoded.user_id || decoded.userID || decoded.userId,
    userId: decoded.user_id || decoded.userID || decoded.userId,
    userID: decoded.user_id || decoded.userID || decoded.userId,
    email: decoded.email,
    username: decoded.username || decoded.userName || decoded.user_name,
    userName: decoded.username || decoded.userName || decoded.user_name,
  };
}

/**
 * WebSocket authentication middleware
 */
function authenticateWebSocket(req, res, next) {
  const token = extractTokenFromHeaders(req.headers);

  if (!token) {
    logger.warn('WebSocket connection attempt without token');
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    logger.warn('WebSocket connection attempt with invalid token');
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  // Normalize user fields for compatibility
  const normalizedUser = normalizeUserFields(decoded);
  req.user = { ...decoded, ...normalizedUser };
  next();
}

/**
 * REST API authentication middleware
 */
function authenticateRest(req, res, next) {
  const token = extractTokenFromHeaders(req.headers);

  if (!token) {
    logger.warn('REST API request without token');
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    logger.warn('REST API request with invalid token');
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }

  // Normalize user fields for compatibility
  const normalizedUser = normalizeUserFields(decoded);
  req.user = { ...decoded, ...normalizedUser };
  next();
}

module.exports = {
  generateToken,
  verifyToken,
  extractTokenFromHeaders,
  normalizeUserFields,
  authenticateWebSocket,
  authenticateRest,
};
