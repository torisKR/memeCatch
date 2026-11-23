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
| `quiz-fixture.mjs` | The same for `/api/quiz`: `buildQuestions`, `buildQuestionsForSet` and `seededRng` of `lib/quiz.ts`, for `server/tests/quiz_parity.rs`. |
| `cards-quiz.mjs <next> <axum> [cards] [quiz]` | `/api/meme-cards`, `/api/meme-cards/{id}`, `/api/meme-cards/collection`, `/api/meme-cards/claim` and `/api/quiz`. Status, headers and body of every case; for a claim also the row it leaves; for a random quiz the shape and the memes each server can ask. |
| `tracking.mjs <next> <axum> [view] [events]` | `POST /api/memes/view` and `POST /api/analytics/events`. Status, headers and body of every case, the limits, and the rows: a view sent to both servers must leave one row (the same viewer key), and the events of two sessions must leave equal rows. |
| `meme-card-catalog.mjs` | Not a comparison: writes the copy of the card catalogue that Axum embeds. |
| `harness.mjs` | Shared by the two scripts above; not run on its own. |

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

`/robots.txt` is rendered by `next build`; Axum renders it at startup. They
match when Axum runs with the `NEXT_PUBLIC_SITE_URL` of the Next build.
`server/tests/fixtures/robots.txt` is the body of a Next built with
`NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001`.

## Meme cards, quiz, views and analytics events

These two scripts seed what they need through `docker exec` into the database
container (`TEST_DB_CONTAINER`, default `memecatch-axum-test-pg`), so both
servers must use that database. They replace the cards, the card owners and
the approved memes: throwaway database only.

```sh
# Two signed-in users, minted by the app's own better-auth (repository root).
# NODE_ENV=production names the cookie as the standalone Next reads it.
for n in 1 2; do
  DATABASE_URL=... BETTER_AUTH_SECRET=<the servers' secret> NODE_ENV=production \
    node --import ./scripts/register-ts-paths.mjs server/tests/better_auth_cookie.mjs > user$n.json
done

export TEST_DB_CONTAINER=memecatch-axum-test-pg
export PARITY_USER="$(cat user1.json)" PARITY_USER_2="$(cat user2.json)"
node server/parity/cards-quiz.mjs $NEXT $AXUM
node server/parity/tracking.mjs $NEXT $AXUM
```

Both servers need the same `MEMECATCH_SIGNING_SECRET` (without it Axum leaves
the view and analytics routes to Next, and the comparison proves nothing), and
Axum needs `NODE_ENV=production` to read the cookie the standalone Next reads.

Build Next with a `NEXT_PUBLIC_SITE_URL` whose origin differs from
`http://localhost:<port of Next>`, for example `http://127.0.0.1:<port>`.
Next takes `http://localhost:<port>` for its own origin, and the scripts send
both: the site origin is answered by Axum, the other one is handed to Next.

What makes a write comparable when both servers share the database:

- A claim is sent to one server and then to the other. The second answer
  must be the first one's row. One card is claimed first through Next and
  another first through Axum, and the two rows are compared.
- A view is counted once per viewer and day. The same view sent to both
  servers must add one row: two rows would mean two different viewer keys.
- An analytics event is deduplicated by a key that contains the session. The
  same events go to Next under one session and to Axum under another, and the
  rows of the two sessions must be equal but for the session. The same event
  under one session through both servers must leave one row.
- The database counts events per session and minute for both servers
  together. Sixty through one server make the other one's first event the
  database's refusal (`retry-after: 60`).

`tracking.mjs` uses new client addresses on each run. The requests without
`X-Forwarded-For` share one bucket per server, so leave a minute between runs.
