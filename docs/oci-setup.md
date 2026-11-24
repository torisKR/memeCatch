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
| app (the server, `Dockerfile.server`) | 0.35 | 256 MB |
| embedder (only with the `embedder` profile) | 0.50 | 1280 MB |
| postgres | 0.50 | 1280 MB |
| mpe-worker | 0.40 | 768 MB |
| backup (only while a dump runs) | 0.10 | 256 MB |
| caddy, only in own-caddy mode | 0.10 | 128 MB |
| scheduler | 0.05 | 64 MB |

The caps sum to about 2.7 GB, and to about 4 GB with the embedder. Postgres is sized for its own 1280 MB, not for the whole VM: `shared_buffers=192MB`, `effective_cache_size=512MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`, `max_connections=30`.

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
- Cache rule: cache `/_axum/*` (the server's content-hashed stylesheet and scripts) and other fingerprinted assets. Do not cache HTML, `/api/*`, or `/login`.

### Authenticated Origin Pulls (own Caddy)

Caddy trusts `CF-Connecting-IP` from any address in `deploy/cloudflare-proxies.txt`. A peer inside those ranges that connects straight to the VM could send a forged one. With Authenticated Origin Pulls, Cloudflare presents a client certificate on every request it sends to the origin, and Caddy refuses a TLS connection without one signed by Cloudflare's origin-pull CA (PLAN.md D5-6).

The setting is `CLOUDFLARE_ORIGIN_PULL` in `/opt/memecatch/.env`: `off` (the default, also when unset or empty) or `on`. Any other value stops Caddy at start (`File to import not found: origin-pull-…`), and the deploy's health check fails. It applies to memeCatch's own Caddy (`MEMECATCH_CADDY=own`); the shared proxy needs the same `tls { client_auth { … } }` block added to its own site by its owner. The CA file is `deploy/cloudflare-origin-pull-ca.pem`, pinned by `deploy/cloudflare-origin-pull-ca.pem.sha256` (its source URL and SHA-256; `server/tests/deploy_caddy.rs` checks the file against it). The compose file mounts it at `/etc/caddy/cloudflare-origin-pull-ca.pem`.

Switch it on in this order. The other order locks every visitor out: Caddy would ask for a certificate Cloudflare does not yet send, and Cloudflare answers 525/526.

1. Cloudflare dashboard, the `catchmeme.com` zone, **SSL/TLS → Origin Server → Authenticated Origin Pulls: On** (the zone-level setting with Cloudflare's certificate). Cloudflare now presents its certificate; the origin does not ask for it yet, so nothing changes for visitors. Open the site once to confirm.
2. On the VM, add `CLOUDFLARE_ORIGIN_PULL=on` to `/opt/memecatch/.env` and run `bash scripts/deploy-oci.sh` (or let the autodeploy agent redeploy). Caddy restarts with client certificate verification.
3. Check: the site loads through Cloudflare. A request straight to the origin fails in the TLS handshake: `curl -sS --resolve catchmeme.com:443:<VM public IP> https://catchmeme.com/api/health` ends with a "certificate required" alert.

To switch it off, reverse the order: `CLOUDFLARE_ORIGIN_PULL=off` (or remove the line) and redeploy first, then turn the dashboard toggle off.

What it does and does not cover:

- With client verification on, Caddy also requires the TLS server name to match the `Host` header (it logs "enabling strict SNI-Host enforcement"), so a connection with another or no server name cannot reach the site. Measured with `caddy:2-alpine` 2.11.9 and a stand-in CA: no client certificate and a certificate from another CA are refused in the handshake, a certificate the trusted CA signed passes; with `off`, nothing changes.
- Port 80 is not covered: it only redirects to HTTPS (and answers ACME HTTP challenges) and never proxies to the app. The deploy's own-Caddy health check (`http://127.0.0.1/api/health`) uses it and is unaffected.
- Cloudflare's certificate is shared by every Cloudflare customer, so another Cloudflare zone pointed at this IP still gets through; `CF-Connecting-IP` is then still set by Cloudflare and cannot be forged, which is the threat this closes. The stricter step is a per-zone certificate (upload our own client certificate to the zone and trust its CA here instead of Cloudflare's).
- The pinned CA (fetched 2026-11-24 from `https://developers.cloudflare.com/ssl/static/authenticated_origin_pull_ca.pem`, `CN=origin-pull.cloudflare.net`) is valid until **2029-11-01**. Well before then, and whenever Cloudflare announces a new origin-pull certificate, re-check the file against that URL (`openssl x509 -noout -subject -issuer -dates`, and the SHA-256 in the pin file). If it changed, replace the file and its checksum and deploy before Cloudflare switches certificates.

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
push to main ─► ci.yml `check`, `server` ─► success
  ─► `deploy` ─► deploy-vm.yml (environment: production, main only)
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

The deploy runner reads these variables (also documented in `scripts/env-manifest.json`):

| Variable | Source | Purpose |
| --- | --- | --- |
| `DEPLOY_HOST` | GitHub `production` environment variable `DEPLOY_HOST` | Cloudflare Access SSH hostname; it is passed to the deploy step. |
| `GITHUB_SHA` | GitHub Actions automatically supplies it | Full commit SHA requested from the VM agent. |
| `RUNNER_TEMP` | GitHub Actions automatically supplies it | Runner temporary directory where the workflow writes `deploy_key` and `known_hosts`. |

For illustration only, a runner environment might contain the following non-production values; the SHA and temporary path are supplied by Actions, not configured in the app's `.env`:

```text
DEPLOY_HOST=deploy.example.invalid
GITHUB_SHA=0000000000000000000000000000000000000000
RUNNER_TEMP=/tmp/example-runner-temp
```

Pull requests (including forks) never run the deploy job, and the `production` environment only serves `main`. A leaked deploy key plus Access token can do one thing: ask the VM to deploy a commit that is on `origin/main` and passed CI.

The agent (`deploy/autodeploy/autodeploy.sh`) accepts only the full current `origin/main` commit SHA, refuses to downgrade, checks the CI runs itself (`check` and `server`; see "CI jobs and what a deploy waits for"), and never auto-deploys a commit that adds files under `db/migrations/`. It verifies the latest main and successful CI again after the image build, immediately before activation. If either check or the migration diff cannot be verified, activation is refused. When migrations are detected, the job fails with the file list; apply them, then:

```bash
touch /var/lib/memecatch-autodeploy/allow-<full-sha>   # then re-run the deploy job in GitHub
```

After the automatic deploy SSH request completes, disconnects, or times out, the workflow does not send another deploy command. It retries a read-only `status <sha>` request and succeeds only when the agent verifies the current main SHA, completed CI, success marker, running and healthy app container with the matching image SHA, and public release header under the deployment lock. The initial SSH call is limited to 45 minutes; after success, disconnect, or client timeout, status reconciliation has a separate 45-minute deadline, with bounded individual requests. The agent can wait up to 30 minutes to acquire its deploy lock, but remote build and deployment execution have no fixed maximum; completion beyond the reconciliation deadline remains unverified and the job fails. The workflow reserves 95 minutes for the deployment step and 110 minutes for the full job. Missing evidence or an unreachable agent leaves the run failed. A VM still running the older agent cannot answer `status`. On the first upgrade, interruption after the deployed marker is written but before self-update leaves the old agent installed; a same-SHA rerun is a no-op and cannot repair it. The workflow remains failed without verification. With separate authorization, an operator can hold the deployment lock, verify current main and successful CI, the deployed marker, absence of a failed marker, the running image SHA, and the public release header, then atomically install the agent from that verified matching checkout using the agent self-update copy-and-rename procedure. After releasing the lock, rerun the job for read-only reconciliation. Do not force a rebuild solely to repair the agent.

A dropped SSH session does not stop a deploy. The agent runs an SSH deploy as a copy of itself in its own session (`setsid`), with its input from `/dev/null`, its output in `/var/lib/memecatch-autodeploy/deploy-<sha>.log` and SIGHUP and SIGPIPE ignored; the side attached to the SSH session only relays that log and the copy's exit status (`deploy-<sha>.status`). If the client goes away (run 45336656538: `client_loop: send disconnect: Broken pipe` during the build), the copy finishes, records the release or rolls back, and the workflow's `status` requests see the result as they see any other. `status <sha>` also prints the last 30 lines of that log on stderr, so the GitHub job shows how the deploy ended. Logs older than 14 days are deleted at the next SSH deploy. This relies on logind not killing the processes of a closed SSH session: Ubuntu's default is `KillUserProcesses=no` (check `loginctl show-session` or `/etc/systemd/logind.conf` once on the VM).

During the final status window, a distinct lock-busy response permits up to three more read-only status requests within the same deadline. A busy response occurs before any CI API request; the runner permits at most 13 status attempts that can reach the CI API. This per-run bound does not reserve GitHub's shared IP quota. If the lock releases too late for the remaining verification, the job remains unverified.

A re-run in GitHub retries a commit that failed before. Install or update the agent with `bash deploy/autodeploy/install.sh` (add `--with-timer` to also poll main every 3 minutes as a fallback). Logs: the GitHub job, or `journalctl -u memecatch-autodeploy` for timer runs. Each deploy tags the running images `memecatch*:rollback-<previous-sha>` first.

### Rebuild and redeploy the current release

In GitHub Actions, select **Manual production redeploy**, choose `main`, and select **Run workflow**. This is distinct from re-running the automatic deploy job, which intentionally does nothing when its commit is already running. The manual job requests `redeploy <full-sha>` through the same restricted key and Access tunnel. The VM accepts this request only when the SHA is both the running release and the current `origin/main` tip; an out-of-date request fails without deploying. The agent checks the commit's existing CI result, uses the same deployment lock and rollback snapshots, rebuilds the images, and explicitly recreates the app even if Docker's build cache produces the same image. The normal health and public release checks still apply.

The first release containing this workflow updates the VM agent after its automatic deployment. Wait for that deployment to succeed before running the manual workflow. If a newer `main` commit is awaiting deployment, wait for it to finish before requesting a manual redeploy.

Build-time values live in `deploy/build.env`. Every one ships in the HTML, so the file holds only `NEXT_PUBLIC_*` values; CI fails if anything else appears there. Runtime secrets stay in `/opt/memecatch/.env`, which is not in git. Responses carry `X-MemeCatch-Release-Sha`.

## The server

`app` is the server (`server/`, `Dockerfile.server`): it answers every page and route. Caddy reaches it as `app:3000`, the scheduler calls `http://app:3000/api/cron/*`. After a deploy the agent asks a few read-only routes from inside the Compose network (`/api/health`, `/robots.txt`, `/llms.txt`, `/feed.xml`, `/sitemap.xml`, `/manifest.webmanifest`, `/api/daily-quiz`, `/api/media/signed`) and logs their status and headers (`route <path>: …`); the health gate and the public release check decide the deploy.

The scheduler does not call `/api/cron/mcp-events` (`deploy/scheduler/crontab`, D5-4): production has no `MCP_EVENT_STATE_KEY`, so every run failed.

### Disk

The images are built on the VM, and Postgres keeps its data on the same disk. Before it changes anything, the agent reads the free space of Docker's data directory and refuses to deploy below `AUTODEPLOY_SERVER_BUILD_MIN_FREE_MB` (default 4000). The message names the figure and the variable; nothing has been changed when it appears. Set the variable in the agent's environment or in `/opt/memecatch/.env`; the SSH forced command gets its settings from the env file.

Where the default comes from, measured on an arm64 machine:

| Build of `Dockerfile.server` | Time on 2 CPUs | Written to Docker's disk | Left behind |
| --- | --- | --- | --- |
| Nothing cached (base image, crates, dependencies) | 128 s | 1,738 MB | 1,738 MB of build cache |
| A change under `server/src` | 28 s | 39 MB | 39 MB |
| A new commit that leaves `server/` alone | 1 s | 0 MB | 0 MB |

The worker image of the same run writes up to about 1.9 GB more. 1,738 + 1,922 + the server image is about 3.8 GB, rounded up to 4,000 MB. The agent holds every deploy to that figure, because Docker's cache collection or a `docker builder prune` can make any build a cold one. After each deploy it keeps two release and two rollback tags per image and bounds the build cache to 3 GB (`AUTODEPLOY_BUILD_CACHE_MAX`).

### The server's CPU limit

Every request reaches the server. 0.35 CPU is the smallest limit that was not throttled in the rehearsal at the request rates production sees (16 connections on `/api/random-meme` and `/api/health`; at 0.25 those were throttled in 25 % and 45 % of scheduler periods).

## Cutover from the release with Next

Done on 2026-11-25: #166 (5be0ac9) replaced 60fbfbd, the last release that ran the Next app as the `next` service behind the server. The first deploy after it removed the Next images, so there is no way back to that release; roll back within the Axum releases as in "Rollback".

What it took, for a similar change of the deploy agent itself:

1. The commit's migrations were applied to production by hand, then `allow-<merge sha>` was touched (see "Continuous deploy").
2. The agent installed on the VM was the old release's, and it always built the Next `Dockerfile`, which the cutover deleted, so its run failed at the build and kept 60fbfbd. The agent replaces itself only after a good deploy. The new agent was installed by hand (`git show origin/main:deploy/autodeploy/autodeploy.sh` into `/var/lib/memecatch-autodeploy/bin/autodeploy.sh`, old copy kept beside it), then the CI `deploy` job was re-run.
3. After that deploy, `MEMECATCH_AXUM`, `MEMECATCH_NEXT`, `AXUM_DISABLED_ROUTES`, `AXUM_PILOT_ROUTES` and `UPSTREAM_URL` were deleted from `.env`; nothing reads them.

An earlier deploy that ran out of disk had left three tracked files in `/opt/memecatch` truncated, and the agent refuses to deploy over changed tracked files ("tracked files changed"). Check `git status` there after a disk-full failure.

### CI jobs and what a deploy waits for

| Job | What it checks |
| --- | --- |
| `check` | TypeScript (tsc, lint, vitest) of the worker, the scripts and `server/ui`; the node tests, the env manifest, the deploy script tests; the worker and backup images; the Postgres tests |
| `server` | `cargo fmt`, clippy and tests on a fresh database, `build-ui.mjs --check`, the server image |

The GitHub `deploy` job needs both and calls `.github/workflows/deploy-vm.yml`. The agent checks the same two jobs by name on the VM.

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

The VM is the only production origin. A failed deploy rolls back by itself to the snapshot taken before it. To roll back by hand, redeploy the previous images with `scripts/deploy-oci.sh` (`MEMECATCH_SERVER_IMAGE` and `MEMECATCH_WORKER_IMAGE`, the `rollback-<sha>` tags). Restore data from the latest R2 backup with `deploy/backup/restore.sh` if a migration went wrong.
