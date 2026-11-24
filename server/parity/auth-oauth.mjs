#!/usr/bin/env node
// Google and Kakao sign-in: Next (better-auth) against Axum on one database,
// with each server's provider requests sent to a stub of its own
// (oauth-provider-stub.mjs). Every case of the start (`POST
// /api/auth/sign-in/social`) and the callbacks (`GET /api/auth/callback/
// {google,kakao}`): the answer (status, every header, `Location`, every
// `Set-Cookie` line, body), the state row the start wrote, the rows the
// address has after the callback, the mail sent, the token request the
// provider saw, and a replay of the callback. See README.md here.
//
//   TEST_DB_CONTAINER=<container> NEXT_STUB=http://127.0.0.1:<p1> AXUM_STUB=http://127.0.0.1:<p2> \
//     node server/parity/auth-oauth.mjs <next> <axum> [start] [callback] [state] [accounts] [handed] [redirect] [unset]
//
// Both servers run with the same DATABASE_URL, BETTER_AUTH_SECRET,
// BETTER_AUTH_URL=http://localhost:3000, NODE_ENV and client ids; Next with
// NODE_OPTIONS="--import <repo>/server/tests/oauth_fetch_stub.mjs" and
// OAUTH_STUB_ORIGIN=$NEXT_STUB, Axum with AXUM_TEST_OAUTH_ORIGIN=$AXUM_STUB;
// each with AUTH_EMAIL_WEBHOOK=<its stub>/hook. `unset` is for a run where
// neither server has KAKAO_CLIENT_ID. Throwaway database only.
import { axumBase, compare as compareAnswers, describe, fail, nextBase, pass, psql, run, send, sqlText } from "./harness.mjs";
import { codeFor, idToken, startStub, tokenFor } from "./oauth-provider-stub.mjs";

const production = process.env.NODE_ENV !== "development";
const prefix = production ? "__Secure-" : "";
const ORIGIN = "http://localhost:3000";
const CALLBACK = "http://localhost:3000/auth/callback?next=%2F";
// NEXT_PUBLIC_SITE_URL the Next build was made with; Axum runs with it too.
const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://catchmeme.com";
const stubs = {
  next: await startStub(Number(new URL(process.env.NEXT_STUB ?? "").port)),
  axum: await startStub(Number(new URL(process.env.AXUM_STUB ?? "").port)),
};
const SERVERS = [["next", nextBase], ["axum", axumBase]];
const runId = Date.now().toString(36);

