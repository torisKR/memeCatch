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

The proxy tests need no database. The `db_identity` and `health` tests refuse
any `DATABASE_URL` that is not on localhost.

## Run in front of a local Next

```sh
DATABASE_URL=... BETTER_AUTH_SECRET=... UPSTREAM_URL=http://127.0.0.1:3001 PORT=3100 cargo run
node parity/parity.mjs http://127.0.0.1:3001 http://127.0.0.1:3100 parity/paths.txt
```

`parity/README.md` explains what the harness compares. Every setting is
documented on `Config` in `src/config.rs`.

## Add a native route

Add it in its module's `router` function with `Routes::add(id, path, methods)`
(`src/routes/mod.rs`). The id is what an operator lists in
`AXUM_DISABLED_ROUTES` to hand the route back to Next. Then add the path to
`parity/paths.txt` and run the harness against a real Next.
