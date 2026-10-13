# Managed platforms (Cloud Run, App Runner, Fly.io, Render, Railway)

**Status: documented only. Nothing here was run, and for most platforms the honest answer today is "not yet".** This page lists what Polysite needs from a platform so you can judge a fit,
and what each platform imposes. If you want "no servers to look after", the closest tested option is a [single VM with cloud-init](/guide/deploy/vm) and a managed database.

## What Polysite needs from a platform

| Need | Why | Consequence |
| --- | --- | --- |
| **A writable persistent disk** for the CMS | Uploads are stored on a local disk; there is no object-storage adapter yet | A platform without volumes cannot hold uploads. A volume usually means **one instance** |
| **A long-running process** | The CMS runs a 30-second timer for scheduled publishing and background jobs (and other timers) | Scale-to-zero or CPU-only-during-requests breaks scheduled publishing and webhook retries |
| **Exactly one CMS and one web instance** | State in memory (see [the Kubernetes limits](/guide/deploy/kubernetes#what-is-not-safe-with-more-than-one-replica)) | No autoscaling out; platforms that force several instances are out |
| **Two services behind one host routing** | `/api/*` to the CMS, everything else to the web app; the admin on its own host | A platform router or a proxy container in front (the [edge configuration](/guide/deploy/proxy)) |
| **PostgreSQL 14+ with `CREATEDB`** | Migrations, backups and the test restore | A managed Postgres add-on works |
| **A migration step** | `payload migrate` before the new version serves | A release/pre-deploy command or a job; otherwise the CMS migrates at boot |
| **Health checks** | `GET /api/health` on port 3001 (CMS) and 3000 (web) | Supported everywhere below |
| No websockets | The admin and Live Preview do not use them | Nothing to configure |

## Platform by platform

| Platform | Fit | Constraints and what would be needed |
| --- | --- | --- |
| **Google Cloud Run** | Not supported yet | Container file system is ephemeral (uploads lost). A Cloud Storage volume mount (gcsfuse) exists but was not tried. Needs instance-based billing with always-allocated CPU, `min-instances=1` and `max-instances=1` for the job timer. Cloud SQL integration is good; migrations fit a Cloud Run Job. The pilot's database is Cloud SQL, the compute is a VM for these reasons |
| **AWS App Runner** | Not supported | No persistent disk, no volume mounts. Uploads cannot be kept. Use EC2 or ECS with EFS instead |
| **AWS ECS/Fargate with EFS** | Possible, not tried | EFS gives the shared uploads volume (NFS latency and locking caveats); one task per service; RDS for the database; the migration as a one-off task; an ALB with host rules in place of the proxy. No Terraform or template exists yet |
| **Fly.io** | Plausible, not tried | A Fly volume attaches to one machine: one machine for the CMS with the volume at `/repo/apps/cms/media`, one for the web app, Fly Postgres or Neon; private networking (`.internal`) between them; a `release_command` can run `npx payload migrate`; an edge proxy app or Fly's routing for the host rules. Machines that stop when idle must be disabled |
| **Render** | Plausible, not tried | A web service with a persistent disk (one instance, and a deploy has downtime because a disk-backed service cannot overlap), a second service for the web app, Render Postgres, a pre-deploy command for migrations, host routing through a small proxy service. Auto-scaling must stay off |
| **Railway** | Plausible, not tried | A service per app with a volume on the CMS, the Postgres plugin, a pre-deploy command for migrations; a proxy service for the host rules |

Why not simply try them? Each needs a paid account, and none of them removes the two hard limits above (uploads on a disk, one instance); they only move them. The right fix is in the application (an object-storage media adapter, shared cache and rate-limit state),
after which scale-to-zero platforms become realistic. Until then this page stays a checklist, and the platforms are listed under "not supported yet" in the overview.

## If you try one anyway

Use the published images (`ghcr.io/polysites/polysite-cms|web:vX.Y.Z`, port 3001 and 3000, non-root, `/api/health`), set the same environment variables as in [Configuration](/guide/configuration) (`DATABASE_URL`, `PAYLOAD_SECRET`, `REVALIDATE_SECRET` and `NUXT_REVALIDATE_SECRET` equal, `CMS_DOMAIN`, `SITE_DOMAIN`, `*_SCHEME=https`, `POLYSITE_SETUP_TOKEN`,
`NUXT_API_BASE_INTERNAL` and `NUXT_REVALIDATE_URL` pointing at the other service's private address), pin one instance of each, keep the CMS's uploads on a volume, back the database and the volume up off the platform, and run the [security checklist](/guide/security).
