# Video production worker

The video production worker is the service-role process for the reviewed MemeCatch video ledger. It renders only approved scripts and rights assets, stores immutable private artifacts, uploads to the configured MemeCatch YouTube channel as **private**, observes processing, applies separately approved visibility, verifies the public embed, links the video to the site, and monitors linked videos for removal or visibility drift.

It does not generate drafts, approve artifacts, approve publication, or import third-party video. Those remain operator actions in the admin workspace.

## Safety model

- One claimed job is processed at a time. A 60-second heartbeat renews the five-minute database lease, and the worker explicitly renews again before external mutations, upload chunks, durable writes, and job state changes.
- A lost lease stops processing without writing a completion or failure under a stale token.
- Resumable upload intent is stored before the initialization POST. The encrypted session capability is stored before any media PUT. An intent without a valid saved session is reconciliation-required and is never restarted as a second upload.
- Upload intent initially stores a null session capability; the encrypted Google `Location` is written only after it exists. Completion checkpoints the YouTube video ID before the full byte count so a later ledger-write failure cannot cause a second insert.
- Narration is generated from the exact reviewed script using the reviewed voice asset identity. Its SHA-256 is computed per render and persisted in renderer evidence; it is not pinned globally because different approved scripts necessarily produce different audio bytes. An optional per-job `expectedVoiceSha256` may pin deliberately operator-supplied audio.
- The MP4 downloaded from private storage must match both the approved SHA-256 and recorded byte size before upload.
- YouTube uploads start private. Public or unlisted visibility requires matching artifact hashes, completed processing, explicit publication approval, Studio review, and embeddability.
- Asset rights are re-evaluated at publication and site-link time rather than only at render time. A linked video's expired rights trigger atomic projection invalidation, a private-withdrawal job, and cache invalidation.
- After changing visibility, the worker reloads production, publication, and channel authorization. A concurrent block, approval/hash change, or connection revocation triggers an immediate private compensation attempt and a durable withdrawal job instead of a successful publication record.
- A remote deletion, private transition, embed denial, or processing regression removes the site projection before the job is stopped for reconciliation.
- Artifact and OAuth/session secrets are never included in job output or error messages.
- YouTube descriptions list only source IDs actually used by the reviewed script, followed by a deduplicated `제작 자산 표기` section containing non-empty reviewed asset attributions. The worker does not invent permission or ownership claims, and the existing 5,000-byte metadata preflight runs before upload initialization.
- Site cache refresh is a signed callback. Callback failure queues a bounded, backoff-delayed `sync` retry and is reported as pending; it is never represented as a successful cache clear.

## Required configuration

The worker intentionally does not load `.env` files. Inject configuration through the process environment or a secrets manager.

Base configuration:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL. Only localhost HTTP URLs are accepted unless `--allow-remote` is explicit. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-role key for worker RPCs, private ledger rows, and the private artifact bucket. |
| `VIDEO_WORKER_ID` | Optional stable worker identifier. |
| `YOUTUBE_EXPECTED_CHANNEL_ID` | Canonical OAuth/worker channel (`UC` plus 22 URL-safe characters). Defaults to `UCBxN8lUb-5dDuOPv-szpF4g`. |
| `YOUTUBE_TOKEN_ENCRYPTION_KEY` | Base64-encoded 32-byte key shared with the existing OAuth connection flow. |

Render configuration:

