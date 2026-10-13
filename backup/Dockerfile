# Database + media backups.
#
# The Postgres client must be the same major version as the server: a newer
# pg_dump writes SQL an older server rejects (PG 17 emits `SET
# transaction_timeout`, which PG 16 doesn't know), and an older one refuses to
# dump a newer server. Set PG_MAJOR to your server's major version (compose
# passes POSTGRES_MAJOR from .env; the bundled database is 16).
ARG PG_MAJOR=16
FROM postgres:${PG_MAJOR}-alpine
ARG POLYSITE_VERSION=dev
ARG POLYSITE_REVISION=unknown
LABEL org.opencontainers.image.title="polysite-backup" \
      org.opencontainers.image.description="Polysite backup: scheduled database and media backups" \
      org.opencontainers.image.version=$POLYSITE_VERSION \
      org.opencontainers.image.revision=$POLYSITE_REVISION \
      org.opencontainers.image.source="https://github.com/polysites/polysite" \
      org.opencontainers.image.vendor="Polysite"
# `apk upgrade` picks up the security fixes Alpine published after the Postgres base image was built (musl, zlib, libuuid, libxml2
# were flagged by the image scan). gosu belongs to the Postgres server's own entrypoint, which this image replaces, and its Go runtime
# is flagged and old; nothing here uses it.
RUN apk upgrade --no-cache && apk add --no-cache tzdata openssl rclone curl && rm -f /usr/local/bin/gosu
COPY lib.sh backup.sh restore.sh verify.sh prune.sh entrypoint.sh healthcheck.sh /opt/backup/
RUN chmod +x /opt/backup/*.sh
ENTRYPOINT ["/opt/backup/entrypoint.sh"]
HEALTHCHECK --interval=15m --timeout=10s --start-period=1m CMD /opt/backup/healthcheck.sh
