#!/usr/bin/env node
// GET /api/auth/get-session and POST /api/auth/sign-out, Next (better-auth)
// against Axum on one database. Every case of both endpoints: the answer
// (status, headers, Set-Cookie lines in order, body) and, for the ones that
// write, the session row each leaves. See README.md in this directory.
//
//   DATABASE_URL=<test db> BETTER_AUTH_SECRET=<the servers'> NODE_ENV=<the servers'> \
//     node server/parity/auth-session.mjs <next> <axum> [section...]
//
// A writing case puts one session in the same state before each server's
// turn and restores it after, so both see the same row; times the call
// writes are compared as minutes from the call. Throwaway database only.
import { spawnSync } from "node:child_process";
import { createHmac } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { axumBase, compare as compareAnswers, describe, expectEqual, fail, nextBase, pass, psql, run, send, sqlText } from "./harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || !process.env.DATABASE_URL) {
  console.error("DATABASE_URL and BETTER_AUTH_SECRET are required, as the servers have them");
  process.exit(2);
}
const production = process.env.NODE_ENV === "production";
const prefix = production ? "__Secure-" : "";
const NAMES = { token: `${prefix}better-auth.session_token`, data: `${prefix}better-auth.session_data`, remember: `${prefix}better-auth.dont_remember` };
const SITE = new URL(nextBase).origin;
// Under `next dev` (NODE_ENV=development) Next's CSP is the development one;
// Axum's native answers carry the production one it was built for. Not an
// auth difference: the value is not compared then.
const cspMask = (text) => (!production && text.startsWith("default-src ") ? "<csp>" : text);
const compare = (label, request, options = {}) => compareAnswers(label, request, { ...options, mask: cspMask });
const sign = (value) => encodeURIComponent(`${value}.${createHmac("sha256", secret).update(value).digest("base64")}`);

/** A user and session from the app's own better-auth (tests/better_auth_cookie.mjs). */
function mint() {
  const result = spawnSync(process.execPath, ["--import", resolve(root, "scripts/register-ts-paths.mjs"), resolve(root, "server/tests/better_auth_cookie.mjs")],
    { cwd: root, encoding: "utf8", env: process.env });
  if (result.status !== 0) throw new Error(result.stderr.slice(-400));
  const user = JSON.parse(result.stdout.trim().split("\n").pop());
  user.token = decodeURIComponent(user.cookie.slice(user.cookie.indexOf("=") + 1)).split(".")[0];
  return user;
}
const row = (token) => psql(`select coalesce((select row_to_json(s)::text from public.session s where token = ${sqlText(token)}), 'none')`);
function restore(token, saved) {
  psql(`delete from public.session where token = ${sqlText(token)};
        ${saved === "none" ? "" : `insert into public.session select * from json_populate_record(null::public.session, ${sqlText(saved)}::json);`}`);
}
const setExpiry = (token, sql) => psql(`update public.session set "expiresAt" = ${sql} where token = ${sqlText(token)}`);

// ISO times the call wrote (at or after it): minutes from it. Earlier ones,
// such as the session's own creation a moment before, stay as they are.
function maskTimes(text, t0) {
  return text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:?\d\d)/g, (iso) => {
    const at = Date.parse(iso);
    return at >= t0 - 5 ? `<call+${Math.round((at - t0) / 60_000)}min>` : iso;
  });
}
const rowAfter = (token, t0) => maskTimes(row(token), t0);

/** One request through each server from the same starting row. */
async function sameWrite(label, token, prepare, request, { status } = {}) {
  const saved = row(token);
  const seen = {};
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    restore(token, saved);
    prepare?.();
    const t0 = Date.now();
    const response = await send(base, request);
    seen[name] = { answer: describe(response, (text) => cspMask(maskTimes(text, t0))), row: rowAfter(token, t0), status: response.status };
  }
  restore(token, saved);
  if (seen.next.answer !== seen.axum.answer) return fail(`${label}: answer`, `next:\n${seen.next.answer}\naxum:\n${seen.axum.answer}`);
  if (seen.next.row !== seen.axum.row) return fail(`${label}: row`, `next: ${seen.next.row}\naxum: ${seen.axum.row}`);
  if (status !== undefined && seen.next.status !== status) return fail(label, `both answered ${seen.next.status}, expected ${status}`);
  pass(label, `${seen.next.status}; row ${seen.next.row === "none" ? "gone" : "kept"}`);
}

