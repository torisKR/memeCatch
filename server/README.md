# memecatch-server

The Axum server that takes over routes from the Next app one at a time and
proxies the rest to it. Plan and task board: `docs/axum-migration/PLAN.md`.

## Run the gates

```sh
cd server
export DATABASE_URL="$(scripts/test-db.sh up)"   # Docker Postgres with the real schema
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
scripts/test-db.sh down
```

The proxy tests need no database. The tests that use one refuse any
`DATABASE_URL` that is not on localhost. `scripts/test-db.sh` replaces the
container named `memecatch-axum-test-pg`; set `TEST_DB_CONTAINER` to another
name when someone else may be using that one.

`tests/public_routes` replaces the approved rows of `memes` and
`tests/text_routes` replaces every meme, so both refuse a database that holds
more than the migrations' memes. `tests/engagement_routes` replaces the
approved rows too, and the collectible cards and their owners. Run
`cargo test` before the parity scripts below, or on a fresh database.

`tests/text_routes` compares the feeds and the llms exports with the bodies the
real Next server rendered from `tests/fixtures/r1_seed.sql`. After a change to
one of those routes in the TypeScript, capture the fixtures again
(`parity/README.md`, "Text routes").

Two tests are `#[ignore]`d because they run the real TypeScript, which needs
Node 22.18 or newer and the packages of the repository root
(`npx pnpm@10 install --frozen-lockfile`). CI does not run them.

```sh
cargo test --test auth -- --ignored --nocapture   # cookies minted by the real better-auth
parity/storage-parity.sh                          # lib/object-storage.ts and storage/, both directions
```

## Run in front of a local Next

Next fixes its response headers, the body of `/robots.txt` and the site URL of
`/memes/random` when it is built. Axum reads the same values when it starts,
so give both the same `RELEASE_SHA` and `NEXT_PUBLIC_SITE_URL`, and leave
`CSP_ENFORCE` and `CSP_REPORT_URI` unset on both.

```sh
# Repository root: build Next and start it on port 3001.
RELEASE_SHA=local NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001 npx pnpm@10 build
(cd .next/standalone && DATABASE_URL=... BETTER_AUTH_SECRET=... \
  PORT=3001 HOSTNAME=127.0.0.1 node server.js)

# server/: Axum on port 3100 with that Next as its upstream.
DATABASE_URL=... BETTER_AUTH_SECRET=... UPSTREAM_URL=http://127.0.0.1:3001 PORT=3100 \
  RELEASE_SHA=local NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001 NODE_ENV=development cargo run
node parity/parity.mjs http://127.0.0.1:3001 http://127.0.0.1:3100 parity/paths.txt
```

`/api/memes/view` and `/api/analytics/events` are native only when Axum has
`MEMECATCH_SIGNING_SECRET`; give both servers the same value. Without it Axum
leaves the two routes to Next.

`NODE_ENV=development` makes Axum read the session cookie a browser holds
over plain HTTP (`better-auth.session_token`). Unset or `production`, it reads
only `__Secure-better-auth.session_token`, as the production Next does.

Every setting is documented on `Config` in `src/config.rs`.

## Parity scripts

All in `parity/`; `parity/README.md` explains what each compares and how to
seed the database for it. Arguments are the Next base URL, then the Axum one.

