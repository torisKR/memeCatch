// Asks the app's own better-auth (lib/auth/server.ts) about a session cookie,
// for tests/auth_session_cross.rs: `get` is `auth.api.getSession`, `sign-out`
// is `auth.api.signOut`. Outside a request scope `nextCookies` steps aside
// (dist/integrations/next-js.mjs:49-54), as it does for an HTTP request.
//
//   DATABASE_URL=<test db> BETTER_AUTH_SECRET=<throwaway> NODE_ENV=<mode> \
//     node --import ./scripts/register-ts-paths.mjs server/tests/better_auth_session.mjs \
//     get|sign-out <name=value cookie> [expires-in-ms]
//
// expires-in-ms sets the session's `expiresAt` to Date.now() + EXPIRES_IN_MS
// right before the call, so that a boundary a second away is not crossed
// while Node starts. Otherwise the row is left to better-auth.
//
// Prints one JSON line: { body, setCookie } — what better-auth returned
// (`null` for no session) and the Set-Cookie lines it sent.
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { getPool } from "@/lib/db/pool";

console.log = console.info = console.warn = console.error;

if (!/@(127\.0\.0\.1|localhost):/.test(process.env.DATABASE_URL ?? "")) {
  console.error("refusing to run against a database that is not on localhost");
  process.exit(2);
}
const calls = {
  get: (auth, headers) => auth.api.getSession({ headers, returnHeaders: true }),
  "sign-out": (auth, headers) => auth.api.signOut({ headers, returnHeaders: true }),
};
const [action, cookie = "", expiresInMs] = process.argv.slice(2);
const call = calls[action];
if (!call) {
  console.error("usage: better_auth_session.mjs get|sign-out <cookie> [expires-in-ms]");
  process.exit(2);
}

await ensureAuthSchema();
if (expiresInMs !== undefined) {
  const value = decodeURIComponent(cookie.slice(cookie.indexOf("=") + 1));
  const token = value.slice(0, value.lastIndexOf("."));
  const at = new Date(Date.now() + Number(expiresInMs));
  await getPool().query('UPDATE "session" SET "expiresAt" = $1 WHERE token = $2', [at, token]);
}
const result = await call(getAuth(), new Headers({ cookie }));
await getPool().end();
process.stdout.write(
  `${JSON.stringify({ body: result.response ?? null, setCookie: result.headers.getSetCookie() })}\n`,
);
