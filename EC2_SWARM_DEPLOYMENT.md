s# EC2 Docker Swarm Deployment

This service runs natively on EC2 and manages one Docker Swarm AI service per user. `BE-Project` stays on the local machine and calls this service through the EC2 public URL.

## EC2 Prerequisites

Install:

- Node.js 18+
- PostgreSQL 14+
- Redis 7+
- Docker Engine

Initialize Docker Swarm on the EC2 host:

```bash
docker swarm init
docker network create --driver overlay --attachable nl2sql-ai
docker pull docker.io/yourusername/nl2sql-ai-server:latest
```

Open security group inbound ports:

- `3000` for `cloud-backend`
- the configured AI container port range, default `9100-9199`

## cloud-backend `.env`

```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

JWT_SECRET=replace-with-the-same-secret-used-by-local-be-project
JWT_EXPIRY=24h

DB_HOST=localhost
DB_PORT=5432
DB_NAME=nl2sql_backend
DB_USER=postgres
DB_PASSWORD=replace-me

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

CORS_ORIGIN=http://localhost:8080,http://localhost:8000

DOCKER_BIN=docker
DOCKER_NETWORK=nl2sql-ai
DOCKER_SERVICE_PREFIX=ai-user-
PUBLIC_CONTAINER_HOST=<ec2-public-ip-or-domain>
AI_SERVER_IMAGE=docker.io/yourusername/nl2sql-ai-server:latest
OLLAMA_URL=http://localhost:11434/api/generate
AI_SERVER_PORT=9001
AI_SERVER_PORT_START=9100
AI_SERVER_PORT_END=9199

CONTAINER_IDLE_TIMEOUT=3600000
CONTAINER_CHECK_INTERVAL=60000
```

## Run

```bash
npm install
npm run migrate
npm start
```

For production process management, run the native Node process with `pm2` or a `systemd` service.

## Local BE-Project `.env`

```bash
JWT_SECRET=replace-with-the-same-secret-used-by-cloud-backend
CLOUD_BACKEND_URL=http://<ec2-public-ip-or-domain>:3000
```

## Smoke Test

From your local machine:

```bash
curl http://<ec2-public-ip-or-domain>:3000/health
curl http://<ec2-public-ip-or-domain>:3000/api/health
curl -X POST http://<ec2-public-ip-or-domain>:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"smoke-test-user","email":"test@example.com"}'
```

The token endpoint should create or reuse a Swarm service named like `ai-user-smoke-test-user` and return its public container URL.
