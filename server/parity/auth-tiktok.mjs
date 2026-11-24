#!/usr/bin/env node
// TikTok login: Next (app/auth/tiktok) against Axum (src/routes/better_auth/
// tiktok/) on one database, each server's TikTok requests sent to a stub of
// its own (oauth-provider-stub.mjs). See README.md here.
//
//   TEST_DB_CONTAINER=<container> NEXT_STUB=http://127.0.0.1:<p1> AXUM_STUB=http://127.0.0.1:<p2> \
//   BETTER_AUTH_SECRET=<the servers'> \
//     node server/parity/auth-tiktok.mjs <next> <axum> [start] [handed] [callback] [flow] [cross] [unset]
//
// Both servers run with the same DATABASE_URL, BETTER_AUTH_SECRET,
// BETTER_AUTH_URL, NODE_ENV, NEXT_PUBLIC_SITE_URL (the Next build's) and
// throwaway TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET; Next with
// NODE_OPTIONS="--import <repo>/server/tests/oauth_fetch_stub.mjs" and
// OAUTH_STUB_ORIGIN=$NEXT_STUB, Axum with AXUM_TEST_OAUTH_ORIGIN=$AXUM_STUB;
// each with AUTH_EMAIL_WEBHOOK=<its stub>/hook. `unset` is for a run where
// neither server has TIKTOK_CLIENT_KEY. Throwaway database only.
//
// Every answer is compared whole (status, every header, every `Set-Cookie`
// line in order, body), with one difference on purpose (PLAN.md A4-2): Next
// writes `Location` on its own listen address, Axum the same path, query and
// fragment alone. The script checks that Next's starts with that address and
// compares the rest.
import { createHash, createHmac, randomBytes } from "node:crypto";
import { axumBase, describe, fail, nextBase, pass, psql, run, send, sqlText } from "./harness.mjs";
import { codeFor, startStub, tokenFor } from "./oauth-provider-stub.mjs";

const production = process.env.NODE_ENV !== "development";
const prefix = production ? "__Secure-" : "";
const SECRET = process.env.BETTER_AUTH_SECRET ?? "";
if (!SECRET) {
  console.error("BETTER_AUTH_SECRET (the servers') is needed to sign session cookies");
  process.exit(2);
}
const stubs = {
  next: await startStub(Number(new URL(process.env.NEXT_STUB ?? "").port)),
  axum: await startStub(Number(new URL(process.env.AXUM_STUB ?? "").port)),
};
const bases = { next: nextBase, axum: axumBase };
// Next's `request.url`: `http(s)://localhost:<port>` for a server bound to
// 127.0.0.1 (PLAN.md A4-2).
const nextOwn = `http://localhost:${new URL(nextBase).port}`;
const runId = Date.now().toString(36);
let counter = 0;
const unique = () => `${runId}-${(counter += 1)}`;
let addresses = Math.floor(Math.random() * 50_000);
const address = () => { addresses += 1; return `198.18.${Math.floor(addresses / 250) % 250}.${addresses % 250}`; };
const browser = (extra = {}) => ({ "x-forwarded-for": address(), "user-agent": "a4-parity", ...extra });

