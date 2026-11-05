#!/bin/sh
# Nightly PostgreSQL dump of the compose stack (custom format, for pg_restore), then pruning.
# Run from the portal folder (where docker-compose.yml is), for example from cron:
#   15 2 * * * cd /srv/portal && sh scripts/backup.sh >> backups/backup.log 2>&1
# BACKUP_DIR (default ./backups) and BACKUP_KEEP_DAYS (default 14) change where and how long.
# Copy the dumps off this host, together with APP_SECRET from .env: without it the stored
# secrets (SMTP, SSO, webhook secrets, authenticator keys) in a restored database are unreadable.
set -eu

dir="${BACKUP_DIR:-backups}"
keep="${BACKUP_KEEP_DAYS:-14}"
mkdir -p "$dir"
file="$dir/portal-$(date -u +%Y%m%d-%H%M%S).dump"

# Written under a temporary name, so a failed or interrupted dump never looks like a good one.
docker compose exec -T db pg_dump -U portal -d portal -Fc > "$file.part"
mv "$file.part" "$file"
echo "backup: $file ($(wc -c < "$file") bytes)"

find "$dir" -name 'portal-*.dump' -type f -mtime +"$keep" -exec rm -f {} +
