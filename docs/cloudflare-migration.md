# Cloudflare migration

memeCatch can run on Cloudflare Workers through OpenNext while the Vercel project stays in place. This change does not edit DNS, the Vercel project, or the Cloudflare account. `vercel.json` stays so the current Vercel deploy keeps its nine crons until cutover.

The production Worker is `memecatch`. Pull requests deploy a separate Worker, `memecatch-preview`, because the production Worker uses a Durable Object and cannot publish version preview URLs. Preview does not run the production crons.

## What cannot run on the Worker

The bundled ONNX embedding model (`intfloat/multilingual-e5-small`) is not part of the Worker build. `MEMECATCH_RUNTIME=cloudflare` replaces `lib/meme-embedding-pipeline.server.ts` with a stub, so the Worker graph never parses `@huggingface/transformers` or the ONNX runtimes, and the model is omitted from the file trace. The meme-embeddings cron returns `{ "ok": true, "status": "skipped", "reason": "onnx_unavailable_on_workers" }` until `MEME_EMBEDDING_RUNTIME` is not `bundled` and `MEME_EMBEDDING_URL` points at an external embedding server. Semantic search then uses that server. Without it, search stays lexical.

Bedrock on Vercel still uses OIDC when `VERCEL` and `AWS_ROLE_ARN` are set. Off Vercel, including the Worker, the client uses `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` when both are set, and otherwise the normal AWS credential chain.

On Vercel the release header is `VERCEL_GIT_COMMIT_SHA`. A project `RELEASE_SHA` does not override that platform SHA. Off Vercel the header is `RELEASE_SHA`, and on the Worker a missing header is filled from the Workers version metadata id.

`www.catchmeme.com` returns 308 to `https://catchmeme.com` with the path and query preserved. A Cloudflare Redirect Rule for the same redirect is the preferred edge config once the zone is on Cloudflare:

- Match hostname `www.catchmeme.com`
- Dynamic redirect expression: `concat("https://catchmeme.com", http.request.uri.path, if(len(http.request.uri.query) > 0, concat("?", http.request.uri.query), ""))`
- Status 308

The Worker redirect covers the hostname when the request still reaches the Worker.

## Cache, crons, and deploys

The detail route is force-dynamic. A catalog row renders the document. A confirmed empty lookup of an id with no curated card is a 404. A provider error for that id is the 200 screen "이 밈을 잠시 불러오지 못했어요". None of those HTTP responses is stored as another state's document. `lib/detail-document-state.ts` is the state model. `scripts/opennext-detail-states.mjs` proves it against the OpenNext preview, not `next start`: after an outage, a miss, or a success, the next request follows the live catalog read.

OpenNext stores the incremental cache in R2 (`NEXT_INC_CACHE_R2_BUCKET`, bucket `memecatch-next-cache`, separate from the uploads bucket in `R2_BUCKET`), revalidation tags in D1 (`NEXT_TAG_CACHE_D1`), and the revalidation queue in the `DOQueueHandler` Durable Object. That is the support the unmerged detail-page data cache (PR 45, tag `public-meme-catalog`) needs. This branch does not include that cache. After either PR merges, rebase the other. The expected file overlap is empty. Only a successful catalog row may enter that data cache. An error must not replace a stored row, and an empty read is a miss, not an outage.

Eight cron expressions match `vercel.json`. `15 0 * * *` dispatches both `/api/cron/growth-baseline` and `/api/cron/plus-expiry-reminders`. A non-2xx cron response is logged as `cron_dispatched` and does not fail the scheduled invocation. `/api/cron/mcp-events` is not a Vercel cron and is not added here.

GitHub Actions deploys a preview Worker on a pull request and the production Worker on a push to `main`. Both jobs skip when `CLOUDFLARE_API_TOKEN` or `CLOUDFLARE_ACCOUNT_ID` is missing. Production is gated by the GitHub Environment `production`. Preview URLs on `workers.dev` are public until an access policy is added.

## Workers Paid

These limits are from the [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) page:

| Limit | Free | Paid |
| --- | --- | --- |
| CPU time | 10 ms | 5 min (default 30 seconds; this config sets 300,000 ms) |
| Environment variables per Worker, secrets and plain text together | 64 | 128 |
| Environment variable size | 5 KB | 5 KB |
| Cron triggers per account | 5 | 250 |
| Worker size | 64 MiB | 64 MiB |

