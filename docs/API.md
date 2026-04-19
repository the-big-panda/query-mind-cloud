# Cloud Control Backend - API Documentation

## Overview

The Cloud Control Backend serves as the central hub for the distributed NL2SQL system. It handles:
- User authentication via JWT
- WebSocket connections for real-time communication
- Container management via Kubernetes
- Conversation and message storage
- Routing between local backends and worker containers

**Base URL**: `http://localhost:3000` (development) or `https://cloud-backend.example.com` (production)

**WebSocket URL**: `ws://localhost:3000` (development) or `wss://cloud-backend.example.com` (production)

---

## Authentication

All endpoints except `/api/health` and `/api/auth/token` require JWT authentication.

### Headers

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### Token Structure

JWT tokens contain:
- `user_id` (required): Unique user identifier
- `email` (optional): User email address
- `exp`: Expiration time (default: 24 hours)

---

## REST API Endpoints

### Health & Status

#### GET /api/health
Health check endpoint (no authentication required)

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-04-19T10:00:00.000Z"
}
```

---

#### GET /api/status
Get server status (no authentication required)

**Response (200):**
```json
{
  "status": "running",
  "uptime": 3600.5,
  "timestamp": "2026-04-19T10:00:00.000Z",
  "environment": "production"
}
```

---

#### GET /api/ws-stats
Get WebSocket connection statistics (requires auth)

**Response (200):**
```json
{
  "connectedUsers": 42,
  "activeContainers": 35,
  "totalConnections": 47
}
```

---

### Authentication

#### POST /api/auth/token
Generate JWT authentication token (development/testing only)

**Request Body:**
```json
{
  "userId": "user123",
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "24h"
}
```

**Error (400):**
```json
{
  "error": "userId is required"
}
```

---

#### POST /api/auth/verify
Verify JWT token validity

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200):**
```json
{
  "valid": true,
  "decoded": {
    "user_id": "user123",
    "email": "user@example.com",
    "iat": 1713607200,
    "exp": 1713693600
  }
}
```

**Error (401):**
```json
{
  "error": "Invalid token"
}
```

---

### Conversations

#### GET /api/conversations
Get all conversations for authenticated user

**Query Parameters:**
- `limit` (optional, default: 20): Number of conversations to return
- `offset` (optional, default: 0): Pagination offset

**Response (200):**
```json
{
  "conversations": [
    {
      "id": 1,
      "user_id": "user123",
      "container_id": "worker-user123-abc12345",
      "title": "Conversation about sales data",
      "created_at": "2026-04-19T10:00:00.000Z",
      "updated_at": "2026-04-19T10:30:00.000Z"
    }
  ],
  "count": 1
}
```

---

#### GET /api/conversations/:conversationId
Get specific conversation with message history

**Path Parameters:**
- `conversationId`: Conversation ID

**Response (200):**
```json
{
  "conversation": {
    "id": 1,
    "user_id": "user123",
    "container_id": "worker-user123-abc12345",
    "title": "Conversation about sales data",
    "created_at": "2026-04-19T10:00:00.000Z",
    "updated_at": "2026-04-19T10:30:00.000Z"
  },
  "messages": [
    {
      "id": 1,
      "conversation_id": 1,
      "role": "user",
      "content": "Show me sales from Q1",
      "created_at": "2026-04-19T10:00:00.000Z"
    },
    {
      "id": 2,
      "conversation_id": 1,
      "role": "assistant",
      "content": "SELECT * FROM sales WHERE quarter = 1",
      "created_at": "2026-04-19T10:01:00.000Z"
    }
  ]
}
```

**Error (403):**
```json
{
  "error": "Unauthorized"
}
```

---

#### POST /api/conversations
Create new conversation

**Request Body:**
```json
{
  "containerId": "worker-user123-abc12345",
  "title": "My new conversation"
}
```

**Response (201):**
```json
{
  "id": 2,
  "user_id": "user123",
  "container_id": "worker-user123-abc12345",
  "title": "My new conversation",
  "created_at": "2026-04-19T10:30:00.000Z",
  "updated_at": "2026-04-19T10:30:00.000Z"
}
```

**Error (400):**
```json
{
  "error": "containerId is required"
}
```

---

#### PUT /api/conversations/:conversationId
Update conversation (title)

**Path Parameters:**
- `conversationId`: Conversation ID

**Request Body:**
```json
{
  "title": "Updated conversation title"
}
```

**Response (200):**
```json
{
  "id": 1,
  "user_id": "user123",
  "container_id": "worker-user123-abc12345",
  "title": "Updated conversation title",
  "created_at": "2026-04-19T10:00:00.000Z",
  "updated_at": "2026-04-19T10:35:00.000Z"
}
```

---

#### DELETE /api/conversations/:conversationId
Delete conversation and all messages

**Path Parameters:**
- `conversationId**: Conversation ID

**Response (200):**
```json
{
  "success": true
}
```

**Error (403):**
```json
{
  "error": "Unauthorized"
}
```

---

## WebSocket API

### Connection

**URL:** `ws://localhost:3000`

**Headers:**
```
Authorization: Bearer <jwt_token>
```

### Connection Flow

1. Connect with valid JWT token
2. Receive `connection_established` message
3. Start sending/receiving messages

### Message Types

