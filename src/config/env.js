require('dotenv').config();

module.exports = {
  // Server
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'change_me_in_production',
  JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',

  // Database
  DB: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'nl2sql_backend',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    poolMin: parseInt(process.env.DB_POOL_MIN, 10) || 2,
    poolMax: parseInt(process.env.DB_POOL_MAX, 10) || 10,
  },

  // Redis
  REDIS: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB, 10) || 0,
  },

  // Kubernetes
  K8S: {
    namespace: process.env.K8S_NAMESPACE || 'default',
    serviceAccount: process.env.K8S_SERVICE_ACCOUNT || 'cloud-backend',
    containerImage: process.env.K8S_CONTAINER_IMAGE || 'nl2sql-worker:latest',
    containerPort: parseInt(process.env.K8S_CONTAINER_PORT, 10) || 8080,
    cpuRequest: process.env.K8S_CPU_REQUEST || '500m',
    cpuLimit: process.env.K8S_CPU_LIMIT || '2000m',
    memoryRequest: process.env.K8S_MEMORY_REQUEST || '512Mi',
    memoryLimit: process.env.K8S_MEMORY_LIMIT || '2Gi',
    registry: process.env.K8S_CONTAINER_REGISTRY || 'localhost:5000',
  },

  // Container Management
  CONTAINER_IDLE_TIMEOUT: parseInt(process.env.CONTAINER_IDLE_TIMEOUT, 10) || 3600000,
  CONTAINER_CHECK_INTERVAL: parseInt(process.env.CONTAINER_CHECK_INTERVAL, 10) || 60000,
  MAX_CONTAINERS_PER_USER: parseInt(process.env.MAX_CONTAINERS_PER_USER, 10) || 1,

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || '*',

  // WebSocket
  WS_HEARTBEAT_INTERVAL: parseInt(process.env.WS_HEARTBEAT_INTERVAL, 10) || 30000,
  WS_HEARTBEAT_TIMEOUT: parseInt(process.env.WS_HEARTBEAT_TIMEOUT, 10) || 5000,
  WS_MAX_CONNECTIONS: parseInt(process.env.WS_MAX_CONNECTIONS, 10) || 1000,
};
