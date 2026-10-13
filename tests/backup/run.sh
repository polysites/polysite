#!/bin/sh
# Backup encryption and off-site rules, tested for real: a throwaway Postgres and the backup image built from this
# checkout, in their own Docker network (psbackuptest). Never touches your other containers or volumes.
#   sh tests/backup/run.sh
set -eu
ROOT=$(cd "$(dirname "$0")/../.." && pwd)
P=${BACKUP_TEST_PROJECT:-psbackuptest}
cleanup() {
  docker rm -f "$P-db" >/dev/null 2>&1 || true
  docker network rm "$P" >/dev/null 2>&1 || true
  docker rmi "$P-image" >/dev/null 2>&1 || true
}
trap cleanup EXIT
cleanup

docker build -q -t "$P-image" "$ROOT/backup" >/dev/null
docker network create "$P" >/dev/null
docker run -d --name "$P-db" --network "$P" -e POSTGRES_PASSWORD=testpw postgres:16-alpine >/dev/null
i=0
until docker exec "$P-db" pg_isready -q -U postgres || [ "$i" -ge 60 ]; do i=$((i + 1)); sleep 1; done
sleep 2

# The test script goes in on stdin: no bind mounts, so it works the same on every host.
docker run --rm -i --network "$P" -e DATABASE_URL="postgres://postgres:testpw@$P-db:5432/postgres" \
  --entrypoint sh "$P-image" -s < "$ROOT/tests/backup/encryption.test.sh"
