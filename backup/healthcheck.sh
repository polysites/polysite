#!/bin/sh
# Healthy while the last successful backup is recent and, when an off-site copy is configured, the
# configuration allows it (encrypted with a strong passphrase). A container that has only
# just started gets a grace period, so a new install isn't "unhealthy" before its
# first backup has had a chance to run.
. "$(dirname "$0")/lib.sh"
reason=$(offsite_block_reason)
[ -z "$reason" ] || { echo "$reason"; exit 1; }
max_hours="${BACKUP_MAX_AGE_HOURS:-36}"
now=$(date +%s)
started=$(stat -c %Y /tmp/started 2>/dev/null || echo "$now")
[ $((now - started)) -lt $((max_hours * 3600)) ] && [ ! -f "${BACKUP_DIR:-/backups}/LAST_SUCCESS" ] && exit 0
last=$(stat -c %Y "${BACKUP_DIR:-/backups}/LAST_SUCCESS" 2>/dev/null) || exit 1
[ $((now - last)) -lt $((max_hours * 3600)) ]
