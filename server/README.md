# memecatch-server

The site's server: every page (Maud templates, rendered per request) and every
API route. It replaced the Next app route by route; `docs/axum-migration/`
keeps the history of that port (PLAN.md lists what differs from the old app
on purpose and why).

## Run the gates

```sh
cd server
export DATABASE_URL="$(scripts/test-db.sh up)"   # Docker Postgres built from db/migrations
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
scripts/test-db.sh down
```

The tests that use a database refuse any `DATABASE_URL` that is not on
localhost. `scripts/test-db.sh` replaces the container named
`memecatch-axum-test-pg`; set `TEST_DB_CONTAINER` to another name when someone
else may be using that one. The sign-in tables come from the migrations
(`tests/auth_tables.rs` pins them).

`tests/public_routes` replaces the approved rows of `memes` and
`tests/text_routes` replaces every meme, so both refuse a database that holds
more than the migrations' memes. `tests/engagement_routes` replaces the
approved rows too, and the collectible cards and their owners.

Many tests compare with fixtures captured from the old TypeScript app
(`tests/fixtures`, and `*.json` next to the code that reads them). The scripts
that captured them ran that app and were removed with it; the fixtures are the
reference now.

One test is `#[ignore]`d because it runs TypeScript the mpe-worker still uses
(Node 22.18 or newer and the packages of the repository root):

```sh
parity/storage-parity.sh   # lib/object-storage.ts (the worker) and src/storage, both directions
```

## Run it

```sh
cd server
PORT=3000 DATABASE_URL=postgresql://memecatch:...@127.0.0.1:5432/memecatch \
  BETTER_AUTH_SECRET=... NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000 cargo run
```

Production runs `Dockerfile.server` as the `app` service of
`docker-compose.yml`, which lists every variable it passes;
`tests/compose_env.rs` fails when the server reads one that is neither passed
there nor listed as left out. `NEXT_PUBLIC_*` are build args of the image
(`deploy/build.env`) kept in its environment; the names are the old app's, so
`.env` and `build.env` stay valid. `AXUM_PUBLIC_DIR` (set by the image) is the
`public/` folder the server answers files from.

## Browser behaviour

`behaviour/` drives a browser through the pages (Playwright, a phone and a
desktop width): `behaviour/README.md`.

## Pages

`src/pages` renders the pages as finished HTML with Maud templates. Every
page is drawn inside the frame of `src/pages/chrome` (header, menus, language
switch, account menu, bottom navigation, chat, install prompt, navigation
progress, footer), in any of the 19 languages. The strings are
`i18n/*.json`, the source of truth for the copy (they were exported from the
old app's dictionaries; edit them directly).

The stylesheet and the scripts are built from `ui/` and committed, so the
image needs no Node:

- `ui/globals.css`, `ui/modules/*.module.css` and `ui/site.css`, through
  Tailwind CSS v4, into `assets/site.css` (and `assets/pages/home.css`);
- `ui/*.js` (the frame) and the TypeScript of `ui/lib/` into `assets/site.js`
  and one script per page that needs one (`assets/pages/*.js`);
- `lib/db/plan.ts` and `lib/source-links.ts` are shared with the mpe-worker
  and the scripts and stay in `lib/`.

```sh
# From the repository root, after changing src/pages, ui/ or those lib/ modules:
node server/scripts/build-ui.mjs            # rewrites assets/ (committed)
node server/scripts/build-ui.mjs --check    # exit 1 if anything is stale (CI)
node server/scripts/build-ui.mjs --sizes    # what each script part weighs
```

## Before and around the routes

`src/standalone` does what runs before routing (`before_routing`: URL
normalisation, the redirects, the sign-in gate) and answers what no route
takes (`answer`, through `src/fallback.rs`): the service worker
(`/sw.js`), the public files, `/_next/image` (the image URLs pages and old
links use), the not-found documents and, from the route table it keeps
(`standalone/next_routes.json`, frozen from the old app), 405 and the
`OPTIONS` answers. A handler that cannot answer a request (an unreadable
target, a document it does not render) returns `fallback::answer`.

## Outbound HTTPS

A route that calls a provider itself uses `state.outbound` (`src/outbound.rs`):
the Mozilla roots compiled in, plus the PEM file `AXUM_EXTRA_CA_CERTS` names.
Tests point it at a local stub; production leaves it unset.

## Add a route

Add it in its module's `router` function with `Routes::add(id, path, methods)`
and add the id to `ROUTE_IDS` (both in `src/routes/mod.rs`), and a sample
request for it in `tests/all_routes.rs`.

`Routes::add` gives the answer the site's headers and sends the body chunked
(no `Content-Length`, also on `HEAD`), so a handler returns a plain body.

`routes/request.rs` has what a handler needs to read a request: the `Origin`
check, a body with a size limit, `JSON.parse` with JavaScript's key order,
`URLSearchParams` and the session user.

This server has 256 MB. Do not hold a whole object or body in memory
(`routes/media.rs` streams), and give any map keyed by something a client
chooses a size limit (`routes/public/rate_limit.rs`).
