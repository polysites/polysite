# End-to-end checks

Scripts that drive a RUNNING Polysite through the API and the public site and say what failed. They create their own test data and remove it.

| Script | What it checks | Needs |
| --- | --- | --- |
| `workflow.e2e.mjs` | drafts, publishing, version history and restore, scheduled-publish rules, review state, publish permission | the core |
| `security.e2e.mjs` | the access rules the security review found: another site's drafts, the URL index, page versions, unlock, review fields, upload size | the core |
| `i18n.e2e.mjs` | translatable content, fallback, `locale=all`, drafts and versions across languages | the core |
| `multilang.e2e.mjs` | a site in two languages: addresses, `hreflang`, switcher, `noindex`, sitemap, news, required fields | the core and the i18n plugin |
| `plugins/auth/test/e2e/*.e2e.mjs` | two-factor sign-in, single sign-on (with the mock identity provider in the same folder) | the core and the auth plugin |
| `plugins/search/test/e2e/search.e2e.mjs` | visitor search: no drafts or other sites' pages leak, languages, paging, rate limit, results page | the core and the search plugin |
| `plugins/share/test/e2e/share.e2e.mjs` | share buttons: settings, exact links in the rendered page, per-site and per-content-type gating, French | the core and the share plugin |
| `plugins/auth/test/e2e/api-keys.e2e.mjs` | API keys (the script says so and stops when `AUTH_API_KEYS=true` is not set on the CMS) | the core and the auth plugin |
| `plugins/posts/test/e2e/posts.e2e.mjs` | news: list, article, RSS feed, sitemap, SEO tags, and the per-site News settings | the core and the posts plugin |
| `plugins/analytics/test/e2e/analytics.e2e.mjs` | the per-site analytics settings reaching the public site (`site.extensions.analytics`) and the overview endpoint | the core and the analytics plugin |
| `plugins/webhooks/test/e2e/webhooks.e2e.mjs` | signed webhooks: delivery, retries, switch-off, replay (needs the CMS started with the test settings in the plugin's README) | the core, the webhooks plugin and its receiver |
| `plugins/wordpress-import/test/e2e/wordpress-import.e2e.mjs` | a WordPress import end to end (needs `WORDPRESS_IMPORT_ALLOW_PRIVATE_HOSTS=1` on the CMS) | the core and the wordpress-import plugin |

## Where they run

- `workflow`, `i18n` and `security` run after the fresh-install smoke test, on every push (`tests/smoke/run.sh`).
- The core checks and the plugin checks above, **except `webhooks` and `wordpress-import`**, run together, with the plugins
  installed, with `tests/e2e/run-with-plugins.sh`. It first runs the plugin isolation check (`scripts/pluginMigrations.sh check`).
  The two newest plugins' scripts are not wired into it yet; run them by hand as their READMEs describe.

  ```bash
  PLUGINS_DIR=../polysite-plugins sh tests/e2e/run-with-plugins.sh
  ```

  In CI this is the `e2e-plugins` job. The core never depends on the plugins repository, so the job runs only when it can read it:
  create a key pair (`ssh-keygen -t ed25519 -f plugins-deploy -N ""`), add `plugins-deploy.pub` to **polysite-plugins → Settings →
  Deploy keys** (read-only), and put the private file's contents in **polysite → Settings → Secrets and variables → Actions** as
  `PLUGINS_DEPLOY_KEY`. Without it the job says it was skipped and passes.

## Running one by hand against a dev stack

```bash
docker run --rm --network polysite_default -e BASE=http://cms:3001 -e ADMIN_EMAIL=<a Super Admin> -e ADMIN_PASSWORD=<its password> \
  -e SITE_ID=1 -e SITE_HOST=voidslate.localhost -v "$PWD/tests/e2e:/e:ro" -w /e node:22 node workflow.e2e.mjs
```

## Deployment tests

The proxy, Kubernetes and template tests run the same smoke test against the deployment artifacts. They live with those artifacts in the
[polysite-deploy](https://github.com/polysites/polysite-deploy) repository and read this repository's `tests/smoke` through `POLYSITE_CORE`.
The overview of all tests is [`tests/README.md`](../README.md).
