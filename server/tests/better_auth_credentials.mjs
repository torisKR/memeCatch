// One step of an email-password flow through the app's own better-auth
// (lib/auth/server.ts), for tests/auth_credentials_cross.rs:
//
//   DATABASE_URL=<test db> BETTER_AUTH_SECRET=<throwaway> NODE_ENV=<mode> AUTH_EMAIL_WEBHOOK=<stub> \
//     node --import ./scripts/register-ts-paths.mjs server/tests/better_auth_credentials.mjs <step> <args...>
//
//   sign-up <email> <password> <name>   auth.api.signUpEmail
//   sign-in <email> <password>          auth.api.signInEmail
//   verify <token>                      auth.api.verifyEmail
//   request-reset <email>               auth.api.requestPasswordReset
//   reset <token> <password>            auth.api.resetPassword
//   get-session <cookie>                auth.api.getSession
//
// Prints one JSON line: { status, body, setCookie } for an answer, or
// { status, code } for a refusal.
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { getPool } from "@/lib/db/pool";

console.log = console.info = console.warn = console.error;

if (!/@(127\.0\.0\.1|localhost):/.test(process.env.DATABASE_URL ?? "")) {
  console.error("refusing to run against a database that is not on localhost");
  process.exit(2);
}
const [step, ...args] = process.argv.slice(2);
// A browser's request: from the site, with a client address.
const headers = (extra = {}) => new Headers({ origin: "http://localhost:3000", "x-forwarded-for": "198.51.100.77", ...extra });
const steps = {
  "sign-up": (auth, [email, password, name]) => auth.api.signUpEmail({ body: { email, password, name }, headers: headers(), returnHeaders: true }),
  "sign-in": (auth, [email, password]) => auth.api.signInEmail({ body: { email, password }, headers: headers(), returnHeaders: true }),
  verify: (auth, [token]) => auth.api.verifyEmail({ query: { token }, headers: headers(), returnHeaders: true }),
  "request-reset": (auth, [email]) => auth.api.requestPasswordReset({ body: { email, redirectTo: "/reset-password" }, headers: headers(), returnHeaders: true }),
  reset: (auth, [token, newPassword]) => auth.api.resetPassword({ body: { token, newPassword }, headers: headers(), returnHeaders: true }),
  "get-session": (auth, [cookie]) => auth.api.getSession({ headers: headers({ cookie }), returnHeaders: true }),
};
const call = steps[step];
if (!call) {
  console.error(`usage: better_auth_credentials.mjs ${Object.keys(steps).join("|")} <args...>`);
  process.exit(2);
}

await ensureAuthSchema();
let out;
try {
  const result = await call(getAuth(), args);
  out = { status: 200, body: result.response ?? null, setCookie: result.headers.getSetCookie() };
} catch (error) {
  if (typeof error?.statusCode !== "number") throw error;
  out = { status: error.statusCode, code: error.body?.code ?? null };
}
await getPool().end();
process.stdout.write(`${JSON.stringify(out)}\n`);
