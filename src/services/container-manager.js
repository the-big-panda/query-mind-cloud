const { execFile } = require('child_process');
const { promisify } = require('util');

const config = require('../config/env');
const logger = require('../utils/logger');
const db = require('../utils/database');

const execFileAsync = promisify(execFile);

class ContainerManager {
  constructor() {
    this.isDockerAvailable = false;
    this.isSwarmAvailable = false;
    this.networkName = config.DOCKER.network;
    this.image = config.DOCKER.aiServerImage;
    this.targetPort = config.DOCKER.aiServerPort;
    this.publicHost = config.DOCKER.publicHost;
    this.portStart = config.DOCKER.portStart;
    this.portEnd = config.DOCKER.portEnd;
  }

  async initialize() {
    try {
      await this.runDocker(['version', '--format', '{{.Server.Version}}']);
      this.isDockerAvailable = true;

      const swarmState = await this.runDocker(['info', '--format', '{{.Swarm.LocalNodeState}}']);
      this.isSwarmAvailable = swarmState.trim() === 'active';

      if (!this.isSwarmAvailable) {
        logger.warn('Docker is available, but Swarm is not active. Run: docker swarm init');
        return;
      }

      await this.ensureNetwork();
      logger.info(`Docker Swarm connected - network: ${this.networkName}, image: ${this.image}`);
    } catch (error) {
      this.isDockerAvailable = false;
      this.isSwarmAvailable = false;
      logger.warn(`Docker Swarm not available (non-fatal): ${error.message}`);
      logger.info('Container orchestration is disabled until Docker Swarm is configured');
    }
  }

  async ensureContainer(userId) {
    this.requireSwarm();

    const existing = await this.getActiveSession(userId);
    if (existing) {
      const service = await this.inspectService(existing.container_name);
      if (service) {
        await this.touchSession(userId);
        return {
          containerId: existing.container_id,
          containerName: existing.container_name,
          containerUrl: existing.container_url,
          containerPort: existing.container_port,
          isNew: false,
        };
      }

      logger.warn(`Stored service ${existing.container_name} was not found; creating a replacement`);
    }

    const created = await this.createService(userId);

    await db.query(
      `INSERT INTO user_sessions
        (user_id, container_id, container_name, container_url, container_port, is_active, connected_at, last_activity)
       VALUES ($1, $2, $3, $4, $5, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
        container_id = EXCLUDED.container_id,
        container_name = EXCLUDED.container_name,
        container_url = EXCLUDED.container_url,
        container_port = EXCLUDED.container_port,
        is_active = true,
        disconnected_at = NULL,
        connected_at = CURRENT_TIMESTAMP,
        last_activity = CURRENT_TIMESTAMP`,
      [userId, created.containerId, created.containerName, created.containerUrl, created.containerPort],
    );

    return {
      ...created,
      isNew: true,
    };
  }

  async createService(userId) {
    const serviceName = this.getServiceName(userId);
    const publishedPort = await this.allocatePort();

    logger.info(`Creating Swarm service ${serviceName} for user ${userId} on port ${publishedPort}`);

    const args = [
      'service',
      'create',
      '--detach=true',
      '--name',
      serviceName,
      '--network',
      this.networkName,
      '--replicas',
      '1',
      '--publish',
      `published=${publishedPort},target=${this.targetPort},mode=ingress`,
      '--label',
      'managed-by=cloud-backend',
      '--label',
      `nl2sql.user-id=${userId}`,
      '--env',
      `PORT=${this.targetPort}`,
      '--env',
      `USER_ID=${userId}`,
      this.image,
    ];

    const serviceId = (await this.runDocker(args)).trim();
    await this.waitForService(serviceName);

    return {
      containerId: serviceId.substring(0, 12),
      containerName: serviceName,
      containerUrl: this.buildContainerUrl(publishedPort),
      containerPort: publishedPort,
    };
  }

  async getUserContainerUrl(userId) {
    const session = await this.getActiveSession(userId);
    if (!session) {
      throw new Error(`No active session for user ${userId}`);
    }

    return session.container_url || this.buildContainerUrl(session.container_port);
  }

