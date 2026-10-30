# Multi-stage Dockerfile for WearerKey
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy manifest files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/contracts/package.json ./packages/contracts/
COPY packages/domain/package.json ./packages/domain/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source files
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY tsconfig.json ./

# Build packages and web frontend
RUN pnpm --filter @wearerkey/contracts build || true
RUN pnpm --filter @wearerkey/domain build || true
RUN pnpm --filter @wearerkey/web build

# --- Runtime stage ---
FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder /app /app

EXPOSE 3000

CMD ["pnpm", "--filter", "@wearerkey/api", "start"]
