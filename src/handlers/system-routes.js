const express = require('express');
const auth = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

/**
 * GET /api/health - Health check
 */
router.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * GET /api/status - Server status
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'running',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * GET /api/ws-stats - WebSocket statistics (requires auth)
 */
router.get('/ws-stats', auth.authenticateHTTP, (req, res) => {
  if (!req.wsService) {
    return res.status(503).json({ error: 'WebSocket service not available' });
  }

  const stats = req.wsService.getStats();
  res.json(stats);
});

module.exports = router;
