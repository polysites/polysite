# Deployment options

Polysite is a set of container images (the CMS, the public site, a backup tool) plus a PostgreSQL database. Like Drupal and
WordPress, it can run in several ways; unlike them it ships as images, so every option below runs the same bits and differs in
what starts them, what puts HTTPS in front of them and where the state lives.

Pick the row that matches the people who will run it, not the one that sounds most modern. **One server with Docker Compose is the
reference path and what the pilot runs.** Everything else is an alternative with its own limits, written down honestly on its page.

| Option | Who it is for | Effort | Scaling | State (database, uploads) | High availability | Backups | Cost shape | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [Docker Compose + Caddy](/guide/deploying)<br>template `polysite-deploy/templates/compose-caddy` | Most people. One VM, automatic HTTPS | Low (an hour) | Vertical only: one copy of each app | Database managed or in a container; uploads on a Docker volume | None: a deploy has a short gap, a VM failure is an outage | Built in (nightly, test restore, off-site) | One small VM, flat | **Tested** (the reference, CI) |
| [Compose behind your own proxy](/guide/deploy/proxy): Apache, nginx, Traefik<br>templates `polysite-deploy/templates/compose-apache`, `-nginx`, `-traefik` | You already run one of them, or must | Low to medium | Same as above | Same as above | Same as above | Same as above | Same as above | **Tested** (all three, plain and HTTPS) |
| [A single VM / EC2 / any Linux server](/guide/deploy/vm)<br>template `polysite-deploy/templates/vm-cloud-init` (with an AWS Terraform skeleton) | You want a runbook from an empty server, or cloud-init | Medium (a few hours the first time) | Vertical: resize the machine | Managed database (RDS, Cloud SQL) or local; uploads on the disk | None, but snapshots and a managed database make recovery quick | Built in, plus disk snapshots | One VM plus an optional managed database | **Tested** in part: the cloud-init file is schema-checked and the steps ran on a clean Ubuntu container; no cloud account was used |
| [Kubernetes (Helm chart)](/guide/deploy/kubernetes)<br>chart `oci://ghcr.io/polysites/charts/polysite`, template `polysite-deploy/templates/kubernetes-helm` (Argo CD, Flux, kustomize examples) | A team that already runs a cluster and wants Polysite in it | Medium to high | Edge proxy scales freely; **the CMS and web app should stay at one replica today** (see the limits) | External PostgreSQL recommended; uploads on a persistent volume | Self-healing of a single replica, not active-active | Managed database backups, or the backup CronJob | A cluster you already pay for | **Tested** on a throwaway k3s cluster (install, migrations, upgrade, rollback) |
| [Bare metal / local server, no containers](/guide/deploy/baremetal)<br>template `polysite-deploy/templates/bare-metal` | Locked-down hosts, or someone who must see every process | High | Vertical | Local PostgreSQL; uploads on the disk | None | The backup scripts work against a host database | A server you own | **Tested** in part: both apps built and ran on Node 24 against PostgreSQL in a container; systemd units documented, not run under systemd |
| [Managed platforms](/guide/deploy/managed) (Cloud Run, App Runner, Fly.io, Render, Railway) | Teams that want no servers | Varies | Platform-specific | Needs a persistent disk or object storage that Polysite does not support yet | Platform-specific | Platform's own | Metered | **Documented only**; mostly "not yet", with the reasons |
| [Local development](/guide/getting-started) | Contributors, evaluators | Low | n/a | Containers | n/a | n/a | Free | **Tested** (the dev compose files) |

## How to choose

- **A single site or a few, an editor team, uptime measured in a monthly percentage:** Docker Compose on one VM. It is the
  least to learn and the least that can go wrong, and every guarantee in this documentation (deploy script, rollback, backups)
  was built for it.
