#!/usr/bin/env node
// GET /api/cron/trend-pulse, Next against Axum on one database. For each case
// the database is put in the same state, the route runs on one server, and
// the answer, what the radar providers received (a recording stub on
// port 3630, reached through radar-intercept.mjs in Next and
// AXUM_TEST_RADAR_ORIGIN in Axum) and the rows the run leaves are read; then
// the same is done through the other server. See README.md here.
//
//   CRON_SECRET=<the servers'> node server/parity/trend-pulse.mjs <next> <axum> [section...]
//
// Sections: `plain` (servers without radar settings), `radar` (servers with
// them), `cache` (Next's catalog cache through each server; needs the meme
// `parity-0` of `seed-memes.mjs pool 3`). `radar-no-x` is `radar` for a pair
// without the X connector: the X cases then expect no signal failure. Throwaway database only: it
// replaces database functions for a moment and empties connector_health.
import http from "node:http";
import { compare, expectEqual, fail, pass, nextBase, axumBase, psql, run, send, sqlText } from "./harness.mjs";

const cronSecret = process.env.CRON_SECRET;
/** The port radar-intercept.mjs and AXUM_TEST_RADAR_ORIGIN point to. */
const stubPort = 3630;
let noX = false;
if (!cronSecret) {
  console.error("CRON_SECRET is required");
  process.exit(2);
}
const PATH = "/api/cron/trend-pulse";
const bearer = { authorization: `Bearer ${cronSecret}` };
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The stub: `script(url)` answers each request ({ status, body } or
// { hang: true } or { destroy: true }); every request is recorded.
let script = () => ({ status: 404, body: "" });
let records = [];
const sockets = new Set();
const stub = http.createServer((request, response) => {
  const headers = Object.fromEntries(Object.entries(request.headers)
    .filter(([name]) => !["host", "connection", "accept-encoding"].includes(name)));
  records.push(`${request.method} ${request.url} ${JSON.stringify(headers, Object.keys(headers).sort())}`);
  const answer = script(new URL(request.url, "http://stub"));
  if (answer.hang) return;
  if (answer.destroy) return request.socket.destroy();
  response.writeHead(answer.status ?? 200, { "content-type": "application/json" }).end(answer.body ?? "");
});
stub.on("connection", (socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});
await new Promise((resolve) => stub.listen(stubPort, "127.0.0.1", resolve));

const TIME = /\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?(\.\d+)?(Z|[+-]\d\d:\d\d)/g;
/** Times differ between the two runs; their shape must not. */
const maskTimes = (text) => text.replace(TIME, (time) => time.replace(/\d/g, "d"));

function rows() {
  return maskTimes(psql(`
    select 'health', connector_key, status, last_checked_at > now() - interval '10 minutes',
           last_success_at is not distinct from last_checked_at, consecutive_failures, latency_ms,
           cursor_state::text, coalesce(last_error, '-'),
           (cursor_state->>'attempted_at')::timestamptz = last_checked_at
      from public.connector_health order by connector_key;
    select 'signals', count(*) from public.external_signals;
    select 'job_runs', ok, detail::text, finished_at > now() - interval '10 minutes'
      from public.job_runs where job_name = 'compute_trend_scores' order by started_at;
    select 'memes', count(*), md5(string_agg(id || ':' || trend_score || ':' || lifecycle_status, ',' order by id))
      from public.memes;`));
}

/** The connector rows each run starts from. */
const PREVIOUS = `
  insert into public.connector_health (connector_key, status, last_checked_at, last_success_at,
    consecutive_failures, cursor_state, last_error)
  values ('threads', 'healthy', '2026-11-23T01:02:03.456789Z', '2026-11-23T01:02:03.456789Z', 2,
          '{"cursor":"c-1","quota_remaining":5.5,"quota_reset_at":"later","backoff_until":7}', null),
         ('instagram', 'down', '2026-11-23T01:00:00Z', null, 4, '{"cursor":3}', 'old');`;

function reset(previous) {
  psql(`delete from public.connector_health; delete from public.external_signals;
        delete from public.job_runs where job_name = 'compute_trend_scores'; ${previous ? PREVIOUS : ""}`);
}

/** The same run through each server: answer, provider requests, rows. */
async function same(label, answers, { previous = false, expect } = {}) {
  script = answers;
  const seen = {};
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    reset(previous);
    records = [];
    const response = await send(base, { path: PATH, headers: bearer });
    await sleep(200); // Next expires its cache after it answers
    seen[name] = {
      answer: `${response.status} ${response.headers["content-type"]} ${response.headers["cache-control"]}\n${response.body}`,
      requests: [...records].sort().join("\n"),
      rows: rows(),
    };
  }
  const brief = seen.next.answer.split("\n")[1].slice(0, 150);
  expectEqual(`${label}: answer`, seen.axum.answer, seen.next.answer, brief);
  expectEqual(`${label}: provider requests`, seen.axum.requests, seen.next.requests, `${records.length} requests`);
  expectEqual(`${label}: rows`, seen.axum.rows, seen.next.rows);
  if (expect && !(expect.includes("SIGNAL") && noX) && !seen.next.answer.includes(expect)) fail(`${label}: expected ${expect}`, seen.next.answer);
  return seen.next;
}

