# Tests

Everything runs in containers: no Node, Helm or kubectl on the host, only Docker (Compose 2.24 or newer) and `sh`.
Run the commands from the root of this repository.

| What | Command | What it proves |
| --- | --- | --- |
| **Fresh-install smoke test** | `sh tests/smoke/run.sh` | The core alone, built from this tree, starts on an empty database: first-run setup, sign in, publish a page, the public site, a form, a redirect. Then the workflow, i18n and security checks run against it |
| **Backup tests** | `sh tests/backup/run.sh` | Encryption rules, off-site refusal without a strong passphrase, only encrypted archives leave the machine, verify and restore of database and media, tamper detection |
| **Deploy-script test** | `sh tests/deploy/run.sh` | `deploy/deploy.sh` against fake releases: backup, migrations before the switch, health gates, automatic rollback, refusal of unsafe migrations |
| **Plugin end-to-end** | `PLUGINS_DIR=../polysite-plugins sh tests/e2e/run-with-plugins.sh` | The whole stack **with** the plugins: drafts, languages, two-factor, single sign-on, search, share, posts, analytics ([details](e2e/README.md)) |
| **Unit tests and lint** | `docker exec polysite-cms-1 npm test` and `docker exec polysite-web-1 npm test` (with `npm run lint`) | The apps' own tests, against the running dev stack. The pre-commit hook runs them |
| **Image smoke test** | `.github/scripts/smoke-images.sh` | The same smoke test against **published images** instead of source. Run by the release workflow; needs `CMS_IMAGE`, `WEB_IMAGE`, `BACKUP_IMAGE` |

## What the CI runs

`.github/workflows/ci.yml` runs lint and tests for both apps, builds both images, the smoke test, the backup tests, and (when it can read the plugins
repository) the plugin end-to-end job. The release workflow runs the same gates before it publishes anything.

## Tests that live in other repositories

| Repository | What it tests |
| --- | --- |
| [polysite-deploy](https://github.com/polysites/polysite-deploy) | The Helm chart, the nginx, Apache and Traefik configurations and the deployment templates. They read this repository's `tests/smoke` through `POLYSITE_CORE` |
| [polysite-plugins](https://github.com/polysites/polysite-plugins) | Each plugin's own unit and end-to-end tests (`<plugin>/test/`) |

## Folders

| Folder | Contents |
| --- | --- |
| `smoke/` | The fresh-install runner (`run.sh`), the checks it drives (`smoke.mjs`, `ratelimit.mjs`) and its compose override |
| `e2e/` | End-to-end checks of a running stack and the runner that adds the plugins |
| `backup/` | Tests of the backup tool in [`../backup`](../backup) |
| `deploy/` | Tests of [`../deploy/deploy.sh`](../deploy/deploy.sh) |
