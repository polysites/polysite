#!/bin/sh
# Safe deploy for the single-VM Docker Compose stack. Switches the stack to a published release, one step at a time,
# and puts it back by itself if a step fails. It posts nothing to any outside service.
#
#   deploy/deploy.sh <version> [options]      deploy a release, e.g. 0.1.0 or 0.2.0-beta.1
#   deploy/deploy.sh --rollback [options]     put the previous deployment back
#
# What a deploy does, in order (no running service is touched before step 6):
#   1. Pre-flight: Docker and Compose, free disk, a valid compose file, the current stack healthy.
#   2. Pulls the images for <version>, checks that each one reports that version, and pins them by digest.
#   3. Runs the migration guards (read-only) inside the NEW cms image: refuses a migration that deletes data.
#   4. Takes a backup with the running backup service and test-restores it (verify.sh); records the digests of
#      what is running now (the way back).
#   5. Applies the database migrations (core and plugins) in a one-off container from the new image, while the
#      old services keep serving. A failure here leaves the old services as they were.
#   6. Replaces cms, web and backup one at a time, waiting for each to be healthy and to report the new version.
#   7. If anything in step 5 or 6 fails, puts the recorded digests back and says so. Everything goes to the audit log.
#
# Options:
#   --dry-run             steps 1 to 3 and print the plan; changes nothing on the stack (images are pulled)
#   --rollback            go back to the deployment before the last one (images only; see docs/guide/deploying.md)
#   --compose-file FILE   compose file (repeatable; default docker-compose.prod.yml)
#   --env-file FILE       the env file the stack uses (default .env)
#   --project NAME        compose project name (default: the compose file's own `name`)
#   --dir DIR             run from this directory (default: the repository or bundle root, two levels above this script)
#   --state-dir DIR       where deployment records and the audit log live (default: .deploy in that directory)
#   --url URL             after the rollout, require this URL to answer with a success status (repeatable)
#   --skip-backup         do not take a backup (recorded in the audit log; the first deploy never takes one)
#   --allow-destructive   allow migrations marked polysite:allow-destructive. Rolling back images is then NOT safe:
#                         the backup taken first is the way back
#   --force               deploy even if the current stack is not healthy, or re-run the version already deployed
#   --health-timeout SEC  how long each service gets to become healthy (default 300)
#
# Environment: POLYSITE_REGISTRY (where images are pulled from) and MIN_FREE_MB (default 2048). A POLYSITE_VERSION or
# POLYSITE_*_IMAGE in your shell is ignored: this script decides them.
#
# Exit status: 0 done; 1 refused or failed before any service was changed; 3 failed and was rolled back;
#              2 failed and the rollback also failed (the log says what to do by hand).
set -eu

SCRIPT_DIR=$(cd "$(dirname "$0")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/.." && pwd)

unset POLYSITE_VERSION POLYSITE_CMS_IMAGE POLYSITE_WEB_IMAGE POLYSITE_BACKUP_IMAGE

VERSION=""
DRY=false
ROLLBACK=false
COMPOSE_FILES=""
ENV_FILE=".env"
PROJECT=""
RUN_DIR=$ROOT_DIR
STATE_DIR=""
URLS=""
SKIP_BACKUP=false
ALLOW_DESTRUCTIVE=false
FORCE=false
HEALTH_TIMEOUT=300
MIN_FREE_MB=${MIN_FREE_MB:-2048}
# The services that run a Polysite image, in the order they are replaced: the CMS first (it is what the migrations
# changed), then the public site, then the backup service.
ROLLOUT="cms web backup"
PIN_cms=""; PIN_web=""; PIN_backup=""; PREV_cms=""; PREV_web=""; PREV_backup=""

