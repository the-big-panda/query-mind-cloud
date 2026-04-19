# Cloud Control Backend - Architecture Guide

## System Overview

The Cloud Control Backend is a Node.js-based service that acts as a central hub for a distributed NL2SQL system. It manages user connections, orchestrates container creation, and routes messages between local backends and worker containers.

## Core Components

### 1. Express Server
- RESTful API endpoints for authentication, conversations, and system info
- CORS middleware for cross-origin requests
- Error handling and logging

### 2. WebSocket Server
- Real-time bidirectional communication
- JWT authentication on upgrade
- Heartbeat mechanism for connection health
- Message routing and session management

### 3. Container Manager
- Orchestrates container lifecycle (create, get, delete, monitor)
- Kubernetes integration with fallback to in-memory
- Per-user container isolation
- Idle timeout and cleanup

### 4. Kubernetes Manager
- Kubernetes API client wrapper
- Pod creation, monitoring, and deletion
- Service account and RBAC integration
- Pod status tracking and readiness probes

### 5. Database Layer
- PostgreSQL for persistent storage
- Connection pooling for performance
- Models for conversations and messages

### 6. Session Management
- Redis for fast user-to-container mappings
- Auto-expiring session keys
- Container status tracking

### 7. Authentication
- JWT token generation and verification
- Header-based token extraction
- Role-based access control (RBAC) via Kubernetes

---

## Data Flow

### Connection Establishment

```
User Application
    ↓
[REQUEST] GET token /api/auth/token
    ↓
Generate JWT with user_id
    ↓
[RESPONSE] token
    ↓
User Application (has JWT)
    ↓
[WEBSOCKET UPGRADE] ws://backend with Token
    ↓
Authentication Middleware
    ↓
Extract & verify JWT
    ↓
Container Manager
    ↓
Check Redis: user_id → container_id exists?
    ↓
YES: Retrieve existing container
NO: Create new Kubernetes Pod
    ↓
Store mapping in Redis
    ↓
Attach WebSocket to Container
    ↓
[RESPONSE] connection_established
    ↓
User Connected ✓
```

### Message Flow

```
User (WebSocket)
    ↓
Send JSON message
    ↓
WebSocket Handler
    ↓
Parse & validate
    ↓
Store in PostgreSQL conversations/messages
    ↓
Route to Container via message queue or WebSocket
    ↓
Container processes message
    ↓
Response sent back to User
    ↓
Store response in PostgreSQL
    ↓
User receives response
```

### Container Lifecycle

```
CREATE:
User connects without container
    ↓
Kubernetes API: Create Pod
    ↓
Pod starts (image: nl2sql-worker)
    ↓
Readiness probe passes
    ↓
Pod ready for WebSocket connection

ACTIVE:
User connected and sending messages
    ↓
Container processes queries
    ↓
Responses routed back to user

IDLE:
User disconnects
    ↓
Container stays running
    ↓
Marked as idle in-memory
    ↓
Periodic cleanup task checks idle containers
    ↓
Idle > TIMEOUT (1 hour)

DELETE:
Cleanup task triggers
    ↓
Kubernetes API: Delete Pod
    ↓
Redis mapping cleaned up
    ↓
Container destroyed
```

---

## Module Architecture

### src/index.js (Entry Point)
```javascript
CloudBackendServer
├── initialize()              // Setup services
├── setupMiddleware()         // Express middleware
├── setupRoutes()            // API routes
├── setupWebSocket()         // WS upgrades & auth
├── setupCleanup()           // Periodic tasks
├── start()                  // Listen on port
└── shutdown()               // Graceful exit
```

### src/middleware/
```
auth.js - JWT utilities
├── verifyToken()
├── extractTokenFromHeaders()
├── authenticateWebSocket()
├── authenticateHTTP()
├── generateToken()
└── decodeToken()

error-handler.js - Error management
├── AppError class
├── errorHandler() - Express middleware
└── notFoundHandler()
```

### src/services/
```
kubernetes-manager.js - Kubernetes API client
├── initialize()
├── createPod()
├── getPodStatus()
├── deletePod()
├── getPodLogs()
├── listUserPods()
├── isPodReady()
└── waitForPodReady()

container-manager.js - Container lifecycle
├── initialize()
├── ensureContainer()        // Create or get
├── createContainer()
├── getContainer()
├── deleteContainer()
├── sendMessage()
├── getMessages()
├── markContainerIdle()
├── cleanupIdleContainers()
└── getUserContainers()

websocket-service.js - WebSocket handler
├── initialize()
├── handleConnection()
├── handleMessage()
├── handleSocketError()
├── handleDisconnect()
├── sendToUser()
├── sendToContainer()
├── broadcast()
├── storeMessage()
├── startHeartbeat()
└── getStats()
```

### src/handlers/
```
auth-routes.js
├── POST /api/auth/token     - Generate JWT
└── POST /api/auth/verify    - Verify JWT

conversation-routes.js
├── GET /api/conversations
├── GET /api/conversations/:id
├── POST /api/conversations
├── PUT /api/conversations/:id
└── DELETE /api/conversations/:id

system-routes.js
├── GET /api/health
├── GET /api/status
└── GET /api/ws-stats
```

### src/models/
```
conversation.js - Database models
├── createConversation()
├── getConversationHistory()
├── addMessage()
├── getUserConversations()
├── getConversation()
├── updateConversationTitle()
└── deleteConversation()
```

