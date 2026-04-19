# Test examples for Cloud Backend

## Running Tests

```bash
npm test
```

## Test Coverage

```bash
npm test -- --coverage
```

## Example: Authentication Test

```javascript
const auth = require('../src/middleware/auth');
const config = require('../src/config/env');

describe('JWT Authentication', () => {
  it('should generate valid token', () => {
    const token = auth.generateToken('user123', 'user@example.com');
    expect(token).toBeDefined();
  });

  it('should verify valid token', () => {
    const token = auth.generateToken('user123');
    const decoded = auth.verifyToken(token);
    expect(decoded.user_id).toBe('user123');
  });

  it('should reject invalid token', () => {
    const decoded = auth.verifyToken('invalid_token');
    expect(decoded).toBeNull();
  });

  it('should extract token from headers', () => {
    const headers = { authorization: 'Bearer test_token' };
    const token = auth.extractTokenFromHeaders(headers);
    expect(token).toBe('test_token');
  });
});
```

## Example: WebSocket Connection Test

```javascript
const WebSocket = require('ws');

describe('WebSocket Connection', () => {
  let ws, token;

  beforeAll(async () => {
    // Generate test token
    const response = await fetch('http://localhost:3000/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'test_user' })
    });
    const data = await response.json();
    token = data.token;
  });

  it('should connect with valid token', (done) => {
    ws = new WebSocket('ws://localhost:3000', {
      headers: { authorization: `Bearer ${token}` }
    });

    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      done();
    });

    ws.on('error', (error) => {
      done(error);
    });
  });

  it('should receive connection_established message', (done) => {
    ws.on('message', (message) => {
      const data = JSON.parse(message);
      expect(data.type).toBe('connection_established');
      expect(data.containerId).toBeDefined();
      done();
    });
  });

  it('should respond to ping with pong', (done) => {
    ws.send(JSON.stringify({ type: 'ping' }));
    
    ws.on('message', (message) => {
      const data = JSON.parse(message);
      if (data.type === 'pong') {
        expect(data.timestamp).toBeDefined();
        done();
      }
    });
  });

  afterAll(() => {
    if (ws) ws.close();
  });
});
```

## Example: Container Manager Test

```javascript
const ContainerManager = require('../src/services/container-manager');

describe('Container Manager', () => {
  let manager;

  beforeAll(async () => {
    manager = new ContainerManager();
    await manager.initialize();
  });

  it('should ensure container for user', async () => {
    const result = await manager.ensureContainer('test_user_123');
    expect(result.containerId).toBeDefined();
    expect(result.isNew).toBe(true);
  });

  it('should reuse existing container', async () => {
    const result1 = await manager.ensureContainer('test_user_123');
    const result2 = await manager.ensureContainer('test_user_123');
    
    expect(result1.containerId).toBe(result2.containerId);
    expect(result2.isNew).toBe(false);
  });

  it('should create separate containers for different users', async () => {
    const result1 = await manager.ensureContainer('user_1');
    const result2 = await manager.ensureContainer('user_2');
    
    expect(result1.containerId).not.toBe(result2.containerId);
  });

  it('should send message to container', async () => {
    const container = await manager.ensureContainer('test_user');
    const message = { type: 'query', content: 'test' };
    
    const success = await manager.sendMessage(container.containerId, message);
    expect(success).toBe(true);
  });

  afterAll(async () => {
    // Cleanup
  });
});
```

## Performance Testing

```bash
# Load test with 100 concurrent connections
npm test -- load

# WebSocket stress test
npm test -- stress --connections=500 --duration=60000
```

## Integration Testing

```bash
# Test with real database
DB_HOST=localhost npm test:integration

# Test with real Kubernetes
KUBECONFIG=~/.kube/config npm test:k8s
```

---

See root README.md and docs/API.md for more information.
