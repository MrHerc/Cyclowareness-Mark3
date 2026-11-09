# syntax=docker/dockerfile:1
# Production image, built from the portal folder:  docker build -t portal .
# Stages: deps (npm ci) -> builder (next build) -> runner (standalone server, non-root).
# Pinned by the multi-arch index digest (amd64 and arm64); Dependabot proposes the digest bump weekly.
FROM node:24-trixie-slim@sha256:0820eaa85e07d0490446dd01d14707e17e6108a36988cf374899cd057eb3812d AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1. Dependencies, dev ones included: the build needs TypeScript, Tailwind and drizzle-kit,
#    and the compose "seed" service runs tsx from this layer.
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# 2. Build. No secrets are needed here: src/server/env.ts skips the APP_SECRET check during
#    `next build` (NEXT_PHASE) and enforces it when the server starts. DATABASE_URL stays
#    unset: the build must not open a database.
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Windows checkouts may turn the entrypoint into CRLF, which /bin/sh cannot run.
RUN sed -i 's/\r$//' scripts/docker-entrypoint.sh
# Every lesson file and translation is checked here (schema, integrity, parity with English): a bad
# file fails `docker build` instead of the start-up import of a running deployment.
RUN npx tsx scripts/check-lesson-locales.ts --coverage
# The SCORM export's offline player (src/scorm): built here, where its sources and esbuild are; the runtime
# image has neither, so the export route (src/server/scorm/player.ts) reads the files copied below.
RUN npx tsx scripts/build-scorm-player.ts
RUN npm run build

# 3. Runtime: the standalone server plus everything the app reads from disk at runtime
#    (content/ via process.cwd(): landing copy, legal texts and the lesson library the server
#    imports into the database on every start; drizzle/ for the migration step; public/ and
#    static assets).
FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/content ./content
COPY --from=builder --chown=node:node /app/.data/scorm ./.data/scorm
COPY --from=builder --chown=node:node /app/scripts/migrate.mjs /app/scripts/docker-entrypoint.sh ./scripts/
# drizzle-orm is bundled into the server chunks by webpack (it is not a server-external package),
# so the standalone output does not keep it in node_modules; the migration script imports it
# directly. It has no runtime dependencies of its own. pg is external and already traced.
COPY --from=deps --chown=node:node /app/node_modules/drizzle-orm ./node_modules/drizzle-orm

USER node
EXPOSE 3000
# /api/health answers 200 only when the server can query the database (503 otherwise). The slim
# image has no curl, hence node's fetch; exitCode rather than process.exit() inside the callback.
# The start period covers the migrations and the content import of a first start.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health',{signal:AbortSignal.timeout(4000)}).then((r)=>{process.exitCode=r.ok?0:1}).catch(()=>{process.exitCode=1})"
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