| Variable | Purpose |
| --- | --- |
| `VIDEO_NARRATION_PROVIDER` | `generic-https` (default) or explicit local `toris-qwen`. |
| `VIDEO_NARRATION_URL` | For `generic-https`, the HTTPS narration endpoint. For `toris-qwen`, an optional `http://127.0.0.1:<port>/synthesize` override; defaults to port `50010`. Other hosts and paths are rejected. |
| `VIDEO_NARRATION_API_KEY` | Bearer credential required only for `generic-https`. It is never sent to local Qwen. |
| `VIDEO_NARRATION_MODEL` | Expected `health.model` value from the local runtime. Defaults to `model`, the basename of Toris Studio's installed runtime model directory. |
| `VIDEO_NARRATION_SPEAKER` | Expected local Qwen speaker and requested speaker. Defaults to `Sohee`. |
| `VIDEO_NARRATION_LANGUAGE` | Expected local Qwen language and requested language. Defaults to `Korean`. |
| `VIDEO_NARRATION_INSTRUCT` | Optional reviewed delivery instruction sent only to local Qwen. |
| `VIDEO_NARRATION_TIMEOUT_MS` | Optional bounded synthesis timeout from 1,000 to 600,000 ms. Defaults to 90 seconds for `generic-https` and 300 seconds for `toris-qwen`. |
| `VIDEO_VOICE_ASSET_ID` | Reviewed `voice` rights-ledger asset ID, also sent to the narration service as `x-memecatch-voice-asset-id`. |
| `VIDEO_FONT_ASSET_ID` | Reviewed `font` rights-ledger asset ID. |
| `VIDEO_FONT_ASSET_SHA256` | Expected SHA-256 of `VIDEO_FONT_PATH`. |
| `VIDEO_FONT_FAMILY` | Validated internal font family used by both scene and caption renderers. Defaults to `Noto Sans CJK KR`. |
| `VIDEO_GRAPHIC_ASSET_ID` | Reviewed `graphic` rights-ledger asset ID. |
| `VIDEO_FONT_PATH` | Local licensed font file used by the original renderer. |
| `FC_MATCH_PATH` | Optional `fc-match` executable override for exact isolated font-selection verification. |
| `PANGO_VIEW_PATH` | Optional `pango-view` executable override for bounded FT2 glyph rasterization. |

Local Toris Studio narration is opt-in and does not approve voice or model rights automatically. Before synthesis the worker calls the same loopback origin's bounded `/health` endpoint and requires the expected Qwen MLX provider, runtime model-directory basename, speaker, and language. It then requires matching provider and speaker headers on the WAV response. The upstream repository identity (`mlx-community/Qwen3-TTS-12Hz-1.7B-CustomVoice-8bit` for the current installation), absolute `health.model_path`, local model hash, licensing evidence, and voice rights remain manual ledger review inputs; the worker does not infer them from the basename.

Rendered narration must finish within two seconds of the reviewed script timeline in either direction. The renderer may pad or trim only inside that bounded tolerance; per-scene semantic synchronization still requires manual review and approval.

The original renderer copies the narration and font into its private render workspace, hashes those pinned bytes again, and rejects either copy unless it still matches the approved asset binding. Only the pinned narration and pinned font are passed to later render stages. Production text is rasterized by `pango-view` in a per-job Fontconfig environment that contains only the copied approved font; `fc-match` must resolve both the requested family and exact copied file before rendering. SVG is used only for geometry because embedded SVG fonts are not a supported verification path. When FFmpeg provides libass, the caption worker also copies only that pinned font into an isolated temporary `fontsdir`, requires verbose font-load plus `fontselect` evidence, and returns the copied font hash. The original renderer checks that returned caption hash against the approved `fontSha256` before a technical pass can be recorded. FFmpeg builds without libass composite the verified Pango PNG text layers. Legacy MPE callers that omit both font options retain their existing Arial/fallback behavior and do not mutate the licensed-font environment.

`fc-match` and `pango-view` are therefore explicit renderer runtime requirements. Missing binaries, a family/file mismatch, a timeout, or an invalid glyph mask fails the render closed. They are installed in the current local verification environment; availability in the eventual production worker image must be established before release, and the worker does not install them automatically.

```sh
VIDEO_NARRATION_PROVIDER=toris-qwen \
VIDEO_NARRATION_MODEL=model \
VIDEO_NARRATION_SPEAKER=Sohee \
VIDEO_NARRATION_LANGUAGE=Korean \
node scripts/video-production-worker.mjs
```

YouTube and site-sync configuration:

