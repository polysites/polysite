# Kubernetes (Helm)

Polysite runs on Kubernetes through a Helm chart. Read this page's limits before you choose it: the chart gives you self-healing, rolling image
updates and an ingress, but **not horizontal scaling of the CMS or the web app**. If you only want "an orchestrator because we have one", that is fine. If you want to scale out
to several replicas, today that is not safe (details below). The reference path ([Docker Compose on one server](/guide/deploying)) is simpler and does the same job.

The chart is `kubernetes/helm/polysite` in the polysite-deploy repository and is published as an OCI package, `oci://ghcr.io/polysites/charts/polysite`.
A ready-to-copy deployment repository (values, secret script, Argo CD, Flux and kustomize examples) is the template **`polysite-deploy/templates/kubernetes-helm`**
.

## What it creates

| Resource | What it is |
| --- | --- |
| `Deployment` cms, web | One replica each. Non-root (uid 1000), all capabilities dropped, no privilege escalation, a read-only root file system (writable: uploads, Next's cache, `/tmp`), no service-account token, `RuntimeDefault` seccomp, the same hardening as `docker-compose.prod.yml`. Start-up, readiness and liveness probes on `/api/health` |
| `Job` migrate | A Helm hook from the **new** image: first the migration guard (refuses a migration that drops or deletes data, the same check `deploy.sh` runs), then `payload migrate`. The old pods keep serving while it runs; a failed Job stops the upgrade before any pod is replaced |
| `Deployment` edge | nginx with the routing, request-size limits and security headers of the Caddyfile ([the proxy guide](/guide/deploy/proxy)), fed by the Ingress. This is why the install behaves the same whichever ingress controller you have |
| `Ingress` | Every site host and the admin host to the edge proxy, TLS from cert-manager (`cert-manager.io/cluster-issuer`) or your own Secret |
| `PersistentVolumeClaim` media | Uploads (`helm.sh/resource-policy: keep`: `helm uninstall` leaves your files) |
| `ConfigMap`, `Secret` | Settings, and a Secret you made (`secrets.existingSecret`, recommended) or one built from values (tests only) |
| Optional | `StatefulSet` PostgreSQL (demo), Redis (unused by the app yet), backup `CronJob`, `NetworkPolicy` set, `PodDisruptionBudget`, `HorizontalPodAutoscaler` |

## Install

Prerequisites: Kubernetes 1.27+, an ingress controller, cert-manager with a ClusterIssuer (or your own certificate Secret), PostgreSQL reachable from the cluster (the
database user needs `CREATEDB`; Cloud SQL, RDS, or your own), two DNS names at the ingress.

```bash
kubectl create namespace polysite
kubectl -n polysite create secret generic polysite-secrets \
  --from-literal=PAYLOAD_SECRET="$(openssl rand -base64 48)" --from-literal=REVALIDATE_SECRET="$(openssl rand -base64 48)" \
  --from-literal=POLYSITE_SETUP_TOKEN="$(openssl rand -base64 32)" --from-literal=DATABASE_URL='postgres://user:pass@host:5432/polysite?sslmode=require'
helm install polysite oci://ghcr.io/polysites/charts/polysite --version 0.1.0 -n polysite \
  --set domains.sites={www.example.org} --set domains.admin=admin.example.org \
  --set secrets.existingSecret=polysite-secrets --set ingress.className=nginx --set ingress.tls.clusterIssuer=letsencrypt-prod
```

Then open `https://<admin>/admin` and use the setup token. `values.yaml` of the chart documents every option. Plugins and themes: build your own images
(`kubernetes/derived-image/build.sh`; "FROM the published image" cannot work, because they are compiled in at build time) and set `image.registry` and `image.tag`.

## What is NOT safe with more than one replica

The chart **refuses** `cms.replicaCount > 1` and `web.replicaCount > 1` (and autoscaling) unless you set `cms.allowMultiReplica` / `web.allowMultiReplica`. Findings from reading the code and from running the chart:

| What | Why it breaks with two or more copies | Status |
| --- | --- | --- |
| **Uploaded files** (CMS) | They are written to the local disk (`staticDir`); there is **no S3 storage adapter**. Two pods need a `ReadWriteMany` volume (NFS, EFS, CephFS, Filestore, Azure Files), with all its locking and latency caveats. One pod on a `ReadWriteOnce` volume is fine | Read from the code |
| **Page caches and limits** (web) | The Nuxt app keeps its route cache and its rate limits in each process; a publish makes the CMS call `NUXT_REVALIDATE_URL`, which a Service delivers to **one** pod. In a two-pod test a published change was visible on **both** pods within 2 seconds (the cache lifetime is short, so this was not a problem there), but the per-process limits and the rest of the state were not examined, hence the acknowledgement | **Measured**: one scenario (`kubernetes/test/run.sh`); the rest read from the code |
| **Role and permission changes** (CMS) | The role matrix is cached in memory (`rbac/permissionCache.ts`) and refreshed only by the process that handled the change; other replicas keep the old permissions until restarted. Revoking a role may not take effect everywhere | Read from the code |
| **Sign-in and password-reset limits** (CMS) | Counted per process (`auth/ipThrottle.ts`): N replicas allow N times the attempts | Read from the code |
| **Form spam limits, captcha replay protection** (CMS) | Per-process maps (`forms/spam.ts`, `forms/altcha.ts`): a solved captcha can be replayed against another replica; limits multiply | Read from the code |
| **Scheduled publishing and the job runner** | Every replica starts a 30-second timer that runs due jobs (`jobs/runner.ts`). Payload locks a job while it runs, so a job is not run twice, but there is **no single-runner guarantee** and the data-retention purge and plugin timers (webhook retries, email log purge, notifications) also run in every replica. They were written to be harmless when repeated; that was not tested under load | Read from the code |
| **First-run setup** | Two replicas starting together on an empty database both try to create the three default roles; the loser fails on the unique name and restarts. Start with one replica, scale after setup | Read from the code |
| **Migrations on boot** | `prodMigrations` runs in every pod's start-up (Payload's production behaviour), not only in the Job. After the Job there is nothing left to apply, so this is harmless; without the Job (`migrations.job.enabled=false`) several pods migrate at once | Verified in Payload's adapter |

