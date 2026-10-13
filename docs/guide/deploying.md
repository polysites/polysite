# Deploying

How to run Polysite on a server, put a new version on it safely, and take it back. This is the single-server setup: one VM,
Docker Compose, Caddy for HTTPS, a managed PostgreSQL database. There is no orchestrator in this path (the pilot's choice); other ways to run Polysite, including [Kubernetes](/guide/deploy/kubernetes) and your own [Apache, nginx or Traefik](/guide/deploy/proxy), are compared in [Deployment options](/guide/deploy/).

A deploy changes the running site, so it is a **separate, deliberate act** from releasing: a release tag only publishes images
([Releases and versions](/guide/releasing)). `deploy/deploy.sh <version>` is what puts them on a server.

## Production checklist

Do these once, before the first deploy.

**Server**

- A Linux VM with Docker Engine and the Compose plugin (v2.24 or newer), and about 10 GB of free disk for images, plus room for backups.
- Ports 80 and 443 open to the world; SSH on a port you restrict. Nothing else is published: the database, Redis and the
  apps are reachable only inside Docker's network.
- A checkout of this repository (or the release's deployment bundle) in a folder such as `/opt/polysite`. The server needs
  `docker-compose.prod.yml`, `Caddyfile`, `.env` and `deploy/deploy.sh`; it never needs the source to build anything.
- Log in to the registry that holds the images if it is private: `docker login ghcr.io` with a token that can read packages.

**DNS**

- One `A` (and `AAAA`) record per hostname pointing at the server: each public site's domain (`SITE_DOMAIN`) and the admin's
  (`CMS_DOMAIN`). Do this before the first start: Caddy asks Let's Encrypt for a certificate the first time a name is requested,
  and a name that does not yet resolve to this server will fail validation and be retried slowly.
- Every site is a separate hostname in the proxy configuration; a wildcard cannot get an automatic certificate (see the notes in
  `Caddyfile`).

**TLS**

- Set `SITE_SCHEME=https` and `CMS_SCHEME=https` in `.env`. Caddy then obtains and renews certificates by itself. Keep the
  `caddy-data` volume: it holds the certificates and the account key, and losing it means re-issuing (and Let's Encrypt rate limits).

**Secrets** (`.env` on the server, never in git)

- Replace every `changeme`: `PAYLOAD_SECRET`, `NUXT_REVALIDATE_SECRET`, `REVALIDATE_SECRET`, the database password. Use long random
  values (`openssl rand -base64 48`). **With `SITE_SCHEME` or `CMS_SCHEME` set to `https`, the CMS refuses to start** on a missing,
  placeholder or short (under 32 characters) secret, and says which one ([Securing an install](/guide/security),
  [Configuration](/guide/configuration)). **Do not change `PAYLOAD_SECRET` afterwards**: stored credentials depend on it.
- `POLYSITE_SETUP_TOKEN` is **required over https**: the CMS refuses to create the first administrator without it, because whoever
  reached a new public server first would become Super Admin. Set a long random value, and enter it on the first-run page.
- The database: `DATABASE_URL`, plus `CLOUD_SQL_CONNECTION_NAME` and `GOOGLE_APPLICATION_CREDENTIALS_HOST_PATH` for the Cloud SQL
  proxy in `docker-compose.prod.yml`. The service account needs only the Cloud SQL Client role. The database user needs
  `CREATEDB`, because the weekly test restore and the pre-deploy backup check restore into a scratch database.
- Keep the file readable by one user: `chmod 600 .env`.

**Backups** ([the backup guide](/guide/backups) has the detail)

- They start with the stack: nightly at 03:17 UTC, kept 7 days / 4 weeks / 6 months, and a full test restore every Sunday.
- Set `BACKUP_RCLONE_REMOTE` for an off-site copy (a backup that lives only on the machine is lost with the machine),
  `BACKUP_ENCRYPTION_PASSPHRASE` (16 characters or more, and stored somewhere other than this server; **required** with the remote: without it the backup refuses to send anything off the machine, the container turns unhealthy, and the pre-deploy backup fails so the deploy stops with the reason in its output), and `BACKUP_PING_URL` so a missed
  backup alerts you.
- The published backup image has the Postgres 16 client, and it must match the server's major version. For another major version, build
  `backup` with `--build-arg PG_MAJOR=<n>` and set `POLYSITE_BACKUP_IMAGE`.

**Monitoring**

- `GET /api/health` on both apps returns `{"status":"ok","version":"..."}`. On the CMS it also checks the database (503 when it does
  not answer). Point an external uptime monitor at `https://<admin domain>/api/health` and at a public site.
- `docker compose ps` shows each service's health; the images have health checks.
- The backup container reports healthy while its last backup is under 36 hours old.
- Optional OpenTelemetry: set `OTEL_EXPORTER_OTLP_ENDPOINT` to send traces to your own collector.
- Watch the disk: images, the `backups` folder and Docker's logs are what fill it.

**Existing installs only:** images before this change ran as root. Their named volumes are owned by root, which the unprivileged
`node` user in the new images cannot write to. Once, before the first deploy of the new images:

```bash
docker run --rm -v <project>_media-data:/m -v <project>_static-content:/s alpine chown -R 1000:1000 /m /s
```

New installs need nothing (Docker copies the ownership from the image).

## The first deploy

```bash
cd /opt/polysite
cp .env.example .env          # then edit it as above
sh deploy/deploy.sh 0.1.0 --dry-run     # pulls the images, checks everything, changes nothing
sh deploy/deploy.sh 0.1.0
```

On a machine with no Polysite containers the script treats this as the first deploy: no backup (nothing to back up), then the
migrations, then everything starts. Open `https://<admin domain>/admin` to finish first-run setup.

## Upgrading

```bash
sh deploy/deploy.sh 0.2.0 --dry-run     # optional: see the plan and the migration check first
sh deploy/deploy.sh 0.2.0 --url https://admin.example.org/api/health
```

Read the version's entry in `CHANGELOG.md` first, especially "Upgrade notes". The script then does, in this order:

1. **Pre-flight.** Docker and Compose are there; the compose file is valid for this version; there is disk space (2 GB by default,
   `MIN_FREE_MB` changes it); the running CMS and web app are healthy (otherwise it stops, unless `--force`).
2. **Pulls the images** for the version and checks that each one says it *is* that version (a tag that points at the wrong image is
   refused). Each is then pinned by its **digest**, so what runs is exactly what was pulled.
3. **Migration guard**, read-only, inside the new image: `npm run check:migrations` for the core and a scan of every plugin's
   migrations. A migration that drops or deletes anything stops the deploy before anything is touched. (A migration that really
   must delete carries a `polysite:allow-destructive` comment; then the deploy asks for `--allow-destructive`, and a rollback of images
   is no longer safe.)
4. **Backup.** It runs the backup service's own backup, then test-restores that archive into a scratch database
   (`verify.sh`) and compares row counts. If either fails, nothing is deployed. `--skip-backup` exists, is logged, and should be rare.
5. **Records the way back**: the digests of the images running now.
6. **Migrations**, in a one-off container from the *new* image (`payload migrate`, which applies the core's and the plugins'
   migrations), while the old services keep serving. If this fails nothing was switched.
7. **Switches one service at a time** (cms, web, backup), waiting for each to be healthy and, for cms and web, to report the new
   version on `/api/health`. Caddy and Redis are not recreated. While the cms container is replaced there is a short gap (seconds to
   about a minute): a single instance cannot be replaced with no gap.
8. **Checks** every `--url` you gave it, then writes the deployment record.

If anything fails from step 6 on, it **rolls back by itself** and says so. Exit status: `0` done; `1` refused or failed before any
service was changed; `3` failed and was rolled back; `2` failed and the rollback failed too (the output says exactly what to run).

### Where it keeps its records

In `.deploy/` next to the compose file (`--state-dir` moves it):

| File | What |
| --- | --- |
| `audit.log` | One line per event: who, when, what (start, backup name, migrations, each service switched, success, failure, rollback). Nothing is posted anywhere. |
| `current.env` | The version and image digests of the current deployment. |
| `previous.env` | The deployment before it: the target of `--rollback`. |

Run later compose commands with the deployment's settings, so they use the same images:

```bash
docker compose --env-file .env --env-file .deploy/current.env -f docker-compose.prod.yml ps
```

Any `POLYSITE_VERSION` or `POLYSITE_*_IMAGE` exported in your shell is ignored by the script; `docker-compose.prod.yml` requires
`POLYSITE_VERSION` and takes it from the file above.

### From GitHub

The **Deploy** workflow runs the same script over SSH. It is manual only: you give it a version (or tick *rollback*), and with a
`production` environment that has required reviewers it waits for approval. Set the secrets `VM_HOST`, `VM_USER`, `VM_SSH_PRIVATE_KEY`.

## Rolling back

```bash
sh deploy/deploy.sh --rollback --dry-run
sh deploy/deploy.sh --rollback
```

This puts back the images that ran before the last deployment, one service at a time with the same health gates. Running it a
second time goes forward again.

**What a rollback does and does not undo.** It changes **images only**. The database keeps every migration that was applied. That is
safe because Polysite's migrations are *additive only*: they add tables and columns and never drop or rewrite, the guard in step 3
refuses anything else, and older code simply does not use what it does not know about. So the previous version runs correctly on
the newer schema.

**If a migration itself has to be undone** (a migration marked `polysite:allow-destructive`, or one that is wrong and is corrupting
data), rolling back images is not enough. Restore the pre-deploy backup, which the audit log names (`event=backup name=...`):

1. Stop the apps: `docker compose --env-file .env --env-file .deploy/current.env -f docker-compose.prod.yml stop cms web`.
2. Restore: `docker compose ... --profile restore run --rm restore <archive name> --yes` ([the backup guide](/guide/backups)).
   This replaces the database *and the media* with the state at backup time: anything editors did since the backup is lost, so
   do this only when the alternative is worse.
3. Put the old images back with `deploy.sh --rollback` and check the site.

To get a restored copy running without touching production, restore into a separate machine first.

## When something goes wrong

| Symptom | Meaning and next step |
| --- | --- |
| "another deploy is running" | A lock folder `.deploy/lock` exists. If no deploy is running (the previous one was killed), remove that folder. |
| "says it is version X, not Y" | The tag and the image disagree. Do not force it; tell whoever published the release. |
| "the backup could not be restored in a test" | The new backup is bad. Nothing was changed. Run `backup.sh` and `verify.sh latest` by hand and read the output; see the backup guide. |
| "the migrations failed" | No service was switched. Each migration runs in its own transaction, so the database holds any that finished before the failure (all additive). Read the output, fix the cause or deploy the previous version. |
| Exit status 3 | A health gate failed after the migrations and the previous images were put back. `docker compose logs --tail 100 cms` shows why the new one failed; the database already has the new version's migrations. |
| Exit status 2 | The automatic rollback failed. Run the command the script printed, then `docker compose ps`. The pre-deploy backup is named in the output. |
| A plugin's pages are missing after an upgrade | Its `requires` range did not match the new core. Look for `[plugins] <name>: not loaded` in `docker compose logs cms`. |

## Things this setup does not do

No zero-downtime switch (one instance of each service), no blue/green, no automatic scale-out. Those need an orchestrator and a
second app instance. The application is not safe to run in several copies yet (uploads on one disk, state in memory: [the Kubernetes page lists exactly what](/guide/deploy/kubernetes#what-is-not-safe-with-more-than-one-replica)), so an orchestrator adds self-healing and rolling updates but not scale-out. A deploy replaces the CMS and web containers one after the
other and gates each on its health check, which is as close as a single VM gets.
