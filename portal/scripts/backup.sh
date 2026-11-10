#!/bin/sh
# Nightly PostgreSQL dump of the compose stack (custom format, for pg_restore), then pruning.
# Run from the portal folder (where docker-compose.yml is), for example from cron:
#   15 2 * * * cd /srv/portal && mkdir -p backups && sh scripts/backup.sh >> backups/backup.log 2>&1
# BACKUP_DIR (default ./backups) and BACKUP_KEEP_DAYS (default 14) change where and how long.
# BACKUP_AGE_RECIPIENT (an age public key, age1...) encrypts each dump with age into portal-*.dump.age;
# restore.sh decrypts it with the matching identity (docs/OPERATIONS.md, Backups).
# Copy the dumps off this host every day. Keep APP_SECRET from .env apart from them (see docs/OPERATIONS.md,
# Backups): without it the stored secrets (SMTP, SSO, webhook secrets, authenticator keys) in a restored
# database are unreadable, and it must never travel with the dumps.
set -eu
# Owner-only: a dump holds every organisation's personal data.
umask 077

dir="${BACKUP_DIR:-backups}"
keep="${BACKUP_KEEP_DAYS:-14}"
recipient="${BACKUP_AGE_RECIPIENT:-}"
mkdir -p "$dir"
# Also tightens a backups folder made before the umask was set.
chmod 700 "$dir"
file="$dir/portal-$(date -u +%Y%m%d-%H%M%S).dump"
[ -z "$recipient" ] || file="$file.age"

# Written under a temporary name, so a failed or interrupted dump never looks like a good one,
# and removed on failure, so partial dumps neither pile up nor get copied off the host.
trap 'rm -f "$file.part" "$file.failed"' EXIT
trap 'exit 1' INT TERM
if [ -z "$recipient" ]; then
  docker compose exec -T db pg_dump -U portal -d portal -Fc > "$file.part"
else
  # Encrypted on its way to disk, so no plaintext copy is written. sh has no pipefail: a failed pg_dump leaves a marker.
  { docker compose exec -T db pg_dump -U portal -d portal -Fc || : > "$file.failed"; } | age -r "$recipient" > "$file.part"
  [ ! -e "$file.failed" ]
fi
mv "$file.part" "$file"
echo "backup: $file ($(wc -c < "$file") bytes)"

find "$dir" \( -name 'portal-*.dump' -o -name 'portal-*.dump.age' \) -type f -mtime +"$keep" -exec rm -f {} +
