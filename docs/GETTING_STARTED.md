# Getting Started - Cloud Backend

## 🚀 Quick Start (5 minutes)

### Prerequisites

Choose your OS and install PostgreSQL & Redis natively:

#### macOS
```bash
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql redis-server
sudo systemctl start postgresql redis-server
```

#### Windows
Download and install:
- PostgreSQL: https://www.postgresql.org/download/windows/
- Redis: https://github.com/microsoftarchive/redis/releases or WSL2 + apt

### Terminal 1: Setup && Run Backend

```bash
cd cloud-backend
npm install
cp .env.example .env
npm run migrate              # Initialize database
npm run dev                  # Start backend on port 3000
```

Wait for startup message:
```
Cloud Backend Server listening on port 3000
Connected to PostgreSQL
Connected to Redis
Kubernetes API configured
```

### Terminal 2: Test the API

```bash
# Generate authentication token
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"user1","email":"test@example.com","userName":"Test"}' | jq -r .token)

echo "Token: $TOKEN"

# Check backend health
curl http://localhost:3000/api/health

# Get system status (requires token)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/status

# Get WebSocket stats
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/ws-stats
```

If you see `{"status":"healthy"}` - you're good to go! 🎉

### (Optional) Terminal 3: Test Kubernetes Worker Pods

If you have a Kubernetes cluster configured:

```bash
# 1. Setup K8s resources (one-time)
kubectl apply -f kubernetes/config.yaml
kubectl apply -f kubernetes/rbac.yaml

# 2. Create a worker pod for a user
curl -X POST http://localhost:3000/api/containers/user1/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"

# 3. List worker pods
kubectl get pods -n default -l app=nl2sql-worker

# 4. Send message to container via WebSocket
# (See API.md for WebSocket examples)
```

---

## 📋 Architecture

```
YOU (natively on host)
    ↓
Cloud Backend (Port 3000)
    ├→ PostgreSQL (Port 5432, in Docker)
    ├→ Redis (Port 6379, in Docker)
    └→ Kubernetes (manages worker pods)
```

**Key Point**: Backend runs **natively** (not in a container) so it can:
- Access Kubernetes API directly
- Create/manage worker pods
- Communicate efficiently with support services

---

## 📁 Project Setup

| What | Where | Port |
|------|-------|------|
| **Cloud Backend** | Runs natively | 3000 |
| **PostgreSQL** | Docker container | 5432 |
| **Redis** | Docker container | 6379 |
| **Workers** | Kubernetes pods | Per-user |

---

## 🔧 Configuration

Edit `.env`:
```bash
# Server
NODE_ENV=development
PORT=3000

# JWT (must match if you have other services)
JWT_SECRET=your_secret_key

# Database (Docker runs on localhost)
DB_HOST=localhost
DB_PORT=5432

# Redis (Docker runs on localhost)
REDIS_HOST=localhost
REDIS_PORT=6379

# Workers (Kubernetes)
K8S_NAMESPACE=default
K8S_CONTAINER_IMAGE=nl2sql-worker:latest
```

---

## ✅ Verify Installation

```bash
# 1. Check backend health
curl http://localhost:3000/api/health
# Should return: {"status":"healthy","timestamp":"..."}

# 2. Check database
psql -h localhost -U postgres -d nl2sql_backend -c "\dt"
# Should list 4 tables

# 3. Check Redis
redis-cli PING
# Should respond: PONG

# 4. Generate and verify token
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123"}'
# Should return token
```

---

## 🔌 WebSocket Connection

### JavaScript
```javascript
const token = 'your_jwt_token';
const ws = new WebSocket('ws://localhost:3000', {
  headers: { 'Authorization': `Bearer ${token}` }
});

ws.onopen = () => console.log('Connected!');
ws.onmessage = (e) => console.log(JSON.parse(e.data));

ws.send(JSON.stringify({
  type: 'query',
  queryId: 'q1',
  content: 'Show me sales data'
}));
```

### Python
```python
import asyncio, websockets, json, aiohttp

async def test():
    # Get token
    async with aiohttp.ClientSession() as s:
        async with s.post('http://localhost:3000/api/auth/token',
                         json={'userId': 'user123'}) as r:
            token = (await r.json())['token']
    
    # Connect
    uri = 'ws://localhost:3000'
    headers = {'Authorization': f'Bearer {token}'}
    
    async with websockets.connect(uri, extra_headers=headers) as ws:
        msg = await ws.recv()
        print(f"Connected: {msg}")

asyncio.run(test())
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [SETUP.md](SETUP.md) | Detailed setup guide |
| [API.md](API.md) | REST & WebSocket endpoints |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design & flows |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deployment |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Developer cheat sheet |

---

## 🆘 Troubleshooting

| Problem | Solution |
|---------|----------|
| `Error: ECONNREFUSED` | PostgreSQL not running: `docker-compose ps` |
| `Error: connect ECONNREFUSED` (Redis) | Redis not running: `docker-compose up` |
| `Error: Port 3000 in use` | Kill process: `lsof -i :3000 \| kill -9 <PID>` |
| `Module not found` | Install: `npm install` |
| `Database error` | Initialize: `npm run migrate` |
| `WebSocket fails` | Check token: `curl http://localhost:3000/api/health` |

---

## 🔄 Development Commands

```bash
# Start backend (with hot reload)
npm run dev

# Production start
npm start

# Initialize/reset database
npm run migrate

# ESLint check
npm run lint

# Run tests
npm test

# Start services
docker-compose up
docker-compose up -d  # Background
docker-compose down   # Stop

# View service logs
docker-compose logs -f postgres
docker-compose logs -f redis
```

---

## 🚀 Deploy to Kubernetes

```bash
# Apply configurations
kubectl apply -f kubernetes/config.yaml
kubectl apply -f kubernetes/rbac.yaml
kubectl apply -f kubernetes/dependencies.yaml

# Deploy backend (Note: still runs natively, but manages K8s pods)
# See DEPLOYMENT.md for details
```

---

## 🎯 What's Next?

1. ✅ Backend is running locally
2. ⬜ Implement `nl2sql-worker` container
3. ⬜ Write integration tests
4. ⬜ Deploy to Kubernetes
5. ⬜ Setup monitoring/logging

---

## 💡 Key Concepts

### Why Backend Runs Natively?
- ✅ Direct Kubernetes API access
- ✅ No container network overhead
- ✅ Simpler debugging
- ✅ Better resource usage

### How Are Workers Managed?
1. User connects to backend
2. Backend checks if user has a container
3. If not, backend creates Kubernetes pod (for backend's user)
4. Container starts and becomes ready
5. User connected to container
6. On idle timeout, backend deletes pod

### Session Flow
```
User Auth (JWT)
    ↓
WebSocket Connect
    ↓
Backend checks Redis: user_id → container_id
    ↓
Container exists? → Yes: Reconnect
                 → No: Create new pod
    ↓
Store mapping in Redis
    ↓
Connected ✓
```

---

## 📞 Support

- **Logs**: `npm run dev` shows all activity
- **API Docs**: [docs/API.md](../docs/API.md)
- **Architecture**: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
- **Setup Issues**: [docs/SETUP.md](./SETUP.md)

---

**Ready?** Start with Terminal 1 command above! 🚀

Last Updated: 2026-04-19
