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

Admin Bedrock drafts read `AWS_REGION`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` from `/opt/memecatch/.env` (keys of the `memecatch-bedrock` IAM user from `terraform/`).

`MEMECATCH_SIGNING_SECRET` is the HMAC and operator bearer for analytics, view counts, and the embedding probe. `MEME_EMBEDDING_REINDEX_ENABLED` defaults to false.

## Continuous deploy (GitHub Actions through Cloudflare Tunnel)

The repository is public. The VM keeps port 22 closed to the internet; GitHub reaches it only through a Cloudflare Tunnel that Cloudflare Access guards with a service token.

```text
push to main ─► ci.yml `check` ─► success ─► `deploy` job (environment: production, main only)
  └─ ssh ubuntu@$DEPLOY_HOST "<commit sha>"   via  cloudflared access ssh (service token)
       └─ Cloudflare Access ─► tunnel memecatch-deploy ─► VM sshd
            └─ forced command: /var/lib/memecatch-autodeploy/bin/autodeploy.sh
                 build on the VM ─► scripts/deploy-oci.sh ─► https://catchmeme.com reports the new release
                 failure ─► previous images and checkout restored; the GitHub job fails
```

Pieces and where they live:

| Piece | Where | Notes |
| --- | --- | --- |
| Tunnel `memecatch-deploy` | VM `/etc/cloudflared/memecatch-deploy.yml`, unit `cloudflared-memecatch-deploy` | ingress `ssh://localhost:22` for `$DEPLOY_HOST` only |
| Access application | Cloudflare Zero Trust | self-hosted app on `$DEPLOY_HOST`, Service Auth policy for one service token |
| Deploy key | GitHub `production` secret `DEPLOY_SSH_KEY`; VM `authorized_keys` | `restrict,command="…/autodeploy.sh"`: no shell, PTY, or forwarding; installed by `deploy/autodeploy/authorize-github-key.sh` |
| Host key pin | secret `DEPLOY_KNOWN_HOSTS` | `StrictHostKeyChecking=yes` |
| Access token | secrets `CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET` | passed to cloudflared through env, never on the command line |

Pull requests (including forks) never run the deploy job, and the `production` environment only serves `main`. A leaked deploy key plus Access token can do one thing: ask the VM to deploy a commit that is on `origin/main` and passed CI.

The agent (`deploy/autodeploy/autodeploy.sh`) accepts only the full current `origin/main` commit SHA, refuses to downgrade, checks the CI `check` run itself, and never auto-deploys a commit that adds files under `db/migrations/`. It verifies the latest main and successful CI again after the image build, immediately before activation. If either check or the migration diff cannot be verified, activation is refused. When migrations are detected, the job fails with the file list; apply them, then:

```bash
touch /var/lib/memecatch-autodeploy/allow-<full-sha>   # then re-run the deploy job in GitHub
```

After the automatic deploy SSH request completes or disconnects with exit 255, the workflow does not send another deploy command. It retries a read-only `status <sha>` request and succeeds only when the agent verifies the current main SHA, completed CI, success marker, running and healthy app container with the matching image SHA, and public release header under the deployment lock. Missing evidence or an unreachable agent leaves the run failed. A VM still running the older agent cannot answer `status`. On the first upgrade, interruption after the deployed marker is written but before self-update leaves the old agent installed; a same-SHA rerun is a no-op and cannot repair it. The workflow remains failed without verification. With separate authorization, an operator can hold the deployment lock, verify current main and successful CI, the deployed marker, absence of a failed marker, the running image SHA, and the public release header, then atomically install the agent from that verified matching checkout using the agent self-update copy-and-rename procedure. After releasing the lock, rerun the job for read-only reconciliation. Do not force a rebuild solely to repair the agent.

A re-run in GitHub retries a commit that failed before. Install or update the agent with `bash deploy/autodeploy/install.sh` (add `--with-timer` to also poll main every 3 minutes as a fallback). Logs: the GitHub job, or `journalctl -u memecatch-autodeploy` for timer runs. Each deploy tags the running images `memecatch*:rollback-<previous-sha>` first.

### Rebuild and redeploy the current release

In GitHub Actions, select **Manual production redeploy**, choose `main`, and select **Run workflow**. This is distinct from re-running the automatic deploy job, which intentionally does nothing when its commit is already running. The manual job requests `redeploy <full-sha>` through the same restricted key and Access tunnel. The VM accepts this request only when the SHA is both the running release and the current `origin/main` tip; an out-of-date request fails without deploying. The agent checks the commit's existing CI result, uses the same deployment lock and rollback snapshots, rebuilds the images, and explicitly recreates the app even if Docker's build cache produces the same image. The normal health and public release checks still apply.

The first release containing this workflow updates the VM agent after its automatic deployment. Wait for that deployment to succeed before running the manual workflow. If a newer `main` commit is awaiting deployment, wait for it to finish before requesting a manual redeploy.

Build-time values live in `deploy/build.env`. Every one ships in the HTML, so the file holds only `NEXT_PUBLIC_*` values; CI fails if anything else appears there. Runtime secrets stay in `/opt/memecatch/.env`, which is not in git. Responses carry `X-MemeCatch-Release-Sha`.

## Backups

The backup container runs `pg_dump -Fc` as `memecatch_backup` daily at 02:30 UTC, gzips it, encrypts it with age to the public key in `BACKUP_AGE_RECIPIENT`, and uploads `memecatch/<stamp>.dump.gz.age` to R2. That role has `BYPASSRLS` and `SELECT` on every non-system schema, plus default privileges so later tables are included. It cannot create temporary tables. `EXECUTE` on `SECURITY DEFINER` functions in `public` is revoked from `PUBLIC` and `memecatch_backup`; explicit per-function grants are preserved. Future functions created by `postgres` or `memecatch` require explicit grants. `auth.uid()` and `auth.jwt()` read the session settings only when the session user is `memecatch`. Retention defaults to 14 days. If the R2 backup variables are empty, the job logs a skip and exits 0. If R2 is set and the recipient is empty, the job fails and uploads nothing.

A new data directory creates the role from `deploy/postgres/init.sh`. An existing volume does not re-run init. For databases initialized with the old blanket function grants, first follow [function ACL recovery](../scripts/postgres/FUNCTION-ACL-RECOVERY.md); running the commands below alone does not remove those existing grants. After `MEMECATCH_BACKUP_DB_PASSWORD` is in `.env` and the postgres container has been recreated so it sees that variable, reapply the identity functions and the role once:

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

`deploy/backup/test-restore.sh` encrypts a dump, restores it into `memecatch_restore_proof`, and compares per-table counts and a meme id checksum. It does not contact R2.

## Rollback

The VM is the only production origin. Roll back by redeploying the previous image tag with `scripts/deploy-oci.sh`; restore data from the latest R2 backup with `deploy/backup/restore.sh` if a migration went wrong.
