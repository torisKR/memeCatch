// Sessions of the app's own better-auth for the parity scripts that call the
// operator endpoints (admin-actions.mjs, indexnow.mjs): behaviour/session.mjs
// in a production Node, one account per call.
import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");

export function mintSession(role) {
  const result = spawnSync(
    process.execPath,
    ["--import", resolve(root, "scripts/register-ts-paths.mjs"), resolve(here, "behaviour/session.mjs"), role],
    { cwd: root, encoding: "utf8", env: { ...process.env, NODE_ENV: "production" } },
  );
  if (result.status !== 0) throw new Error(`session.mjs failed: ${result.stderr.slice(-600)}`);
  return JSON.parse(result.stdout.trim().split("\n").pop());
}

/** The `cookie` header of a session from `mintSession`, or null. */
export const cookieOf = (session) => (session ? `${session.cookieName}=${session.cookieValue}` : null);
