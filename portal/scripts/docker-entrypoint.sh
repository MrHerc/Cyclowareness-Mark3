#!/bin/sh
# Container start: check the required configuration, apply pending migrations, then run the
# standalone Next.js server. Before it takes requests the server imports the lesson library from
# ./content and, on a fresh installation with BOOTSTRAP_OPERATOR_EMAIL, creates the platform
# operator and prints a one-time invitation link (src/server/bootstrap.ts, idempotent).
# Any failure stops the container instead of serving with a broken configuration or an old schema.
set -eu

fail() {
  echo "[entrypoint] $1" >&2
  exit 1
}

[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set: the container needs PostgreSQL."
secret="${APP_SECRET:-}"
[ "${#secret}" -ge 32 ] || fail "APP_SECRET must be set to 32 or more random characters (it encrypts stored secrets)."

echo "[entrypoint] applying migrations"
node scripts/migrate.mjs

echo "[entrypoint] starting server on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec node server.js
