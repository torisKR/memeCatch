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
| app (Next.js and ONNX embeddings); named `next` with `MEMECATCH_AXUM=1` | 0.75 | 2816 MB |
| app (the Axum server), only with `MEMECATCH_AXUM=1` | 0.35 | 256 MB |
| postgres | 0.50 | 1280 MB |
| mpe-worker | 0.40 | 768 MB |
| backup (only while a dump runs) | 0.10 | 256 MB |
| caddy, only in own-caddy mode | 0.10 | 128 MB |
| scheduler | 0.05 | 64 MB |

The caps sum to about 5.2 GB, and to about 5.5 GB with Axum in front. Postgres is sized for its own 1280 MB, not for the whole VM: `shared_buffers=192MB`, `effective_cache_size=512MB`, `work_mem=4MB`, `maintenance_work_mem=64MB`, `max_connections=30`.

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
push to main ─► ci.yml `check` and `server` ─► success ─► `deploy` job (environment: production, main only)
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

The agent (`deploy/autodeploy/autodeploy.sh`) accepts only the full current `origin/main` commit SHA, refuses to downgrade, checks the CI `check` run itself (and the `server` run when `MEMECATCH_AXUM=1`), and never auto-deploys a commit that adds files under `db/migrations/`. It verifies the latest main and successful CI again after the image build, immediately before activation. If either check or the migration diff cannot be verified, activation is refused. When migrations are detected, the job fails with the file list; apply them, then:

```bash
touch /var/lib/memecatch-autodeploy/allow-<full-sha>   # then re-run the deploy job in GitHub
```

After the automatic deploy SSH request completes, disconnects, or times out, the workflow does not send another deploy command. It retries a read-only `status <sha>` request and succeeds only when the agent verifies the current main SHA, completed CI, success marker, running and healthy app container with the matching image SHA, and public release header under the deployment lock. The initial SSH call is limited to 45 minutes; after success, disconnect, or client timeout, status reconciliation has a separate 45-minute deadline, with bounded individual requests. The agent can wait up to 30 minutes to acquire its deploy lock, but remote build and deployment execution have no fixed maximum; completion beyond the reconciliation deadline remains unverified and the job fails. The workflow reserves 95 minutes for the deployment step and 110 minutes for the full job. Missing evidence or an unreachable agent leaves the run failed. A VM still running the older agent cannot answer `status`. On the first upgrade, interruption after the deployed marker is written but before self-update leaves the old agent installed; a same-SHA rerun is a no-op and cannot repair it. The workflow remains failed without verification. With separate authorization, an operator can hold the deployment lock, verify current main and successful CI, the deployed marker, absence of a failed marker, the running image SHA, and the public release header, then atomically install the agent from that verified matching checkout using the agent self-update copy-and-rename procedure. After releasing the lock, rerun the job for read-only reconciliation. Do not force a rebuild solely to repair the agent.

During the final status window, a distinct lock-busy response permits up to three more read-only status requests within the same deadline. A busy response occurs before any CI API request; the runner permits at most 13 status attempts that can reach the CI API. This per-run bound does not reserve GitHub's shared IP quota. If the lock releases too late for the remaining verification, the job remains unverified.

A re-run in GitHub retries a commit that failed before. Install or update the agent with `bash deploy/autodeploy/install.sh` (add `--with-timer` to also poll main every 3 minutes as a fallback). Logs: the GitHub job, or `journalctl -u memecatch-autodeploy` for timer runs. Each deploy tags the running images `memecatch*:rollback-<previous-sha>` first.

### Rebuild and redeploy the current release

In GitHub Actions, select **Manual production redeploy**, choose `main`, and select **Run workflow**. This is distinct from re-running the automatic deploy job, which intentionally does nothing when its commit is already running. The manual job requests `redeploy <full-sha>` through the same restricted key and Access tunnel. The VM accepts this request only when the SHA is both the running release and the current `origin/main` tip; an out-of-date request fails without deploying. The agent checks the commit's existing CI result, uses the same deployment lock and rollback snapshots, rebuilds the images, and explicitly recreates the app even if Docker's build cache produces the same image. The normal health and public release checks still apply.

The first release containing this workflow updates the VM agent after its automatic deployment. Wait for that deployment to succeed before running the manual workflow. If a newer `main` commit is awaiting deployment, wait for it to finish before requesting a manual redeploy.

Build-time values live in `deploy/build.env`. Every one ships in the HTML, so the file holds only `NEXT_PUBLIC_*` values; CI fails if anything else appears there. Runtime secrets stay in `/opt/memecatch/.env`, which is not in git. Responses carry `X-MemeCatch-Release-Sha`.

## Axum in front of Next (`MEMECATCH_AXUM`)

`docs/axum-migration/PLAN.md` moves routes from Next to an Axum server (`server/`) one at a time. One flag decides which layout a deploy produces. `scripts/deploy-oci.sh` and the deploy agent read it like `MEMECATCH_CADDY`: from the environment first, then from `/opt/memecatch/.env`. Only the value `1` turns it on.