/** Replaces a function's body for one call of `body`, then restores it. */
async function withFunction(name, replacement, body) {
  const original = psql(`select pg_get_functiondef('public.${name}'::regproc)`);
  psql(replacement);
  try {
    return await body();
  } finally {
    psql(original);
  }
}

const raising = (name, message) => `create or replace function public.${name}() returns ${name === "compute_trend_scores" ? "void" : "integer"}
  language plpgsql security definer set search_path to 'pg_catalog' as $$ begin raise exception ${sqlText(message)}; end $$;`;
const returning = (name, value) => `create or replace function public.${name}() returns integer
  language sql security definer set search_path to 'pg_catalog' as $$ select ${value} $$;`;

async function plain() {
  const bad = [undefined, "Bearer wrong", `bearer ${cronSecret}`, `Bearer ${cronSecret}x`, cronSecret];
  for (const value of bad) {
    await compare(`authorization ${JSON.stringify(value ?? null)}`, { path: PATH, headers: value ? { authorization: value } : {} }, { status: 401 });
  }
  for (const method of ["POST", "PUT", "DELETE", "OPTIONS"]) {
    await compare(`${method} is not handled`, { method, path: PATH, headers: bearer });
  }
  script = () => ({ status: 500 });
  await same("no radar settings", () => ({ status: 500 }), { expect: '"status":"ok"' });
  reset(false);
  const head = { next: await send(nextBase, { method: "HEAD", path: PATH, headers: bearer }), axum: await send(axumBase, { method: "HEAD", path: PATH, headers: bearer }) };
  expectEqual("HEAD with the bearer", `${head.axum.status} ${head.axum.body.length}`, `${head.next.status} ${head.next.body.length}`);
  await withFunction("fan_out_trend_alerts", returning("fan_out_trend_alerts", 7), () =>
    withFunction("fan_out_saved_context_alerts", returning("fan_out_saved_context_alerts", "null::integer"), () =>
      same("alerts 7, saved-context null", () => ({}), { expect: '"alerts":7,"savedContextAlerts":0' })));
  await withFunction("compute_trend_scores", raising("compute_trend_scores", "r8 compute \"boom\"\n"), () =>
    same("compute raises", () => ({}), { expect: '"error":"compute:r8 compute' }));
  psql("alter function public.compute_trend_scores() rename to compute_trend_scores_r8_off");
  try {
    await same("compute missing", () => ({}), { expect: "compute:function not found" });
  } finally {
    psql("alter function public.compute_trend_scores_r8_off() rename to compute_trend_scores");
  }
  await withFunction("fan_out_trend_alerts", raising("fan_out_trend_alerts", "r8 fanout"), () =>
    same("fan-out raises", () => ({}), { expect: "fanout:r8 fanout" }));
  await withFunction("fan_out_trend_alerts", returning("fan_out_trend_alerts", 3), () =>
    withFunction("fan_out_saved_context_alerts", raising("fan_out_saved_context_alerts", "r8 saved"), () =>
      same("saved-context raises", () => ({}), { expect: '"alerts":3,"savedContextAlerts":0,"error":"saved_context:r8 saved"' })));
}

