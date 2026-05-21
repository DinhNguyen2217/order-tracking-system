# ── Frontend Dockerfile (multi-stage build) ──
# Stage 1: Build React app
# Stage 2: Serve with lightweight nginx

# ── Stage 1: Builder ──
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package.json ./

# Install all dependencies (including devDependencies for build)
# Note: no package-lock.json in workspace sub-package
RUN npm install --no-package-lock

# Copy source code
COPY . .

# Build production bundle
# VITE_API_URL can be passed at build time via --build-arg
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# ── Stage 2: Production server ──
FROM nginx:alpine AS production

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
