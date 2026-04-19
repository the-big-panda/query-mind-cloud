const express = require('express');
const auth = require('../middleware/auth');
const conversationModel = require('../models/conversation');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * POST /api/auth/token - Generate auth token (for demo purposes)
 */
router.post('/token', (req, res) => {
  try {
    const { userId, email } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const token = auth.generateToken(userId, email);
    res.json({ token, expiresIn: '24h' });
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

module.exports = router;
