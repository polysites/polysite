#!/bin/sh
# Applies the retention policy to $BACKUP_DIR (or the directory given as $1):
#   - every backup from the last BACKUP_KEEP_DAILY days (default 7)
#   - Sunday backups for BACKUP_KEEP_WEEKLY weeks (default 4)
#   - first-of-the-month backups for BACKUP_KEEP_MONTHLY months (default 6)
# The newest backup is never deleted. NOW (epoch seconds) can be set for testing.
set -eu
. "$(dirname "$0")/lib.sh"

DIR="${1:-$BACKUP_DIR}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
KEEP_MONTHLY="${BACKUP_KEEP_MONTHLY:-6}"
NOW="${NOW:-$(date -u +%s)}"

# shellcheck disable=SC2012
newest=$(ls -1 "$DIR"/polysite-*.tar "$DIR"/polysite-*.tar.enc 2>/dev/null | sort | tail -n 1 || true)
removed=0

for f in "$DIR"/polysite-*.tar "$DIR"/polysite-*.tar.enc; do
  [ -f "$f" ] || continue
  [ "$f" = "$newest" ] && continue
  stamp=$(basename "$f" | sed -E 's/^polysite-([0-9]{8})T([0-9]{6})Z\.tar(\.enc)?$/\1 \2/')
  case "$stamp" in *[!0-9\ ]*|"") continue ;; esac   # not one of ours
  d=${stamp% *}; t=${stamp#* }
  iso="$(echo "$d" | sed -E 's/(....)(..)(..)/\1-\2-\3/') $(echo "$t" | sed -E 's/(..)(..)(..)/\1:\2:\3/')"
  ts=$(date -u -d "$iso" +%s)
  age_days=$(( (NOW - ts) / 86400 ))
  dow=$(date -u -d "$iso" +%u)
  dom=$(date -u -d "$iso" +%d)

  keep=no
  [ "$age_days" -le "$KEEP_DAILY" ] && keep=yes
  [ "$dow" = 7 ] && [ "$age_days" -le $((KEEP_WEEKLY * 7)) ] && keep=yes
  [ "$dom" = 01 ] && [ "$age_days" -le $((KEEP_MONTHLY * 31)) ] && keep=yes

  if [ "$keep" = no ]; then
    rm -f "$f" "$f.sha256"
    removed=$((removed + 1))
    log "Pruned $(basename "$f") (${age_days} days old)"
  fi
done
log "Retention: removed $removed old backup(s)"
