#!/usr/bin/env node
// POST /api/memes/view and POST /api/analytics/events, Next against Axum on
// one database: every status, the limits, and the rows each request leaves.
// See README.md in this directory.
//
//   PARITY_USER="$(cat user1.json)" \
//     node server/parity/tracking.mjs <next-base-url> <axum-base-url> [view] [events]
//
// PARITY_USER is one line printed by server/tests/better_auth_cookie.mjs.
// TEST_DB_CONTAINER names the database container. Both servers must run with
// the same MEMECATCH_SIGNING_SECRET. Throwaway database only.
//
// Each run uses fresh client addresses (X-Forwarded-For). The requests that
// carry no such header share one bucket per server: leave a minute between
// two runs, or their limits carry over.
import { axumBase, compare, compareOnce, describe, expectEqual, fail, nextBase, pass, psql, run, send, sqlText } from "./harness.mjs";

const user = JSON.parse(process.env.PARITY_USER ?? "null");
if (!user?.cookie) {
  console.error("PARITY_USER must hold the output of server/tests/better_auth_cookie.mjs");
  process.exit(2);
}
const SITE = new URL(nextBase).origin; // NEXT_PUBLIC_SITE_URL of the Next build
const NEXT_OWN = `http://localhost:${new URL(nextBase).port}`; // what Next takes for its own origin
const runId = Date.now() % 250;
const ip = (n) => `198.51.${runId}.${n}`;
const MEMES = [1, 2, 3].map((n) => `00000000-0000-4000-9000-${String(n).padStart(12, "0")}`);
const UNKNOWN_MEME = "00000000-0000-4000-9000-999999999999";
const maskRetry = (text) => text.replace(/^(59|60)$/, "<about a minute>");

function seedMemes() {
  const rows = MEMES.map((id, index) => `(${sqlText(id)}, 'pv00000${index + 1}', 'parity-view-${index + 1}', '조회 밈 ${index + 1}', 'approved'::moderation_status)`);
  psql(`begin;
delete from public.memes where slug like 'parity-view-%';
insert into public.memes (id, short_id, slug, title, moderation_status) values ${rows.join(", ")};
commit;`);
}

/** Waits for the next minute when this one is nearly over: the durable limits and the dedupe key are per minute. */
async function awayFromMinuteEnd(secondsNeeded) {
  const left = 60 - (Date.now() / 1000) % 60;
  if (left < secondsNeeded) await new Promise((resolve) => setTimeout(resolve, (left + 1) * 1000));
}

const view = (body, headers = {}) => ({ method: "POST", path: "/api/memes/view", headers: { "content-type": "application/json", ...headers }, body });
const viewOf = (meme, headers) => view(JSON.stringify({ memeId: meme }), headers);
const viewRows = (meme) => Number(psql(`select count(*) from public.view_events where meme_id = ${sqlText(meme)}`));

/** Asks a server (Next unless told otherwise) for a new analytics session and returns its cookie. */
async function newSession(address, base = nextBase) {
  const response = await send(base, event({ eventName: "quiz_start" }, { "x-forwarded-for": address }));
  const cookie = response.headers["set-cookie"]?.[0]?.split(";")[0];
  if (response.status !== 202 || !cookie) throw new Error(`${base} gave no session: ${describe(response)}`);
  return cookie;
}

