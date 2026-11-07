# ==============================================================================
# Production Dockerfile for Campus Event Hub - Server API
# Multi-stage build: TypeScript compilation + minimal Node.js Alpine runtime
# ==============================================================================

# ─── Stage 1: Build & Prisma Generation ──────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# OpenSSL is required by Prisma CLI and engine on Alpine Linux
RUN apk add --no-cache openssl

# Install dependencies first for optimal Docker layer caching
COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Copy source and configuration
COPY tsconfig.json ./
COPY src ./src/

# Compile TypeScript to dist/
RUN npm run build

# ─── Stage 2: Production Runner ──────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# OpenSSL runtime dependency for Prisma
RUN apk add --no-cache openssl

# Security: Create non-root system user and group
RUN addgroup -S nodejs -g 1001 && adduser -S nodeapp -u 1001 -G nodejs

# Copy package manifests and install production-only dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy compiled artifacts, Prisma schema and generated engines from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Transfer ownership to non-root user
RUN chown -R nodeapp:nodejs /app

USER nodeapp

EXPOSE 4000

CMD ["node", "dist/index.js"]