  async listContainers() {
    this.requireSwarm();

    const output = await this.runDocker([
      'service',
      'ls',
      '--filter',
      'label=managed-by=cloud-backend',
      '--format',
      '{{.ID}}\t{{.Name}}\t{{.Replicas}}\t{{.Image}}\t{{.Ports}}',
    ]);

    return output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [id, name, replicas, image, ports] = line.split('\t');
        return {
          Id: id,
          Name: name,
          Names: [`/${name}`],
          State: replicas,
          Image: image,
          Ports: ports,
        };
      });
  }

  async stopContainer(userId) {
    const session = await this.getActiveSession(userId);
    if (!session) {
      return true;
    }

    await db.query(
      'UPDATE user_sessions SET is_active = false, disconnected_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId],
    );

    logger.info(`Marked service ${session.container_name} inactive for user ${userId}`);
    return true;
  }

  async deleteContainer(userId) {
    const session = await this.getActiveSession(userId);
    const serviceName = session?.container_name || this.getServiceName(userId);

    try {
      await this.runDocker(['service', 'rm', serviceName]);
      logger.info(`Removed Swarm service ${serviceName}`);
    } catch (error) {
      logger.warn(`Could not remove service ${serviceName}: ${error.message}`);
    }

    await db.query('DELETE FROM user_sessions WHERE user_id = $1', [userId]);
    return true;
  }

  async cleanupIdleContainers() {
    if (!this.isSwarmAvailable) {
      return;
    }

    const idleMs = config.CONTAINER_IDLE_TIMEOUT;
    const result = await db.query(
      `SELECT user_id, last_activity
       FROM user_sessions
       WHERE is_active = true
         AND last_activity < NOW() - ($1 * interval '1 millisecond')`,
      [idleMs],
    );

    for (const session of result.rows) {
      logger.info(`Cleaning up idle Swarm service for user ${session.user_id}`);
      await this.deleteContainer(session.user_id);
    }
  }

  async sendMessage(containerId, message) {
    logger.debug(`sendMessage called for ${containerId}: ${message.type || 'unknown'}`);
    return false;
  }

  async markContainerIdle(containerId) {
    await db.query(
      'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE container_id = $1',
      [containerId],
    );
    return true;
  }

  async getActiveSession(userId) {
    const result = await db.query(
      'SELECT * FROM user_sessions WHERE user_id = $1 AND is_active = true LIMIT 1',
      [userId],
    );
    return result.rows[0] || null;
  }

  async touchSession(userId) {
    await db.query(
      'UPDATE user_sessions SET last_activity = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId],
    );
  }

  async inspectService(serviceName) {
    try {
      const output = await this.runDocker(['service', 'inspect', serviceName, '--format', '{{.ID}}']);
      return output.trim();
    } catch (error) {
      return null;
    }
  }

  async waitForService(serviceName) {
    const maxAttempts = config.DOCKER.serviceReadyAttempts;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const output = await this.runDocker([
        'service',
        'ps',
        serviceName,
        '--filter',
        'desired-state=running',
        '--format',
        '{{.CurrentState}}',
      ]);

      if (output.toLowerCase().includes('running')) {
        logger.info(`Swarm service ${serviceName} is running`);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    logger.warn(`Swarm service ${serviceName} was created but did not report running before timeout`);
  }

  async allocatePort() {
    const result = await db.query(
      'SELECT container_port FROM user_sessions WHERE container_port IS NOT NULL',
    );
    const usedPorts = new Set(result.rows.map((row) => Number(row.container_port)));

    for (let port = this.portStart; port <= this.portEnd; port += 1) {
      if (!usedPorts.has(port)) {
        return port;
      }
    }

    throw new Error(`No available AI service ports in range ${this.portStart}-${this.portEnd}`);
  }

  async ensureNetwork() {
    try {
      await this.runDocker(['network', 'inspect', this.networkName]);
    } catch (error) {
      await this.runDocker(['network', 'create', '--driver', 'overlay', '--attachable', this.networkName]);
      logger.info(`Created Swarm overlay network ${this.networkName}`);
    }
  }

  getServiceName(userId) {
    const safeUserId = String(userId).toLowerCase().replace(/[^a-z0-9_.-]/g, '-').substring(0, 48);
    return `${config.DOCKER.servicePrefix}${safeUserId}`;
  }

  buildContainerUrl(port) {
    return `http://${this.publicHost}:${port}`;
  }

  requireSwarm() {
    if (!this.isDockerAvailable) {
      throw new Error('Docker is not available on this host');
    }
    if (!this.isSwarmAvailable) {
      throw new Error('Docker Swarm is not active. Run: docker swarm init');
    }
  }

  async runDocker(args) {
    const { stdout, stderr } = await execFileAsync(config.DOCKER.bin, args, {
      timeout: config.DOCKER.commandTimeout,
      maxBuffer: 1024 * 1024,
    });

    if (stderr) {
      logger.debug(`docker ${args.join(' ')} stderr: ${stderr.trim()}`);
    }

    return stdout;
  }
}

module.exports = ContainerManager;
