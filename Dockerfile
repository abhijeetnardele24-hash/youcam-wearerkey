# Multi-stage Dockerfile for WearerKey
FROM node:22-alpine AS builder

WORKDIR /app

# Enable corepack for pinned pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

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
RUN pnpm --filter @wearerkey/contracts build
RUN pnpm --filter @wearerkey/domain build
RUN pnpm --filter @wearerkey/api build
RUN pnpm --filter @wearerkey/web build

# --- Runtime stage ---
FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY --from=builder --chown=node:node /app /app

# Run as non-root user
USER node

EXPOSE 3000

CMD ["pnpm", "--filter", "@wearerkey/api", "start"]
