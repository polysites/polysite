#!/bin/sh
# Runs inside the backup image (see run.sh). Covers: archives are owner-only; an off-site copy is refused unless a strong
# passphrase is set (nothing is sent, the run fails, health check and verify say so); an allowed off-site copy is the encrypted
# archive; verify and restore open encrypted archives and refuse a missing or wrong passphrase.
# shellcheck disable=SC2015
export MEDIA_DIR=/media-test BACKUP_DIR=/tmp/b OFFSITE=/tmp/offsite
B=/opt/backup
fail=0
ok() { echo "ok    $*"; }
bad() { echo "FAIL  $*"; fail=1; }
check() { d=$1; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }
refuse() { d=$1; shift; if "$@" >/dev/null 2>&1; then bad "$d (should have failed)"; else ok "$d"; fi; }
contains() { case "$3" in *"$2"*) ok "$1" ;; *) bad "$1 (no '$2' in: $3)" ;; esac; }
STRONG='Zq8vN3xLp7TmR2wYc5HdKe9JfB4sGa6U'
run() { # env assignments are set by the caller via export; output in $out, status in $rc
  rc=0; out=$("$@" 2>&1) || rc=$?
}
reset() { rm -rf "$BACKUP_DIR" "$OFFSITE"; unset BACKUP_RCLONE_REMOTE BACKUP_ENCRYPTION_PASSPHRASE; }

mkdir -p "$MEDIA_DIR"; echo "hello media" > "$MEDIA_DIR/a.txt"
psql "$DATABASE_URL" -qc "DROP TABLE IF EXISTS users; CREATE TABLE users (id serial primary key, email text); INSERT INTO users (email) VALUES ('a@example.test'),('b@example.test');"

echo "--- 1. no off-site copy, no passphrase: plain local archive, owner-only"
reset
run "$B/backup.sh"; [ "$rc" = 0 ] && ok "backup succeeds" || bad "backup failed: $out"
a=$(ls "$BACKUP_DIR"/polysite-*.tar 2>/dev/null | head -n 1)
[ -n "$a" ] && ok "plain archive written" || bad "no plain archive"
equal_perm() { [ "$(stat -c %a "$1")" = "$2" ]; }
check "archive is mode 600" equal_perm "$a" 600
check "checksum is mode 600" equal_perm "$a.sha256" 600
[ ! -e "$BACKUP_DIR/OFFSITE_STATUS" ] && ok "no off-site status when none is configured" || bad "unexpected OFFSITE_STATUS"

echo "--- 2. off-site copy without a passphrase is refused"
reset
export BACKUP_RCLONE_REMOTE="$OFFSITE"
run "$B/backup.sh"
[ "$rc" != 0 ] && ok "run exits non-zero" || bad "run should have failed"
contains "log says REFUSED" "REFUSED" "$out"
contains "log names the variable" "BACKUP_ENCRYPTION_PASSPHRASE" "$out"
[ -z "$(ls -A "$OFFSITE" 2>/dev/null)" ] && ok "nothing was sent off-site" || bad "files reached the off-site folder"
ls "$BACKUP_DIR"/polysite-*.tar >/dev/null 2>&1 && ok "the local backup was kept" || bad "local backup missing"
case "$(cat "$BACKUP_DIR/OFFSITE_STATUS")" in refused*) ok "OFFSITE_STATUS says refused" ;; *) bad "OFFSITE_STATUS: $(cat "$BACKUP_DIR/OFFSITE_STATUS")" ;; esac
refuse "health check is unhealthy" "$B/healthcheck.sh"
run "$B/verify.sh" latest
[ "$rc" != 0 ] && ok "verify fails" || bad "verify should fail"
contains "verify says why" "off-site copy" "$out"

echo "--- 3. weak passphrases are refused too"
for weak in 'short' 'aaaaaaaaaaaaaaaaaaaaaaaa' 'changeme-changeme-12345' '12345678901234'; do
  reset; export BACKUP_RCLONE_REMOTE="$OFFSITE" BACKUP_ENCRYPTION_PASSPHRASE="$weak"
  run "$B/backup.sh"
  [ "$rc" != 0 ] && [ -z "$(ls -A "$OFFSITE" 2>/dev/null)" ] && ok "refused: '$weak'" || bad "not refused: '$weak'"
