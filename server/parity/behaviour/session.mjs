// Makes one user with a session for the behaviour gate, with the app's own
// better-auth configuration: sign-up, sign-in and the cookie all come from
// better-auth, as in server/tests/better_auth_cookie.mjs. Run by lib.mjs:
//
//   DATABASE_URL=<test db> BETTER_AUTH_SECRET=<the servers' secret> NODE_ENV=production \
//     node --import ./scripts/register-ts-paths.mjs server/parity/behaviour/session.mjs user|operator
//
// Prints one JSON line: { cookieName, cookieValue, userId, nickname, role }.
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
const role = process.argv[2] === "operator" ? "operator" : "user";

const id = randomUUID().replace(/-/g, "");
const email = `axum-behaviour-${id}@example.com`;
const password = `pw-${randomUUID()}`;
// `ax` and twelve hex digits: the nickname of every test user on this database.
const nickname = `ax${id.slice(0, 12)}`;

await ensureAuthSchema();
const auth = getAuth();
const signedUp = await auth.api.signUpEmail({ body: { email, password, name: nickname } });
// The app requires a verified address before sign-in. The test has no inbox.
await getPool().query('UPDATE "user" SET "emailVerified" = true WHERE id = $1', [signedUp.user.id]);

// `profiles` is not the login role's to touch: the app reaches it as
// service_role inside a transaction (lib/db/pool.ts), and so does this.
async function asServiceRole(sql, params) {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    // The settings withIdentity makes for SERVICE: triggers read them.
    await client.query("select set_config('app.db_role', 'service_role', true)");
    await client.query(`select set_config('request.jwt.claims', '{"role":"service_role","sub":null,"is_anonymous":"false"}', true)`);
    await client.query("set local role service_role");
    const result = await client.query(sql, params);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
if (role === "operator") {
  await asServiceRole("UPDATE profiles SET role = 'operator' WHERE id = $1", [signedUp.user.id]);
}

const signedIn = await auth.api.signInEmail({ body: { email, password }, returnHeaders: true });
const cookie = signedIn.headers
  .getSetCookie()
  .map((line) => line.split(";")[0])
  .find((pair) => pair.includes("session_token="));
if (!cookie) throw new Error("sign-in set no session_token cookie");
const profile = await asServiceRole("SELECT nickname FROM profiles WHERE id = $1", [signedUp.user.id]);

await getPool().end();
const separator = cookie.indexOf("=");
process.stdout.write(
  `${JSON.stringify({
    cookieName: cookie.slice(0, separator),
    cookieValue: cookie.slice(separator + 1),
    userId: signedUp.user.id,
    nickname: profile.rows[0]?.nickname ?? nickname,
    role,
  })}\n`,
);
