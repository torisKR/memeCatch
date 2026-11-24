#!/usr/bin/env node
// The R4 routes, Next against Axum on one database: the retired product APIs,
// /api/cron/growth-baseline, POST /api/cron/source-refresh, the Instagram
// video cache route and /api/cron/saved-state-emails. Every status each route
// answers, signed out and signed in, bad input and the other methods; for the
// saved-state emails also what the email provider received (https-stub.mjs)
// and the rows each run leaves. See README.md in this directory.
//
//   PARITY_USER="$(cat user1.json)" PARITY_USER_2="$(cat user2.json)" STUB_CA=ca.pem \
//     CRON_SECRET=<the servers'> node server/parity/ops.mjs <next> <axum> [section...]
//
// PARITY_USER becomes an operator. Never sends an authenticated GET to
// /api/cron/source-refresh: that runs the real refresh, which calls YouTube
// and the oEmbed endpoints. Throwaway database only.
import { readFileSync } from "node:fs";
import https from "node:https";
import { compare, compareOnce, expectEqual, fail, nextBase, axumBase, pass, psql, run, send, sqlText } from "./harness.mjs";

const user = JSON.parse(process.env.PARITY_USER ?? "null");
const otherUser = JSON.parse(process.env.PARITY_USER_2 ?? "null");
const cronSecret = process.env.CRON_SECRET;
const stubCa = process.env.STUB_CA;
if (!user?.cookie || !otherUser?.cookie || !cronSecret || !stubCa) {
  console.error("PARITY_USER, PARITY_USER_2, CRON_SECRET and STUB_CA are required");
  process.exit(2);
}
const SITE = new URL(nextBase).origin;
const bearer = { authorization: `Bearer ${cronSecret}` };
const BAD_BEARERS = [undefined, "Bearer wrong", `bearer ${cronSecret}`, `Bearer  ${cronSecret}`, `Bearer ${cronSecret}x`, cronSecret];
const authCases = (method, path, extra = {}) =>
  BAD_BEARERS.map((value) => [`${method} ${path}, authorization ${JSON.stringify(value ?? null)}`,
    { method, path, headers: { ...extra, ...(value === undefined ? {} : { authorization: value }) } }]);

/** What the stub recorded since the last call, and forgets it. */
function stubRequests() {
  return new Promise((resolve, reject) => {
    https.get("https://127.0.0.1:3443/__requests", { ca: readFileSync(stubCa) }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))));
    }).on("error", reject);
  });
}

/** PARITY_USER is an operator, PARITY_USER_2 is not. protect_profile_columns
 * lets only service_role change a role, and reads that from the app's login
 * role; the superuser here skips the trigger. */
function promoteOperator() {
  psql(`begin;
        set local session_replication_role = replica;
        update public.profiles set role = 'operator' where id = ${sqlText(user.userId)}::uuid;
        update public.profiles set role = 'user' where id = ${sqlText(otherUser.userId)}::uuid;
        commit;`);
}

async function retired() {
  const paths = ["/api/cron/adpick-hotdeals", "/api/creator-products", "/api/creator-products/x",
    "/api/creator-products/a/b/c?q=1", "/api/creator-products/%E2%9C%93", "/api/creator-products/"];
  for (const path of paths) {
    for (const method of ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      await compare(`${method} ${path}`, { method, path, headers: { "content-type": "application/json" }, body: method === "GET" || method === "HEAD" ? undefined : "{}" });
    }
  }
}

async function growthBaseline() {
  const path = "/api/cron/growth-baseline";
  for (const [label, request] of authCases("GET", path)) await compare(label, request, { status: 401 });
  // HTTP parsers drop whitespace after a header value, in Node as in hyper.
  await compareOnce("trailing space after the secret", { path, headers: { authorization: `Bearer ${cronSecret} ` } }, { status: 200 });
  await compare("POST is not handled", { method: "POST", path, headers: bearer });
  // One row per period: a second capture updates it.
  psql("delete from public.growth_funnel_baselines");
  await compareOnce("GET with the cron bearer", { path, headers: bearer }, { status: 200 });
  expectEqual("one baseline row for the current period", psql(
    "select count(*) || ' ' || bool_and(period_end = date_trunc('day', now())) from public.growth_funnel_baselines"), "1 true");
  await compareOnce("HEAD with the cron bearer", { method: "HEAD", path, headers: bearer }, { status: 200 });
  psql("alter function public.capture_growth_funnel_baseline(timestamptz) rename to capture_growth_funnel_baseline_r4_off");
  try {
    await compareOnce("GET while the function fails", { path, headers: bearer }, { status: 500 });
  } finally {
    psql("alter function public.capture_growth_funnel_baseline_r4_off(timestamptz) rename to capture_growth_funnel_baseline");
  }
}