Paid is required for three reasons. Server rendering and crons exceed 10 ms of CPU. Production migrates 84 names (29 secrets and 55 plain-text vars), which is over the Free cap of 64 and under the Paid cap of 128. Preview adds `MEMECATCH_DEPLOYMENT`, for 85 names. The account needs 8 cron triggers, and Free allows 5.

## Environment variables

The audit scanned `process.env` and `env` reads under `app`, `lib`, `components`, `scripts`, `proxy.ts`, `next.config.ts`, and `integrations/memecatch-chatgpt/src` (imported by the MCP routes). Terraform is excluded. The Vercel project has 71 names. Only names the code reads are migrated. `scripts/cloudflare-env-manifest.json` is the machine-readable list: name, `var` or `secret`, and target environments. It stores no values. `node scripts/check-cloudflare-env-manifest.mjs` fails when code reads a name that is not in the manifest, and when these tables drift from it.

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are production-only on the current Vercel project, so a Vercel preview cannot create a Supabase client. Protected routes then redirect to login. Public routes continue, and a catalog read that cannot start renders the outage screen. Enable those two names for Preview when that environment should read the catalog.

`NEXT_PUBLIC_*` values are inlined by `next build`. Set them as GitHub Actions secrets for the deploy build, and as Worker vars for any server read that still sees `process.env` at runtime. `CSP_ENFORCE`, `CSP_REPORT_URI`, and `RELEASE_SHA` are read while the Next config loads, so the build needs them too. `MEMECATCH_RUNTIME=cloudflare` is already a var in `wrangler.jsonc`. Preview also sets `MEMECATCH_DEPLOYMENT=preview`.

Script-only names, Node builtins (`NODE_ENV`, `PATH`), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and the `CF_VERSION_METADATA` binding are in the manifest with no target environment. The apply script does not upload them. Do not put the API token on the Worker.

Apply exported values for one environment. The shell must already contain the values. The script prints names only.

```bash
node scripts/apply-cloudflare-env.mjs --env production --dry-run
node scripts/apply-cloudflare-env.mjs --env production
node scripts/apply-cloudflare-env.mjs --env preview
```

Secrets go through `wrangler secret bulk`, the batch form of `wrangler secret put`, from a temporary file that is deleted afterward. Values are not process arguments. Plain-text vars are merged into the Worker settings. The script reads the current bindings first and sends existing secrets back by name only. Deploy the Worker once before the first apply. A missing Worker, or a settings write the API rejects, stops the script without printing values.

### USED

