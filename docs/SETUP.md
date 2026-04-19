# Cloud Backend Setup Guide

## Architecture

The Cloud Backend system runs **100% natively** (except worker pods):

### 1. **Cloud Backend Server** (Runs NATIVELY)
- Node.js Express + WebSocket service
- Runs on your host machine or server
- Communicates with Kubernetes API to manage worker containers
- **NOT containerized** - runs with direct system access

### 2. **Support Services** (Run NATIVELY)
- PostgreSQL (database) - native database server
- Redis (session cache) - native cache server
- **NOT containerized** - run natively on your system

### 3. **Worker Containers** (Managed by Backend, Run in Kubernetes)
- Per-user worker pods spawned by Kubernetes
- Created on-demand when users connect
- Isolated and auto-cleaned on idle timeout
- **ONLY containerized component**

---

## Why Everything Runs Natively (Except Workers)

✅ Direct Kubernetes API access (no network hops)  
✅ Can manage container lifecycle efficiently  
✅ Simplified deployment (single Node.js process)  
✅ Direct file system access for logs and configs  
✅ Easier debugging during development  
✅ Better performance (no container overhead)  
✅ PostgreSQL and Redis run as native services  

---

## Installation

### Prerequisites

- **Node.js** 18+ ([download](https://nodejs.org/))
- **PostgreSQL** 14+ (native, not Docker)
- **Redis** 7+ (native, not Docker)
- **kubectl** configured (for Kubernetes, optional for local testing)
- **Git**

### Step 1: Clone & Setup

```bash
git clone <repo>
cd cloud-backend

# Copy environment template
cp .env.example .env
```

### Step 2: Install PostgreSQL & Redis (Native)

#### macOS
```bash
brew install postgresql@15 redis
brew services start postgresql@15
brew services start redis

# Verify
psql -U postgres -c "SELECT version();"
redis-cli ping
```

#### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib redis-server

# Start services
sudo systemctl start postgresql redis-server
sudo systemctl enable postgresql redis-server

# Verify
sudo -u postgres psql -c "SELECT version();"
redis-cli ping
```

#### Windows (WSL2 / Native)
Option A - WSL2 + Ubuntu:
```powershell
# In WSL terminal
sudo apt install postgresql redis-server
sudo systemctl start postgresql redis-server
```

Option B - Native Installers:
- PostgreSQL: https://www.postgresql.org/download/windows/
- Redis: https://github.com/microsoftarchive/redis/releases

### Step 3: Configure Environment

Edit `.env`:

```bash
# Server
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# JWT (use strong secret in production)
JWT_SECRET=your_super_secret_key_change_this
JWT_EXPIRY=24h

# PostgreSQL (running locally)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=nl2sql_backend
DB_USER=postgres
DB_PASSWORD=postgres

# Redis (running locally)
REDIS_HOST=localhost
REDIS_PORT=6379

# Kubernetes (for worker pods)
K8S_NAMESPACE=default
K8S_CONTAINER_IMAGE=nl2sql-worker:latest
```

### Step 4: Install Backend Dependencies

```bash
npm install
```

### Step 5: Initialize Database

```bash
npm run migrate
```

This creates all necessary tables in PostgreSQL:
- `conversations` - Chat conversations
- `messages` - Chat messages
- `user_sessions` - Session tracking
- `activity_logs` - Activity audit

### Step 6: Start Cloud Backend

```bash
# Development mode (with hot reload)
npm run dev

# Or production mode
npm start
```

The backend will be available at `http://localhost:3000` and WebSocket at `ws://localhost:3000`

Test it:
```bash
curl http://localhost:3000/api/health
```

Expected response:
```json
{"status":"healthy"}
```

---

## Managing Native Services

### PostgreSQL

```bash
# macOS
brew services start postgresql@15
brew services stop postgresql@15
brew services restart postgresql@15

# Ubuntu/Debian
sudo systemctl start postgresql
sudo systemctl stop postgresql
sudo systemctl restart postgresql
sudo systemctl status postgresql

# Connect to database
psql -U postgres
\l                    # List databases
\c nl2sql_backend     # Connect to backend database
\dt                   # List tables
```

### Redis

```bash
# macOS
brew services start redis
brew services stop redis
brew services restart redis

# Ubuntu/Debian
sudo systemctl start redis-server
sudo systemctl stop redis-server
sudo systemctl restart redis-server
sudo systemctl status redis-server

# Connect to cache
redis-cli
PING                  # Should respond with "PONG"
INFO                  # Show server info
KEYS *                # List all keys
```

---

## Troubleshooting Native Services

### PostgreSQL Connection Refused

```bash
# Check if PostgreSQL is running
# macOS
brew services list | grep postgres

# Ubuntu
sudo systemctl status postgresql

# Try to connect
psql -U postgres

# If not found, reinstall
brew reinstall postgresql@15  # macOS
```

### Redis Connection Refused

```bash
# Check if Redis is running
# macOS
brew services list | grep redis

# Ubuntu
sudo systemctl status redis-server

# Restart if needed
brew services restart redis  # macOS
sudo systemctl restart redis-server  # Ubuntu

# Test connection
redis-cli ping
```

### Backend Can't Connect to PostgreSQL

```bash
# Check .env file
cat .env | grep DB_HOST

# Should be: DB_HOST=localhost (not 127.0.0.1 or docker network name)

# Test connection manually
psql -h localhost -U postgres -c "SELECT 1;"

# Check PostgreSQL logs
# macOS: /var/log/postgresql/
# Ubuntu: /var/log/postgresql/
```

### Backend Can't Connect to Redis

```bash
# Check .env file
cat .env | grep REDIS_HOST

# Should be: REDIS_HOST=localhost

# Test connection manually
redis-cli ping

# Check no firewall rules blocking port 6379
sudo netstat -tulnp | grep 6379  # Ubuntu
netstat -an | grep 6379          # macOS
```

---

## Optional: Kubernetes Setup (For Worker Pods)

If you want to use Kubernetes to manage worker pods:

```bash
# 1. Ensure kubectl is configured
kubectl cluster-info

# 2. Create namespace
kubectl create namespace nl2sql

# 3. Apply Kubernetes resources
kubectl apply -f kubernetes/config.yaml    # ConfigMap
kubectl apply -f kubernetes/rbac.yaml      # RBAC/ServiceAccount

# 4. Verify
kubectl get serviceaccount -n nl2sql
kubectl get configmap -n nl2sql

# 5. Test worker pod creation (after backend is running)
kubectl get pods -n nl2sql
```

---

## Environment Variables Reference

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| NODE_ENV | development | No | Environment (development/production) |
| PORT | 3000 | No | Backend server port |
| LOG_LEVEL | info | No | Logging level (debug/info/warn/error) |
| JWT_SECRET | - | **YES** | Secret for JWT signing |
| JWT_EXPIRY | 24h | No | JWT token expiry duration |
| DB_HOST | localhost | No | PostgreSQL host |
| DB_PORT | 5432 | No | PostgreSQL port |
| DB_NAME | nl2sql_backend | No | PostgreSQL database name |
| DB_USER | postgres | No | PostgreSQL user |
| DB_PASSWORD | postgres | No | PostgreSQL password |
| REDIS_HOST | localhost | No | Redis host |
| REDIS_PORT | 6379 | No | Redis port |
| K8S_NAMESPACE | default | No | Kubernetes namespace for workers |
| K8S_CONTAINER_IMAGE | nl2sql-worker:latest | No | Worker container image |

---

## Verifying Installation

### Check Backend Health

```bash
# Health check
curl http://localhost:3000/api/health

# Expected response
{"status":"healthy","timestamp":"2026-04-19T10:00:00.000Z"}
```

### Check Database Connection

```bash
# Connect to PostgreSQL
psql -h localhost -U postgres -d nl2sql_backend

# List tables
\dt

# Should show: conversations, messages, user_sessions, activity_logs

# Exit
\q
```

### Check Redis Connection

```bash
# Connect to Redis
redis-cli

# Ping Redis
PING

# Should return: PONG

# Exit
EXIT
```

---

## Development Workflow

### Terminal 1: Support Services
```bash
# Start and monitor services
docker-compose up

# Keep this running in the background
```

### Terminal 2: Backend Server
```bash
# In cloud-backend directory
npm run dev

# Logs will appear here as requests come in
```

### Terminal 3: Testing
```bash
# Generate JWT token
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"user123","email":"user@example.com"}'

# Connect WebSocket (see API.md for examples)
```

---

## Database Reset (Development)

If you need to reset the database:

```bash
# Option 1: Delete and recreate volume
docker-compose down -v
docker-compose up -d

# Option 2: Connect to psql and drop tables
psql -h localhost -U postgres -d nl2sql_backend
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
\q

# Option 3: Run migration again
npm run migrate
```

---

## Production Deployment

### Option A: Dedicated Server

```bash
# 1. SSH into production server
ssh user@production.example.com

# 2. Clone repository
git clone <repo>
cd cloud-backend

# 3. Configure environment
cp .env.example .env
# Edit .env with production values

# 4. Install dependencies
npm install

# 5. Start backend with process manager
npm install -g pm2
pm2 start npm --name cloud-backend -- start

# 6. Keep it running on reboot
pm2 startup
pm2 save
```

### Option B: CI/CD Pipeline

```yaml
# Example GitHub Actions workflow
deploy:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v2
    - uses: actions/setup-node@v2
      with:
        node-version: '18'
    
    - run: npm install
    - run: npm run migrate
    - run: npm start &
```

### Option C: Linux Service

Create `/etc/systemd/system/cloud-backend.service`:

```ini
[Unit]
Description=Cloud Backend Service
After=network.target

[Service]
Type=simple
User=backend
WorkingDirectory=/opt/cloud-backend
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable cloud-backend
sudo systemctl start cloud-backend
```

---

## Troubleshooting

### Backend won't start

```bash
# Check logs
npm run dev  # More verbose output

# Common issues:
# - Port 3000 in use: lsof -i :3000
# - Database not running: docker-compose ps
# - Node modules missing: npm install
# - .env not configured: cp .env.example .env
```

### Database connection error

```bash
# Test PostgreSQL
psql -h localhost -U postgres -d nl2sql_backend

# Check .env settings
grep DB_ .env

# Check compose service
docker-compose logs postgres
```

### Redis connection error

```bash
# Test Redis
redis-cli

# Inside Redis CLI
PING

# Check compose service
docker-compose logs redis
```

### WebSocket connection fails

```bash
# Test backend health
curl http://localhost:3000/api/health

# Check token generation
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"test"}'

# Use valid token in WebSocket connection
# See docs/API.md for examples
```

---

## Next Steps

1. **Read API Documentation**: [docs/API.md](../docs/API.md)
2. **Understand Architecture**: [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)
3. **Deploy to Kubernetes**: [docs/DEPLOYMENT.md](../docs/DEPLOYMENT.md)
4. **Write Tests**: [docs/TESTING.md](../docs/TESTING.md)
5. **Implement Workers**: Build your nl2sql-worker container

---

## Support

For issues:
- Check logs: `npm run dev`
- Check Docker logs: `docker-compose logs -f`
- Read [docs/API.md](../docs/API.md)
- Review [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md)

---

**Last Updated**: 2026-04-19  
**Version**: 1.0.0
