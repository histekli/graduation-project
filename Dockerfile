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
FROM node:16-bullseye
# Using bullseye for python/build tools compatibility (mediasoup)
WORKDIR /app

# Install build dependencies for mediasoup
RUN apt-get update && apt-get install -y python3 python3-pip python3-dev build-essential net-tools && rm -rf /var/lib/apt/lists/*
ENV PYTHON=/usr/bin/python3
# Ensure Mediasoup finds the worker binary
# mediasoup 3.12+ builds worker in node_modules/mediasoup/worker/out/Release/mediasoup-worker
# We do not strictly need to set this if installation is correct, but can help debugging
# ENV MEDIASOUP_WORKER_BIN="/app/backend/node_modules/mediasoup/worker/out/Release/mediasoup-worker"

# Setup Backend
WORKDIR /app/backend
COPY backend/package*.json ./

RUN npm install --production

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
