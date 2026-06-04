# ── Turnos API — Production Dockerfile ────────────────────────────────────────
# Builds the NestJS API from the monorepo root so that the shared package
# (@turnos/shared) is available during compilation.
# Railway: set Root Directory = / and Dockerfile Path = apps/api/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first (layer-cache friendly)
COPY package*.json ./
COPY turbo.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install all workspace dependencies
RUN npm ci

# Copy source files
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# Build shared package, then the API
RUN cd apps/api && npm run build

# ── Production image ───────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Copy workspace manifests for module resolution
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled output and shared package
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared ./packages/shared

# Create uploads directory (persisted by Railway Volume in production)
RUN mkdir -p /app/uploads/worker-photos

WORKDIR /app/apps/api

# Railway injects $PORT at runtime — default to 3001 for local docker run
EXPOSE ${PORT:-3001}

CMD ["node", "dist/main.js"]
