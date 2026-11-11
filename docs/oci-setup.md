# OCI setup

memeCatch runs on the VM that is already provisioned. Do not create another Always Free instance for it.

| | |
| --- | --- |
| VM | `oci-hermes-dev` |
| Shape | `VM.Standard.A1.Flex` |
| Size | 2 OCPU, 12 GB RAM |
| Region | `ap-tokyo-1` |
| Arch | `linux/arm64` |
| Checkout | `/opt/memecatch` |

Another app already runs on this box. memeCatch is a second Compose project. It does not replace that app.

## Budget

The VM has 12 GB. memeCatch stays at or under about 6 GB so the other app keeps the rest. Limits are Compose `mem_limit` and `cpus` on each container.

| Service | CPU | Memory |
| --- | --- | --- |
| app (Next.js and ONNX embeddings) | 0.75 | 2816 MB |
| postgres | 0.50 | 1280 MB |
| mpe-worker | 0.40 | 768 MB |
| backup (only while a dump runs) | 0.10 | 256 MB |
| caddy, only in own-caddy mode | 0.10 | 128 MB |
| scheduler | 0.05 | 64 MB |

The caps sum to about 5.2 GB. Postgres is sized for its own 1280 MB, not for the whole VM: `shared_buffers=192MB`, `effective_cache_size=512MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`, `max_connections=30`.

## What stays isolated

- Compose project name: `memecatch`
- Network name: `memecatch`
- Volumes: `memecatch-pg`, `memecatch-caddy`, `memecatch-models`
- No host port on Postgres, the worker, the scheduler, or the backup
- The app publishes a host port only through one of the two Caddy choices below
- `scripts/deploy-oci.sh` only runs `docker compose -p memecatch`. It does not stop, remove, or edit other containers, units, or Caddy configs

## First install

Install Docker and the compose plugin if this VM does not have them yet. Leave the other app's containers running.

```bash
sudo mkdir -p /opt/memecatch
sudo chown "$USER" /opt/memecatch
git clone git@github.com:torisKR/memeCatch.git /opt/memecatch
cd /opt/memecatch
```

Create `/opt/memecatch/.env` from `.env.example`. Required for boot:

- `POSTGRES_PASSWORD`
- `MEMECATCH_DB_PASSWORD`
- `BETTER_AUTH_SECRET` (long random)
- `NEXT_PUBLIC_SITE_URL=https://catchmeme.com`
- `CRON_SECRET`

Put the checkout's deploy key on the VM so `git pull` in GitHub Actions can update `/opt/memecatch`.

## Ports and Caddy

`scripts/deploy-oci.sh` checks listeners with `ss -ltn` (or `netstat` if `ss` is missing).

**Own Caddy.** Used only when both 80 and 443 are free. Compose file `docker-compose.own-caddy.yml` publishes `80` and `443`. `deploy/Caddyfile` terminates TLS, trusts the Cloudflare ranges in `deploy/cloudflare-proxies.txt`, and reads the client address from `CF-Connecting-IP`. Refresh those ranges from `https://www.cloudflare.com/ips-v4` and `https://www.cloudflare.com/ips-v6` when Cloudflare publishes new ones.

The OCI security list and the host firewall should allow 80 and 443 from the internet only in this mode.

**Shared proxy.** Used when 80 or 443 is already taken. Compose file `docker-compose.shared-proxy.yml` publishes `127.0.0.1:12730` to the app and nothing else. Paste `deploy/Caddyfile.site` into the Caddy that already owns 80/443. The deploy script prints that reminder and does not edit the other Caddy.

```
catchmeme.com {
	encode gzip
	reverse_proxy 127.0.0.1:12730
}
```

If that Caddy is not already behind Cloudflare, add the same `trusted_proxies` and `client_ip_headers CF-Connecting-IP` block from `deploy/Caddyfile`.

## Cloudflare

- DNS: `A` record for `catchmeme.com` to the VM's public IP, proxied (orange cloud).
- SSL/TLS mode: **Full (strict)**. Caddy presents a public certificate. Flexible would loop or hide certificate errors.
- Cache rule: cache `/_next/static/*` and other fingerprinted assets. Do not cache HTML, `/api/*`, or `/login`.

## Deploy

```bash
cd /opt/memecatch
bash scripts/deploy-oci.sh
```

The script picks the Caddy mode, starts only the `memecatch` project, and curls `/api/health`. In shared-proxy mode the check is `http://127.0.0.1:12730/api/health`. In own-caddy mode it is `http://127.0.0.1/api/health`.

GitHub Actions (`.github/workflows/deploy.yml`) builds `linux/amd64` and `linux/arm64`, pushes to GHCR, and SSHes `cd /opt/memecatch && git pull && MEMECATCH_IMAGE=<tag> bash scripts/deploy-oci.sh`. The deploy job is skipped when `OCI_SSH_HOST`, `OCI_SSH_USER`, or `OCI_SSH_KEY` is empty. It never logs into the VM in that case.

## Backups

The backup container runs `pg_dump -Fc` daily at 02:30 UTC, gzips it, and uploads to `s3://$R2_BACKUP_BUCKET/memecatch/` using the R2 S3 endpoint. Retention defaults to 14 days. If the R2 backup variables are empty, the job logs a skip and exits 0.

Restore onto a scratch database first:

```bash
DATABASE_URL=postgresql://postgres:...@127.0.0.1:5432/memecatch \
  bash deploy/backup/restore.sh memecatch-20260101T023000Z.dump.gz
```

`deploy/backup/test-restore.sh` dumps the current database and restores it into `memecatch_restore_proof`. It does not contact Supabase or R2.

## Cutover and rollback

Keep the Vercel deployment serving `catchmeme.com` until the VM health check passes and a restored row-count check looks right.

1. Lower the Cloudflare proxy TTL if it is high.
2. Point the proxied `A` record at `oci-hermes-dev`.
3. Confirm `https://catchmeme.com/api/health` and a logged-in `/my` page.
4. Rollback is the same DNS record pointed back at Vercel. Do not delete the Vercel project on cutover day.

The Supabase project stays available until the owner has run the dump, the checksum queries, and a login with a migrated bcrypt password.
