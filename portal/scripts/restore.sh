#!/bin/sh
# Restores a dump made by scripts/backup.sh into the compose stack's database. DESTRUCTIVE: every
# table is replaced by the dump's contents. Run from the portal folder:
#   sh scripts/restore.sh backups/portal-20261105-021500.dump
# The app (and the worker, if running) is stopped first so nothing writes during the restore, and
# started again afterwards. .env must hold the APP_SECRET that was in use when the dump was made.
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "usage: sh scripts/restore.sh <dump file>" >&2
  exit 2
fi
dump="$1"

echo "Restoring $dump into database 'portal' of the compose service 'db'. Its current data is replaced."
printf "Type 'restore' to continue: "
read -r answer
[ "$answer" = "restore" ] || { echo "aborted"; exit 1; }

docker compose stop app worker
# --single-transaction: a failed restore leaves the database as it was.
docker compose exec -T db pg_restore -U portal -d portal --clean --if-exists --no-owner --single-transaction < "$dump"
docker compose start app
echo "restored; the app is starting (the worker, if you use it: docker compose --profile worker up -d worker)"
