#!/bin/sh
# Retention policy test. Run: docker run --rm -v <repo>/backup:/opt/backup <image> /opt/backup/test/prune.test.sh
set -eu
export BACKUP_DIR=/tmp/prune-test
rm -rf "$BACKUP_DIR"; mkdir -p "$BACKUP_DIR"
# Fixed "now": Tuesday 2026-10-06 12:00:00 UTC
export NOW=$(date -u -d "2026-10-06 12:00:00" +%s)

mk() { touch "$BACKUP_DIR/polysite-$1T030000Z.tar" "$BACKUP_DIR/polysite-$1T030000Z.tar.sha256"; }
# last week, daily
for d in 20261006 20261005 20261004 20261003 20261002 20261001 20260930 20260929; do mk $d; done
mk 20260928   # Monday, 8 days old   -> pruned
mk 20260927   # Sunday, 9 days old   -> kept (weekly)
mk 20260926   # Saturday, 10 days    -> pruned
mk 20260913   # Sunday, 23 days      -> kept (weekly)
mk 20260906   # Sunday, 30 days      -> pruned (past 4 weeks)
mk 20260901   # Tuesday, 1st, 35 d   -> kept (monthly)
mk 20260501   # Friday, 1st, 158 d   -> kept (monthly)
mk 20260401   # Wednesday, 1st, 188d -> pruned (past 6 months)
mk 20260310   # old, ordinary        -> pruned

/opt/backup/prune.sh "$BACKUP_DIR" >/dev/null

fail=0
expect() { # expect kept|gone date
  if [ -f "$BACKUP_DIR/polysite-$2T030000Z.tar" ]; then got=kept; else got=gone; fi
  if [ "$got" != "$1" ]; then echo "FAIL $2: expected $1, got $got"; fail=1; fi
}
for d in 20261006 20261005 20261004 20261003 20261002 20261001 20260930 20260929; do expect kept $d; done
expect gone 20260928; expect kept 20260927; expect gone 20260926; expect kept 20260913
expect gone 20260906; expect kept 20260901; expect kept 20260501; expect gone 20260401; expect gone 20260310
# checksum files travel with their archive
[ ! -f "$BACKUP_DIR/polysite-20260928T030000Z.tar.sha256" ] || { echo "FAIL: orphaned .sha256"; fail=1; }

# The newest backup survives even when everything is ancient.
rm -rf "$BACKUP_DIR"; mkdir -p "$BACKUP_DIR"; mk 20250101; mk 20250102
/opt/backup/prune.sh "$BACKUP_DIR" >/dev/null
[ -f "$BACKUP_DIR/polysite-20250102T030000Z.tar" ] || { echo "FAIL: newest backup was pruned"; fail=1; }
[ ! -f "$BACKUP_DIR/polysite-20250101T030000Z.tar" ] || { echo "FAIL: older ancient backup kept"; fail=1; }

[ "$fail" = 0 ] && echo "prune tests passed"
exit "$fail"
