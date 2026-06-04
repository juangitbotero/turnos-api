# ── Turnos API — Production Dockerfile ────────────────────────────────────────
# Railway: Root Directory = /  |  Dockerfile Path = apps/api/Dockerfile

FROM node:20-alpine
WORKDIR /app

# System deps (required for bcrypt and other native modules)
RUN apk add --no-cache python3 make g++

# Copy all workspace manifests (layer cache: only re-runs when deps change)
COPY package*.json ./
COPY turbo.json* ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/

# Install ALL dependencies (dev deps needed for @nestjs/cli + tsc)
RUN npm ci

# Copy all source files
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/

# ── Step 1: Build @turnos/shared ──────────────────────────────────────────────
# shared/package.json "main" points to ./dist/index.js — must build before API
WORKDIR /app/packages/shared
RUN npm run build

# ── Step 2: Build the NestJS API ──────────────────────────────────────────────
# Add root node_modules/.bin to PATH so the hoisted `nest` CLI is found
ENV PATH="/app/node_modules/.bin:${PATH}"
WORKDIR /app/apps/api
RUN nest build

# ── Step 3: Verify the build ───────────────────────────────────────────────────
# nest-cli.json has entryFile:"apps/api/src/main" so output is at this path:
RUN test -f dist/apps/api/src/main.js \
    || (echo "BUILD FAILED — dist contents:" && find dist -name "*.js" | head -20 && exit 1)

# ── Step 4: Runtime setup ─────────────────────────────────────────────────────
RUN mkdir -p /app/uploads/worker-photos

# Railway injects $PORT at runtime
EXPOSE ${PORT:-3001}

# Use the path matching nest-cli.json entryFile = "apps/api/src/main"
CMD ["node", "dist/apps/api/src/main.js"]
