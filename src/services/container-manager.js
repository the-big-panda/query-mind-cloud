const k8s = require('@kubernetes/client-node');
const logger = require('../utils/logger');
const db = require('../utils/database');

class ContainerManager {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.k8sAppsApi = null;
    this.k8sCoreApi = null;
    this.k8sApi = null;
    this.namespace = process.env.K8S_NAMESPACE || 'default';
  }

  /**
   * Initialize Kubernetes connection
   */
  async initialize() {
    try {
      // Load kubeconfig
      this.kc.loadFromCluster();
      
      this.k8sAppsApi = this.kc.makeApiClient(k8s.AppsV1Api);
      this.k8sCoreApi = this.kc.makeApiClient(k8s.CoreV1Api);
      this.k8sApi = this.kc.makeApiClient(k8s.CustomObjectsApi);

      // Test connectivity
      const namespaces = await this.k8sCoreApi.listNamespace();
      logger.info(`Kubernetes connected - Namespace: ${this.namespace}`);
      logger.info(`Available namespaces: ${namespaces.body.items.length}`);
    } catch (error) {
      logger.error(`Failed to initialize Kubernetes: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create or get pod for user (PERSISTENT)
   */
  async ensureContainer(userId) {
    try {
      const podName = `cloud-ai-server-user-${userId}`;

      // Check if pod exists in database
      const result = await db.query(
        'SELECT container_id FROM user_sessions WHERE user_id = $1 AND is_active = true LIMIT 1',
        [userId]
      );

      if (result.rows.length > 0) {
        const existingPod = result.rows[0].container_id;
        
        try {
          // Verify pod still exists
          const pod = await this.k8sCoreApi.readNamespacedPod(podName, this.namespace);
          
          if (pod.body.status.phase === 'Running') {
            logger.debug(`Pod ${podName} already running for user ${userId}`);
            return {
              containerId: pod.body.metadata.uid.substring(0, 12),
              containerName: podName,
              isNew: false,
            };
          }
        } catch (err) {
          logger.warn(`Pod ${podName} no longer exists, creating new one`);
        }
      }

      // Create new pod
      const podInfo = await this.createPod(userId);
      
      // Store in database
      await db.query(
        `INSERT INTO user_sessions (user_id, container_id, is_active) 
         VALUES ($1, $2, true)
         ON CONFLICT (user_id) DO UPDATE SET 
         container_id = $2, is_active = true`,
        [userId, podInfo.containerId]
      );

      logger.info(`Created new pod ${podName} for user ${userId}`);
      return {
        ...podInfo,
        isNew: true,
      };
    } catch (error) {
      logger.error(`Failed to ensure container for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new Kubernetes pod
   */
  async createPod(userId) {
    try {
      const podName = `cloud-ai-server-user-${userId}`;
      const image = process.env.AI_SERVER_IMAGE || 'docker.io/yourusername/nl2sql-ai-server:latest';

      logger.info(`Creating pod: ${podName}`);

      const pod = {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
          name: podName,
          namespace: this.namespace,
          labels: {
            app: 'cloud-ai-server',
            userId: userId,
            managed: 'cloud-backend',
          },
        },
        spec: {
          restartPolicy: 'Always',
          containers: [
            {
              name: 'ai-server',
              image: image,
              imagePullPolicy: 'IfNotPresent',
              ports: [
                {
                  containerPort: 9001,
                  name: 'http',
                },
              ],
              env: [
                { name: 'PORT', value: '9001' },
                { 
                  name: 'OLLAMA_URL', 
                  value: process.env.OLLAMA_URL || `http://ollama.${this.namespace}.svc.cluster.local:11434/api/generate`
                },
                { name: 'CHROMA_DB_PATH', value: '/app/chroma_storage' },
              ],
              resources: {
                requests: {
                  cpu: '100m',
                  memory: '256Mi',
                },
                limits: {
                  cpu: '500m',
                  memory: '1Gi',
                },
              },
              livenessProbe: {
                httpGet: {
                  path: '/health',
                  port: 9001,
                },
                initialDelaySeconds: 30,
                periodSeconds: 10,
              },
              readinessProbe: {
                httpGet: {
                  path: '/health',
                  port: 9001,
                },
                initialDelaySeconds: 10,
                periodSeconds: 5,
              },
            },
          ],
        },
      };

      // Create the pod
      const response = await this.k8sCoreApi.createNamespacedPod(this.namespace, pod);
      logger.info(`Pod ${podName} created successfully`);

      // Wait for pod to be in Running phase (with timeout)
      let isReady = false;
      let attempts = 0;
      const maxAttempts = 30; // ~30 seconds with 1 second intervals

      while (attempts < maxAttempts && !isReady) {
        try {
          const podStatus = await this.k8sCoreApi.readNamespacedPod(podName, this.namespace);
          if (podStatus.body.status.phase === 'Running') {
            isReady = true;
            logger.info(`Pod ${podName} is now running`);
          }
        } catch (err) {
          logger.debug(`Waiting for pod ${podName} to be ready... (attempt ${attempts + 1}/${maxAttempts})`);
        }

        if (!isReady) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
          attempts++;
        }
      }

      if (!isReady) {
        logger.warn(`Pod ${podName} did not reach Running state after ${maxAttempts} seconds, but continuing...`);
      }

      return {
        containerId: response.body.metadata.uid.substring(0, 12),
        containerName: podName,
      };
    } catch (error) {
      logger.error(`Failed to create pod: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pod information
   */
  async getContainer(podName) {
    try {
      const pod = await this.k8sCoreApi.readNamespacedPod(podName, this.namespace);
      
      return {
        id: pod.body.metadata.uid.substring(0, 12),
        name: pod.body.metadata.name,
        state: pod.body.status.phase,
        createdAt: pod.body.metadata.creationTimestamp,
      };
    } catch (error) {
      logger.error(`Failed to get pod info: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get user's container URL
   */
  async getUserContainerUrl(userId) {
    try {
      const result = await db.query(
        'SELECT container_id FROM user_sessions WHERE user_id = $1 AND is_active = true LIMIT 1',
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error(`No active session for user ${userId}`);
      }

      const podName = `cloud-ai-server-user-${userId}`;
      const serviceName = podName; // Kubernetes DNS: pod-name.namespace.svc.cluster.local
      return `http://${serviceName}.${this.namespace}.svc.cluster.local:9001`;
    } catch (error) {
      logger.error(`Failed to get container URL for user ${userId}: ${error.message}`);
      throw error;
    }
  }

  /**
   * List all user pods
   */
  async listContainers() {
    try {
      const pods = await this.k8sCoreApi.listNamespacedPod(
        this.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        'app=cloud-ai-server'
      );

      return pods.body.items.filter(pod => 
        pod.metadata.name.startsWith('cloud-ai-server-user-')
      );
    } catch (error) {
      logger.error(`Failed to list pods: ${error.message}`);
      throw error;
    }
  }

  /**
   * Stop pod (but keep it for reuse - just mark as inactive)
   */
  async stopContainer(userId) {
    try {
      const podName = `cloud-ai-server-user-${userId}`;

      // Mark as inactive in database but keep pod for reuse
      await db.query(
        'UPDATE user_sessions SET is_active = false, disconnected_at = CURRENT_TIMESTAMP WHERE user_id = $1',
        [userId]
      );

      logger.info(`Pod ${podName} marked as inactive (pod persists for reuse)`);
      return true;
    } catch (error) {
      logger.error(`Failed to stop pod for user ${userId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Delete pod permanently (use with caution)
   */
  async deleteContainer(userId) {
    try {
      const podName = `cloud-ai-server-user-${userId}`;

      await this.k8sCoreApi.deleteNamespacedPod(
        podName,
        this.namespace,
        undefined,
        { gracePeriodSeconds: 30 }
      );

      logger.info(`Pod ${podName} deleted`);

      // Remove from database
      await db.query(
        'DELETE FROM user_sessions WHERE user_id = $1',
        [userId]
      );

      return true;
    } catch (error) {
      logger.error(`Failed to delete pod for user ${userId}: ${error.message}`);
      return false;
    }
  }
}

module.exports = ContainerManager;
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
