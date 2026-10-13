# Plugins

Polysite keeps its core generic on purpose. Everything optional lives in plugins you can add, remove or
replace without touching the core app, and **Polysite runs without any of them**.

Each plugin is a self-contained package with its own version and README. The CMS finds them at boot and
applies them for you, so there is no config file to edit.

## Available plugins

Plugins live in their own repository,
[`polysite-plugins`](https://github.com/polysites/polysite-plugins). Its README lists what is
available, and each plugin's own README is its guide: what it adds to the admin, how editors use it and what
it doesn't do. The core's guides don't repeat them.

| Plugin | Scope | What it adds |
| --- | --- | --- |
| `email` | global | Real SMTP email for password resets and everything else Payload sends, with a log of what was sent |
| `analytics` | per-site | Analytics and advertising tools chosen per site, with consent handling |
| `posts` | per-site | News and articles: posts and categories, a news section per site, an RSS feed |
| `notifications` | global | Watch any document and be told when it changes: in-admin bell, Slack, Teams, a signed webhook or email |
| `auth` | global | Single sign-on, two-factor sign-in, API keys and lockout settings |
| `i18n` | global | Several languages per site: addresses, switcher, `hreflang`. See [Languages](/guide/languages) |
| `search` | per-site | Visitor search over a site's published pages and posts. See [Search](/guide/search) |
| `share` | per-site | Share buttons for the page a visitor is on. See [Share buttons](/guide/share-buttons) |
| `webhooks` | global | Signed JSON messages to other systems when pages, posts, forms or media change, with retries, a delivery log and replay. Super Admins only |
| `wordpress-import` | global | Imports a WordPress export file (pages, posts, images, menu, redirects) into one site, with a dry run first |

**Scope** is `global` (active across the whole installation as soon as it is installed) or `per-site` (a site
only runs it once an administrator enables it for that site).

A plugin keeps its data in its own tables, never in a core one: its per-site settings are a collection of
their own (one row per site, reached from **Administration** in the sidebar, often under **Site features**), not a tab on **Sites**,
and nothing is added to **Users**. The public site reads a plugin's settings as `site.extensions.<key>`.

## Install

Mount the plugins repository as `plugins/` in a Polysite checkout:

```bash
git clone git@github.com:polysites/polysite-plugins.git plugins
docker compose restart cms
```

On start the CMS container installs each plugin's own dependencies, regenerates the admin import map and loads
whatever it finds. Then configure a plugin where it lives in the admin. In local development the tables a plugin
needs are created by Payload's schema sync; in production they are created by the plugin's own migrations, which the
CMS runs after the core's when it starts. Nothing else needs doing.

Plugins are fixed into an image when it is built, so a production install that uses any builds its own image from
source; the published core images hold the core only (see [Releases and versions](/guide/releasing#plugins-and-themes)).

To use only some plugins, remove the folders you don't want. A folder without a `polysite.plugin.json` is
ignored. A plugin with an unparsable manifest, no `src/index.js`, or a `package.json` that lacks
`"type": "module"` is skipped with a message in the CMS log (prefixed `[plugins]`) instead of breaking boot.

## Removing or switching off a plugin keeps its data

Taking a plugin away never deletes what people created with it. To switch one off without touching its folder,
list it in `POLYSITE_PLUGINS_OFF` in `.env` (comma separated, for example `POLYSITE_PLUGINS_OFF=posts`) and
restart; deleting the folder has the same effect. The plugin's collections, admin screens, role module and web
pages disappear, and everything else keeps working. Its tables, content and settings stay in the database, so
turning it back on finds everything as it was.

Two things could still delete data by accident, and both are guarded:

- **A migration generated while a plugin is missing** sees its tables as removed. `payload migrate:create`
  refuses to run while `POLYSITE_PLUGINS_OFF` is set, and `npm run check:migrations` (run by the commit hook
  and CI) fails any migration that drops a table, column or type, unless it carries a
  `polysite:allow-destructive` comment. Generate migrations with every plugin present.
- **Local development syncs tables to the config on boot** and would offer to drop the removed plugin's. Answer
  no, or set `POLYSITE_DB_PUSH=false` in `.env` to turn the sync off (then a table change needs a migration, as
  in production). Production never drops anything on boot.

## Build your own

A plugin is a directory with three things:

```text
plugins/my-plugin/
  polysite.plugin.json   the manifest the CMS reads at boot
  package.json           a normal package; must contain "type": "module"
  src/index.js           default export: a Payload plugin function
```

The manifest:

```json
{ "slug": "my-plugin", "label": "My plugin", "scope": "global", "version": "0.1.0" }
```

It may also carry `"kind"` (`"content-type"`, `"site-settings"`, or both in an array; see below) and `"requires": { "polysite": ">=0.1.0" }`,
the core versions it works with: the CMS leaves out, with a message in its log, a plugin that doesn't fit the running version, and
deletes nothing ([Releases and versions](/guide/releasing#plugins-and-themes)).

`src/index.js` is a plain ES module exporting a standard Payload plugin, which is a function that takes the
config and returns a new one:

```js
export default function myPlugin(config) {
  return {
    ...config,
    collections: [
      ...(config.collections ?? []),
      { slug: "my-things", fields: [{ name: "title", type: "text", required: true }] },
    ],
  };
}
```

Plugins are applied after the core and every Payload plugin, so they can see and instrument every collection that
exists, including ones generated by other plugins. A plugin whose manifest says `"kind": "content-type"` is the
exception: it adds collections whose items belong to a site and usually have a public address, so it is applied
first, and the core then scopes it to a site, adds SEO fields, the URL index entry and Live Preview from what
the collection declares about itself. It can also ship a `web/` folder, a Nuxt layer with its own pages and
components. A plugin whose manifest says `"kind": "site-settings"` keeps per-site settings in a collection of its own:
the core makes it one row per site, opens the current site's row from the sidebar, and hands the fields the plugin marks
public to the public site as `site.extensions.<key>`. The full contract, with examples, is in the plugins repository's README.

### The isolation rule

> The core runs without any plugin. A plugin runs without changing the core. A plugin keeps its data in its own tables.

A plugin may change *behaviour* through the extension points (hooks, endpoints, the registries) but adds no field, column,
enum value or table to a core collection (`sites`, `users`, `pages` and so on). Per-site settings go in the plugin's own
settings collection, never as a tab on Sites. Per-user state (a second-factor secret, a preference) goes in a collection of
the plugin's own with a `user` relationship, never on Users. Lists that depend on what is installed are stored as plain
text, never as a `select`, because a select is a Postgres enum that installing another plugin would change.

### Database changes

A plugin ships **its own migrations** in `plugins/<slug>/migrations/` (plain ESM files, `up({ db, sql })` and `down`). The core runs
them in production after its own, in plugin order, and its own migrations contain core tables only. Generate and check them
inside the CMS container, where they never touch your database:

```bash
docker compose exec cms sh scripts/pluginMigrations.sh plugin <slug> <name>   # create a plugin's migration
docker compose exec cms sh scripts/pluginMigrations.sh check                  # verify the core and every plugin
```

A plugin's migration is the difference between "the core" and "the core plus this one plugin", so it holds what the plugin adds
and nothing else, whatever other plugins are installed. `check` runs in CI and in the plugin end-to-end run, and fails when a
plugin migration alters a table it didn't create or drops anything, or when a plugin's collections changed without a migration.
Don't run a bare `payload migrate:create` for a plugin: it would write the plugin's tables into the core's migration. When the
core gains a migration, run `scripts/pluginMigrations.sh rebase <slug>` for each plugin that passed `check` before.

### Rules plugins follow

- **Stay independent.** Never import from the CMS app's internals. The core hands a plugin the few helpers it
  may need as a second argument (`apply(config, kit)`). If you need a small helper the core also has, such as an
  encryption routine, copy it. That is what keeps a plugin installable on its own.
- **Configure from the database, not just `.env`.** Give admins a global or collection to edit settings in, and
  use environment variables only to seed defaults.
- **Encrypt secrets** you store, key them from `PAYLOAD_SECRET`, and return them masked from the API.
- **Never delete users' content** when removed. Keep data in your own tables, which stay when the plugin goes.
- **Never change a core table.** No new field on Sites, Users or Pages; use your own collection (see the isolation rule).
- **Plain JavaScript.** Next.js does not transpile workspace packages without extra setup, so plugins ship as ESM
  `.js` files rather than TypeScript.
- **Admin components** are referenced by a path relative to the CMS app and written without JSX
  (`React.createElement`).
