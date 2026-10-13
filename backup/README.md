# Backup

The backup tool Polysite ships as the `polysite-backup` image: a nightly database dump and media archive, a check that the archive can be read,
retention, an optional encrypted off-site copy, and a weekly test restore.

- **[POLICY.md](POLICY.md)**: the backup policy every deployment follows (what is protected, the objectives, retention, verification, protection).
- **[Backups and restore](../docs/guide/backups.md)**: how to turn it on, set up the off-site copy and restore.
- **Tests**: [`../tests/backup`](../tests/backup), run with `sh tests/backup/run.sh`.

| File | Job |
| --- | --- |
| `Dockerfile`, `entrypoint.sh` | The image and its cron schedule |
| `backup.sh` | One backup run: dump, media archive, manifest, checksums, off-site copy |
| `prune.sh` | Retention |
| `verify.sh` | Open an archive, restore it into a scratch database, compare row counts |
| `restore.sh` | Put an archive back |
| `healthcheck.sh` | Healthy while the last successful backup is recent |
| `lib.sh` | Shared helpers, including the passphrase rules |
