#!/bin/sh
# Builds a fresh Polysite from the tracked files (like tests/smoke/run.sh), gives the CMS one CPU and 1 GB and its database one CPU and
# 512 MB (a small server's share), and measures the public form intake under rising load with tests/load/intake-load.mjs. Prints the
# results and the peak CPU and memory the two containers used. Needs Docker only. Takes about ten minutes, most of it the build.
#
#   tests/load/run.sh
#
# The load generator runs on the same machine, so absolute numbers are indicative, not a promise: compare runs on one machine, and repeat
# on the real server before you plan around them.
set -eu

ROOT=$(git rev-parse --show-toplevel)
PROJECT=polysite-load
WORK=$(mktemp -d)

compose() { (cd "$WORK" && docker compose -p "$PROJECT" -f docker-compose.yml -f tests/load/docker-compose.load.yml "$@"); }
cleanup() {
  [ -z "${SAMPLER:-}" ] || kill "$SAMPLER" 2>/dev/null || true
  compose down -v >/dev/null 2>&1 || true
  rm -rf "$WORK" 2>/dev/null || docker run --rm -v "$WORK:/w" alpine rm -rf /w/backups >/dev/null 2>&1 || true
  rm -rf "$WORK" 2>/dev/null || true
}
trap cleanup EXIT

(cd "$ROOT" && git ls-files -z --cached --others --exclude-standard | tar --null --ignore-failed-read -T - -cf -) | tar -x -C "$WORK"
cp "$WORK/.env.example" "$WORK/.env"
sed -i 's/^SITE_DOMAIN=.*/SITE_DOMAIN=localhost:8080/; s/^CMS_DOMAIN=.*/CMS_DOMAIN=admin.localhost:8080/' "$WORK/.env"

echo "Building and starting the CMS and database (a few minutes)..."
compose up -d --build cms

n=0
until [ "$(docker inspect --format '{{.State.Health.Status}}' "$(compose ps -q cms)")" = "healthy" ]; do
  n=$((n + 1)); [ "$n" -le 60 ] || { echo "cms never became healthy"; compose logs --tail 60 cms || true; exit 1; }
  sleep 5
done

# Sample the two containers every two seconds while the load runs.
STATS="$WORK/stats.txt"
IDS="$(compose ps -q cms) $(compose ps -q db)"
( while true; do docker stats --no-stream --format '{{.Name}} {{.CPUPerc}} {{.MemUsage}}' $IDS >> "$STATS" 2>/dev/null; sleep 2; done ) &
SAMPLER=$!

LOAD_DIR=$(cd "$WORK/tests/load" && (pwd -W 2>/dev/null || pwd))
MSYS_NO_PATHCONV=1 docker run --rm --network "${PROJECT}_default" -v "$LOAD_DIR:/load:ro" \
  -e CMS=http://cms:3001 -e SITE_HOST=localhost -e STAGE_SECONDS="${STAGE_SECONDS:-15}" node:22 node /load/intake-load.mjs
status=$?

kill "$SAMPLER" 2>/dev/null || true
SAMPLER=""
echo "== peak use while loaded (limits: cms 1 CPU and 1 GB, db 1 CPU and 512 MB)"
awk '
  function mib(s) { v = s + 0; if (s ~ /GiB/) return v * 1024; if (s ~ /KiB/) return v / 1024; return v }
  { name = $1; cpu = $2; sub("%", "", cpu); cpu += 0; mem = mib($3);
    if (cpu > pcpu[name]) pcpu[name] = cpu; if (mem > pmem[name]) pmem[name] = mem }
  END { for (n in pcpu) printf "%s: peak CPU %.0f%%, peak memory %.0f MiB\n", n, pcpu[n], pmem[n] }
' "$STATS" || true
exit "$status"