<!-- env-used:start -->
| Name | Kind | Environments | Where it is read |
| --- | --- | --- | --- |
| `ADPICK_AFFILIATE_ID` | secret | production, preview | `app/go/products/[id]/route.test.ts`, `lib/affiliate/product-redirect.ts`, `lib/affiliate/sync.server.ts` |
| `ADSENSE_AUTO_ADS_ENABLED` | var | production, preview | `components/adsense-script.tsx` |
| `AWS_ACCESS_KEY_ID` | secret | production, preview | `lib/meme-studio-bedrock.server.ts` |
| `AWS_REGION` | var | production, preview | `lib/meme-studio-bedrock.server.ts` |
| `AWS_ROLE_ARN` | var | production, preview | `lib/meme-studio-bedrock.server.ts` |
| `AWS_SECRET_ACCESS_KEY` | secret | production, preview | `lib/meme-studio-bedrock.server.ts` |
| `BEDROCK_MEME_STUDIO_ENABLED` | var | production, preview | `lib/meme-studio-bedrock.server.ts` |
| `BEDROCK_MEME_STUDIO_INPUT_NANO_USD_PER_TOKEN` | var | production, preview | `lib/meme-studio-bedrock.server.ts` |
| `BEDROCK_MEME_STUDIO_OUTPUT_NANO_USD_PER_TOKEN` | var | production, preview | `lib/meme-studio-bedrock.server.ts` |
| `CRON_SECRET` | secret | production, preview | `app/api/cron/adpick-hotdeals/route.test.ts`, `app/api/cron/growth-baseline/route.ts`, `app/api/cron/mcp-events/route.js` |
| `CSP_ENFORCE` | var | production, preview | `next.config.ts` |
| `CSP_REPORT_URI` | var | production, preview | `next.config.ts` |
| `FAIRY_PLUS_ENABLED` | var | production, preview | `lib/billing/fairy.server.ts` |
| `FAIRY_PLUS_MIN_AMOUNT_KRW` | var | production, preview | `lib/billing/fairy.server.ts` |
| `FAIRY_PROJECT_SLUG` | var | production, preview | `lib/billing/fairy.server.ts` |
| `FAIRY_WEBHOOK_SECRET` | secret | production, preview | `lib/billing/fairy.server.ts` |
| `GA4_PROPERTY_ID` | var | production, preview | `lib/ga4-admin.ts` |
| `GA4_SERVICE_ACCOUNT_EMAIL` | secret | production, preview | `lib/ga4-admin.ts` |
| `GA4_SERVICE_ACCOUNT_PRIVATE_KEY` | secret | production, preview | `lib/ga4-admin.ts` |
| `LATPEED_MEMBERSHIP_PRODUCT_ID` | var | production, preview | `app/api/billing/latpeed/webhook/route.ts` |
| `LATPEED_WEBHOOK_SECRET` | secret | production, preview | `app/api/billing/latpeed/webhook/route.ts` |
| `MCP_EVENT_CALLBACK_ORIGINS` | var | production, preview | `integrations/memecatch-chatgpt/src/state.mjs` |
| `MCP_EVENT_RETRY_TOKEN` | secret | production, preview | `app/api/cron/mcp-events/route.js` |
| `MCP_EVENT_STATE_KEY` | secret | production, preview | `integrations/memecatch-chatgpt/src/state.mjs` |
| `MCP_GITHUB_WEBHOOK_SECRET` | secret | production, preview | `app/api/mcp-operator/github/route.js` |
| `MEMECATCH_DEPLOYMENT` | var | preview | `components/adsense-script.tsx` |
| `MEMECATCH_RUNTIME` | var | production, preview | `app/api/cron/meme-embeddings/route.test.ts`, `lib/meme-chat.server.ts`, `lib/meme-embedding-host.ts` |
| `MEME_CHAT_API_KEY` | secret | production, preview | `lib/meme-chat.server.ts` |
| `MEME_CHAT_BASE_URL` | var | production, preview | `lib/meme-chat.server.ts` |
| `MEME_CHAT_GENERATION_ENABLED` | var | production, preview | `lib/meme-chat.server.ts` |
| `MEME_CHAT_MODEL` | var | production, preview | `lib/meme-chat.server.ts` |
| `MEME_CHAT_PROVIDER` | var | production, preview | `lib/meme-chat.server.ts` |
| `MEME_EMBEDDING_API_KEY` | secret | production, preview | `lib/meme-embedding-runtime.server.ts`, `lib/meme-vector-lookup.server.ts` |
| `MEME_EMBEDDING_REINDEX_ENABLED` | var | production, preview | `app/api/cron/meme-embeddings/route.test.ts`, `lib/meme-embedding-host.ts` |
| `MEME_EMBEDDING_RUNTIME` | var | production, preview | `app/v1/embeddings/route.ts`, `lib/meme-embedding-host.ts`, `lib/meme-embedding-runtime.server.ts` |
| `MEME_EMBEDDING_URL` | var | production, preview | `lib/meme-embedding-host.ts`, `lib/meme-embedding-runtime.server.ts`, `lib/meme-vector-lookup.server.ts` |
| `MEME_SEMANTIC_SEARCH_ENABLED` | var | production, preview | `lib/meme-vector-lookup.server.ts` |
| `META_GRAPH_API_VERSION` | var | production, preview | `lib/oembed.ts`, `lib/trend/radar-platform-connectors.server.test.ts`, `lib/trend/radar-platform-connectors.server.ts` |
| `META_INSTAGRAM_ACCESS_TOKEN` | secret | production, preview | `lib/trend/radar-platform-connectors.server.test.ts`, `lib/trend/radar-platform-connectors.server.ts` |
| `META_INSTAGRAM_USER_ID` | var | production, preview | `lib/trend/radar-platform-connectors.server.test.ts`, `lib/trend/radar-platform-connectors.server.ts` |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | var | production, preview | `app/_root/metadata.ts`, `components/adsense-script.test.tsx`, `components/adsense-script.tsx` |
| `NEXT_PUBLIC_COMMUNITY_ENABLED` | var | production, preview | `lib/flags.ts` |
| `NEXT_PUBLIC_GA_ID` | var | production, preview | `app/_root/root-document.tsx` |
| `NEXT_PUBLIC_SITE_URL` | var | production, preview | `app/(default)/memes/random/route.ts`, `lib/actions/admin-users.ts`, `lib/house-original.ts` |
| `NEXT_PUBLIC_SUBMISSIONS_OPEN` | var | production, preview | `lib/flags.ts` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | var | production, preview | `lib/meme-collectible.server.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts` |
| `NEXT_PUBLIC_SUPABASE_URL` | var | production, preview | `app/sw.ts`, `lib/meme-collectible.server.ts`, `lib/supabase/admin.ts` |
| `NEXT_PUBLIC_UNIFI_CLIENT_ID` | var | production, preview | `app/(default)/login/login-form.tsx` |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | var | production, preview | `app/api/web-push/subscription/route.ts`, `lib/web-push/server.ts` |
| `OPENAI_API_KEY` | secret | production, preview | `app/(default)/admin/memes/[id]/page.tsx`, `app/(default)/admin/submissions/[id]/page.tsx`, `app/(default)/admin/translations/page.tsx` |
| `OPENAI_REVIEW_BASE_URL` | var | production, preview | `lib/openai-review.server.ts` |
| `OPENROUTER_API_KEY` | secret | production, preview | `lib/meme-chat.server.ts`, `lib/mpe/openrouter.server.ts`, `scripts/mpe-media-worker.mjs` |
| `OPENROUTER_BASE_URL` | var | production, preview | `lib/meme-chat.server.ts`, `lib/mpe/openrouter.server.ts` |
| `OPENROUTER_MPE_MODEL` | var | production, preview | `lib/mpe/openrouter.server.ts` |
| `PLUS_DIGEST_DELIVERY_TOKEN` | secret | production, preview | `lib/plus-daily-signal-delivery.server.ts`, `lib/plus-expiry-reminder-delivery.server.ts`, `lib/trend/outbox.server.ts` |
| `PLUS_DIGEST_DELIVERY_URL` | var | production, preview | `lib/plus-daily-signal-delivery.server.ts`, `lib/plus-expiry-reminder-delivery.server.ts`, `lib/trend/outbox.server.ts` |
| `PLUS_DIGEST_FROM_EMAIL` | var | production, preview | `lib/plus-daily-signal-delivery.server.ts`, `lib/plus-expiry-reminder-delivery.server.ts`, `lib/trend/outbox.server.ts` |
| `R2_ACCESS_KEY_ID` | secret | production, preview | `lib/r2.server.ts` |
| `R2_ACCOUNT_ID` | var | production, preview | `lib/r2.server.ts` |
| `R2_BUCKET` | var | production, preview | `lib/r2.server.ts` |
| `R2_SECRET_ACCESS_KEY` | secret | production, preview | `lib/r2.server.ts` |
| `RADAR_INSTAGRAM_HASHTAGS` | var | production, preview | `lib/trend/radar-platform-connectors.server.test.ts`, `lib/trend/radar-platform-connectors.server.ts` |
| `RADAR_THREADS_TERMS` | var | production, preview | `lib/trend/radar-platform-connectors.server.test.ts`, `lib/trend/radar-platform-connectors.server.ts` |
| `RADAR_X_TERMS` | var | production, preview | `lib/trend/radar-platform-connectors.server.test.ts`, `lib/trend/radar-platform-connectors.server.ts` |
| `RELEASE_SHA` | var | production, preview | `lib/cloudflare-host.ts`, `lib/release-sha.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | production, preview | `app/api/analytics/events/route.ts`, `app/api/cron/meme-embeddings/route.test.ts`, `app/api/cron/meme-embeddings/route.ts` |
| `THREADS_ACCESS_TOKEN` | secret | production, preview | `lib/trend/radar-platform-connectors.server.test.ts`, `lib/trend/radar-platform-connectors.server.ts` |
| `TIKTOK_CLIENT_KEY` | secret | production, preview | `lib/tiktok-auth.server.test.ts`, `lib/tiktok-auth.server.ts` |
| `TIKTOK_CLIENT_SECRET` | secret | production, preview | `lib/tiktok-auth.server.test.ts`, `lib/tiktok-auth.server.ts` |
| `TIKTOK_REDIRECT_URI` | var | production, preview | `lib/tiktok-auth.server.ts` |
| `UNIFI_PAY_API_KEY` | secret | production, preview | `lib/billing/unifi-pay.server.ts` |
| `UNIFI_PAY_API_SECRET` | secret | production, preview | `lib/billing/unifi-pay.server.ts` |
| `UNIFI_PAY_BASE_URL` | var | production, preview | `lib/billing/unifi-pay.server.ts` |
| `UNIFI_PAY_CALLBACK_BASE_URL` | var | production, preview | `lib/billing/unifi-pay.server.ts` |
| `UNIFI_PAY_CHECKOUT_ENABLED` | var | production, preview | `app/(default)/pricing/page.tsx`, `app/[locale]/pricing/page.tsx`, `app/api/billing/checkout/route.ts` |
| `UNIFI_PAY_CURRENCY` | var | production, preview | `lib/billing/unifi-pay.server.ts` |
| `UNIFI_PAY_ITEM_NAME` | var | production, preview | `lib/billing/unifi-pay.server.ts` |
| `UNIFI_PAY_ITEM_PRICE` | var | production, preview | `lib/billing/unifi-pay.server.ts` |
| `UNIFI_PAY_RETURN_BASE_URL` | var | production, preview | `lib/billing/unifi-pay.server.ts` |
| `UNIFI_PAY_SERVICE_NAME` | var | production, preview | `lib/billing/unifi-pay.server.ts` |
| `UNIFI_PAY_STORE_ID` | secret | production, preview | `lib/billing/unifi-pay.server.ts` |
| `VAPID_PRIVATE_KEY` | secret | production, preview | `lib/web-push/server.ts` |
| `VAPID_SUBJECT` | var | production, preview | `lib/web-push/server.ts` |
| `X_API_BEARER_TOKEN` | secret | production, preview | `lib/trend/radar-platform-connectors.server.test.ts`, `lib/trend/radar-platform-connectors.server.ts` |
| `YOUTUBE_API_KEY` | secret | production, preview | `lib/sources/youtube.server.ts`, `scripts/discover-youtube-candidates.mjs`, `scripts/refresh-youtube-sources.mjs` |
<!-- env-used:end -->

### UNUSED

<!-- env-unused:start -->
| Name | Why it stays on Vercel |
| --- | --- |
| `LATPEED_MEMBERSHIP_URL` | Present in the Vercel project and not read by the app. Do not migrate. |
| `MEME_LAYA_ROUTING_ENABLED` | Present in the Vercel project and not read by the app. Do not migrate. |
| `RADAR_AI_DRAFT_DAILY_LIMIT` | Present in the Vercel project and not read by the app. Do not migrate. |
| `RADAR_AI_DRAFT_ENABLED` | Present in the Vercel project and not read by the app. Do not migrate. |
| `RADAR_CANDIDATE_TRACKING_CALL_BUDGET_PER_RUN` | Present in the Vercel project and not read by the app. Do not migrate. |
| `RADAR_DISCOVERY_DAILY_CANDIDATE_LIMIT` | Present in the Vercel project and not read by the app. Do not migrate. |
| `RADAR_DISCOVERY_ENABLED` | Present in the Vercel project and not read by the app. Do not migrate. |
| `RADAR_NEW_DISCOVERY_CALL_BUDGET_PER_RUN` | Present in the Vercel project and not read by the app. Do not migrate. |
| `RADAR_YOUTUBE_DAILY_CALL_LIMIT` | Present in the Vercel project and not read by the app. Do not migrate. |
| `SOURCE_REFRESH_ENABLED` | Present in the Vercel project and not read by the app. Do not migrate. |
| `SOURCE_REVIEW_ATOMIC_ENABLED` | Present in the Vercel project and not read by the app. Do not migrate. |
| `TREND_CRON_SECRET` | Present in the Vercel project and not read by the app. Do not migrate. |
<!-- env-unused:end -->

### Vercel-only

<!-- env-vercel-only:start -->
| Name | Why it stays on Vercel |
| --- | --- |
| `VERCEL` | Do not migrate. Vercel platform setting or a Vercel-only flag. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Do not migrate. Vercel platform setting or a Vercel-only flag. |
| `VERCEL_ENV` | Do not migrate. Vercel platform setting or a Vercel-only flag. |
| `VERCEL_GIT_COMMIT_SHA` | Do not migrate. Vercel platform setting or a Vercel-only flag. |
| `VERCEL_SUPPORT_LARGE_FUNCTIONS` | Do not migrate. Vercel platform setting or a Vercel-only flag. |
| `VERCEL_URL` | Do not migrate. Vercel platform setting or a Vercel-only flag. |
<!-- env-vercel-only:end -->

## Cloudflare dashboard

Do these in the Cloudflare account before the first real deploy. This repository does not create them.

1. Upgrade the account to Workers Paid. The reasons are CPU, 84 production env names, and 8 cron triggers.
2. Enable R2.
3. Create the cache buckets `memecatch-next-cache` and `memecatch-next-cache-preview`. Leave the existing uploads bucket (`R2_BUCKET`, the S3 API bucket) alone.
4. Create the D1 databases `memecatch-next-tag-cache` and `memecatch-next-tag-cache-preview`. Replace the placeholder `database_id` values in `wrangler.jsonc` with the ids Wrangler prints. The placeholders are `00000000-0000-4000-8000-000000000001` and `00000000-0000-4000-8000-000000000002`.
5. Let the first OpenNext deploy create the D1 `revalidations` table (`tag`, `revalidatedAt`, `stale`, `expire`). The deploy command runs that `CREATE TABLE IF NOT EXISTS`.
6. Confirm the Durable Object migration `v1` for `DOQueueHandler` is applied by `wrangler deploy`. Do not create a second queue class.
7. Add the www 308 Redirect Rule above when the zone exists.
8. Preview `workers.dev` URLs are public. Add an Access policy if the preview Worker should not be public.

## GitHub

Repository secrets:

- `CLOUDFLARE_API_TOKEN` with Workers Scripts edit and the R2 and D1 permissions Wrangler needs for this config
- `CLOUDFLARE_ACCOUNT_ID`
- The `NEXT_PUBLIC_*` names from the USED table, so the deploy build can inline them
- `RELEASE_SHA` is set by the workflow from `github.sha`. A dashboard value is optional.

Create a GitHub Environment named `production` and let it read those secrets. The production job waits on that environment's protection rules. Until the two Cloudflare secrets exist, both deploy jobs skip and stay green.

The weekly `dependency-audit` workflow runs `pnpm audit --audit-level=high`. It does not run on pull requests.

## DNS cutover

Do this only when the Worker is already serving the site. Nameservers today are `ns1.cafe24.com`, `ns2.cafe24.com`, `ns1.cafe24.co.kr`, and `ns2.cafe24.co.kr`. The apex A record is `216.198.79.1` (Vercel). `www` is a CNAME.

1. Add the zone `catchmeme.com` to Cloudflare and copy the existing records before changing nameservers.
2. At Cafe24, replace the four nameservers with the two Cloudflare assigns.
3. Point the apex at the Worker (Cloudflare proxied custom domain on `memecatch`) and point `www` at the same zone with the 308 rule.
4. Keep the Vercel project deployed.

Rollback: point the Cafe24 nameservers back, or point the apex A record back to `216.198.79.1` and restore the `www` CNAME, so traffic returns to Vercel. Do not delete the Vercel project as part of the rollback.

## Owner checklist

1. Workers Paid, R2 enabled, both cache buckets, both D1 databases, and the real D1 ids written into `wrangler.jsonc`.
2. `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` created for Bedrock. They are new. Vercel OIDC stays for the Vercel deploy.
3. Export the USED values and run `node scripts/apply-cloudflare-env.mjs --env production`, then the same command with `--env preview`. Confirm the dry-run prints names only.
4. Add the GitHub secrets and the `production` environment.
5. Decide whether the embeddings cron stays skipped or `MEME_EMBEDDING_URL` points at an external runtime.
6. Confirm a pull request comment contains the preview `workers.dev` URL, then merge when ready. This PR does not merge itself.
7. Cut DNS over, then check home, a meme document, a missing meme 404, and the outage copy if the database is unreachable.
8. Rollback path: send DNS back to Vercel and leave that project in place.
