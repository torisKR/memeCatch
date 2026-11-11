# Self-host migration

memeCatch leaves Vercel and Supabase for one Docker Compose project on the existing OCI VM `oci-hermes-dev`. This document is the audit of what Supabase and Vercel did, and what replaced each piece. Host sizing, Caddy, DNS, and cutover are in [oci-setup.md](./oci-setup.md).

## Hosting decision

Open pull request #46 deploys the app to Cloudflare Workers with OpenNext. This migration supersedes that hosting plan. The Workers adapter, wrangler config, ONNX stub, and D1 are not part of this stack. CI still installs ffmpeg and runs lint, `tsc`, and vitest, which is the useful part of that workflow.

Pull request #45 (detail-page cache) is unrelated and is not included.

## Data access

Application code still calls the supabase-js shape (`from`, `select`, filters, `rpc`, `auth`, `storage`). The server does not open a Supabase HTTP connection. `lib/db/plan.ts` records the call as a plan. `lib/db/execute.ts` turns that plan into parameterized SQL and runs it through Kysely and `pg`.

The browser cannot open Postgres. `lib/supabase/client.ts` posts the plan to `POST /api/db/query`. That route checks the site origin, reads the Better Auth session itself, and chooses the database role. The plan body cannot select a role.

Identifiers must match `/^[a-z_][a-z0-9_]*$/i`. Filter values are parameters. `limit` and `offset` are capped.

`lib/supabase/public-catalog-cache.ts` no longer wraps PostgREST fetch. The 60 second catalog cache that wrapper provided is gone. Pages that need a short cache have to add it themselves.

## Schema

`deploy/postgres/init.sh` loads, in order:

1. `deploy/postgres/00-bootstrap.sql`, which creates the roles and the Supabase-shaped schemas the migrations expect: `auth`, `storage`, `vault`, `net`, `cron`, and `extensions`.
2. The login role `memecatch`.
3. `supabase/migrations/*.sql`, in filename order, except the two seeds named below.
4. `deploy/postgres/99-app-identity.sql`.

Two lines are removed while applying: `create extension if not exists pg_net` and `create extension if not exists pg_cron`. `net.http_get` returns `0`. `cron.schedule` only inserts a row. Nothing in the database calls the public internet.

The image is `pgvector/pgvector:pg16`. `POSTGRES_USER` stays `postgres` because a migration grants to that role. The app connects as `memecatch`, which is `NOINHERIT` and can `SET ROLE` to `anon`, `authenticated`, or `service_role`.

These seeds are skipped on an empty database:

- `20261007083649_meme_collectible_catalog_seed.sql` expects 1000 approved memes. After the catalog restore, run `deploy/postgres/apply-catalog-seed.sh`.
- `20261103_seed_curated_memes.sql` inserts approved `house_original` rows and trips `house_original_insert_not_pending`. A restored production dump already has the curated rows.

## Authorization

Row Level Security stays. The policies still call `auth.uid()` and `auth.role()`. Those functions read the transaction settings `app.user_id` and `app.db_role`. Only the app sets those settings, after it has checked the Better Auth session. A client cannot send them.

Each request runs in one transaction: set the identity, `SET LOCAL ROLE`, set `search_path`, run the SQL, commit. `service_role` is `BYPASSRLS`, so the admin client is the only path that skips policies. `memecatch` does not inherit that privilege.

This replaces the Supabase JWT. It does not delete the policies. Connecting as the table owner would bypass them, so the app never does that.

## Auth

Better Auth stores users in the same Postgres. Email and password work with no outside account. Passwords must be at least 12 characters. Existing bcrypt hashes from Supabase still verify. New passwords are stored with Better Auth's scrypt hash.

| Method | What the owner must supply |
| --- | --- |
| Email and password | `BETTER_AUTH_SECRET` only |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, redirect `${SITE}/api/auth/callback/google` |
| Kakao | `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, redirect `${SITE}/api/auth/callback/kakao` |
| Kaia / Unifi wallet | `NEXT_PUBLIC_UNIFI_CLIENT_ID`. The server checks the personal signature. |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI` |
| Password reset mail | `AUTH_EMAIL_WEBHOOK`. The app POSTs `{to, subject, url}`. |

If a provider's env is empty, the button reports that the provider is not open yet. `/my`, `/premium`, `/submit`, and `/admin` redirect to `/login` when the session is missing or the database is down. Public meme pages still render if the detail lookup fails.

## Storage

Uploads use the existing R2 client when `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, and `R2_BUCKET` are set. Otherwise objects land on disk under `LOCAL_OBJECT_STORAGE_DIR` (default `/tmp/memecatch-objects`). Signed URLs are HMAC links to `/api/media/signed`.

Database dumps use `R2_BACKUP_BUCKET`. That can be the same account and a different bucket from uploads.

## Jobs

`vercel.json` crons move to `deploy/scheduler/crontab`. supercronic curls the app with `Authorization: Bearer $CRON_SECRET`:

| UTC | Path |
| --- | --- |
| 21:00 | `/api/cron/adpick-hotdeals` |
| 18:00 | `/api/cron/trend-pulse` |
| 17:00 | `/api/cron/source-refresh` |
| 01:00 | `/api/cron/plus-daily-signal` |
| 00:15 | `/api/cron/growth-baseline` and `/api/cron/plus-expiry-reminders` |
| 01:30 | `/api/cron/web-push` |
| 00:45 | `/api/cron/saved-state-emails` |
| 18:30 | `/api/cron/meme-embeddings` |

Embeddings run inside the app container when `MEME_EMBEDDING_RUNTIME=bundled`. The model is mounted at `/app/.local/embedding-models` and is not downloaded during the image build. The MPE worker keeps ffmpeg and runs as its own container.

There is no `supabase.channel()` usage. `onAuthStateChange` reads the session once. Nothing keeps a realtime socket open.

## Data move

`scripts/postgres/migrate-from-supabase.sh` dumps `public` plus `auth.users`, restores the data, copies bcrypt passwords into Better Auth, and runs `scripts/postgres/verify.sql` (row counts and an id checksum). It exits immediately unless `MEMECATCH_ALLOW_SUPABASE_DUMP=owner-approved`. Do not run it from CI or from an agent. The old Supabase project stays read-only until the owner decides the dump is good.

## Env manifest

`scripts/env-manifest.json` lists every env name the app, scripts, and compose files read, with a one-line purpose. `node scripts/check-env-manifest.mjs` fails when code reads a name that is not listed, or when the file lists a name nothing reads.