| | Flag off (default) | `MEMECATCH_AXUM=1` |
| --- | --- | --- |
| Compose files | `docker-compose.yml` and the Caddy file | the same, then `docker-compose.axum.yml` |
| `app`, which Caddy and the scheduler reach on `app:3000` | the Next image `memecatch:release-<sha>` | the Axum image `memecatch-server:release-<sha>` |
| `next` | does not exist; one left by an earlier deploy is removed | the Next image, on `next:3001`, reached only by `app` |
| Health gate of `deploy-oci.sh` | `/api/health` answers | `/api/health` answers (Axum's, which asks Next) and both containers are healthy |
| CI the agent requires | `check` | `check` and `server` |
| Images the agent builds | Next, worker, scheduler, backup | the same and the Axum image, after the disk check below |
| A release is running when | `app` is healthy on the commit's image | `app` and `next` both are |
| Rollback snapshot | `app`, worker, scheduler, backup | the same and `next` |

With the flag off, the plan `DEPLOY_OCI_PRINT_PLAN=1` prints and the `docker compose` commands the script runs are the ones it ran before the flag existed. The one addition is a `docker ps` that looks for a `next` container to remove.

Both images of a release are built with the same build arguments, `RELEASE_SHA` and every line of `deploy/build.env`, and keep `RELEASE_SHA`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_ID` and `NEXT_PUBLIC_ADSENSE_CLIENT` in their image environment. Next fixes its response headers and the analytics tags of its pages from them when it is built and Axum reads them when it starts, so `.env` cannot make the two disagree. The Axum container gets from `.env` only the variables the server reads (`docker-compose.axum.yml` lists them); the others stay with Next, whose routes still use them.

### What a deploy does with the flag on

1. `next` comes up with the new Next image, and the script waits up to 180 s for its health check. `app` is not touched yet. If Next never becomes healthy the script stops here and the agent rolls back.
2. `app` is replaced with the new Axum image, by itself.
3. Everything else is brought up to date (`docker compose up -d`).
4. The health gate passes when `/api/health` answers and both containers report healthy.

Measured in a rehearsal on an isolated Docker 29.10 / Compose 5.7.1 daemon, with `GET /` through Caddy requested every 0.1 s (the site "does not answer" when that is not a 200). Each new commit changed the Next, Axum and worker images.

| Deploy | Site did not answer for |
| --- | --- |
| New commit, flag off (today; two runs) | 10.6 s and 4.2 s |
| New commit, flag on | 2.1 s, while `next` restarts |
| Turn the flag on (redeploy of the running commit; two runs) | 0 s and 0.2 s |
| Turn the flag off (redeploy of the running commit) | 0.4 s; 10.9 s right after a rollback, see below |
| New commit whose Next never becomes healthy, flag on | 132.4 s, until the rollback restored the previous pair |
| The same broken commit, flag off (today) | 144.1 s, until the rollback |

Today's window is not only Next starting: a recreated Next answers again after about 2 s. A new commit also changes the worker image, `docker compose up -d` replaces `app` and the worker in one batch, and it starts neither until both old containers have stopped. The worker can take most of its 10 s grace period to stop, so the window varies from run to run. With the flag on the script replaces `next` on its own while the old Axum keeps listening, then `app` on its own (0.3 s), so only Next's start remains. Shorter would need the old and new Next side by side, which one compose service with a fixed container name cannot do. The flag-off path is left as it was, so turning the flag off pays today's window whenever the worker image changes too: right after a rollback the worker runs its rollback tag, the off redeploy puts it back on `memecatch-worker:local`, and the site was down 10.9 s.

A Next that never becomes healthy takes the site down with the flag on as without it. `next` is replaced before its health check can pass, and Axum then proxies to it, so pages get 502 until the health check gives up (12 tries, 10 s apart) and the agent restores the snapshot.

While `next` restarts, Axum still answers the routes it serves itself; pages get a 502.

Axum stops in about 0.2 s, idle or under load. It takes the whole 10 s grace period, and is then killed, when a client has sent only part of a request (reproduced with half a request line). `app` has no listener during that time. Slow uploads through Caddy could do the same in production; that was not measured.

### Turn it on

Check first:

- The release that contains this section is deployed and the agent has replaced itself with it: `cmp /var/lib/memecatch-autodeploy/bin/autodeploy.sh /opt/memecatch/deploy/autodeploy/autodeploy.sh` prints nothing. An older agent does not know the flag: it would not ask for the `server` check, check the disk, or look at `next`.
- The `server` job of the commit on `main` is green.
- `df -m "$(docker info --format '{{.DockerRootDir}}')"` shows at least 4,000 MB available (see "Disk").
- Memory and connections: for up to a minute the old `app` (Next) and the new `next` both run, each with a 2,816 MB limit and its own database pool of up to 10 connections.

Then:

```bash
cd /opt/memecatch
printf 'MEMECATCH_AXUM=1\n' >> .env
```

and run **Manual production redeploy** in GitHub Actions (see above). The flag is read at the start of a deploy, so without a redeploy it takes effect with the next commit on `main`. Afterwards `docker ps` shows `memecatch-app-1` on `memecatch-server:release-<sha>` and `memecatch-next-1` on `memecatch:release-<sha>`, both healthy.

To hand one route back to Next without leaving Axum, set `AXUM_DISABLED_ROUTES` instead (`docs/axum-migration/PLAN.md`).

### Turn it off

This is the rollback for the whole switch. Remove the line from `.env` (or set any other value) and run **Manual production redeploy**. `app` becomes Next again and the `next` container is removed, and only it.

Without GitHub, on the VM, for the release that is running:

```bash
cd /opt/memecatch
sha="$(docker image inspect "$(docker inspect memecatch-next-1 --format '{{.Image}}')" --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^RELEASE_SHA=//p')"
MEMECATCH_AXUM=0 RELEASE_SHA="$sha" MEMECATCH_IMAGE="memecatch:release-$sha" bash scripts/deploy-oci.sh
```

Remove the flag from `.env` as well, or the next deploy turns Axum on again.

A failed deploy needs no action: the agent restores the images its snapshot recorded, with Axum in front if the snapshot was taken from an Axum release and without it otherwise, whatever the flag says at that moment.

### Disk

The Axum image is built on the VM, and Postgres keeps its data on the same disk. Before it changes anything, the agent reads the free space of Docker's data directory and refuses to deploy below `AUTODEPLOY_SERVER_BUILD_MIN_FREE_MB` (default 4000). The message names the figure and the variable; nothing has been changed when it appears. Set the variable in the agent's environment or in `/opt/memecatch/.env`; the SSH forced command gets its settings from the env file.

Where the default comes from, measured on an arm64 machine:

| Build of `Dockerfile.server` | Time on 2 CPUs | Written to Docker's disk | Left behind |
| --- | --- | --- | --- |
| Nothing cached (base image, crates, dependencies) | 128 s | 1,738 MB | 1,738 MB of build cache |
| A change under `server/src` | 28 s | 39 MB | 39 MB |
| A new commit that leaves `server/` alone | 1 s | 0 MB | 0 MB |

The first row is in a private BuildKit pinned to two cores; the final image (150 MB) is not in it. In the rehearsal a deploy of a new commit with the flag off, which builds only the Next and worker images, wrote 1,845 and 1,922 MB; with the flag on, the Axum build reusing its cache, 1,896 MB. 1,738 + 1,922 + 150 is 3.8 GB, rounded up to 4,000 MB. The agent holds every deploy to that figure, because Docker's cache collection or a `docker builder prune` can make any build a cold one.

`docker builder prune` frees build cache when the agent refuses. The next deploy is then a cold build of every image.

### Axum's CPU limit

Every request passes through Axum. Measured in the rehearsal with the containers' production limits (Next 0.75 CPU, Postgres 0.5), 16 connections, 15 s per run, the load generator outside the containers; "throttled" is the share of 100 ms scheduler periods in which the Axum container ran out of quota.

| Request | Next alone | Axum at 0.25 | Axum at 0.30 | Axum at 0.35 |
| --- | --- | --- | --- | --- |
| `/` (page, proxied) | 435 req/s, p99 141 ms | 493 req/s flat out, 0.05 CPU, never throttled | the same | the same |
| `/robots.txt` (native) | 1,865 req/s | at that rate: p99 1.3 ms, 0.06 CPU, never throttled; 22,790 req/s flat out | the same | the same |
| `/api/random-meme` (native, one query) | 607 req/s, p99 105 ms | at 607 req/s: throttled 25 %, p99 73 ms | throttled 1 %, p99 11 ms | throttled 0 %, p99 9 ms |
| `/api/health` (native, asks Postgres and Next) | 1,772 req/s | throttled 45 %, 1,399 req/s | throttled 2 % | throttled 0 % |

Axum's `/api/health` never reaches Next's own rate because each request also asks Next; at 0.30 and above that, not the CPU limit, is what holds it back. With Next, Axum and Postgres pinned to two cores, as the VM has, Next alone reaches only 546 req/s on `/api/random-meme` and no limit was throttled there; `/api/health` was throttled in 2 % of periods at 0.25 and none above. 0.35 is the smallest limit that was not throttled at a load Next alone sustains in either setup, so `docker-compose.axum.yml` sets it. Next's own limit is what caps pages: its container was throttled in 100 % of periods on `/`.

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

The VM is the only production origin. Roll back by redeploying the previous image tag with `scripts/deploy-oci.sh` (with `MEMECATCH_AXUM=1` the previous pair: `MEMECATCH_IMAGE` and `MEMECATCH_SERVER_IMAGE`; to leave Axum altogether see "Turn it off"); restore data from the latest R2 backup with `deploy/backup/restore.sh` if a migration went wrong.