const get = (cookie, headers = {}) => ({ path: "/api/auth/get-session", headers: { ...(cookie ? { cookie } : {}), ...headers } });

async function getSession() {
  const user = mint();
  const other = production ? "better-auth.session_token" : "__Secure-better-auth.session_token";
  const value = user.cookie.slice(user.cookie.indexOf("=") + 1);
  await compare("no cookie", get(null), { status: 200 });
  await compare("tampered signature", get(`${NAMES.token}=${value.slice(0, -8)}AAAAAA%3D`), { status: 200 });
  await compare("signature of another secret", get(`${NAMES.token}=${encodeURIComponent(`${user.token}.${createHmac("sha256", "other").update(user.token).digest("base64")}`)}`), { status: 200 });
  await compare("the cookie under the other name", get(`${other}=${value}`), { status: 200 });
  await compare("valid, not due", get(user.cookie), { status: 200 });
  await compare("valid, with a session_data cookie", get(`${user.cookie}; ${NAMES.data}=abc`), { status: 200 });
  await compare("valid, with session_data chunks", get(`${user.cookie}; ${NAMES.data}.0=abc; ${NAMES.data}.1=def; ${NAMES.data}.01=x`), { status: 200 });
  await compare("session_data only", get(`${NAMES.data}=abc`), { status: 200 });
  await compare("empty session_data only", get(`${NAMES.data}=`), { status: 200 });
  await compare("valid, signed dont_remember", get(`${user.cookie}; ${NAMES.remember}=${sign("true")}`), { status: 200 });
  await compare("valid, unsigned dont_remember", get(`${user.cookie}; ${NAMES.remember}=true`), { status: 200 });
  await compare("the cookie twice, the first one wins", get(`${NAMES.token}=${sign("nosuchtoken000000000000000000001")}; ${user.cookie}`), { status: 200 });
  await sameWrite("unknown token, validly signed", "nosuchtoken000000000000000000002", null, get(`${NAMES.token}=${sign("nosuchtoken000000000000000000002")}; ${NAMES.data}=x; ${NAMES.data}.0=y`), { status: 200 });

  const t = user.token;
  const due = (sql) => () => setExpiry(t, sql);
  await sameWrite("due for refresh: extended", t, due(`now() + interval '6 days' - interval '2 seconds'`), get(user.cookie), { status: 200 });
  await sameWrite("refresh boundary: 2 s before, not due", t, due(`now() + interval '6 days' + interval '2 seconds'`), get(user.cookie), { status: 200 });
  await sameWrite("due, with session_data", t, due(`now() + interval '1 day'`), get(`${user.cookie}; ${NAMES.data}=abc`), { status: 200 });
  await sameWrite("due, signed dont_remember: not extended", t, due(`now() + interval '1 day'`), get(`${user.cookie}; ${NAMES.remember}=${sign("true")}`), { status: 200 });
  await sameWrite("due, unsigned dont_remember: extended", t, due(`now() + interval '1 day'`), get(`${user.cookie}; ${NAMES.remember}=true`), { status: 200 });
  await sameWrite("expired: deleted", t, due(`now() - interval '2 seconds'`), get(user.cookie), { status: 200 });
  await sameWrite("expiry boundary: 2 s left, kept", t, due(`now() + interval '2 seconds'`), get(user.cookie), { status: 200 });
  await sameWrite("expired, with chunks", t, due(`now() - interval '1 hour'`), get(`${user.cookie}; ${NAMES.data}.0=a; ${NAMES.data}.1=b`), { status: 200 });

  // The row disappears between the read and the refresh: an update that
  // matches no row, made by a trigger installed once the row is due.
  psql(`create or replace function public.a1_skip_update() returns trigger language plpgsql as $$ begin return null; end $$;`);
  const skipUpdates = () => {
    psql("drop trigger if exists a1_skip_update on public.session");
    setExpiry(t, `now() + interval '1 day'`);
    psql("create trigger a1_skip_update before update on public.session for each row execute function public.a1_skip_update()");
  };
  try {
    await sameWrite("due, the row gone before the refresh: 401", t, skipUpdates, get(user.cookie), { status: 401 });
  } finally {
    psql("drop trigger if exists a1_skip_update on public.session; drop function public.a1_skip_update();");
  }
  psql("alter table public.session rename to session_a1_off");
  try {
    await compare("database fails: 500", get(`${user.cookie}; ${NAMES.data}=x`), { status: 500 });
  } finally {
    psql("alter table public.session_a1_off rename to session");
  }

  // Left to Next.
  await compare("HEAD", { ...get(user.cookie), method: "HEAD" });
  await compare("POST", { ...get(user.cookie), method: "POST", headers: { cookie: user.cookie, origin: SITE, "content-type": "application/json" }, body: "{}" });
  await compare("query string", { path: "/api/auth/get-session?disableRefresh=true", headers: { cookie: user.cookie } });
  await compare("RSC request", get(user.cookie, { rsc: "1" }));
  await compare("trailing slash", { path: "/api/auth/get-session/", headers: { cookie: user.cookie } });
  await compare("another auth path", { path: "/api/auth/list-sessions", headers: { cookie: user.cookie } });
  await oversizedCookie();
}

