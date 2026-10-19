# syntax=docker/dockerfile:1
# Production image, built from the portal folder:  docker build -t portal .
# Stages: deps (npm ci) -> builder (next build) -> runner (standalone server, non-root).
FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Dependencies, dev ones included: the build needs TypeScript, Tailwind and drizzle-kit,
#    and the compose "seed" service runs tsx from this layer.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2. Build. `next build` runs with NODE_ENV=production, and src/server/env.ts refuses to load
#    in production without APP_SECRET, so a throwaway value is provided here. It never reaches
#    the runner and nothing is encrypted with it. DATABASE_URL stays unset: the build must not
#    open a database.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Windows checkouts may turn the entrypoint into CRLF, which /bin/sh cannot run.
RUN sed -i 's/\r$//' scripts/docker-entrypoint.sh
ARG APP_SECRET=build-only-placeholder-secret-never-used-at-runtime
ENV APP_SECRET=$APP_SECRET
RUN npm run build

# 3. Runtime: the standalone server plus everything the app reads from disk at runtime
#    (content/ via process.cwd(), drizzle/ for the migration step, public/ and static assets).
FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/content ./content
COPY --from=builder --chown=node:node /app/scripts/migrate.mjs /app/scripts/docker-entrypoint.sh ./scripts/
# drizzle-orm is bundled into the server chunks by webpack (it is not a server-external package),
# so the standalone output does not keep it in node_modules; the migration script imports it
# directly. It has no runtime dependencies of its own. pg is external and already traced.
COPY --from=deps --chown=node:node /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

USER node
EXPOSE 3000
# /sign-in is public and renders through the database, so a passing check means the app and
# its database connection are both up. The slim image has no curl, hence node's fetch.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/sign-in').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