async function sourceRefresh() {
  const path = "/api/cron/source-refresh";
  for (const [label, request] of authCases("POST", path)) await compare(label, request, { status: 401 });
  await compareOnce("trailing space after the secret", { method: "POST", path, headers: { authorization: `Bearer ${cronSecret} ` } }, { status: 200 });
  await compareOnce("POST with the cron bearer expires the catalog", { method: "POST", path, headers: bearer }, { status: 200 });
  await compare("GET without the bearer (still Next's)", { path }, { status: 401 });
  await compare("PUT is not handled", { method: "PUT", path, headers: bearer });
}

async function instagramVideo() {
  const path = "/api/admin/instagram-video-verification/revalidate";
  promoteOperator();
  let n = 0;
  const from = () => ({ "x-forwarded-for": `198.51.100.${++n}` });
  const cases = [
    ["no Origin, no Sec-Fetch-Site", {}, 403],
    ["Sec-Fetch-Site cross-site", { "sec-fetch-site": "cross-site" }, 403],
    ["Origin of another site", { origin: "https://evil.example" }, 403],
    ["site Origin, signed out", { origin: SITE }, 401],
    ["same-origin fetch, signed out", { "sec-fetch-site": "same-origin" }, 401],
    ["site Origin, forged session cookie", { origin: SITE, cookie: `${user.cookieName}=forged.token` }, 401],
    ["site Origin, signed in, not an operator", { origin: SITE, cookie: otherUser.cookie }, 403],
    ["site Origin, operator", { origin: SITE, cookie: user.cookie }, 200],
    ["same-origin fetch, operator", { "sec-fetch-site": "same-origin", cookie: user.cookie }, 200],
  ];
  for (const [label, headers, status] of cases) {
    await compareOnce(label, { method: "POST", path, headers: { ...from(), ...headers }, body: "{}" }, { status });
  }
  await compare("GET is not handled", { path, headers: from() });
  // 30 a minute per client address; the 31st is refused, on each server.
  const flood = async (base) => {
    const headers = { "x-forwarded-for": "203.0.113.77", origin: SITE };
    for (let i = 0; i < 30; i += 1) await send(base, { method: "POST", path, headers });
    return send(base, { method: "POST", path, headers });
  };
  const [next, axum] = [await flood(nextBase), await flood(axumBase)];
  const summary = (r) => `${r.status} ${r.body} retry-after=${r.headers["retry-after"]}`;
  expectEqual("31st request in a minute", summary(axum), summary(next));
}

// Saved-state emails. The rows of one batch, all with dedupe keys `r4-...`.
const ID = (n) => `00000000-0000-4000-8000-0000000004${String(n).padStart(2, "0")}`;
const EXTRA_USERS = { fail: "r4+fail@example.com", slow: "r4+slow@example.com", blank: "   ", nouser: null };

function resetBatch(rows) {
  const users = Object.entries(EXTRA_USERS).map(([key], index) => [key, `00000000-0000-4000-8000-0000000005${String(index).padStart(2, "0")}`]);
  const userId = Object.fromEntries([["one", user.userId], ["two", otherUser.userId], ...users]);
  const sql = [`delete from public.notification_outbox where dedupe_key like 'r4-%';`];
  for (const [key, id] of users) {
    sql.push(`insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
      values ('${id}', 'r4-${key}@example.com', now(), jsonb_build_object('nickname', 'r4-${key}')) on conflict (id) do nothing;`);
    if (EXTRA_USERS[key] !== null) {
      sql.push(`insert into public."user" (id, name, email, "emailVerified") values ('${id}', 'r4 ${key}', ${sqlText(EXTRA_USERS[key])}, true) on conflict (id) do nothing;`);
    }
  }
  rows.forEach(([who, payload], index) => {
    sql.push(`insert into public.notification_outbox (id, topic, channel, user_id, dedupe_key, payload, available_at, created_at)
      values ('${ID(index)}', 'meme.state.changed', 'email', ${who ? `'${userId[who]}'` : "null"}, 'r4-${index}',
              ${sqlText(JSON.stringify(payload))}::jsonb, now() - interval '1 hour' + ${index} * interval '1 second', now());`);
  });
  psql(sql.join("\n"));
}

