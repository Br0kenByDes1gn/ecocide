# Multi-stage Dockerfile for Ecocide Fullstack Deployment
# Stage 1: Build Application
FROM node:24-bookworm-slim AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copy workspace and package dependency manifests
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/types/package.json ./packages/types/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install dependencies with frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source trees and configurations
COPY packages/ ./packages/
COPY apps/ ./apps/

# Compile all workspace packages (types, server, web)
RUN pnpm build

# Isolate production server bundle with workspace references resolved
RUN pnpm --filter @ecocide/server deploy --legacy --prod /prod/server

# Stage 2: Minimal Production Runtime
FROM node:24-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV STATIC_DIR=/app/web/dist
ENV DB_PATH=/data/dossiers.db

# Create persistent storage mount and application directories with non-root ownership
RUN mkdir -p /data /app/web/dist && chown -R node:node /data /app

# Copy deployed production server and built web assets
COPY --from=builder --chown=node:node /prod/server /app/server
COPY --from=builder --chown=node:node /app/apps/web/dist /app/web/dist

USER node

EXPOSE 3000

VOLUME ["/data"]

WORKDIR /app/server

CMD ["node", "dist/index.js"]
