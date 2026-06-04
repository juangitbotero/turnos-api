# ── Turnos Web Admin — Production Dockerfile ──────────────────────────────────
# Builds the Next.js web-admin from the monorepo root so that @turnos/shared
# is available during compilation.
# Railway: set Root Directory = / and Dockerfile Path = apps/web-admin/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests (layer-cache friendly)
COPY package*.json ./
COPY turbo.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/web-admin/package*.json ./apps/web-admin/

# Install all workspace dependencies
RUN npm ci

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/web-admin/ ./apps/web-admin/

# Build Next.js (produces .next/standalone via next.config.js output:'standalone')
RUN cd apps/web-admin && npm run build

# ── Production image ───────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

# Copy the standalone Next.js output
COPY --from=builder /app/apps/web-admin/.next/standalone ./
COPY --from=builder /app/apps/web-admin/.next/static ./apps/web-admin/.next/static
COPY --from=builder /app/apps/web-admin/public ./apps/web-admin/public

# Railway injects $PORT — Next.js reads it automatically
EXPOSE ${PORT:-3000}

# Standalone server entry point
CMD ["node", "apps/web-admin/server.js"]
