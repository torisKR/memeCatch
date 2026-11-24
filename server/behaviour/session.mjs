// Makes one user with a session for the behaviour scenarios, as
// server/tests/common/session.rs does: the better-auth rows written with SQL,
// the auth.users row whose trigger makes the profile (what the app's sign-up
// leaves), and the cookie the server signs (HMAC-SHA256 of the token with
// BETTER_AUTH_SECRET). Run by lib.mjs:
//
//   DATABASE_URL=<test db> BETTER_AUTH_SECRET=<the server's secret> NODE_ENV=production \
//     node server/behaviour/session.mjs user|operator
//
// Prints one JSON line: { cookieName, cookieValue, userId, nickname, role }.
import { createHmac, randomUUID } from "node:crypto";
import pg from "pg";

if (!/@(127\.0\.0\.1|localhost):/.test(process.env.DATABASE_URL ?? "")) {
  console.error("refusing to run against a database that is not on localhost");
  process.exit(2);
}
const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
  console.error("BETTER_AUTH_SECRET is not set");
  process.exit(2);
}
const role = process.argv[2] === "operator" ? "operator" : "user";

const id = randomUUID().replace(/-/g, "");
const email = `axum-behaviour-${id}@example.com`;
// `ax` and twelve hex digits: the nickname of every test user on this database.
const nickname = `ax${id.slice(0, 12)}`;
// A session for seven days, as the server makes one.
const SESSION_SECONDS = 7 * 24 * 3600;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  const { rows: [user] } = await client.query(
    `insert into public."user" (name, email, "emailVerified") values ($1, $2, true) returning id::text`,
    [nickname, email],
  );
  // The profile comes from auth.users' trigger, as for a real sign-up.
  await client.query(
    `insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
     values ($1::uuid, $2, now(), jsonb_build_object('nickname', $3::text))`,
    [user.id, email, nickname],
  );
  // `profiles` is the service role's: as the server reaches it.
  await client.query("select set_config('app.db_role', 'service_role', true)");
  await client.query(`select set_config('request.jwt.claims', '{"role":"service_role","sub":null,"is_anonymous":"false"}', true)`);
  await client.query("set local role service_role");
  if (role === "operator") {
    await client.query("update profiles set role = 'operator' where id = $1", [user.id]);
  }
  const { rows: [profile] } = await client.query("select nickname from profiles where id = $1", [user.id]);
  await client.query("reset role");
  const { rows: [session] } = await client.query(
    `insert into public.session (token, "expiresAt", "updatedAt", "userId")
     values (replace(gen_random_uuid()::text, '-', ''), now() + make_interval(secs => $1), now(), $2::uuid)
     returning token`,
    [SESSION_SECONDS, user.id],
  );
  await client.query("commit");

  // better-call's signed cookie: `<token>.<base64 HMAC>`, URI-encoded.
  const signature = createHmac("sha256", secret).update(session.token).digest("base64");
  const cookieName = process.env.NODE_ENV === "production" ? "__Secure-better-auth.session_token" : "better-auth.session_token";
  process.stdout.write(
    `${JSON.stringify({
      cookieName,
      cookieValue: encodeURIComponent(`${session.token}.${signature}`),
      userId: user.id,
      nickname: profile?.nickname ?? nickname,
      role,
    })}\n`,
  );
} catch (error) {
  await client.query("rollback").catch(() => {});
  throw error;
} finally {
  await client.end();
}
