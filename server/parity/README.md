# Parity harness

Checks that putting Axum in front of Next changes nothing a client can see.

```sh
node server/parity/parity.mjs http://127.0.0.1:3001 http://127.0.0.1:3000 server/parity/paths.txt
```

Arguments: the Next base URL, the Axum base URL (with that Next as its
`UPSTREAM_URL`), then target files or single targets. A target is a
percent-encoded path, sent as written, or `METHOD path` (default `GET`). No
request body is sent. Exit code 0 means every target matched.

For each target it sends the request to Next, to Axum, then to Next again, and compares
the status, the SHA-256 of the raw body (still gzip-encoded when Next
compresses it) and every response header except the ignored ones below.
Repeated headers such as `Set-Cookie` are compared value by value, in order.

Both servers receive the same `Host` header, the one of the Next base URL.
Axum forwards `Host` unchanged, so Next sees the same request both times.

A field that differs between the two direct requests to Next is not
deterministic (a timestamp in the page, for example). It says nothing about
the proxy, so it is listed as "unstable" and not counted as a difference.

## Ignored headers

| Header | Why |
| --- | --- |
| `date` | Stamped by whichever server writes the response. |
| `connection`, `keep-alive`, `transfer-encoding` | Hop-by-hop. They describe one connection; the proxy strips them and each server frames its own. |
| `x-nextjs-cache` | `HIT`, `MISS` or `STALE` depends on which request reached Next first. |

`content-length` is compared like any other header. Next sends route handler
bodies chunked and puts no length on a `HEAD` answer; the layer every native
route goes through (`headers::apply`) makes Axum do the same.

Header names are compared case-insensitively: Node writes
`X-MemeCatch-Release-Sha`, hyper writes `x-memecatch-release-sha`, and HTTP
treats them as the same header.

## What it does not cover

Request bodies and streaming. The tests in `server/tests/proxy.rs` cover those
against a stub upstream.

For routes Axum answers itself, the security headers match only when Axum
runs with the `RELEASE_SHA` and `NEXT_PUBLIC_SITE_URL` the Next build had:
Next fixes those headers at build time.

## Routes Axum answers itself

`parity.mjs` covers these too, but three of them need more than one request
with no body.

| Script | What it compares |
| --- | --- |
| `random-targets.mjs <next> <axum> <path> [draws]` | `/api/random-meme` and `/memes/random` answer with a random meme. It draws from each server and compares the two sets of targets, and the status, headers and body around the target. |
| `csp-report.mjs <next> <axum>` | `POST /api/csp-report` with report bodies of every kind, and the 60-per-minute limit with each way the client address is derived. Status and headers. |
| `seed-memes.mjs spread \| pool <n> \| empty` | Prints SQL that puts `memes` in a known state. For a throwaway database only: it deletes every approved meme. |
| `daily-quiz-fixture.mjs` | Not a comparison of servers: it runs the real `lib/quiz.ts` and `lib/daily-quiz.ts` under Node and writes the values `server/tests/daily_quiz_parity.rs` holds the Rust port to. |

```sh
psql() { docker exec -i memecatch-axum-test-pg psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q; }

node server/parity/seed-memes.mjs spread | psql
node server/parity/random-targets.mjs $NEXT $AXUM /api/random-meme
node server/parity/random-targets.mjs $NEXT $AXUM /memes/random
node server/parity/parity.mjs $NEXT $AXUM /api/daily-quiz     # today's question, byte for byte

node server/parity/seed-memes.mjs pool 300 | psql             # another pool, another question
node server/parity/parity.mjs $NEXT $AXUM /api/daily-quiz

node server/parity/seed-memes.mjs empty | psql                # no approved meme
node server/parity/parity.mjs $NEXT $AXUM server/parity/paths.txt

node server/parity/csp-report.mjs $NEXT $AXUM
```

`spread` gives 31 approved memes that a random pick reaches equally often and
31 that are not approved, so 1000 draws that return exactly 31 targets on both
servers show that every approved meme is reachable and no other is.