const json = (value) => ({ status: 200, body: JSON.stringify(value) });
const X = "/api.x.com/2/tweets/search/recent";
const THREADS = "/graph.threads.com/v1.0/keyword_search";
const isSearch = (url) => url.pathname.endsWith("/ig_hashtag_search");
const isMedia = (url) => url.pathname.endsWith("/recent_media");
/** Answers by provider: `x`, `threads(url)`, `search(url)`, `media(url)`. */
const providers = ({ x = json({ data: [] }), threads = () => json({ data: [] }), search = () => json({ data: [] }), media = () => json({ data: [] }) }) =>
  (url) => {
    if (url.pathname === X) return typeof x === "function" ? x(url) : x;
    if (url.pathname === THREADS) return threads(url);
    if (isSearch(url)) return search(url);
    if (isMedia(url)) return media(url);
    return { status: 404 };
  };
const post = (fields) => ({ id: "1", text: "밈 #짤", created_at: "2026-11-24T05:00:00.000Z", lang: "ko", ...fields });
const thread = (fields) => ({ id: "t1", text: "글 #밈", media_type: "TEXT_POST", permalink: "https://www.threads.com/@a/post/1", timestamp: "2026-11-24T05:00:00+0000", ...fields });
const item = (fields) => ({ id: "m1", caption: "사진 #tag1", media_type: "IMAGE", permalink: "https://www.instagram.com/p/1/", timestamp: "2026-11-24T05:00:00+0000", like_count: 3, comments_count: 1, ...fields });

async function radar() {
  await same("every provider answers nothing", providers({ x: json({ meta: { newest_id: "42" } }) }));
  await same("previous state, every provider answers nothing", providers({}), { previous: true });
  await same("X returns a post: the signal insert fails", providers({ x: json({ data: [post()] }) }), { expect: "RADAR_SIGNAL_WRITE_FAILED" });
  await same("Threads returns a post", providers({ threads: () => json({ data: [thread()] }) }), { expect: "RADAR_SIGNAL_WRITE_FAILED" });
  await same("Instagram returns media", providers({ search: () => json({ data: [{ id: "17841" }] }), media: () => json({ data: [item({ permalink: null }), item()] }) }), { expect: "RADAR_SIGNAL_WRITE_FAILED" });
  await same("Instagram media without permalink or time only", providers({ search: () => json({ data: [{ id: 17841 }] }), media: () => json({ data: [item({ permalink: "" }), item({ timestamp: 0 })] }) }));
  await same("Instagram search without an id", providers({ search: () => json({ data: [{ name: "x" }] }) }));
  await same("Instagram search data is an object", providers({ search: () => json({ data: { 0: { id: "9" } } }), media: () => json({}) }));
  await same("every provider fails", providers({ x: { status: 401 }, threads: () => ({ status: 500 }), search: () => ({ status: 404 }) }), { previous: true });
  await same("one Threads term fails, the other answers", providers({ threads: (url) => (url.searchParams.get("q") === "a" ? { status: 500 } : json({ data: [] })) }), { previous: true });
  await same("Instagram media fails after its search", providers({ search: () => json({ data: [{ id: "5" }] }), media: () => ({ status: 403 }) }), { previous: true });
  await same("Instagram refuses the connection", providers({ search: () => ({ destroy: true }) }), { previous: true });
  await same("X post time is not a date", providers({ x: json({ data: [post({ created_at: "yesterday" })] }) }));
  await same("X post time is null", providers({ x: json({ data: [post({ created_at: null })] }) }));
  await same("X post time is missing", providers({ x: json({ data: [post({ created_at: undefined })] }) }), { expect: "RADAR_SIGNAL_WRITE_FAILED" });
  await same("X post time with +0000 and a number", providers({ x: json({ data: [post({ created_at: "2026-11-24T05:00:00+0000" }), post({ id: "2", created_at: 1764000000000 })] }) }), { expect: "RADAR_SIGNAL_WRITE_FAILED" });
  await same("X post null", providers({ x: json({ data: [null] }) }));
  await same("X post text is a number", providers({ x: json({ data: [post({ text: 5 })] }) }));
  await same("X body null", providers({ x: json(null) }));
  await same("X data is a string", providers({ x: json({ data: "x" }) }));
  await same("X answers an empty 200", providers({ x: { status: 200, body: "" } }));
  await same("Threads: a null post after a bad text", providers({ threads: () => json({ data: [thread({ text: 5 }), null] }) }), { previous: true });
  await same("Threads post text is a number", providers({ threads: () => json({ data: [thread({ text: 5 })] }) }), { previous: true });
  await same("Instagram caption is an object", providers({ search: () => json({ data: [{ id: "5" }] }), media: () => json({ data: [item({ caption: {} })] }) }), { previous: true });
  await same("Threads data is a number", providers({ threads: () => json({ data: 5 }) }), { previous: true });
  await same("Instagram media data is a string", providers({ search: () => json({ data: [{ id: "5" }] }), media: () => json({ data: "x" }) }), { previous: true });
  await same("Threads post time is true", providers({ threads: () => json({ data: [thread({ timestamp: true })] }) }), { previous: true });
}

