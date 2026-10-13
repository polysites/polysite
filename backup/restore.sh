#!/bin/sh
# Restores a backup. DESTRUCTIVE: it replaces the database contents and writes
# the media files back. Stop the app first so nothing writes while it runs:
#   docker compose stop web cms
#   docker compose --profile restore run --rm restore latest --yes
#   docker compose start cms web
#
# Usage: restore.sh <latest | file name | /path/to/archive> --yes [--db-only | --media-only]
set -eu
# The safety dump of the current database is readable by its owner only.
umask 077
. "$(dirname "$0")/lib.sh"

ARCHIVE_ARG="${1:-}"
[ -n "$ARCHIVE_ARG" ] || { echo "Usage: restore.sh <latest|archive> --yes [--db-only|--media-only]" >&2; exit 2; }
shift
yes=no; do_db=yes; do_media=yes
for a in "$@"; do
  case "$a" in
    --yes) yes=yes ;;
    --db-only) do_media=no ;;
    --media-only) do_db=no ;;
    *) echo "Unknown option: $a" >&2; exit 2 ;;
  esac
done
[ "$yes" = yes ] || { echo "This replaces live data. Re-run with --yes to confirm." >&2; exit 2; }
[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is not set"

archive=$(resolve_archive "$ARCHIVE_ARG")
log "Restoring from $(basename "$archive")"
check_sum "$archive"

WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT
open_archive "$archive" "$WORK/archive.tar"
tar -xf "$WORK/archive.tar" -C "$WORK" || die "The archive can't be unpacked"
[ -f "$WORK/db.dump" ] && [ -f "$WORK/media.tar.gz" ] && [ -f "$WORK/MANIFEST" ] || die "The archive is missing parts"
log "Archive contents:"; sed 's/^/  /' "$WORK/MANIFEST"

[ "$(sha256sum "$WORK/db.dump" | cut -d' ' -f1)" = "$(sed -n 's/^db_sha256=//p' "$WORK/MANIFEST")" ] || die "The database dump doesn't match its checksum"
[ "$(sha256sum "$WORK/media.tar.gz" | cut -d' ' -f1)" = "$(sed -n 's/^media_sha256=//p' "$WORK/MANIFEST")" ] || die "The media archive doesn't match its checksum"

if [ "$do_db" = yes ]; then
  # A way back if this turns out to be the wrong backup.
  safety="$BACKUP_DIR/pre-restore-$(date -u +%Y%m%dT%H%M%SZ).dump"
  log "Saving the current database to $(basename "$safety") first"
  pg_dump --format=custom --no-owner --no-privileges --file="$safety" "$DATABASE_URL" \
    || die "Could not save the current database; not restoring"

  log "Restoring the database"
  pg_restore --clean --if-exists --no-owner --no-privileges --single-transaction --exit-on-error \
    --dbname="$DATABASE_URL" "$WORK/db.dump" || die "Database restore failed (nothing was changed: it runs in one transaction)"
fi

if [ "$do_media" = yes ]; then
  [ -d "$MEDIA_DIR" ] || die "Media folder $MEDIA_DIR is not mounted"
  log "Restoring media into $MEDIA_DIR (files not in the backup are left alone)"
  tar -xzf "$WORK/media.tar.gz" -C "$MEDIA_DIR" || die "Media restore failed"
fi

log "Restore complete. Start the app again and check a few pages and images."
