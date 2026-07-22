# syntax=docker/dockerfile:1
# NestJS API image for the FSG monorepo. Build from repo root:
#   docker build -f apps/api/Dockerfile .

# pnpm 11 requires Node >= 22.13 (uses node:sqlite)
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate
WORKDIR /app

# ── Install workspace deps for api (+ shared) ──────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
RUN pnpm install --frozen-lockfile --filter @fsg/api...

# ── Build shared + nest ────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app /app
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @fsg/shared build \
  && pnpm --filter @fsg/api exec prisma generate \
  && pnpm --filter @fsg/api build \
  # Sanity: image must ship Prisma 6 (schema uses datasource url = env(...)).
  # The bin shim lives in the api package's node_modules, not the workspace root.
  && pnpm --filter @fsg/api exec prisma -v

# ── Production runtime ─────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

# Hoisted monorepo layout: everything resolves from /app/node_modules
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
# Per-package bin shims (prisma lives here, not in the root .bin)
COPY --from=builder /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=builder /app/apps/api/healthcheck.js ./apps/api/healthcheck.js

WORKDIR /app/apps/api
RUN mkdir -p uploads

COPY apps/api/docker-entrypoint.sh /docker-entrypoint.sh
# Normalize Windows CRLF if the file was checked out on Windows
RUN sed -i 's/\r$//' /docker-entrypoint.sh && chmod +x /docker-entrypoint.sh

ENV PORT=4000
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=90s --retries=10 \
  CMD node /app/apps/api/healthcheck.js
ENTRYPOINT ["/docker-entrypoint.sh"]

