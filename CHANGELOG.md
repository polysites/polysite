# Changelog

All notable changes to Polysite are written here, newest first. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Polysite is pre-1.0: **a minor release (0.x.0) may change things that affect an existing install**, and the
entry says so under "Upgrade notes". See `docs/guide/releasing.md` for what counts as the public surface and how a
release is cut. The version of the core is the single line in `VERSION`.

Nothing has been released yet. The history in git begins on 2026-10-08 with one commit that holds the product as
it stood on that day, so the first entry below is written from the product's documentation and the commits after it.

## [Unreleased]

### Fixed

- **Release build.** The multi-platform build of the web image no longer fails when the third-party scripts that `@nuxt/scripts`
  wraps (Gravatar, Calendly) cannot be downloaded while the app is built; it falls back to their own addresses. The tag
  `v0.1.0-beta.1` failed on this and has no GitHub release; use 0.1.0-beta.2.

## [0.1.0-beta.1] - 2026-10-13

### Added

- **Multisite core.** Every site resolves by its own domain; content, media and users are scoped per site, so an
  editor of one site cannot see or change another's.
- **Roles you edit in the admin.** Roles are data: a Super Admin chooses which collections each role can touch and
  which operations it has (create, read, update, delete, publish, unpublish, clone across sites). Anything not
  granted is denied. One `isSuperAdmin` flag is deliberately not a role.
- **Page builder with Live Preview.** Pages are made of typed blocks (hero, text, FAQ, feature grid, form embed,
  sign-up form, leader spotlight, donation tiers, commitments grid), previewed at mobile, tablet and desktop widths.
  Pages can be duplicated or cloned to another site from the list.
- **Per-site themes and branding.** A site picks its theme at runtime; logo, colours, fonts, navigation, footer
  and social links are edited per site. Themes are separate repositories discovered from the `themes/` folder.
- **SEO.** Meta title, description and social image, managed 301 redirects, a list of every URL a site answers to,
  and a sitemap built from that list.
- **Media.** Uploads are resized and converted to WebP, and served with a cache header.
- **Forms and privacy.** A form builder (petitions, sign-ups, contact) with server-side checks, a hidden trap field,
  a signed token and a rate limit; consent checkboxes with a stored consent record; automatic deletion after a
  retention period; a per-site register of privacy requests to find, export and erase a person's information.
- **First-run setup.** On an empty database the admin opens a setup page that creates the first Super Admin and the
  first site; an optional `POLYSITE_SETUP_TOKEN` restricts it to whoever controls the server.
- **Content workflow.** Drafts, version history with restore, scheduled publish and unpublish, and an "in review"
  state for pages (and for posts through the plugin kit), using Payload's native drafts and versions.
- **Several languages.** Text is stored per language with English as the only language a fresh install offers, a
  48-language catalogue, language-aware routing, fetching, sitemap and `html lang`, and fixed-word dictionaries.
  The `i18n` plugin turns languages on per site.
- **Plugin system.** A plugin is a folder with a `polysite.plugin.json` manifest. Plugins can add content types,
  per-site settings (`site.extensions`), admin components, hooks and their own database migrations, and each owns
  only its own tables. Removing or switching one off (`POLYSITE_PLUGINS_OFF`) never deletes what its users created.
  Plugins live in their own repository.
- **Single sign-on support** in the core (`kit.createSession`), used by the `auth` plugin.
- **Backups.** A backup container takes a nightly database and media archive with retention, optional encryption and
  an off-site copy through rclone, plus a weekly test restore into a scratch database (`ops/backup`).
- **Container images that run unprivileged**, with health checks (`/api/health` on the CMS and the web app), OCI
  labels and the `POLYSITE_VERSION` build argument.
- **Checks.** About 200 unit tests, lint, a migration safety check that fails any migration that deletes data, a
  plugin-isolation check, a fresh-install smoke test (core only), and end-to-end checks for the content workflow,
  translatable content and each plugin.
- **Release engineering.** A `VERSION` file, `ops/release/bump.sh` and the checks it relies on, this changelog, a
  tag-driven `release.yml` that builds, scans, attests and publishes multi-architecture images to GHCR, and
  `ops/deploy/deploy.sh`, a deploy script with a backup, migrations before the switch, health gates and automatic
  rollback. Guides: `docs/guide/releasing.md` and `docs/guide/deploying.md`.
- An optional `requires` field in a plugin manifest (`"requires": {"polysite": ">=0.1.0"}`): a plugin that needs a
  newer core than the one running is skipped at boot with a clear message instead of failing later.

### Changed

- The core's database layout is one core-only baseline migration (`production_schema`). Each plugin ships its own
  migrations, applied after the core's when the server starts, and a plugin's tables are the same whichever other
  plugins are installed.
- A module list on a role or site, and the searchable types of the search plugin, are plain text rather than a
  database enum, so they no longer depend on which plugins are installed.
- Image builds install from the lockfiles (`npm ci`) so a build today and a build next month use the same
  packages. Dependabot opens grouped weekly updates, with all Payload packages together.
- The production compose file (`docker-compose.prod.yml`) runs published images chosen by `POLYSITE_VERSION` and no
  longer builds on the server.
- Both application images run on Node 24 (the current long-term-support line); the CMS image was on Node 20, which is
  end-of-life, and the web image on Node 22.
- Production is deployed by running `ops/deploy/deploy.sh <version>`, not by tagging: a tag publishes images and a
  draft release, and nothing reaches a server until someone deploys it.

### Fixed

- The production migration used to be missing most of the schema, so a production boot returned 500 errors. It is
  now a single baseline that creates the whole current schema (Known Issue 41).
- Taking a plugin away no longer fails saves of sites and roles that still list it, and a migration generated while
  a plugin is missing can no longer drop that plugin's tables (Known Issue 55).
- The CMS image build retries the import map and generated types steps, which on some CI runners exit silently
  without writing their output.
- Signing in through single sign-on no longer empties a user's assigned sites: writes through the database adapter now pass the whole document (Known Issue 60).

### Security

- The CMS and web images run as the unprivileged `node` user instead of root.
- Public form submissions are validated against the form on the server and protected against bots and floods.
- Backups can be encrypted with a passphrase, and checksums are verified before any restore.
- An off-site backup copy is refused unless the archive is encrypted with a strong passphrase (16 characters or more): nothing is sent, the run fails, the monitor is told, and the backup container reports unhealthy.
- Every GitHub Action is pinned to a commit SHA (Dependabot keeps them current), and the image scanner is pinned by digest.
- The images were rebuilt on current dependencies: Node packages with published fixes are updated, the web image no longer carries npm, the backup image applies Alpine's security updates and drops the unused gosu binary.

### Upgrade notes

- If `BACKUP_RCLONE_REMOTE` is set, `BACKUP_ENCRYPTION_PASSPHRASE` must now be set too (16 characters or more, not a placeholder). Without it the backup keeps its local archive but refuses the off-site copy, fails, and the backup container turns unhealthy; a deploy stops at its pre-deploy backup until it is fixed.
- A Docker volume created by an older image (media, static content) is owned by root and a non-root container
  cannot write to it. Once, before the first deploy of these images: `docker run --rm -v <project>_media-data:/m
  -v <project>_static-content:/s alpine chown -R 1000:1000 /m /s` (Known Issue 58).

[Unreleased]: https://github.com/polysites/polysite/compare/v0.1.0-beta.1...HEAD
[0.1.0-beta.1]: https://github.com/polysites/polysite/releases/tag/v0.1.0-beta.1
