const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');

const config = require('./config/env');
const logger = require('./utils/logger');
const db = require('./utils/database');
const redis = require('./utils/redis-client');
const { initializeDatabase } = require('./utils/database-migration');

const auth = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/error-handler');

const ContainerManager = require('./services/container-manager');
const WebSocketService = require('./services/websocket-service');

const authRoutes = require('./handlers/auth-routes');
const conversationRoutes = require('./handlers/conversation-routes');
const systemRoutes = require('./handlers/system-routes');

class CloudBackendServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.containerManager = null;
    this.wsService = null;
  }

  /**
   * Initialize the server
   */
  async initialize() {
    try {
      logger.info('Initializing Cloud Backend Server...');

      // Initialize services
      await redis.connect();
      await initializeDatabase();

      this.containerManager = new ContainerManager();
      await this.containerManager.initialize(); // Non-fatal: continues even if K8s unavailable

      this.setupMiddleware();
      this.setupRoutes();
      this.setupWebSocket();
      this.setupCleanup();

      logger.info('Server initialization complete');
    } catch (error) {
      logger.error(`Server initialization failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // Parse CORS origin(s) from config
    let corsOrigin = config.CORS_ORIGIN;
    if (typeof corsOrigin === 'string' && corsOrigin !== '*') {
      corsOrigin = corsOrigin.split(',').map(origin => origin.trim());
    }

    this.app.use(cors({ origin: corsOrigin, credentials: true }));
    this.app.use(bodyParser.json({ limit: '10mb' }));
    this.app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

    // Add websocket service to request
    this.app.use((req, res, next) => {
      req.wsService = this.wsService;
      req.containerManager = this.containerManager;
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      logger.debug(`${req.method} ${req.path}`);
      next();
    });

    logger.info('Middleware configured');
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    // Health check (root level, no auth)
    this.app.get('/health', (req, res) => {
      res.json({ status: 'healthy', service: 'cloud-backend', timestamp: new Date().toISOString() });
    });

    // Health check (no auth)
    this.app.use('/api', systemRoutes);

    // Auth routes (no auth required)
    this.app.use('/api/auth', authRoutes);

    // Protected routes
    this.app.use('/api/conversations', conversationRoutes);

    // 404 handler
    this.app.use(notFoundHandler);

    // Error handler
    this.app.use(errorHandler);

    logger.info('Routes configured');
  }

  /**
   * Setup WebSocket server
   */
  setupWebSocket() {
    // Create HTTP server
    this.server = http.createServer(this.app);

    // Initialize WebSocket service
    this.wsService = new WebSocketService(this.containerManager);
    this.wsService.initialize(this.server);

    // Upgrade connection with auth
    this.server.on('upgrade', (req, ws, head) => {
      // Extract and verify token
      const token = auth.extractTokenFromHeaders(req.headers);

      if (!token) {
        ws.close(4001, 'Unauthorized: No token');
        return;
      }

      const decoded = auth.verifyToken(token);
      if (!decoded) {
        ws.close(4001, 'Unauthorized: Invalid token');
        return;
      }

      // Attach user to request
      req.user = decoded;

      // Let ws handle the connection
      this.wsService.initialize(this.server);
    });

    // Start heartbeat
    this.wsService.startHeartbeat();

    logger.info('WebSocket server configured');
  }

  /**
   * Setup cleanup tasks
   */
  setupCleanup() {
    // Cleanup idle containers periodically
    setInterval(async () => {
      try {
        if (this.containerManager) {
          await this.containerManager.cleanupIdleContainers();
        }
      } catch (error) {
        logger.error(`Container cleanup error: ${error.message}`);
      }
    }, config.CONTAINER_CHECK_INTERVAL);

    logger.info('Cleanup tasks scheduled');
  }

  /**
   * Start the server
   */
  async start() {
    try {
      await this.initialize();

      this.server.listen(config.PORT, () => {
        logger.info(`Cloud Backend Server listening on port ${config.PORT}`);
        logger.info(`Environment: ${config.NODE_ENV}`);
      });
    } catch (error) {
      logger.error(`Failed to start server: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    try {
      logger.info('Shutting down server...');

      // Close WebSocket connections
      if (this.wsService && this.wsService.wss) {
        this.wsService.wss.close();
      }

      // Close HTTP server
      if (this.server) {
        this.server.close();
      }

      // Close database
      await db.end();

      // Close Redis
      await redis.close();

      logger.info('Server shutdown complete');
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error.message}`);
      process.exit(1);
    }
  }
}

// Create and start server
const server = new CloudBackendServer();

// Handle graceful shutdown
process.on('SIGTERM', () => server.shutdown());
process.on('SIGINT', () => server.shutdown());

// Start server
server.start().catch((error) => {
  logger.error(`Fatal error: ${error.message}`);
  process.exit(1);
});

module.exports = server;
