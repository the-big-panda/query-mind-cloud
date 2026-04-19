const redis = require('redis');
const config = require('../config/env');
const logger = require('./logger');

const redisClient = redis.createClient({
  host: config.REDIS.host,
  port: config.REDIS.port,
  password: config.REDIS.password,
  db: config.REDIS.db,
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Max redis reconnection attempts reached');
        return new Error('Max reconnection attempts');
      }
      return retries * 50;
    },
  },
});

redisClient.on('error', (err) => {
  logger.error(`Redis connection error: ${err.message}`);
});

redisClient.on('connect', () => {
  logger.info('Connected to Redis');
});

redisClient.on('reconnecting', () => {
  logger.info('Reconnecting to Redis...');
});

/**
 * Connect to Redis
 */
async function connect() {
  try {
    await redisClient.connect();
    logger.info('Redis client connected');
  } catch (error) {
    logger.error(`Failed to connect to Redis: ${error.message}`);
    throw error;
  }
}

/**
 * Set user to container mapping
 */
async function setUserContainerMapping(userId, containerId) {
  const key = `user:${userId}:container`;
  await redisClient.set(key, containerId, { EX: 86400 });
  logger.debug(`Mapped user ${userId} to container ${containerId}`);
}

/**
 * Get container ID for user
 */
async function getUserContainerMapping(userId) {
  const key = `user:${userId}:container`;
  return redisClient.get(key);
}

/**
 * Delete user to container mapping
 */
async function deleteUserContainerMapping(userId) {
  const key = `user:${userId}:container`;
  await redisClient.del(key);
  logger.debug(`Deleted mapping for user ${userId}`);
}

/**
 * Set container status
 */
async function setContainerStatus(containerId, status) {
  const key = `container:${containerId}:status`;
  await redisClient.set(key, status, { EX: 86400 });
}

/**
 * Get container status
 */
async function getContainerStatus(containerId) {
  const key = `container:${containerId}:status`;
  return redisClient.get(key);
}

/**
 * Set session token
 */
async function setSessionToken(sessionId, token, ttl = 3600) {
  const key = `session:${sessionId}`;
  await redisClient.set(key, token, { EX: ttl });
}

/**
 * Get session token
 */
async function getSessionToken(sessionId) {
  const key = `session:${sessionId}`;
  return redisClient.get(key);
}

/**
 * Revoke session
 */
async function revokeSession(sessionId) {
  const key = `session:${sessionId}`;
  await redisClient.del(key);
}

/**
 * Generic set
 */
async function set(key, value, ttl = null) {
  if (ttl) {
    await redisClient.set(key, value, { EX: ttl });
  } else {
    await redisClient.set(key, value);
  }
}

/**
 * Generic get
 */
async function get(key) {
  return redisClient.get(key);
}

/**
 * Generic delete
 */
async function del(key) {
  await redisClient.del(key);
}

/**
 * Close Redis connection
 */
async function close() {
  await redisClient.quit();
  logger.info('Redis connection closed');
}

module.exports = {
  connect,
  setUserContainerMapping,
  getUserContainerMapping,
  deleteUserContainerMapping,
  setContainerStatus,
  getContainerStatus,
  setSessionToken,
  getSessionToken,
  revokeSession,
  set,
  get,
  del,
  close,
  client: redisClient,
};
