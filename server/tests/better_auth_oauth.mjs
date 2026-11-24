// One step of a Google or Kakao sign-in through the app's own better-auth
// (lib/auth/server.ts), as HTTP requests to its handler, for
// tests/auth_oauth_cross.rs:
//
//   DATABASE_URL=<test db> BETTER_AUTH_SECRET=<throwaway> BETTER_AUTH_URL=<base> NODE_ENV=<mode> \
//   GOOGLE_CLIENT_ID=… GOOGLE_CLIENT_SECRET=… KAKAO_CLIENT_ID=… KAKAO_CLIENT_SECRET=… \
//   OAUTH_STUB_ORIGIN=<stub> AUTH_EMAIL_WEBHOOK=<stub> \
//     node --import ./scripts/register-ts-paths.mjs --import ./server/tests/oauth_fetch_stub.mjs \
//       server/tests/better_auth_oauth.mjs <step> <args...>
//
//   start <body JSON> [cookie]          POST /api/auth/sign-in/social
//   callback <path and query> [cookie]  GET  /api/auth/callback/…
//   get-session <cookie>                GET  /api/auth/get-session
//
// Prints one JSON line: { status, location, setCookie, body }.
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { getPool } from "@/lib/db/pool";

console.log = console.info = console.warn = console.error;

if (!/@(127\.0\.0\.1|localhost):/.test(process.env.DATABASE_URL ?? "")) {
  console.error("refusing to run against a database that is not on localhost");
  process.exit(2);
}
const base = `${process.env.BETTER_AUTH_URL}/api/auth`;
const [step, first, cookie] = process.argv.slice(2);
// A browser's request: from the site, with a client address.
const headers = (extra) => {
  const all = new Headers({ origin: new URL(base).origin, "x-forwarded-for": "198.51.100.78", "user-agent": "a3-cross" });
  for (const [name, value] of Object.entries(extra)) if (value) all.set(name, value);
  return all;
};
const requests = {
  start: () => new Request(`${base}/sign-in/social`, { method: "POST", headers: headers({ "content-type": "application/json", cookie }), body: first }),
  callback: () => new Request(`${base}${first}`, { headers: headers({ cookie }) }),
  "get-session": () => new Request(`${base}/get-session`, { headers: headers({ cookie: first }) }),
};
if (!requests[step]) {
  console.error(`usage: better_auth_oauth.mjs ${Object.keys(requests).join("|")} <args...>`);
  process.exit(2);
}

await ensureAuthSchema();
const response = await getAuth().handler(requests[step]());
const text = await response.text();
let body = text;
try {
  body = JSON.parse(text);
} catch {}
await getPool().end();
process.stdout.write(`${JSON.stringify({
  status: response.status,
  location: response.headers.get("location"),
  setCookie: response.headers.getSetCookie(),
  body,
})}\n`);
