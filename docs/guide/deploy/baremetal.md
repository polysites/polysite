# Bare metal or a local server, without containers

Run Polysite directly on a Linux host: Node.js 24 LTS, PostgreSQL, two systemd services and a reverse proxy (nginx, Apache or Caddy). This is the path for hosts where Docker is not allowed,
or where someone must see every process. It is also the most work: **you take over what the images and the deploy script do**: building from source, running migrations, patching Node.js and the OS.
Copy-ready repository: **`polysite-deploy/templates/bare-metal`** : the two unit files, an environment file, `scripts/build.sh`, `scripts/install.sh` and proxy configurations.

## Layout

| Piece | Where |
| --- | --- |
| Source, at a release tag | `/opt/polysite/src` (a clone of the core at `vX.Y.Z`, plus your `plugins/` and `themes/` if you use any) |
| Build output | `apps/cms/.next`, `apps/web/.output` (made by `scripts/build.sh`: `npm ci`, `payload generate:importmap` and `generate:types`, `next build`, `nuxt build`; no secrets or database needed) |
| Uploads | `/opt/polysite/src/apps/cms/media` |
| Settings and secrets | `/etc/polysite/polysite.env` (mode 640, root:polysite), the same variables as `.env` ([Configuration](/guide/configuration)) with loopback addresses: `NUXT_API_BASE_INTERNAL=http://127.0.0.1:3001/api`, `NUXT_REVALIDATE_URL=http://127.0.0.1:3000/api/revalidate` |
| Services | `polysite-cms.service` (runs `npx payload migrate` before it starts `next start` on 127.0.0.1:3001) and `polysite-web.service` (`node .output/server/index.mjs` on 127.0.0.1:3000), both as the unprivileged user `polysite` with `NoNewPrivileges`, `ProtectSystem=strict`, no capabilities |
| Proxy | nginx (`proxy/nginx`), Apache (`proxy/apache`) or Caddy (`proxy/caddy`): the [same routing, limits and headers](/guide/deploy/proxy) as the Caddyfile, upstreams on 127.0.0.1 |
| Database | PostgreSQL 14+ on the host or managed; the role needs `CREATEDB` |

## Steps

```bash
# Ubuntu 22.04 / 24.04, as root
./scripts/install.sh www.example.org admin.example.org     # packages, role and database, /etc/polysite/polysite.env, clone at the pinned tag, build, units, nginx, ufw
# DNS -> certbot certonly --webroot -w /var/www/certbot -d <each name> -> proxy/nginx/polysite-tls.conf -> CMS_SCHEME / SITE_SCHEME=https in the env file -> restart both services
```

Open `https://<admin domain>/admin` and enter the setup token (`/root/polysite-setup.txt`). By hand instead of the script: install Node.js 24, create the user and database, write the env file, `git clone --branch vX.Y.Z`, `sh scripts/build.sh`, copy the two units to `/etc/systemd/system/`, `systemctl enable --now polysite-cms polysite-web`, configure the proxy.

## Upgrades and rollback

Back up. `git -C /opt/polysite/src fetch --tags && git -C /opt/polysite/src checkout v<new>`, `sh scripts/build.sh`, `systemctl restart polysite-cms polysite-web` (the CMS unit migrates first; a failed migration keeps it from starting).
Rollback: check out the previous tag, rebuild, restart; migrations are additive. Keep the previous tree as a second directory (`/opt/polysite/src-prev`) and switch a symlink if you need rollback to take seconds instead of a rebuild. Plan for a short outage during the restart.

## Backups and restore

Database: `pg_dump --format=custom` on a schedule, or your managed service's backups. Uploads: copy `apps/cms/media`. The core's `backup/*.sh` scripts also work on a host (they need `pg_dump`/`pg_restore`, `openssl` and `rclone`, and read `DATABASE_URL`, `MEDIA_DIR`, `BACKUP_DIR`): run `backup.sh` from cron. Store an encrypted copy off the machine and keep `PAYLOAD_SECRET` apart from it. Restore: stop both services, `pg_restore --clean --if-exists -d <database>` and copy the media back, start.

## Secrets, TLS, health

Secrets only in the env file; never change `PAYLOAD_SECRET` on a running install. TLS at the proxy (certbot; reload after renewal). Health: `curl -fsS http://127.0.0.1:3001/api/health` and `:3000/api/health`, `systemctl status`, `journalctl -u polysite-cms`. Monitor the disk and Node.js/OS security updates yourself.

## Hardening checklist

Loopback-only listeners; the proxy is the only public service; ufw (22, 80, 443); the services run unprivileged under the hardening options above; the env file is readable by root and the service group only; PostgreSQL listens on localhost only with a scram password;
Node.js 24 LTS patched; HTTPS only; off-site encrypted backups; the [full checklist](/guide/security).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `polysite-cms` fails at start | `journalctl -u polysite-cms -n 100`: a migration error, a missing/weak secret under HTTPS, or the database not reachable |
| `EROFS` or "permission denied" writing | The unit's `ReadWritePaths` must include the folder (uploads, `.next`); the tree must be owned by `polysite` |
| Build runs out of memory | `next build` needs about 2 GB: add swap |
| 502 from the proxy | The services listen on 127.0.0.1:3001 and :3000; check `ss -ltnp` and the proxy's upstream lines |

## Tested

In a container, without systemd (`templates/bare-metal/test.sh`): both apps built from a clean source tree with `scripts/build.sh` on Node.js 24, started with the exact commands of the two units against PostgreSQL 16 behind the nginx configuration, and the first-run smoke test passed through it.
**Not run:** systemd itself (so the hardening options were never exercised), `install.sh` on a real server (apt, NodeSource, the PostgreSQL role, ufw), Apache and Caddy with this layout, certbot.
