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
# 1. A throwaway database with the seeds (repository root).
export TEST_DB_CONTAINER=memecatch-behaviour-pg
DATABASE_URL="$(server/scripts/test-db.sh up)"; export DATABASE_URL
for seed in seed b2-seed b2b-seed b3-seed b4-seed b5-seed b6-community b6-meme-community b6-submit b7-seed; do
  docker exec -i "$TEST_DB_CONTAINER" psql -U postgres -d memecatch -v ON_ERROR_STOP=1 -q \
    < "server/behaviour/seeds/$seed.sql"
done

# 2. The server on a loopback site origin, in production mode (the session
#    cookie is `__Secure-`, which a browser keeps over plain HTTP only on
#    loopback hosts).
export BETTER_AUTH_SECRET=behaviour-secret-0123456789abcdef
(cd server && PORT=3001 NODE_ENV=production NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3001 \
  NEXT_PUBLIC_COMMUNITY_ENABLED=false cargo run --release) &

# 3. The scenarios.
AXUM_URL=http://127.0.0.1:3001 node_modules/.bin/playwright test -c server/behaviour/playwright.config.mjs
# narrow it: --project=mobile, a file name, -g "<title>"
```

Signed-in scenarios make a fresh user and session on that database
(`session.mjs`, the rows and the signed cookie as
`server/tests/common/session.rs` makes them), so `DATABASE_URL` must be on
localhost and `BETTER_AUTH_SECRET` the server's. Scenarios that make the
database fail, or reset rows, run SQL as the superuser of `TEST_DB_CONTAINER`.
Scenarios run one at a time: they share saved memes and sessions.

`seeds/` holds the rows each group of scenarios reads: `seed.sql` (the frame,
the meme page), `b2*` (lists, explore, global, meme cards, news, quiz),
`b3-seed.sql` (the meme document), `b4-seed.sql` (the home page),
`b5-seed.sql` (the translated editions), `b6-*` (account, community, submit;
`b6-my.sql` is for one signed-in user), `b7-seed.sql` (the operator screens).

## Adding a scenario

1. Write it with `test` from `lib.mjs`, in a file of `scenarios/` (one per
   feature area). Use `open(page, path)` to load a page, role and label
   locators, `focused`, `focusRing`, `requestsDuring`, `localStorageItem`,
   `sessionStorageItem`, `cookieValue`, and the `signIn("user" | "operator")`
   fixture. Use `mobileOnly` or `desktopOnly` where the behaviour exists at
   one width.
2. Check the scenario catches a broken script: break the feature's file in
   `server/ui`, rebuild (`node server/scripts/build-ui.mjs`, then the server),
   and see it fail.

A request the step did not cause is filtered out in `lib.mjs`
(`NOT_BEHAVIOUR`: assets and the server's `/_axum/` fragments). A page that is
leaving cannot be evaluated from outside while the next one loads; watch it
from inside with an init script that logs, as the navigation progress scenario
does.
