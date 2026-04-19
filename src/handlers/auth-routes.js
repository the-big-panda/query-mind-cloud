const express = require('express');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');
const db = require('../utils/database');

const router = express.Router();

/**
 * POST /api/auth/token - Generate auth token and ensure container
 */
router.post('/token', async (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const token = auth.generateToken(userId, email);

    // Ensure user has a container
    try {
      const containerInfo = await req.containerManager.ensureContainer(userId);
      const containerUrl = await req.containerManager.getUserContainerUrl(userId);

      res.json({
        token,
        expiresIn: '24h',
        container: {
          id: containerInfo.containerId,
          name: containerInfo.containerName,
          url: containerUrl,
          isNew: containerInfo.isNew,
        },
      });
    } catch (containerError) {
      logger.warn(`Container creation warning (token still valid): ${containerError.message}`);
      res.json({
        token,
        expiresIn: '24h',
        warning: 'Container unavailable, try again later',
      });
    }
  } catch (error) {
    logger.error(`Error generating token: ${error.message}`);
    res.status(500).json({ error: 'Failed to generate token' });
  }
});

/**
 * POST /api/auth/verify - Verify JWT token
 */
router.post('/verify', (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const decoded = auth.verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.json({ valid: true, decoded });
  } catch (error) {
    logger.error(`Error verifying token: ${error.message}`);
    res.status(500).json({ error: 'Failed to verify token' });
  }
});

/**
 * GET /api/auth/container - Get user's container info
 */
router.get('/container', auth.authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId || req.user.user_id;

    const containerUrl = await req.containerManager.getUserContainerUrl(userId);
    const containers = await req.containerManager.listContainers();

    const userContainer = containers.find(c => 
      c.Names[0].includes(`user-${userId}`)
    );

    res.json({
      userId,
      container: userContainer ? {
        id: userContainer.Id.substring(0, 12),
        name: userContainer.Names[0],
        state: userContainer.State,
        url: containerUrl,
      } : null,
    });
  } catch (error) {
    logger.error(`Error getting container info: ${error.message}`);
    res.status(500).json({ error: 'Failed to get container info' });
  }
});

module.exports = router;