async function views() {
  seedMemes();
  const [meme, second] = MEMES;
  const pad = (bytes) => { const base = JSON.stringify({ memeId: meme, p: "" }); return JSON.stringify({ memeId: meme, p: "x".repeat(bytes - base.length) }); };
  const BOM = Buffer.from([0xef, 0xbb, 0xbf]);
  for (const [label, request, status] of [
    ["view from another origin", viewOf(meme, { origin: "https://evil.example", "x-forwarded-for": ip(1) }), 403],
    ["view, body is not JSON", view("{", { "x-forwarded-for": ip(1) }), 400],
    ["view, empty body", view("", { "x-forwarded-for": ip(1) }), 400],
    ["view, body is an array", view(`["${meme}"]`, { "x-forwarded-for": ip(1) }), 400],
    ["view, body is null", view("null", { "x-forwarded-for": ip(1) }), 400],
    ["view, meme id is a number", view('{"memeId":1}', { "x-forwarded-for": ip(1) }), 400],
    ["view, meme id is not a UUID", view('{"memeId":"nope"}', { "x-forwarded-for": ip(1) }), 400],
    ["view, repeated key, last one invalid", view(`{"memeId":"${meme}","memeId":null}`, { "x-forwarded-for": ip(1) }), 400],
    ["view, 129 bytes, declared", view(pad(129), { "x-forwarded-for": ip(1) }), 413],
    ["view, 129 bytes, chunked", { ...view(pad(129), { "x-forwarded-for": ip(1) }), chunked: true }, 413],
    ["view, 10 kB, chunked", { ...view(pad(10_000), { "x-forwarded-for": ip(1) }), chunked: true }, 413],
    ["view, 129 bytes after a byte order mark, chunked", { ...view(Buffer.concat([BOM, Buffer.from(pad(129))]), { "x-forwarded-for": ip(1) }), chunked: true }, 413],
    // The mark is dropped before the text is measured, but not before the declared length is.
    ["view, 128 bytes after a byte order mark, declared as 131", view(Buffer.concat([BOM, Buffer.from(pad(128))]), { "x-forwarded-for": ip(1) }), 413],
    ["view, 62 bytes that decode to more than 128", view(Buffer.concat([Buffer.from('{"p":"'), Buffer.alloc(54, 0xff), Buffer.from('"}')]), { "x-forwarded-for": ip(1) }), 413],
    ["view of a meme that does not exist", viewOf(UNKNOWN_MEME, { "x-forwarded-for": ip(1) }), 503],
  ]) {
    await compare(label, request, { status });
  }
  expectEqual("no view was recorded by a refused request", viewRows(meme), 0);

  // A view is counted once per viewer and day. Sent to both servers, each of
  // these must add exactly one row: two rows would mean two different keys.
  const session = await newSession(ip(9));
  const before = () => viewRows(meme);
  let expected = 0;
  const once = async (label, request, adds, order = "next-first") => {
    await compareOnce(label, request, { status: 202, order });
    expected += adds;
    expectEqual(`  rows for the meme after: ${label}`, before(), expected);
  };
  await once("view by an address, Next first", viewOf(meme, { "x-forwarded-for": ip(2) }), 1);
  await once("view by another address, Axum first", viewOf(meme, { "x-forwarded-for": ip(3) }), 1, "axum-first");
  await once("same address behind a proxy hop", viewOf(meme, { "x-forwarded-for": `${ip(2)}, 10.0.0.1` }), 0);
  await once("from the site origin, 128 bytes", view(pad(128), { origin: SITE, "x-forwarded-for": ip(4) }), 1);
  await once("from Next's own origin", viewOf(meme, { origin: NEXT_OWN, "x-forwarded-for": ip(4) }), 0);
  await once("128 bytes after a byte order mark, chunked", { ...view(Buffer.concat([BOM, Buffer.from(pad(128))]), { "x-forwarded-for": ip(4) }), chunked: true }, 0);
  await once("meme id in capitals", viewOf(meme.toUpperCase(), { "x-forwarded-for": ip(4) }), 0);
  await once("forwarded value that is not an address", viewOf(meme, { "x-forwarded-for": `not-an-address-${runId}` }), 1);
  await once("forwarded value with a Latin-1 byte", viewOf(meme, { "x-forwarded-for": `caf\u00e9-${runId}` }), 1);
  await once("empty first entry, X-Real-IP", viewOf(meme, { "x-forwarded-for": ` , ${ip(5)}`, "x-real-ip": ip(6) }), 1);
  await once("that X-Real-IP address as the forwarded client", viewOf(meme, { "x-forwarded-for": ip(6) }), 0);
  await once("no forwarded header: the peer address", viewOf(meme), 1);
  await once("the peer address 127.0.0.1 spelled out", viewOf(meme, { "x-forwarded-for": "127.0.0.1" }), 0);
  await once("with an analytics session", viewOf(meme, { cookie: session, "x-forwarded-for": ip(7) }), 1);
  await once("same session from another address", viewOf(meme, { cookie: session, "x-forwarded-for": ip(8) }), 0);
  await once("session cookie among others", viewOf(meme, { cookie: `a=1; ${session}; b=2`, "x-forwarded-for": ip(2) }), 0);
  await once("forged session cookie: the address counts", viewOf(meme, { cookie: `${session}x`, "x-forwarded-for": ip(7) }), 1);
  await once("another meme, same viewer", viewOf(second, { "x-forwarded-for": ip(2) }), 0);
  expectEqual("the other meme has its one row", viewRows(second), 1);

  // 120 a minute for one address; a refused request records nothing.
  const flood = view("{}", { "x-forwarded-for": ip(20) });
  for (let i = 1; i <= 120; i += 1) {
    const [next, axum] = [await send(nextBase, flood), await send(axumBase, flood)];
    if (next.status !== 400 || describe(next) !== describe(axum)) return fail(`view ${i} of 120 from one address`, `${describe(next)}\n--\n${describe(axum)}`);
  }
  pass("120 views from one address", "all answered alike, none limited");
  await compareOnce("view 121 from that address", viewOf(meme, { "x-forwarded-for": ip(20) }), { status: 429, mask: maskRetry });
  await compareOnce("the same address behind a proxy hop", viewOf(meme, { "x-forwarded-for": `${ip(20)}, 10.0.0.1` }), { status: 429, mask: maskRetry });
  await compareOnce("another address at the same time", viewOf(meme, { "x-forwarded-for": ip(2) }), { status: 202 });
  expectEqual("the limited views recorded nothing", before(), expected);
  for (const method of ["GET", "HEAD", "OPTIONS", "PUT"]) await compare(`${method} /api/memes/view (Next's own answer)`, { method, path: "/api/memes/view" });
  await compare("POST /api/memes/{id}/view stays with Next", { method: "POST", path: `/api/memes/${meme}/view`, headers: { origin: NEXT_OWN, "x-forwarded-for": ip(30) } }, { status: 400 });
}

