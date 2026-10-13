# Optional named build contexts for the sibling-repository layout (polysite-themes and polysite-plugins next to this repository):
#   docker buildx build --build-context themes=../polysite-themes --build-context plugins=../polysite-plugins ...
# docker-compose.workspace.yml passes them. Without them these two stages are empty and the build uses only a themes/ or plugins/
# folder inside the build context, if there is one.
FROM scratch AS themes
FROM scratch AS plugins

# Build context is the repo root (not apps/cms), same reason as
# apps/web/Dockerfile: Sites.ts's theme auto-discovery needs to see themes/
# to scan it. Before this, cms had NO filesystem access to theme
# files at all -- a real, deliberate widening, not the default.
FROM node:26-alpine AS build
# No telemetry: Next.js collects anonymous usage data unless told not to, in a build or a dev server as much as at run time.
# (Payload's own usage reports are switched off in payload.config.ts.) npm's "new version available" check also calls the registry
# every time a script runs, so it is off.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
# Installs exactly what package-lock.json says (npm ci), so a build today and a build next month use the same third-party
# packages. `npm install` ignored the lockfile and resolved fresh each time, which is how one CI run broke on a package that
# had just been withdrawn from the registry.
WORKDIR /repo/apps/cms
COPY apps/cms/package.json apps/cms/package-lock.json ./
RUN npm ci
WORKDIR /repo
COPY apps/cms apps/cms
# themes/ and plugins/ are optional: separate repositories that may not be cloned. A plain `COPY themes themes`
# fails the whole build when the folder is missing, so each is listed with a file that always exists (`.dockerignore`)
# and a wildcard: the wildcard matches nothing when the folder is absent, and the build carries on with none.
COPY .dockerignore themes*/ themes/
COPY .dockerignore plugins*/ plugins/
COPY --from=themes / themes/
COPY --from=plugins / plugins/
# Each plugin is its own independently-versioned package (plugins/README.md)
# with its own dependencies -- not hoisted into apps/cms's own node_modules,
# so each one needs its own install. Looped, not hardcoded per plugin, so a
# new plugin folder needs no Dockerfile edit, same property discovery itself
# has (discoverPlugins.ts).
RUN for d in /repo/plugins/*/; do if [ -f "$d/package-lock.json" ]; then npm ci --prefix "$d"; elif [ -f "$d/package.json" ]; then npm install --prefix "$d"; fi; done
WORKDIR /repo/apps/cms
# payload.config.ts falls back to '' for PAYLOAD_SECRET/DATABASE_URL when
# unset (process.env.X || ''), and next build never opens a real DB
# connection — verified by building with no env vars at all. Real values are
# only needed at runtime (docker-compose's env_file), which is also why they
# must never be passed as ARG/ENV here: Docker bakes both into the image's
# layer history, permanently extractable from the built image regardless of
# which stage "removes" them — a real secret leak for zero benefit here.
# The import map is generated, not committed (it includes whatever admin
# components the installed plugins contribute) -- it must exist before
# `next build` imports it.
# On a CI runner this command sometimes exits without printing or writing anything (seen on 2 of 3 runs of one commit, never
# reproducible locally), and the build then fails later with "Can't resolve '../importMap'". So the file is checked, the
# command is tried again if it is missing, and the build stops here with a clear message if it never appears.
RUN for i in 1 2 3; do npx payload generate:importmap; [ -s "src/app/(payload)/admin/importMap.js" ] && break; echo "the import map was not written (attempt $i)"; sleep 3; done; [ -s "src/app/(payload)/admin/importMap.js" ] || { echo "the import map could not be generated"; exit 1; }
# payload-types.ts is generated too (git-ignored), and `next build` type-checks against
# it: without this a fresh clone fails with "Property 'name' is missing in JsonObject".
# Like the import map, this sometimes writes nothing on a CI runner (the build then fails type-checking), so it is checked and
# retried the same way.
RUN for i in 1 2 3; do npx payload generate:types; [ -s src/payload-types.ts ] && break; echo "the types were not written (attempt $i)"; sleep 3; done; [ -s src/payload-types.ts ] || { echo "the types could not be generated"; exit 1; }
RUN npm run build

FROM node:26-alpine AS run
# No telemetry: Next.js collects anonymous usage data unless told not to, in a build or a dev server as much as at run time.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
# The npm bundled in the node image carries its own copies of tar, ip-address and others, which the image scan flags. The latest 11.x
# has the fixes that exist (stay on the 11 line: 12 is a new major). npm is still needed here: the start command and the deploy
# script run `npx payload migrate`. What no npm release has fixed yet is listed in docs/ARCHITECTURE.md (Known Issue #69).
RUN npm install -g npm@11 && npm cache clean --force
# npm 11.21 still bundles brace-expansion 5.0.9 and undici 6.28.0 (CVE-2026-102276, -102278, -19534), whose patch releases exist.
# The two are replaced by those releases (same major and minor line). Remove this block when an npm 11 release ships them (the
# image scan shows it: docs/ARCHITECTURE.md, Known Issue #69).
RUN set -e; cd /tmp; npm pack --silent brace-expansion@5.0.11 undici@6.28.1 >/dev/null; \
    for p in brace-expansion undici; do \
      d=/usr/local/lib/node_modules/npm/node_modules/$p; rm -rf "$d"; mkdir "$d"; tar -xzf $p-*.tgz -C "$d" --strip-components=1; \
    done; \
    rm -f /tmp/*.tgz; npm cache clean --force; npm --version
# themes/ is scanned at RUNTIME (payload.config.ts loading Sites.ts calls
# discoverThemes() when the process boots, not just when `next build` runs),
# via `path.resolve(process.cwd(), "../../themes")`. That only resolves to
# the right place if this stage keeps the same /repo/apps/cms nesting the
# build stage uses -- WORKDIR /app (this Dockerfile's earlier, flatter
# structure) would resolve to plain /themes instead, one level too shallow,
# and silently fall back to the single-theme default. Caught this during
# review, before it shipped as a real bug.
WORKDIR /repo/apps/cms
ENV NODE_ENV=production
ARG POLYSITE_VERSION=dev
ARG POLYSITE_REVISION=unknown
ENV POLYSITE_VERSION=$POLYSITE_VERSION
LABEL org.opencontainers.image.title="polysite-cms"       org.opencontainers.image.description="Polysite CMS: the Payload admin and API"       org.opencontainers.image.version=$POLYSITE_VERSION       org.opencontainers.image.revision=$POLYSITE_REVISION       org.opencontainers.image.source="https://github.com/polysites/polysite"       org.opencontainers.image.vendor="Polysite"
# Runs as the image's unprivileged `node` user. It needs to write only the uploads folder (a volume) and Next's
# cache under .next, so those two are handed over and the rest stays root-owned and read-only to it.
COPY --from=build /repo/apps/cms ./
COPY --from=build /repo/themes /repo/themes
COPY --from=build /repo/plugins /repo/plugins
RUN mkdir -p media && chown -R node:node media .next
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3   CMD wget -q -O /dev/null http://127.0.0.1:3001/api/health || exit 1
# Payload's Postgres adapter only auto-syncs the schema outside of
# NODE_ENV=production (verified while scaffolding this — production mode
# throws "relation does not exist" without this). Migrations are checked
# into src/migrations and applied here on every container start; applying an
# already-migrated database is a no-op.
CMD ["sh", "-c", "npx payload migrate && npm start"]

# Local iteration only (docker-compose.dev.yml). No `npm run build`, no
# NODE_ENV=production -- runs `next dev` against source that's bind-mounted
# in at runtime, so edits hot-reload without an image rebuild, and Payload
# auto-pushes schema changes straight to the dev DB instead of requiring a
# committed migration to boot.
FROM node:26-alpine AS dev
# No telemetry: Next.js collects anonymous usage data unless told not to, in a build or a dev server as much as at run time.
ENV NEXT_TELEMETRY_DISABLED=1
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /repo/apps/cms
COPY apps/cms/package.json apps/cms/package-lock.json ./
RUN npm ci
EXPOSE 3001
# plugins/ is bind-mounted in at runtime (docker-compose.dev.yml), not
# copied at build time like the prod image above, so each plugin's own
# install has to happen at container start instead -- writes node_modules
# straight into the bind-mounted host folder (already gitignored), same as
# running `npm install` locally in that workspace would.
CMD ["sh", "-c", "for d in /repo/plugins/*/; do [ -f \"$d/package.json\" ] && npm install --prefix \"$d\"; done; npx payload generate:importmap; npx next dev --port 3001 --hostname 0.0.0.0"]
