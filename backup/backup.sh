#!/bin/sh
# One backup run: a consistent database dump plus the uploaded media, packed into
# a single archive in $BACKUP_DIR, then old backups pruned and (optionally) a
# copy pushed off the machine. Run by cron from entrypoint.sh, or by hand:
#   docker compose exec backup /opt/backup/backup.sh
set -eu
# Everything this tool writes (database dumps, media) is readable by its owner only.
umask 077
. "$(dirname "$0")/lib.sh"

[ -n "${DATABASE_URL:-}" ] || die "DATABASE_URL is not set"
[ -d "$MEDIA_DIR" ] || die "Media folder $MEDIA_DIR is not mounted"
mkdir -p "$BACKUP_DIR"

TS=$(date -u +%Y%m%dT%H%M%SZ)
WORK=$(mktemp -d "$BACKUP_DIR/.work-XXXXXX")
trap 'rm -rf "$WORK"' EXIT

log "Backup $TS: dumping the database"
pg_dump --format=custom --no-owner --no-privileges --file="$WORK/db.dump" "$DATABASE_URL" \
  || die "pg_dump failed"
# A dump that can't even be listed is not a backup.
pg_restore --list "$WORK/db.dump" >/dev/null || die "The database dump is unreadable"

log "Backup $TS: archiving media"
tar -czf "$WORK/media.tar.gz" -C "$MEDIA_DIR" . || die "Archiving media failed"
tar -tzf "$WORK/media.tar.gz" >/dev/null || die "The media archive is unreadable"

# Row counts of the tables that matter, recorded so verify.sh can prove a
# restore is complete without needing the live database to look the same.
counts=""
for t in users roles sites pages media redirects; do
  if [ "$(psql "$DATABASE_URL" -At -c "SELECT to_regclass('public.$t') IS NOT NULL" 2>/dev/null)" = "t" ]; then
    n=$(psql "$DATABASE_URL" -At -c "SELECT count(*) FROM public.$t") || die "Counting rows in $t failed"
  else
    n=-1
  fi
  counts="$counts$t=$n
"
done

{
  echo "created_at=$TS"
  echo "pg_dump=$(pg_dump --version)"
  echo "db_sha256=$(sha256sum "$WORK/db.dump" | cut -d' ' -f1)"
  echo "media_sha256=$(sha256sum "$WORK/media.tar.gz" | cut -d' ' -f1)"
  printf '%s' "$counts" | sed 's/^/rows./'
} > "$WORK/MANIFEST"

tar -cf "$WORK/archive.tar" -C "$WORK" db.dump media.tar.gz MANIFEST
name="polysite-$TS.tar"
if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_ENCRYPTION_PASSPHRASE \
    -in "$WORK/archive.tar" -out "$WORK/archive.tar.enc" || die "Encryption failed"
  mv "$WORK/archive.tar.enc" "$WORK/$name.enc"
  name="$name.enc"
else
  mv "$WORK/archive.tar" "$WORK/$name"
fi
(cd "$WORK" && sha256sum "$name" > "$name.sha256")

# Finished files appear in one step, so a half-written backup is never picked up.
mv "$WORK/$name" "$WORK/$name.sha256" "$BACKUP_DIR/"
date -u +%Y-%m-%dT%H:%M:%SZ > "$BACKUP_DIR/LAST_SUCCESS"
size=$(du -h "$BACKUP_DIR/$name" | cut -f1)
log "Backup $TS: wrote $name ($size)$( [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ] && echo ', encrypted' )"

"$(dirname "$0")/prune.sh" "$BACKUP_DIR"

# Off-site copy: only ever an encrypted archive. Without a strong enough passphrase the copy is refused, loudly: the local
# backup above stays (it is permission-restricted and never leaves the machine), but the run fails, the monitoring ping reports
# it, and the health check and verify.sh say so until the configuration is fixed.
offsite_reason=$(offsite_block_reason)
if [ -n "${BACKUP_RCLONE_REMOTE:-}" ]; then
  if [ -n "$offsite_reason" ]; then
    set_offsite_status refused "$offsite_reason"
    die "Off-site copy REFUSED, nothing was sent to $BACKUP_RCLONE_REMOTE: $offsite_reason (the local backup $name was kept)"
  fi
  case "$name" in *.enc) ;; *) set_offsite_status refused "archive is not encrypted"; die "Off-site copy REFUSED: $name is not encrypted" ;; esac
  log "Copying $name to $BACKUP_RCLONE_REMOTE"
  rclone copyto "$BACKUP_DIR/$name" "${BACKUP_RCLONE_REMOTE%/}/$name" || { set_offsite_status failed "copy of $name"; die "Off-site copy of $name failed"; }
  rclone copyto "$BACKUP_DIR/$name.sha256" "${BACKUP_RCLONE_REMOTE%/}/$name.sha256" || { set_offsite_status failed "copy of the checksum"; die "Off-site copy of the checksum failed"; }
  rclone delete "${BACKUP_RCLONE_REMOTE%/}" --min-age "${BACKUP_REMOTE_KEEP_DAYS:-90}d" \
    || log "Warning: could not prune old off-site backups"
  set_offsite_status ok "$name"
  log "Off-site copy complete (encrypted)"
else
  set_offsite_status none
  log "No off-site copy configured (BACKUP_RCLONE_REMOTE is empty): this backup is only as safe as this machine"
fi

ping_ok
