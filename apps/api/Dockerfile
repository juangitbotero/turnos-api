# ── Turnos API — Production Dockerfile ────────────────────────────────────────
# Railway: Root Directory = /  |  Dockerfile Path = apps/api/Dockerfile

FROM node:20-alpine
WORKDIR /app

# System deps for native modules (bcrypt etc.)
RUN apk add --no-cache python3 make g++

# Copy workspace manifests (cached layer — only re-runs when deps change)
COPY package*.json ./
COPY turbo.json* ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install ALL deps (dev deps required for @nestjs/cli compiler)
RUN npm ci

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# ── KEY FIX: add root node_modules/.bin to PATH so `nest` CLI is found ────────
# In a monorepo, @nestjs/cli is hoisted to /app/node_modules/.bin/nest
# but WORKDIR is apps/api — without this, `nest build` fails silently
ENV PATH="/app/node_modules/.bin:${PATH}"

# Build from the api directory
WORKDIR /app/apps/api
RUN nest build

# Hard-fail if dist wasn't created (catches silent TypeScript errors)
RUN test -f dist/main.js || (echo "BUILD FAILED: dist/main.js missing" && ls -la dist/ 2>/dev/null && exit 1)

# Create uploads dir (persisted by Railway Volume or replaced by R2 later)
RUN mkdir -p /app/uploads/worker-photos

EXPOSE ${PORT:-3001}
CMD ["node", "dist/main.js"]
