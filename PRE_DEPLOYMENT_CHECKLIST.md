# Pre-Deployment Verification Checklist

## ✓ Phase 1: Configuration Verification [5-10 minutes]

### JWT & Authentication
- [ ] Both projects have `.env` files created
- [ ] `JWT_SECRET` values are IDENTICAL in both `.env` files
- [ ] `JWT_SECRET` is NOT stored as default/example value
- [ ] `JWT_EXPIRY` is set (default: 24h)
- [ ] Auth modules support field normalization (user_id/userId/userID)

### Environment Variables
- [ ] `NODE_ENV` is set to `development` or `production`
- [ ] `PORT` values don't conflict (BE-Project: 8080, Cloud: 3000)
- [ ] `CORS_ORIGIN` includes all frontend URLs
- [ ] Database variables are set correctly

### Database Configuration
- [ ] PostgreSQL version is 13 or higher
- [ ] Database user and password are set
- [ ] Database name is specified
- [ ] Database connection string is correct

---

## ✓ Phase 2: Docker Verification [5 minutes]

### Docker Setup
- [ ] Docker is installed and running: `docker --version`
- [ ] Docker Compose is installed: `docker-compose --version`
- [ ] No conflicting containers on ports 3000, 8080, 5432, 6379
- [ ] Check: `docker ps` (should show any existing containers)

### dockerfile & Compose Files
- [ ] `BE-Project/Dockerfile` exists
- [ ] `cloud-backend/docker-compose.yml` includes both services
- [ ] `cloud-backend/docker-compose.prod.yml` exists (production)
- [ ] All volume mounts are correct
- [ ] Health checks are configured

---

## ✓ Phase 3: Code Quality Verification [5-10 minutes]

### Authentication Code
- [ ] `BE-Project/util/userAuth.js` has `normalizeUserFields()`
- [ ] `BE-Project/middleware/websocket.auth.js` supports JWT_SECRET env var
- [ ] `cloud-backend/src/middleware/auth.js` has `generateToken()`
- [ ] Token format includes all user field variations

### CORS Configuration
- [ ] `BE-Project/index.js` reads `CORS_ORIGIN` from env
- [ ] `cloud-backend/src/index.js` parses comma-separated origins
- [ ] CORS credentials are enabled where needed

### Port Configuration
- [ ] `BE-Project/index.js` reads `PORT` from env
- [ ] `cloud-backend` properly uses configured PORT
- [ ] No hardcoded port numbers in code

---

## ✓ Phase 4: Dependency Verification [5 minutes]

### Critical Dependencies
- [ ] Both projects have `jsonwebtoken` package
- [ ] Both projects have `express` and `cors`
- [ ] Cloud Backend has `pg` and `redis`
- [ ] Cloud Backend has `ws` for WebSocket
- [ ] Package versions are compatible (Node 18+)

### Dependency Installation
- [ ] Run `npm install` in `BE-Project`
- [ ] Run `npm install` in `cloud-backend`
- [ ] No dependency conflicts reported
- [ ] No security vulnerabilities (npm audit)

---

## ✓ Phase 5: Documentation Verification [2 minutes]

### Documentation Files
- [ ] `INTEGRATION_GUIDE.md` exists and is readable
- [ ] `SETUP_COMPLETE.md` exists with quick start
- [ ] `INTEGRATION_CHANGES_SUMMARY.md` documents all changes
- [ ] `QUICK_DEPLOY_REFERENCE.md` provides quick commands

### Environment Examples
- [ ] `.env.example` files exist for both projects
- [ ] `.env.prod.example` exists for production settings
- [ ] Examples include all required variables
- [ ] Examples include comments explaining settings

---

## ✓ Phase 6: Local Testing [10-15 minutes]

### Service Startup (Option A: Docker Compose)
```bash
cd cloud-backend
docker-compose up -d

# Wait 30-40 seconds for all services to start
sleep 40

# Check all running
docker-compose ps
```

