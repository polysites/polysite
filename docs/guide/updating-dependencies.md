# Updating Payload and other dependencies

Polysite uses Payload, Next.js and Nuxt as ordinary dependencies, installed from lockfiles (Payload, its plugins and Next.js are pinned to exact versions), so an update is a deliberate, tested change and never a surprise.

## How updates arrive

Dependabot opens a pull request each week for each group of dependencies (`.github/dependabot.yml`). **Every Payload package is updated together in one pull request**, because they must all be the same version. A new *major* version of anything is its own pull request: read its release notes before merging. The pull request's checks are the same ones every change goes through:

- lint, unit tests and image builds for the CMS and the web app;
- the fresh-install smoke test, followed by the drafts-and-publishing and translatable-content end-to-end checks, all on the real stack;
- when the plugins repository can be read, the **plugin end-to-end checks** as well: drafts, languages, two-factor sign-in and single sign-on, with the plugins installed (`e2e-plugins`, see `tests/e2e/README.md`).

If those are green, the update is very likely safe. If a check fails, the failing step names the area.

## Taking a Payload update by hand

1. Raise `payload` and every `@payloadcms/*` package in `apps/cms/package.json` to the same version, run `npm install` once to refresh `package-lock.json`, and commit both.
2. Restart the CMS (the import map and types regenerate), and open the admin.
3. **Check whether the database layout changed:** run `docker compose exec cms sh scripts/pluginMigrations.sh check` (with the plugins mounted). It fails if the core's tables, or a plugin's, no longer match their migrations. If it does, create the migration with `scripts/pluginMigrations.sh core <name>` (or `plugin <slug> <name>`), read it (the safety check `npm run check:migrations` refuses anything that deletes data), keep it and commit it; after a new core migration run `scripts/pluginMigrations.sh rebase <slug>` for each plugin. CONTRIBUTING.md ("Schema changes") has the detail.
4. Run the unit tests and the end-to-end checks (`tests/smoke/run.sh`, then `PLUGINS_DIR=../plugins tests/e2e/run-with-plugins.sh`).
5. Read Payload's release notes for what the checks cannot see.

## Where Polysite reaches into Payload

If an update breaks something, these are the likely places:

| Where | What it uses |
| --- | --- |
| `apps/cms/src/auth/createSession.ts` | `jwtSign`, `getFieldsToSign`, `generatePayloadCookie`, to sign someone in without a password (single sign-on) |
| writes with `payload.db.updateOne` | the database adapter directly. A write naming one array field rewrites every array field of the row, so always pass the whole document (Known Issue #60) |
| `apps/cms/src/payload.config.ts` search settings | the search plugin's `beforeSync`, `skipSync`, `syncDrafts`, `deleteDrafts` |
| `apps/cms/src/workflow/`, `apps/cms/src/i18n/` | how drafts, versions and locales behave: `?draft=true`, `_status`, `versions`, `locale`, `fallback-locale`, `locale=all` |
| the migration helpers | the generator's create-or-rename prompt (Known Issue #62), and the per-language table layout |
| `apps/cms/src/app/(payload)/custom.scss` | the admin's own class names (`.localizer`, `.field-label .localized`) |
| plugin admin components | paths in Payload's import map, and `@payloadcms/ui` hooks |

## Everything else

Nuxt, Vue and the modules (sitemap, SEO, image, security) are updated the same way from `apps/web`. The documentation site's dependencies update monthly. Docker base images and the GitHub Actions used by CI update monthly.
