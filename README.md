# Cloud Control Backend

A scalable, cloud-native backend for distributed NL2SQL systems. Handles user authentication, container orchestration, real-time WebSocket communication, and message routing.

## Features

✅ **JWT Authentication** - Secure token-based authentication  
✅ **WebSocket Support** - Bi-directional real-time communication  
✅ **Kubernetes Integration** - Auto-scaling container management  
✅ **PostgreSQL Storage** - Persistent conversation and message storage  
✅ **Redis Sessions** - Fast in-memory session mapping  
✅ **Container Per User** - Isolated worker containers via Kubernetes  
✅ **Auto-scaling** - Pods spawn on demand, idle cleanup  
✅ **Graceful Degradation** - In-memory fallback when K8s unavailable  
✅ **Comprehensive Logging** - Winston logger with file rotation  
✅ **Production Ready** - Error handling, retries, health checks  

## Architecture

```
User (WebSocket) 
    ↓
Cloud Backend (Express + ws)
    ├─ JWT Auth
    ├─ WebSocket Router
    ├─ Container Manager → Kubernetes API
    ├─ Database → PostgreSQL
    ├─ Sessions → Redis
    └─ REST API

Kubernetes
    ├─ Pod-per-user (nl2sql-worker)
    ├─ Auto-cleanup on idle
    └─ Health checks & liveness probes
```

## Quick Start

### Local Development (Docker Compose)

```bash
# Clone repository
cd cloud-backend

# Copy environment file
cp .env.example .env

# Start services
docker-compose up -d

# Wait for containers to be ready
docker-compose ps

# Access backend
curl http://localhost:3000/api/health
```

### Kubernetes Deployment

```bash
# Create ConfigMap and Secrets
kubectl apply -f kubernetes/config.yaml

# Create RBAC
kubectl apply -f kubernetes/rbac.yaml

# Deploy dependencies (PostgreSQL, Redis)
kubectl apply -f kubernetes/dependencies.yaml

# Deploy cloud backend
kubectl apply -f kubernetes/deployment.yaml

# Check status
kubectl get pods -l app=cloud-backend
kubectl logs -f deployment/cloud-backend
```

## Installation

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **PostgreSQL** 14+ or Docker
- **Redis** 7+ or Docker
- **Kubernetes** 1.24+ (for production) or mock for development

### Local Setup

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Configure database
# Edit .env:
# DB_HOST=localhost
# DB_USER=postgres
# DB_PASSWORD=your_password

# Initialize database
npm run migrate

# Start in development mode
npm run dev

# Or production mode
npm start
```

## Configuration

### Environment Variables

Create `.env` file:

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# JWT
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRY=24h

# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nl2sql_backend
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Kubernetes
K8S_NAMESPACE=default
K8S_CONTAINER_IMAGE=nl2sql-worker:latest
K8S_CPU_REQUEST=500m
K8S_CPU_LIMIT=2000m
K8S_MEMORY_REQUEST=512Mi
K8S_MEMORY_LIMIT=2Gi

# Container Management
CONTAINER_IDLE_TIMEOUT=3600000
CONTAINER_CHECK_INTERVAL=60000
```

See `.env.example` for all options.

## API Documentation

See [API.md](docs/API.md) for complete endpoint documentation.

### Quick Examples

#### Generate Token
```bash
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "email": "user@example.com"}'
```

#### Get Conversations
```bash
curl -X GET http://localhost:3000/api/conversations \
  -H "Authorization: Bearer YOUR_TOKEN"
```

#### WebSocket Connection
```javascript
const token = 'your_jwt_token';
const ws = new WebSocket('ws://localhost:3000', {
  headers: { 'Authorization': `Bearer ${token}` }
});

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'query',
    queryId: 'q1',
    content: 'Show me sales data'
  }));
};

ws.onmessage = (event) => {
  console.log('Response:', JSON.parse(event.data));
};
```

## Project Structure

```
cloud-backend/
├── src/
│   ├── index.js                 # Main server entry point
│   ├── config/
│   │   └── env.js              # Environment configuration
│   ├── middleware/
│   │   ├── auth.js             # JWT authentication
│   │   └── error-handler.js    # Error handling
│   ├── services/
│   │   ├── container-manager.js    # Container lifecycle
│   │   ├── kubernetes-manager.js   # K8s API client
│   │   └── websocket-service.js    # WebSocket handling
│   ├── handlers/
│   │   ├── auth-routes.js          # Auth endpoints
│   │   ├── conversation-routes.js  # Conversation endpoints
│   │   └── system-routes.js        # System endpoints
│   ├── models/
│   │   └── conversation.js     # Database models
│   └── utils/
│       ├── logger.js           # Winston logger
│       ├── database.js         # PostgreSQL client
│       ├── redis-client.js     # Redis client
│       └── database-migration.js   # Schema initialization
├── kubernetes/
│   ├── deployment.yaml         # Backend deployment
│   ├── rbac.yaml              # Service account & roles
│   ├── config.yaml            # ConfigMap & Secrets
│   └── dependencies.yaml       # PostgreSQL & Redis
├── docs/
│   └── API.md                 # API documentation
├── package.json
├── Dockerfile
└── docker-compose.yml
```