Both servers write one `[CSP-VIOLATION] ...` line to their log for each report
they accept. To compare that part, cut those lines out of the two logs after a
`csp-report.mjs` run (`grep -o '\[CSP-VIOLATION\].*'`) and `cmp` them.

## Text routes

`/llms.txt`, `/llms-full.txt`, `/feed.xml`, `/feed/updated.xml` and the
localized `/{en,ja,zh,zh-tw}/llms.txt` and `llms-full.txt` render rows of
`memes`, so they are compared on a seeded database. `paths.txt` has their
targets.

```sh
psql() { docker exec -i memecatch-axum-test-pg psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q --single-transaction; }

psql < server/tests/fixtures/r1_reviewer.sql        # the reviewer of the seeded translations
psql < server/tests/fixtures/r1_seed.sql            # replaces every meme: 53 memes, 31 translations
node server/parity/parity.mjs $NEXT $AXUM server/parity/paths.txt

psql < server/parity/text-routes-big.sql            # 2,600 more: paging, the 400 and 30 limits
node server/parity/parity.mjs $NEXT $AXUM server/parity/paths.txt

echo 'delete from public.memes' | psql              # the placeholders
echo 'revoke select on public.memes from anon' | psql   # 503 on the Korean routes, empty lists on the localized ones
echo 'grant select on public.memes to anon' | psql
```

Restart both servers after each change of the rows, and delete Next's data
cache (`.next/standalone/.next/cache/fetch-cache`) first. Next keeps the set of
indexable meme ids there for an hour and whether the rankings page has a list
in memory for a minute; Axum keeps the second for a minute too. A comparison
made against a stale Next shows differences that are not there.

The localized exports list translations in the order Postgres returns them
(the TypeScript orders the embedded meme row, not the query), so their bodies
change when the query plan does, on both servers at once. The harness sends
its three requests within a second and sees the same plan.

The files under `server/tests/fixtures/r1/` are what Next answered for the
seed, built with `NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3411`:

```sh
curl -s $NEXT/llms.txt > server/tests/fixtures/r1/llms.txt        # and llms-full.txt, feed.xml
curl -s $NEXT/feed/updated.xml > server/tests/fixtures/r1/feed-updated.xml
curl -s $NEXT/ja/llms.txt > server/tests/fixtures/r1/ja-llms.txt  # <locale>-llms.txt, <locale>-llms-full.txt
```

`en-llms.plan-a.txt` and `en-llms.plan-b.txt` are `/en/llms.txt` right after
seeding and again after `analyze` ran on `memes` and `meme_translations`: two
plans, two orders, and between them all 23 English lines.

## Explore previews

`POST /api/explore/previews` needs request bodies, so it has its own script,
and rows of its own on top of the text corpus:

```sh
psql < server/tests/fixtures/previews_seed.sql      # 15 memes, one case each (the title says which)
node server/parity/previews.mjs $NEXT $AXUM
```

It compares status, headers and body for every seeded case, for each way a
request can name its origin, for the bodies the route refuses, and for the
two rate limits (120 a minute for one client address, 1,200 for all). Restart
both servers first, or wait a minute: the limit for all clients counts every
request either server has seen.

Which content a meme may show is decided by the ported rights policy. That
part is compared case by case in `cargo test`:
`preview-fixture.mjs` runs the real `resolveMemeDelivery` over 914 generated
cases and writes `server/tests/fixtures/preview_delivery.json`.
`server/tests/fixtures/previews.json` is Next's answer for the fifteen seeded
memes:

```sh
ids=$(seq -f '"a3000000-0000-4000-8000-0000000000%02g"' -s, 1 15)
curl -s -X POST $NEXT/api/explore/previews -H 'sec-fetch-site: same-origin' \
  -d "{\"ids\":[$ids]}" > server/tests/fixtures/previews.json
```

`/robots.txt` is rendered by `next build`; Axum renders it at startup. They
match when Axum runs with the `NEXT_PUBLIC_SITE_URL` of the Next build.
`server/tests/fixtures/robots.txt` is the body of a Next built with
`NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001`.