let addresses = Math.floor(Math.random() * 50_000);
const address = () => { addresses += 1; return `198.18.${Math.floor(addresses / 250) % 250}.${addresses % 250}`; };
const start = (body, headers = {}) => ({
  method: "POST",
  path: "/api/auth/sign-in/social",
  headers: { "content-type": "application/json", origin: ORIGIN, "x-forwarded-for": address(), "user-agent": "a3-parity", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const callback = (path, cookie, headers = {}) => ({
  path: `/api/auth${path}`,
  headers: { "x-forwarded-for": address(), "user-agent": "a3-parity", ...(cookie ? { cookie } : {}), ...headers },
});

let counter = 0;
const unique = () => { counter += 1; return `ax${(Date.now() * 1000 + counter).toString(16).slice(-12).padStart(12, "0")}`; };
const kakaoId = (u) => 40_000_000_000_000 + (parseInt(u.slice(2), 16) % 100_000_000);

// `next dev` sends its own CSP; it is not compared (README.md).
const cspMask = (text) => (!production && text.startsWith("default-src ") ? "<csp>" : text);

function mask(u) {
  return (text) => cspMask(text)
    .replaceAll(u, "<u>")
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, "<uuid>")
    .replace(/(session_token=)[^;"\s]+/g, "$1<cookie>")
    .replace(/(dont_remember=)[^;"\s]+/g, "$1<signed>")
    .replace(/(state[=:])[A-Za-z0-9_%.-]+/g, "$1<state>")
    .replace(/eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/g, "<jwt>")
    .replace(/at\.[A-Za-z0-9_-]+/g, "<access-token>")
    .replace(/(oauthState\\?":\\?")[A-Za-z0-9_-]{32}/g, "$1<state>")
    .replace(/[A-Za-z0-9_-]{128}/g, "<verifier>")
    .replace(/(code_challenge=)[A-Za-z0-9_-]+/g, "$1<challenge>")
    .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?(Z|[+-]\d\d:?\d\d)/g, "<time>")
    .replace(/"expiresAt":\d+/g, '"expiresAt":<ms>')
    .replace(/198\.18\.\d+\.\d+/g, "<address>")
    .replace(/\d{9,}/g, "<digits>")
    // syncAuthUser's collision attempt depends on the nicknames earlier runs left.
    .replace(/_\d<id3>/g, "_<n><id3>");
}

/** Everything the app keeps about one address. */
function rows(email) {
  const e = sqlText(email);
  return psql(`select json_build_object(
    'user', (select row_to_json(u) from public."user" u where u.email = ${e}),
    'account', (select json_agg(a order by a."createdAt") from public.account a join public."user" u on u.id = a."userId" where u.email = ${e}),
    'session', (select json_agg(json_build_object('ip', s."ipAddress", 'ua', s."userAgent", 'days', round(extract(epoch from s."expiresAt" - s."createdAt") / 86400)))
                from public.session s join public."user" u on u.id = s."userId" where u.email = ${e}),
    'auth_users', (select json_agg(json_build_object('email', au.email, 'confirmed', au.email_confirmed_at is not null,
        'nickname', replace(replace(au.raw_user_meta_data->>'nickname', substr(replace(au.id::text, '-', ''), 1, 6), '<id6>'), substr(replace(au.id::text, '-', ''), 1, 3), '<id3>')))
        from auth.users au where au.email = ${e}),
    'profiles', (select json_agg(json_build_object('nickname',
        replace(replace(p.nickname, substr(replace(p.id::text, '-', ''), 1, 6), '<id6>'), substr(replace(p.id::text, '-', ''), 1, 3), '<id3>'), 'role', p.role))
        from public.profiles p join auth.users au on au.id = p.id where au.email = ${e})
  )::text`);
}

const stateRow = (state) => psql(`select coalesce((select json_build_object('value', value, 'ttl_s', round(extract(epoch from "expiresAt" - "createdAt")))::text
  from public.verification where identifier = ${sqlText(`auth-state:${state}`)}), 'none')`);

function stateOf(response) {
  let state = null;
  try {
    state = new URL(JSON.parse(response.body.toString("utf8")).url).searchParams.get("state");
  } catch {}
  const line = (response.headers["set-cookie"] ?? [])[0] ?? "";
  return { state, cookie: line.split(";")[0] };
}

const google = (u, claims = {}, token = {}) => ({ body: {
  access_token: `ya29-${u}`, expires_in: 3599, scope: "openid https://www.googleapis.com/auth/userinfo.email", token_type: "Bearer",
  id_token: idToken({ sub: `g-${u}`, email: `${u}@example.com`, email_verified: true, name: "구글 사용자", picture: "https://p.example/a.png", ...claims }),
  ...token } });
const kakao = (u, account = {}, token = {}) => ({ body: {
  access_token: tokenFor({ body: { id: kakaoId(u), kakao_account: account } }), token_type: "bearer", refresh_token: `rt-${u}`,
  expires_in: 21599, refresh_token_expires_in: 5183999, scope: "account_email profile_nickname", ...token } });

/**
 * One sign-in per server, each on its own address: start, optional setup,
 * callback, replay. Compares every part between the two servers.
 */
async function flow(label, { provider, body = {}, token, query = "", before, email, cookie: cookieMode, extraCookie, status }) {
  const seen = {};
  for (const [name, base] of SERVERS) {
    const u = unique();
    const address = email ? email(u) : provider === "kakao" ? `${kakaoId(u)}@kakao.memecatch.internal` : `${u}@example.com`;
    if (before === "verified-user" || before === "unverified-user") {
      psql(`insert into public."user" (name, email, "emailVerified", "updatedAt") values (${sqlText(u)}, ${sqlText(address)}, ${before === "verified-user"}, now())`);
    }
    if (before === "signed-in") {
      const first = await send(base, start({ provider, callbackURL: CALLBACK }));
      const { state, cookie } = stateOf(first);
      await send(base, callback(`/callback/${provider}?code=${encodeURIComponent(codeFor(kakao(u)))}&state=${state}`, cookie));
    }
    const m = mask(u);
    const started = await send(base, start({ provider, callbackURL: CALLBACK, disableRedirect: true, ...body }));
    if (started.status !== 200) return fail(`${label}: start`, `${name} answered ${started.status}: ${started.body}`);
    const { state, cookie } = stateOf(started);
    const row = stateRow(state);
    if (before === "expired") psql(`update public.verification set value = jsonb_set(value::jsonb, '{expiresAt}', '1')::text where identifier = ${sqlText(`auth-state:${state}`)}`);
    if (before === "expired-row") psql(`update public.verification set value = jsonb_set(value::jsonb, '{expiresAt}', '1')::text, "expiresAt" = now() - interval '1 second' where identifier = ${sqlText(`auth-state:${state}`)}`);
    const sent = cookieMode === "none" ? "" : cookieMode === "forged" ? `${prefix}better-auth.state=${state}.${"A".repeat(43)}%3D` : cookie;
    const cookies = [sent, extraCookie].filter(Boolean).join("; ");
    const code = query.includes("code=") ? "" : `code=${encodeURIComponent(codeFor(token(u)))}&`;
    const path = `/callback/${provider}?${code}state=${state}${query}`;
    const tokenRequests = stubs[name].seen.length;
    const answer = await send(base, callback(path, cookies));
    const tokenRequest = stubs[name].seen.slice(tokenRequests).map((r) => ({ ...r, values: { ...r.values, code: "<code>", code_verifier: r.values.code_verifier?.length } }));
    const replay = await send(base, callback(path, cookies));
    seen[name] = {
      status: answer.status,
      start: describe(started, m),
      "state row": m(row),
      answer: describe(answer, m),
      replay: describe(replay, m),
      "state row after": m(stateRow(state)),
      rows: m(rows(address.toLowerCase())),
      mail: m(JSON.stringify(stubs[name].mail.filter((mail) => mail.to === address.toLowerCase()))),
      "provider saw": m(JSON.stringify(tokenRequest)),
    };
  }
  for (const part of Object.keys(seen.next)) {
    if (seen.next[part] !== seen.axum[part]) return fail(`${label}: ${part}`, `next:\n${seen.next[part]}\naxum:\n${seen.axum[part]}`);
  }
  if (status !== undefined && seen.next.status !== status) return fail(label, `both answered ${seen.next.status}, expected ${status}`);
  return pass(label, `${seen.next.status}`);
}

const compare = (label, request, options = {}) => compareAnswers(label, request, { ...options, mask: mask("\u0000") });

const sections = {
  async start() {
    for (const [label, body, status] of [
      ["google, disableRedirect", { provider: "google", callbackURL: CALLBACK, disableRedirect: true }, 200],
      ["kakao, redirect with Location", { provider: "kakao", callbackURL: "/" }, 200],
      ["every URL of the flow", { provider: "google", callbackURL: "/my?tab=saved", errorCallbackURL: "/login", newUserCallbackURL: "/welcome" }, 200],
      // The site origin, from the build (SITE_URL), and the configured ones.
      ["absolute trusted URLs", { provider: "kakao", callbackURL: `${SITE}/auth/callback?next=%2Fexplore%3Fsort%3Drecent`, errorCallbackURL: "http://localhost:3000/login" }, 200],
      ["the production origin, untrusted here", { provider: "kakao", callbackURL: "https://catchmeme.com/auth/callback" }, 403],
      ["a provider that is not set", { provider: "github", callbackURL: "/" }, 404],
      ["a provider of the wrong type", { provider: 7, callbackURL: "/" }, 400],
      ["no callbackURL", { provider: "google" }, 200],
    ]) {
      if (status === 200) {
        // Fresh states differ; the masked answers and rows must not.
        const seen = {};
        for (const [name, base] of SERVERS) {
          const response = await send(base, start(body));
          seen[name] = `${describe(response, mask("\u0000"))}\nrow: ${mask("\u0000")(stateRow(stateOf(response).state))}`;
        }
        if (seen.next === seen.axum) pass(`start: ${label}`, "200");
        else fail(`start: ${label}`, `next:\n${seen.next}\naxum:\n${seen.axum}`);
      } else {
        await compare(`start: ${label}`, start(body), { status });
      }
    }
    // Callback and error URLs better-auth refuses (403), each field.
    for (const url of ["https://evil.example/", "//evil.example/x", "/\\evil.example", "\\\\evil.example", "/%2F%2Fevil.example", "/%5Cevil.example",
      "https://catchmeme.com@evil.example/", "https://catchmeme.com.evil.example/", "javascript:alert(1)", "JavaScript://catchmeme.com/%0aalert(1)",
      "data:text/html,x", "http://catchmeme.com/", "/a\tb"]) {
      for (const field of ["callbackURL", "errorCallbackURL", "newUserCallbackURL"]) {
        const body = { provider: "google", callbackURL: "/", [field]: url };
        await compare(`start: ${field} ${JSON.stringify(url)}`, start(body), { status: 403 });
      }
    }
    await compare("start: a cookie from an untrusted origin", start({ provider: "google", callbackURL: "/" }, { cookie: "x=1", origin: "https://evil.example" }), { status: 403 });
    await compare("start: a cookie and no origin", start({ provider: "google", callbackURL: "/" }, { cookie: "x=1", origin: "" }), { status: 403 });
  },

  async callback() {
    await flow("google: a new verified user", { provider: "google", token: (u) => google(u), email: (u) => `${u}@example.com`, status: 302 });
    await flow("google: a new unverified user, the mail, newUserCallbackURL", { provider: "google", body: { newUserCallbackURL: "/welcome" },
      token: (u) => google(u, { email_verified: "false", name: null, picture: null }), email: (u) => `${u}@example.com`, status: 302 });
    await flow("google: an upper-case address", { provider: "google", token: (u) => google(u, { email: `${u.toUpperCase()}@Example.COM` }), email: (u) => `${u}@example.com`, status: 302 });
    await flow("kakao: no address, no nickname: the internal address and the fallback name", { provider: "kakao", token: (u) => kakao(u), status: 302 });
    await flow("kakao: a verified address and a nickname", { provider: "kakao", token: (u) => kakao(u, { email: `${u}@example.com`, is_email_verified: true, profile: { nickname: "카카오닉" } }),
      email: (u) => `${u}@example.com`, status: 302 });
    await flow("kakao: an unverified address", { provider: "kakao", token: (u) => kakao(u, { email: `${u}@example.com`, is_email_verified: false }), email: (u) => `${u}@example.com`, status: 302 });
    await flow("kakao: a dont_remember cookie", { provider: "kakao", token: (u) => kakao(u), status: 302,
      extraCookie: `${prefix}better-auth.dont_remember=${encodeURIComponent("true.")}` });
    await flow("kakao: no expiry, no refresh token, a scope list", { provider: "kakao", status: 302,
      token: (u) => kakao(u, {}, { expires_in: undefined, refresh_token: undefined, refresh_token_expires_in: undefined, scope: ["account_email", " profile_nickname "] }) });
    // Errors.
    await flow("the provider's error, to errorCallbackURL", { provider: "kakao", body: { errorCallbackURL: "/login?from=oauth" }, token: (u) => kakao(u),
      query: "&error=access_denied&error_description=User%20denied%20%26%20left", status: 302 });
    await flow("the provider's error without a description", { provider: "google", token: (u) => google(u), query: "&error=server_error", status: 302 });
    await flow("no code", { provider: "google", body: { errorCallbackURL: `${SITE}/login` }, token: (u) => google(u), query: "&code=", status: 302 });
    await flow("the token request refused (400)", { provider: "google", token: () => ({ status: 400, body: { error: "invalid_grant" } }), status: 302 });
    await flow("the token request failed (500)", { provider: "kakao", token: () => ({ status: 500, body: "oops", contentType: "text/plain" }), status: 302 });
    await flow("the token answer is not JSON", { provider: "google", token: () => ({ body: "access_token=x", contentType: "text/plain" }), status: 302 });
    await flow("the token answer is null", { provider: "google", token: () => ({ body: "null" }), status: 302 });
    await flow("the profile request refused (401)", { provider: "kakao", token: () => ({ body: { access_token: "unknown", token_type: "bearer" } }), status: 302 });
    await flow("the profile is not JSON", { provider: "kakao", token: (u) => kakao(u, {}, { access_token: tokenFor({ body: "<html>" }) }), status: 500 });
    await flow("the profile has no id", { provider: "kakao", token: (u) => kakao(u, {}, { access_token: tokenFor({ body: { kakao_account: {} } }) }), status: 302 });
    await flow("google: no id_token", { provider: "google", token: (u) => google(u, {}, { id_token: undefined }), status: 302 });
    await flow("google: an id_token that is not a JWT", { provider: "google", token: (u) => google(u, {}, { id_token: "a.b" }), status: 500 });
    await flow("google: no sub", { provider: "google", token: (u) => google(u, { sub: undefined }), status: 302 });
    await flow("google: no address", { provider: "google", token: (u) => google(u, { email: undefined }), status: 302 });
    await flow("google: a reserved domain", { provider: "google", token: (u) => google(u, { email: `${u}@kakao.memecatch.internal` }), email: (u) => `${u}@kakao.memecatch.internal`, status: 400 });
    await flow("kakao: a reserved domain that is not Kakao's", { provider: "kakao", token: (u) => kakao(u, { email: `${u}@wallet.memecatch.internal` }), email: (u) => `${u}@wallet.memecatch.internal`, status: 400 });
  },

  async state() {
    await flow("no state cookie", { provider: "google", body: { errorCallbackURL: "/login" }, token: (u) => google(u), cookie: "none", status: 302 });
    await flow("a forged state cookie", { provider: "google", body: { errorCallbackURL: "/login" }, token: (u) => google(u), cookie: "forged", status: 302 });
    await flow("an expired state", { provider: "kakao", body: { errorCallbackURL: "/login" }, token: (u) => kakao(u), before: "expired", status: 302 });
    // The row expired too: the read's cleanup deletes it, the cookie was kept.
    await flow("an expired state row, the cookie kept", { provider: "google", body: { errorCallbackURL: "/login" }, token: (u) => google(u), before: "expired-row", status: 302 });
    for (const [label, query] of [["no state", "?code=x"], ["an empty state", "?code=x&state="], ["an unknown state", "?code=x&state=unknownunknownunknownunknown00000"], ["nothing", ""]]) {
      await compare(`callback: ${label}`, callback(`/callback/google${query}`, ""), { status: 302 });
    }
  },

  async accounts() {
    await flow("google links a verified local user", { provider: "google", before: "verified-user", token: (u) => google(u), email: (u) => `${u}@example.com`, status: 302 });
    await flow("google: an unverified local user is not linked", { provider: "google", before: "unverified-user", token: (u) => google(u), email: (u) => `${u}@example.com`, status: 302 });
    await flow("google: an unverified provider address is not linked", { provider: "google", before: "verified-user",
      token: (u) => google(u, { email_verified: false }), email: (u) => `${u}@example.com`, status: 302 });
    await flow("kakao signs in again: tokens updated, a missing refresh token kept", { provider: "kakao", before: "signed-in",
      token: (u) => kakao(u, { is_email_verified: true }, { refresh_token: undefined, access_token: tokenFor({ body: { id: kakaoId(u), kakao_account: {} } }) }), status: 302 });
    await flow("kakao signs in again: a null refresh token is written", { provider: "kakao", before: "signed-in",
      token: (u) => kakao(u, {}, { refresh_token: null }), status: 302 });
  },

  async handed() {
    // Requests Axum leaves to Next: compared as they are answered.
    const plain = { provider: "google", callbackURL: "/" };
    for (const [label, request] of [
      ["start with an idToken", start({ ...plain, idToken: { token: "x" } })],
      ["start with scopes", start({ ...plain, scopes: ["x"] })],
      ["start with additionalData", start({ ...plain, additionalData: { a: 1 } })],
      ["start with a form body", { ...start(""), headers: { ...start("").headers, "content-type": "application/x-www-form-urlencoded" }, body: "provider=google&callbackURL=%2F" }],
      ["start with a query", { ...start(plain), path: "/api/auth/sign-in/social?x=1" }],
      ["start with RSC", start(plain, { rsc: "1" })],
      ["start that is not JSON", start("{")],
      ["a callback with RSC", callback("/callback/google?code=x&state=y", "", { rsc: "1" })],
      ["a callback with state twice", callback("/callback/google?code=x&state=a&state=b", "")],
      ["a form-post callback", { method: "POST", path: "/api/auth/callback/kakao", headers: { "content-type": "application/x-www-form-urlencoded", "x-forwarded-for": address() }, body: "code=x&state=y" }],
      ["a HEAD callback", { method: "HEAD", ...callback("/callback/google?code=x&state=y", "") }],
      ["another provider's callback", callback("/callback/github?code=x&state=y", "")],
    ]) {
      await compare(`handed to Next: ${label}`, request);
    }
  },

  async redirect() {
    // PLAN.md A3-12, a difference on purpose: a state row whose error URL
    // better-auth turns into a Location off the site. Next follows it;
    // Axum answers the default error page, also for a row it would leave to
    // Next ("x"). A HEAD callback, which Axum leaves to Next, must not.
    const fallback = `${ORIGIN}/api/auth/error?error=state_mismatch`;
    for (const [url, extra, nextLocation] of [
      ["/a/..//evil.example", {}, "//evil.example?error=state_mismatch"],
      ["/x/%2e%2e//evil.example", {}, "//evil.example?error=state_mismatch"],
      ["/a/..//evil.example", { x: 1 }, "//evil.example?error=state_mismatch"],
      ["/a/../login", {}, "/login?error=state_mismatch"],
    ]) {
      const label = `redirect: errorURL ${JSON.stringify(url)}${extra.x ? " in a row left to Next" : ""}`;
      const seen = {};
      for (const [name, base] of SERVERS) {
        const started = await send(base, start({ provider: "google", callbackURL: "/", errorCallbackURL: "/login" }));
        const { state } = stateOf(started);
        psql(`update public.verification set value = (jsonb_set(value::jsonb, '{errorURL}', to_jsonb(${sqlText(url)}::text)) || ${sqlText(JSON.stringify(extra))}::jsonb)::text
          where identifier = ${sqlText(`auth-state:${state}`)}`);
        const path = `/callback/google?code=x&state=${state}`;
        const head = await send(base, { method: "HEAD", ...callback(path, "") });
        const answer = await send(base, callback(path, ""));
        seen[name] = { location: answer.headers.location?.[0] ?? null, head: `${head.status} ${head.headers.location?.[0] ?? ""}`, row: stateRow(state) !== "none" };
      }
      const axumLocation = nextLocation.startsWith("//") ? fallback : nextLocation;
      if (seen.next.location !== nextLocation) fail(label, `next: ${seen.next.location}, expected ${nextLocation}`);
      else if (seen.axum.location !== axumLocation) fail(label, `axum: ${seen.axum.location}, expected ${axumLocation}`);
      else if (seen.axum.head !== seen.next.head || seen.axum.head.includes("evil")) fail(`${label}: HEAD`, `next: ${seen.next.head}, axum: ${seen.axum.head}`);
      else if (!seen.next.row || !seen.axum.row) fail(`${label}: row`, JSON.stringify(seen));
      else pass(label, `next ${seen.next.location}, axum ${seen.axum.location}, HEAD ${seen.axum.head}`);
    }
  },

  async unset() {
    // Neither server has KAKAO_CLIENT_ID: the start says so, and a state
    // started for Google is taken before the Kakao callback says so too.
    await compare("unset: kakao start", start({ provider: "kakao", callbackURL: "/" }), { status: 404 });
    const seen = {};
    for (const [name, base] of SERVERS) {
      const started = await send(base, start({ provider: "google", callbackURL: "/", errorCallbackURL: "/login" }));
      const { state, cookie } = stateOf(started);
      const answer = await send(base, callback(`/callback/kakao?code=x&state=${state}`, cookie));
      seen[name] = `${describe(answer, mask("\u0000"))}\nrow: ${stateRow(state)}`;
    }
    if (seen.next === seen.axum) pass("unset: the kakao callback of a google state", "302");
    else fail("unset: the kakao callback of a google state", `next:\n${seen.next}\naxum:\n${seen.axum}`);
  },
};

console.log(`run ${runId}, NODE_ENV ${production ? "production" : "development"}`);
await run(sections);
stubs.next.close();
stubs.axum.close();
