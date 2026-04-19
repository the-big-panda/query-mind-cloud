# Quick Reference - Deployment Checklist

## 5-Minute Deployment

### 1. Check Prerequisites
```bash
docker --version      # Docker 20.10+
docker-compose --version  # 1.29+
node --version        # 18.0.0+
```

### 2. Configure Environment
```bash
# In cloud-backend directory
cp .env.example .env

# For production: cp .env.prod.example .env
# Edit .env with your values
```

### 3. Start Services
```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Verify Services
```bash
# Check running containers
docker-compose ps

# Test endpoints
curl http://localhost:3000/api/health
curl http://localhost:8080

# View logs
docker-compose logs -f
```

### 5. Done! ✅
Services running at:
- **Cloud Backend**: http://localhost:3000
- **BE-Project**: http://localhost:8080
- **Database**: localhost:5432
- **Redis**: localhost:6379

---

## Environment Variables - Critical

```env
# MUST MATCH IN BOTH SERVICES
JWT_SECRET=your-super-secret-key

# Service Configuration
NODE_ENV=development|production
PORT=3000|8080
CORS_ORIGIN=http://localhost:3000,http://localhost:8080

# Database (PostgreSQL)
DB_HOST=postgres|localhost
DB_USER=postgres
DB_PASSWORD=your-password
DB_NAME=nl2sql_backend

# Redis
REDIS_HOST=redis|localhost
REDIS_PORT=6379
```

---

## Troubleshooting Quick Fixes

| Problem | Solution |
|---------|----------|
| Services won't start | `docker-compose logs` check error messages |
| Can't connect to DB | Verify DB_HOST, DB_USER, DB_PASSWORD match |
| CORS errors | Add frontend URL to CORS_ORIGIN |
| JWT auth fails | Ensure JWT_SECRET is identical in both |
| WebSocket fails | Verify token is sent in Authorization header |
| Port already in use | Change PORT env var or `docker-compose down` |

---

## Common Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f service-name

# Restart service
docker-compose restart service-name

# View specific container
docker ps | grep nl2sql

# Access service shell
docker-compose exec cloud-backend sh

# Stop and remove all
docker-compose down -v --rmi all
```

---

## Files to Check

- **Config**: Check `/cloud-backend/.env` exists
- **Docker**: Verify `docker-compose.yml` is present
- **Auth**: Verify JWT_SECRET in both `.env` files
- **Logs**: View with `docker-compose logs -f`

---

## Validation

```bash
# Run validation script
bash validate-deployment.sh

# Expected: All checks pass ✓
```

---

## Production Deployment

1. Update `.env` with production values
2. Use `docker-compose.prod.yml`:
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```
3. Configure HTTPS/SSL
4. Setup monitoring
5. Configure backups

---

## Support Resources

- **Full Guide**: Read `INTEGRATION_GUIDE.md`
- **All Changes**: See `INTEGRATION_CHANGES_SUMMARY.md`
- **Setup Status**: Check `SETUP_COMPLETE.md`

---

## Emergency Contacts & Debugging

If services don't start:
1. Check Docker is running: `docker ps`
2. Check logs: `docker-compose logs`
3. Verify all .env values
4. Check ports aren't in use: `lsof -i :3000`
5. Rebuild: `docker-compose down && docker-compose build --no-cache && docker-compose up -d`

---

**Last Updated**: April 2026  
**Status**: ✅ Production Ready
