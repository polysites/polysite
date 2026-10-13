# Configuration

Everything is set in one `.env` file next to the compose file (copy `.env.example`, which has a comment for each variable).
Docker Compose hands the file to every service. There is deliberately no `NODE_ENV` in it: each image sets its own, and a value in `.env` would override it and break
Payload's production behaviour (Known Issue #7).

This page lists the core's variables. A plugin's own settings are in its README; a few of the useful ones are at the end.

## Domains and addresses

| Variable | Default | What it does |
| --- | --- | --- |
| `SITE_DOMAIN` | `*.localhost` in `.env.example` (`localhost` if unset) | The host (or hosts) Caddy serves the public sites on. `*.localhost` serves every `<name>.localhost` for local work; production names each real domain, because a wildcard cannot get an automatic certificate |
| `SITE_SCHEME` | `http` | `https` makes Caddy obtain and renew a certificate for each site domain |
| `CMS_DOMAIN` | `polysite.localhost` in `.env.example` (`admin.localhost` if unset) | Where the admin and API are served. The CMS builds its own links (password-reset emails, Live Preview) from it, so open the admin through this address |
| `CMS_SCHEME` | `http` | `https` for the admin's certificate. It also turns on the secure session cookie and the checks in [Securing an install](/guide/security) |

## Host ports (local stack)

The local compose files publish a few ports on your machine. Move any that is taken in `.env`:

| Variable | Default | What it is |
| --- | --- | --- |
| `POLYSITE_HTTP_PORT` | 80 | Caddy, plain http. When it is not 80, put the same port in `SITE_DOMAIN` and `CMS_DOMAIN` (`*.localhost:8080`, `polysite.localhost:8080`) |
| `POLYSITE_HTTPS_PORT` | 443 | Caddy, https |
| `POLYSITE_WEB_PORT` | 3000 | The public site directly (dev loop only) |
| `POLYSITE_CMS_PORT` | 3001 | The CMS directly (dev loop only) |
| `POLYSITE_DB_PORT` | 5432 | Postgres, on this machine only |

`COMPOSE_PROJECT_NAME` (default `polysite`) names the containers and volumes; set it to run a second copy beside another stack.
`docker-compose.prod.yml` publishes ports 80 and 443 only and does not read these.

## Secrets

| Variable | What it does |
| --- | --- |
| `PAYLOAD_SECRET` | Signs sessions and form tokens and keys the encrypted settings plugins store. Never change it on a running install |
| `REVALIDATE_SECRET` / `NUXT_REVALIDATE_SECRET` | The shared secret on the call from the CMS to the web app after a publish. Both must hold the same value |
| `POLYSITE_SETUP_TOKEN` | Required to create the first administrator when `CMS_SCHEME=https`; optional otherwise |
| `POLYSITE_ALLOW_OPEN_SETUP` | `1` lets the first administrator be created without a token on https (throwaway servers only) |
| `POLYSITE_ALLOW_WEAK_SECRETS` | `1` switches off the start-up check for placeholder or short secrets on https (throwaway servers only) |

## Database

| Variable | What it does |
| --- | --- |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Used by the local `db` service |
| `DATABASE_URL` | The CMS's and the backup service's connection string. In production it points at the Cloud SQL proxy |
| `POSTGRES_MAJOR` | The major version of the server, which the backup client must match (default 16) |
| `POLYSITE_DB_PUSH` | `false` stops local development from syncing tables to the config on boot, so removing a plugin can never offer to drop its tables |

## Web app

| Variable | Default | What it does |
| --- | --- | --- |
| `NUXT_PUBLIC_API_BASE` | `/api` | The API path the browser calls; Caddy proxies it to the CMS |
| `NUXT_API_BASE_INTERNAL` | `http://cms:3001/api` | Where the server-side render reaches the CMS directly |
| `NUXT_REVALIDATE_URL` | `http://web:3000/api/revalidate` | The address the CMS calls after a publish to clear the page cache |
| `NUXT_CMS_ORIGIN` | from `CMS_SCHEME` + `CMS_DOMAIN` | The admin's origin, which the public site's `Content-Security-Policy: frame-ancestors` allows so Live Preview can show a page inside the admin. Read when the web container **starts**, so a published image works on any domain without a rebuild. Without it (and without `NUXT_PUBLIC_CMS_SERVER_URL` or `CMS_DOMAIN`) only the site itself may frame its pages |
| `NUXT_PUBLIC_CMS_SERVER_URL` | from `CMS_SCHEME` + `CMS_DOMAIN` (the compose files set it) | The admin's address as the browser sees it; Live Preview checks messages from the admin against it. Also read at run time |
| `REDIS_URL` | `redis://redis:6379` | Not read by anything yet; Redis is provisioned for the planned form-intake queue |

