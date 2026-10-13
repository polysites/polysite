#!/bin/sh
# Exercises deploy/deploy.sh for real against a throwaway stack in its own Docker project (psdeploytest), with a local
# shellcheck disable=SC2015  # "cmd && ok || bad" is the test idiom here; ok and bad cannot fail
# registry and several fake releases built from this checkout. It never touches your other containers, volumes or databases.
#
#   1.0.0  built from the checkout                 2.0.0  the same code, another version (a normal upgrade)
#   3.0.0  2.0.0 with a health check that fails    4.0.0  2.0.0 plus a plugin migration that drops a table
#   9.9.9  the 1.0.0 image under a wrong tag (the tag and the image disagree)
#
# Scenario: dry run -> first deploy of 1.0.0 -> refuse 9.9.9 -> deploy 2.0.0 (backup + verified restore) -> refuse 4.0.0
# (destructive migration guard) -> deploy 3.0.0 (health gate fails, automatic rollback to 2.0.0) -> manual --rollback to
# 1.0.0 and forward again -> redeploying the current version is a no-op. Data written at 1.0.0 must survive all of it.
#
#   sh tests/deploy/run.sh        (takes 10 to 20 minutes the first time; later runs reuse the build cache)
set -eu

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
PROJECT=${DEPLOY_TEST_PROJECT:-psdeploytest}
PORT=${DEPLOY_TEST_REGISTRY_PORT:-5599}
REG="localhost:$PORT/polysite"
WORK=$(mktemp -d)
STACK="$WORK/stack"
fail=0
ok() { echo "ok    $*"; }
bad() { echo "FAIL  $*"; fail=1; }
check() { # description, command...
  d=$1; shift
  if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi
}
equal() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (expected '$2', got '$3')"; fi; }

