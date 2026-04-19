const k8s = require('@kubernetes/client-node');
const config = require('../config/env');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

class KubernetesManager {
  constructor() {
    this.kc = new k8s.KubeConfig();
    this.appsApi = null;
    this.coreApi = null;
    this.batch = null;
  }

  /**
   * Initialize Kubernetes client
   */
  async initialize() {
    try {
      // Load in-cluster or local config
      this.kc.loadFromDefault();
      this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api);
      this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
      this.batch = this.kc.makeApiClient(k8s.BatchV1Api);
      logger.info('Kubernetes client initialized');
    } catch (error) {
      logger.error(`Failed to initialize Kubernetes client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create a new pod for a user
   */
  async createPod(userId) {
    const podName = `worker-${userId}-${uuidv4().substring(0, 8)}`;

    const pod = {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: podName,
        namespace: config.K8S.namespace,
        labels: {
          app: 'nl2sql-worker',
          userId,
          managed: 'cloud-backend',
        },
      },
      spec: {
        serviceAccountName: config.K8S.serviceAccount,
        restartPolicy: 'Never',
        containers: [
          {
            name: 'worker',
            image: config.K8S.containerImage,
            imagePullPolicy: 'IfNotPresent',
            ports: [
              {
                containerPort: config.K8S.containerPort,
                protocol: 'TCP',
              },
            ],
            resources: {
              requests: {
                cpu: config.K8S.cpuRequest,
                memory: config.K8S.memoryRequest,
              },
              limits: {
                cpu: config.K8S.cpuLimit,
                memory: config.K8S.memoryLimit,
              },
            },
            env: [
              {
                name: 'USER_ID',
                value: userId,
              },
              {
                name: 'CONTAINER_ID',
                value: podName,
              },
              {
                name: 'BACKEND_HOST',
                valueFrom: {
                  fieldRef: {
                    fieldPath: 'status.podIP',
                  },
                },
              },
            ],
            livenessProbe: {
              httpGet: {
                path: '/health',
                port: config.K8S.containerPort,
              },
              initialDelaySeconds: 30,
              periodSeconds: 10,
              timeoutSeconds: 5,
              failureThreshold: 3,
            },
            readinessProbe: {
              httpGet: {
                path: '/ready',
                port: config.K8S.containerPort,
              },
              initialDelaySeconds: 10,
              periodSeconds: 5,
              timeoutSeconds: 3,
              failureThreshold: 2,
            },
          },
        ],
      },
    };

    try {
      await this.coreApi.createNamespacedPod(config.K8S.namespace, pod);
      logger.info(`Created pod ${podName} for user ${userId}`);
      return podName;
    } catch (error) {
      logger.error(`Failed to create pod: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pod status
   */
  async getPodStatus(podName) {
    try {
      const response = await this.coreApi.readNamespacedPod(podName, config.K8S.namespace);
      const pod = response.body;

      return {
        name: pod.metadata.name,
        status: pod.status.phase,
        podIP: pod.status.podIP,
        conditions: pod.status.conditions,
        containerStatuses: pod.status.containerStatuses,
      };
    } catch (error) {
      if (error.statusCode === 404) {
        return null;
      }
      logger.error(`Failed to get pod status: ${error.message}`);
      throw error;
    }
  }

  /**
   * Delete a pod
   */
  async deletePod(podName) {
    try {
      await this.coreApi.deleteNamespacedPod(podName, config.K8S.namespace);
      logger.info(`Deleted pod ${podName}`);
    } catch (error) {
      if (error.statusCode === 404) {
        logger.debug(`Pod ${podName} not found, skipping deletion`);
        return;
      }
      logger.error(`Failed to delete pod: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pod logs
   */
  async getPodLogs(podName, containerName = 'worker') {
    try {
      const response = await this.coreApi.readNamespacedPodLog(
        podName,
        config.K8S.namespace,
        containerName,
      );
      return response;
    } catch (error) {
      logger.error(`Failed to get pod logs: ${error.message}`);
      throw error;
    }
  }

  /**
   * List pods for a user
   */
  async listUserPods(userId) {
    try {
      const response = await this.coreApi.listNamespacedPod(
        config.K8S.namespace,
        undefined,
        undefined,
        undefined,
        undefined,
        `userId=${userId}`,
      );

      return response.body.items.map((pod) => ({
        name: pod.metadata.name,
        status: pod.status.phase,
        createdAt: pod.metadata.creationTimestamp,
      }));
    } catch (error) {
      logger.error(`Failed to list user pods: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check if pod is ready
   */
  async isPodReady(podName) {
    try {
      const status = await this.getPodStatus(podName);
      if (!status) return false;

      return (
        status.status === 'Running' &&
        status.containerStatuses &&
        status.containerStatuses[0]?.ready === true
      );
    } catch (error) {
      logger.error(`Failed to check pod readiness: ${error.message}`);
      return false;
    }
  }

  /**
   * Wait for pod to be ready with timeout
   */
  async waitForPodReady(podName, timeoutMs = 60000) {
    const startTime = Date.now();
    const pollInterval = 2000;

    while (Date.now() - startTime < timeoutMs) {
      if (await this.isPodReady(podName)) {
        logger.info(`Pod ${podName} is ready`);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    logger.warn(`Pod ${podName} did not become ready within ${timeoutMs}ms`);
    return false;
  }
}

module.exports = KubernetesManager;