function event(payload, headers = {}) {
  const body = typeof payload === "string" || Buffer.isBuffer(payload) ? payload : JSON.stringify(payload);
  return { method: "POST", path: "/api/analytics/events", headers: { origin: SITE, "content-type": "application/json", ...headers }, body };
}
const eventRows = (cookie) => {
  const session = cookie.split("=")[1].split(".")[0];
  return psql(`select event_name, source, coalesce(user_id::text, '-'), coalesce(meme_id::text, '-'), coalesce(surface, '-'), coalesce(format, '-'), coalesce(locale, '-'), coalesce(path, '-'),
    regexp_replace(replace(dedupe_key, session_id::text, '<session>'), ':[0-9]+$', ':<minute>'), metadata::text, occurred_at > now() - interval '5 minutes'
    from public.growth_events where session_id = ${sqlText(session)} order by created_at, id`);
};
const maskSession = (text) => text.replace(/mc_growth_session=[0-9a-f-]{36}\.[A-Za-z0-9_-]{43}/, "mc_growth_session=<token>");

async function events() {
  seedMemes();
  await awayFromMinuteEnd(40);
  const from = (n) => ({ "x-forwarded-for": ip(n) });
  const big = JSON.stringify({ eventName: "copy", pad: "p".repeat(16 * 1024) });
  for (const [label, request, status] of [
    ["event without Origin", { ...event({ eventName: "copy" }, from(40)), headers: { "x-forwarded-for": ip(40) } }, 403],
    ["event from another origin", event({ eventName: "copy" }, { origin: "https://evil.example", ...from(40) }), 403],
    ["event, body is not JSON", event("{", from(40)), 400],
    ["event, empty body", event("", from(40)), 400],
    ["event, body is null", event("null", from(40)), 400],
    ["event, body is an array", event('[{"eventName":"copy"}]', from(40)), 400],
    ["event, body is a string", event('"copy"', from(40)), 400],
    ["event without a name", event({}, from(40)), 400],
    ["event, name is a number", event({ eventName: 1 }, from(40)), 400],
    ["event, name is not a client event", event({ eventName: "payment_confirmed" }, from(40)), 400],
    ["event, meme id is not a UUID", event({ eventName: "copy", params: { meme_id: "nope" } }, from(40)), 400],
    ["event, body over 16 KiB, declared", event(big, from(40)), 413],
    ["event, body over 16 KiB, chunked", { ...event(big, from(40)), chunked: true }, 413],
    // Postgres refuses these two, the function call fails, and the route throws.
    ["event whose metadata is cut through a surrogate pair", event({ eventName: "copy", params: { result: `${"x".repeat(99)}😀` } }, from(40)), 500],
    ["event with a NUL character", event({ eventName: "copy", params: { surface: "a\u0000b" } }, from(40)), 500],
    ["event for a meme that does not exist", event({ eventName: "copy", params: { meme_id: UNKNOWN_MEME } }, from(40)), 500],
  ]) {
    await compare(label, request, { status });
  }

  // A request without a session starts one. Each server must accept the
  // other's cookie: a second request with it sets none.
  const fresh = await compareOnce("event without a session cookie", event({ eventName: "copy", path: "/fresh" }, from(41)), { status: 202, mask: maskSession });
  await compareOnce("event without a session cookie over HTTPS", event({ eventName: "copy", path: "/fresh" }, { "x-forwarded-proto": "https", ...from(41) }), { status: 202, mask: maskSession });
  const issued = (response) => response.headers["set-cookie"]?.[0]?.split(";")[0];
  const [fromNext, fromAxum] = [issued(fresh.next), issued(fresh.axum)];
  if (fromNext && fromAxum) {
    await compare("the session Axum issued is accepted by both", event({ eventName: "copy", path: "/again" }, { cookie: fromAxum, ...from(41) }), { status: 202 });
    await compare("the session Next issued is accepted by both", event({ eventName: "copy", path: "/again" }, { cookie: fromNext, ...from(41) }), { status: 202 });
  } else fail("both servers issue a session cookie", `next: ${fromNext}\naxum: ${fromAxum}`);
  await compareOnce("event with a forged session cookie starts a new one", event({ eventName: "copy" }, { cookie: `${fromNext}x`, ...from(41) }), { status: 202, mask: maskSession });
  await compare("event from Next's own origin", event({ eventName: "copy", path: "/own" }, { origin: NEXT_OWN, cookie: fromNext, ...from(41) }), { status: 202 });

  // The same events through each server under two sessions: the rows must
  // be equal but for the session.
  const [forNext, forAxum] = [await newSession(ip(42)), await newSession(ip(42))];
  const long = "가".repeat(400);
  const payloads = [
    { eventName: "meme_view", path: "  /memes/x  ", params: { meme_id: ` ${MEMES[0]} `, surface: " detail ", format: "\tcard\n", locale: "ko-KR-x-very-long", ignored: 1 } },
    { eventName: "share_click", path: long, params: { surface: long, format: long, locale: long, channel: long, method: "  ", to: "kakao" } },
    { eventName: "copy", path: `${"p".repeat(299)}😀`, params: { surface: `${"s".repeat(79)}😀`, format: `${"f".repeat(79)}😀` } },
    { eventName: "plus_weekly_brief_clicked", params: { brief_id: " brief-1 ", position: 3, format: "f", surface: "s" } },
    { eventName: "plus_weekly_brief_opened", params: { brief_id: "brief-1", position: "3" } },
    { eventName: "plus_weekly_brief_clicked", params: { brief_id: "brief-2", position: 1.5 } },
    { eventName: "plus_weekly_brief_clicked", params: { brief_id: "brief-3", position: 1e21 } },
    { eventName: "follow_click", params: { format: "only-format" } },
    { eventName: "paywall_view", params: { surface: "only-surface" } },
    { eventName: "quiz_start", path: "/only-path" },
    // Each event needs a name or an identity of its own: a second event with
    // the same dedupe key in the same minute writes no row.
    { eventName: "quiz_complete" },
    { eventName: "follow_click", path: "/array-params", params: [1, 2] },
    { eventName: "paywall_view", path: ["/x"], params: "text" },
    { eventName: "traffic_source", params: { score: 7, unknown: "x", result: " win ", state: "", mode: true, to: null, source: ["a"], method: { a: 1 }, channel: "  ", medium: 0.5, is_returning: 0 } },
    { eventName: "traffic_source", path: "/thirteen", params: { result: 1, state: 2, channel: 3, brief_id: "b", item_count: 5, position: 6, source: 7, method: 8, to: 9, mode: 10, score: 11, medium: 12, resolved_by: 13, in_app_browser: 14 } },
    { eventName: "copy", path: `${"k".repeat(170)}😀-key-cut-through-a-pair` },
  ];
  const texts = [
    '{"eventName":"traffic_source","path":"/numbers","params":{"score":-0,"item_count":1e21,"position":0.30000000000000004,"medium":18446744073709551615,"source":1.5e-7,"method":123456789012345680000,"score":-0}}',
    '{"eventName":"copy","params":{"result":"a\\"b\\\\c\\n\\u0001\\u007f","state":"\\u2028 é 밈 😀","result":"last wins"},"path":"/dup","path":"/dup2"}',
  ];
  for (const payload of [...payloads, ...texts]) {
    const name = typeof payload === "string" ? payload.slice(0, 60) : `${payload.eventName} ${JSON.stringify(payload.params ?? payload.path ?? "").slice(0, 50)}`;
    await compareOnce(`event: ${name}`, event(payload, { cookie: forNext, ...from(43) }), { status: 202, requestForAxum: event(payload, { cookie: forAxum, ...from(43) }) });
  }
  const signedIn = (cookie) => event({ eventName: "copy", path: "/signed-in" }, { cookie: `${cookie}; ${user.cookie}`, ...from(43) });
  await compareOnce("event by a signed-in user", signedIn(forNext), { status: 202, requestForAxum: signedIn(forAxum) });
  const [rowsNext, rowsAxum] = [eventRows(forNext), eventRows(forAxum)];
  expectEqual("the rows Axum wrote equal the rows Next wrote", rowsAxum, rowsNext, `${rowsNext.split("\n").length} rows each`);
  // The session's first event, then one row per event above.
  expectEqual("every event above left a row", rowsNext.split("\n").length, payloads.length + texts.length + 2);
  if (!rowsNext.includes(user.userId)) fail("the signed-in event carries the user", rowsNext);
  console.log(rowsNext.replace(/^/gm, "        ").slice(0, 6000));

  // One event sent to both servers in the same minute is one row: both
  // derive the same dedupe key.
  await awayFromMinuteEnd(10);
  const shared = await newSession(ip(44));
  const repeated = { eventName: "share_click", path: "/dedupe", params: { surface: "s", channel: "kakao" } };
  await compareOnce("the same event through Next then Axum", event(repeated, { cookie: shared, ...from(44) }), { status: 202 });
  await compareOnce("another event through Axum then Next", event({ ...repeated, path: "/dedupe-2", params: {} }, { cookie: shared, ...from(44) }), { status: 202, order: "axum-first" });
  expectEqual("two events sent twice each left two rows (and the session's first)", eventRows(shared).split("\n").length, 3);

  // The database keeps a keyed hash of the client address, not the address.
  // One event through each server from one address must land in one bucket.
  const networkBuckets = () => psql("select bucket_key || ' ' || event_count from public.growth_client_rate_limits where scope = 'network'").split("\n");
  await awayFromMinuteEnd(5);
  const known = new Set(networkBuckets());
  await compareOnce("an event through each server from one new address", event({ eventName: "copy", path: "/network" }, { cookie: forNext, ...from(45) }), { status: 202, requestForAxum: event({ eventName: "copy", path: "/network" }, { cookie: forAxum, ...from(45) }) });
  const added = networkBuckets().filter((bucket) => !known.has(bucket));
  expectEqual("both servers counted that address under one network hash", added.map((bucket) => bucket.replace(/^[0-9a-f]{64}/, "<hash>")).join(), "<hash> 2");

  await limits();
  for (const method of ["GET", "HEAD", "OPTIONS", "PUT"]) await compare(`${method} /api/analytics/events (Next's own answer)`, { method, path: "/api/analytics/events" });
}

