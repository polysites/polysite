# Backups and restore

The rules every installation follows (objectives, retention, verification, protection) are the
[backup policy](https://github.com/polysites/polysite/blob/main/backup/POLICY.md). This page is how to run it.

Polysite keeps two things worth protecting: the **database** (pages, sites, users, roles,
settings) and the **uploaded media**. A backup container takes both every night, checks that
it can read what it wrote, trims old copies, and can send a copy off the machine. A weekly
job goes further and does a full test restore into a scratch database, because a backup you
have never restored is only a hope.

## What you get

| | |
| --- | --- |
| **When** | Every night at 03:17 (UTC), and once straight away on a new install |
| **What** | One archive per run: a database dump, the media files, and a manifest with checksums and row counts |
| **Where** | `./backups` next to your `docker-compose.yml` (set `BACKUP_HOST_DIR` to move it) |
| **Kept** | Every backup for 7 days, Sundays for 4 weeks, the 1st of each month for 6 months. The newest backup is never deleted |
| **Checked** | The dump is listed and the media archive read after writing, a checksum file sits beside each archive, and every Sunday a full restore into a scratch database compares row counts |
| **Protected** | Archives readable by their owner only, optional encryption (required for an off-site copy), optional off-site copy, optional monitoring ping |

The backup service starts with the rest of the stack (`docker compose up -d`). Check on it any
time:

```bash
docker compose logs --tail 20 backup
ls backups/
```

It reports **healthy** in `docker compose ps` while the last successful backup is under 36
hours old, and **unhealthy** after that.

## Two things that matter more than the schedule

**1. A backup on the same machine is not enough.** It protects you from a bad deploy, a deleted
page or a corrupted table. It does not protect you from losing the server or its disk. Set up
the off-site copy below, or copy the `backups` folder somewhere else on a schedule of your own.

**2. Keep `PAYLOAD_SECRET` somewhere safe, apart from the backups.** Stored credentials, such
as an SMTP password or a webhook URL that a plugin stores, are encrypted with a key derived from it.
A restore onto a new server needs the same secret to read them. If you encrypt your backups,
keep the passphrase there too: without it the archives can't be opened, by you or anyone else.

## Turn on the off-site copy

Backups are copied with [rclone](https://rclone.org), which speaks to Google Cloud Storage,
Amazon S3, Backblaze, an SFTP server and many more. Set the destination in `.env`:

```bash
# a bucket and folder on the remote called "offsite"
BACKUP_RCLONE_REMOTE=offsite:my-bucket/polysite
# credentials for that remote, as rclone environment variables, for example S3:
RCLONE_CONFIG_OFFSITE_TYPE=s3
RCLONE_CONFIG_OFFSITE_PROVIDER=AWS
RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID=...
RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY=...
RCLONE_CONFIG_OFFSITE_REGION=us-east-1
# optional: delete off-site copies older than this many days (default 90)
BACKUP_REMOTE_KEEP_DAYS=90
```

**An off-site copy is only ever an encrypted one.** Set `BACKUP_ENCRYPTION_PASSPHRASE` (below) to a strong
passphrase: at least 16 characters, not a placeholder such as "changeme", not a few repeated characters.
If `BACKUP_RCLONE_REMOTE` is set without one, Polysite refuses to send anything off the machine:

- the backup run still keeps its local archive (readable by its owner only), then **fails** with
  `Off-site copy REFUSED ...` in the log, and requests the monitoring address's `/fail` URL;
- the backup container reports **unhealthy** in `docker compose ps` until the configuration is fixed, and
  says why at start-up;
- `verify.sh` fails with the same reason, and `backups/OFFSITE_STATUS` says `refused`;
- nothing reaches the bucket, not even the checksum file.

`polysite init` generates a strong passphrase for you. If you set up the remote by hand, add one to `.env` first.

Use a bucket that only this job can write to, and turn on the provider's own versioning or
object lock if you want protection against someone deleting the backups. If the copy fails,
the run is reported as failed. `backups/OFFSITE_STATUS` records the last attempt (`ok`, `refused`
or `failed`, with the time).

Run a backup now to try it:

```bash
docker compose exec backup /opt/backup/backup.sh
```

## Encrypt the archives

Set a passphrase and every new archive is encrypted (AES-256-CBC, key derived with PBKDF2, 200,000 iterations) before it is stored or copied:

```bash
BACKUP_ENCRYPTION_PASSPHRASE=<the output of: openssl rand -base64 32>
```

Backups contain user accounts (password hashes included), form submissions and your content, so
encrypt anything that leaves the machine; for an off-site copy it is required (see above). Restoring and verifying use the same
variable, and fail clearly when it is missing or wrong. Archives (and the safety dump a restore takes first) are written readable by
their owner only, whatever you do about encryption. Without a passphrase, local archives are plain files: protect the folder as
you would the database.

## Get told when it breaks

Set `BACKUP_PING_URL` to a monitoring address (healthchecks.io works, and so do others that
follow its convention). Polysite requests that address after each successful backup and
`<address>/fail` after a failure, so you hear about a quiet failure within a day. Without it,
the only signs are the container's health state and its log.

## Restore

A restore **replaces** the live database contents and puts the media files back, so do it
deliberately. Stop the app so nothing writes while it runs, restore, then start it:

```bash
docker compose stop web cms
docker compose --profile restore run --rm restore latest --yes
docker compose start cms web
```

- On a production server the commands take the production compose file and the deployment's env
  files, as in [Deploying](/guide/deploying#rolling-back).
- Replace `latest` with a file name from `backups/` to restore an older one.
- `--db-only` or `--media-only` restores just one half.
- The archive's checksum is checked first, and nothing is touched if it doesn't match.
- The database is restored in a single transaction: if it fails, the database is left as it was.
- Before restoring, the current database is saved to `backups/pre-restore-<time>.dump`, so a
  restore of the wrong backup can itself be undone.
- Media files that aren't in the backup are left alone, not deleted.

For an encrypted backup, `BACKUP_ENCRYPTION_PASSPHRASE` must be set in `.env`, the same one it was made with. To restore an
archive you fetched from the off-site bucket, copy it (the `.tar.enc` file, and its `.sha256` if you have it) into `backups/` and
restore it by name.

### Restoring onto a new server

1. Install Polysite on the new server and put the **same** `.env` there, with the same
   `PAYLOAD_SECRET`.
2. Start only the database (`docker compose up -d db`). The restore creates the
   tables itself, so the stack doesn't need to have run yet.
3. Copy the archive into `backups/` and run the restore command above.
4. Start everything (`docker compose up -d`) and sign in. You'll go to the normal login, not the setup page, because
   the restored database already has users.

## Prove it works

Run a restore check by hand at any time. It never touches the live data:

```bash
docker compose exec backup /opt/backup/verify.sh latest
```

It unpacks the archive, loads it into a throwaway database and checks that every table has the
row count recorded when the backup was taken. The same check runs every Sunday by itself.
Change or switch it off with `BACKUP_VERIFY_SCHEDULE` (`off` disables it). It needs the database
user to be allowed to create a database; if yours can't, the log says so.

## Settings

All optional, set in `.env`.

| Setting | Default | |
| --- | --- | --- |
| `BACKUP_HOST_DIR` | `./backups` | Where archives are kept on the host |
| `BACKUP_SCHEDULE` | `17 3 * * *` | When to back up (cron syntax, UTC) |
| `BACKUP_VERIFY_SCHEDULE` | `47 4 * * 0` | When to test-restore the latest backup, or `off` |
| `BACKUP_KEEP_DAILY` / `_WEEKLY` / `_MONTHLY` | 7 / 4 / 6 | Retention: days, weeks, months |
| `BACKUP_ENCRYPTION_PASSPHRASE` | none | Encrypt archives. **Required (16+ characters, not a placeholder) when `BACKUP_RCLONE_REMOTE` is set** |
| `BACKUP_RCLONE_REMOTE` | none | Off-site destination. Refused without a strong passphrase |
| `BACKUP_REMOTE_KEEP_DAYS` | 90 | How long off-site copies are kept |
| `BACKUP_PING_URL` | none | Monitoring address |
| `POSTGRES_MAJOR` | 16 | The major version of your Postgres server |

**`POSTGRES_MAJOR` must match your database.** A dump taken with a newer client than the server
can't be loaded back (Postgres 17 writes a setting that 16 rejects), and an older client
refuses to dump a newer server. The bundled database is version 16. If you use a managed
database on another version, set this to its major version.

## What is not backed up

- **Redis.** It holds a queue that isn't used for anything important yet.
- **Caddy's certificates.** They are reissued automatically.
- **Your `.env` file and `PAYLOAD_SECRET`.** Keep these yourself, as above.
- **Themes and plugins.** They live in their own git repositories.

If you run on Google Cloud SQL, also switch on its own automated backups and point-in-time
recovery. They cover the database in a way a nightly dump can't (restoring to a specific
minute). This job remains the one that covers the media files and gives you a copy you hold.

## Backups and people's right to erasure

A backup holds a copy of everything that was in the database that day, including form
submissions that were deleted later because someone asked. A restore brings them back.
After any restore, run the re-apply command to delete again anyone who asked to be erased
since the backup was taken; see [Privacy and consent](/guide/privacy#erasure-and-backups).
Keeping backups no longer than you need to also limits how long a deleted record can linger.