const mask = (open = []) => (text) => {
  let out = text;
  for (const id of open) out = out.replaceAll(id, "<open>");
  return out
    .replaceAll(`location: ${nextOwn}`, "location: ")
    .replace(/(tiktok_oauth_state=|state=)[A-Za-z0-9_-]{43}/g, "$1<state>")
    .replace(/(session_token=)[^;\s"]+/g, "$1<cookie>")
    .replace(/Expires=[^;]+/g, "Expires=<date>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/[0-9a-f]{64}/g, "<hex64>")
    .replace(/(token=)[A-Za-z0-9._-]+/g, "$1<token>")
    .replace(/at\.[A-Za-z0-9_-]+/g, "<at>")
    .replace(/code\.[A-Za-z0-9_-]+/g, "<code>")
    .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:?\d\d)/g, "<time>")
    .replace(/198\.18\.\d+\.\d+/g, "<address>");
};

/** Next's `Location` must be on its own address; the rest is compared. */
function locationNote(server, response) {
  const location = response.headers.location?.[0];
  if (server !== "next" || !location || location.startsWith("https://www.tiktok.com/")) return "";
  return location.startsWith(nextOwn) ? "" : `Next's Location ${location} is not on ${nextOwn}\n`;
}

const subjectOf = (openId) => createHash("sha256").update(openId).digest("hex");
const cookieJar = (response) =>
  (response.headers["set-cookie"] ?? []).map((line) => line.split(";")[0]).filter((pair) => !pair.endsWith("=")).join("; ");

/** What the stub answers: the code names the token answer, the access token the profile and videos. */
// Each case's own name (its subject's first six digits, as the fallback
// `틱톡러_<subject>` uses), so that no case's profile nickname collides with
// another's. Twenty UTF-16 units cut the last emoji in half.
const tagOf = (openId) => subjectOf(openId).slice(0, 6);
function tiktokCode(openId, { token = {}, user, videos, scope = "user.info.basic,video.list", name = `  ${tagOf(openId)} 😀😀😀😀😀😀😀😀😀😀😀😀  ` } = {}) {
  const profile = user ?? { status: 200, body: { data: { user: { open_id: openId, display_name: name, avatar_url: "https://p16.tiktokcdn.com/a.jpg" } }, error: { code: "ok" } } };
  const list = videos ?? { status: 200, body: { data: { videos: [] }, error: { code: "ok" } } };
  const body = { access_token: tokenFor({ user: profile, videos: list }), open_id: openId, scope, ...token.body };
  return codeFor({ status: token.status ?? 200, body: token.raw ?? body, contentType: token.contentType });
}

/** Everything the app keeps about one TikTok subject. */
function rows(openId, mintedToken) {
  const s = sqlText(subjectOf(openId));
  const email = `(select internal_email from public.tiktok_provider_identities where provider_subject = ${s})`;
  const user = `(select id from public."user" where email = ${email})`;
  const minted = mintedToken
    ? `(select json_build_object('days', round(extract(epoch from "expiresAt" - now()) / 86400)) from public.session where token = ${sqlText(mintedToken)})`
    : "null";
  return psql(`select json_build_object(
    'identity', (select json_build_object('internal', internal_email ~ '^[0-9a-f]{64}@auth\\.memecatch\\.internal$',
                   'bound', user_id is not null, 'boundToItsUser', user_id = ${user}, 'touched', updated_at > created_at)
                 from public.tiktok_provider_identities where provider_subject = ${s}),
    'user', (select json_build_object('name', name, 'verified', "emailVerified", 'image', image) from public."user" where id = ${user}),
    'accounts', (select json_agg(json_build_object('provider', "providerId", 'accountIsUser', "accountId" = "userId"::text,
                   'password', password ~ '^[0-9a-f]{32}:[0-9a-f]{128}$')) from public.account where "userId" = ${user}),
    'sessions', (select json_agg(json_build_object('ua', "userAgent", 'ip', "ipAddress",
                   'days', round(extract(epoch from "expiresAt" - now()) / 86400)) order by "createdAt") from public.session where "userId" = ${user}),
    'authUser', (select json_build_object('confirmed', email_confirmed_at is not null, 'meta', raw_user_meta_data) from auth.users where id = ${user}),
    'profile', (select nickname from public.profiles where id = ${user}),
    'submissions', (select json_agg(json_build_object('name', name, 'url', source_url, 'description', description,
                   'reason', guess_reason, 'tags', tags, 'status', status) order by created_at, name) from public.meme_submissions where submitter_id = ${user}),
    'minted', ${minted})`);
}

/** A plain user with a profile, for sessions and occupied URLs. */
function plainUser() {
  return psql(`with u as (insert into public."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (gen_random_uuid(), 'a4 plain', 'a4-${unique()}@example.com', true, now(), now()) returning id, email)
    insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
    select id, email, now(), jsonb_build_object('nickname', 'a4p_' || substr(md5(random()::text), 1, 10)) from u returning id::text`).split("\n")[0];
}

/** A session row for `userId` and the browser's signed cookie for it. */
function mintSession(userId, { expiresInMs = 7 * 86_400_000, ageMs = 0 } = {}) {
  const token = randomBytes(24).toString("base64url").slice(0, 32);
  psql(`insert into public.session (id, "expiresAt", token, "createdAt", "updatedAt", "ipAddress", "userAgent", "userId")
    values (gen_random_uuid(), now() + ${expiresInMs} * interval '1 millisecond', ${sqlText(token)},
            now() - ${ageMs} * interval '1 millisecond', now() - ${ageMs} * interval '1 millisecond', '', 'a4-minted', ${sqlText(userId)}::uuid)`);
  const signature = createHmac("sha256", SECRET).update(token).digest("base64");
  return { minted: token, cookie: `${prefix}better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}` };
}

const userIdOf = (openId) =>
  psql(`select u.id::text from public."user" u join public.tiktok_provider_identities t on t.internal_email = u.email
         where t.provider_subject = ${sqlText(subjectOf(openId))}`);

async function login(on, finishOn, openId, { next = "/my", importVideos = false, code, cookie = "" } = {}) {
  const startPath = `/auth/tiktok?next=${encodeURIComponent(next)}${importVideos ? "&import=1" : ""}`;
  const start = await send(bases[on], { path: startPath, headers: browser() });
  const jar = cookieJar(start);
  const state = jar.match(/tiktok_oauth_state=([^;]+)/)?.[1];
  const callback = await send(bases[finishOn], {
    path: `/auth/tiktok/callback?state=${state}&code=${code ?? encodeURIComponent(tiktokCode(openId))}`,
    headers: browser({ cookie: [jar, cookie].filter(Boolean).join("; ") }),
  });
  return { start, callback };
}

const clearStubs = () => { for (const stub of Object.values(stubs)) { stub.seen.length = 0; stub.mail.length = 0; } };

/** A user this flow made, marked verified by hand (the only way the flow signs in, PLAN.md A4-1). */
async function verifiedUser(openId, on) {
  await login(on, on, openId);
  psql(`update public."user" set "emailVerified" = true where id = ${sqlText(userIdOf(openId))}::uuid`);
  clearStubs();
}

/** One run of a case: everything a client and the database see, masked. */
async function observe(spec, startOn, finishOn) {
  clearStubs();
  const openId = `a4-${unique()}`;
  // Users a case needs are made by the server that starts it, so a cross run
  // also signs in on one server a user the other made.
  const context = (await spec.prepare?.(openId, startOn)) ?? {};
  const code = spec.code ? spec.code(openId) : undefined;
  const { start, callback } = await login(startOn, finishOn, openId, { ...spec, ...context, code });
  const m = mask([openId, tagOf(openId)]);
  const jar = cookieJar(callback);
  let session = "none";
  if (jar.includes("session_token=")) {
    const other = finishOn === "next" ? "axum" : "next";
    const read = await send(bases[other], { path: "/api/auth/get-session", headers: browser({ cookie: jar }) });
    const body = read.body.toString("utf8");
    session = body === "null" ? "null" : JSON.parse(body).user?.id === userIdOf(openId) ? "the user's" : "another";
  }
  const seen = stubs[finishOn].seen.map((request) => ({
    ...request,
    values: Object.fromEntries(Object.entries(request.values).map(([key, value]) => [key, key === "code" ? "<code>" : value])),
  }));
  return {
    notes: locationNote(startOn, start) + locationNote(finishOn, callback),
    text: [
      `start:\n${m(describe(start))}`,
      `callback:\n${m(describe(callback))}`,
      `session read by the other server: ${session}`,
      `rows: ${m(rows(openId, context.minted))}`,
      `mail: ${m(JSON.stringify(stubs[finishOn].mail))}`,
      `tiktok saw: ${m(JSON.stringify(seen))}`,
    ].join("\n"),
  };
}

const indent = (text) => text.replace(/^/gm, "      ");
function judge(label, reference, candidate) {
  if (reference.notes || candidate.notes) return fail(label, reference.notes + candidate.notes);
  if (reference.text !== candidate.text) {
    return fail(label, `reference:\n${indent(reference.text)}\nother:\n${indent(candidate.text)}`);
  }
  const callback = reference.text.split("callback:\n")[1];
  const status = callback.match(/status: (\d+)/)?.[1];
  const location = callback.match(/header location: ([^\n]*)/)?.[1] ?? "";
  pass(label, `${status} ${location.slice(0, 70)}`);
  // `SHOW=<part of a label>` prints what a passing case compared.
  if (process.env.SHOW && label.includes(process.env.SHOW)) console.log(indent(reference.text));
}

/** Next and Axum answer a request that changes nothing the same way (Next twice, as parity.mjs). */
async function same(label, request, { handlerAnswer = true } = {}) {
  const m = mask();
  const first = await send(nextBase, request);
  const axum = await send(axumBase, request);
  const second = await send(nextBase, request);
  const [a, b, c] = [first, axum, second].map((response) => m(describe(response)));
  // Next's own answers to the requests Axum hands it are not the handlers'.
  const notes = handlerAnswer ? locationNote("next", first) : "";
  if (notes) return fail(label, notes);
  if (a !== c) return fail(label, `Next answered differently twice:\n${indent(a)}\n--\n${indent(c)}`);
  if (a !== b) return fail(label, `next:\n${indent(a)}\naxum:\n${indent(b)}`);
  pass(label, `${first.status} ${(first.headers.location?.[0] ?? "").replace(nextOwn, "").slice(0, 70)}`);
}

const videos = (list, status = 200) => ({ status, body: { data: { videos: list }, error: { code: "ok" } } });
const withSession = (options) => () => mintSession(plainUser(), options);
const FLOW = {
  "a new user (left unverified, so no session)": {},
  "a new user without a display name": { code: (id) => encodeURIComponent(tiktokCode(id, { name: null })) },
  "a new user whose name ends at the cut": { code: (id) => encodeURIComponent(tiktokCode(id, { name: `${tagOf(id)}${"😀".repeat(9)}` })) },
  "a returning, unverified user": { prepare: async (id, on) => { await login(on, on, id); clearStubs(); } },
  "a verified user": { prepare: verifiedUser, next: "/memes/x?a=1 b'c#h" },
  "a verified user importing videos": {
    prepare: async (id, on) => {
      await verifiedUser(id, on);
      psql(`insert into public.meme_submissions (submitter_id, name, source_url, description)
            values (${sqlText(plainUser())}::uuid, 'taken', 'https://www.tiktok.com/@a/video/taken-${id}', '')`);
    },
    importVideos: true,
    next: "/?tiktokImport=x&a=1%20b",
    code: (id) => encodeURIComponent(tiktokCode(id, {
      videos: videos([
        { id: "v1", title: " t1 ", share_url: `https://www.tiktok.com/@a/video/1-${id}` },
        { id: "v2", share_url: "http://www.tiktok.com/insecure" },
        { id: 7, video_description: "  d  ", share_url: `https://m.tiktok.com/v/3-${id}` },
        { id: "v4", share_url: `https://www.tiktok.com/@a/video/taken-${id}` },
        { id: "", share_url: "https://www.tiktok.com/no-id" },
        "not an object",
      ]),
    })),
  },
  "a verified user importing no videos": { prepare: verifiedUser, importVideos: true },
  "an import without video.list granted": {
    prepare: verifiedUser, importVideos: true, code: (id) => encodeURIComponent(tiktokCode(id, { scope: "user.info.basic" })),
  },
  "an import TikTok refuses": {
    prepare: verifiedUser, importVideos: true,
    code: (id) => encodeURIComponent(tiktokCode(id, { videos: { status: 200, body: { error: { code: "scope_not_authorized", message: "no" } } } })),
  },
  "an import that fails": {
    prepare: verifiedUser, importVideos: true, code: (id) => encodeURIComponent(tiktokCode(id, { videos: { status: 500, body: "x" } })),
  },
  "an import with a video TikTok sends as null": {
    prepare: verifiedUser, importVideos: true, code: (id) => encodeURIComponent(tiktokCode(id, { videos: videos([null]) })),
  },
  "a verified user carrying another user's session": {
    prepare: async (id, on) => { await verifiedUser(id, on); return mintSession(plainUser()); },
  },
  "an unverified user carrying a session due for refresh": { prepare: withSession({ expiresInMs: 5 * 86_400_000, ageMs: 2 * 86_400_000 }) },
  "an unverified user carrying an expired session": { prepare: withSession({ expiresInMs: -60_000 }) },
  "a verified user carrying a session due for refresh": {
    prepare: async (id, on) => { await verifiedUser(id, on); return mintSession(plainUser(), { expiresInMs: 5 * 86_400_000, ageMs: 2 * 86_400_000 }); },
  },
  "a verified user whose identity is bound to someone else (sign-out)": {
    prepare: async (id, on) => {
      await verifiedUser(id, on);
      const other = plainUser();
      psql(`update public.tiktok_provider_identities set user_id = ${sqlText(other)}::uuid where provider_subject = ${sqlText(subjectOf(id))}`);
      return mintSession(other);
    },
  },
  "a token request TikTok refuses": {
    code: (id) => encodeURIComponent(tiktokCode(id, { token: { status: 400, raw: { error: "invalid_grant", error_description: "bad code" } } })),
  },
  "a token answer that is not JSON": { code: (id) => encodeURIComponent(tiktokCode(id, { token: { raw: "<html>", contentType: "text/html" } })) },
  "a token answer without user.info.basic": { code: (id) => encodeURIComponent(tiktokCode(id, { scope: "video.list" })) },
  "a token answer without an open id": { code: (id) => encodeURIComponent(tiktokCode(id, { token: { body: { open_id: "" } } })) },
  "a profile for another open id": {
    code: (id) => encodeURIComponent(tiktokCode(id, { user: { status: 200, body: { data: { user: { open_id: `${id}-x` } } } } })),
  },
  "a profile request TikTok refuses": {
    code: (id) => encodeURIComponent(tiktokCode(id, { user: { status: 401, body: { error: { code: "access_token_invalid" } } } })),
  },
  // The state and code are good and `error` is there too.
  "the provider's error with a good state": { code: (id) => `${encodeURIComponent(tiktokCode(id))}&error=access_denied` },
};

async function flowSection(pairs) {
  for (const [label, spec] of Object.entries(FLOW)) {
    const reference = await observe(spec, ...pairs[0]);
    for (const pair of pairs.slice(1)) judge(`${label}: ${pair.join(" → ")}`, reference, await observe(spec, ...pair));
  }
}

const sections = {
  async start() {
    for (const query of [
      "", "?next=%2Fmemes%2Fx", "?next=%2Fmy%3Fa%3D1%20b%27c%23h", "?next=%2F%2Fevil.example", "?next=https%3A%2F%2Fevil.example",
      "?next=%2Flogin", "?next=%2F..%2F%2Fevil", "?next=%2F%25E0", "?import=1", "?import=0", "?import=1&import=0",
      "?next=%2Fa&next=%2Fb&import=1", `?next=${encodeURIComponent(`/${"x".repeat(2047)}`)}`, "?next=%2F%EB%B0%88", "?next=+%2Fa",
    ]) {
      await same(`GET /auth/tiktok${query.slice(0, 50)}`, { path: `/auth/tiktok${query}`, headers: browser() });
    }
  },
  async handed() {
    for (const [method, path, extra] of [
      ["HEAD", "/auth/tiktok", {}],
      ["POST", "/auth/tiktok", {}],
      ["POST", "/auth/tiktok/callback", {}],
      ["GET", "/auth/tiktok", { rsc: "1" }],
      ["GET", "/auth/tiktok/callback?state=x", { rsc: "1" }],
      ["GET", "/auth/tiktok", { host: "www.catchmeme.com" }],
      ["GET", "/auth/tiktok/callback?state=x", { host: "www.catchmeme.com" }],
      ["GET", "/auth/tiktok/", {}],
      ["GET", "/auth/tiktok/callback/", {}],
    ]) {
      await same(`${method} ${path} ${JSON.stringify(extra)}`, { method, path, headers: browser(extra) }, { handlerAnswer: method === "HEAD" });
    }
  },
  async callback() {
    const state = "s".repeat(43);
    for (const [label, query, cookie] of [
      ["no cookie, no query", "", ""],
      ["no state cookie", `state=${state}&code=c`, ""],
      ["a state that differs", `state=${state}&code=c`, `tiktok_oauth_state=${"t".repeat(43)}`],
      ["an empty state on both", "state=&code=c", "tiktok_oauth_state="],
      ["no code", `state=${state}`, `tiktok_oauth_state=${state}`],
      ["an empty code", `state=${state}&code=`, `tiktok_oauth_state=${state}`],
      ["the provider's error", `state=${state}&error=access_denied&error_description=no`, `tiktok_oauth_state=${state}`],
      ["an empty error", `state=${state}&code=c&error=`, `tiktok_oauth_state=${state}`],
      ["the next cookie", "state=x", "tiktok_oauth_next=%2Fmemes%2Fx%3Fa%3D1%2520b%2527c%23h"],
      ["a foreign next cookie", "state=x", "tiktok_oauth_next=%2F%2Fevil.example"],
      ["a next cookie that does not decode", "state=x", "tiktok_oauth_next=%2Fok; tiktok_oauth_next=%E0"],
      ["two next cookies", "state=x", "tiktok_oauth_next=%2Fa; tiktok_oauth_next=%2Fb"],
      ["the import cookie", "state=x", "tiktok_oauth_import=1"],
      ["a repeated state", `state=x&state=${state}&code=c`, "tiktok_oauth_state=x"],
    ]) {
      await same(`callback: ${label}`, { path: `/auth/tiktok/callback${query ? `?${query}` : ""}`, headers: browser(cookie ? { cookie } : {}) });
    }
  },
  async flow() {
    await flowSection([["next", "next"], ["axum", "axum"]]);
  },
  // Started on one server and finished on the other, both ways, against the
  // reference started and finished on Next.
  async cross() {
    await flowSection([["next", "next"], ["next", "axum"], ["axum", "next"]]);
  },
  async unset() {
    for (const query of ["", "?next=%2Fmemes%2Fx&import=1"]) {
      await same(`unset GET /auth/tiktok${query}`, { path: `/auth/tiktok${query}`, headers: browser() });
    }
    await same("unset callback", { path: "/auth/tiktok/callback?state=s&code=c", headers: browser({ cookie: "tiktok_oauth_state=s" }) });
  },
};

await run(sections);
