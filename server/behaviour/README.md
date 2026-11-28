# Behaviour scenarios

`scenarios/` drives a real browser (Playwright) through what a reader does on
the server's pages, at a phone width and a desktop width (projects `mobile`
and `desktop`). It asserts what a user can observe: the URL, visible text and
state, focus and its ring, `aria-*`, cookies, storage, and the requests a
step causes (method, path, body and its shape). It does not look at class
names or markup structure.

The scenarios were written against the Next app and the Rust server side by
side during the migration (docs/axum-migration/PLAN.md); since Next's removal
they run against the server alone.

```sh
# From the repository root, with a release build of the server
# (cd server && cargo build --release), Docker, openssl and node_modules.
server/behaviour/run.sh                    # everything, then everything down
server/behaviour/run.sh --project=mobile frame.spec -g "<title>"   # narrowed

# Or keep it up and run Playwright yourself, as often as you like:
eval "$(server/behaviour/run.sh up)"
node_modules/.bin/playwright test -c server/behaviour/playwright.config.mjs
server/behaviour/run.sh down
```

`run.sh` makes a throwaway database from the migrations
(`server/scripts/test-db.sh`, container `TEST_DB_CONTAINER`, default
`memecatch-behaviour-pg`), loads the seeds below in their order, starts
`openai-stub.mjs` on loopback HTTPS with a throwaway CA, and starts the
server on `http://127.0.0.1:3001` (`BEHAVIOUR_PORT`; the stub on
`BEHAVIOUR_STUB_PORT`, 3444). The server runs in production mode on a
loopback site origin: the session cookie is `__Secure-`, which a browser
keeps over plain HTTP only on loopback hosts. It has the secrets production
has (without `MEMECATCH_SIGNING_SECRET` the analytics and view routes answer
503), a GA id (the pages push their events; `lib.mjs` aborts the tag's
download), the OpenAI stub as `OPENAI_REVIEW_BASE_URL` for the operator's GPT
drafts, and the community on (production's `build.env` has it off; the
comment and post scenarios need it). Nothing leaves the machine. CI runs the
same script (`behaviour` in `.github/workflows/ci.yml`).

Signed-in scenarios make a fresh user and session on that database
(`session.mjs`, the rows and the signed cookie as
`server/tests/common/session.rs` makes them), so `DATABASE_URL` must be on
localhost and `BETTER_AUTH_SECRET` the server's. Scenarios that make the
database fail, or reset rows, run SQL as the superuser of `TEST_DB_CONTAINER`.
Scenarios run one at a time: they share saved memes and sessions.

`seeds/` holds the rows each group of scenarios reads, loaded in this order:
`seed.sql` (the frame, the meme page), `b2-catalog.mjs` (the 3,562 memes of
the /memes directory, from `server/tests/fixtures/directory_order.json`; the
B2 seeds build on them), `b2*` (lists, explore, global, meme cards, news,
quiz), `b3-seed.sql` (the meme document), `b4-seed.sql` (the home page),
`b5-seed.sql` (the translated editions), `b6-*` (account, community, submit;
`b6-my.sql` is for one signed-in user and not in the standard set),
`b7-seed.sql` (the operator screens).

The `/explore` browse grid only lists cards with an eligible thumbnail or
editorial illustration. Name searches still return text-only matches, and
the alphabetical directory and detail URLs are not filtered by card art.

## Adding a scenario

1. Write it with `test` from `lib.mjs`, in a file of `scenarios/` (one per
   feature area). Use `open(page, path)` to load a page, role and label
   locators, `focused`, `focusRing`, `requestsDuring`, `localStorageItem`,
   `sessionStorageItem`, `cookieValue`, and the `signIn("user" | "operator")`
   fixture. Use `mobileOnly` or `desktopOnly` where the behaviour exists at
   one width.
2. Leave the database as you found it: the suite must pass twice in a row
   on one database and in any order. Write to rows of your own (a fresh
   user from `signIn`, titles that name the scenario) or put back what you
   changed in `afterAll`/`afterEach` (the operator screens reset their
   seeded rows). Find seeded rows by what makes them yours, not by what any
   row of their kind shows: other scenarios add rows of every kind. After
   changing rows a cached page reads, call `expirePageCaches()`.
3. Check the scenario catches a broken script: break the feature's file in
   `server/ui`, rebuild (`node server/scripts/build-ui.mjs`, then the server),
   and see it fail.

A request the step did not cause is filtered out in `lib.mjs`
(`NOT_BEHAVIOUR`: assets and the server's `/_axum/` fragments). A page that is
leaving cannot be evaluated from outside while the next one loads; watch it
from inside with an init script that logs, as the navigation progress scenario
does.