async function limits() {
  // 120 a minute for one address, counted before the body is read.
  const flood = event("{", { "x-forwarded-for": ip(50) });
  for (let i = 1; i <= 120; i += 1) {
    const [next, axum] = [await send(nextBase, flood), await send(axumBase, flood)];
    if (next.status !== 400 || describe(next) !== describe(axum)) return fail(`event ${i} of 120 from one address`, `${describe(next)}\n--\n${describe(axum)}`);
  }
  pass("120 events from one address", "all answered alike, none limited");
  await compareOnce("event 121 from that address", event({ eventName: "copy" }, { "x-forwarded-for": ip(50) }), { status: 429, mask: maskRetry });

  // 60 a minute for one session, in the server and again in the database.
  // The database's count is shared, so after 60 through one server the other
  // one is refused by the database (retry-after: 60) on its first try.
  await awayFromMinuteEnd(30);
  for (const [first, firstBase, other, otherBase, address] of [["Next", nextBase, "Axum", axumBase, 51], ["Axum", axumBase, "Next", nextBase, 52]]) {
    const session = await newSession(ip(address + 10), firstBase);
    const one = (i) => event({ eventName: "copy", path: `/limit-${i}` }, { cookie: session, "x-forwarded-for": ip(address) });
    for (let i = 1; i <= 59; i += 1) {
      const response = await send(firstBase, one(i));
      if (response.status !== 202) return fail(`event ${i} of a session through ${first}`, describe(response));
    }
    pass(`60 events of one session through ${first}`, "the session's first and 59 more, all 202");
    const inServer = await send(firstBase, one(60));
    const inDatabase = await send(otherBase, one(61));
    expectEqual(`event 61 of that session through ${first}: refused by the server's own count`, describe(inServer, maskRetry).split("\n").filter((line) => /^(status|body|header retry-after)/.test(line)).join(" | "), 'body: {"ok":false,"error":"rate_limited"} | header retry-after: <about a minute> | status: 429');
    expectEqual(`the same session through ${other}: refused by the database`, describe(inDatabase).split("\n").filter((line) => /^(status|body|header retry-after)/.test(line)).join(" | "), 'body: {"ok":false,"error":"rate_limited"} | header retry-after: 60 | status: 429');
  }
}

await run({ view: views, events });
