#!/bin/sh
# Smoke-tests IMAGES instead of source: starts the fresh-install stack (no themes, no plugins) from the given images and
# runs the same checks as tests/smoke/run.sh. The release workflow runs it on the digests it just pushed, so what is tested is
# exactly what was published. Needs Docker only; everything lives in its own Docker project and is removed afterwards.
#
#   CMS_IMAGE=ghcr.io/o/polysite-cms@sha256:... WEB_IMAGE=... BACKUP_IMAGE=... [EXPECT_VERSION=0.1.0] sh .github/scripts/smoke-images.sh
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
: "${CMS_IMAGE:?set CMS_IMAGE}" "${WEB_IMAGE:?set WEB_IMAGE}" "${BACKUP_IMAGE:?set BACKUP_IMAGE}"
export CMS_IMAGE WEB_IMAGE BACKUP_IMAGE
PROJECT=${SMOKE_PROJECT:-polysite-imgsmoke}
WORK=$(mktemp -d)

compose() { (cd "$WORK" && docker compose -p "$PROJECT" -f docker-compose.yml -f tests/smoke/docker-compose.smoke.yml -f .github/scripts/docker-compose.images.yml "$@"); }
cleanup() {
  compose down -v >/dev/null 2>&1 || true
  rm -rf "$WORK" 2>/dev/null || docker run --rm -v "$WORK:/w" alpine rm -rf /w >/dev/null 2>&1 || true
}
trap cleanup EXIT

# Only the files the stack reads at run time: no source, no themes, no plugins.
mkdir -p "$WORK/tests" "$WORK/.github"
cp "$ROOT/docker-compose.yml" "$ROOT/Caddyfile" "$ROOT/.env.example" "$WORK/"
cp -R "$ROOT/tests/smoke" "$ROOT/tests/e2e" "$WORK/tests/"
cp -R "$ROOT/.github/scripts" "$WORK/.github/"
cp "$WORK/.env.example" "$WORK/.env"
sed -i 's/^SITE_DOMAIN=.*/SITE_DOMAIN=localhost:8080/; s/^CMS_DOMAIN=.*/CMS_DOMAIN=admin.localhost:8080/' "$WORK/.env"

echo "Starting a fresh stack from the images:"
echo "  cms     $CMS_IMAGE"
echo "  web     $WEB_IMAGE"
echo "  backup  $BACKUP_IMAGE (not started: it is checked for its version label only)"
compose pull --quiet cms web >/dev/null 2>&1 || true   # local images have nothing to pull; pushed digests are pulled
compose up -d --no-build caddy redis

wait_healthy() {
  n=0
  until [ "$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q "$1")")" = "healthy" ]; do
    n=$((n + 1)); [ "$n" -le 60 ] || { echo "$1 never became healthy"; compose logs --tail 60 "$1" || true; exit 1; }
    sleep 5
  done
}
wait_healthy cms
wait_healthy web

if [ -n "${EXPECT_VERSION:-}" ]; then
  for pair in "cms $CMS_IMAGE" "web $WEB_IMAGE" "backup $BACKUP_IMAGE"; do
    svc=${pair%% *}; img=${pair#* }
    # The backup image is not part of the running stack, so nothing has pulled it yet; local images are already there.
    docker image inspect "$img" >/dev/null 2>&1 || docker pull --quiet "$img" >/dev/null
    got=$(docker image inspect "$img" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')
    [ "$got" = "$EXPECT_VERSION" ] || { echo "$svc image says version '$got', expected $EXPECT_VERSION"; exit 1; }
  done
  for svc in cms web; do
    port=3001; [ "$svc" = web ] && port=3000
    got=$(compose exec -T "$svc" wget -q -O - "http://127.0.0.1:$port/api/health" | sed -n 's/.*"version":"\([^"]*\)".*/\1/p')
    [ "$got" = "$EXPECT_VERSION" ] || { echo "$svc reports version '$got', expected $EXPECT_VERSION"; exit 1; }
  done
  echo "Versions: all three images and the running apps say $EXPECT_VERSION."
fi

SMOKE_DIR=$(cd "$WORK/tests/smoke" && (pwd -W 2>/dev/null || pwd))
if MSYS_NO_PATHCONV=1 docker run --rm --network "${PROJECT}_default" -v "$SMOKE_DIR:/smoke:ro" \
  -e BASE=http://caddy:8080 node:24 node /smoke/smoke.mjs; then
  echo "Smoke test passed."
  for svc in cms web; do
    [ "$(compose exec -T "$svc" id -u | tr -d '\r')" != "0" ] || { echo "$svc runs as root"; exit 1; }
    echo "$svc: unprivileged and healthy."
  done
  E2E_DIR=$(cd "$WORK/tests/e2e" && (pwd -W 2>/dev/null || pwd))
  for check in workflow i18n; do
    echo "== $check check"
    if ! MSYS_NO_PATHCONV=1 docker run --rm --network "${PROJECT}_default" -v "$E2E_DIR:/e:ro" -w /e \
      -e BASE=http://cms:3001 -e ADMIN_EMAIL=smoke-admin@example.test -e ADMIN_PASSWORD=Smoke-Test-Password-4821 \
      -e SITE_ID=1 -e SITE_HOST=localhost node:24 node "$check.e2e.mjs"; then
      echo "The $check check FAILED. Recent logs:"; compose logs --tail 60 cms || true; exit 1
    fi
  done
  echo "Image smoke test passed."
else
  echo "Smoke test FAILED. Recent logs:"; compose logs --tail 60 cms web || true; exit 1
fi
