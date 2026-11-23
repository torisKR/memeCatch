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

`tests/public_routes` replaces the approved rows of `memes`, so it refuses a
database that holds more than the migrations' memes. Run `cargo test` before
the parity scripts below, or on a fresh database.

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

This server has 256 MB, a tenth of what Next has. Do not hold a whole object
or body in memory (`routes/media.rs` streams), and give any map keyed by
something a client chooses a size limit (`routes/public/rate_limit.rs`).