### src/utils/
```
logger.js - Winston logger
├── debug(), info(), warn(), error()
└── File rotation (logs/*.log)

database.js - PostgreSQL client
├── query(), getOne(), getMany()
├── insert(), update(), deleteRow()
└── Connection pooling

redis-client.js - Redis client
├── connect(), close()
├── setUserContainerMapping()
├── getUserContainerMapping()
├── getContainerStatus(), setContainerStatus()
└── Session management

database-migration.js - Schema initialization
└── initializeDatabase() - Create tables
```

---

## Data Storage

### PostgreSQL Schema

**conversations table**
```sql
id SERIAL PRIMARY KEY
user_id VARCHAR(255)        -- Foreign reference to user
container_id VARCHAR(255)   -- Associated Kubernetes pod
title VARCHAR(500)
created_at TIMESTAMP
updated_at TIMESTAMP
```

**messages table**
```sql
id SERIAL PRIMARY KEY
conversation_id INTEGER     -- Foreign key to conversations
role VARCHAR(50)           -- 'user' or 'assistant'
content TEXT               -- Message text or JSON
created_at TIMESTAMP
updated_at TIMESTAMP
```

**user_sessions table**
```sql
id SERIAL PRIMARY KEY
user_id VARCHAR(255)
container_id VARCHAR(255)
token VARCHAR(500)
connected_at TIMESTAMP
disconnected_at TIMESTAMP
is_active BOOLEAN
```

### Redis Cache

**Keys:
```
user:{user_id}:container        → {container_id}  (TTL: 24h)
container:{container_id}:status → "running"|"idle" (TTL: 24h)
session:{session_id}            → {token}         (TTL: 3600s)
```

---

## Kubernetes Integration

### Pod Specification

Each user gets a Pod with:
- **Image**: `nl2sql-worker:latest`
- **Resources**:
  - Request: 500m CPU, 512Mi RAM
  - Limit: 2000m CPU, 2Gi RAM
- **Probes**:
  - Liveness: HTTP GET /health (30s delay, 10s interval)
  - Readiness: HTTP GET /ready (10s delay, 5s interval)
- **Labels**: `userId`, `managed=cloud-backend`
- **Service Account**: `cloud-backend`

### RBAC Configuration

**ServiceAccount**: `cloud-backend`
**Permissions**:
- get, list, watch, create, delete pods
- get pod logs
- get pod status

---

## Security Model

### Authentication
1. User provides credentials to generate JWT
2. JWT contains `user_id` and optional metadata
3. All WebSocket and protected API calls require JWT
4. Tokens expire after 24 hours

### Authorization
1. Users can only access containers they own
2. Service account restricted to pod operations
3. Database enforces user_id ownership

### Network
1. Kubernetes API accessed only from backend pod
2. Container endpoints not exposed directly
3. WebSocket and REST over TLS recommended

---

## Performance Characteristics

### Scalability
- **Horizontal**: Multiple backend instances behind load balancer
- **Vertical**: Increase pod resources
- **Auto-scaling**: HPA based on CPU/memory

### Latency
- WebSocket message: < 100ms (local)
- Container creation: 20-30 seconds
- Container deletion: 5-10 seconds

### Throughput
- 1000 concurrent WebSocket connections per instance
- 100+ requests/second per instance
- Connection pooling: 2-10 PostgreSQL connections

### Resource Usage (per backend pod)
- CPU: 500m request, 2000m limit
- Memory: 512Mi request, 1Gi limit
- Connections: 10 DB + 6 Redis

---

## Error Handling

### Connection Errors
```
Invalid JWT → 401 Unauthorized (close WebSocket)
Missing token → 401 (no connection)
K8s unavailable → Fall back to in-memory containers
DB connection error → 503 Service Unavailable
```

### Recovery Strategies
```
Pod creation fails → Retry with exponential backoff
Database timeout → Use connection pool timeout
Redis unavailable → Continue with in-memory fallback
User disconnects → Keep container idle (cleanup later)
```

---

## Monitoring & Observability

### Metrics Exposed
- `/api/ws-stats`: WebSocket connection stats
- `/api/health`: Service health
- `/api/status`: Uptime and version

### Logs
- All logs to Winston (console + files)
- Log levels: debug, info, warn, error
- Structured logging with timestamp and context

### Health Checks
- Liveness: HTTP GET /api/health
- Readiness: HTTP GET /api/health
- Manual check: `curl http://backend:3000/api/health`

---

## Deployment Strategies

### Local Development
- Docker Compose with PostgreSQL, Redis
- In-memory container manager (no K8s)
- SQLite optional for offline testing

### Staging
- Kubernetes cluster (single node or small)
- Real PostgreSQL + Redis
- Mock Kubernetes API for container management

### Production
- Multi-node Kubernetes cluster
- Managed PostgreSQL (RDS, CloudSQL)
- Managed Redis (ElastiCache, MemoryStore)
- HPA for auto-scaling (min 2, max 10 pods)
- Ingress for TLS termination

---

## Future Enhancements

1. **gRPC**: High-performance container communication
2. **GraphQL**: Alternative API layer
3. **Caching**: Redis for conversation history
4. **Message Queue**: Async processing (RabbitMQ, Kafka)
5. **Rate Limiting**: Per-user quotas
6. **API Versioning**: v1, v2, etc.
7. **OAuth2**: Social login integration
8. **Multi-tenancy**: Organization support
9. **Container Scaling**: Auto-scale worker pods per user
10. **WebSocket Compression**: Reduce bandwidth

---

**Document Version**: 1.0  
**Last Updated**: 2026-04-19