usage() { sed -n '2,36p' "$0" | sed 's/^# \{0,1\}//'; }
now() { date -u +%Y-%m-%dT%H:%M:%SZ; }
say() { printf '%s %s\n' "$(now)" "$*"; }
fail() { printf '%s ERROR: %s\n' "$(now)" "$*" >&2; }
upper() { printf '%s' "$1" | tr '[:lower:]' '[:upper:]'; }

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) DRY=true ;;
    --rollback) ROLLBACK=true ;;
    --compose-file) COMPOSE_FILES="$COMPOSE_FILES -f ${2:?--compose-file needs a value}"; shift ;;
    --env-file) ENV_FILE=${2:?--env-file needs a value}; shift ;;
    --project) PROJECT=${2:?--project needs a value}; shift ;;
    --dir) RUN_DIR=$(cd "${2:?--dir needs a value}" && pwd); shift ;;
    --state-dir) STATE_DIR=${2:?--state-dir needs a value}; shift ;;
    --url) URLS="$URLS ${2:?--url needs a value}"; shift ;;
    --skip-backup) SKIP_BACKUP=true ;;
    --allow-destructive) ALLOW_DESTRUCTIVE=true ;;
    --force) FORCE=true ;;
    --health-timeout) HEALTH_TIMEOUT=${2:?--health-timeout needs a value}; shift ;;
    -h|--help) usage; exit 0 ;;
    -*) fail "unknown option $1"; usage >&2; exit 1 ;;
    *) [ -z "$VERSION" ] || { fail "one version only"; exit 1; }; VERSION=${1#v} ;;
  esac
  shift
done

cd "$RUN_DIR"
[ -n "$COMPOSE_FILES" ] || COMPOSE_FILES="-f docker-compose.prod.yml"
[ -n "$STATE_DIR" ] || STATE_DIR="$RUN_DIR/.deploy"
mkdir -p "$STATE_DIR"
STATE_DIR=$(cd "$STATE_DIR" && pwd)
AUDIT="$STATE_DIR/audit.log"
CURRENT_ENV="$STATE_DIR/current.env"
PREVIOUS_ENV="$STATE_DIR/previous.env"
CANDIDATE_ENV="$STATE_DIR/candidate.env"
PENDING_PREV_ENV="$STATE_DIR/pending-previous.env"

if [ "$ROLLBACK" = true ]; then
  [ -z "$VERSION" ] || { fail "--rollback takes no version"; exit 1; }
else
  [ -n "$VERSION" ] || { usage >&2; exit 1; }
  printf '%s' "$VERSION" | grep -Eq '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-[0-9A-Za-z-]+(\.[0-9A-Za-z-]+)*)?$' \
    || { fail "'$VERSION' is not a version like 1.2.3 or 1.2.3-beta.1"; exit 1; }
fi

# Compose reads the normal env file, then (when set) the deployment's own file with the version and pinned images.
ACTIVE_ENV=""
# shellcheck disable=SC2086  # COMPOSE_FILES is a list of -f options, meant to split
compose() {
  if [ -n "$ACTIVE_ENV" ]; then
    docker compose ${PROJECT:+-p "$PROJECT"} --env-file "$ENV_FILE" --env-file "$ACTIVE_ENV" $COMPOSE_FILES "$@"
  else
    docker compose ${PROJECT:+-p "$PROJECT"} --env-file "$ENV_FILE" $COMPOSE_FILES "$@"
  fi
}

WHO="$(id -un 2>/dev/null || echo unknown)@$(hostname 2>/dev/null || echo unknown)"
audit() { # event key=value...
  event=$1; shift
  printf '%s %s event=%s %s\n' "$(now)" "$WHO" "$event" "$*" >> "$AUDIT"
}

# ---- one deploy at a time -------------------------------------------------------------------------------------------
LOCK="$STATE_DIR/lock"
if ! mkdir "$LOCK" 2>/dev/null; then
  fail "another deploy is running, or one died and left $LOCK behind (remove that folder if you are sure none is running)"
  exit 1
fi
# shellcheck disable=SC2329  # runs from the EXIT trap
cleanup() { rmdir "$LOCK" 2>/dev/null || true; }
trap cleanup EXIT
trap 'fail "interrupted. Check the stack with: docker compose ps (and deploy/deploy.sh --rollback if a service was switched)"; exit 130' INT TERM

# ---- helpers --------------------------------------------------------------------------------------------------------
service_image_ref() { # the image reference compose resolves for a service, from the normalised config
  compose config 2>/dev/null | awk -v s="$1" '
    $0 == "  " s ":" { on = 1; next }
    on && /^  [^ ]/ { on = 0 }
    on && /^    image: / { sub(/^    image: /, ""); print; exit }'
}
repo_of() { case "${1##*/}" in *:*) printf '%s' "${1%:*}" ;; *) printf '%s' "$1" ;; esac; }
digest_ref_of() { # <image reference> -> repo@sha256:... of a local image (empty if it has none)
  repo=$(repo_of "$1")
  docker image inspect "$1" --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null | grep "^$repo@" | head -n 1 || true
}
container_of() { compose ps -a -q "$1" 2>/dev/null | head -n 1; }
state_of() { # missing | exited | restarting | running | healthy | unhealthy | starting
  cid=$(container_of "$1")
  [ -n "$cid" ] || { echo missing; return; }
  st=$(docker inspect --format '{{.State.Status}}' "$cid")
  [ "$st" = running ] || { echo "$st"; return; }
  h=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$cid")
  if [ "$h" = none ]; then echo running; else echo "$h"; fi
}
# Waits until a service is ready. The backup service checks its health only every 15 minutes, so for it (and for a
# service with no health check) "ready" means running without a restart for 10 seconds.
wait_ready() { # <service>
  svc=$1; waited=0; steady=0
  while [ "$waited" -lt "$HEALTH_TIMEOUT" ]; do
    st=$(state_of "$svc")
    case "$st" in
      healthy) return 0 ;;
      unhealthy|exited|dead|restarting) say "$svc is $st"; return 1 ;;
      running|starting)
        if [ "$st" = running ] || [ "$svc" = backup ]; then
          steady=$((steady + 3))
          [ "$steady" -lt 10 ] || return 0
        fi ;;
      *) steady=0 ;;
    esac
    sleep 3; waited=$((waited + 3))
  done
  say "$svc did not become healthy within ${HEALTH_TIMEOUT}s (last state: $(state_of "$svc"))"
  return 1
}
reported_version() { # <service> -> the version the running app says it is (from /api/health)
  case "$1" in cms) port=3001 ;; web) port=3000 ;; *) return 0 ;; esac
  compose exec -T "$1" wget -q -O - "http://127.0.0.1:$port/api/health" 2>/dev/null | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' || true
}
free_mb() { df -Pk "$1" 2>/dev/null | awk 'NR == 2 { printf "%d", $4 / 1024 }'; }
newest_backup() { compose exec -T backup sh -c 'ls -1 /backups/polysite-*.tar /backups/polysite-*.tar.enc 2>/dev/null | sort | tail -n 1' 2>/dev/null | tr -d '\r' || true; }
write_env() { # <file> <version> [cms image web image backup image]
  { echo "# Written by deploy/deploy.sh at $(now). Compose reads it after the normal env file; do not edit by hand."
    echo "POLYSITE_VERSION=$2"
    [ -z "${3:-}" ] || { echo "POLYSITE_CMS_IMAGE=$3"; echo "POLYSITE_WEB_IMAGE=$4"; echo "POLYSITE_BACKUP_IMAGE=$5"; }; } > "$1"
}
env_value() { sed -n "s/^$2=//p" "$1" 2>/dev/null | head -n 1; }
pin_of() { eval "printf '%s' \"\${PIN_$1:-}\""; }