const outboxRows = () => psql(`select id, status, coalesce(last_error, '-'), attempt_count, claim_token is null, finished_at is not null
  from public.notification_outbox where dedupe_key like 'r4-%' order by id`);
const sortedBodies = (requests) => JSON.stringify(requests.map((r) => ({ ...r, body: JSON.parse(r.body) }))
  .sort((a, b) => String(a.body.idempotencyKey).localeCompare(String(b.body.idempotencyKey))), null, 1);

const payload = (title, locale, oldState = "rising", newState = "trending", shortId = "r4-meme") =>
  ({ title, short_id: shortId, old_state: oldState, new_state: newState, locale });
const BATCH = [
  ["one", payload("  <밈> & \"따옴표\" 'x'  ", "ko")],
  ["two", payload(`${"a".repeat(199)}😀 tail`, "en", "candidate", "archive")],
  ["fail", payload("provider refuses", "en")],
  ["slow", payload("provider is slow", "ja")],
  ["blank", payload("blank address", "zh")],
  ["nouser", payload("no better-auth user", "en")],
  [null, payload("no user at all", "en")],
  ["one", payload("bad short id", "en", "rising", "trending", "bad_id!")],
  ["two", payload("prototype states", "ja", "constructor", "__proto__")],
  ["one", payload("control\u0001chars\nand\ttabs   /", "zh-tw", "cooling", "unknown")],
  ["two", payload("eleventh row, past the limit of 10", "ko")],
];

/** The same batch through each server: response, provider requests, rows. */
async function sameBatch(label, rows) {
  const seen = {};
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    resetBatch(rows);
    await stubRequests();
    const response = await send(base, { path: "/api/cron/saved-state-emails", headers: bearer });
    seen[name] = { response: `${response.status} ${response.body}`, provider: sortedBodies(await stubRequests()), rows: outboxRows() };
  }
  expectEqual(`${label}: response`, seen.axum.response, seen.next.response, seen.next.response);
  expectEqual(`${label}: what the provider received`, seen.axum.provider, seen.next.provider, `${JSON.parse(seen.next.provider).length} requests`);
  expectEqual(`${label}: outbox rows`, seen.axum.rows, seen.next.rows);
  return seen.next;
}

async function savedState() {
  const path = "/api/cron/saved-state-emails";
  for (const [label, request] of authCases("GET", path)) await compare(label, request, { status: 401 });
  await compare("POST is not handled", { method: "POST", path, headers: bearer });
  resetBatch([]);
  await compareOnce("empty outbox", { path, headers: bearer }, { status: 200 });
  const batch = await sameBatch("batch of 11", BATCH);
  console.log(`      rows after the batch:\n${batch.rows.replace(/^/gm, "        ")}`);
  await sameBatch("one row, all delivered", [BATCH[0]]);
  await sameBatch("only failures", [BATCH[2], BATCH[7]]);
  psql("alter function public.claim_saved_state_email_outbox(integer) rename to claim_saved_state_email_outbox_r4_off");
  try {
    await sameBatch("claim fails", [BATCH[0]]);
  } finally {
    psql("alter function public.claim_saved_state_email_outbox_r4_off(integer) rename to claim_saved_state_email_outbox");
  }
  psql("alter function public.finish_notification_outbox(uuid, uuid, boolean, text, timestamptz) rename to finish_notification_outbox_r4_off");
  try {
    await sameBatch("finish fails", [BATCH[0]]);
  } finally {
    psql("alter function public.finish_notification_outbox_r4_off(uuid, uuid, boolean, text, timestamptz) rename to finish_notification_outbox");
  }
  resetBatch([]);
}

