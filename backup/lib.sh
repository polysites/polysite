#!/bin/sh
# Shared helpers for the backup tooling. Sourced, not run.

BACKUP_DIR="${BACKUP_DIR:-/backups}"
MEDIA_DIR="${MEDIA_DIR:-/media}"

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

# Healthchecks.io-style monitoring: GET the URL on success, URL/fail on failure.
ping_ok() { [ -z "${BACKUP_PING_URL:-}" ] || curl -fsS -m 10 -o /dev/null "$BACKUP_PING_URL" || true; }
ping_fail() { [ -z "${BACKUP_PING_URL:-}" ] || curl -fsS -m 10 -o /dev/null "${BACKUP_PING_URL%/}/fail" || true; }

die() {
  log "ERROR: $*"
  ping_fail
  exit 1
}

# The same connection string pointed at another database on the same server,
# e.g. `db_url_for postgres` or `db_url_for polysite_restore_check`.
db_url_for() {
  printf '%s' "$DATABASE_URL" | sed -E "s#^(postgres(ql)?://[^/]+/)[^?]*#\1$1#"
}

# Turns an archive that may be encrypted into a plain tar in $2. Needs
# BACKUP_ENCRYPTION_PASSPHRASE for *.enc files.
open_archive() {
  case "$1" in
    *.enc)
      [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ] || die "$1 is encrypted but BACKUP_ENCRYPTION_PASSPHRASE is not set"
      openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_ENCRYPTION_PASSPHRASE -in "$1" -out "$2" \
        || die "Could not decrypt $1 (wrong passphrase?)"
      ;;
    *) cp "$1" "$2" ;;
  esac
}

# "latest" or a path/name inside $BACKUP_DIR -> an existing file path.
resolve_archive() {
  case "$1" in
    latest)
      # shellcheck disable=SC2012
      f=$(ls -1 "$BACKUP_DIR"/polysite-*.tar "$BACKUP_DIR"/polysite-*.tar.enc 2>/dev/null | sort | tail -n 1)
      [ -n "$f" ] || die "No backups found in $BACKUP_DIR"
      printf '%s' "$f"
      ;;
    /*) [ -f "$1" ] || die "No such file: $1"; printf '%s' "$1" ;;
    *) [ -f "$BACKUP_DIR/$1" ] || die "No such backup: $BACKUP_DIR/$1"; printf '%s' "$BACKUP_DIR/$1" ;;
  esac
}

# Checks the .sha256 file next to an archive, when there is one.
check_sum() {
  [ -f "$1.sha256" ] || { log "No checksum file for $(basename "$1"), skipping integrity check"; return 0; }
  (cd "$(dirname "$1")" && sha256sum -c "$(basename "$1").sha256" >/dev/null 2>&1) \
    || die "Checksum mismatch for $1: the file is damaged"
}

# An off-site copy leaves the machine, so it must be encrypted with a passphrase worth the name. Prints why the
# off-site copy is not allowed (nothing when it is allowed or not configured). The rules match `polysite doctor`:
# at least 16 characters, not a placeholder, not a few repeated characters.
BACKUP_PASSPHRASE_MIN_LENGTH=16
offsite_block_reason() {
  [ -n "${BACKUP_RCLONE_REMOTE:-}" ] || return 0
  p="${BACKUP_ENCRYPTION_PASSPHRASE:-}"
  if [ -z "$p" ]; then
    echo "BACKUP_RCLONE_REMOTE is set but BACKUP_ENCRYPTION_PASSPHRASE is not: an off-site copy must be encrypted"
  elif [ "${#p}" -lt "$BACKUP_PASSPHRASE_MIN_LENGTH" ]; then
    echo "BACKUP_ENCRYPTION_PASSPHRASE is shorter than $BACKUP_PASSPHRASE_MIN_LENGTH characters: too weak to protect an off-site copy"
  elif printf '%s' "$p" | grep -qiE 'changeme|change-me|replace[-_ ]?me|example|your[-_ ]?secret|password|secret123|xxxx|todo|generate-a-long'; then
    echo "BACKUP_ENCRYPTION_PASSPHRASE looks like a placeholder: set a real random passphrase"
  elif [ "$(printf '%s' "$p" | fold -w1 | sort -u | wc -l)" -lt 10 ]; then
    echo "BACKUP_ENCRYPTION_PASSPHRASE has too little variety (repeated characters): too weak to protect an off-site copy"
  fi
}

# Records what the last off-site attempt did, for the health check, verify and `polysite doctor`.
# Absent when no off-site copy is configured.
set_offsite_status() {
  if [ -z "${BACKUP_RCLONE_REMOTE:-}" ]; then rm -f "$BACKUP_DIR/OFFSITE_STATUS"; return 0; fi
  printf '%s %s %s\n' "$1" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${2:-}" > "$BACKUP_DIR/OFFSITE_STATUS"
}
