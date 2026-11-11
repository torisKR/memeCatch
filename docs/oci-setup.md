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

- `POSTGRES_PASSWORD` (postgres service only)
- `MEMECATCH_DB_PASSWORD`
- `MEMECATCH_BACKUP_DB_PASSWORD` (login `memecatch_backup`, used only by the backup service)
- `BETTER_AUTH_SECRET` (long random)
- `MEMECATCH_SIGNING_SECRET` (analytics, view counts, embedding probe)
- `NEXT_PUBLIC_SITE_URL=https://catchmeme.com`
- `CRON_SECRET`

Put the checkout's deploy key on the VM so `git pull` in GitHub Actions can update `/opt/memecatch`.

## Ports and Caddy

`scripts/deploy-oci.sh` checks listeners with `ss -ltn` (or `netstat` if `ss` is missing). Own Caddy starts only when `MEMECATCH_CADDY=own`. Any other value, including an empty one, uses the shared proxy.

**Own Caddy.** Set `MEMECATCH_CADDY=own` and only when both 80 and 443 are free. If either port is busy the script exits and does not start a second proxy. Compose file `docker-compose.own-caddy.yml` publishes `80` and `443`. `deploy/Caddyfile` terminates TLS, trusts the Cloudflare ranges in `deploy/cloudflare-proxies.txt`, and reads the client address from `CF-Connecting-IP`. Refresh those ranges from `https://www.cloudflare.com/ips-v4` and `https://www.cloudflare.com/ips-v6` when Cloudflare publishes new ones.

The OCI security list and the host firewall should allow 80 and 443 from the internet only in this mode.

**Shared proxy.** This is the default on the shared VM. Compose file `docker-compose.shared-proxy.yml` publishes `127.0.0.1:12730` to the app and nothing else. Paste `deploy/Caddyfile.site` into the Caddy that already owns 80/443. The deploy script prints that reminder and does not edit the other Caddy.

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

The script starts only the `memecatch` project and curls `/api/health`. In shared-proxy mode the check is `http://127.0.0.1:12730/api/health`. With `MEMECATCH_CADDY=own` it is `http://127.0.0.1/api/health`.

`MEMECATCH_SIGNING_SECRET` is the HMAC and operator bearer for analytics, view counts, and the embedding probe. `MEME_EMBEDDING_REINDEX_ENABLED` defaults to false.

GitHub Actions (`.github/workflows/deploy.yml`) builds `linux/amd64` and `linux/arm64` app and worker images, pushes them to GHCR, and SSHes `cd /opt/memecatch && git pull && MEMECATCH_IMAGE=<tag> MEMECATCH_WORKER_IMAGE=<tag> bash scripts/deploy-oci.sh`. The deploy job is skipped when `OCI_SSH_HOST`, `OCI_SSH_USER`, or `OCI_SSH_KEY` is empty. When those are set, `OCI_SSH_KNOWN_HOSTS` is required and SSH uses `StrictHostKeyChecking=yes`. It never logs into the VM when the host secrets are absent.

## GHCR login on the VM

The images are `ghcr.io/<owner>/memecatch` and `ghcr.io/<owner>/memecatch-worker`, with the owner lowercased. `scripts/deploy-oci.sh` pulls those tags when `MEMECATCH_IMAGE` or `MEMECATCH_WORKER_IMAGE` starts with `ghcr.io/`. The Actions `GITHUB_TOKEN` that pushes them never reaches the VM.

GHCR packages are private until their visibility is changed. On the VM, log in once as the user that runs Docker, with a GitHub user and a token that can `read:packages` for this repository:

```bash
umask 077
printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io -u '<github-user>' --password-stdin
unset GHCR_READ_TOKEN
```

`docker login` stores the credential in that user's `~/.docker/config.json`. Do not commit the token or pass it as a Compose variable. A public package does not need this login. Confirm with `docker pull` of one pushed tag before the first deploy that uses GHCR.

The app image build args are `RELEASE_SHA` and the public `NEXT_PUBLIC_*` values. On a pull request, CI sets `RELEASE_SHA` to the PR head SHA. The GHCR workflow sets it to the commit SHA on `main`. Public values come from repository variables. Responses carry `X-MemeCatch-Release-Sha` when that SHA is set at build time.

## Backups

The backup container runs `pg_dump -Fc` as `memecatch_backup` daily at 02:30 UTC, gzips it, encrypts it with age to the public key in `BACKUP_AGE_RECIPIENT`, and uploads `memecatch/<stamp>.dump.gz.age` to R2. That role has `BYPASSRLS` and `SELECT` on every non-system schema, plus default privileges so later tables are included. It cannot create temporary tables. `EXECUTE` on `SECURITY DEFINER` functions in `public` is revoked from `PUBLIC` and granted to `anon`, `authenticated`, and `service_role`. Functions created later by `postgres` or `memecatch` get the same grants. `auth.uid()` and `auth.jwt()` read the session settings only when the session user is `memecatch`. Retention defaults to 14 days. If the R2 backup variables are empty, the job logs a skip and exits 0. If R2 is set and the recipient is empty, the job fails and uploads nothing.

A new data directory creates the role from `deploy/postgres/init.sh`. An existing volume does not re-run init. After `MEMECATCH_BACKUP_DB_PASSWORD` is in `.env` and the postgres container has been recreated so it sees that variable, reapply the identity functions and the role once:

```bash
docker compose exec -T -u postgres postgres \
  psql -v ON_ERROR_STOP=1 -d memecatch -f /sql/99-app-identity.sql
docker compose exec -T -u postgres postgres \
  bash -c 'source /sql/backup-role.sh && ensure_backup_role'
```

Restore only into an empty database, in one transaction, with the matching identity:

```bash
MEMECATCH_RESTORE_CONFIRM=restore \
BACKUP_AGE_IDENTITY="$(cat backup-identity.txt)" \
DATABASE_URL=postgresql://postgres:...@127.0.0.1:5432/scratch \
  bash deploy/backup/restore.sh memecatch-20260101T023000Z.dump.gz.age
```

`deploy/backup/test-restore.sh` encrypts a dump, restores it into `memecatch_restore_proof`, and compares per-table counts and a meme id checksum. It does not contact Supabase or R2.

## Cutover and rollback

Keep the Vercel deployment serving `catchmeme.com` until the VM health check passes and a restored row-count check looks right.

1. Lower the Cloudflare proxy TTL if it is high.
2. Point the proxied `A` record at `oci-hermes-dev`.
3. Confirm `https://catchmeme.com/api/health` and a logged-in `/my` page.
4. Rollback is the same DNS record pointed back at Vercel. Do not delete the Vercel project on cutover day.

The Supabase project stays available until the owner has run the dump, the checksum queries, and a login with a migrated bcrypt password.