done
unset BACKUP_RCLONE_REMOTE BACKUP_ENCRYPTION_PASSPHRASE

echo "--- 4. a strong passphrase: the encrypted archive goes off-site, and only that"
reset; export BACKUP_RCLONE_REMOTE="$OFFSITE" BACKUP_ENCRYPTION_PASSPHRASE="$STRONG"
run "$B/backup.sh"; [ "$rc" = 0 ] && ok "backup succeeds" || bad "backup failed: $out"
enc=$(ls "$OFFSITE"/polysite-*.tar.enc 2>/dev/null | head -n 1)
[ -n "$enc" ] && ok "encrypted archive reached the off-site folder" || bad "no .enc off-site"
ls "$OFFSITE"/polysite-*.tar >/dev/null 2>&1 && bad "a plain archive reached the off-site folder" || ok "no plain archive off-site"
[ "$(head -c 8 "$enc")" = "Salted__" ] && ok "off-site file is OpenSSL-encrypted" || bad "off-site file is not encrypted"
! grep -q "PGDMP\|a@example.test" "$enc" && ok "no plaintext in the off-site file" || bad "plaintext in the off-site file"
check "archive is mode 600" equal_perm "$BACKUP_DIR/$(basename "$enc")" 600
case "$(cat "$BACKUP_DIR/OFFSITE_STATUS")" in ok*) ok "OFFSITE_STATUS ok" ;; *) bad "OFFSITE_STATUS: $(cat "$BACKUP_DIR/OFFSITE_STATUS")" ;; esac
check "health check is healthy" "$B/healthcheck.sh"

echo "--- 5. verify opens encrypted archives"
run "$B/verify.sh" latest; [ "$rc" = 0 ] && ok "verify passes with the passphrase" || bad "verify failed: $out"
contains "verify compared rows" "users: 2 rows OK" "$out"
( unset BACKUP_ENCRYPTION_PASSPHRASE; run "$B/verify.sh" latest; [ "$rc" != 0 ] && echo "ok    verify refuses without a passphrase" || echo "FAIL  verify without passphrase" ) | tee /tmp/r5 ; grep -q FAIL /tmp/r5 && fail=1
( export BACKUP_ENCRYPTION_PASSPHRASE='Wrong-Passphrase-0123456789abcdef'; unset BACKUP_RCLONE_REMOTE; run "$B/verify.sh" latest; [ "$rc" != 0 ] && echo "ok    verify refuses a wrong passphrase" || echo "FAIL  verify with wrong passphrase" ) | tee /tmp/r5 ; grep -q FAIL /tmp/r5 && fail=1

echo "--- 6. restore opens encrypted archives (database and media)"
psql "$DATABASE_URL" -qc "DELETE FROM users;"; rm -f "$MEDIA_DIR/a.txt"
run "$B/restore.sh" latest --yes; [ "$rc" = 0 ] && ok "restore succeeds" || bad "restore failed: $out"
[ "$(psql "$DATABASE_URL" -At -c 'SELECT count(*) FROM users')" = 2 ] && ok "database rows are back" || bad "database not restored"
[ "$(cat "$MEDIA_DIR/a.txt" 2>/dev/null)" = "hello media" ] && ok "media file is back" || bad "media not restored"
check "the safety dump is mode 600" sh -c 'for f in /tmp/b/pre-restore-*.dump; do [ "$(stat -c %a "$f")" = 600 ] || exit 1; done'
( unset BACKUP_ENCRYPTION_PASSPHRASE; run "$B/restore.sh" latest --yes; [ "$rc" != 0 ] && echo "ok    restore refuses without a passphrase" || echo "FAIL  restore without passphrase" ) | tee /tmp/r6; grep -q FAIL /tmp/r6 && fail=1

echo "--- 7. a damaged archive is caught"
reset; export BACKUP_ENCRYPTION_PASSPHRASE="$STRONG"; run "$B/backup.sh"
f=$(ls "$BACKUP_DIR"/polysite-*.tar.enc | head -n 1); printf 'x' >> "$f"
refuse "verify rejects a tampered archive" "$B/verify.sh" latest

psql "$DATABASE_URL" -qc "DROP TABLE IF EXISTS users;" >/dev/null
[ "$fail" = 0 ] && echo "backup encryption tests passed"
exit "$fail"