/** For a server pair started without a usable delivery URL (servers.sh unconfigured or http). */
async function notConfigured() {
  await sameBatch("not configured: nothing is claimed", [BATCH[0]]);
}

/** For a server pair started with no PLUS_DIGEST_DELIVERY_TOKEN. */
async function noToken() {
  const seen = await sameBatch("no token", [BATCH[0]]);
  const sent = JSON.parse(seen.provider);
  if (sent.length === 1 && sent[0].headers.authorization === null) pass("no authorization header without a token");
  else fail("no authorization header without a token", seen.provider);
}

// Next's Data Cache, read by a page Next still renders: /memes/<key> reads its
// meme through cacheCatalogRead under PUBLIC_CATALOG_CACHE_TAG (24 h). A title
// changed in the database stays hidden until something expires that tag; each
// route must do so whether Next or Axum answers it. Needs the meme `parity-0`
// of `seed-memes.mjs pool 3`.
async function cache() {
  const key = psql("select short_id || '-' || slug from public.memes where slug = 'parity-0' and moderation_status = 'approved'");
  if (!key) return fail("cache", "seed first: node server/parity/seed-memes.mjs pool 3 | psql");
  const original = psql("select title from public.memes where slug = 'parity-0'");
  const page = `/memes/${key}`;
  const shownTitle = async () => {
    const response = await send(nextBase, { path: page });
    return /<title>([^<|]*)/.exec(response.body.toString("utf8"))?.[1]?.trim() ?? `(status ${response.status})`;
  };
  const setTitle = (title) => psql(`update public.memes set title = ${sqlText(title)} where slug = 'parity-0'`);
  promoteOperator();
  const operator = { origin: SITE, cookie: user.cookie, "x-forwarded-for": "192.0.2.10" };
  const routes = [
    ["Axum POST /api/cron/source-refresh", axumBase, "/api/cron/source-refresh", bearer],
    ["Next POST /api/cron/source-refresh", nextBase, "/api/cron/source-refresh", bearer],
    ["Axum POST .../instagram-video-verification/revalidate", axumBase, "/api/admin/instagram-video-verification/revalidate", operator],
    ["Next POST .../instagram-video-verification/revalidate", nextBase, "/api/admin/instagram-video-verification/revalidate", operator],
  ];
  try {
    await shownTitle(); // fill the cache
    for (const [index, [label, base, path, headers]] of routes.entries()) {
      const before = await shownTitle();
      const changed = `${original} r4-${index}`;
      setTitle(changed);
      const stale = await shownTitle();
      const answer = await send(base, { method: "POST", path, headers });
      const after = await shownTitle();
      const note = `${JSON.stringify(stale)} -> ${answer.status} -> ${JSON.stringify(after)}`;
      if (stale === before && answer.status === 200 && after.startsWith(changed)) pass(`${label}: the page shows the new title`, note);
      else fail(`${label}: the page shows the new title`, note);
    }
    // Control: with no route in between, the change stays hidden.
    const before = await shownTitle();
    setTitle(`${original} r4-control`);
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    expectEqual("no route called: the page keeps the cached title", await shownTitle(), before);
  } finally {
    setTitle(original);
    await send(axumBase, { method: "POST", path: "/api/cron/source-refresh", headers: bearer });
  }
}

