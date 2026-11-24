#!/usr/bin/env node
// Email sign-in, sign-up, email verification and password reset: Next
// (better-auth) against Axum on one database. Every case of the five
// endpoints: the answer (status, headers, Set-Cookie lines, body), the rows
// each server leaves in "user", account, session, verification, auth.users
// and profiles, and the mail each sends to its webhook. See README.md here.
//
//   DATABASE_URL=<test db> BETTER_AUTH_SECRET=<the servers'> NODE_ENV=<the servers'> \
//   TEST_DB_CONTAINER=<container> NEXT_MAIL=<file> AXUM_MAIL=<file> \
//     node server/parity/auth-credentials.mjs <next> <axum> [section...]
//
// NEXT_MAIL and AXUM_MAIL are the files the two webhook stubs append each
// request to (one JSON line: method, url, contentType, body); without them
// mail is not compared. A writing case runs once per server on its own
// address and compares what each left with the address and the random parts
// (ids, tokens, times) masked. Throwaway database only.
import { createHmac } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { axumBase, compare as compareAnswers, describe, expectEqual, fail, nextBase, pass, psql, run, send, sqlText } from "./harness.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const bcrypt = createRequire(resolve(root, "package.json"))("bcryptjs");
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret || !process.env.DATABASE_URL) {
  console.error("DATABASE_URL and BETTER_AUTH_SECRET are required, as the servers have them");
  process.exit(2);
}
const production = process.env.NODE_ENV === "production";
const prefix = production ? "__Secure-" : "";
const NAMES = { token: `${prefix}better-auth.session_token`, remember: `${prefix}better-auth.dont_remember` };
const SITE = new URL(nextBase).origin;
const SERVERS = [["next", nextBase], ["axum", axumBase]];
const MAIL = { next: process.env.NEXT_MAIL, axum: process.env.AXUM_MAIL };
const run_id = Date.now().toString(36);
const PASSWORD = "abcdefgh1234";

// One client address per request: the limiter (3 per 10 s on sign-in and
// sign-up) counts per address, and each case is its own client.
let addresses = Math.floor(Math.random() * 50_000);
const address = () => { addresses += 1; return `198.18.${Math.floor(addresses / 250) % 250}.${addresses % 250}`; };
// A header given as "" is left out.
const json = (path, body, headers = {}) => ({
  method: "POST",
  path,
  headers: Object.fromEntries(Object.entries({ "content-type": "application/json", origin: SITE, "x-forwarded-for": address(), ...headers }).filter(([, value]) => value !== "")),
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const sign = (value) => encodeURIComponent(`${value}.${createHmac("sha256", secret).update(value).digest("base64")}`);
const cspMask = (text) => (!production && text.startsWith("default-src ") ? "<csp>" : text);

// What differs on every call: ids, tokens, signatures, times, the address.
function masker(email, t0) {
  return (text) => cspMask(text)
    .replaceAll(email ?? "\u0000", "<email>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/(session_token=)[^;]+/g, "$1<cookie>")
    .replace(/"token":"[A-Za-z0-9]{32}"/g, '"token":"<token>"')
    .replace(/\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}/g, "<bcrypt>")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<jwt>")
    .replace(/(reset-password(?:\?token=|:))[A-Za-z0-9]{24}/g, "$1<reset-token>")
    .replace(/[0-9a-f]{32}:[0-9a-f]{128}/g, "<scrypt>")
    .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:?\d\d)/g, (iso) => {
      const at = Date.parse(iso);
      return t0 && at >= t0 - 5 ? `<call+${Math.round((at - t0) / 60_000)}min>` : "<before>";
    })
    .replace(/198\.18\.\d+\.\d+/g, "<address>")
    .replace(/\b(n[a-z0-9]{1,14})(next|axum)(?![a-z0-9])/g, "$1<server>");
}