/** Node refuses headers over 16 KiB before Next runs; Axum refuses such a Cookie header. Status, connection and body. */
async function oversizedCookie() {
  const cookie = `a=${"x".repeat(17_000)}`;
  for (const [label, request] of [["get-session", get(cookie)], ["sign-out", signOutRequest({ cookie, origin: SITE })]]) {
    const answer = async (base) => {
      const response = await send(base, request);
      return `${response.status} connection=${response.headers.connection} body=${response.body.length} bytes`;
    };
    expectEqual(`${label}: a 17 KB cookie`, await answer(axumBase), await answer(nextBase));
  }
}

const signOutRequest = (headers, body = "{}") => ({ method: "POST", path: "/api/auth/sign-out", headers: { "content-type": "application/json", ...headers }, body });

async function signOut() {
  const user = mint();
  const t = user.token;
  await sameWrite("no cookie", t, null, signOutRequest({}), { status: 200 });
  await sameWrite("cookie, no Origin", t, null, signOutRequest({ cookie: user.cookie }), { status: 403 });
  await sameWrite("cookie, Origin null", t, null, signOutRequest({ cookie: user.cookie, origin: "null" }), { status: 403 });
  await sameWrite("cookie, Origin of another site", t, null, signOutRequest({ cookie: user.cookie, origin: "https://evil.example" }), { status: 403 });
  await sameWrite("cookie, Origin with a path", t, null, signOutRequest({ cookie: user.cookie, origin: `${SITE}/x` }), { status: 200 });
  await sameWrite("cookie, Referer of the site", t, null, signOutRequest({ cookie: user.cookie, referer: `${SITE}/about` }), { status: 200 });
  await sameWrite("cookie, relative Referer", t, null, signOutRequest({ cookie: user.cookie, referer: "/about" }), { status: 403 });
  await sameWrite("site Origin: signed out", t, null, signOutRequest({ cookie: user.cookie, origin: SITE }), { status: 200 });
  await sameWrite("site Origin, with chunks", t, null, signOutRequest({ cookie: `${user.cookie}; ${NAMES.data}.0=a`, origin: SITE }), { status: 200 });
  await sameWrite("tampered cookie: row kept", t, null, signOutRequest({ cookie: `${NAMES.token}=${t}.AAAA`, origin: SITE }), { status: 200 });
  await sameWrite("unknown keys are ignored", t, null, signOutRequest({ cookie: user.cookie, origin: SITE }, '{"x":1}'), { status: 200 });
  await sameWrite("expired session: deleted all the same", t, () => setExpiry(t, "now() - interval '1 day'"), signOutRequest({ cookie: user.cookie, origin: SITE }), { status: 200 });
  // Left to Next.
  for (const [label, request] of [
    ["no content type", { method: "POST", path: "/api/auth/sign-out", headers: { cookie: user.cookie, origin: SITE }, body: "{}" }],
    ["text/plain", signOutRequest({ cookie: user.cookie, origin: SITE, "content-type": "text/plain" })],
    ["empty body", signOutRequest({ cookie: user.cookie, origin: SITE }, "")],
    ["body null", signOutRequest({ cookie: user.cookie, origin: SITE }, "null")],
    ["body []", signOutRequest({ cookie: user.cookie, origin: SITE }, "[]")],
    ["callbackURL", signOutRequest({ cookie: user.cookie, origin: SITE }, '{"callbackURL":"https://evil.example"}')],
    // The origin check also reads the query's callbackURL and these body keys.
    ["query callbackURL of another site", { ...signOutRequest({ cookie: user.cookie, origin: SITE }), path: "/api/auth/sign-out?callbackURL=https%3A%2F%2Fevil.example" }],
    ["query callbackURL, relative", { ...signOutRequest({ cookie: user.cookie, origin: SITE }), path: "/api/auth/sign-out?callbackURL=%2Fabout" }],
    ["query callbackURL, no cookie", { ...signOutRequest({}), path: "/api/auth/sign-out?callbackURL=https%3A%2F%2Fevil.example" }],
    ["another query", { ...signOutRequest({ cookie: user.cookie, origin: SITE }), path: "/api/auth/sign-out?x=%E2%82%AC" }],
    ["redirectTo of another site", signOutRequest({ cookie: user.cookie, origin: SITE }, '{"redirectTo":"https://evil.example"}')],
    ["redirectTo, relative", signOutRequest({ cookie: user.cookie, origin: SITE }, '{"redirectTo":"/about"}')],
    ["redirectTo not a string", signOutRequest({ cookie: user.cookie, origin: SITE }, '{"redirectTo":1}')],
    ["redirectTo empty", signOutRequest({ cookie: user.cookie, origin: SITE }, '{"redirectTo":""}')],
    ["errorCallbackURL of another site", signOutRequest({ cookie: user.cookie, origin: SITE }, '{"errorCallbackURL":"https://evil.example"}')],
    ["newUserCallbackURL of another site", signOutRequest({ cookie: user.cookie, origin: SITE }, '{"newUserCallbackURL":"https://evil.example"}')],
    ["newUserCallbackURL not a string, no cookie", signOutRequest({}, '{"newUserCallbackURL":true}')],
    ["Origin null on a same-origin fetch", signOutRequest({ cookie: user.cookie, origin: "null", "sec-fetch-site": "same-origin" })],
  ]) {
    await sameWrite(label, t, null, request);
  }
  await compare("GET", { path: "/api/auth/sign-out", headers: { cookie: user.cookie } });
}

/** better-auth's limiter (production only): 100 a 10 s window per address and path. */
async function limits() {
  if (!production) return pass("rate limit", "off outside production, on both");
  for (const [label, request] of [["get-session", get(null)], ["sign-out", signOutRequest({})]]) {
    const flood = async (base, address) => {
      const headers = { ...request.headers, "x-forwarded-for": address };
      for (let i = 0; i < 100; i += 1) await send(base, { ...request, headers });
      const refused = await send(base, { ...request, headers });
      return `${refused.status} ${refused.body} x-retry-after=${refused.headers["x-retry-after"]} cache-control=${refused.headers["cache-control"]}`;
    };
    const stamp = Date.now() % 250;
    expectEqual(`${label}: the 101st request in 10 s`, await flood(axumBase, `198.18.1.${stamp}`), await flood(nextBase, `198.18.2.${stamp}`));
  }
}

await run({ "get-session": getSession, "sign-out": signOut, limits });
