const KubernetesManager = require('./kubernetes-manager');
const config = require('../config/env');
const logger = require('../utils/logger');
const redis = require('../utils/redis-client');

class ContainerManager {
  constructor() {
    this.k8s = new KubernetesManager();
    this.containers = new Map(); // In-memory fallback
    this.userContainers = new Map(); // user_id -> container info
  }

  /**
   * Initialize container manager
   */
  async initialize() {
    try {
      await this.k8s.initialize();
      logger.info('Container manager initialized');
    } catch (error) {
      logger.warn(`Kubernetes not available, using in-memory fallback: ${error.message}`);
    }
  }

  /**
   * Create or get container for user
   */
  async ensureContainer(userId) {
    try {
      // Check if user already has container
      const existingContainerId = await redis.getUserContainerMapping(userId);

      if (existingContainerId) {
        logger.debug(`Container ${existingContainerId} already exists for user ${userId}`);
        return {
          containerId: existingContainerId,
          isNew: false,
        };
      }

      // Create new container
      const containerId = await this.createContainer(userId);
      await redis.setUserContainerMapping(userId, containerId);

      logger.info(`Created new container ${containerId} for user ${userId}`);
      return {
        containerId,
        isNew: true,
      };
    } catch (error) {
      logger.error(`Failed to ensure container for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new container
   */
  async createContainer(userId) {
    try {
      // Try Kubernetes first
      if (this.k8s.appsApi) {
        const podName = await this.k8s.createPod(userId);

        // Wait for pod to be ready
        const isReady = await this.k8s.waitForPodReady(podName, 60000);
        if (!isReady) {
          logger.warn(`Pod ${podName} did not become ready, but continuing`);
        }

        await redis.setContainerStatus(podName, 'running');
        return podName;
      }

      // Fallback to in-memory
      const containerId = `container-${userId}-${Date.now()}`;
      this.containers.set(containerId, {
        userId,
        status: 'running',
        createdAt: new Date(),
        queue: [],
      });

      logger.info(`Created in-memory container ${containerId} for user ${userId}`);
      return containerId;
    } catch (error) {
      logger.error(`Failed to create container: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get container information
   */
  async getContainer(containerId) {
    try {
      // Check Kubernetes first
      if (this.k8s.coreApi) {
        const status = await this.k8s.getPodStatus(containerId);
        if (status) {
          return {
            id: containerId,
            type: 'kubernetes',
            status: status.status,
            podIP: status.podIP,
          };
        }
      }

      // Check in-memory
      const container = this.containers.get(containerId);
      if (container) {
        return {
          id: containerId,
          type: 'in-memory',
          status: container.status,
        };
      }

      return null;
    } catch (error) {
      logger.error(`Failed to get container ${containerId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Delete container
   */
  async deleteContainer(containerId) {
    try {
      // Try Kubernetes first
      if (this.k8s.coreApi) {
        await this.k8s.deletePod(containerId);
      }

      // Clean up in-memory
      this.containers.delete(containerId);
      logger.info(`Deleted container ${containerId}`);
    } catch (error) {
      logger.error(`Failed to delete container ${containerId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Send message to container
   */
  async sendMessage(containerId, message) {
    try {
      const container = await this.getContainer(containerId);
      if (!container) {
        throw new Error(`Container ${containerId} not found`);
      }

      if (container.type === 'in-memory') {
        const containerData = this.containers.get(containerId);
        if (containerData) {
          containerData.queue.push(message);
          logger.debug(`Queued message for container ${containerId}`);
        }
      } else {
        // For Kubernetes, messages would be sent via WebSocket to the pod
        logger.debug(`Message queued for Kubernetes pod ${containerId}`);
      }

      return true;
    } catch (error) {
      logger.error(`Failed to send message to container: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get messages from container
   */
  async getMessages(containerId) {
    const containerData = this.containers.get(containerId);
    if (!containerData) {
      return [];
    }
    const messages = containerData.queue;
    containerData.queue = [];
    return messages;
  }

  /**
   * Mark container as idle
   */
  async markContainerIdle(containerId) {
    const containerData = this.containers.get(containerId);
    if (containerData) {
      containerData.lastActivity = Date.now();
      logger.debug(`Marked container ${containerId} as idle`);
    }
  }

  /**
   * Check and cleanup idle containers
   */
  async cleanupIdleContainers() {
    const now = Date.now();
    const timeout = config.CONTAINER_IDLE_TIMEOUT;

    for (const [containerId, container] of this.containers.entries()) {
      if (container.lastActivity && now - container.lastActivity > timeout) {
        logger.info(`Cleaning up idle container ${containerId}`);
        await this.deleteContainer(containerId);
      }
    }
  }

  /**
   * Get all containers for user
   */
  async getUserContainers(userId) {
    try {
      if (this.k8s.coreApi) {
        return await this.k8s.listUserPods(userId);
      }

      // In-memory
      const userContainers = [];
      for (const [id, container] of this.containers.entries()) {
        if (container.userId === userId) {
          userContainers.push({
            id,
            status: container.status,
            createdAt: container.createdAt,
          });
        }
      }
      return userContainers;
    } catch (error) {
      logger.error(`Failed to get user containers: ${error.message}`);
      return [];
    }
  }
}

module.exports = ContainerManager;
