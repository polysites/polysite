#!/bin/sh
# Builds Polysite WITH its plugins from your checkouts, loads demo content, and runs every end-to-end check on the whole thing:
# drafts and publishing, languages (core and plugin), two-factor sign-in, single sign-on (against a mock identity provider).
# The fresh-install smoke test (tests/smoke) covers the core on its own; this covers what only exists with the plugins installed,
# so a Payload update that breaks a plugin is caught before it ships. Needs Docker only. Everything lives in its own Docker
# project and is removed afterwards.
#
#   PLUGINS_DIR=../plugins [THEMES_DIR=../themes] tests/e2e/run-with-plugins.sh
set -eu

ROOT=$(git rev-parse --show-toplevel)
PLUGINS_DIR=${PLUGINS_DIR:-$ROOT/plugins}
THEMES_DIR=${THEMES_DIR:-}
[ -d "$PLUGINS_DIR" ] || { echo "no plugins folder at $PLUGINS_DIR (set PLUGINS_DIR)"; exit 1; }

PROJECT=${E2E_PROJECT:-polysite-e2e}
WORK=$(mktemp -d)
SEED_PASSWORD="E2e-Seed-Password-6208"
compose() { (cd "$WORK" && docker compose -p "$PROJECT" -f docker-compose.yml -f tests/smoke/docker-compose.smoke.yml -f tests/e2e/docker-compose.plugins.yml "$@"); }
cleanup() {
  docker rm -f "${PROJECT}-mock-oidc" >/dev/null 2>&1 || true
  compose down -v >/dev/null 2>&1 || true
  rm -rf "$WORK" 2>/dev/null || docker run --rm -v "$WORK:/w" alpine rm -rf /w >/dev/null 2>&1 || true
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

# The core as it is (tracked files and your uncommitted edits), plus the plugins (and, if given, the themes) the same way.
(cd "$ROOT" && git ls-files -z --cached --others --exclude-standard | tar --null --ignore-failed-read -T - -cf -) | tar -x -C "$WORK"
rm -rf "$WORK/plugins" "$WORK/themes"
mkdir -p "$WORK/plugins" "$WORK/themes"
# E2E_PLUGINS=search,posts builds with just those plugins (and runs just their checks): for working on one plugin at a time.
PLUGIN_FILTER=cat
[ -z "${E2E_PLUGINS:-}" ] || PLUGIN_FILTER="grep -zE ^($(echo "$E2E_PLUGINS" | tr ',' '|'))/"
(cd "$PLUGINS_DIR" && git ls-files -z --cached --others --exclude-standard | $PLUGIN_FILTER | tar --null --ignore-failed-read -T - -cf -) | tar -x -C "$WORK/plugins"
if [ -n "$THEMES_DIR" ]; then
  (cd "$THEMES_DIR" && git ls-files -z --cached --others --exclude-standard | tar --null --ignore-failed-read -T - -cf -) | tar -x -C "$WORK/themes"
fi

cp "$WORK/.env.example" "$WORK/.env"
sed -i 's/^SITE_DOMAIN=.*/SITE_DOMAIN=localhost:8080/; s/^CMS_DOMAIN=.*/CMS_DOMAIN=admin.localhost:8080/' "$WORK/.env"

echo "Building and starting Polysite with its plugins (this takes several minutes)..."
compose up -d --build caddy redis

wait_healthy() {
  n=0
  until [ "$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q "$1")")" = "healthy" ]; do
    n=$((n + 1)); [ "$n" -le 90 ] || { echo "$1 never became healthy"; compose logs --tail 60 "$1" || true; exit 1; }
    sleep 5
  done
}
wait_healthy cms
wait_healthy web

echo "Checking that the core and each plugin own only their own database tables..."
compose exec -T cms sh scripts/pluginMigrations.sh check || { echo "plugin isolation check FAILED"; exit 1; }

echo "Loading demo content..."
SEED_THEME=starter
[ -n "$THEMES_DIR" ] || SEED_THEME=default
compose exec -T -e SEED_PASSWORD="$SEED_PASSWORD" -e SEED_THEME="$SEED_THEME" cms npx payload run scripts/seedDevData.ts > "$WORK/seed.log" 2>&1 || { echo "seeding failed:"; tail -30 "$WORK/seed.log"; exit 1; }
PLUGINS_ABS=$(cd "$WORK/plugins" && (pwd -W 2>/dev/null || pwd))
E2E_ABS=$(cd "$WORK/tests/e2e" && (pwd -W 2>/dev/null || pwd))
NETWORK="${PROJECT}_default"

# A tiny OpenID Connect provider for the single-sign-on check.
if [ -d "$PLUGINS_ABS/auth" ]; then
MSYS_NO_PATHCONV=1 docker run -d --name "${PROJECT}-mock-oidc" --network "$NETWORK" --network-alias mock-oidc \
  -v "$PLUGINS_ABS/auth:/auth" -w /auth -e PORT=9000 -e ISSUER=http://mock-oidc:9000 node:22 \
  sh -c 'npm ci --silent && node test/e2e/mock-oidc.mjs' >/dev/null
n=0
until docker logs "${PROJECT}-mock-oidc" 2>&1 | grep -q "mock OIDC provider on"; do
  n=$((n + 1)); [ "$n" -le 60 ] || { echo "the mock identity provider never started"; docker logs "${PROJECT}-mock-oidc" | tail -20; exit 1; }
  sleep 2
done
fi

failed=0
run_check() { # name, working directory (mounted at /w), script
  [ -d "$2" ] || { echo "== $1 (skipped: not installed)"; return 0; }
  echo "== $1"
  if MSYS_NO_PATHCONV=1 docker run --rm --network "$NETWORK" -v "$2:/w:ro" -w /w \
    -e BASE=http://cms:3001 -e WEB=http://web:3000 -e MOCK=http://mock-oidc:9000 \
    -e ADMIN_EMAIL=admin@dev.local -e ADMIN_PASSWORD="$SEED_PASSWORD" -e SITE_ID=1 -e SITE_HOST=voidslate.localhost \
    -e OTHER_SITE_ID=2 -e OTHER_HOST=second.localhost \
    node:22 node "$3"; then :; else failed=1; echo "$1: FAILED"; fi
}

run_check "content workflow" "$E2E_ABS" workflow.e2e.mjs
run_check "translatable content" "$E2E_ABS" i18n.e2e.mjs
run_check "access rules (security review)" "$E2E_ABS" security.e2e.mjs
[ -d "$PLUGINS_ABS/i18n" ] && run_check "a site in two languages" "$E2E_ABS" multilang.e2e.mjs
run_check "two-factor sign-in" "$PLUGINS_ABS/auth" test/e2e/two-factor.e2e.mjs
run_check "single sign-on" "$PLUGINS_ABS/auth" test/e2e/sso.e2e.mjs
run_check "site search" "$PLUGINS_ABS/search" test/e2e/search.e2e.mjs
run_check "API keys" "$PLUGINS_ABS/auth" test/e2e/api-keys.e2e.mjs
run_check "news (posts)" "$PLUGINS_ABS/posts" test/e2e/posts.e2e.mjs
run_check "tracking settings (analytics)" "$PLUGINS_ABS/analytics" test/e2e/analytics.e2e.mjs
run_check "share buttons" "$PLUGINS_ABS/share" test/e2e/share.e2e.mjs
run_check "content blocks (blocks-pack)" "$PLUGINS_ABS/blocks-pack" test/e2e/blocks.e2e.mjs

if [ "$failed" -ne 0 ]; then
  echo "At least one end-to-end check failed. Recent CMS logs:"
  compose logs --tail 80 cms || true
  exit 1
fi
echo "All end-to-end checks passed."
