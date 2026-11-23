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

## Pages Axum renders itself

`parity.mjs` compares bytes, which a page rendered by another engine cannot
match. `pages/pages.mjs` compares what a reader or a crawler gets.

```sh
# 1. Seed, then start Next with an empty Data Cache: it keeps the catalog for a day.
docker exec -i <container> psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q < server/parity/pages/seed.sql
rm -rf .next/standalone/.next/cache   # then start Next as in server/README.md

# 2. Axum with the pilot pages switched on, in front of that Next.
AXUM_PILOT_ROUTES=page-about,page-meme ... cargo run

# 3. The gate. Exit code 0: nothing differs outside the accepted list.
node server/parity/pages/pages.mjs $NEXT $AXUM

# 4. The rollback switch: with the routes disabled every target is Next's page.
AXUM_PILOT_ROUTES=page-about,page-meme AXUM_DISABLED_ROUTES=page-about,page-meme,page-assets ... cargo run
node server/parity/pages/pages.mjs $NEXT $AXUM --expect-proxied
```

For each line of `pages/targets.txt`, as a browser, as Googlebot and as Yeti,
it compares: the status; `Location` and `Refresh`; every response header but
the ones below; `<html lang dir>`; `<title>`; every `<meta name|property>`;
the canonical, hreflang, feed, manifest and icon links; JSON-LD, parsed and
compared as data; the visible text of `<body>`; its links (href, text, rel,
target); its images; and the markup of `<main>`, element by element.

A target line also states what the case is (`200`, `308`, `404`; `index` or
`noindex`; `native` or `proxied`), and the gate fails when either server
disagrees, so a seed that stops producing the case is noticed.

Both documents are settled first (`pages/dom.mjs`): Next streams part of a
page into hidden segments that an inline script moves into place, and for
browsers and Googlebot it sends `<title>`, the description, the canonical
link and the rest of the metadata inside `<body>`. Axum sends one finished
document with the metadata in `<head>`, which is what Next sends to the
crawlers it does not stream to (Yeti, Bingbot, the link-preview bots). The
output says where Next put the metadata for each request.

What it does not compare, with the reason, is in three lists at the top of
the script:

| List | Content |
| --- | --- |
| `IGNORED_HEADERS` | Hop-by-hop headers, Next's cache internals, and the `Link` preload hint that names Next's own stylesheet files. `Vary` is compared as a set without `Accept-Encoding`. |
| `NOT_PORTED` | Sections of the meme page the pilot does not render. They are cut out of Next's document before text, links, images and markup are compared, and the count is printed. Delete an entry when the section is ported. |
| `ACCEPTED` | Decided differences. One today: the 404 document. Next answers a missing meme with a prerendered file whose `<body>` is empty until scripts run, with a year-long `s-maxage`; Axum sends the message as HTML with `no-store`. Status, `<title>` and `noindex` are still compared. |

In the markup comparison a class list is compared as a set, a CSS-module
class (`module_local__hash` in Next, `module-local` in Axum) is compared by
module and local name, React's generated ids are skipped, and so are the
`data-*` attributes that only feed `ui/site.js` and the start state the
motion library leaves in Next's markup (Axum animates the same thing in CSS).
Icon links are compared without the file hash Next appends as a query.

It does not run scripts, so it says nothing about what a page does after it
loads, and it does not look at pixels.

`paths.txt` lists three `/memes/...` URLs of memes that do not exist. With
the pilot pages off (the default) Axum passes Next's 404 on and `parity.mjs`
finds them identical. With `page-meme` switched on Axum answers them itself
and `parity.mjs` reports them: that is the accepted difference above, in
bytes. Run `parity.mjs` with the pilots off and `pages.mjs` with them on.

`/robots.txt` is rendered by `next build`; Axum renders it at startup. They
match when Axum runs with the `NEXT_PUBLIC_SITE_URL` of the Next build.
`server/tests/fixtures/robots.txt` is the body of a Next built with
`NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001`.