- **Your company standard is Kubernetes:** the Helm chart. Read the limits first. It runs the stack safely as single replicas
  with self-healing and rolling image updates; it does **not** make Polysite horizontally scalable, because the application keeps some state in
  memory and uploads on a local disk (details in [Kubernetes](/guide/deploy/kubernetes#what-is-not-safe-with-more-than-one-replica)).
- **Apache or nginx is mandated:** keep the Compose stack and swap Caddy for [your proxy](/guide/deploy/proxy). The configurations
  reproduce the Caddyfile's routing, limits and headers, and are tested against the real stack.
- **No Docker allowed:** [bare metal](/guide/deploy/baremetal). You build from source and take over the jobs the images and the deploy script do.

## What every option has in common

| | |
| --- | --- |
| Images | `polysite-cms` (port 3001), `polysite-web` (port 3000) and `polysite-backup`, all non-root, with health endpoints at `/api/health`. The published images hold the **core only**; a site with plugins or themes builds its own images from source ([Plugins](/guide/plugins)). |
| Routing | Every public site domain: `/api/*` goes to the CMS, everything else to the web app. The admin domain goes to the CMS. Request bodies are capped (64 KB for form submissions, 100 MB elsewhere) and the CMS and admin answer with a few security headers. |
| Database | PostgreSQL 14 or newer in practice (the images are tested with 16). Migrations are additive and are applied by `payload migrate`, which every option runs for you or tells you to run. |
| Secrets | `PAYLOAD_SECRET` (never change it on a running install), the revalidation secret, the setup token and the database URL. With HTTPS the CMS refuses to start on placeholders. See [Securing an install](/guide/security). |
| Health | `GET /api/health` on both apps; the CMS version also checks the database. |
| State to protect | The database and the uploads folder (and `PAYLOAD_SECRET`, kept apart from backups). |
| Upgrades | Take a backup, apply the migrations from the new image while the old one serves, switch the images, check health. Roll back by putting the old images back: migrations are additive, so older code runs on the newer schema. |

## Hardening checklist (all options)

The full list is [Securing an install](/guide/security). In short, for any option: HTTPS everywhere with `SITE_SCHEME` and
`CMS_SCHEME` set to `https`; real secrets (32+ characters, `openssl rand -base64 48`); a setup token for the first administrator;
only ports 80 and 443 reachable from outside (the apps' ports 3000 and 3001 must never be public: the sign-in limit trusts the address the proxy adds);
containers or services running as an unprivileged user; an off-site, encrypted backup that you have restored at least once.

## Pages in this section

- [Docker Compose + Caddy](/guide/deploying), the reference path
- [Your own reverse proxy: Apache, nginx, Traefik](/guide/deploy/proxy)
- [A single VM, EC2 and other clouds](/guide/deploy/vm)
- [Kubernetes with Helm](/guide/deploy/kubernetes)
- [Bare metal without containers](/guide/deploy/baremetal)
- [Managed platforms](/guide/deploy/managed)

Every deployment artifact other than the reference Compose stack lives in the
[polysite-deploy](https://github.com/polysites/polysite-deploy) repository, with how each one was tested and the commands to repeat the tests.

## The polysite-deploy repository

The core repository holds the reference deployment (the Compose files, the `Caddyfile`, the deploy script and the backup tool) and publishes the **container images**. Everything for
deploying another way is in one separate repository, [`polysites/polysite-deploy`](https://github.com/polysites/polysite-deploy): clone it, or copy the folder for your platform.

| Folder | Contents | Tested |
| --- | --- | --- |
| `templates/compose-caddy` | Caddy, CMS, web, PostgreSQL, backups; `init.sh` writes `.env` with random secrets | Full stack and smoke test from images |
| `templates/compose-nginx`, `-apache`, `-traefik` | The same with another proxy and certbot or Traefik's ACME | nginx and Apache full stack; the proxy files themselves (all three, plain and HTTPS) by `proxy/test`; Traefik template: files and compose validity |
| `proxy/` | The Caddyfile's routing, limits and headers as nginx, Apache and Traefik configurations, with Compose overrides | Each proxy in front of the real stack, plain and HTTPS |
| `kubernetes/helm/polysite` | The Helm chart, also published as `oci://ghcr.io/polysites/charts/polysite` | Linted and schema-checked on every change; installed on a throwaway k3s |
| `templates/kubernetes-helm` | Values, secret script, Argo CD, Flux and kustomize examples | Values render against the chart; Argo CD, Flux and kustomize not run |
| `templates/vm-cloud-init` | `cloud-init.yaml`, AWS EC2 Terraform | Schema, shellcheck, files on a clean Ubuntu; `terraform validate`; never applied |
| `templates/bare-metal` | systemd units, env file, build and install scripts, proxy snippets | Built and run on Node 24 against PostgreSQL in containers; not under systemd |

## Known issue that affects every option: Live Preview on a real domain

The public site's `Content-Security-Policy: frame-ancestors` lists the admin origin it was **built** with (`http://admin.localhost` in the published images), not the `CMS_DOMAIN` you set at run time (measured, see
[Known Issue #71](/architecture)). On a real domain the admin cannot frame the site, so Live Preview is blocked until the web image is built with your admin domain or the header is rewritten in the proxy. Nothing else is affected.