| Variable | Purpose |
| --- | --- |
| `YOUTUBE_OAUTH_CLIENT_ID` / `YOUTUBE_OAUTH_CLIENT_SECRET` | OAuth client used by the existing connection flow and by the worker to refresh the stored channel token. |
| `VIDEO_SITE_SYNC_URL` | Strict CatchMeme HTTPS callback ending at `/api/admin/video-productions/worker-sync`. |
| `VIDEO_WORKER_WEBHOOK_SECRET` | Dedicated raw UTF-8 HMAC-SHA256 secret of at least 32 bytes. Do not reuse `CRON_SECRET`. |

The OAuth refresh-token envelope uses the same context as the existing connection flow: `youtube-channel:<channelId>`. Upload session envelopes use `youtube-upload:<publicationId>`.

## Commands

Run one eligible job against local Supabase (default):

```sh
node scripts/video-production-worker.mjs
```

Drain all currently eligible local jobs and exit:

```sh
node scripts/video-production-worker.mjs --drain
```

Continuously poll local jobs:

```sh
node scripts/video-production-worker.mjs --watch
```

Remote execution requires an explicit command-line gate in addition to injected credentials:

```sh
node scripts/video-production-worker.mjs --watch --allow-remote
```

Never use `--allow-remote` for local validation. The flag permits a remote database connection; it does not grant publication approval or bypass any ledger gate.

## Job behavior

| Kind | Worker action |
| --- | --- |
| `render` | Fetch bounded narration audio, bind its measured hash to the reviewed voice identity, verify the licensed font hash and rights IDs, render original 1080×1920 graphics, verify media, upload immutable MP4/poster, and record technical evidence. |
| `upload` | Revalidate production readiness, private artifact hash/size, OAuth channel ownership, and resumable state; upload as private and checkpoint the video ID before completing. |
| `check` | Read the authoritative owner-only YouTube video status. The worker emits only bounded processing/upload/rejection codes. The completion RPC requeues ordinary processing, but atomically terminalizes failed, terminated, rejected, or deadline-exceeded processing. |
| `publish` | Revalidate approval, hashes, Studio review, processing, and embed gates; set the approved visibility and read it back. |
| `sync` | Normal jobs run the real embed probe, complete/link atomically through the RPC, then call the signed site revalidation endpoint. Jobs explicitly marked `site_cache_refresh_pending` are cache-only retries: they revalidate ledger IDs/hashes and never repeat embed/link or YouTube work. |
| `withdraw` | Set the existing YouTube video to private and retain the ledger record. The video is not deleted. |
| `monitor` | Re-read remote state and run the same hash-bound anonymous embed probe used by sync. A healthy linked publication reports `embedVerified: true` only after real proof. Deletion, processing/embed failure, failed proof, or either `public`↔`unlisted` drift from the exact approved visibility is atomically unlinked before cache invalidation. |

## Failure and recovery

- OAuth `invalid_grant`, permission/quota restrictions, channel mismatch, ambiguous upload results, lost upload sessions, privacy restrictions, expired rights, and remote takedowns are permanent/reconciliation stops. They are not retried indefinitely.
- Ordinary renderer/provider/transport failures use the database job's bounded attempt count and exponential retry schedule.
- Bounded YouTube `Retry-After` values from incomplete uploads, HTTP 429, and retryable 5xx responses are passed to the failure RPC. The database retry time is the later of its exponential backoff and the provider deadline, capped at 24 hours.
- If an upload, publication, or withdrawal may have succeeded but the database completion fails, the job is reconciliation-required. Do not start a new external mutation.
- Blocked productions may run only their already-authorized private withdrawal and hash-bound cache-only retries. Every other worker action remains closed.
- Reconciliation must use the existing operator command and known YouTube video ID. Never infer ownership from a title or search result.
- The worker never hard-deletes a YouTube video. Withdrawal is private-first and confirmation is read back from YouTube.

## Verification

Run the isolated protocol tests without credentials or network access:

```sh
node --test scripts/video-production-worker.test.mjs
pnpm exec eslint --no-ignore scripts/video-production-worker.mjs scripts/video-production-worker.test.mjs
```

The test suite covers local-only startup, bounded narration, normal resumable upload, refresh-token expiry, successful remote observation followed by database failure, renderer failure, distinct per-script narration hashes under one licensed voice, publication gates, blocked withdrawal, cache-only retry, and takedown ordering.
