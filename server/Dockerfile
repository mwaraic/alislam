# Lightweight build for Cloudflare deployment
FROM node:20-slim as builder

WORKDIR /app

# Copy package files from server directory
COPY server/package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci && npm cache clean --force

# Copy source code and build configuration from server directory
COPY server/src/ ./src/
COPY server/tsconfig.json ./
COPY server/build.js ./

# Build the server application
RUN npm run build

# Build client in a separate stage
FROM node:20-slim as client-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./

# Install client dependencies
RUN npm ci && npm cache clean --force

# Copy client source code
COPY client/src/ ./src/
COPY client/index.html ./
COPY client/tsconfig.json ./
COPY client/tsconfig.node.json ./
COPY client/vite.config.ts ./
COPY client/tailwind.config.js ./
COPY client/postcss.config.js ./

# Build the client application
RUN npm run build

# Final stage
FROM node:20-slim

WORKDIR /app

# Install curl for health check
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy package files from server directory
COPY server/package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built server application from builder stage
COPY --from=builder /app/dist ./dist

# Copy built client application from client-builder stage
COPY --from=client-builder /app/client/dist ./client/dist

# Create a non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port 8787
EXPOSE 8787

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8787/api/health || exit 1

# Start the server with the dev.js file that properly listens on port 8787
CMD ["node", "dist/dev.js"] 