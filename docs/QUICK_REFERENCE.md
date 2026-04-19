# Cloud Backend - Developer Quick Reference

## 📦 Installation & Setup

```bash
# Clone and install
git clone <repo> && cd cloud-backend
npm install

# Setup environment
cp .env.example .env

# Start development
npm run dev

# Or with Docker
docker-compose up -d
```

---

## 🔑 Quick API Examples

### Generate JWT Token
```bash
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId": "user123", "email": "test@example.com"}'
```

**Response:**
```json
{ "token": "eyJ...", "expiresIn": "24h" }
```

### Verify Token
```bash
curl -X POST http://localhost:3000/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "eyJ..."}'
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

### Get WebSocket Stats
```bash
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:3000/api/ws-stats
```

---

## 🔌 WebSocket Connection

### JavaScript
```javascript
const token = 'your_jwt_token';
const ws = new WebSocket('ws://localhost:3000', {
  headers: { 'Authorization': `Bearer ${token}` }
});

// Connected
ws.onopen = () => console.log('Connected');

// Receive messages
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log(msg.type, msg);
};

// Send query
ws.send(JSON.stringify({
  type: 'query',
  queryId: 'q1',
  content: 'Show top 5 customers'
}));

// Ping/pong
ws.send(JSON.stringify({ type: 'ping' }));
```

### Python
```python
import asyncio, websockets, json
import aiohttp

async def test():
    async with aiohttp.ClientSession() as s:
        async with s.post('http://localhost:3000/api/auth/token',
                         json={'userId': 'user123'}) as r:
            token = (await r.json())['token']
    
    uri = 'ws://localhost:3000'
    h = {'Authorization': f'Bearer {token}'}
    
    async with websockets.connect(uri, extra_headers=h) as ws:
        # Read connection message
        msg = await ws.recv()
        print(f"Connected: {msg}")
        
        # Send query
        await ws.send(json.dumps({
            'type': 'query',
            'queryId': 'q1',
            'content': 'Show sales data'
        }))
        
        # Read response
        resp = await ws.recv()
        print(f"Response: {resp}")

asyncio.run(test())
```

---

## 📚 REST Endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| POST | `/api/auth/token` | No | Generate JWT |
| POST | `/api/auth/verify` | No | Verify token |
| GET | `/api/health` | No | Health check |
| GET | `/api/status` | No | Server status |
| GET | `/api/ws-stats` | Yes | WS stats |
| GET | `/api/conversations` | Yes | List conversations |
| GET | `/api/conversations/:id` | Yes | Get conversation |
| POST | `/api/conversations` | Yes | Create conversation |
| PUT | `/api/conversations/:id` | Yes | Update conversation |
| DELETE | `/api/conversations/:id` | Yes | Delete conversation |

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## 🐳 Docker Commands

```bash
# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f cloud-backend

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Fresh start
docker-compose down -v && docker-compose up -d
```

---

## ☸️ Kubernetes Commands

```bash
# Apply configs
kubectl apply -f kubernetes/config.yaml
kubectl apply -f kubernetes/rbac.yaml
kubectl apply -f kubernetes/dependencies.yaml

# Deploy backend
kubectl apply -f kubernetes/deployment.yaml

# Check deployment
kubectl get deployment cloud-backend
kubectl describe deployment cloud-backend

# View logs
kubectl logs -f deployment/cloud-backend
kubectl logs -f pod/cloud-backend-abc123

# Port forward
kubectl port-forward service/cloud-backend 3000:80

# Shell into pod
kubectl exec -it pod/cloud-backend-xyz -- sh

# Delete deployment
kubectl delete deployment cloud-backend
```

---

## 🐛 Common Issues

### WebSocket Connection Refused
```bash
# Check backend running
curl http://localhost:3000/api/health

# Check WebSocket URL (ws:// not http://)
# Check JWT token is valid
curl -H "Authorization: Bearer TOKEN" http://localhost:3000/api/ws-stats
```

### Database Connection Error
```bash
# Test PostgreSQL
psql -h localhost -U postgres -d nl2sql_backend

# Check .env configuration
grep DB_ .env

# Initialize database
npm run migrate
```

### Pod Creation Failed
```bash
# Check Kubernetes
kubectl cluster-info

# View pod events
kubectl describe pod <pod-name>

# Check RBAC
kubectl auth can-i create pods --as=system:serviceaccount:default:cloud-backend
```

---

## 📝 Project Structure

```
src/
├── index.js                    ← Main entry
├── config/env.js              ← Configuration
├── middleware/                ← Auth & errors
├── services/                  ← Business logic
│   ├── container-manager.js
│   ├── kubernetes-manager.js
│   └── websocket-service.js
├── handlers/                  ← API routes
├── models/                    ← Database
└── utils/                     ← Helpers
```

---

## 🔧 Development Workflow

1. **Make changes to src/**
   ```bash
   npm run dev  # Auto-reload
   ```

2. **Run tests**
   ```bash
   npm test
   ```

3. **Check code**
   ```bash
   npm run lint
   ```

4. **Build Docker image**
   ```bash
   docker build -t cloud-backend:v1 .
   ```

5. **Deploy to K8s**
   ```bash
   kubectl apply -f kubernetes/deployment.yaml
   ```

---

## 📊 Service Ports

| Service | Port | Protocol |
|---------|------|----------|
| Cloud Backend | 3000 | HTTP/WS |
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |
| Kubernetes API | 6443 | HTTPS |

---

## 🔒 Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Use HTTPS/WSS in production
- [ ] Rotate database passwords regularly
- [ ] Enable Redis authentication
- [ ] Configure CORS for your domain
- [ ] Set resource limits on pods
- [ ] Enable audit logging
- [ ] Use Kubernetes network policies
- [ ] Setup monitoring & alerting
- [ ] Backup database regularly

---

## 📈 Performance Tips

1. **Database**
   - Connection pooling: 2-10 connections
   - Add indexes on user_id, conversation_id

2. **Redis**
   - Use pipeline for batch operations
   - Monitor memory usage

3. **Kubernetes**
   - Set resource requests/limits
   - Use HPA for auto-scaling
   - Configure pod disruption budgets

4. **WebSocket**
   - Implement automatic reconnection
   - Use message compression
   - Batch multiple messages

---

## 🚀 Deployment Checklist

### Local Dev
- [ ] `docker-compose up`
- [ ] Test `/api/health`
- [ ] Generate token
- [ ] Connect WebSocket

### Docker Push
- [ ] Build image: `docker build -t ...`
- [ ] Tag image: `docker tag ...`
- [ ] Push: `docker push ...`
- [ ] Update deployment image

### Kubernetes Deploy
- [ ] Configure secrets
- [ ] Apply manifests
- [ ] Verify deployment
- [ ] Check pods running
- [ ] Port forward test
- [ ] Monitor logs

### Production
- [ ] Backup database
- [ ] Enable TLS
- [ ] Setup monitoring
- [ ] Configure auto-scaling
- [ ] Test failover
- [ ] Document deployment

---

## 📞 Quick Support

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `lsof -i :3000 \| kill -9 <PID>` |
| DB not found | `npm run migrate` |
| K8s not found | `kubectl cluster-info` |
| Pod pending | `kubectl describe pod <name>` |
| ImagePullBackOff | Verify image in registry |
| Logs too verbose | Set LOG_LEVEL=info in .env |

---

## 🔗 Links

- [API Documentation](docs/API.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [GitHub](https://github.com/...)
- [Docker Hub](https://hub.docker.com/...)

---

**Last Updated**: 2026-04-19  
**Version**: 1.0.0