### Service Startup (Option B: Local Node)
```bash
# Terminal 1: BE-Project
cd BE-Project
npm install
npm run dev

# Terminal 2: Cloud Backend
cd cloud-backend
npm install
npm run migrate
npm run dev
```

### Health Checks
- [ ] Cloud Backend responds: `curl http://localhost:3000/api/health`
- [ ] BE-Project responds: `curl http://localhost:8080`
- [ ] Database is accessible
- [ ] Redis is accessible (if needed)

### Endpoint Testing
- [ ] Generate token: `curl -X POST http://localhost:3000/api/auth/token ...`
- [ ] Verify token works in requests
- [ ] WebSocket connection succeeds with token

---

## ✓ Phase 7: Production Readiness [5 minutes]

### Security
- [ ] Generated strong `JWT_SECRET` for production
- [ ] Updated `DB_PASSWORD` to strong value
- [ ] `NODE_ENV` will be set to `production`
- [ ] SSL/HTTPS certificates are available

### Configuration
- [ ] Updated `CORS_ORIGIN` to production domain
- [ ] Updated `DB_HOST` to production database
- [ ] Updated `REDIS_HOST` if using external Redis
- [ ] All hardcoded URLs/domains removed

### Monitoring
- [ ] Logging is configured (Winston in place)
- [ ] Health check endpoints verified
- [ ] Container restart policy set
- [ ] Resource limits defined (CPU, Memory)

---

## ✓ Phase 8: Validation [3-5 minutes]

### Run Validation Script
```bash
cd cloud-backend
bash validate-deployment.sh
```

### Expected Output
- [ ] All environment checks ✓ PASS
- [ ] Docker configuration ✓ PASS
- [ ] Dockerfile presence ✓ PASS
- [ ] Package dependencies ✓ PASS
- [ ] Configuration files ✓ PASS
- [ ] Auth compatibility ✓ PASS
- [ ] Database configuration ✓ PASS
- [ ] Total: All checks passed

---

## 🚀 Deployment Commands

### Development Deployment
```bash
cd cloud-backend
docker-compose up -d
```

### Production Deployment
```bash
cd cloud-backend
docker-compose -f docker-compose.prod.yml up -d
```

### Verify Deployment
```bash
docker-compose ps
docker-compose logs -f
```

---

## ⚠️ Known Issues & Resolutions

| Issue | Resolution |
|-------|------------|
| JWT mismatch | Verify JWT_SECRET identical in both .env |
| CORS errors | Add frontend URL to CORS_ORIGIN |
| Port conflicts | Kill processes or change PORT env var |
| DB connection | Verify PostgreSQL running, credentials correct |
| WebSocket fails | Check token in Authorization header |

---

## 📋 Sign-Off Checklist

- [ ] All phase 1-7 items verified
- [ ] Validation script passes (phase 8)
- [ ] Local testing successful
- [ ] Production config ready
- [ ] Team notified and ready
- [ ] Rollback plan prepared
- [ ] Monitoring configured
- [ ] **READY FOR DEPLOYMENT** ✅

---

## 📞 Pre-Deployment Support

### Get Help
1. Review `INTEGRATION_GUIDE.md`
2. Check `QUICK_DEPLOY_REFERENCE.md`
3. Run `validate-deployment.sh`
4. Check `docker-compose logs -f`

### Emergency Stop
```bash
docker-compose down
```

---

**Last Updated**: April 2026  
**Version**: 1.0  
**Status**: Ready for Deployment ✅

---

## Next Steps After Verification

1. ✅ Complete all checklist items
2. ✅ Run final validation script
3. ✅ Deploy using appropriate docker-compose file
4. ✅ Monitor logs during startup
5. ✅ Perform smoke tests
6. ✅ Announce service availability
7. ✅ Monitor for first 24 hours

**YOU ARE NOW READY TO DEPLOY!** 🚀