// /api/db/query runs any query plan the browser sends (select, insert,
// update, delete, upsert, rpc on any table or function of the public
// schema), as anon or as the signed-in user, and row-level security is the
// only authorization behind it. These are its refusals, sent to Next and to
// Axum, which answers the route itself since R9; the full comparison is
// db-query.mjs.
async function dbQuery() {
  const path = "/api/db/query";
  let n = 0;
  const from = () => ({ "x-forwarded-for": `192.0.2.${++n}`, origin: SITE, "content-type": "application/json" });
  const plan = (extra) => ({ op: "select", table: "memes", fields: [{ kind: "star" }], filters: [], orGroups: [], orders: [],
    limit: 1, offset: null, single: false, maybeSingle: false, count: null, head: false, returning: true, ...extra });
  const body = (value) => JSON.stringify({ plan: value });
  const embed = (fields) => ({ kind: "embed", embed: { alias: "m", table: "memes", inner: false, hint: null, fields, filters: [], orGroups: [], orders: [], limit: 1 } });
  const cases = [
    ["no Origin, no Sec-Fetch-Site", { "x-forwarded-for": "192.0.2.200" }, body(plan()), 403],
    ["Origin of another site", { ...from(), origin: "https://evil.example" }, body(plan()), 403],
    ["body is not JSON", from(), "{", 400],
    ["body over 1 MB", from(), JSON.stringify({ plan: plan(), pad: "x".repeat(1024 * 1024) }), 413],
    ["no plan", from(), "{}", 400],
    ["unknown op", from(), body(plan({ op: "drop" })), 400],
    ["fields is not a list", from(), body(plan({ fields: "*" })), 400],
    ["limit over 1000", from(), body(plan({ limit: 1001 })), 400],
    ["negative limit", from(), body(plan({ limit: -1 })), 400],
    ["51 filters", from(), body(plan({ filters: Array.from({ length: 51 }, () => ({ column: "id", op: "eq", value: "x" })) })), 400],
    ["embeds nested three deep", from(), body(plan({ fields: [embed([embed([embed([{ kind: "star" }])])])] })), 400],
    ["table name that is not an identifier", from(), body(plan({ table: "memes;drop" })), 400],
    ["anon reads approved memes", from(), body(plan({ fields: [{ kind: "column", name: "slug" }], filters: [{ column: "slug", op: "eq", value: "parity-0" }] })), 200],
    ["anon reads the outbox (row-level security)", from(), body(plan({ table: "notification_outbox", fields: [{ kind: "column", name: "id" }] })), undefined],
    ["anon calls a service_role function", from(), body({ ...plan(), op: "rpc", fn: "claim_saved_state_email_outbox", table: undefined, args: { p_limit: 1 } }), undefined],
    ["anon calls a function that does not exist", from(), body({ ...plan(), op: "rpc", fn: "no_such_function_r4", table: undefined, args: {} }), undefined],
    ["anon inserts a meme", from(), body({ ...plan(), op: "insert", values: { slug: "r4-anon", title: "x" } }), undefined],
    ["signed in, reads own nickname", { ...from(), cookie: otherUser.cookie }, body(plan({ table: "profiles", fields: [{ kind: "column", name: "nickname" }], filters: [{ column: "id", op: "eq", value: otherUser.userId }] })), 200],
    ["signed in, reads own role (no column grant)", { ...from(), cookie: otherUser.cookie }, body(plan({ table: "profiles", fields: [{ kind: "column", name: "role" }], filters: [{ column: "id", op: "eq", value: otherUser.userId }] })), 400],
    ["signed in, makes itself an operator", { ...from(), cookie: otherUser.cookie }, body({ ...plan({ table: "profiles", filters: [{ column: "id", op: "eq", value: otherUser.userId }] }), op: "update", values: { role: "operator" } }), undefined],
    ["forged session cookie counts as anon", { ...from(), cookie: `${user.cookieName}=forged.token` }, body(plan({ fields: [{ kind: "column", name: "slug" }], filters: [{ column: "slug", op: "eq", value: "parity-0" }] })), 200],
  ];
  for (const [label, headers, text, status] of cases) {
    await compare(label, { method: "POST", path, headers, body: text }, { status });
  }
  expectEqual("the role update was refused", psql(`select role from public.profiles where id = ${sqlText(otherUser.userId)}::uuid`), "user");
  await compare("GET is not handled", { path, headers: from() });
  // 180 a minute per client address, counted by Next for both paths.
  const flood = async (base, address) => {
    const headers = { "x-forwarded-for": address, origin: SITE, "content-type": "application/json" };
    for (let i = 0; i < 180; i += 1) await send(base, { method: "POST", path, headers, body: "{" });
    return send(base, { method: "POST", path, headers, body: "{" });
  };
  const summary = (r) => `${r.status} ${r.body} retry-after=${r.headers["retry-after"]}`;
  expectEqual("181st request in a minute", summary(await flood(axumBase, "192.0.2.251")), summary(await flood(nextBase, "192.0.2.250")));
}

await run({ cache, "db-query": dbQuery, retired, "growth-baseline": growthBaseline, "source-refresh": sourceRefresh, "instagram-video": instagramVideo,
  "saved-state": savedState, "not-configured": notConfigured, "no-token": noToken });
