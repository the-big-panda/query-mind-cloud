const WebSocket = require('ws');
const config = require('../config/env');
const logger = require('../utils/logger');
const db = require('../utils/database');
const redis = require('../utils/redis-client');

class WebSocketService {
  constructor(containerManager) {
    this.containerManager = containerManager;
    this.userSockets = new Map(); // user_id -> socket
    this.containerSockets = new Map(); // container_id -> socket
    this.messageHandlers = new Map(); // event -> handler
  }

  /**
   * Initialize WebSocket server
   */
  initialize(server) {
    this.wss = new WebSocket.Server({ server });

    this.wss.on('connection', (ws, req) => {
      this.handleConnection(ws, req);
    });

    this.wss.on('error', (error) => {
      logger.error(`WebSocket server error: ${error.message}`);
    });

    logger.info('WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  async handleConnection(ws, req) {
    try {
      const userId = req.user?.user_id;
      if (!userId) {
        logger.warn('WebSocket connection without user context');
        ws.close(4001, 'Unauthorized');
        return;
      }

      logger.info(`User ${userId} connected via WebSocket`);

      // Ensure container exists
      const { containerId } = await this.containerManager.ensureContainer(userId);

      // Store socket references
      this.userSockets.set(userId, ws);
      if (!this.containerSockets.has(containerId)) {
        this.containerSockets.set(containerId, []);
      }
      this.containerSockets.get(containerId).push({
        userId,
        socket: ws,
      });

      // Set up heartbeat
      ws.isAlive = true;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      // Attach metadata
      ws.userId = userId;
      ws.containerId = containerId;
      ws.connectedAt = Date.now();

      // Handle messages
      ws.on('message', (data) => this.handleMessage(userId, containerId, data));

      // Handle errors
      ws.on('error', (error) => this.handleSocketError(userId, error));

      // Handle close
      ws.on('close', () => this.handleDisconnect(userId, containerId));

      // Send connection acknowledgment
      this.sendToUser(userId, {
        type: 'connection_established',
        containerId,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Error handling WebSocket connection: ${error.message}`);
      ws.close(4000, 'Server error');
    }
  }

  /**
   * Handle incoming message
   */
  async handleMessage(userId, containerId, data) {
    try {
      const message = JSON.parse(data.toString());

      logger.debug(`Message from user ${userId}: ${message.type}`);

      // Store message in database
      await this.storeMessage(userId, containerId, 'user', message);

      // Route to container
      await this.containerManager.sendMessage(containerId, message);

      // Handle specific message types
      if (message.type === 'ping') {
        this.sendToUser(userId, { type: 'pong', timestamp: new Date().toISOString() });
      } else if (message.type === 'query') {
        // Forward query to container via message queue
        this.sendToUser(userId, {
          type: 'query_received',
          queryId: message.queryId || 'unknown',
        });
      }
    } catch (error) {
      logger.error(`Error handling message: ${error.message}`);
      this.sendToUser(userId, {
        type: 'error',
        message: 'Failed to process message',
        error: error.message,
      });
    }
  }

  /**
   * Handle socket error
   */
  handleSocketError(userId, error) {
    logger.error(`WebSocket error for user ${userId}: ${error.message}`);
  }

  /**
   * Handle disconnect
   */
  async handleDisconnect(userId, containerId) {
    try {
      logger.info(`User ${userId} disconnected`);

      // Remove socket reference
      this.userSockets.delete(userId);

      if (this.containerSockets.has(containerId)) {
        const sockets = this.containerSockets.get(containerId);
        const index = sockets.findIndex((s) => s.userId === userId);
        if (index !== -1) {
          sockets.splice(index, 1);
        }

        // If no more connections to container, mark as idle
        if (sockets.length === 0) {
          await this.containerManager.markContainerIdle(containerId);
        }
      }
    } catch (error) {
      logger.error(`Error handling disconnect: ${error.message}`);
    }
  }

  /**
   * Send message to user
   */
  sendToUser(userId, message) {
    const ws = this.userSockets.get(userId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      logger.debug(`Sent message to user ${userId}`);
    }
  }

  /**
   * Send message to all users connected to container
   */
  sendToContainer(containerId, message) {
    const sockets = this.containerSockets.get(containerId);
    if (!sockets) return;

    sockets.forEach(({ socket, userId }) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Broadcast message to all connected users
   */
  broadcast(message) {
    this.userSockets.forEach((socket) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });
  }

  /**
   * Store message in database
   */
  async storeMessage(userId, containerId, role, content) {
    try {
      const messageText = typeof content === 'string' ? content : JSON.stringify(content);

      // First get or create conversation
      let conversation = await db.getOne(
        'SELECT id FROM conversations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
        [userId],
      );

      if (!conversation) {
        conversation = await db.insert('conversations', {
          user_id: userId,
          container_id: containerId,
          title: `Conversation ${new Date().toISOString()}`,
        });
      }

      // Insert message
      await db.insert('messages', {
        conversation_id: conversation.id,
        role,
        content: messageText,
      });
    } catch (error) {
      logger.error(`Failed to store message: ${error.message}`);
      // Don't throw - message storage failure shouldn't break communication
    }
  }

  /**
   * Heartbeat to keep connections alive
   */
  startHeartbeat() {
    setInterval(() => {
      this.userSockets.forEach((ws, userId) => {
        if (!ws.isAlive) {
          logger.warn(`User ${userId} heartbeat timeout, terminating connection`);
          ws.terminate();
          return;
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, config.WS_HEARTBEAT_INTERVAL);

    logger.info('WebSocket heartbeat started');
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      connectedUsers: this.userSockets.size,
      activeContainers: this.containerSockets.size,
      totalConnections: Array.from(this.containerSockets.values()).reduce(
        (sum, sockets) => sum + sockets.length,
        0,
      ),
    };
  }
}

module.exports = WebSocketService;