What does scale: the **edge proxy** (stateless; `edge.replicaCount`, `edge.autoscaling`), the ingress controller, PostgreSQL (your side).
What "high availability" means here: Kubernetes restarts a failed pod and reschedules it when a node dies, and updates roll without dropping the site (web: surge, no unavailable;
CMS: `Recreate` while the uploads volume is `ReadWriteOnce`, a gap of the CMS's start-up time, about a minute). It is **not** active-active.
The real fix for horizontal scaling is in the application (shared cache invalidation, an object-storage media adapter, an out-of-process rate limiter and job lock); until then, size the pods up, not out.

## Upgrades and rollback

`helm upgrade polysite oci://ghcr.io/polysites/charts/polysite --version <new> -n polysite --reuse-values` (or your values file). The Job migrates, then the pods roll.
Read the release's *Upgrade notes*. `helm rollback polysite <revision>` puts the previous images back; migrations are additive, so the previous version runs on the newer schema
(a migration marked `polysite:allow-destructive` is refused unless `migrations.allowDestructive=true`, and then a rollback needs the pre-upgrade backup). Tested: install, upgrade to a second version, rollback.
A hook note: the Job reads its own copies of the ConfigMap and Secret (`<release>-migrate`) because hooks run before the release's resources exist; those two small objects stay after an upgrade.

## Backups and restore

A managed database has point-in-time backups: use them. The **media volume** has none unless you add them: set `backups.enabled=true` (a CronJob running the backup image's `backup.sh`:
a dump plus the uploads, checksums, optional encryption, pruning, and an off-site copy only if encrypted, through rclone: S3, GCS and others) with `backups.existingSecret`
holding `BACKUP_RCLONE_REMOTE`, `RCLONE_CONFIG_*` and `BACKUP_ENCRYPTION_PASSPHRASE`, or snapshot the volume with your CSI driver. With a `ReadWriteOnce` media volume the job is scheduled on the CMS pod's node.
Tested: the CronJob ran a backup from a manual Job in the k3s test. **Restore** is a manual, deliberate act: scale `cms` and `web` to 0, run a one-off pod from the backup image with the archive and the media volume mounted
(`restore.sh <archive> --yes`; see [Backups](/guide/backups)), scale back up. Practise it on a copy first.

## Secrets, TLS, health, hardening

- **Secrets:** a Secret you create (External Secrets, Sealed Secrets, SOPS). The chart never generates a secret itself: a regenerated `PAYLOAD_SECRET` would make stored credentials unreadable.
- **TLS:** cert-manager annotations on the Ingress, or `ingress.tls.secretName`. With ingress-nginx the preset opens the 1 MB body limit and the 60 s timeouts (the edge proxy applies the real 64 KB / 100 MB limits). For other controllers set the same by hand.
- **The visitor's address:** the sign-in limit reads the last `X-Forwarded-For` entry. The edge proxy takes it from the ingress controller only when the request comes from `edge.trustedProxies` (RFC 1918 by default). If your load balancer hides client addresses (a `LoadBalancer` Service with `externalTrafficPolicy: Cluster` shows node addresses), one visitor's wrong passwords lock out the others: use `Local` or the PROXY protocol, and check.
- **Health:** `/api/health` on both apps (probes use it); the CMS answers 503 when the database does not. Liveness is deliberately slow (3 minutes) so a database outage does not restart the CMS in a loop.
- **Hardening:** see the table above, plus `networkPolicy.enabled=true` for a default-deny example (tested on k3s) and the [security checklist](/guide/security).

## Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `helm install` fails with "cms.replicaCount > 1 is refused" | Intended: read the table above, then set `allowMultiReplica` |
| The Job `…-migrate` failed | `kubectl -n polysite logs job/<release>-polysite-migrate -c migration-guard` (a destructive migration) or `-c migrate`. Nothing was switched; fix and `helm upgrade` again |
| CMS pod `Pending` after an upgrade | The `ReadWriteOnce` claim is held by the old pod on another node; the default `Recreate` strategy avoids this, a custom `RollingUpdate` does not |
| Everyone is "too many sign-in attempts" | The address problem above |
| 413 on every upload | Your ingress controller's body limit (ingress-nginx: `proxy-body-size`) |
| Live Preview frame blocked | The web app's CSP lists the admin origin it was **built** with, not the run-time `CMS_DOMAIN` ([Known Issue #71](/architecture)); rebuild the web image or rewrite the header in the proxy |
| `helm install --wait` times out with `backups.enabled` | The unused backup volume stays Pending on a WaitForFirstConsumer storage class; install without `--wait`, or set `backups.persistence.existingClaim` |

## Tested

`kubernetes/test/lint.sh` (no cluster, runs in CI): `helm lint --strict`, `helm template | kubeconform` for three value sets, and that the chart refuses what it must.
`kubernetes/test/run.sh` (a throwaway k3s v1.31 in Docker): install with an existing Secret and the demo database, the migration Job as a hook, hardened pods with read-only root file systems,
the whole first-run smoke test and the proxy checks through k3s's Traefik Ingress and the edge proxy, upgrade, rollback, the backup CronJob, the NetworkPolicy set, two web replicas.
**Not tested:** cert-manager and real certificates, other ingress controllers, RWX volumes, a managed PostgreSQL, EKS/GKE/AKS specifics, Argo CD, Flux, kustomize with OCI charts.
