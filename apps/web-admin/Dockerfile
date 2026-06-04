# ── Turnos Web Admin — Production Dockerfile ──────────────────────────────────
# Railway: Root Directory = /  |  Dockerfile Path = apps/web-admin/Dockerfile

FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests (layer cache)
COPY package*.json ./
COPY turbo.json* ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/typescript-config/package*.json ./packages/typescript-config/
COPY apps/web-admin/package*.json ./apps/web-admin/

# Install all dependencies
RUN npm ci

# Copy all source packages
COPY packages/shared/ ./packages/shared/
COPY packages/typescript-config/ ./packages/typescript-config/
COPY apps/web-admin/ ./apps/web-admin/

# Build Next.js (output: standalone configured in next.config.js)
RUN cd apps/web-admin && npm run build

# ── Production image ───────────────────────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app

COPY --from=builder /app/apps/web-admin/.next/standalone ./
COPY --from=builder /app/apps/web-admin/.next/static ./apps/web-admin/.next/static
COPY --from=builder /app/apps/web-admin/public ./apps/web-admin/public

EXPOSE ${PORT:-3000}
CMD ["node", "apps/web-admin/server.js"]
