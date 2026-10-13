# Polysite CMS (Payload)

The editorial cockpit and API: Payload 3 mounted inside a Next.js app, backed by PostgreSQL. Everything
runs in containers (see the repository README and `CONTRIBUTING.md`); nothing here needs Node.js on your
machine.

## What's here

- `src/payload.config.ts` — the Postgres adapter, the Lexical editor, the Payload plugins (multi-tenant,
  SEO, form builder, search), the site URL index, Live Preview and plugin discovery.
- `src/collections/` — `users`, `roles`, `sites`, `pages`, `media`, `redirects` and `privacy-requests`. Forms
  and their submissions come from the form-builder plugin and are set up in `src/forms/`.
- `src/blocks/` — the page builder's blocks.
- `src/access/`, `src/rbac/` — the dynamic role-based access: `hasCapability` is the one function every
  collection's access control calls, and `modules.ts` is the one place a core collection is registered so a
  role can reach it.
- `src/plugins/` — plugin discovery and the extension points content-type plugins use.
- `src/setup/` — the first-run setup page and its endpoint.
- `src/privacy/`, `src/forms/` — privacy requests, retention, and form intake and bot checks.
- `src/workflow/`, `src/jobs/` — drafts, publish rules, first-version backfill, and the in-server runner for scheduled publishing.
- `src/i18n/` — the language catalog and the translatable-field layout (the languages plugin turns more than English on).
- `src/auth/` — the per-address sign-in and password-reset limit, and the helper that signs someone in without a password (single sign-on).
- `src/utils/` — small tested helpers, including the start-up check for unsafe secrets on https (`productionChecks.ts`).
- `src/components/` — admin UI overrides (the sidebar, brand mark, front-end links).
- `src/app/(payload)/` — Payload's admin UI and REST/GraphQL routes. Generated files; see the "DO NOT MODIFY"
  comments, and regenerate with `npm run generate:importmap` after changing collections, not by hand.
- `src/migrations/` — checked-in schema migrations for the core's own tables (below).
- `scripts/` — `seedDevData.ts` (fictional local demo content), `pluginMigrations.sh` and `comparePluginSnapshots.mjs`
  (migrations for the core and for each plugin, and the check that each owns only its tables), `checkMigrations.mjs`,
  `reapplyErasures.ts` and `keepOldColumnsMigration.mjs`.

## Migrations

Payload's Postgres adapter only syncs the schema when `NODE_ENV !== production`. In production the container
runs `npx payload migrate` before `npm start` on every start, which is a no-op when nothing changed. The core's
migrations are one baseline (`core_baseline`) that holds core tables only; each plugin ships its own migrations
in its own folder, which the CMS runs after the core's. After a change to the core's tables, create another core
migration and commit it:

```bash
docker compose exec -it cms sh scripts/pluginMigrations.sh core <name>
docker compose exec cms sh scripts/pluginMigrations.sh check
```

A bare `payload migrate:create` would write the installed plugins' tables into the core's migration, so use the
script. `npm run check:migrations` fails any migration that drops a table, column or type unless it says
`polysite:allow-destructive`, so taking a plugin away can't delete its data. See Known Issues #10, #41, #55 and
#64 in `docs/ARCHITECTURE.md`.

## Local development

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build   # from the repository root
```

The admin is at http://polysite.localhost/admin (through Caddy, not the container port, because the CMS builds
its URLs from `CMS_DOMAIN`). Schema changes sync automatically in dev; set `POLYSITE_DB_PUSH=false` to stop
that.

## Package versions

Payload (3.90.x), its plugins and `next` are pinned to exact versions. Bump `payload`, the `@payloadcms/*`
packages and `next` together and deliberately, then run the tests and the production-parity build
(`docs/guide/updating-dependencies.md`).