compose() { (cd "$STACK" && POLYSITE_VERSION=0.0.0 docker compose -p "$PROJECT" --env-file .env -f docker-compose.prod.yml -f override.yml "$@"); }
deploy() { # run deploy.sh against the throwaway stack; the exit status is returned
  POLYSITE_REGISTRY=$REG MIN_FREE_MB=100 sh "$ROOT/deploy/deploy.sh" --dir "$STACK" --project "$PROJECT" \
    --compose-file docker-compose.prod.yml --compose-file override.yml "$@"
}
running_digest() { docker inspect "$(compose ps -q "$1" | head -n 1)" --format '{{.Image}}'; }
running_version() { # the version the app answers on /api/health
  port=3001; [ "$1" = web ] && port=3000
  compose exec -T "$1" wget -q -O - "http://127.0.0.1:$port/api/health" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p'
}
cleanup() {
  echo "Cleaning up..."
  compose --profile restore down -v --remove-orphans >/dev/null 2>&1 || true
  docker rm -f "${PROJECT}-registry" >/dev/null 2>&1 || true
  for v in 1.0.0 2.0.0 3.0.0 4.0.0 9.9.9; do for i in cms web backup; do docker rmi "$REG/polysite-$i:v$v" >/dev/null 2>&1 || true; done; done
  for i in cms web backup; do docker rmi "polysite-previous-$i:latest" >/dev/null 2>&1 || true; done
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

# ---- build the fake releases ---------------------------------------------------------------------------------------
echo "== building images from the checkout (core only, as the release workflow does)"
mkdir -p "$WORK/ctx"
(cd "$ROOT" && git ls-files -z --cached --others --exclude-standard | tar --null --ignore-failed-read -T - -cf -) | tar -x -C "$WORK/ctx"
mkdir -p "$WORK/ctx/themes" "$WORK/ctx/plugins"
for v in 1.0.0 2.0.0; do
  for i in cms web; do
    (cd "$WORK/ctx" && docker build -q -f "apps/$i/Dockerfile" --target run --build-arg POLYSITE_VERSION=$v --build-arg POLYSITE_REVISION=test \
      -t "$REG/polysite-$i:v$v" .) >/dev/null
  done
  docker build -q --build-arg POLYSITE_VERSION=$v -t "$REG/polysite-backup:v$v" "$ROOT/backup" >/dev/null
done

relabel() { # <from version> <to version> [extra Dockerfile lines for cms]
  for i in cms web backup; do
    d="$WORK/relabel-$i"; mkdir -p "$d"
    { echo "FROM $REG/polysite-$i:v$1"
      echo "LABEL org.opencontainers.image.version=$2"
      [ "$i" = backup ] || echo "ENV POLYSITE_VERSION=$2"
      [ "$i" != cms ] || printf '%s\n' "${3:-}"; } > "$d/Dockerfile"
    [ ! -f "$WORK/extra.js" ] || cp "$WORK/extra.js" "$d/"
    docker build -q -t "$REG/polysite-$i:v$2" "$d" >/dev/null
  done
}
relabel 2.0.0 3.0.0 'HEALTHCHECK --interval=3s --timeout=2s --retries=1 CMD false'
cat > "$WORK/extra.js" <<'EOF'
export async function up({ db, sql }) { await db.execute(sql`DROP TABLE "important_table"`) }
export async function down() {}
EOF
relabel 2.0.0 4.0.0 'COPY extra.js /repo/plugins/evil/migrations/20260101_000000_evil.js'
rm -f "$WORK/extra.js"
for i in cms web backup; do docker tag "$REG/polysite-$i:v1.0.0" "$REG/polysite-$i:v9.9.9"; done

echo "== starting a local registry and pushing the fake releases"
docker rm -f "${PROJECT}-registry" >/dev/null 2>&1 || true
docker run -d --name "${PROJECT}-registry" -p "127.0.0.1:$PORT:5000" registry:2 >/dev/null
sleep 3
for v in 1.0.0 2.0.0 3.0.0 4.0.0 9.9.9; do for i in cms web backup; do docker push -q "$REG/polysite-$i:v$v" >/dev/null; done; done
# Pulling must come from the registry, as in production: drop the local tags.
for v in 1.0.0 2.0.0 3.0.0 4.0.0 9.9.9; do for i in cms web backup; do docker rmi "$REG/polysite-$i:v$v" >/dev/null 2>&1 || true; done; done

# ---- the stack under test ------------------------------------------------------------------------------------------
mkdir -p "$STACK"
cp "$ROOT/docker-compose.prod.yml" "$ROOT/Caddyfile" "$STACK/"
cp "$ROOT/.env.example" "$STACK/.env"
printf 'CLOUD_SQL_CONNECTION_NAME=unused\nGOOGLE_APPLICATION_CREDENTIALS_HOST_PATH=/dev/null\n' >> "$STACK/.env"
cat > "$STACK/override.yml" <<'EOF'
# Test-only: a local Postgres instead of Cloud SQL, no published ports, backups in a named volume.
services:
  caddy:
    ports: !reset []
  cloudsql-proxy:
    profiles: ["disabled"]
  db:
    image: postgres:16-alpine
    env_file: .env
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U $${POSTGRES_USER} -d $${POSTGRES_DB}"]
      interval: 3s
      retries: 20
    volumes:
      - db-data:/var/lib/postgresql/data
  cms:
    depends_on: !override
      db: { condition: service_healthy }
  backup:
    depends_on: !override
      db: { condition: service_healthy }
    volumes: !override
      - media-data:/media:ro
      - backups:/backups
volumes:
  db-data:
  backups:
EOF
audit_has() { grep -q "$1" "$STACK/.deploy/audit.log" 2>/dev/null; }

echo "== 1. dry run on an empty machine: plans, pulls, changes nothing"
out=$(deploy 1.0.0 --dry-run 2>&1) || { echo "$out"; bad "dry run failed"; }
echo "$out" | tail -n 8
equal "dry run created no containers" "" "$(compose ps -a -q)"
check "dry run left no candidate file behind" test ! -f "$STACK/.deploy/candidate.env"

echo "== 2. first deploy of 1.0.0"
deploy 1.0.0 --health-timeout 240 && ok "first deploy exits 0" || bad "first deploy"
equal "cms reports 1.0.0" 1.0.0 "$(running_version cms)"
equal "web reports 1.0.0" 1.0.0 "$(running_version web)"
check "current.env records 1.0.0" grep -q '^POLYSITE_VERSION=1.0.0$' "$STACK/.deploy/current.env"
check "no previous.env after a first deploy" test ! -f "$STACK/.deploy/previous.env"
D1_CMS=$(running_digest cms)
compose exec -T db psql -U polysite -d polysite -qc "CREATE TABLE deploy_marker(v text); INSERT INTO deploy_marker VALUES ('written at 1.0.0'); CREATE TABLE important_table(id int)" >/dev/null
marker() { compose exec -T db psql -U polysite -d polysite -At -c "SELECT count(*) FROM deploy_marker" | tr -d '\r'; }

echo "== 3. a tag that disagrees with its image is refused before anything changes"
deploy 9.9.9 >/dev/null 2>&1 && bad "9.9.9 was accepted" || ok "9.9.9 refused"
equal "still running 1.0.0" 1.0.0 "$(running_version cms)"
equal "the same container is still running" "$D1_CMS" "$(running_digest cms)"

echo "== 4. upgrade to 2.0.0: backup, test restore, migrations, one service at a time"
deploy 2.0.0 --health-timeout 240 && ok "upgrade exits 0" || bad "upgrade"
equal "cms reports 2.0.0" 2.0.0 "$(running_version cms)"
equal "web reports 2.0.0" 2.0.0 "$(running_version web)"
audit_has 'event=backup name=polysite-.*result=verified' && ok "audit log: backup taken and verified" || bad "audit log: backup"
audit_has 'event=migrate result=ok' && ok "audit log: migrations applied" || bad "audit log: migrations"
audit_has 'event=success version=2.0.0' && ok "audit log: success recorded" || bad "audit log: success"
if compose exec -T backup sh -c 'ls /backups/polysite-*.tar' >/dev/null 2>&1; then ok "a backup archive exists in the backups volume"; else bad "no backup archive in the backups volume"; fi
check "previous.env records 1.0.0" grep -q '^POLYSITE_VERSION=1.0.0$' "$STACK/.deploy/previous.env"
equal "data written at 1.0.0 is intact" 1 "$(marker)"
D2_CMS=$(running_digest cms); D2_WEB=$(running_digest web)
[ "$D2_CMS" != "$D1_CMS" ] && ok "the cms container is a different image" || bad "cms image did not change"

echo "== 5. a release with a data-deleting migration is refused by the guard"
deploy 4.0.0 >/dev/null 2>&1 && bad "4.0.0 was accepted" || ok "4.0.0 refused"
equal "nothing changed: still the 2.0.0 container" "$D2_CMS" "$(running_digest cms)"
equal "important_table still exists" 1 "$(compose exec -T db psql -U polysite -d polysite -At -c "SELECT count(*) FROM information_schema.tables WHERE table_name='important_table'" | tr -d '\r')"

echo "== 6. a release whose cms never becomes healthy: automatic rollback"
set +e; deploy 3.0.0 --health-timeout 90; rc=$?; set -e
equal "exit status 3 (failed and rolled back)" 3 "$rc"
equal "cms is back on the 2.0.0 image" "$D2_CMS" "$(running_digest cms)"
equal "web is back on the 2.0.0 image" "$D2_WEB" "$(running_digest web)"
equal "cms reports 2.0.0 again" 2.0.0 "$(running_version cms)"
audit_has 'event=rollback-done result=ok' && ok "audit log: rollback recorded" || bad "audit log: rollback"
check "current.env still says 2.0.0" grep -q '^POLYSITE_VERSION=2.0.0$' "$STACK/.deploy/current.env"
equal "data is intact after the failed deploy" 1 "$(marker)"

echo "== 7. manual rollback, then forward again"
deploy --rollback --dry-run >/dev/null 2>&1 && ok "rollback dry run" || bad "rollback dry run"
equal "a dry-run rollback changed nothing" 2.0.0 "$(running_version cms)"
deploy --rollback --health-timeout 240 && ok "rollback exits 0" || bad "rollback"
equal "cms reports 1.0.0" 1.0.0 "$(running_version cms)"
equal "cms is the original 1.0.0 container image" "$D1_CMS" "$(running_digest cms)"
deploy --rollback --health-timeout 240 && ok "second rollback goes forward" || bad "second rollback"
equal "cms reports 2.0.0" 2.0.0 "$(running_version cms)"
equal "data is intact" 1 "$(marker)"

echo "== 8. redeploying what is already running does nothing"
out=$(deploy 2.0.0 2>&1) && echo "$out" | grep -q "Nothing to do" && ok "no-op" || { echo "$out" | tail -n 5; bad "no-op"; }

echo
echo "Audit log:"; sed 's/^/  /' "$STACK/.deploy/audit.log"
[ "$fail" = 0 ] && echo "All deploy tests passed." || { echo "Some deploy tests FAILED."; exit 1; }