#### Connect
When client connects, server responds with:

```json
{
  "type": "connection_established",
  "containerId": "worker-user123-abc12345",
  "timestamp": "2026-04-19T10:00:00.000Z"
}
```

---

#### Ping/Pong
Keep-alive mechanism

**Client sends:**
```json
{
  "type": "ping"
}
```

**Server responds:**
```json
{
  "type": "pong",
  "timestamp": "2026-04-19T10:00:00.000Z"
}
```

---

#### Query
Send NL2SQL query

**Client sends:**
```json
{
  "type": "query",
  "queryId": "query-12345",
  "content": "Show me the top 5 customers by revenue",
  "metadata": {
    "schema": "public",
    "userId": "user123"
  }
}
```

**Server acknowledges:**
```json
{
  "type": "query_received",
  "queryId": "query-12345"
}
```

**Server sends response from container:**
```json
{
  "type": "query_response",
  "queryId": "query-12345",
  "sql": "SELECT customer_id, customer_name, SUM(amount) as revenue FROM orders GROUP BY customer_id ORDER BY revenue DESC LIMIT 5",
  "results": [
    {
      "customer_id": 1,
      "customer_name": "Acme Corp",
      "revenue": 50000
    }
  ],
  "timestamp": "2026-04-19T10:00:05.000Z"
}
```

---

#### Error Messages

```json
{
  "type": "error",
  "message": "Failed to process message",
  "error": "Container connection failed",
  "timestamp": "2026-04-19T10:00:00.000Z"
}
```

---

### Reconnection Handling

If WebSocket disconnects:
- Container remains active (idle)
- Client can reconnect with same JWT
- User will reconnect to existing container
- Message history available via REST API

---

## Error Responses

### 400 Bad Request
```json
{
  "error": "Invalid request",
  "details": "Missing required field: userId"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized: Invalid token"
}
```

### 403 Forbidden
```json
{
  "error": "Unauthorized"
}
```

### 404 Not Found
```json
{
  "error": "Route not found",
  "path": "/api/unknown"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal Server Error",
  "message": "Detailed error message"
}
```

### 503 Service Unavailable
```json
{
  "error": "Database service unavailable"
}
```

---

## Rate Limiting

Currently no rate limiting is implemented. Recommended limits for production:
- 100 requests/minute per IP
- 1000 WebSocket messages/minute per user
- 10 concurrent WebSocket connections per user

---

## Container Lifecycle

### Creation
```
User connects → No container exists → Backend creates Kubernetes Pod → Pod becomes ready → User connects to pod
```

### Idle Timeout
```
User disconnects → Container remains idle for 1 hour → Container auto-deleted
```

### Maximum Containers
- 1 active container per user
- Older containers auto-deleted when new ones created

---

## Implementation Examples

### JavaScript/Node.js

```javascript
// Generate token
const response = await fetch('http://localhost:3000/api/auth/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'user123' })
});
const { token } = await response.json();

// Connect WebSocket
const ws = new WebSocket('ws://localhost:3000', {
  headers: { 'Authorization': `Bearer ${token}` }
});

ws.onopen = () => {
  console.log('Connected');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};

// Send query
ws.send(JSON.stringify({
  type: 'query',
  queryId: 'q1',
  content: 'Show top customers'
}));
```

### Python

```python
import asyncio
import aiohttp
import websockets
import json

async def main():
    # Generate token
    async with aiohttp.ClientSession() as session:
        async with session.post('http://localhost:3000/api/auth/token',
                              json={'userId': 'user123'}) as resp:
            data = await resp.json()
            token = data['token']
    
    # Connect WebSocket
    uri = f"ws://localhost:3000"
    headers = {"Authorization": f"Bearer {token}"}
    
    async with websockets.connect(uri, extra_headers=headers) as websocket:
        # Receive connection message
        msg = await websocket.recv()
        print(f"Connected: {msg}")
        
        # Send query
        await websocket.send(json.dumps({
            "type": "query",
            "queryId": "q1",
            "content": "Show top customers"
        }))
        
        # Receive response
        response = await websocket.recv()
        print(f"Response: {response}")

asyncio.run(main())
```

---

## Environment Variables

See `.env.example` for all configuration options.

Key variables:
- `JWT_SECRET`: Secret key for signing JWTs
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`: PostgreSQL credentials
- `REDIS_HOST`: Redis connection
- `K8S_NAMESPACE`: Kubernetes namespace
- `CONTAINER_IDLE_TIMEOUT`: Container idle timeout (ms)

---

## Support & Troubleshooting

### Issue: Cannot connect to WebSocket
- Check JWT token validity: `POST /api/auth/verify`
- Verify WebSocket URL includes protocol: `ws://` or `wss://`
- Check server logs: `npm run dev`

### Issue: Container creation fails
- Ensure Kubernetes is running: `kubectl cluster-info`
- Check pod logs: `kubectl logs <pod-name>`
- Verify RBAC permissions: `kubectl get rolebinding`

### Issue: Database issues
- Verify PostgreSQL connection: `psql -h localhost -U postgres -d nl2sql_backend`
- Check migrations: `npm run migrate`
- Verify tables exist: `\dt` in psql

---

## Version History

- **v1.0.0** (2026-04-19): Initial release with core functionality

