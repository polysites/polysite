# A single VM: EC2, Compute Engine, DigitalOcean, Hetzner or any Linux server

One server running the [Compose stack](/guide/deploying) is the recommended way to run Polysite. This page is the runbook from an empty Ubuntu server to a running install,
and a [cloud-init file](https://github.com/polysites/polysite-deploy/blob/main/templates/vm-cloud-init/cloud-init.yaml) that does the same without you logging in.
Copy-ready repositories: **`polysite-deploy/templates/vm-cloud-init`** (cloud-init, plus a Terraform skeleton for EC2) and **`polysite-deploy/templates/compose-caddy`** (the stack itself).

## Sizing

| | Minimum | Comfortable |
| --- | --- | --- |
| CPU, memory | 2 vCPU, 2 GB (add the swap file below) | 2 vCPU, 4 GB (a few sites, editors working) |
| Disk | 20 GB | 40 GB or more: images (~3 GB), the database, uploads, and the local backups folder |
| Network | ports 22 (from you), 80, 443 | the same |

The CMS needs about 1 GB while it starts. Watch the disk: images, backups and Docker's logs fill it first.

## The runbook (Ubuntu 22.04 or 24.04 LTS)

```bash
# 1. Updates, unattended security updates, a firewall
sudo apt-get update && sudo apt-get -y upgrade
sudo apt-get install -y ca-certificates curl gnupg ufw unattended-upgrades
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw --force enable
sudo systemctl enable --now unattended-upgrades      # security updates only; it does not reboot by itself

# 2. Swap, if the machine has under 4 GB
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 3. Docker Engine from Docker's own repository (compare the key's fingerprint with docs.docker.com: 9DC8 5822 9FC7 DD38 854A E2D8 8D81 803C 0EBF CD88)
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 4. DNS: an A (and AAAA) record per hostname -> the server, BEFORE the first start (Caddy asks Let's Encrypt on first use)

# 5. The stack: either the template (copy of polysite-deploy `templates/compose-caddy`) or the core's docker-compose.prod.yml with deploy/deploy.sh
git clone <your deployment repository> /opt/polysite && cd /opt/polysite
./init.sh www.example.org admin.example.org     # .env with random secrets; prints the setup token
docker compose up -d
```

TLS is automatic (Caddy). To start the stack at boot and after a Docker restart, the containers already have `restart: unless-stopped`; a systemd unit that runs `docker compose up -d`
(`templates/vm-cloud-init/files/polysite.service`) additionally brings the whole project up after a reboot even if a container was removed. Open `https://<admin domain>/admin`, enter the setup token.

## Backups to object storage

The backup container takes a nightly dump plus the uploads into `./backups`. Add the off-site copy in `.env` (it is only ever sent encrypted; a missing or weak passphrase makes it refuse and report unhealthy):

```bash
BACKUP_RCLONE_REMOTE=offsite:my-bucket/polysite
BACKUP_ENCRYPTION_PASSPHRASE=<16+ characters, stored somewhere other than this server>
RCLONE_CONFIG_OFFSITE_TYPE=s3
RCLONE_CONFIG_OFFSITE_PROVIDER=AWS
RCLONE_CONFIG_OFFSITE_ACCESS_KEY_ID=...  RCLONE_CONFIG_OFFSITE_SECRET_ACCESS_KEY=...  RCLONE_CONFIG_OFFSITE_REGION=us-east-1
```

On AWS give the key only `s3:PutObject`, `s3:ListBucket` and `s3:DeleteObject` on that bucket; use a bucket lifecycle rule as a second line of retention. Disk snapshots (EBS, Persistent Disk, DigitalOcean/Hetzner snapshots) are a good extra, not a replacement: practise a [restore](/guide/backups) onto a fresh VM.

## Upgrades and rollback

Compose: change the three image tags (or merge the dependency bot's pull request), `docker compose pull && docker compose up -d`; roll back by putting them back (migrations are additive). For a backup with a test restore, migrations in a one-off container, health gates and automatic rollback around the upgrade,
use the core's [`deploy/deploy.sh`](/guide/deploying) with `docker-compose.prod.yml` instead.

## Cloud notes

- **AWS EC2:** security group inbound 22 (your address only), 80, 443; an Elastic IP so DNS survives a stop; gp3 root volume (encrypted); IMDSv2 only; Ubuntu AMI. **RDS PostgreSQL** instead of the container: set `DATABASE_URL` to it with `sslmode=require`, remove the `db` service, give the database user `CREATEDB`, and use a backup image whose client matches the RDS major version (`PG_MAJOR`). **S3** can hold the encrypted off-site backups; it cannot hold the media (no storage adapter yet). `templates/vm-cloud-init/terraform-aws` creates the instance, address and security group (validated, never applied).
- **Google Compute Engine and Cloud SQL (the pilot's shape):** `docker-compose.prod.yml` with the Cloud SQL Auth Proxy service, a service account with only *Cloud SQL Client*, a separate data disk for uploads with scheduled snapshots, Cloud Monitoring through the Ops Agent.
- **DigitalOcean, Hetzner:** a plain Ubuntu droplet or server with the cloud-init file as user data; use the provider's cloud firewall in addition to `ufw`; a managed PostgreSQL works as RDS does.

## Hardening checklist

HTTPS only (`SITE_SCHEME` and `CMS_SCHEME` set to `https`); secrets from `init.sh` or `openssl rand -base64 48` in a mode-600 `.env`; a setup token; SSH keys only and `ufw`; only 80 and 443 published by Docker; the containers run unprivileged without capabilities; off-site encrypted backups that you restored once; unattended security updates; the full list: [Securing an install](/guide/security).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| The CMS restarts at boot with a message about a secret | A placeholder or a value under 32 characters in `.env` (HTTPS makes this a hard stop) |
| No certificate | DNS does not point here yet, or port 80 is closed in the cloud firewall or `ufw` |
| Out of memory while starting | A 2 GB machine without swap: add the swap file (step 2) |
| Disk full | `docker system df`; prune old images (`docker image prune -a`) and old backups, set Docker log rotation |

## Tested

The cloud-init file: schema-valid (cloud-init's own validator), shellcheck-clean, and the files it writes were run on a clean Ubuntu 24.04 container (`init.sh`, key fingerprint, Docker's repository). The Compose stack behind it is the reference path and runs in CI. The Terraform skeleton passes `terraform validate`.
**Not run:** the bootstrap as root on a real VM, and no cloud resource was created.
