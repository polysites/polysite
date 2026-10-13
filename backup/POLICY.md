# Polysite backup policy

This is the backup policy for every Polysite installation, whichever way it is deployed (Docker Compose, a single VM, Kubernetes,
bare metal). The backup tool in this folder implements it. A deployment that does less than this is not following the policy.

How to use the tool, turn on the off-site copy and restore: [Backups and restore](../docs/guide/backups.md).

## 1. What is protected

| Data | Protected by | Notes |
| --- | --- | --- |
| The database (pages, sites, users, roles, settings, form submissions) | the nightly archive | |
| Uploaded media | the nightly archive | |
| `PAYLOAD_SECRET` | **never** in the backup archive | Kept by the operator, apart from the backups. Stored credentials (an SMTP password, a webhook URL) are encrypted with a key derived from it, so a restore onto a new server needs the same secret |
| The backup passphrase | **never** in the backup archive | Kept with the secret above. Without it encrypted archives cannot be opened by anyone |
| Source code, themes, plugins | git, not this tool | The repositories are the backup |

## 2. Objectives

| | Target | Where it comes from |
| --- | --- | --- |
| **Recovery point** (most data you can lose) | 24 hours | One backup per night. A deploy takes an extra backup first, so a failed upgrade loses nothing |
| **Recovery time** (how long a restore takes) | **not yet measured** | The restore itself is a single script (`restore.sh`) and is rehearsed weekly by `verify.sh`, but no timed full-size drill has been recorded. Record the first one here |

An operator who needs a shorter recovery point than 24 hours has to add continuous archiving (WAL) of PostgreSQL. The backup tool does not provide it.

## 3. Schedule and retention

| | Rule |
| --- | --- |
| Frequency | Every night at 03:17 UTC, and once at first start |
| Before changes | `deploy/deploy.sh` takes a backup, and test-restores it, before applying migrations |
| Retention | Every backup for 7 days, Sundays for 4 weeks, the 1st of the month for 6 months |
| Floor | The newest backup is never deleted, whatever the rules say |
| Off-site retention | 90 days by default (`BACKUP_REMOTE_KEEP_DAYS`) |

## 4. Verification (a backup that was never restored is not a backup)

1. **Every run:** the dump is listed and the media archive is read after writing; a checksum file sits beside each archive.
2. **Every Sunday:** a full restore into a scratch database, comparing row counts with the manifest (`verify.sh`).
3. **Health:** the backup service reports healthy only while the last successful backup is under 36 hours old. A failing run requests the
   monitoring address's `/fail` URL when `BACKUP_PING_URL` is set.
4. **Operator drills:** before going live, and after every major upgrade, restore the newest backup onto a separate machine and open
   the site. Write down how long it took.

## 5. Protection

- Archives are readable by their owner only (mode 600).
- **An off-site copy is only ever an encrypted one.** `BACKUP_ENCRYPTION_PASSPHRASE` must be at least 16 characters and not a placeholder.
  Without it Polysite refuses to send anything off the machine, fails the run, and reports unhealthy until the configuration is fixed.
- At least one copy must be **off the machine** that runs Polysite, in a different failure domain (another provider, region or account).
  A backup on the same disk protects from a bad deploy, not from losing the server.
- Anyone who can read the backups can read all the site data. Give the off-site destination its own credentials with write access only
  where the destination supports it, and keep them out of the Polysite environment file of other systems.

## 6. What each deployment must provide

| Deployment | How the policy is met |
| --- | --- |
| Docker Compose (reference path) | The `backup` service in `docker-compose.yml` and `docker-compose.prod.yml`, started with the stack. Set the off-site remote and passphrase in `.env` |
| Single VM, cloud-init | The same compose stack, so the same `backup` service. Set the off-site remote and passphrase in `.env` |
| Kubernetes | The Helm chart's backup CronJob (`backups.enabled`) runs the same image, so the same rules apply: the image itself refuses an off-site copy without a strong passphrase. Put the settings in the Secret named by `backups.existingSecret`. Back up the media volume another way if you do not use the CronJob |
| Bare metal | Run the scripts in this folder from cron or a systemd timer against the host database. They are the same scripts as the image |
| Managed database (Cloud SQL, RDS) | The provider's snapshots **add to** this policy; they do not replace the media archive or the verification steps |

## 7. Responsibilities

| Who | What |
| --- | --- |
| Operator | Sets the off-site destination and passphrase, keeps `PAYLOAD_SECRET` and the passphrase safe, runs the drills in section 4, reads the monitoring alert |
| The tool | Takes, checks, prunes and (when asked) restores backups, and fails loudly instead of quietly skipping a step |
| Polysite maintainers | Keep `tests/backup` passing: encryption rules, off-site refusal, tamper detection, restore of database and media |

## 8. Changing this policy

The numbers in sections 3 to 5 are defaults in `backup/entrypoint.sh` (schedule), `backup/prune.sh` (retention), `backup/healthcheck.sh` (36 hours) and
`backup/lib.sh` (passphrase length), and each can be overridden with an environment variable (see [Backups and restore](../docs/guide/backups.md)).
Change the default in the code and in this file in the same commit, and add the change to `CHANGELOG.md` under "Upgrade notes" when it affects an existing install.