/** Everything the app keeps about one address, as JSON text. */
function rows(email) {
  const e = sqlText(email);
  return psql(`select json_build_object(
    'user', (select row_to_json(u) from public."user" u where u.email = ${e}),
    'account', (select json_agg(a order by a."createdAt") from public.account a join public."user" u on u.id = a."userId" where u.email = ${e}),
    'session', (select json_agg(s order by s."createdAt") from public.session s join public."user" u on u.id = s."userId" where u.email = ${e}),
    'verification', (select json_agg(v order by v."createdAt") from public.verification v join public."user" u on u.id::text = v.value where u.email = ${e}),
    'auth_users', (select json_agg(json_build_object('email', au.email, 'confirmed', au.email_confirmed_at is not null,
        'nickname', replace(replace(au.raw_user_meta_data->>'nickname', substr(replace(au.id::text, '-', ''), 1, 6), '<id6>'), substr(replace(au.id::text, '-', ''), 1, 3), '<id3>'))) from auth.users au where au.email = ${e}),
    'profiles', (select json_agg(json_build_object('nickname',
        replace(replace(p.nickname, substr(replace(p.id::text, '-', ''), 1, 6), '<id6>'), substr(replace(p.id::text, '-', ''), 1, 3), '<id3>'),
        'role', p.role)) from public.profiles p join auth.users au on au.id = p.id where au.email = ${e})
  )::text`);
}

const mailCount = (name) => (MAIL[name] && existsSync(MAIL[name]) ? readFileSync(MAIL[name], "utf8").split("\n").filter(Boolean).length : 0);
function newMail(name, before) {
  if (!MAIL[name]) return "(not compared)";
  const lines = existsSync(MAIL[name]) ? readFileSync(MAIL[name], "utf8").split("\n").filter(Boolean) : [];
  return lines.slice(before).join("\n") || "(none)";
}

/**
 * One case per server: `setup(server)` returns the address the case uses
 * (prepared as the case needs it) and `request(email)` the request. The
 * answers, the rows of that address and the mail sent are compared.
 */
async function each(label, setup, request, { status } = {}) {
  const seen = {};
  for (const [name, base] of SERVERS) {
    const email = await setup(name);
    // Rows the setup wrote are older than the call, also to the millisecond.
    await new Promise((done) => setTimeout(done, 20));
    const mails = mailCount(name);
    const t0 = Date.now();
    const response = await send(base, request(email));
    const mask = masker(email, t0);
    seen[name] = { status: response.status, answer: describe(response, mask), rows: email ? mask(rows(email)) : "", mail: mask(newMail(name, mails)) };
  }
  for (const part of ["answer", "rows", "mail"]) {
    if (seen.next[part] !== seen.axum[part]) return fail(`${label}: ${part}`, `next:\n${seen.next[part]}\naxum:\n${seen.axum[part]}`);
  }
  if (status !== undefined && seen.next.status !== status) return fail(label, `both answered ${seen.next.status}, expected ${status}`);
  pass(label, `${seen.next.status}`);
  return seen;
}
const compare = (label, request, options = {}) => compareAnswers(label, request, { ...options, mask: masker(null, Date.now()) });

const fresh = (tag, server) => `a2-${run_id}-${tag}-${server}@example.com`.toLowerCase();
/** A name of its own for each server, so that nicknames never collide by accident. */
const nameOf = (tag, server) => `n${tag.replace(/[^a-z0-9]/g, "").slice(0, 10)}${server}`;
const serverOf = (email) => (email.endsWith("-axum@example.com") ? "axum" : "next");
/** A user signed up by Next's better-auth, verified or not. */
async function signedUp(tag, server, { verified = true, password = PASSWORD, name = nameOf(tag, server) } = {}) {
  const email = fresh(tag, server);
  const response = await send(nextBase, json("/api/auth/sign-up/email", { name, email, password }));
  if (response.status !== 200) throw new Error(`sign-up of ${email}: ${response.status} ${response.body}`);
  if (verified) psql(`update public."user" set "emailVerified" = true where email = ${sqlText(email)}`);
  return email;
}
/** A user from the previous store: a bcrypt hash with the given prefix. */
function imported(tag, server, minor) {
  const email = fresh(tag, server);
  const hash = `$2${minor}$${bcrypt.hashSync(PASSWORD, 4).slice(4)}`;
  psql(`with u as (insert into public."user" (name, email, "emailVerified") values ('imported', ${sqlText(email)}, true) returning id)
        insert into public.account ("accountId", "providerId", "userId", password, "updatedAt") select id::text, 'credential', id, ${sqlText(hash)}, now() from u`);
  return email;
}
const userId = (email) => psql(`select id from public."user" where email = ${sqlText(email)}`);
/** The verification JWT better-auth would mail, with `exp` moved by `shift` seconds. */
function jwt(payload, key = secret) {
  const b64 = (value) => Buffer.from(value).toString("base64url");
  const input = `${b64('{"alg":"HS256"}')}.${b64(JSON.stringify(payload))}`;
  return `${input}.${createHmac("sha256", key).update(input).digest("base64url")}`;
}
const now = () => Math.floor(Date.now() / 1000);

