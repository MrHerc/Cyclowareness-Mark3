#!/bin/sh
# Container start: apply pending migrations, then run the standalone Next.js server.
# A failed migration stops the container instead of serving against an old schema.
set -eu

echo "[entrypoint] applying migrations"
node scripts/migrate.mjs

echo "[entrypoint] starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
