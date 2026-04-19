# Deployment Guide

This guide covers deploying the Cloud Control Backend to different environments.

## Table of Contents

1. [Local Development](#local-development)
2. [Docker Deployment](#docker-deployment)
3. [Kubernetes Deployment](#kubernetes-deployment)
4. [Production Deployment](#production-deployment)
5. [Monitoring & Troubleshooting](#monitoring--troubleshooting)

---

## Local Development

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Git

### Setup Steps

```bash
# 1. Clone repository
git clone <repo-url>
cd cloud-backend

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env

# 4. Configure .env for local development
cat > .env << EOF
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

JWT_SECRET=dev_secret_key_123

DB_HOST=localhost
DB_PORT=5432
DB_NAME=nl2sql_backend
DB_USER=postgres
DB_PASSWORD=postgres

REDIS_HOST=localhost
REDIS_PORT=6379

K8S_NAMESPACE=default
EOF

# 5. Initialize database
npm run migrate

# 6. Start server
npm run dev
```

Server will be available at `http://localhost:3000`

---

## Native Setup (REQUIRED - Backend, PostgreSQL, Redis all run natively)

### Prerequisites

- Node.js 18+
- PostgreSQL 14+ (native, not containerized)
- Redis 7+ (native, not containerized)
- Git
- Kubernetes cluster (for worker pods only)

### Setup on macOS

```bash
# 1. Install PostgreSQL and Redis
brew install postgresql@15 redis

# 2. Start services
brew services start postgresql@15
brew services start redis

# 3. Verify they're running
psql -U postgres -c "SELECT version();"
redis-cli ping

# 4. Clone and setup backend
git clone <repo-url>
cd cloud-backend
npm install
cp .env.example .env

# 5. Initialize database
npm run migrate

# 6. Start backend
npm run dev
```

### Setup on Ubuntu/Debian

```bash
# 1. Install PostgreSQL and Redis
sudo apt update
sudo apt install postgresql postgresql-contrib redis-server

# 2. Start services
sudo systemctl start postgresql
sudo systemctl start redis-server
sudo systemctl enable postgresql
sudo systemctl enable redis-server

# 3. Verify they're running
sudo -u postgres psql -c "SELECT version();"
redis-cli ping

# 4. Clone and setup backend
git clone <repo-url>
cd cloud-backend
npm install
cp .env.example .env

# 5. Initialize database
npm run migrate

# 6. Start backend
npm run dev
```

### Setup on Windows

```powershell
# 1. Download and install
# PostgreSQL: https://www.postgresql.org/download/windows/
# Redis: https://github.com/microsoftarchive/redis/releases (or WSL2 + apt install)

# 2. After installation, verify services are running
# - PostgreSQL: should run on localhost:5432
# - Redis: should run on localhost:6379

# 3. Test connections
psql -U postgres -h localhost -c "SELECT version();"
redis-cli ping

# 4. Clone and setup backend
git clone <repo-url>
cd cloud-backend
npm install
cp .env.example .env

# 5. Initialize database
npm run migrate

# 6. Start backend
npm run dev
```

### Verify Backend is Running

```bash
# Test API health
curl http://localhost:3000/api/health

# Expected response:
# {"status":"healthy","timestamp":"2024-01-15T10:30:00Z","uptime":1234}
```

---

## Docker - NOT USED FOR BACKEND OR SUPPORT SERVICES

**IMPORTANT**: Backend, PostgreSQL, and Redis do NOT run in Docker containers. They run natively on your system.

Only **worker pods** (created per user) run in Docker/Kubernetes.

If you previously had Docker Compose running, stop it:
```bash
docker-compose down
```

Then follow the native setup above for your operating system.

---

## Kubernetes Deployment

## Kubernetes Integration (For Worker Pods Only)

**IMPORTANT**: The Cloud Backend itself runs NATIVELY on your machine. Kubernetes is used ONLY for managing per-user worker pods.

### Architecture

- **Cloud Backend**: Runs natively on your system (not in Kubernetes)
- **Worker Pods**: Kubernetes-managed containers, created per user by the backend
- **PostgreSQL & Redis**: Run natively on your system (not in Kubernetes)

### Prerequisites

- Kubernetes cluster 1.24+
- `kubectl` configured locally
- Container registry access
- Backend running natively (see Native Setup section above)
- PostgreSQL and Redis running natively (see Native Setup section above)

### Step 1: Create Kubernetes Resources

```bash
# 1. Create namespace (optional)
kubectl create namespace nl2sql

# 2. Apply ConfigMap (worker config)
kubectl apply -f kubernetes/config.yaml

# 3. Create RBAC (service account - let backend create pods)
kubectl apply -f kubernetes/rbac.yaml

# 4. Verify
kubectl get serviceaccount cloud-backend
kubectl get clusterrole cloud-backend-role
kubectl get configmap cloud-backend-config
```

### Step 2: Configure Backend for Kubernetes

Ensure your `.env` file has correct Kubernetes settings:

```env
K8S_NAMESPACE=nl2sql
K8S_SERVICE_ACCOUNT=cloud-backend
K8S_CONTAINER_IMAGE=nl2sql-worker:latest
K8S_CONTAINER_PORT=8080
K8S_CPU_REQUEST=500m
K8S_CPU_LIMIT=2000m
K8S_MEMORY_REQUEST=512Mi
K8S_MEMORY_LIMIT=2Gi
```

### Step 3: Start Backend Natively

```bash
# From your cloud-backend directory, start the backend
npm run dev

# The backend will:
# - Connect to native PostgreSQL on localhost:5432
# - Connect to native Redis on localhost:6379
# - Access Kubernetes API to create worker pods on demand
```

### Step 4: Test Worker Pod Creation

Worker pods are created automatically when users connect. To test:

```bash
# Connect to backend via API/WebSocket
curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"user1","userName":"Test User","email":"test@example.com"}'

# Check if worker pod was created
kubectl get pods -n nl2sql

# View pod logs
kubectl logs -f pod/nl2sql-worker-user1 -n nl2sql
```

### Kubernetes Manifests (For Reference)

The following manifests are provided but applied manually:

- **config.yaml**: ConfigMap with worker pod configuration
- **rbac.yaml**: ServiceAccount and ClusterRole for pod creation
- **deployment.yaml**: Example deployment (FOR REFERENCE ONLY - backend runs natively)
- **dependencies.yaml**: Example static resources (FOR REFERENCE ONLY - run natively)
- **hpa.yaml**: Example HPA (FOR REFERENCE ONLY)

### Monitoring Worker Pods

```bash
# List all worker pods
kubectl get pods -n nl2sql -l app=nl2sql-worker

# Watch pods as they're created/deleted
kubectl get pods -n nl2sql -l app=nl2sql-worker --watch

# Get detailed information
kubectl describe pod nl2sql-worker-<userId> -n nl2sql

# View logs
kubectl logs nl2sql-worker-<userId> -n nl2sql

# Get resource usage
kubectl top pod nl2sql-worker-<userId> -n nl2sql
```

### Cleanup Worker Pods

Worker pods are automatically deleted when idle (configurable timeout). To manually clean up:

```bash
# Delete specific pod
kubectl delete pod nl2sql-worker-<userId> -n nl2sql

# Delete all worker pods
kubectl delete pods -l app=nl2sql-worker -n nl2sql
```

---

## Production Deployment

**IMPORTANT**: Production deployment follows the same architecture: Backend runs natively on production servers, not in containers.

### Pre-Deployment Checklist

- [ ] PostgreSQL 14+ installed and running on production server
- [ ] Redis 7+ installed and running on production server
- [ ] PostgreSQL daily backups configured
- [ ] Redis persistence enabled
- [ ] JWT_SECRET changed to strong random value (32+ chars)
- [ ] DB credentials secured (use strong passwords)
- [ ] CORS configured for your production domain
- [ ] TLS/HTTPS enabled with valid certificates
- [ ] Logging configured for persistent storage
- [ ] Monitoring/alerting set up
- [ ] Backups automated and tested
- [ ] Load testing completed

### High Availability Setup

#### Multiple Backend Instances (Load Balanced)

Deploy backend on multiple servers with load balancing:

```bash
# Production server 1
ssh prod1.example.com
cd /var/cloud-backend
npm install --production
cp .env.production .env
npm run migrate
npm start

# Production server 2
ssh prod2.example.com
cd /var/cloud-backend
npm install --production
cp .env.production .env
npm run migrate
npm start

# Both servers connect to shared PostgreSQL and Redis
# PostgreSQL: prod-db.example.com:5432
# Redis: prod-cache.example.com:6379
```

Configure load balancer (nginx example):

```nginx
upstream cloud_backend {
    server backend1.example.com:3000;
    server backend2.example.com:3000;
    server backend3.example.com:3000;
}

server {
    listen 80;
    server_name api.example.com;
    
    location / {
        proxy_pass http://cloud_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Database Replication

For PostgreSQL high availability:

```bash
# Primary server
psql -U postgres
CREATE PUBLICATION backend_pub FOR ALL TABLES;

# Standby server (replication)
# Use pg_basebackup for replication setup
pg_basebackup -h primary.example.com -U postgres -D /var/lib/postgresql/14/main

# Or use WAL archiving + restore_command for PITR
```

#### Redis Persistence

```bash
# On production Redis server
# Edit /etc/redis/redis.conf:

# Enable persistence
save 900 1        # Save after 900s if at least 1 key changed
save 300 10       # Save after 300s if at least 10 keys changed
save 60 10000     # Save after 60s if at least 10000 keys changed

# Enable AOF
appendonly yes
appendfilename "appendonly.aof"

# Restart Redis
sudo systemctl restart redis-server
```

### TLS/HTTPS Configuration

#### Using Let's Encrypt (Recommended)

```bash
# 1. Install Certbot
sudo apt install certbot python3-certbot-nginx

# 2. Get certificate
sudo certbot certonly --standalone -d api.example.com -d www.example.com

# 3. Update nginx config
# /etc/nginx/sites-available/default:

server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
    
    # Rest of config...
}

# 4. Auto-renew (runs daily)
sudo systemctl enable certbot.timer
```

### Monitoring Setup

#### Structured Logging

```bash
# Access logs location
tail -f /var/log/cloud-backend/app.log
tail -f /var/log/cloud-backend/error.log

# Forward to centralized logging
# Edit .env:
LOG_FILE=/var/log/cloud-backend/app.log
LOG_LEVEL=info
```

#### Prometheus Metrics

Backend endpoints for monitoring:

```bash
# Health check
curl https://api.example.com/api/health

# System status
curl https://api.example.com/api/status

# WebSocket stats
curl https://api.example.com/api/ws-stats
```

#### Monitoring Tools

Useful tools for production monitoring:

- **Prometheus**: Scrape metrics from /metrics endpoint (add if needed)
- **Grafana**: Visualize metrics
- **ELK Stack**: Log aggregation
- **DataDog**: All-in-one monitoring
- **New Relic**: Application performance monitoring

Sample dashboard metrics to track:

- Active WebSocket connections
- Active worker pods per user
- Database connection pool usage
- Redis memory usage
- Request latency (p50, p95, p99)
- Error rate (400s, 500s)
- Backend uptime
- CPU/memory usage

### Health Checks & Readiness

```bash
# Liveness check (is backend running?)
curl -f https://api.example.com/api/health || exit 1

# Readiness check (is backend ready to accept traffic?)
curl -f https://api.example.com/api/health || exit 1

# Run healthchecks every 30 seconds via cron:
*/1 * * * * curl -f https://api.example.com/api/health || systemctl restart cloud-backend
```

### Manual Health Checks

```bash
# Quick health  
curl -s http://localhost:3000/api/health | jq .

# Server status
curl -s http://localhost:3000/api/status | jq .

# Database connection
curl -s http://localhost:3000/api/health | grep healthy
```

---

## Auto-Scaling

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: cloud-backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: cloud-backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

Apply HPA:
```bash
kubectl apply -f kubernetes/hpa.yaml

# Monitor scaling
kubectl watch hpa cloud-backend-hpa
```

---

## Monitoring & Troubleshooting

### View Logs

```bash
# Stream logs
kubectl logs -f deployment/cloud-backend

# View specific pod logs
kubectl logs -f pod/cloud-backend-abc123

# View previous logs
kubectl logs --previous pod/cloud-backend-abc123
```

### Debug Container

```bash
# Shell into pod
kubectl exec -it pod/cloud-backend-abc123 -- sh

# Install debug tools
apk add --no-cache curl jq

# Test database
curl http://postgres:5432

# Test Redis
redis-cli -h redis ping
```

### Common Issues

#### Pod stuck in CrashLoopBackOff
```bash
# Check logs
kubectl logs pod/name --previous

# Describe pod for events
kubectl describe pod cloud-backend-xyz

# Check resource limits
kubectl top pod

# Increase memory limit if needed
kubectl set resources deployment cloud-backend \
  -c=cloud-backend \
  --limits=memory=2Gi,cpu=2000m
```

#### ImagePullBackOff
```bash
# Check image exists in registry
docker pull registry.example.com/cloud-backend:v1.0.0

# Check credentials
kubectl get secrets | grep registry

# Update image in deployment
kubectl set image deployment/cloud-backend \
  cloud-backend=registry.example.com/cloud-backend:v1.0.1
```

#### Database Connection Errors
```bash
# Test PostgreSQL accessibility
kubectl run -it --rm debug --image=postgres:16-alpine -- \
  psql -h postgres -U postgres -d nl2sql_backend

# Check PostgreSQL service
kubectl get svc postgres

# Verify credentials in secret
kubectl get secret cloud-backend-secrets -o yaml
```

---

## Rollback Procedure

```bash
# Check rollout history
kubectl rollout history deployment/cloud-backend

# Rollback to previous version
kubectl rollout undo deployment/cloud-backend

# Rollback to specific revision
kubectl rollout undo deployment/cloud-backend --to-revision=2

# Verify rollback
kubectl rollout status deployment/cloud-backend
```

---

## Cleanup

```bash
# Delete everything
kubectl delete deployment cloud-backend
kubectl delete service cloud-backend
kubectl delete secret cloud-backend-secrets
kubectl delete configmap cloud-backend-config

# Or delete entire namespace
kubectl delete namespace nl2sql
```

---

## Support & Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)
- [Node.js Best Practices](https://nodejs.org/en/docs/guides/)

---

**Last Updated**: 2026-04-19
