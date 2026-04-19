# NL2SQL Integration Setup - Complete Guide

## ✅ Integration Status

Your BE-Project and cloud-backend are now properly integrated with:

- ✅ **Unified JWT Authentication** - Synchronized token generation and verification
- ✅ **Standardized Authorization** - User field normalization (user_id/userId/userID)
- ✅ **Docker Integration** - Both services in docker-compose with orchestration
- ✅ **Database Alignment** - PostgreSQL shared backend with proper schema
- ✅ **CORS Configuration** - Environment-based cross-origin settings
- ✅ **Environment Management** - Standardized .env files with examples
- ✅ **Production Ready** - Separate production docker-compose configuration
- ✅ **Documentation** - Complete integration and deployment guides

## 🚀 Quick Start

### Option 1: Docker Compose (Recommended)

```bash
# Navigate to cloud-backend
cd cloud-backend

# Copy environment file
cp .env.example .env

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option 2: Local Development

**Terminal 1 - BE-Project:**
```bash
cd BE-Project
npm install
npm run dev
```

**Terminal 2 - Cloud Backend:**
```bash
cd cloud-backend
npm install
npm run migrate  # Initialize database
npm run dev
```

## 📋 Key Integration Points

### 1. JWT Authentication
- **Environment Variable**: `JWT_SECRET` (shared across both services)
- **Token Format**: Includes normalized fields for compatibility
- **Expiry**: `JWT_EXPIRY` (default: 24h)

```javascript
// Generate token (works in both services)
const token = generateToken({
  userId: 'user123',
  userName: 'john_doe',
  email: 'john@example.com'
});

// Token contains:
{
  user_id: 'user123',
  userId: 'user123',
  userID: 'user123',
  username: 'john_doe',
  email: 'john@example.com'
}
```

### 2. Database Schema
- **PostgreSQL 16+** shared backend
- Auto-migration on startup (no manual setup needed)
- Tables: conversations, messages, user_sessions, activity_logs

### 3. WebSocket Communication
- Authentication via JWT token in headers
- Heartbeat mechanism every 30 seconds
- Session management via Redis

### 4. CORS Configuration
```env
# Development (accepts from multiple origins)
CORS_ORIGIN=http://localhost:3000,http://localhost:8000,http://localhost:8080,*

# Production (only specified origins)
CORS_ORIGIN=https://app.example.com,https://api.example.com
```

## 📁 File Structure

### Modified/Created Files

**BE-Project:**
- ✅ `.env` - Updated with standard JWT_SECRET format
- ✅ `.env.example` - Created with all required variables
- ✅ `Dockerfile` - Created for containerization
- ✅ `util/userAuth.js` - Updated for field normalization
- ✅ `middleware/websocket.auth.js` - Updated for compatibility
- ✅ `index.js` - Updated for env-based CORS and PORT

**cloud-backend:**
- ✅ `.env.example` - Updated with BE-Project integration notes
- ✅ `.env.prod.example` - Created for production deployment
- ✅ `docker-compose.yml` - Updated with BE-Project service
- ✅ `docker-compose.prod.yml` - Created for production
- ✅ `src/middleware/auth.js` - Enhanced with normalization and token generation
- ✅ `src/index.js` - Updated CORS handling
- ✅ `INTEGRATION_GUIDE.md` - Created comprehensive integration guide
- ✅ `validate-deployment.sh` - Created deployment validator
- ✅ `deploy.sh` - Created deployment helper script

## 🔍 Environment Variables Reference

### Shared Variables (Both Services)
```env
JWT_SECRET=your-super-secret-jwt-key-change-in-production-12345
JWT_EXPIRY=24h
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000,http://localhost:8000,http://localhost:8080,*
```

### BE-Project Specific
```env
PORT=8080
LOCAL_DB_TYPE=postgres
PG_DATABASE_USER=postgres
PG_DATABASE_HOST=localhost
PG_DATABASE_NAME=local_db_setup
PG_DATABASE_PORT=5432
```

### Cloud Backend Specific
```env
PORT=3000
DB_HOST=postgres
DB_PORT=5432
DB_NAME=nl2sql_backend
DB_USER=postgres
DB_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
K8S_NAMESPACE=default
```

## ✔️ Pre-Deployment Checklist

- [ ] Both `.env` files exist and contain identical `JWT_SECRET`
- [ ] PostgreSQL is running and accessible
- [ ] Redis is running (if using sessions)
- [ ] `CORS_ORIGIN` values match your frontend/client URLs
- [ ] All required npm packages installed in both projects
- [ ] Database migration has run successfully
- [ ] Run validation: `bash validate-deployment.sh` (if using Docker)
- [ ] Test authentication: See Testing section below

## 🧪 Testing Integration

### 1. Health Check
```bash
# Cloud Backend
curl http://localhost:3000/api/health

