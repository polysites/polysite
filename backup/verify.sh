#!/bin/sh
# Proves a backup can actually be restored: unpacks it, loads the database into a
# throwaway database on the same server, and compares row counts with the ones
# recorded when the backup was taken. The live database is never touched.
# Usage: verify.sh [latest | file name | /path/to/archive]
set -eu
. "$(dirname "$0")/lib.sh"

[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is not set"
archive=$(resolve_archive "${1:-latest}")
log "Verifying $(basename "$archive")"
# An off-site copy configured without strong encryption is a failure of the backup setup, so verify says so (and fails) too.
offsite_reason=$(offsite_block_reason)
[ -z "$offsite_reason" ] || log "ERROR: off-site copy is refused: $offsite_reason"
case "$archive" in *.enc) ;; *) [ -z "${BACKUP_RCLONE_REMOTE:-}" ] || log "Warning: this archive is not encrypted, so it will not be copied off-site (the next backup is encrypted)" ;; esac
check_sum "$archive"

WORK=$(mktemp -d)
SCRATCH="polysite_restore_check"
ADMIN_URL=$(db_url_for postgres)
SCRATCH_URL=$(db_url_for "$SCRATCH")
cleanup() { psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null 2>&1 || true; rm -rf "$WORK"; }
trap cleanup EXIT

open_archive "$archive" "$WORK/archive.tar"
tar -xf "$WORK/archive.tar" -C "$WORK" || die "The archive can't be unpacked"
[ -f "$WORK/db.dump" ] && [ -f "$WORK/media.tar.gz" ] && [ -f "$WORK/MANIFEST" ] || die "The archive is missing parts"

[ "$(sha256sum "$WORK/db.dump" | cut -d' ' -f1)" = "$(sed -n 's/^db_sha256=//p' "$WORK/MANIFEST")" ] || die "The database dump doesn't match its checksum"
[ "$(sha256sum "$WORK/media.tar.gz" | cut -d' ' -f1)" = "$(sed -n 's/^media_sha256=//p' "$WORK/MANIFEST")" ] || die "The media archive doesn't match its checksum"
tar -tzf "$WORK/media.tar.gz" >/dev/null || die "The media archive is unreadable"

psql "$ADMIN_URL" -qc "DROP DATABASE IF EXISTS $SCRATCH" >/dev/null 2>&1 || true
psql "$ADMIN_URL" -qc "CREATE DATABASE $SCRATCH" || die "Can't create a scratch database. The database user needs CREATEDB to verify restores"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$SCRATCH_URL" "$WORK/db.dump" \
  || die "The database dump does not restore"

bad=0
for line in $(grep '^rows\.' "$WORK/MANIFEST"); do
  table=${line#rows.}; table=${table%%=*}
  expected=${line#*=}
  [ "$expected" = "-1" ] && continue   # table didn't exist when the backup was taken
  actual=$(psql "$SCRATCH_URL" -At -c "SELECT count(*) FROM public.$table" 2>/dev/null || echo missing)
  if [ "$actual" = "$expected" ]; then
    log "  $table: $actual rows OK"
  else
    log "  $table: expected $expected, restored $actual"
    bad=1
  fi
done
[ "$bad" = 0 ] || die "The restored database doesn't match what was backed up"

log "Verified $(basename "$archive"): it restores completely"
[ -z "$offsite_reason" ] || die "The archive restores, but the off-site copy is refused: $offsite_reason"
