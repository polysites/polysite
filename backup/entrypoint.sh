#!/bin/sh
# Container entrypoint: installs the schedule and runs cron in the foreground.
# Job output goes to the container log (docker compose logs backup).
set -eu
. "$(dirname "$0")/lib.sh"

: "${BACKUP_SCHEDULE:=17 3 * * *}"          # daily, 03:17 (container time, UTC)
: "${BACKUP_VERIFY_SCHEDULE:=47 4 * * 0}"   # a full test restore every Sunday, 04:47

[ -n "${DATABASE_URL:-}" ] || { log "DATABASE_URL is not set"; exit 1; }
mkdir -p "$BACKUP_DIR"
touch /tmp/started

mkdir -p /etc/crontabs
cat > /etc/crontabs/root <<CRON
$BACKUP_SCHEDULE /opt/backup/backup.sh >> /proc/1/fd/1 2>&1
CRON
if [ "$BACKUP_VERIFY_SCHEDULE" != "off" ]; then
  echo "$BACKUP_VERIFY_SCHEDULE /opt/backup/verify.sh latest >> /proc/1/fd/1 2>&1" >> /etc/crontabs/root
fi
reason=$(offsite_block_reason)
[ -z "$reason" ] || log "ERROR: off-site copy is REFUSED until this is fixed (local backups continue): $reason"
log "Backups scheduled: '$BACKUP_SCHEDULE'; test restore: '$BACKUP_VERIFY_SCHEDULE'; keeping in $BACKUP_DIR"

# A new install gets its first backup straight away instead of after the first night.
if ! ls "$BACKUP_DIR"/polysite-*.tar "$BACKUP_DIR"/polysite-*.tar.enc >/dev/null 2>&1; then
  (
    i=0
    until pg_isready -q -d "$DATABASE_URL" || [ "$i" -ge 60 ]; do i=$((i + 1)); sleep 2; done
    log "No backups yet: taking the first one now"
    /opt/backup/backup.sh || true
  ) &
fi

exec crond -f -l 8