async function signIn() {
  const path = "/api/auth/sign-in/email";
  await compare("invalid email", json(path, { email: "nobody", password: "x" }), { status: 400 });
  await compare("password too long", json(path, { email: "a@example.com", password: "p".repeat(129) }), { status: 400 });
  await compare("unknown address", json(path, { email: `nobody-${run_id}@example.com`, password: PASSWORD }), { status: 401 });
  await compare("cross-site navigation", json(path, { email: "a@example.com", password: "x" }, { origin: "", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" }), { status: 403 });
  await compare("fetch metadata, no origin", json(path, { email: "a@example.com", password: "x" }, { origin: "", "sec-fetch-site": "same-origin" }), { status: 403 });
  await compare("origin of another site", json(path, { email: "a@example.com", password: "x" }, { origin: "https://evil.example" }), { status: 403 });
  await compare("cookie, no origin", json(path, { email: "a@example.com", password: "x" }, { origin: "", cookie: "a=b" }), { status: 403 });
  await compare("no origin, no metadata", json(path, { email: `nobody-${run_id}@example.com`, password: PASSWORD }, { origin: "" }), { status: 401 });
  const signInAs = (body) => (email) => json(path, { email, password: PASSWORD, ...body });
  await each("wrong password", (s) => signedUp("wrong", s), (email) => json(path, { email, password: "wrongwrong1234" }), { status: 401 });
  await each("unverified address, right password", (s) => signedUp("unverified", s, { verified: false }), signInAs({}), { status: 403 });
  await each("unverified address, wrong password", (s) => signedUp("unvwrong", s, { verified: false }), (email) => json(path, { email, password: "wrongwrong1234" }), { status: 401 });
  await each("no credential account", (s) => {
    const email = fresh("nocredential", s);
    psql(`insert into public."user" (name, email, "emailVerified") values ('google only', ${sqlText(email)}, true)`);
    return email;
  }, signInAs({}), { status: 401 });
  await each("signed in", (s) => signedUp("ok", s), signInAs({}), { status: 200 });
  await each("signed in, upper-case address", (s) => signedUp("upper", s), (email) => json(path, { email: email.toUpperCase(), password: PASSWORD }), { status: 200 });
  await each("rememberMe false", (s) => signedUp("forget", s), signInAs({ rememberMe: false }), { status: 200 });
  await each("rememberMe true with a dont_remember cookie", (s) => signedUp("remember", s), (email) => json(path, { email, password: PASSWORD, rememberMe: true }, { cookie: `${NAMES.remember}=${sign("true")}` }), { status: 200 });
  for (const minor of ["a", "b", "y"]) {
    await each(`bcrypt $2${minor}$ from the previous store`, (s) => imported(`bcrypt${minor}`, s, minor), signInAs({}), { status: 200 });
  }
  await each("a hash neither can read: Next answers", (s) => {
    const email = imported("unreadable", s, "b");
    psql(`update public.account set password = 'not-a-hash' where "userId" = (select id from public."user" where email = ${sqlText(email)})`);
    return email;
  }, signInAs({}));
  // Left to Next.
  for (const [label, body, headers] of [
    ["callbackURL", { email: "a@example.com", password: "x", callbackURL: "/" }],
    ["rememberMe null", { email: "a@example.com", password: "x", rememberMe: null }],
    ["another key", { email: "a@example.com", password: "x", x: 1 }],
    ["a form body", "email=a%40example.com&password=x", { "content-type": "application/x-www-form-urlencoded" }],
  ]) {
    await compare(`left to Next: ${label}`, json(path, body, headers));
  }
  await compare("left to Next: a query string", { ...json(path, { email: "a@example.com", password: "x" }), path: `${path}?x=1` });
}

async function signUp() {
  const path = "/api/auth/sign-up/email";
  const body = (email, extra = {}) => json(path, { name: nameOf("new", serverOf(email)), email, password: PASSWORD, ...extra });
  await each("a new address", (s) => fresh("new", s), (email) => body(email), { status: 200 });
  await each("a new address in capitals", (s) => fresh("caps", s), (email) => body(email.toUpperCase()), { status: 200 });
  // The fallback nickname is one for everybody: free it before each turn.
  await each("an empty name: the fallback nickname", (s) => {
    psql(`delete from auth.users where raw_user_meta_data->>'nickname' = '밈러'`);
    return fresh("noname", s);
  }, (email) => json(path, { name: "", email, password: PASSWORD }), { status: 200 });
  await each("a nickname already taken", async (s) => { await signedUp("nick1", s, { name: `taken${run_id}` }); return fresh("nick2", s); }, (email) => json(path, { name: `taken${run_id}`, email, password: PASSWORD }), { status: 200 });
  await each("an existing address: the same answer", (s) => signedUp("existing", s), (email) => body(email), { status: 200 });
  await each("password too short", (s) => fresh("short", s), (email) => json(path, { name: "n", email, password: "abcdefgh123" }), { status: 400 });
  await each("password of 12", (s) => fresh("twelve", s), (email) => json(path, { name: "n", email, password: "abcdefgh1234" }), { status: 200 });
  await each("password too long", (s) => fresh("long", s), (email) => json(path, { name: "n", email, password: "p".repeat(129) }), { status: 400 });
  for (const domain of ["kakao.memecatch.internal", "Auth.MemeCatch.Internal", "wallet.memecatch.internal"]) {
    await compare(`reserved domain ${domain}`, body(`a2-${run_id}@${domain}`), { status: 400 });
  }
  await compare("origin of another site", json(path, { name: "n", email: "a@example.com", password: PASSWORD }, { origin: "https://evil.example" }), { status: 403 });
  await compare("cross-site navigation", json(path, { name: "n", email: "a@example.com", password: PASSWORD }, { origin: "", "sec-fetch-site": "cross-site", "sec-fetch-mode": "navigate" }), { status: 403 });
  for (const [label, extra] of [["image", { image: "https://example.com/a.png" }], ["callbackURL", { callbackURL: "/" }], ["an invalid address", { email: "nobody" }], ["an empty password", { password: "" }]]) {
    await compare(`left to Next: ${label}`, body("a2-left@example.com", extra));
  }
}

async function verifyEmail() {
  const path = (token, callback = "%2F") => ({ method: "GET", path: `/api/auth/verify-email?token=${token}${callback === null ? "" : `&callbackURL=${callback}`}`, headers: { "x-forwarded-for": address() } });
  const tokenFor = (email, { shift = 3600, id = userId(email) } = {}) => jwt({ email, userId: id, iat: now(), exp: now() + shift });
  await each("verified: to the callback", (s) => signedUp("verify", s, { verified: false }), (email) => path(tokenFor(email)), { status: 302 });
  await each("verified: JSON without a callback", (s) => signedUp("verifyjson", s, { verified: false }), (email) => path(tokenFor(email), null), { status: 200 });
  await each("verified, with a callback query", (s) => signedUp("verifyq", s, { verified: false }), (email) => path(tokenFor(email), "%2Fmy%3Fx%3D1"), { status: 302 });
  await each("already verified: the same", (s) => signedUp("again", s), (email) => path(tokenFor(email)), { status: 302 });
  await each("expired", (s) => signedUp("expired", s, { verified: false }), (email) => path(tokenFor(email, { shift: -1 })), { status: 302 });
  await each("expired, no callback", (s) => signedUp("expiredjson", s, { verified: false }), (email) => path(tokenFor(email, { shift: -1 }), null), { status: 401 });
  await each("another user's id", (s) => signedUp("otherid", s, { verified: false }), (email) => path(tokenFor(email, { id: "00000000-0000-4000-8000-000000000000" })), { status: 302 });
  await compare("unknown address", path(jwt({ email: `nobody-${run_id}@example.com`, iat: now(), exp: now() + 60 }), null), { status: 401 });
  await compare("another secret", path(jwt({ email: "a@example.com", iat: now(), exp: now() + 60 }, "other")), { status: 302 });
  await compare("not a token", path("abc", null), { status: 401 });
  await compare("an empty token", path("", null), { status: 401 });
  // Left to Next.
  await compare("left to Next: an absolute callback", path("abc", "https%3A%2F%2Fevil.example"));
  await compare("left to Next: no token", { method: "GET", path: "/api/auth/verify-email", headers: {} });
  await compare("left to Next: a change-email token", path(jwt({ email: "a@example.com", updateTo: "b@example.com", iat: now(), exp: now() + 60 }), null));
  await compare("left to Next: HEAD", { ...path("abc", null), method: "HEAD" });
}

async function reset() {
  const request = "/api/auth/request-password-reset";
  await each("reset requested for an account", (s) => signedUp("reset", s), (email) => json(request, { email }), { status: 200 });
  await each("reset requested, redirectTo a path", (s) => signedUp("resetredirect", s), (email) => json(request, { email, redirectTo: "/reset-password" }), { status: 200 });
  await compare("reset requested for an unknown address", json(request, { email: `nobody-${run_id}@example.com` }), { status: 200 });
  for (const [label, body] of [["an absolute redirectTo", { email: "a@example.com", redirectTo: "https://evil.example" }], ["an invalid address", { email: "nobody" }]]) {
    await compare(`left to Next: ${label}`, json(request, body));
  }
  const path = "/api/auth/reset-password";
  // A token as requestPasswordReset leaves it, for the case's user.
  const withToken = (tag, { expiresIn = "1 hour", userOf = (email) => userId(email), password = true } = {}) => async (s) => {
    const email = password ? await signedUp(tag, s) : fresh(tag, s);
    if (!password) psql(`insert into public."user" (name, email, "emailVerified") values ('no password', ${sqlText(email)}, true)`);
    const token = `${tag}${s}${run_id}`.replace(/[^A-Za-z0-9]/g, "").padEnd(24, "x").slice(0, 24);
    psql(`insert into public.verification (identifier, value, "expiresAt") values (${sqlText(`reset-password:${token}`)}, ${sqlText(userOf(email))}, now() + interval '${expiresIn}')`);
    tokens[email] = token;
    return email;
  };
  const tokens = {};
  const resetTo = (password) => (email) => json(path, { newPassword: password, token: tokens[email] });
  await each("reset", withToken("done"), resetTo("newpassword1234"), { status: 200 });
  await each("reset, no credential account yet", withToken("create", { password: false }), resetTo("newpassword1234"), { status: 200 });
  await each("reset, token expired", withToken("old", { expiresIn: "-1 second" }), resetTo("newpassword1234"), { status: 400 });
  await each("reset, user gone", withToken("gone", { userOf: () => "00000000-0000-4000-8000-000000000000" }), resetTo("newpassword1234"), { status: 400 });
  await each("reset, password too short", withToken("short"), resetTo("short"), { status: 400 });
  await each("reset twice: the second refused", async (s) => {
    const email = await withToken("twice")(s);
    await send(s === "next" ? nextBase : axumBase, resetTo("newpassword1234")(email));
    return email;
  }, resetTo("otherpassword123"), { status: 400 });
  await compare("reset, unknown token", json(path, { newPassword: "newpassword1234", token: "nosuchtoken0000000000000" }), { status: 400 });
  await compare("reset, no token", json(path, { newPassword: "newpassword1234" }), { status: 400 });
  await compare("left to Next: the token in the query", { ...json(path, { newPassword: "newpassword1234" }), path: `${path}?token=x` });
  // The new password works on the other server.
  const email = await withToken("cross")("next");
  await send(axumBase, resetTo("crosspassword123")(email));
  const signedIn = await send(nextBase, json("/api/auth/sign-in/email", { email, password: "crosspassword123" }));
  expectEqual("a password Axum set signs in on Next", signedIn.status, 200);
}

/** better-auth's limiter (production only): the 4th sign-in, sign-up or reset request in a window. */
async function limits() {
  if (!production) return pass("rate limit", "off outside production, on both");
  for (const [label, path, body] of [
    ["sign-in", "/api/auth/sign-in/email", { email: "nobody", password: "x" }],
    ["sign-up", "/api/auth/sign-up/email", { name: "n", email: "a2-limit@example.com", password: "short" }],
    ["reset request", "/api/auth/request-password-reset", { email: `nobody-${run_id}@example.com` }],
  ]) {
    const flood = async (base) => {
      const from = address();
      for (let i = 0; i < 3; i += 1) await send(base, json(path, body, { "x-forwarded-for": from }));
      const refused = await send(base, json(path, body, { "x-forwarded-for": from }));
      return `${refused.status} ${refused.body} x-retry-after=${refused.headers["x-retry-after"]}`;
    };
    expectEqual(`${label}: the 4th request in the window`, await flood(axumBase), await flood(nextBase));
  }
}

await run({ "sign-in": signIn, "sign-up": signUp, "verify-email": verifyEmail, reset, limits });
