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

## In CI

The `parity` job of `.github/workflows/ci.yml` runs `server/parity/ci.sh` on
every pull request: one throwaway database seeded with `pages/seed.sql`,
`pages/b2-seed.sql`, the `/memes` order catalogue and `pages/b2b-seed.sql`; a
Next standalone build (`RELEASE_SHA=ci`, `NEXT_PUBLIC_SITE_URL=
http://127.0.0.1:3001`) with its ISR copies of `/news`, `/weekly`, `/slang`
and `/collections/*` removed so it renders them from that database; and three
Axum servers built from the same commit: every page on in front of Next
(3100), pages off in front of Next (3101), and no upstream (3200, C1's mode).
Its gates, with their time on an M-series laptop (debug Axum binary):

| Gate | Script | Against | Time |
| --- | --- | --- | --- |
| `pages` | `pages/pages.mjs`, `pages/targets.txt`, one at a time | 3100 | 20 s |
| `text` | `parity.mjs paths.txt` without the two random `/api/quiz` targets | 3101 | 4 s |
| `public` | `public-targets.mjs` and the metadata files | 3101 | 1 s |
| `alone` | `standalone-targets.txt` | 3200 | 1 s |
| `images` | `images.mjs` | 3200 | 290-300 s |
| `csp` | `csp-report.mjs` | 3101 | 1 s |

`bash server/parity/ci.sh pages text` runs a subset; the script's header has
the local setup. Each gate runs to the end, the script exits 1 when any
differed and then prints the end of every server's log. The scripts that need
signed-in sessions, stubs of outside hosts or a database restored from
production (`cards-quiz.mjs`, `tracking.mjs`, `ops.mjs`, `og.mjs`,
`db-query.mjs`, the auth scripts, `worker.mjs`, `standalone-blockers.mjs`)
stay manual. The job is not in `deploy`'s needs.

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
| `directory-catalog.mjs` | Not a comparison of servers: the catalog of 3,562 titles (every short title of `data/` and generated edge cases) and the order the real `sortDirectory` gives it, run on the Node of the Next image, for `server/tests/directory_order.rs`; with `sql`, the same catalog as rows. |
| `daily-quiz-fixture.mjs` | Not a comparison of servers: it runs the real `lib/quiz.ts` and `lib/daily-quiz.ts` under Node and writes the values `server/tests/daily_quiz_parity.rs` holds the Rust port to. |
| `quiz-fixture.mjs` | The same for `/api/quiz`: `buildQuestions`, `buildQuestionsForSet` and `seededRng` of `lib/quiz.ts`, for `server/tests/quiz_parity.rs`. |
| `cards-quiz.mjs <next> <axum> [cards] [quiz]` | `/api/meme-cards`, `/api/meme-cards/{id}`, `/api/meme-cards/collection`, `/api/meme-cards/claim` and `/api/quiz`. Status, headers and body of every case; for a claim also the row it leaves; for a random quiz the shape and the memes each server can ask. |
| `tracking.mjs <next> <axum> [view] [events]` | `POST /api/memes/view` and `POST /api/analytics/events`. Status, headers and body of every case, the limits, and the rows: a view sent to both servers must leave one row (the same viewer key), and the events of two sessions must leave equal rows. |
| `ops.mjs <next> <axum> [section...]` | The R4 routes: the retired product APIs, `/api/cron/growth-baseline`, `POST /api/cron/source-refresh`, the Instagram video cache route and `/api/cron/saved-state-emails`, with every status, the limits, what the email provider received and the outbox rows each run leaves; Next's cache through each route (`cache`); the refusals of `/api/db/query` (`db-query`). |
| `trend-pulse.mjs <next> <axum> [section...]` | `GET /api/cron/trend-pulse` (R8): every status, the failing database steps, what the radar providers received (a recording stub inside the script, port 3630) and the rows each run leaves; Next's cache through each server (`cache`). `radar-intercept.mjs` sends Next's provider requests to that stub. |
| `https-stub.mjs <cert> <key> [port]` | The email provider for `ops.mjs`: an HTTPS server that records each request and answers by recipient (`+fail` 503, `+slow` no answer for 9 s, else 200). |
| `db-query.mjs <next> <axum> --container= --sessions= --site= [section...]` | `POST /api/db/query`: every app plan as four identities (answers, rows after writes, the statements each server sent), 590 hostile plans, the limits and the busy cap, the video verification. Setup below ("Database door"). |
| `db-query/plans.capture.ts` | Rewrites `tests/fixtures/db_query_plans.json`, the plans the browser posts, with the real builder: `npx vitest run --config server/parity/db-query/vitest.config.mts`. |
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

## Pages Axum renders itself

`parity.mjs` compares bytes, which a page rendered by another engine cannot
match. `pages/pages.mjs` compares what a reader or a crawler gets.

```sh
# 1. Seed, then start Next with an empty Data Cache: it keeps the catalog for a day.
docker exec -i <container> psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q < server/parity/pages/seed.sql
rm -rf .next/standalone/.next/cache   # then start Next as in server/README.md

# 2. Axum with the pages switched on, in front of that Next.
AXUM_PILOT_ROUTES=page-about,page-meme ... cargo run

# 3. The gate. Exit code 0: nothing differs outside the accepted list.
node server/parity/pages/pages.mjs $NEXT $AXUM

# 4. The rollback switch: with the routes disabled every target is Next's page.
AXUM_PILOT_ROUTES=page-about,page-meme AXUM_DISABLED_ROUTES=page-about,page-meme,page-assets ... cargo run
node server/parity/pages/pages.mjs $NEXT $AXUM --expect-proxied

# 5. At scale, before a batch is switched on: every URL of the sitemap, on a
#    database restored from a production backup.
curl -s $NEXT/sitemap.xml > /tmp/sitemap.xml
node server/parity/pages/pages.mjs $NEXT $AXUM /tmp/sitemap.xml --concurrency=8 --examples=3
```

The list pages of batch B2 need more rows than `seed.sql`:

```sh
psql < server/parity/pages/b2-seed.sql                  # 24 memes for every list and card art, 360 years, 2 ledger rows
node server/parity/directory-catalog.mjs sql | psql     # the 3,562 titles of the /memes order fixture
psql < server/parity/pages/b2b-seed.sql                 # /global ledger and markets, /meme-cards' 32 cards, /news' votes
```

`b2-seed.sql` dates four memes minutes before it runs, for this week's
`/weekly`; seed again on another day. Three pages are ISR on Next
(`/weekly`, `/slang`, `/collections/{slug}`): Next answers the first request
with the copy it keeps next to the build (`.next/standalone/.next/server/app`,
which clearing `.next/cache` does not touch) and regenerates it behind the
answer. Before a comparison, restore that directory from `.next/server/app`
and ask each of those pages until Next answers `x-nextjs-cache: HIT`.

`/explore` reads the reviewed media ledger for its previews through the
deadline pool (two connections, 1.5 s, four reads at once), on both servers.
Several requests at once exhaust it and the page then shows its "previews not
loaded" banner, on Next as on Axum: run the gate with `--concurrency=1` when
the targets include `/explore`.

`/news` is ISR with a day's revalidation, so Next keeps answering with the
copy it prerendered at build time for a day, whatever the seed. Remove
`news.html`, `news.rsc`, `news.meta` and `news.segments` from
`.next/standalone/.next/server/app` after restoring it: Next then renders the
page from the database on its first request and keeps that.

`/rankings` has two more states than the seed gives: set every
`trend_score` to 0 for the thin-trend fallback (the newest memes inside the
live board), then leave two memes approved for the notice (noindex). Restore
the columns afterwards.

The empty and unreadable states are compared with the same targets as URLs
(no expectations): `revoke select on public.memes from anon` for an
unreadable catalog, every approved meme set to `pending` (with
`session_replication_role = replica`, past the moderation trigger) for an
empty one. Restart both servers each time.

The targets argument takes `targets.txt` lines, a sitemap, or a file of URLs
(one per line; only their path and query are used, and nothing is expected of
them beyond matching). `--concurrency` bounds the targets in flight;
`--examples` how many requests the details of each kind of difference are
printed for. The run ends with every kind of difference and how many
requests and distinct paths had it, most frequent first.

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
`data-*` attributes that only feed the scripts of `ui/` and the start state the
motion library leaves in Next's markup (Axum animates the same thing in CSS).
Icon links are compared without the file hash Next appends as a query.

It does not run scripts, so it says nothing about what a page does after it
loads, and it does not look at pixels: the behaviour gate below does the
first.

`paths.txt` lists three `/memes/...` URLs of memes that do not exist. With
the pilot pages off (the default) Axum passes Next's 404 on and `parity.mjs`
finds them identical. With `page-meme` switched on Axum answers them itself
and `parity.mjs` reports them: that is the accepted difference above, in
bytes. Run `parity.mjs` with the pilots off and `pages.mjs` with them on.
## Browser behaviour gate

`behaviour/` drives a real browser (Playwright) through the same steps on Next
and on Axum, on the same database, at a phone width and a desktop width, and a
scenario passes only when both servers pass the same assertions. It asserts
what a user can observe: the URL, visible text and state, focus and its ring,
`aria-*`, cookies, storage, and the requests a step causes (method, path, body
and its shape). It does not look at class names or markup structure.

```sh
# Next on its own origin, Axum on the site origin the Next build was given
# (NEXT_PUBLIC_SITE_URL), with Next behind it: as in production, the page and
# the APIs it calls (still Next's) share one origin. Next trusts a request
# from its own `http://localhost:<port>` or from SITE_URL (lib/origin.ts), so
# with a build for http://127.0.0.1:3001:
PORT=3002 HOSTNAME=127.0.0.1 node .next/standalone/server.js               # Next
PORT=3001 UPSTREAM_URL=http://127.0.0.1:3002 NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001 \
  AXUM_PILOT_ROUTES=page-about,page-meme ... cargo run                       # Axum

NEXT_URL=http://localhost:3002 AXUM_URL=http://127.0.0.1:3001 \
DATABASE_URL=<the database both use> BETTER_AUTH_SECRET=<their secret> \
  node_modules/.bin/playwright test -c server/parity/behaviour/playwright.config.mjs
# narrow it: --project=axum-mobile, a file name, -g "<title>"
```

Projects are `next-mobile`, `next-desktop`, `axum-mobile`, `axum-desktop`.
Signed-in scenarios make a fresh user and session with the app's own
better-auth on that database (`behaviour/session.mjs`, as
`server/tests/better_auth_cookie.mjs` does), so `DATABASE_URL` must be on
localhost and the secret the servers' own. Scenarios run one at a time: they
share saved memes and sessions.

Scenarios today (`behaviour/scenarios/`), each on `/about` and on a meme page:

| File | What |
| --- | --- |
| `frame.spec.mjs` | Header menu (Escape, focus return and ring, press outside), language switch in place (Arabic, right to left) and to a language with its own URLs, bottom navigation, scrolling hides the header and the bar on a phone, the `/` search shortcut, footer and its fold, navigation progress |
| `account.spec.mjs` | Signed out: the sign-in link. Signed in as a user and as an operator: the account menu, its requests, focus, Escape, sign-out. Saving a meme signed out (the sign-in dialog, a modal) and signed in (stored, announced) |
| `chat.spec.mjs` | The chat panel: open, ask, the streamed answer with references, Escape, the conversation kept and cleared; the errors. `/api/memes/chat` is answered by the scenario |
| `visit.spec.mjs` | Where the visitor came from, the meme view count, the install prompt on an iPhone |
| `documents.spec.mjs` | Batches B1 and B2: the frame (menu, chat, language switch) on each static document and list page, and the links of the guides, contact, originals |
| `lists.spec.mjs` | Batch B2, on `pages/b2-seed.sql`: paging the directory; the meme card (opening it with its list as context, the still, the poster for a failed image, the TikTok and Instagram players with Escape, close, focus and an unplayable post); the weekly rails and `weekly_click`; the timeline's infinite scroll, `#decade-…`, tabs and `timeline_click`; the slang tabs in place and back. TikTok, Instagram, the YouTube stills and Google's tag are answered by the scenario |
| `explore.spec.mjs` | Batch B2, `/explore`: the infinite scroll (two windows, then "밈 더 보기"), a window that fails and its retry, the previews check that fails (the banner) and its retry, the end of a short list, the empty result with its submission link, the filters in place (panel and focus kept, AI 밈 alone), sort, source, reset, search, clear and the back button. The next window is matched as `/api/db/query` (Next) or `/_axum/explore/more` (Axum) |
| `global.spec.mjs` | Batch B2, `/global` on `pages/b2b-seed.sql`: the platform tabs (`aria-current`, back), the title card of a thumbnail that does not load (a YouTube still the scenario aborts, a stored cover neither server has), opening an item |
| `meme-cards.spec.mjs` | Batch B2, `/meme-cards` on `pages/b2b-seed.sql`: choosing a sealed card (address, `aria-pressed`, focus), "바로 공개", scratching 35% of the coat with the mouse, a card that does not load and its retry, a card that is gone, the sign-in link, claiming signed in and the owned badges, shuffling, the notice for a card that cannot be opened |
| `news.spec.mjs` | Batch B2, `/news` on `pages/b2b-seed.sql`: the age links and back, the vote highlights (and none for the 30s), `generation_news_click` for a card followed, the brief sources in a new tab. `recordGaEvents` (lib.mjs) keeps the GA events across the navigation |
| `quiz.spec.mjs` | Batch B2, `/quiz` and `/quiz/r/{token}`, with `/api/quiz` answered by the scenario (ten seed memes, known answers): ten questions by click and by the keys 1–4 and Enter, the feedback and the meme links, score, grade, era and the review, `quiz_start`/`quiz_complete`, the result link copied, the card PNG downloaded (desktop), a failed draw and its retry, a friend's challenge (the same set, the comparison, a new quiz) |
| `rankings.spec.mjs` | Batch B2, `/rankings`: the three CSS radio tabs (label clicks, arrow keys) and an entry. No script: a class Tailwind does not find in `src/pages` leaves a tab hidden, which this catches |
| `search.spec.mjs` | Batch B2, `/search`: typing changes the address and the results in place (no reload), the suggestions (arrow keys, Enter opens one, Escape closes and the browser empties the field, a new focus reopens), recent and popular terms (stored, removed, cleared), `search_submit` and `search_no_result` once per settled query, the situation search (keyword mode, cancelled, failed) |
| `studio.spec.mjs` | Batch B2, `/studio`: the workspaces, the tone and format with three ideas (the request body), the heading that follows the topic, copying, the failures (429, network), the reference search on the topic, the rights check, the image meme (a wrong file, the output size, render, the PNG saved, an edit asks for a new render), the dictionary card (its address checked, render, save), and a change of kind that starts afresh |

### Adding a scenario for a component

1. Find what the React component does that a user can notice, on Next, in the
   browser: what changes on screen, where focus goes, which `aria-*` change,
   what is stored, what is requested.
2. Write it once with `test` from `lib.mjs`, in a file of
   `behaviour/scenarios/` (one per feature area). Use `open(page, path)` to
   load a page, role and label locators, `focused`, `focusRing`,
   `requestsDuring`, `localStorageItem`, `sessionStorageItem`, `cookieValue`,
   and the `signIn("user" | "operator")` fixture. Use `mobileOnly` or
   `desktopOnly` where the behaviour exists at one width.
3. Run it on `next-*` first: it must pass on Next as it is. Then run it on
   `axum-*`, and port the component until it passes there too.
4. Do not make a scenario pass by asserting less. When the two servers
   legitimately differ (a server action against a named endpoint), accept
   either explicitly, as `account.spec.mjs` does for signing out, and list
   the difference in `docs/axum-migration/PLAN.md`.
5. Check the scenario catches a broken script: break the feature's file in
   `server/ui`, rebuild (`node server/scripts/build-ui.mjs`, then the
   server), and see it fail on `axum-*`.

A request the step did not cause is filtered out in `lib.mjs`
(`NOT_BEHAVIOUR`: bundles, assets, `/_axum/` fragments, Next's own router
payloads). A page that is leaving cannot be evaluated from outside while the
next one loads; watch it from inside with an init script that logs, as the
navigation progress scenario does.

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

## Media, the MPE API and uploads

`mpe.mjs` needs three sessions minted by the real better-auth (`user`,
`other`, `operator`, with the operator's profile promoted) in one JSON file,
and both servers on the same `LOCAL_OBJECT_STORAGE_DIR` without R2. Its rate
limit cases expect freshly started servers (or a minute's pause).

```sh
node server/parity/mpe.mjs seed state.json | psql        # superuser, throwaway database
node server/parity/mpe.mjs $NEXT $AXUM state.json "$OBJECT_DIR"
```

`uploads.mjs` starts its own Axum: R2 is configured there and pointed, from
an ignored test (`cargo test --test uploads serve_for_parity -- --ignored`),
at a Versity S3 Gateway container behind a recording proxy, both started by
the script and removed when it exits. Next stays on its local directory, so
nothing reaches Cloudflare. Run Next on **Node 22**, the version of the Next
image: Node 24 and 26 parse some malformed forms differently
(docs/axum-migration/PLAN.md, section 8). Each case signs in a user of its
own (a `user` and `session` row and the cookie the shared secret signs).

```sh
# Repository root. NEXT_OBJECT_DIR is the LOCAL_OBJECT_STORAGE_DIR Next runs with.
TEST_DB_CONTAINER=... NEXT_OBJECT_DIR=... DATABASE_URL=<the app role's URL> \
  <node 22> --experimental-strip-types --import ./scripts/register-ts-paths.mjs \
  server/parity/uploads.mjs $NEXT http://127.0.0.1:3412
```

Sections: `uploadChecks` and `mpeChecks` (every answer of the two routes,
and what each server kept), `limits` (the in-memory and database limits, the
storage quota, and a database that refuses the calls, by revoking and
granting back `EXECUTE`), `storeFailures` (a failed PUT on each side; the
cleanup failure on Axum only), `shortContentLength`, `r2Requests` (the
TypeScript's `r2Put` and `objectStorage().upload` run in the script with
`fetch` sent on to the proxy, against Axum's PUTs for the same uploads: key,
content type, scope and signed headers; the gateway checks both signatures)
and `worker`. For `worker` the proxy writes the `storage.objects` row that
`create_media_ingestion` requires and nothing writes today; the script then
runs `scripts/mpe-media-worker.mjs` once, in an empty directory (it reads
`.env` files from its working directory) and with a copy of the object.

`multipart-fixture.mjs` must run on Node 22 as well; it refuses another
version.

## The meme studio

`studio.mjs` runs two Bedrock stubs and expects both servers to point at
them: Next with `AWS_ENDPOINT_URL_BEDROCK_RUNTIME=http://127.0.0.1:3421` (the
AWS SDK speaks HTTP/2 to Bedrock Runtime) and Axum with
`http://127.0.0.1:3422`, both with `BEDROCK_MEME_STUDIO_ENABLED=true`,
`AWS_REGION=ap-northeast-2` and made-up `AWS_ACCESS_KEY_ID` and
`AWS_SECRET_ACCESS_KEY`. With the endpoint set nothing reaches AWS. It mints
its own users (an operator through the superuser) and rewrites the lifetime
budget row, which only the superuser can read, to compare both sides of the
ceiling.

```sh
TEST_DB_CONTAINER=... node server/parity/studio.mjs $NEXT $AXUM
```

The two fixture scripts run the TypeScript itself. The Bedrock one must run
where nothing can reach AWS:

```sh
node --experimental-transform-types --import ./scripts/register-ts-paths.mjs \
  server/parity/meme-studio-fixture.mjs > server/tests/fixtures/meme_studio.json
docker run --rm --network none -v "$PWD":/w:ro -w /w node:22-bookworm-slim \
  node --experimental-transform-types --import ./scripts/register-ts-paths.mjs \
  server/parity/meme-studio-bedrock-fixture.mjs > server/tests/fixtures/meme_studio_bedrock.json
```

## Session read and sign-out

`auth-session.mjs` compares `GET /api/auth/get-session` and
`POST /api/auth/sign-out` (`src/routes/better_auth/`) with the real
better-auth in Next, on one database. Users and sessions are minted by the
app's own better-auth (`tests/better_auth_cookie.mjs`). A case that writes
puts its session in the same state before each server's turn and restores it
after; it compares the answers (status, headers, `Set-Cookie` lines in order,
body) and the row each server left, with the times the call wrote shown as
minutes from the call.

```sh
# Both servers with the same DATABASE_URL, BETTER_AUTH_SECRET and NODE_ENV.
TEST_DB_CONTAINER=<container> DATABASE_URL=... BETTER_AUTH_SECRET=... NODE_ENV=production \
  node server/parity/auth-session.mjs $NEXT $AXUM [get-session] [sign-out] [limits]
```

Sections: `get-session` (no cookie, bad and foreign signatures, the other
cookie name, `session_data` and its chunks, `dont_remember`, due for a
refresh, expired, unknown token, a row that vanishes during the refresh
(401, by a trigger), a database that fails (500, by renaming the table), and
the requests handed to Next: `HEAD`, `POST`, a query string, `RSC`, a
trailing slash; a 17 KB cookie, 431 on both), `sign-out` (content types,
bodies, the origin check with and without cookies, `Referer`, the row deleted,
the cookies cleared; the query `callbackURL` and the `redirectTo`,
`errorCallbackURL` and `newUserCallbackURL` bodies, which Next answers; a
delete the database refuses, where Next answers 200 and Axum 500
`FAILED_TO_SIGN_OUT` with the same cookies, PLAN.md A1-4) and
`limits` (production only: the 101st request in ten seconds, per address and
path).

A standalone Next build always names the cookie `__Secure-`: the build fixes
`NODE_ENV`. Compare `NODE_ENV=development` against `next dev` instead; the
development CSP then differs and is not compared.

`tests/auth_session_cross.rs` (ignored; needs Node) runs the same endpoints
in Rust against better-auth's own `getSession` and `signOut` on the test
database, both ways and across the refresh and expiry boundaries:
`cargo test --test auth_session_cross -- --ignored --nocapture`.

## Meme chat

`chat.mjs` compares `POST /api/memes/chat` on the R1 seed
(`tests/fixtures/r1_reviewer.sql`, `r1_seed.sql`) plus `chat-seed.sql`. Run it
against two pairs of servers, all with `MEME_SEMANTIC_SEARCH_ENABLED=true`,
`MEME_CHAT_GENERATION_ENABLED=true` and no `MEME_EMBEDDING_URL`:

- the production pair, without `OPENROUTER_API_KEY`: sections `production`,
  `failures`, `limits`, `slowBody`;
- the generation pair, with a made-up key: section `generation`. The script
  runs the OpenRouter stub on `127.0.0.1:3530`. Start Next with the fetch
  interceptor pointing there, and Axum with the test origin:

```sh
# Next (standalone, Node 22), generation pair:
OPENROUTER_API_KEY=parity-key node \
  --import "file://$PWD/server/parity/openrouter-intercept.mjs?origin=http://127.0.0.1:3530" server.js
# Axum, generation pair:
OPENROUTER_API_KEY=parity-key AXUM_TEST_OPENROUTER_ORIGIN=http://127.0.0.1:3530 memecatch-server

TEST_DB_CONTAINER=... node server/parity/chat.mjs $NEXT $AXUM production failures limits slowBody
TEST_DB_CONTAINER=... node server/parity/chat.mjs $NEXT_KEY $AXUM_KEY generation
```

Each server allows 20 chat requests a minute, so the script paces itself; the
`limits` section waits for a quiet minute first. `chat-fixture.mjs` rewrites
`tests/fixtures/meme_chat.json` from the real `answerMemeQuestion`, with the
search and the database stubbed (`chat-fixture-hooks.mjs`,
`chat-fixture-stubs.mjs`) and `fetch` caught; the header of the script has the
command. `unicode-classes.mjs` rewrites `src/routes/unicode_classes.rs` (the
character classes of two regexes, as Node 22's V8 decides them).

## MPE candidates

`mpe-candidates.mjs` compares `POST /api/admin/mpe-candidates`. It needs two
sessions minted by the real better-auth in one file (`operator`, promoted by
the login role as `service_role`, and `user`), and reseeds its own rows
(`mpe-candidates-seed.mjs`) before each request to each server, then compares
the rows left behind (fingerprints, candidates, matches, evidence, the daily
budget). The same two pairs of servers as the meme chat:

```sh
TEST_DB_CONTAINER=... node server/parity/mpe-candidates.mjs --state=state.json $NEXT $AXUM production
TEST_DB_CONTAINER=... node server/parity/mpe-candidates.mjs --state=state.json $NEXT_KEY $AXUM_KEY generation
DATABASE_URL=... TEST_DB_CONTAINER=... node server/parity/mpe-candidates.mjs --state=state.json \
  --axum-log=<Axum's log file> $NEXT $AXUM matching
```

`matching` checks what no response shows: the matches the route computes. The
store fails on both servers (PLAN.md section 10), Axum logs the matches it
tried to store, and `mpe-candidates-flow.mjs` runs the real
`generateCandidateMatches` on the same rows with that one call caught.
`mpe-candidates-fixture.mjs` rewrites `tests/fixtures/mpe_candidates.json`.

## The ChatGPT connector

`mcp.mjs` compares the routes of `integrations/memecatch-chatgpt` as
production runs them: no `MCP_EVENT_STATE_KEY` (PLAN.md section 14). Start
both servers with `CRON_SECRET=parity-cron`, `MCP_EVENT_RETRY_TOKEN=parity-retry`
and `MCP_GITHUB_WEBHOOK_SECRET=parity-hook`; Next with
`--import "file://$PWD/server/parity/mcp-intercept.mjs?origin=http://127.0.0.1:3530"`,
Axum with `AXUM_TEST_MCP_ORIGIN=http://127.0.0.1:3530`. The script serves that
origin: `/llms-full.txt` is Next's own with its origin replaced by
`https://catchmeme.com` (the corpus keeps only those URLs), so both servers
read the same database; `/oauth/client.json` is what each case sets. It
records the request each server sends and compares those too.

```sh
TEST_DB_CONTAINER=... node server/parity/mcp.mjs --state=state.json $NEXT $AXUM
```

`state.json` holds an `operator` (promoted) and a `user` session, as for
`mpe-candidates.mjs`. Restart both servers before a run: each keeps the corpus
five minutes and valid client metadata an hour, and the failure cases must
come first. The `corpus` section asks `get_meme` for every meme of the seeded
`llms-full.txt`, so each field of each record is compared byte for byte.
## Open Graph images

`og.mjs` compares `/og/{locale}`, `/opengraph-image` and `/og/quiz/{token}`
(`src/routes/og.rs`) with the real Next. No database or seed is needed.
For each image the status and every header but `content-length` must be
equal, the PNGs the same size, and the pixels within `TOLERANCE` (mean
channel difference at most 0.5, at most 0.05 % of channels more than 32
apart, none more than 96): Next rasterizes Satori's SVG with libvips (sharp
is installed beside Next), Axum the same geometry with resvg, and those two
differ in anti-aliasing only. Each image case writes Next | Axum | the
difference ×4 to `server/target/og-parity/`.

```sh
node server/parity/og.mjs $NEXT $AXUM [default] [quiz] [next-only]
```

Sections: `default` (the six locales, a query string, `HEAD`, the root
card), `quiz` (every total from 1 to 10 with every grade band, mode and
score digit; a query string; `HEAD`; nine malformed tokens, 404) and
`next-only` (what Axum hands to Next: an unknown or percent-encoded locale,
a trailing slash, `POST`, an encoded space before a token).

`og-reference.mjs` renders the same cards through the app's own TSX with the
Satori and sharp of `next/og` and keeps Satori's SVG; its PNG is the bytes
Next serves. `tests/og_cards.rs` checks that the SVGs Axum writes paint the
same pixels as those (`tests/fixtures/og/`). After a change to a card's TSX
or font, write them again:

```sh
node server/parity/og-reference.mjs /tmp/og-ref default ko en ja zh zh-tw
node server/parity/og-reference.mjs /tmp/og-ref quiz <token>...   # the names in tests/fixtures/og
cp /tmp/og-ref/*.svg server/tests/fixtures/og/
```
### The share cards and the export route (R10)

`og.mjs share` compares `og-meme` and `og-meme-locale`, and `og.mjs export`
`meme-export`, with the real Next on `og-share-seed.sql` (on top of
`tests/fixtures/r1_reviewer.sql`; the better-auth tables of
`tests/common/session.rs` must exist for `export`, owned by `memecatch`).
Images are compared as above. The `share` section writes the photos into
`server/target/og-parity/storage` and serves YouTube stills from a recording
stub on `127.0.0.1:3461`. Next is built with
`NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3460` (Axum's address), its
`.next/standalone/.next/cache` emptied, and started from `.next/standalone`
with `PORT=3459`, the database, `BETTER_AUTH_SECRET`,
`LOCAL_OBJECT_STORAGE_DIR=<repo>/server/target/og-parity/storage` and
`node --import "file://<repo>/server/parity/og-intercept.mjs?origin=http://127.0.0.1:3461" server.js`.
Axum gets `PORT=3460`, `UPSTREAM_URL=http://127.0.0.1:3459`, the same
`NEXT_PUBLIC_SITE_URL`, `NODE_ENV=production`, the same storage directory and
`AXUM_TEST_OG_ORIGIN=http://127.0.0.1:3461`. Then:

```sh
PARITY_USER="$(node --import ./scripts/register-ts-paths.mjs server/tests/better_auth_cookie.mjs)" \
  TEST_DB_CONTAINER=... node server/parity/og.mjs http://127.0.0.1:3459 http://127.0.0.1:3460 share export
```

`og-intercept.mjs` sends Next's `i.ytimg.com` requests to the stub and
refuses Google Fonts, jsDelivr and the production site. The fixtures of the
Rust tests come from the app's own code: `og-reference.mjs share
<cases.json>` (Satori's SVG of each card, an embedded photo replaced by its
type), `og-photo-fixtures.mjs [--make]` (the photos and what the app's
decoders, `prepareSharePhoto`, libvips and `encodeJpeg` make of them) and
`og-text-tables.mjs` (the `linebreak` tables and the segmentation corpus).

## The R4 routes

```sh
# A throwaway CA and a certificate for 127.0.0.1, in a scratch directory.
openssl req -x509 -newkey rsa:2048 -nodes -keyout ca.key -out ca.pem -days 3 -subj "/CN=stub CA" \
  -addext "basicConstraints=critical,CA:TRUE" -addext "keyUsage=critical,keyCertSign"
openssl req -newkey rsa:2048 -nodes -keyout stub.key -out stub.csr -subj "/CN=127.0.0.1"
printf 'subjectAltName=IP:127.0.0.1\nextendedKeyUsage=serverAuth\n' > ext.cnf
openssl x509 -req -in stub.csr -CA ca.pem -CAkey ca.key -CAcreateserial -out stub.pem -days 3 -extfile ext.cnf
node server/parity/https-stub.mjs stub.pem stub.key 3443 &

# Both servers with the same CRON_SECRET and PLUS_DIGEST_*:
#   PLUS_DIGEST_DELIVERY_URL=https://127.0.0.1:3443/send PLUS_DIGEST_FROM_EMAIL=... PLUS_DIGEST_DELIVERY_TOKEN=...
# Next with NODE_EXTRA_CA_CERTS=ca.pem, Axum with AXUM_EXTRA_CA_CERTS=ca.pem.
node server/parity/seed-memes.mjs pool 3 | psql        # the page of the cache section
PARITY_USER="$(cat user1.json)" PARITY_USER_2="$(cat user2.json)" STUB_CA=ca.pem CRON_SECRET=... \
  node server/parity/ops.mjs $NEXT $AXUM cache db-query retired growth-baseline source-refresh instagram-video saved-state
```

`not-configured` and `no-token` are for a pair started with an empty or
`http:` delivery URL, and with no token. Never send an authenticated `GET` to
`/api/cron/source-refresh`: that runs the real refresh, which calls YouTube
and the oEmbed endpoints.

Next's `server.js` forks the process that listens. To restart Next with other
settings, stop that child too, or the new one loses the port to the old one
and the old settings keep answering.

The saved-state batch is sent to one server, the rows and the stub are read,
the batch is put back, and the same is done through the other: the outbox
ids are fixed, so the two runs must send byte-equal bodies and leave equal
rows.

## Email sign-in, sign-up, verification and reset

`auth-credentials.mjs` compares the five email-password endpoints
(`src/routes/better_auth/{sign_in,sign_up,verify_email,password_reset}.rs`)
with the real better-auth in Next, on one database. A case that writes runs
once per server on an address of its own (`a2-<run>-<case>-<server>@…`),
prepared the same way (users signed up through Next, bcrypt accounts made
with bcryptjs as the previous store left them, reset tokens inserted as
`requestPasswordReset` leaves them). It compares the answer, the rows that
address has in `user`, `account`, `session`, `verification`, `auth.users`
and `profiles`, and the mail each server sent, with the address, ids, tokens,
hashes and times masked. Each request comes from its own client address, so
the limiter only answers in the `limits` section.

```sh
# Both servers with the same DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL and NODE_ENV;
# each with AUTH_EMAIL_WEBHOOK pointing at its own stub that appends each request to a file.
TEST_DB_CONTAINER=<container> DATABASE_URL=... BETTER_AUTH_SECRET=... NODE_ENV=production \
NEXT_MAIL=<next stub file> AXUM_MAIL=<axum stub file> \
  node server/parity/auth-credentials.mjs $NEXT $AXUM [sign-in] [sign-up] [verify-email] [reset] [limits]
```

Without `NEXT_MAIL` and `AXUM_MAIL` mail is not compared; run the servers
without a webhook to see the log line each writes instead.

`password-fixture.mjs` is not a comparison: it makes password hashes with
`lib/auth/passwords.ts` and bcryptjs and records the app's verdict on each,
for `src/routes/better_auth/passwords.rs`
(`tests/fixtures/password_hashes.json`).

`tests/auth_credentials_cross.rs` (ignored; needs Node) runs every flow
both ways against better-auth's own `auth.api` on the test database:
`cargo test --test auth_credentials_cross -- --ignored --nocapture`.

## The trend pulse (R8)

```sh
# Next with the radar fetch caught (Node 22, standalone):
(cd .next/standalone && CRON_SECRET=parity-cron ... node \
  --import "file://$PWD/../../server/parity/radar-intercept.mjs?origin=http://127.0.0.1:3630" server.js)
# Axum with the same CRON_SECRET and AXUM_TEST_RADAR_ORIGIN=http://127.0.0.1:3630.
# Give both the same radar settings, or none: RADAR_X_TERMS, X_API_BEARER_TOKEN,
# RADAR_THREADS_TERMS, THREADS_ACCESS_TOKEN, RADAR_INSTAGRAM_HASHTAGS,
# META_INSTAGRAM_ACCESS_TOKEN, META_INSTAGRAM_USER_ID, META_GRAPH_API_VERSION.
node server/parity/seed-memes.mjs pool 3 | psql
CRON_SECRET=parity-cron node server/parity/trend-pulse.mjs $NEXT $AXUM plain cache   # pair without radar settings
CRON_SECRET=parity-cron node server/parity/trend-pulse.mjs $NEXT $AXUM radar         # pair with all three connectors
CRON_SECRET=parity-cron node server/parity/trend-pulse.mjs $NEXT $AXUM radar-no-x known   # Threads and Instagram only
```

With X configured no run can write `connector_health` (its key `x` fails the
table's check, PLAN.md section 15, R8-2), so the connector errors are only
compared in the pair without X. `known` prints the cases that still differ
and the 30 s connector time limit; it counts nothing.


## Google and Kakao sign-in

`auth-oauth.mjs` compares `POST /api/auth/sign-in/social` and
`GET /api/auth/callback/{google,kakao}` (`src/routes/better_auth/oauth/`)
with the real better-auth in Next, on one database. Neither server reaches
Google or Kakao: Next runs with `tests/oauth_fetch_stub.mjs` preloaded, which
sends its provider requests to `OAUTH_STUB_ORIGIN`, and Axum with
`AXUM_TEST_OAUTH_ORIGIN`. The script serves both stubs itself
(`oauth-provider-stub.mjs`: the authorization `code` says what the token
endpoint answers, the access token what Kakao's profile endpoint answers),
and each stub is also its server's mail webhook (`/hook`).

A writing case runs once per server, each with its own address and its own
start: it compares the start's answer and state row, the callback's answer
(status, every header, `Location`, every `Set-Cookie` line, body), the rows
the address has (`user`, `account`, `session`, `auth.users`, `profiles`),
the mail, what the provider stub received, and a replay of the callback,
with ids, tokens, states, verifiers, signatures and times masked.

```sh
# Both servers with the same DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL=http://localhost:3000,
# NODE_ENV, NEXT_PUBLIC_SITE_URL and RELEASE_SHA (those of the Next build) and the same throwaway client ids:
#   Next: NODE_OPTIONS="--import $PWD/server/tests/oauth_fetch_stub.mjs" OAUTH_STUB_ORIGIN=$NEXT_STUB AUTH_EMAIL_WEBHOOK=$NEXT_STUB/hook
#   Axum: AXUM_TEST_OAUTH_ORIGIN=$AXUM_STUB AUTH_EMAIL_WEBHOOK=$AXUM_STUB/hook
TEST_DB_CONTAINER=<container> NODE_ENV=production NEXT_PUBLIC_SITE_URL=<the build's> \
NEXT_STUB=http://127.0.0.1:4711 AXUM_STUB=http://127.0.0.1:4712 \
  node server/parity/auth-oauth.mjs $NEXT $AXUM [start] [callback] [state] [accounts] [handed] [redirect] [unset]
```

Sections: `start` (both providers, every URL field, absolute trusted URLs,
an unknown provider, a provider of the wrong type, no `callbackURL`, every
URL better-auth refuses in each field, the origin check with cookies),
`callback` (new users of both providers, the mail, `newUserCallbackURL`,
`dont_remember`, token answers without expiry or with a scope list, the
provider's error, no code, token and profile failures, a token answer that is
not JSON or `null`, a profile that is not JSON or has no id, Google without an
`id_token`, `sub` or address, an `id_token` that is not a JWT, reserved
domains), `state` (no or a forged state cookie, an expired state, an expired
state row with the cookie kept, no, an empty or an unknown state), `accounts` (linking a verified local user, the
two refusals, signing in again with a missing and with a `null` refresh
token), `handed` (the requests Axum leaves to Next), `redirect` (PLAN.md
A3-12, a difference on purpose: an error URL better-auth turns into a
`Location` off the site, which Axum answers with the default error page) and `unset`, for a run
where neither server has `KAKAO_CLIENT_ID`. `next dev` sends its own CSP in
development, which is not compared.

`tests/auth_oauth_cross.rs` (ignored; needs Node) starts each case on one
server and finishes it on the other, both ways, against better-auth's own
handler: `cargo test --test auth_oauth_cross -- --ignored --nocapture`.

## Database door

`db-query.mjs` compares `POST /api/db/query` on one throwaway database. From
the repository root, with a Next standalone build (`.next/static` copied into
`.next/standalone/.next/`, or every Next page stays unhydrated) and Axum in
front of it, both with the same `NEXT_PUBLIC_SITE_URL`, `CRON_SECRET` and
`BETTER_AUTH_SECRET`:

```sh
export TEST_DB_CONTAINER=<yours>; DATABASE_URL="$(server/scripts/test-db.sh up)"
docker exec -i $TEST_DB_CONTAINER psql -U postgres -d memecatch -c "alter system set log_statement = 'all'" \
  -c "alter system set log_line_prefix = '@@%a|'" -c "select pg_reload_conf()"
# Three sessions from the app's own better-auth: user, user, operator.
for who in user user operator; do
  DATABASE_URL=$DATABASE_URL BETTER_AUTH_SECRET=... NODE_ENV=production \
    node --import ./scripts/register-ts-paths.mjs server/parity/behaviour/session.mjs $who | tail -1
done > sessions.jsonl
docker exec -i $TEST_DB_CONTAINER psql -U postgres -d memecatch -v ON_ERROR_STOP=1 \
  -v user_a=<id 1> -v user_b=<id 2> -v operator=<id 3> < server/parity/db-query/seed.sql
docker exec -i $TEST_DB_CONTAINER psql -U postgres -d memecatch < server/parity/db-query/snapshot.sql
docker exec -i $TEST_DB_CONTAINER psql -U postgres -d memecatch -c "select parity.save()"
node server/parity/db-query.mjs <next> <axum> --container=$TEST_DB_CONTAINER \
  --sessions=sessions.jsonl --site=<NEXT_PUBLIC_SITE_URL> [fixture fuzz limits video]
```

Each write runs on a database restored to the seed (`parity.restore()`), and
the rows of `public` and `private` after it are compared. `--write-sql=
server/tests/fixtures/db_query_sql.json` (with `fixture`) also rewrites the
statements `src/routes/db_query/sql_tests.rs` compares the compiler with.
Leave a minute between runs: the route allows 1,200 requests a minute.

## C1: what Next does outside its routes

`docs/axum-migration/inventory/next-implicit.md` lists the behaviours and
PLAN.md section C1 the results. Start Next as above, one Axum in front of it
(`UPSTREAM_URL`) and one without upstream (`AXUM_NO_UPSTREAM=true`), both with
`AXUM_PUBLIC_DIR=.next/standalone/public` (the validators come from the
files' times, so both servers must serve the same copy), every page route in
`AXUM_PILOT_ROUTES`, and the `NEXT_PUBLIC_*` values the Next build had.

```sh
# Public files and metadata files: byte for byte, with either Axum.
node server/parity/public-targets.mjs .next/standalone/public > /tmp/public-targets.txt
node server/parity/parity.mjs $NEXT $AXUM /tmp/public-targets.txt
node server/parity/parity.mjs $NEXT $AXUM /sitemap.xml /favicon.ico /icon.svg /apple-icon.png /manifest.webmanifest

# Without upstream: redirects, the sign-in gate, 405, OPTIONS, build files.
node server/parity/parity.mjs $NEXT $AXUM_ALONE server/parity/standalone-targets.txt

# /_next/image: headers exact, pixels within a tolerance (writes nothing).
node server/parity/images.mjs $NEXT $AXUM_ALONE .next/standalone/public

# The service worker at the cutover (Chromium; a proxy on port 3760).
node server/parity/worker.mjs $NEXT $AXUM_ALONE

# The blocker list: Next routes Axum alone cannot answer yet, signed out and
# as an operator, and the GET paths it answers for the page gate.
node server/parity/standalone-blockers.mjs $NEXT $AXUM_ALONE --answered=/tmp/answered.txt
node server/parity/standalone-blockers.mjs $NEXT $AXUM_ALONE --cookie="$OPERATOR_COOKIE"
sed "s|^|$NEXT|" /tmp/answered.txt > /tmp/answered-urls.txt
node server/parity/pages/pages.mjs $NEXT $AXUM_ALONE /tmp/answered-urls.txt
```

`parity.mjs` targets may carry request headers after the path:
`GET /ads.txt ; Range: bytes=0-9 ; If-None-Match: W/"3b-1"`.

The sitemap reads Next's discovery index through `unstable_cache`, stored in
`.next/standalone/.next/cache` for an hour: two Next processes on different
databases share it, so run one at a time and empty that folder between
them. For a catalogue larger than a page, load `tests/fixtures/r1_reviewer.sql`,
`r1_seed.sql` and `text-routes-big.sql` into a fresh database.
