#!/bin/sh
# Builds a FRESH Polysite from the tracked files of this checkout (no themes/ and no plugins/, exactly what a
# stranger gets from a clone), starts the whole stack in its own Docker project, runs tests/smoke/smoke.mjs against it
# and tears everything down. Needs Docker only; the test itself runs in a Node container.
#
#   tests/smoke/run.sh
set -eu

ROOT=$(git rev-parse --show-toplevel)
PROJECT=polysite-smoke
WORK=$(mktemp -d)

compose() { (cd "$WORK" && docker compose -p "$PROJECT" -f docker-compose.yml -f tests/smoke/docker-compose.smoke.yml "$@"); }
cleanup() {
  compose down -v >/dev/null 2>&1 || true
  # A container running as root may have written into the folder; clean up without failing the run over it.
  rm -rf "$WORK" 2>/dev/null || docker run --rm -v "$WORK:/w" alpine rm -rf /w/backups >/dev/null 2>&1 || true
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

# The working tree as it is (including uncommitted edits), minus anything git ignores: so no themes/, plugins/ or .env.
(cd "$ROOT" && git ls-files -z --cached --others --exclude-standard | tar --null --ignore-failed-read -T - -cf -) | tar -x -C "$WORK"
[ ! -e "$WORK/themes" ] && [ ! -e "$WORK/plugins" ] || { echo "the copy unexpectedly has themes/ or plugins/"; exit 1; }

cp "$WORK/.env.example" "$WORK/.env"
sed -i 's/^SITE_DOMAIN=.*/SITE_DOMAIN=localhost:8080/; s/^CMS_DOMAIN=.*/CMS_DOMAIN=admin.localhost:8080/' "$WORK/.env"

echo "Building and starting a fresh stack (this takes a few minutes)..."
# The backup service isn't needed to test the site, and it writes root-owned files into the folder.
compose up -d --build caddy redis

# Start testing only when Docker's own health check says each app is up: the server answers a moment before the
# database is migrated and the first roles are seeded, and a test that starts in that gap fails for no real reason.
wait_healthy() {
  n=0
  until [ "$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q "$1")")" = "healthy" ]; do
    n=$((n + 1)); [ "$n" -le 60 ] || { echo "$1 never became healthy"; compose logs --tail 60 "$1" || true; exit 1; }
    sleep 5
  done
}
wait_healthy cms
wait_healthy web

SMOKE_DIR=$(cd "$WORK/tests/smoke" && (pwd -W 2>/dev/null || pwd))
if MSYS_NO_PATHCONV=1 docker run --rm --network "${PROJECT}_default" -v "$SMOKE_DIR:/smoke:ro" \
  -e BASE=http://caddy:8080 node:22 node /smoke/smoke.mjs; then
  echo "Smoke test passed."
  # The public site's per-address request cap: the old library default (150 per 5 minutes) is gone and the new cap triggers.
  MSYS_NO_PATHCONV=1 docker run --rm --network "${PROJECT}_default" -v "$SMOKE_DIR:/smoke:ro" \
    -e BASE=http://caddy:8080 node:22 node /smoke/ratelimit.mjs || { echo "The request cap check FAILED."; exit 1; }

  # The images must also run unprivileged.
  for svc in cms web; do
    [ "$(compose exec -T "$svc" id -u | tr -d '\r')" != "0" ] || { echo "$svc runs as root"; exit 1; }
    echo "$svc: unprivileged and healthy."
  done

  # The checks that are also run by hand against a dev stack (drafts and publishing, translatable content), now on every run:
  # they exercise Payload's own behaviour (versions, drafts, locales, access), which is what a Payload update can change.
  E2E_DIR=$(cd "$WORK/tests/e2e" && (pwd -W 2>/dev/null || pwd))
  for check in workflow i18n security; do
    echo "== $check check"
    if ! MSYS_NO_PATHCONV=1 docker run --rm --network "${PROJECT}_default" -v "$E2E_DIR:/e:ro" -w /e \
      -e BASE=http://cms:3001 -e ADMIN_EMAIL=smoke-admin@example.test -e ADMIN_PASSWORD=Smoke-Test-Password-4821 \
      -e SITE_ID=1 -e SITE_HOST=localhost node:22 node "$check.e2e.mjs"; then
      echo "The $check check FAILED. Recent logs:"
      compose logs --tail 60 cms || true
      exit 1
    fi
  done
else
  echo "Smoke test FAILED. Recent logs:"
  compose logs --tail 60 cms web || true
  exit 1
fi
