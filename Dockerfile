# Cloud Backend Dockerfile
# NOTE: The Cloud Backend runs NATIVELY (not in a container)
# This Dockerfile is provided only for optional deployment scenarios where
# the backend needs to be containerized (e.g., in a Kubernetes control plane pod)
#
# For normal operation: Run the backend natively on your host or CI/CD system
#   npm install
#   npm start
#
# Only use this Dockerfile if you specifically need to run the backend in a container

FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY src/ ./src/

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start application
CMD ["npm", "start"]