## Database Schema

### Conversations Table
```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  container_id VARCHAR(255) NOT NULL,
  title VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  role VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### User Sessions Table
```sql
CREATE TABLE user_sessions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  container_id VARCHAR(255) NOT NULL,
  token VARCHAR(500),
  connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  disconnected_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);
```

## Container Management

### Pod Lifecycle

1. **User connects** without container → Backend creates K8s Pod
2. **Pod starts** → Health checks pass → Ready for connections
3. **User disconnects** → Container stays idle (1 hour timeout)
4. **Idle timeout** → Container auto-deleted by cleanup task
5. **New connection** → Check Redis mapping → Create or reconnect

### Container Isolation

- One Kubernetes Pod per active user
- Pods have resource limits (CPU/Memory)
- Auto-restart on failure via liveness probe
- Logs accessible via kubectl

### Scaling

- Horizontal: Deploy multiple backend instances
- Vertical: Increase pod resources in config
- Auto-scaling: Configure Kubernetes HPA

## Security

### Authentication
- JWT tokens required for WebSocket and protected endpoints
- Tokens expire after 24 hours (configurable)
- No tokens in logs or error messages

### Authorization
- Users can only access their own conversations
- Container endpoints protected from direct access
- Service-to-service via Kubernetes service accounts

### Network
- HTTPS recommended for production
- CORS configured per environment
- Pod network policies recommended in K8s

### Secrets Management
- Use Kubernetes Secrets for sensitive data
- Rotate JWT_SECRET in production
- Never commit `.env` to version control

## Monitoring & Logs

### Logging
```bash
# Development
npm run dev  # Logs to console

# Production
# Logs in logs/all.log and logs/error.log
tail -f logs/all.log
```

### Health Checks
```bash
# Backend health
curl http://localhost:3000/api/health

# Server status
curl http://localhost:3000/api/status

# WebSocket stats (requires auth)
curl http://localhost:3000/api/ws-stats \
  -H "Authorization: Bearer TOKEN"
```

### Kubernetes Monitoring
```bash
# Check pod status
kubectl get pods -l app=cloud-backend

# View logs
kubectl logs deployment/cloud-backend -f

# Describe deployment
kubectl describe deployment cloud-backend

# Pod events
kubectl describe pod <pod-name>
```

## Performance Considerations

- **Connection pooling**: PostgreSQL pool size 2-10
- **Redis TTL**: Session mappings expire after 24 hours
- **Heartbeat**: WebSocket ping every 30 seconds
- **Container cleanup**: Every 60 seconds by default
- **Max connections**: 1000 concurrent WebSocket connections

## Error Handling

- Invalid JWT → 401 Unauthorized
- Missing container → Auto-create on demand
- K8s unavailable → Fall back to in-memory
- DB connection error → 503 Service Unavailable
- Pod creation failure → Log and retry

## Deployment Checklist

- [ ] Set strong `JWT_SECRET`
- [ ] Configure production database URL
- [ ] Set up Redis with authentication
- [ ] Configure Kubernetes RBAC
- [ ] Set resource limits on pods
- [ ] Enable logs persistence
- [ ] Configure backup strategy
- [ ] Set up monitoring/alerting
- [ ] Test failover scenarios
- [ ] Load test with expected user count

## Troubleshooting

### Issue: Cannot connect to database
```bash
# Check PostgreSQL is running
psql -h localhost -U postgres -d nl2sql_backend

# Check .env DB configuration
grep DB_ .env

# Check connection pooling
npm run dev  # Look for pool errors
```

### Issue: WebSocket connections not working
```bash
# Verify token is valid
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "YOUR_TOKEN"}'

# Check WebSocket service logs
npm run dev  # Look for WebSocket errors
```

### Issue: Kubernetes pod creation failing
```bash
# Check RBAC
kubectl auth can-i create pods --as=system:serviceaccount:default:cloud-backend

# Check pod logs
kubectl logs <pod-name>

# Describe pod for events
kubectl describe pod <pod-name>
```

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes and test
3. Submit pull request

## License

MIT

## Support

For issues and questions:
- Check [API.md](docs/API.md)
- Review logs: `npm run dev`
- Check Kubernetes events: `kubectl describe pod`
- File an issue on GitHub

---

**Last Updated**: 2026-04-19  
**Version**: 1.0.0