# BE-Project
curl http://localhost:8080

# Should return 200 OK
```

### 2. Generate and Test Token
```bash
# Generate JWT token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/token \
  -H "Content-Type: application/json" \
  -d '{"userId":"test123","userName":"testuser","email":"test@example.com"}' \
  | jq -r '.token')

# Use token in authenticated request
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/conversations
```

### 3. Test WebSocket Connection
```bash
# Install wscat globally
npm install -g wscat

# Connect to WebSocket with token
TOKEN="your-jwt-token-here"
wscat -c ws://localhost:3000 \
  --header "Authorization: Bearer $TOKEN"
```

## 🚨 Troubleshooting

### JWT Token Issues
```
Error: Invalid token or token expired
```
**Fix**: Ensure `JWT_SECRET` matches in both .env files

### CORS Blocking Requests
```
Access to XMLHttpRequest blocked by CORS policy
```
**Fix**: Add your client URL to `CORS_ORIGIN` environment variable

### Database Connection Failed
```
Error connecting to PostgreSQL
```
**Fix**: Check if PostgreSQL is running and credentials are correct

### Docker Compose Services Won't Start
```bash
# Check logs
docker-compose logs

# Rebuild containers
docker-compose down
docker-compose build --no-cache
docker-compose up -d

# Check specific service logs
docker-compose logs cloud-backend
docker-compose logs be-project
docker-compose logs postgres
```

### WebSocket Connection Fails
```
WebSocket handshake: Unexpected response code 401
```
**Fix**: Verify that JWT token is being sent correctly in the Authorization header

## 📊 Service Status & Logs

```bash
# Check running services
docker-compose ps

# View cloud backend logs
docker-compose logs -f cloud-backend

# View BE-Project logs
docker-compose logs -f be-project

# View database logs
docker-compose logs -f postgres

# View all logs
docker-compose logs -f
```

## 🔄 Stopping & Cleaning Up

```bash
# Stop all services
docker-compose down

# Stop and remove volumes (clean database)
docker-compose down -v

# Remove all containers, images, volumes
docker-compose down -v --rmi all
```

## 📈 Production Deployment

### Using Production Compose
```bash
cd cloud-backend
cp .env.prod.example .env
# Update .env with production values
docker-compose -f docker-compose.prod.yml up -d
```

### Using Kubernetes
See `kubernetes/` folder for manifests and deployment instructions.

### Key Production Settings
- Change `JWT_SECRET` to a strong random value
- Set `NODE_ENV=production`
- Update `CORS_ORIGIN` to production domain
- Use strong passwords for PostgreSQL and Redis
- Enable HTTPS/SSL for WebSocket (`wss://`)
- Configure resource limits in K8s manifests
- Setup backup strategy for PostgreSQL

## 🔐 Security Reminders

1. **Change JWT_SECRET**: In production, generate a new secure random key
   ```bash
   openssl rand -base64 32
   ```

2. **Database Passwords**: Use strong, unique passwords

3. **CORS Origins**: Restrict to only your frontend domain

4. **HTTPS**: Always use HTTPS in production

5. **API Rate Limiting**: Consider adding rate limiting middleware

6. **Input Validation**: All endpoints validate user input

## 📚 Additional Resources

- **Integration Guide**: See `INTEGRATION_GUIDE.md`
- **Architecture Docs**: See `docs/ARCHITECTURE.md`
- **API Documentation**: See `docs/API.md`
- **Quick Reference**: See `docs/QUICK_REFERENCE.md`

## 🆘 Need Help?

1. Check logs: `docker-compose logs -f`
2. Review `INTEGRATION_GUIDE.md`
3. Validate setup: `bash validate-deployment.sh`
4. Verify environment variables match documentation
5. Test individual services in isolation

## ✨ What's New in This Integration

✅ Unified JWT authentication across services
✅ Standardized user field names and normalization
✅ Docker-based deployment for both services
✅ Automatic database schema initialization
✅ Environment-based configuration
✅ Production-ready docker-compose setup
✅ Comprehensive documentation
✅ Deployment validation scripts
✅ Helper scripts for common tasks
✅ CORS and security best practices

---

**Configuration Complete!** 🎉

Your BE-Project and cloud-backend are now fully integrated and ready for deployment. Start with:

```bash
cd cloud-backend
docker-compose up -d
```

Then verify with:

```bash
curl http://localhost:3000/api/health
curl http://localhost:8080
```

Happy deploying! 🚀
