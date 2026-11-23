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

`content-length` is compared, with one exception. Next sends most bodies
chunked, with no length; a route Axum answers itself sends the same bytes with
a length. When Next sent no `content-length`, the method is not `HEAD` and
Axum's value equals the number of body bytes, that is the same body framed
differently and is not counted. A length on a `HEAD` answer that Next did not
send, or a different value, is a difference.

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

`/robots.txt` is rendered by `next build`; Axum renders it at startup. They
match when Axum runs with the `NEXT_PUBLIC_SITE_URL` of the Next build.
`server/tests/fixtures/robots.txt` is the body of a Next built with
`NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001`.
