# ── Turnos API — Production Dockerfile (single-stage, reliable for monorepo) ──
# Railway: Root Directory = /  |  Dockerfile Path = apps/api/Dockerfile

FROM node:20-alpine
WORKDIR /app

# ── 1. Install system deps (needed for native modules like bcrypt) ─────────────
RUN apk add --no-cache python3 make g++

# ── 2. Copy workspace manifests (layer-cache: only re-installs when deps change)
COPY package*.json ./
COPY turbo.json* ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# ── 3. Install ALL dependencies (dev deps needed for NestJS compiler) ──────────
RUN npm ci

# ── 4. Copy source code ────────────────────────────────────────────────────────
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# ── 5. Build the NestJS API ────────────────────────────────────────────────────
WORKDIR /app/apps/api
RUN npm run build

# ── 6. Verify the build succeeded (fails the deploy if dist is missing) ────────
RUN test -f dist/main.js || (echo "ERROR: dist/main.js not found — build failed" && exit 1)

# ── 7. Create uploads directory (photos stored here until R2 is configured) ────
RUN mkdir -p /app/uploads/worker-photos

# ── 8. Start ───────────────────────────────────────────────────────────────────
# Railway injects $PORT at runtime
EXPOSE ${PORT:-3001}
CMD ["node", "dist/main.js"]
