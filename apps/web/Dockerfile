# Optional named build contexts for the sibling-repository layout (polysite-themes and polysite-plugins next to this repository):
#   docker buildx build --build-context themes=../polysite-themes --build-context plugins=../polysite-plugins ...
# docker-compose.workspace.yml passes them. Without them these two stages are empty and the build uses only a themes/ or plugins/
# folder inside the build context, if there is one.
FROM scratch AS themes
FROM scratch AS plugins

# Build context is the repo root (not apps/web) so this can also see the
# client theme repos it extends as Nuxt layers, all at once. `COPY themes
# themes` copies the whole directory rather than one line per theme repo --
# apps/web/nuxt.config.ts scans it at build time and extends whatever valid
# theme folders it finds, so a new theme just needs to exist in themes/
# (with a matching layouts/<name>.vue) for both this build and
# docker-compose.dev.yml's bind mount to pick it up automatically. No
# Dockerfile edit needed per theme anymore.
# Nuxt 4.5.2 requires Node ^22.19.0 || ^24.11.0 || >=26.0.0 (real npm
# EBADENGINE warning on node:20-alpine caught this). Both images are on the Node 24 LTS line (Node 20 is end-of-life).
FROM node:26-alpine AS build
# No telemetry: Nuxt collects anonymous usage data unless told not to, in a build or a dev server as much as at run time.
ENV NUXT_TELEMETRY_DISABLED=1
# Installs exactly what package-lock.json says (npm ci), so a build today and a build next month use the same third-party
# packages. `npm install` ignored the lockfile and resolved fresh each time, which is how one CI run broke on a package that
# had just been withdrawn from the registry.
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
# npm installs a platform's native packages as "optional" ones and, when a download fails, carries on without them: one CI build
# then died with "Cannot find module '../lightningcss.linux-x64-musl.node'" and passed on the next try. So the install is checked
# and, if the native CSS package did not arrive, done once more from a clean node_modules (never silently without it).
RUN npm ci && (node -e "require('lightningcss')" || (rm -rf node_modules && npm ci && node -e "require('lightningcss')"))
WORKDIR /repo
COPY apps/web apps/web
# themes/ and plugins/ are optional: separate repositories that may not be cloned. A plain `COPY themes themes`
# fails the whole build when the folder is missing, so each is listed with a file that always exists (`.dockerignore`)
# and a wildcard: the wildcard matches nothing when the folder is absent, and the build carries on with none.
COPY .dockerignore themes*/ themes/
# A plugin's web part (plugins/<name>/web) is a Nuxt layer, found by nuxt.config.ts like a theme.
COPY .dockerignore plugins*/ plugins/
COPY --from=themes / themes/
COPY --from=plugins / plugins/
WORKDIR /repo/apps/web
RUN npm run build

FROM node:26-alpine AS run
# No telemetry: Nuxt collects anonymous usage data unless told not to, in a build or a dev server as much as at run time.
ENV NUXT_TELEMETRY_DISABLED=1
WORKDIR /app
ENV NODE_ENV=production
ARG POLYSITE_VERSION=dev
ARG POLYSITE_REVISION=unknown
ENV POLYSITE_VERSION=$POLYSITE_VERSION
LABEL org.opencontainers.image.title="polysite-web"       org.opencontainers.image.description="Polysite web: the public Nuxt site"       org.opencontainers.image.version=$POLYSITE_VERSION       org.opencontainers.image.revision=$POLYSITE_REVISION       org.opencontainers.image.source="https://github.com/polysites/polysite"       org.opencontainers.image.vendor="Polysite"
# Runs as the unprivileged `node` user. Pages are written at runtime into .output/public (a volume shared with
# Caddy), so that folder is handed over; the server code stays root-owned.
# Nothing in this image runs npm (the server is one Node script), so it is removed: that takes the vulnerabilities in its bundled
# packages with it, and leaves an attacker one tool fewer.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
COPY --from=build /repo/apps/web/.output ./.output
RUN chown -R node:node .output/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3   CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1
CMD ["node", ".output/server/index.mjs"]

# Local iteration only (docker-compose.dev.yml). No `npm run build` -- runs
# `nuxt dev` against source (and the theme layer) bind-mounted in at runtime,
# so edits hot-reload without an image rebuild.
#
# `npm install`'s own `postinstall: nuxt prepare` runs here against just
# package.json (nuxt.config.ts and the theme layer aren't copied into this
# stage at all -- the compose override bind-mounts them in later), so it
# generates a broken .nuxt for what looks like an empty project. Re-running
# `nuxi prepare` in CMD, once the real bind-mounted source is present,
# regenerates it correctly -- otherwise `nuxt dev` fails to resolve its own
# virtual imports (e.g. "#app-manifest") at runtime.
FROM node:26-alpine AS dev
# No telemetry: Nuxt collects anonymous usage data unless told not to, in a build or a dev server as much as at run time.
ENV NUXT_TELEMETRY_DISABLED=1
WORKDIR /repo/apps/web
COPY apps/web/package.json apps/web/package-lock.json ./
RUN npm ci
EXPOSE 3000
CMD ["sh", "-c", "npx nuxi prepare && npx nuxt dev --host 0.0.0.0 --port 3000"]