| Script | Use |
| --- | --- |
| `parity.mjs <next> <axum> <targets>` | Status, body and headers of each target in `paths.txt`, native or proxied. |
| `random-targets.mjs <next> <axum> <path> [draws]` | `/api/random-meme` and `/memes/random`: the set of memes each server can answer with. |
| `csp-report.mjs <next> <axum>` | `POST /api/csp-report`: report bodies of every kind and the rate limit. Leave a minute after any other request to that route. |
| `seed-memes.mjs spread \| pool <n> \| empty` | Prints SQL that puts `memes` in a known state for the two scripts above. Throwaway database only. |
| `storage-parity.sh` | Signed URLs and stored objects, TypeScript against Rust. With `STORAGE_PARITY_DIR` set it keeps the directory and writes `media-targets.txt` for `parity.mjs` (the script header has the steps). |
| `daily-quiz-fixture.mjs` | Rewrites `tests/fixtures/daily_quiz.json` from the real `lib/quiz.ts` after a change there. |
| `pages/pages.mjs <next> <axum> [targets]` | The page gate: status, redirects, headers, `<head>`, JSON-LD as data, visible text, links, images and the markup of `<main>` for each target in `pages/targets.txt`, as a browser, Googlebot and Yeti. Seed with `pages/seed.sql` first. |
| `quiz-fixture.mjs` | Rewrites `tests/fixtures/quiz.json` (the questions of `/api/quiz`) from the real `lib/quiz.ts`. |
| `cards-quiz.mjs <next> <axum> [cards] [quiz]` | The meme card routes and `/api/quiz`: every status, signed out and signed in, and the rows a claim leaves. Needs two session cookies; replaces the cards and the approved memes. |
| `tracking.mjs <next> <axum> [view] [events]` | `POST /api/memes/view` and `POST /api/analytics/events`: every status, the limits, and the rows each request leaves. |
| `meme-card-catalog.mjs` | Rewrites `src/routes/cards/catalog.json`, the captions and art of the cards, from `data/meme-cards/catalog-1000.json`. |
| `previews.mjs <next> <axum>` | `POST /api/explore/previews`: every seeded case, who may ask, refused bodies and both rate limits. Leave a minute after any other request to that route. |
| `preview-fixture.mjs` | Rewrites `tests/fixtures/preview_delivery.json` from the real `lib/meme-delivery.ts` after a change there. |
| `mpe.mjs <next> <axum> <state.json> [<object-dir>]` | `GET /api/mpe/jobs/{id}`, `POST /api/mpe/renders`, `GET /api/admin/mpe-candidates` and `GET /api/media/{...path}` with three real sessions; `mpe.mjs seed <state.json>` prints its rows. |
| `uploads.mjs <next> <axum> [section...]` | `POST /api/upload` and `POST /api/mpe/uploads` against a Next on Node 22, with Axum started on R2 at a local S3 gateway it runs; also the R2 requests of both sides and a job worked by the real MPE worker. |
| `studio.mjs <next> <axum>` | `POST /api/meme-studio` and `POST /api/admin/meme-studio`, with Bedrock replaced by local stubs (HTTP/2 for Next's SDK, HTTP/1.1 for Axum) and the lifetime budget at its boundary. |
| `meme-studio-fixture.mjs`, `meme-studio-bedrock-fixture.mjs` | Rewrite `tests/fixtures/meme_studio.json` (the templates) and `meme_studio_bedrock.json` (the Converse bodies the real SDK sends; run it in a container without a network). |
| `semantic-search.mjs <next> <axum>` | `POST /api/memes/semantic-search` on the R1 seed, both servers with semantic search on and no embedding URL (as production): every answer, the limit, a refused `search_memes`. |
| `curated-search-catalog.mjs` | Rewrites `src/routes/search/curated.json` (the curated search cards) from the real `lib/curated-memes.ts`. |
| `multipart-fixture.mjs` | Rewrites `tests/fixtures/multipart.json` from Node 22's `formData()` after a change to the parser cases. |
| `text-routes-big.sql` | 2,600 more memes on top of `tests/fixtures/r1_seed.sql`, for comparing the feeds and the llms exports on a corpus larger than one page. |
| `ops.mjs <next> <axum> [section...]` | The R4 routes (cron jobs, the retired product APIs, the Instagram video cache route), Next's cache through both servers, and the refusals of `/api/db/query`, which stays with Next. Needs two session cookies and `https-stub.mjs` running. |
| `https-stub.mjs <cert> <key> [port]` | A local HTTPS stand-in for the email provider: records every request and answers by recipient. |

## Pages

`src/pages` renders pages as finished HTML with Maud templates; the choice
and the plan for the other pages are in `docs/axum-migration/UI-PLAN.md`. Two
pages exist: `/about` and the Korean `/memes/{key}`. A page route is off until
`AXUM_PILOT_ROUTES` names it (`page-about`, `page-meme`; an id that is not a
page stops the server at startup), and `AXUM_DISABLED_ROUTES` still switches
it off. A page is switched on in its batch, after the page gate and the
behaviour gate (`parity/README.md`) pass for it; the meme page still stops
after the origin section.

Every page is drawn inside the frame of `src/pages/chrome` (header, menus,
language switch, account menu, bottom navigation, chat, install prompt,
navigation progress, footer), in any of the 19 languages. Its strings come
from the TypeScript dictionaries through `i18n/frame.json`; its behaviour is
`ui/*.js`, built into one script.

```sh
# After changing src/pages, a file of ui/, app/globals.css or a lib/ module
# the scripts use (all from the repository root):
node server/scripts/build-ui.mjs            # rewrites assets/site.css and assets/site.js (committed)
node server/scripts/build-ui.mjs --check    # exit 1 if either is stale (CI)
node server/scripts/build-ui.mjs --sizes    # what each script part weighs

# After a change to lib/i18n*.ts, lib/meme-chat-copy.ts or SAVE_COPY:
node --experimental-strip-types --import ./scripts/register-ts-paths.mjs server/scripts/build-i18n.mjs          # rewrites i18n/frame.json
node --experimental-strip-types --import ./scripts/register-ts-paths.mjs server/scripts/build-i18n.mjs --check  # CI

# Start a page port from the markup Next really sends:
node scripts/html-to-maud.mjs http://127.0.0.1:3001/about main

# Compare the pages with a real Next (parity/README.md has the steps):
node parity/pages/pages.mjs http://127.0.0.1:3001 http://127.0.0.1:3100
```

Native pages take `NEXT_PUBLIC_GA_ID` and `NEXT_PUBLIC_ADSENSE_CLIENT` from
the environment, where Next fixed them at build time: give Axum the values
the Next image was built with.

## Outbound HTTPS and Next's cache

A route that calls a provider itself uses `state.outbound` (`src/outbound.rs`):
the Mozilla roots compiled in, plus the PEM file `AXUM_EXTRA_CA_CERTS` names,
as Node's `fetch` adds `NODE_EXTRA_CA_CERTS`. Tests point it at a local stub;
production leaves it unset.

Next's Data Cache lives in Next's process. A native route whose TypeScript
calls `revalidateTag` or `revalidatePath` asks Next to do it:
`state.upstream.expire_cache(CacheScope::..., cron_secret)` calls
`POST /api/internal/cache?scope=...` on Next with the cron bearer. A new kind
of expiry needs a scope in that route (`app/api/internal/cache/route.ts`) and
in `CacheScope` (`src/proxy.rs`).

## Add a native route

Add it in its module's `router` function with `Routes::add(id, path, methods)`
and add the id to `ROUTE_IDS` (both in `src/routes/mod.rs`). The id is what an
operator lists in `AXUM_DISABLED_ROUTES` to hand the route back to Next; the
server refuses to start on an id that is not in the list. Then add the path to
`parity/paths.txt`, with a `HEAD` line if the route answers `GET`, and run the
harness against a real Next.

`Routes::add` gives the answer the headers Next adds to every route and sends
the body as Next does (chunked, no `Content-Length`, also on `HEAD`), so a
handler returns a plain body. For a path outside `/api`, check what `proxy.ts`
does to it first: see `routes/public.rs` for `Content-Language` and the www
host.

`routes/request.rs` has what a handler needs to read a request the way the
TypeScript does: the `Origin` check, a body with a size limit, `JSON.parse`
with JavaScript's key order, `URLSearchParams` and the session user. A route
that compares `Origin` with `new URL(request.url).origin` cannot be decided
here: Next builds that URL from its own listen address. Answer what the site
origin decides and hand every other `Origin` to Next (`proxy::forward`), as
`routes/cards/claim.rs` does.

This server has 256 MB, a tenth of what Next has. Do not hold a whole object
or body in memory (`routes/media.rs` streams), and give any map keyed by
something a client chooses a size limit (`routes/public/rate_limit.rs`).
