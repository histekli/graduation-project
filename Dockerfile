# Multi-stage Dockerfile for Railway

# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
# Copy frontend package files
COPY frontend/package*.json ./
# Install dependencies
RUN npm install
# Copy frontend source code
COPY frontend/ .
# Build React app
RUN npm run build

# Stage 2: Setup Backend and Serve
FROM node:20-bookworm
# Using bookworm for GLIBC 2.36 compatibility with mediasoup worker
WORKDIR /app

# Install build dependencies for mediasoup (including meson/ninja for newer versions)
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-dev \
    build-essential net-tools iproute2 \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install meson and ninja (required for mediasoup build)
RUN pip3 install --break-system-packages meson ninja

ENV PYTHON=/usr/bin/python3
ENV TINI_VERSION v0.19.0

# Setup Backend
WORKDIR /app/backend
COPY backend/package*.json ./

# Install dependencies and force build mediasoup worker from source
# Using unsafe-perm to ensure root user can build headers
RUN npm install --unsafe-perm
RUN npm rebuild mediasoup --build-from-source

# Copy backend source
COPY backend/ .

# Copy built frontend from Stage 1 to where server.js expects it (../frontend/build)
# Since WORKDIR is /app/backend, .. is /app
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

# Environment variables
ENV NODE_ENV=production

# Railway automatically sets PORT
EXPOSE 3443

# Start server
CMD ["sh", "-c", "node -v && npm start"]