## Limits

| Variable | Default | What it does |
| --- | --- | --- |
| `POLYSITE_MAX_UPLOAD_MB` | 25 | The largest single upload |
| `POLYSITE_LOGIN_RATE_LIMIT` | 20 | Sign-in attempts per address in 10 minutes |
| `POLYSITE_RESET_RATE_LIMIT` | 5 | Password-reset requests per address in 15 minutes |
| `POLYSITE_WEB_RATE_LIMIT` | 600 | The public site's page requests per address in one window (`0` = off). See [Security](/guide/security#the-public-site-s-request-cap) |
| `POLYSITE_WEB_RATE_WINDOW_SECONDS` | 60 | That window, in seconds |
| `POLYSITE_WEB_RATE_LIMIT_OFF` | unset | `1` switches the public site's cap off |
| `POLYSITE_WEB_RATE_LIMIT_IP_HEADER` | unset | The header that carries the visitor's address behind a CDN, such as `CF-Connecting-IP` for Cloudflare |
| `POLYSITE_WEB_TRUST_PROXY` | on | `0` ignores `X-Forwarded-For` for that cap (only if the web port is reachable without a proxy) |

## Plugins

| Variable | What it does |
| --- | --- |
| `POLYSITE_PLUGINS_OFF` | Comma-separated plugin folder names to leave out without deleting anything. See [Plugins](/guide/plugins) |
| `POLYSITE_PLUGINS_ONLY`, `POLYSITE_MIGRATION_DIR` | Set by `scripts/pluginMigrations.sh` while it generates a plugin's migration. Do not set them by hand |

Plugin settings worth knowing: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME` (email);
`AUTH_API_KEYS`, `AUTH_MAX_LOGIN_ATTEMPTS`, `AUTH_LOCK_MINUTES` (auth); `AUTH_TURNSTILE_SITE_KEY` and `AUTH_TURNSTILE_SECRET_KEY` (auth: switch the
Cloudflare Turnstile check on the sign-in page on, and win over the keys saved in the admin) and `AUTH_CAPTCHA_OFF=1` (auth: the emergency switch
that turns that check off when nobody can sign in; see [Security](/guide/security)); `POLYSITE_SEARCH_RATE_LIMIT` (search);
`WEBHOOKS_MAX_ATTEMPTS`, `WEBHOOKS_RETRY_DELAY_MS`, `WEBHOOKS_DISABLE_AFTER`, `WEBHOOKS_TIMEOUT_MS`, `WEBHOOKS_LOG_DAYS` (webhooks);
`WORDPRESS_IMPORT_MAX_MB` (wordpress-import). `NOTIFY_ALLOW_PRIVATE_HOSTS`, `WEBHOOKS_ALLOW_PRIVATE_HOSTS`,
`WORDPRESS_IMPORT_ALLOW_PRIVATE_HOSTS` and `AUTH_SSO_ALLOW_HTTP` exist for tests and let a plugin reach private addresses or plain
http: never set them on a real install.

## Backups and telemetry

The `BACKUP_*` variables (schedule, retention, encryption, off-site copy, monitoring ping) are in
[Backups and restore](/guide/backups#settings). `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` turn on OpenTelemetry
tracing for both apps; leave them empty for none.

An off-site backup copy needs `BACKUP_ENCRYPTION_PASSPHRASE` as well (16 characters or more): with `BACKUP_RCLONE_REMOTE` set and no
strong passphrase the backup refuses to send anything off the machine. The rule is spelled out in
[Backups and restore](/guide/backups#turn-on-the-off-site-copy).

## Production only

`docker-compose.prod.yml` also reads `POLYSITE_VERSION` (required), `POLYSITE_REGISTRY`, `POLYSITE_CMS_IMAGE`,
`POLYSITE_WEB_IMAGE` and `POLYSITE_BACKUP_IMAGE`, and the Cloud SQL proxy needs `CLOUD_SQL_CONNECTION_NAME` and
`GOOGLE_APPLICATION_CREDENTIALS_HOST_PATH`. [Deploying](/guide/deploying) explains them; the deploy script normally sets the image
variables for you.
