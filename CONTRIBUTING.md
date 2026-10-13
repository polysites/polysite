# Contributing to Polysite

Thanks for helping. This guide covers how to get a change from your machine
into the repository. For how the system is built, read
[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first.

## Before you start

- **Check the license.** Polysite is source-available under the
  [Polysite Source-Available License](LICENSE.md), not open source. Read the
  [Contributions](#contributions-and-the-license) section below before you
  send anything.
- **Open an issue before large changes.** A bug fix or a small improvement can
  go straight to a pull request. For a new feature, a new dependency, a schema
  change or anything that touches access control, describe it in an issue
  first so we can agree on the approach before you spend the time.
- **Security problems are not issues.** Report them privately, as described in
  [SECURITY.md](SECURITY.md).

## Set up

You need **Docker** with Compose and **Git**. Do not install Node.js on your
machine: every Node command runs inside the project's containers.

```bash
git clone git@github.com:polysites/polysite.git
cd polysite
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

Prerequisites, the ports the stack needs (80, 443, 3000, 3001, 5432) and how to move them in `.env`, and how long this
takes are in the README's [Quick start](README.md#quick-start). Themes and plugins are separate repositories
(`polysite-themes`, `polysite-plugins`), cloned into `themes/` and `plugins/` only if you work on them; the core builds and runs
without them. The commands below name the containers `polysite-cms-1` and `polysite-web-1`, which is what Compose calls them
unless you set `COMPOSE_PROJECT_NAME`; with another project name use `docker compose exec cms ...` or `docker compose exec web ...`.

The [README](README.md#quick-start) has the demo data and local URLs. Day-to-day
commands (migrations, regenerating the admin import map, testing through the
proxy) are in [Everyday commands](#everyday-commands) below.

Turn on the pre-commit hook once per clone:

```bash
git config core.hooksPath .githooks
```

It lints and tests both apps (and the plugins' web parts) inside the running dev
containers, runs the migration safety check, and refuses the commit if any of that
fails, so start the stack first.

## Making a change

1. Branch from `main`.
2. Make the change, keeping to the conventions below.
3. Run the checks (the hook does this on commit; CI repeats it on every push
   and pull request):

   ```bash
   docker exec polysite-cms-1 sh -c "cd /repo/apps/cms && npm run lint && npm test"
   docker exec polysite-web-1 sh -c "cd /repo/apps/web && npm run lint && npm test"
   ```

4. **Try it in a real browser**, not just with `curl`. Hydration errors,
   client-side navigation bugs and stacking problems are invisible to a
   server-side check, and each has bitten this project before.
5. Open a pull request that says what changed and why, and how you checked it.

## Conventions

**Access control fails closed.** Roles are data (the `roles` collection), and
every collection's access function goes through `hasCapability` in
`apps/cms/src/access/roles.ts`. A missing role, module or operation must
resolve to *deny*. Never add a path that falls through to *allow*. Any new
access logic needs a unit test.

Rules that keep that safe:

- Import `hasCapability`, `isSuperAdmin`, `canManageSiteSettings` and `userSiteIds` from
  `apps/cms/src/access/roles.ts`; don't re-implement them per file. Capability checks read
  an in-memory cache that the Roles collection invalidates on change, so never query roles
  per request.
- `Users.isSuperAdmin` is the one deliberately hard-coded grant. It is checked before any
  role lookup, so a broken role can never lock everyone out or let an account escalate
  itself. Don't make it dynamic.
- `access.read` (what the API returns) and `admin.hidden` (what shows in the sidebar) are
  different things. Hide a collection from the nav with `admin.hidden`; tightening
  `access.read` for a nav reason broke the whole admin for non-admin roles once.
- Compare ids as `String(a) === String(b)`: Postgres ids can be a number in one place and a
  string in another, and a strict comparison fails silently.

**A new site-scoped collection** needs its own `site` relationship (through the
multi-tenant plugin's config in `payload.config.ts`) and an entry in
`apps/cms/src/rbac/modules.ts`, or no role can reach it.

**Schema changes.** Development auto-pushes the schema. Production needs a
checked-in migration, and **the core and each plugin own separate migrations**
(Known Issue #64): the core's `apps/cms/src/migrations` hold core tables only, and a
plugin's tables are in the plugin's own `migrations/` folder. So a bare
`payload migrate:create` is the wrong tool once plugins are installed, because it would
write the plugins' tables into the core's migration. Use the script, inside the CMS
container:

```bash
docker compose exec -it cms sh scripts/pluginMigrations.sh core <name>            # a change to the core's tables
docker compose exec -it cms sh scripts/pluginMigrations.sh plugin <slug> <name>   # a change to one plugin's tables
docker compose exec cms sh scripts/pluginMigrations.sh check                      # the core and every plugin own only their tables
docker compose exec cms sh scripts/pluginMigrations.sh rebase <slug>              # after the core gained a migration, for each plugin that passed `check` before
```

The generator can stop to ask whether a column was renamed, which needs a real terminal
(Known Issue #10). A core change must never add a field to a plugin's table, and a
plugin must never add one to a core table (the isolation rule in the plugins repository's
README). Removing a plugin must never delete what its users created (Known Issue #55):
the generator refuses while `POLYSITE_PLUGINS_OFF` is set, and `npm run check:migrations`
(in the commit hook and CI) fails any migration that drops or deletes unless it says
`polysite:allow-destructive`. A plugin's migration can only be generated and checked with
the plugins repository mounted at `plugins/`.

**The core runs on its own.** `themes/` and `plugins/` are optional, so nothing in `apps/` may require either. A
fresh clone with neither folder has to build and complete the first-run setup (Known Issue #56).

**Plugins and themes live in their own repositories**
([`polysite-plugins`](https://github.com/polysites/polysite-plugins),
`polysite-theme-*`) and are mounted into `plugins/` and `themes/`. Changes to
them are separate pull requests against those repositories. The core stays
generic: nothing client-specific belongs here, and nothing in `apps/` may depend on a
plugin. A plugin reaches the core only through its extension points (the `kit`, the
`custom.polysite` declarations, per-site settings under `site.extensions.<key>`) and keeps
its data in its own tables; the rule is in the plugins repository's README.

**Placeholder content only.** Copy, names and imagery in this repository and in
the demos are fictional. Never commit a real organization's branding or text.

**No secrets.** Nothing real goes into the repository, including the
`.env.example` file. The seed script's accounts are for local development only.

**Where the docs live.** In this repository, under `docs/`, as the single source of truth: the guides, the
architecture doc (`docs/ARCHITECTURE.md`) and the brand guide. They build into a VitePress site, and the Docs
workflow builds it on every push and pull request that touches `docs/`, so a broken link fails the build. The
README and other root files link to them by relative path. Publishing the site to GitHub Pages is a manual run of
that workflow once the repository is public. Update the docs in the same change as the code they describe.

**Document real bugs.** If you fix something that cost real debugging time,
add a numbered entry to *Known Issues* in `docs/ARCHITECTURE.md`: the symptom,
the cause and the fix.

**Comments explain why, not what.** If the next line already says it, leave the
comment out.

## Everyday commands

All run from the repository root; none needs Node.js on your machine.

| Task | Command |
| --- | --- |
| Start the fast dev loop (hot reload) | `docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build` |
| Production-parity stack (real build, real migration) | `docker compose up --build` |
| Create a core migration / a plugin's migration | `docker compose exec -it cms sh scripts/pluginMigrations.sh core <name>` / `... plugin <slug> <name>` (see Schema changes) |
| Check the core and plugins own only their tables | `docker compose exec cms sh scripts/pluginMigrations.sh check` |
| Check no migration deletes data | `docker exec polysite-cms-1 npm run check:migrations` |
| Plugin end-to-end checks (needs the plugins repository) | `PLUGINS_DIR=../plugins sh tests/e2e/run-with-plugins.sh` (see `tests/e2e/README.md`) |
| Regenerate the admin import map | `docker exec polysite-cms-1 npx payload generate:importmap && docker restart polysite-cms-1` |
| Restart the CMS after editing files under `apps/cms/src` | `docker restart polysite-cms-1` |
| Hit the site through the proxy | `curl --resolve localhost:80:127.0.0.1 http://localhost/...` |
| Smoke-test a fresh install (no themes, no plugins; builds its own stack) | `sh tests/smoke/run.sh` |
| Back up now / test a restore | `docker compose exec backup /opt/backup/backup.sh` and `.../verify.sh latest` |
| Preview the docs site | `docker run --rm -p 4173:4173 -v "$(pwd)/docs:/work" -w /work -e DOCS_BASE=/ node:22 sh -c "npm ci && npx vitepress dev --host 0.0.0.0 --port 4173"` |

Some things that have bitten before:

- **Use the admin through `http://polysite.localhost`** (the proxy address), not the
  container port, because the CMS builds its URLs from `CMS_DOMAIN`.
- **The dev file watcher can miss edits** under `apps/cms/src`. If a change doesn't take
  effect, restart the CMS container and wait for `/admin/login` to answer before testing.
- **After adding an admin plugin, collection or component**, regenerate the import map and
  restart the CMS.
- **A migration needs a terminal sometimes.** When a change could be a rename, the generator
  asks, and that prompt can't be scripted. Unambiguous changes generate without one. Check
  every new migration by booting the production image (`--target run`) on an empty database
  and calling the API (`sh tests/smoke/run.sh` does this for the core alone).
- **Security settings are checked on https only.** With `SITE_SCHEME` or `CMS_SCHEME` set to
  `https`, the CMS refuses to start on placeholder secrets and the first account needs
  `POLYSITE_SETUP_TOKEN`; plain http (local development, the smoke test) is untouched. Don't
  weaken these checks to make a local setup work; set the real values or use `http`.
- **Check client-side behaviour in a real browser.** Hydration errors, navigation bugs and
  stacking problems don't show up in `curl`.

## Commits and pull requests

- Write the subject in the imperative and under about 72 characters ("Fix
  duplicate slug on copy"). Use the body to explain why, not to repeat the diff.
- Keep a commit to one concern. Add files by explicit path rather than
  `git add -A`, so unrelated work in your tree doesn't ride along.
- Use your own name and email in git. Don't add attribution lines for tools.
- Keep a pull request focused. If a refactor is needed first, send it first.

## Contributions and the license

Polysite's license lets you use and modify the software for your own purposes
but does not make it open source, and the licensor keeps the right to license
it to others on other terms (see sections 9, 16 and 17 of [LICENSE.md](LICENSE.md)).
So that a contribution can be included in Polysite, **by submitting one you
confirm that you wrote it or have the right to submit it, that it may be used
and distributed under the Polysite Source-Available License, and that Quick
Support Today Inc. may also license it under other terms.** If you cannot agree
to that, please don't send the change. If you are contributing on behalf of an
employer, make sure they are happy with it.

Questions about any of this are welcome through the
[`polysites`](https://github.com/polysites) organization on
GitHub.
