#!/bin/sh
# Restores a dump made by scripts/backup.sh into the compose stack's database. DESTRUCTIVE: the database
# is emptied and then holds only the dump's contents. Run from the portal folder:
#   sh scripts/restore.sh backups/portal-20261105-021500.dump
# An encrypted dump (portal-*.dump.age, BACKUP_AGE_RECIPIENT in backup.sh) is decrypted with age; BACKUP_AGE_IDENTITY
# names the identity file, kept apart from the dumps (docs/OPERATIONS.md, Backups):
#   BACKUP_AGE_IDENTITY=/path/to/identity.txt sh scripts/restore.sh backups/portal-20261105-021500.dump.age
# The app (and the worker, if running) is stopped first so nothing writes during the restore, and
# started again afterwards. .env must hold the APP_SECRET that was in use when the dump was made.
set -eu

if [ "$#" -ne 1 ] || [ ! -f "$1" ]; then
  echo "usage: sh scripts/restore.sh <dump file>" >&2
  exit 2
fi
dump="$1"
case "$dump" in
  *.age) [ -n "${BACKUP_AGE_IDENTITY:-}" ] || { echo "set BACKUP_AGE_IDENTITY to the age identity file to restore an encrypted dump" >&2; exit 2; } ;;
esac

echo "Restoring $dump into database 'portal' of the compose service 'db'. Its current data is replaced."
printf "Type 'restore' to continue: "
read -r answer
[ "$answer" = "restore" ] || { echo "aborted"; exit 1; }

docker compose stop app worker
trap 'rm -f "$dump.failed"; docker compose exec -T db rm -f /tmp/restore.dump /tmp/restore.sql' EXIT
trap 'exit 1' INT TERM
# Copied into the container and turned into SQL first, so a corrupt file fails before anything changes.
load='cat > /tmp/restore.dump && pg_restore --no-owner -f /tmp/restore.sql /tmp/restore.dump'
case "$dump" in
  # sh has no pipefail: a failed decryption (wrong identity, damaged file) leaves a marker and stops here.
  *.age)
    { age -d -i "$BACKUP_AGE_IDENTITY" "$dump" || : > "$dump.failed"; } | docker compose exec -T db sh -c "$load"
    [ ! -e "$dump.failed" ]
    ;;
  *) docker compose exec -T db sh -c "$load" < "$dump" ;;
esac
# Both schemas are emptied first: pg_restore --clean drops only what is in the dump, so a table from a
# later migration would survive and the next start would fail re-applying that migration.
# -1 with ON_ERROR_STOP: one transaction, a failed restore leaves the database as it was.
docker compose exec -T db psql -U portal -d portal -q -1 -v ON_ERROR_STOP=1 \
  -c 'DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA public CASCADE; CREATE SCHEMA public;' \
  -f /tmp/restore.sql
docker compose start app
echo "restored; the app is starting (the worker, if you use it: docker compose --profile worker up -d worker)"