/** Differences that remain (PLAN.md section 5): shown, not counted. */
async function known() {
  for (const [label, answers] of [
    ["Threads answers HTML with 200", providers({ threads: () => ({ status: 200, body: "<html>" }) })],
    ["Threads hangs past the 30 s connector limit", providers({ threads: () => ({ hang: true }) })],
  ]) {
    script = answers;
    for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
      reset(false);
      const response = await send(base, { path: PATH, headers: bearer });
      const error = psql("select coalesce(last_error, '-') from public.connector_health where connector_key = 'threads'");
      console.log(`      ${label}, ${name}: ${response.status}, threads last_error ${JSON.stringify(error)}`);
    }
    for (const socket of sockets) socket.destroy();
  }
}

// Next's Data Cache, read by a page Next renders: /memes/<key> reads its meme
// under PUBLIC_CATALOG_CACHE_TAG. A title changed in the database stays hidden
// until the tag expires; the trend pulse must expire it through either server,
// and must not when compute_trend_scores fails.
async function cache() {
  const key = psql("select short_id || '-' || slug from public.memes where slug = 'parity-0' and moderation_status = 'approved'");
  if (!key) return fail("cache", "seed first: node server/parity/seed-memes.mjs pool 3 | psql");
  const original = psql("select title from public.memes where slug = 'parity-0'");
  const shownTitle = async () => {
    const response = await send(nextBase, { path: `/memes/${key}` });
    return /<title>([^<|]*)/.exec(response.body.toString("utf8"))?.[1]?.trim() ?? `(status ${response.status})`;
  };
  const setTitle = (title) => psql(`update public.memes set title = ${sqlText(title)} where slug = 'parity-0'`);
  script = () => ({ status: 500 });
  try {
    await shownTitle();
    for (const [index, [label, base]] of [["Axum", axumBase], ["Next", nextBase]].entries()) {
      const before = await shownTitle();
      const changed = `${original} r8-${index}`;
      setTitle(changed);
      const stale = await shownTitle();
      const answer = await send(base, { path: PATH, headers: bearer });
      await sleep(500);
      const after = await shownTitle();
      const note = `${JSON.stringify(stale)} -> ${answer.status} -> ${JSON.stringify(after)}`;
      if (stale === before && answer.status === 200 && after.startsWith(changed)) pass(`${label} trend pulse: the page shows the new title`, note);
      else fail(`${label} trend pulse: the page shows the new title`, note);
    }
    psql("alter function public.compute_trend_scores() rename to compute_trend_scores_r8_off");
    try {
      for (const [label, base] of [["Axum", axumBase], ["Next", nextBase]]) {
        const before = await shownTitle();
        setTitle(`${original} r8-failed-${label}`);
        const answer = await send(base, { path: PATH, headers: bearer });
        await sleep(500);
        const after = await shownTitle();
        const note = `${answer.status} -> ${JSON.stringify(after)}`;
        if (answer.status === 502 && after === before) pass(`${label} trend pulse with compute failing: the cached title stays`, note);
        else fail(`${label} trend pulse with compute failing: the cached title stays`, note);
      }
    } finally {
      psql("alter function public.compute_trend_scores_r8_off() rename to compute_trend_scores");
    }
  } finally {
    setTitle(original);
    await send(axumBase, { method: "POST", path: "/api/cron/source-refresh", headers: bearer });
  }
}

try {
  await run({ plain, radar, "radar-no-x": () => { noX = true; return radar(); }, known, cache });
} finally {
  for (const socket of sockets) socket.destroy();
  stub.close();
}