# Runs inside the NEW cms image and reads files only. Refuses a migration that deletes data unless it carries the
# polysite:allow-destructive comment, and reports that comment so the deploy can ask for --allow-destructive.
# (check:migrations covers the core's migrations; plugin migrations are plain .js files and are scanned here.)
# shellcheck disable=SC2016  # the script is meant to be passed unexpanded to sh -c in the container
GUARD_SCRIPT='
set -eu
cd /repo/apps/cms
npm run --silent check:migrations
bad=0; marked=""
for f in src/migrations/*.ts /repo/plugins/*/migrations/*.js; do
  [ -f "$f" ] || continue
  if grep -q "polysite:allow-destructive" "$f"; then marked="$marked $f"; continue; fi
  case "$f" in
    *.js)
      if awk "/export async function up/{p=1} /export async function down/{p=0} p" "$f" | grep -Eqi "DROP[[:space:]]+(TABLE|COLUMN|TYPE|SCHEMA)|DELETE[[:space:]]+FROM|TRUNCATE"; then
        echo "DESTRUCTIVE: $f deletes data or structure in up()"; bad=1
      fi ;;
  esac
done
[ "$bad" = 0 ] || exit 3
if [ -n "$marked" ]; then echo "ALLOW-DESTRUCTIVE:$marked"; fi
echo "migration guards passed"
'

# Puts the images recorded in <env file> back, one service at a time. Migrations are additive-only (the guard above
# refuses anything else), so older code runs on the newer schema; see docs/guide/deploying.md.
apply_env() { # <env file>
  ACTIVE_ENV=$1
  for svc in $ROLLOUT; do
    say "  $svc: $(env_value "$1" "POLYSITE_$(upper "$svc")_IMAGE")"
    compose up -d --no-deps "$svc" >/dev/null 2>&1 || { fail "could not start $svc"; return 1; }
    wait_ready "$svc" || return 1
  done
  return 0
}

# ======================================================================================================================
# Rollback
# ======================================================================================================================
if [ "$ROLLBACK" = true ]; then
  say "Rollback requested"
  [ -f "$PREVIOUS_ENV" ] || { fail "no previous deployment is recorded in $STATE_DIR (nothing to go back to)"; exit 1; }
  [ -f "$ENV_FILE" ] || { fail "env file $ENV_FILE not found"; exit 1; }
  from=$(env_value "$CURRENT_ENV" POLYSITE_VERSION)
  to=$(env_value "$PREVIOUS_ENV" POLYSITE_VERSION)
  say "Going back from ${from:-unknown} to $to (images only; the database keeps every migration that was applied)"
  ACTIVE_ENV=$PREVIOUS_ENV
  compose config -q 2>/dev/null || { fail "the compose file is not valid with the previous deployment's settings"; exit 1; }
  for svc in $ROLLOUT; do
    ref=$(env_value "$PREVIOUS_ENV" "POLYSITE_$(upper "$svc")_IMAGE")
    docker image inspect "$ref" >/dev/null 2>&1 || { fail "the previous $svc image ($ref) is no longer on this machine; pull it first"; exit 1; }
  done
  if [ "$DRY" = true ]; then say "Dry run: would switch $ROLLOUT to the images in $PREVIOUS_ENV. Nothing changed."; exit 0; fi
  audit rollback-start from="${from:-unknown}" to="$to"
  if apply_env "$PREVIOUS_ENV"; then
    swap="$STATE_DIR/swap.env"
    cp "$CURRENT_ENV" "$swap" 2>/dev/null || : > "$swap"
    cp "$PREVIOUS_ENV" "$CURRENT_ENV"
    [ ! -s "$swap" ] || cp "$swap" "$PREVIOUS_ENV"
    rm -f "$swap"
    audit rollback-done version="$to" result=ok
    say "Rolled back to $to. The version you left is kept as 'previous', so --rollback again goes forward."
    exit 0
  fi
  audit rollback-done version="$to" result=FAILED
  fail "the rollback did not complete; check 'docker compose ps' and the logs. The recorded images are in $PREVIOUS_ENV"
  exit 2
fi

# ======================================================================================================================
# Deploy
# ======================================================================================================================
say "Deploying Polysite $VERSION$( [ "$DRY" = true ] && echo ' (dry run)' || true )"

# ---- 1. pre-flight --------------------------------------------------------------------------------------------------
command -v docker >/dev/null 2>&1 || { fail "docker is not installed"; exit 1; }
docker compose version >/dev/null 2>&1 || { fail "'docker compose' (Compose v2) is not available"; exit 1; }
[ -f "$ENV_FILE" ] || { fail "env file $ENV_FILE not found (copy .env.example and fill it in)"; exit 1; }

free=$(free_mb "$STATE_DIR"); [ -n "$free" ] || free=999999
[ "$free" -ge "$MIN_FREE_MB" ] || { fail "only ${free} MB free where the deployment records live; need ${MIN_FREE_MB} MB (MIN_FREE_MB changes this)"; exit 1; }
if [ -d /var/lib/docker ]; then
  dfree=$(free_mb /var/lib/docker)
  [ -z "$dfree" ] || [ "$dfree" -ge "$MIN_FREE_MB" ] || { fail "only ${dfree} MB free for Docker images; need ${MIN_FREE_MB} MB"; exit 1; }
fi
say "Pre-flight: disk ok (${free} MB free)"

# The candidate deployment: the version's tags first, pinned to digests once pulled. Every compose command from here
# on uses it, so the stack is read and the one-off container is built from the NEW images.
write_env "$CANDIDATE_ENV" "$VERSION"
ACTIVE_ENV=$CANDIDATE_ENV
compose config -q 2>"$STATE_DIR/config.err" || { fail "the compose file is not valid: $(cat "$STATE_DIR/config.err")"; exit 1; }
say "Pre-flight: the compose file is valid"

FIRST_DEPLOY=false
if [ -z "$(container_of cms)" ]; then
  FIRST_DEPLOY=true
  say "Pre-flight: no CMS container exists yet: this is the first deploy (no backup is taken, there is nothing to roll back to)"
else
  for svc in cms web; do
    st=$(state_of "$svc")
    if [ "$st" != healthy ] && [ "$st" != running ]; then
      if [ "$FORCE" = true ]; then say "Pre-flight: $svc is $st (continuing: --force)"
      else fail "$svc is $st, not healthy. Fix it first, or pass --force to deploy anyway"; exit 1; fi
    fi
  done
  say "Pre-flight: the running stack is up (cms $(state_of cms), web $(state_of web))"
fi

# ---- 2. images: pull, check, pin ------------------------------------------------------------------------------------
for svc in $ROLLOUT; do
  ref=$(service_image_ref "$svc")
  [ -n "$ref" ] || { fail "could not work out the image for $svc from the compose file"; exit 1; }
  say "Pulling $ref"
  docker pull -q "$ref" >/dev/null || { fail "could not pull $ref (is $VERSION published, and are you logged in to the registry?)"; exit 1; }
  dref=$(digest_ref_of "$ref")
  [ -n "$dref" ] || { fail "$ref has no registry digest after pulling it"; exit 1; }
  label=$(docker image inspect "$ref" --format '{{index .Config.Labels "org.opencontainers.image.version"}}')
  if [ "$label" != "$VERSION" ]; then
    fail "$ref says it is version '${label:-none}', not $VERSION. Refusing: the tag and the image disagree"
    exit 1
  fi
  say "  $svc: $dref"
  eval "PIN_$svc=\$dref"
done
write_env "$CANDIDATE_ENV" "$VERSION" "$PIN_cms" "$PIN_web" "$PIN_backup"
compose config -q 2>/dev/null || { fail "the compose file is not valid with the pinned images"; exit 1; }

if [ "$FORCE" != true ] && [ "$FIRST_DEPLOY" = false ] && [ "$(env_value "$CURRENT_ENV" POLYSITE_CMS_IMAGE)" = "$PIN_cms" ] \
   && [ "$(env_value "$CURRENT_ENV" POLYSITE_WEB_IMAGE)" = "$PIN_web" ] && [ "$(env_value "$CURRENT_ENV" POLYSITE_BACKUP_IMAGE)" = "$PIN_backup" ]; then
  say "Version $VERSION with exactly these images is already the recorded deployment. Nothing to do (--force runs it again)."
  rm -f "$CANDIDATE_ENV"
  exit 0
fi

# ---- 3. migration guards (read-only, inside the new image) ---------------------------------------------------------
say "Checking the migrations shipped in $VERSION (guards only; nothing is applied yet)"
if ! guard_out=$(docker run --rm --entrypoint sh "$PIN_cms" -c "$GUARD_SCRIPT" 2>&1); then
  printf '%s\n' "$guard_out" | sed 's/^/  | /'
  fail "the migration guard failed: this release has a migration that deletes data. Not deploying."
  [ "$DRY" = true ] || audit refused version="$VERSION" reason=destructive-migration
  exit 1
fi
printf '%s\n' "$guard_out" | sed 's/^/  | /'
if printf '%s' "$guard_out" | grep -q '^ALLOW-DESTRUCTIVE:'; then
  if [ "$ALLOW_DESTRUCTIVE" != true ]; then
    fail "a migration in $VERSION is marked polysite:allow-destructive, so rolling back images after it would not be safe. Re-run with --allow-destructive if you mean it"
    [ "$DRY" = true ] || audit refused version="$VERSION" reason=marked-destructive-migration
    exit 1
  fi
  say "WARNING: --allow-destructive: after this deploy a rollback of images is NOT safe; the backup is the way back"
fi

if [ "$DRY" = true ]; then
  say "Dry run complete. The plan:"
  if [ "$FIRST_DEPLOY" = true ]; then say "  - first deploy: no backup"; elif [ "$SKIP_BACKUP" = true ]; then say "  - no backup (--skip-backup)"; else say "  - take a backup with the backup service and test-restore it"; fi
  say "  - apply the migrations in a one-off cms container, then replace $ROLLOUT one at a time with:"
  for svc in $ROLLOUT; do say "      $svc  $(pin_of "$svc")"; done
  say "Nothing was changed on the stack."
  rm -f "$CANDIDATE_ENV"
  exit 0
fi

audit start version="$VERSION" cms="$PIN_cms" web="$PIN_web" backup="$PIN_backup"

# ---- 4. backup, then record what runs now --------------------------------------------------------------------------
BACKUP_NAME=""
if [ "$FIRST_DEPLOY" = true ]; then
  say "Backup: skipped (first deploy)"
elif [ "$SKIP_BACKUP" = true ]; then
  say "WARNING: no backup (--skip-backup)"; audit backup result=SKIPPED-BY-OPERATOR
else
  bst=$(state_of backup)
  if [ "$bst" = missing ] || [ "$bst" = exited ]; then
    fail "the backup service is not running, so no backup can be taken first. Start it, or pass --skip-backup"; audit backup result=NOT-RUNNING; exit 1
  fi
  before=$(newest_backup)
  say "Backup: taking one now"
  if ! out=$(compose exec -T backup sh -c "exec /opt/backup/backup.sh" 2>&1); then
    printf '%s\n' "$out" | tail -n 15 | sed 's/^/  | /'; fail "the backup failed: not deploying"; audit backup result=FAILED; exit 1
  fi
  printf '%s\n' "$out" | tail -n 4 | sed 's/^/  | /'
  BACKUP_NAME=$(newest_backup)
  if [ -z "$BACKUP_NAME" ] || [ "$BACKUP_NAME" = "$before" ]; then fail "the backup run did not produce a new archive: not deploying"; audit backup result=NO-NEW-ARCHIVE; exit 1; fi
  say "Backup: test-restoring $(basename "$BACKUP_NAME") into a scratch database"
  if ! out=$(compose exec -T backup sh -c "exec /opt/backup/verify.sh $(basename "$BACKUP_NAME")" 2>&1); then
    printf '%s\n' "$out" | tail -n 15 | sed 's/^/  | /'; fail "the backup could not be restored in a test: not deploying"
    audit backup name="$(basename "$BACKUP_NAME")" result=VERIFY-FAILED; exit 1
  fi
  printf '%s\n' "$out" | tail -n 3 | sed 's/^/  | /'
  audit backup name="$(basename "$BACKUP_NAME")" result=verified
  say "Backup: $(basename "$BACKUP_NAME") taken and verified"
fi

HAVE_PREVIOUS=false
if [ "$FIRST_DEPLOY" = false ]; then
  HAVE_PREVIOUS=true
  prev_version=$(docker inspect "$(container_of cms)" --format '{{index .Config.Labels "org.opencontainers.image.version"}}' 2>/dev/null || true)
  : "${prev_version:=unknown}"
  for svc in $ROLLOUT; do
    cid=$(container_of "$svc")
    if [ -z "$cid" ]; then HAVE_PREVIOUS=false; break; fi
    img=$(docker inspect "$cid" --format '{{.Image}}')
    # The digest the image was pulled by, or its id when it was built here and has no registry digest.
    dref=$(docker image inspect "$img" --format '{{range .RepoDigests}}{{println .}}{{end}}' 2>/dev/null | head -n 1 || true)
    [ -n "$dref" ] || dref=$img
    eval "PREV_$svc=\$dref"
    # Keeps the old image from being pruned while it is the way back.
    docker tag "$img" "polysite-previous-$svc:latest" >/dev/null 2>&1 || true
  done
  if [ "$HAVE_PREVIOUS" = true ]; then
    write_env "$PENDING_PREV_ENV" "$prev_version" "$PREV_cms" "$PREV_web" "$PREV_backup"
    say "Recorded what runs now (version $prev_version) as the way back"
  else
    say "WARNING: could not record all running images; an automatic rollback will not be possible"
  fi
fi

# ---- 5. migrations in a one-off container --------------------------------------------------------------------------
say "Starting what the app depends on (database tunnel, cache), if it is not up"
infra=$(compose config --services | grep -vxE 'cms|web|backup|caddy|restore' | tr '\n' ' ' || true)
# shellcheck disable=SC2086  # a list of service names
if [ -n "$infra" ] && ! compose up -d --wait --wait-timeout 180 --no-recreate $infra >/dev/null 2>&1; then fail "could not start (or they did not become healthy): $infra"; exit 1; fi

say "Applying the database migrations from the new image in a one-off container (the old services keep serving)"
audit migrate-start version="$VERSION"
if ! out=$(compose run --rm --no-deps -T cms sh -c 'cd /repo/apps/cms && npx payload migrate' 2>&1); then
  printf '%s\n' "$out" | tail -n 25 | sed 's/^/  | /'
  fail "the migrations failed. No service was switched; the old version is still serving. Each migration runs in its own transaction, so the database holds the ones that finished before the failure (all additive)."
  [ -z "$BACKUP_NAME" ] || fail "The pre-deploy backup is $(basename "$BACKUP_NAME")."
  audit migrate result=FAILED; exit 1
fi
printf '%s\n' "$out" | tail -n 6 | sed 's/^/  | /'
audit migrate result=ok
say "Migrations applied"

# ---- 6. replace the services one at a time -------------------------------------------------------------------------
rollback_now() { # <reason>: something failed after migrations; put the recorded images back
  reason=$1
  fail "$reason"
  audit failed version="$VERSION" reason="$reason"
  if [ "$HAVE_PREVIOUS" != true ]; then
    fail "there is no recorded previous deployment to go back to, so the services are left as they are. See: docker compose logs"
    audit rollback result=NOT-POSSIBLE
    exit 2
  fi
  to=$(env_value "$PENDING_PREV_ENV" POLYSITE_VERSION)
  say "Rolling back to $to"
  audit rollback-start to="$to"
  if apply_env "$PENDING_PREV_ENV"; then
    audit rollback-done result=ok
    say "Rolled back: the site is running $to again. $reason"
    [ -z "$BACKUP_NAME" ] || say "The pre-deploy backup is $(basename "$BACKUP_NAME") if it is needed."
    rm -f "$PENDING_PREV_ENV" "$CANDIDATE_ENV"
    exit 3
  fi
  audit rollback-done result=FAILED
  fail "THE ROLLBACK FAILED TOO. A person is needed: run 'docker compose ps' and 'docker compose logs', then put the images back with:"
  fail "  docker compose --env-file $ENV_FILE --env-file $PENDING_PREV_ENV $COMPOSE_FILES up -d --no-deps $ROLLOUT"
  [ -z "$BACKUP_NAME" ] || fail "The pre-deploy backup is $(basename "$BACKUP_NAME") (docs/guide/backups.md explains restoring it)."
  exit 2
}

ACTIVE_ENV=$CANDIDATE_ENV
for svc in $ROLLOUT; do
  say "Switching $svc"
  compose up -d --no-deps "$svc" >/dev/null 2>&1 || rollback_now "could not start the new $svc"
  if ! wait_ready "$svc"; then
    compose logs --tail 30 "$svc" 2>&1 | sed 's/^/  | /' || true
    rollback_now "the new $svc did not become healthy"
  fi
  got=$(reported_version "$svc")
  case "$svc" in cms|web)
    [ "$got" = "$VERSION" ] || rollback_now "the new $svc reports version '${got:-nothing}', expected $VERSION" ;;
  esac
  say "  $svc is ready${got:+ and reports $got}"
  audit switched service="$svc" image="$(env_value "$CANDIDATE_ENV" "POLYSITE_$(upper "$svc")_IMAGE")"
done

# Everything else (Caddy, and on a first deploy the rest) must be up too.
compose up -d --no-recreate >/dev/null 2>&1 || rollback_now "could not start the remaining services"

if [ -n "$URLS" ] && ! command -v curl >/dev/null 2>&1; then say "WARNING: curl is not installed, so --url checks are skipped"; URLS=""; fi
for url in $URLS; do
  say "Checking $url"
  curl -fsS -m 20 -o /dev/null "$url" 2>"$STATE_DIR/curl.err" || rollback_now "$url did not answer with a success status ($(cat "$STATE_DIR/curl.err"))"
done

# ---- 7. record the result ------------------------------------------------------------------------------------------
[ "$HAVE_PREVIOUS" != true ] || cp "$PENDING_PREV_ENV" "$PREVIOUS_ENV"
cp "$CANDIDATE_ENV" "$CURRENT_ENV"
rm -f "$PENDING_PREV_ENV" "$CANDIDATE_ENV"
audit success version="$VERSION" backup="$( [ -n "$BACKUP_NAME" ] && basename "$BACKUP_NAME" || echo none )"
say "Deployed Polysite $VERSION."
say "Later compose commands: docker compose --env-file $ENV_FILE --env-file $CURRENT_ENV $COMPOSE_FILES ps"
[ "$HAVE_PREVIOUS" != true ] || say "To go back: deploy/deploy.sh --rollback"
exit 0
