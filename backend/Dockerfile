# ── Backend Dockerfile ──
# Single-stage: Node.js runtime only, no devDependencies

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (layer cache optimization)
COPY package.json ./

# Install production dependencies only
# Note: no package-lock.json in workspace sub-package, so use --legacy-peer-deps
RUN npm install --omit=dev --no-package-lock

# Copy source code
COPY . .

# Expose port (matches PORT env variable)
EXPOSE 5000

# Health check — Docker will mark container unhealthy if this fails
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

# Start server
CMD ["node", "server.js"]
