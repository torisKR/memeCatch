// Mints a real session cookie with the app's own better-auth configuration
// (lib/auth/server.ts), for tests/auth_real_cookie.rs. Nothing here signs or
// formats a cookie: sign-up, sign-in and the Set-Cookie header all come from
// better-auth, and `getSession` is asked which user the cookie belongs to.
//
// Run from the repository root:
//
//   DATABASE_URL=<test db> BETTER_AUTH_SECRET=<throwaway> [NODE_ENV=production] \
//     node --import ./scripts/register-ts-paths.mjs server/tests/better_auth_cookie.mjs
//
// NODE_ENV=production makes the app set `useSecureCookies`, so the cookie is
// named `__Secure-better-auth.session_token`. Prints one JSON line on stdout:
// { cookie, cookieName, userId, email }.
import { randomUUID } from "node:crypto";
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { getPool } from "@/lib/db/pool";

// The app logs undelivered verification mail with console.info. Keep stdout
// for the result line.
console.log = console.info = console.warn = console.error;

if (!/@(127\.0\.0\.1|localhost):/.test(process.env.DATABASE_URL ?? "")) {
  console.error("refusing to run against a database that is not on localhost");
  process.exit(2);
}

const id = randomUUID().replace(/-/g, "");
const email = `axum-auth-${id}@example.com`;
const password = `pw-${randomUUID()}`;

await ensureAuthSchema();
const auth = getAuth();
const signedUp = await auth.api.signUpEmail({
  body: { email, password, name: `ax${id.slice(0, 12)}` },
});
// The app requires a verified address before sign-in. The test has no inbox.
await getPool().query('UPDATE "user" SET "emailVerified" = true WHERE id = $1', [signedUp.user.id]);

const signedIn = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
const cookie = signedIn.headers
  .getSetCookie()
  .map((line) => line.split(";")[0])
  .find((pair) => pair.includes("session_token="));
if (!cookie) throw new Error("sign-in set no session_token cookie");

const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
if (!session?.user) throw new Error("better-auth does not accept its own cookie");

await getPool().end();
process.stdout.write(
  `${JSON.stringify({
    cookie,
    cookieName: cookie.slice(0, cookie.indexOf("=")),
    userId: session.user.id,
    email: session.user.email,
  })}\n`,
);
