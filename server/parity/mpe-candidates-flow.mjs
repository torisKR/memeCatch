#!/usr/bin/env node
// Prints what the real generateCandidateMatches (lib/mpe/candidates.server.ts)
// would store for one candidate: it runs on the database as the operator,
// with the real lib/db planner, except that replace_mpe_candidate_matches,
// which fails as the route calls it, is caught and its p_matches printed.
// mpe-candidates.mjs compares that with the matches Axum logs when the same
// call fails for it. Reads and writes only the throwaway database.
//
//   DATABASE_URL=<test db> node --experimental-transform-types --import ./scripts/register-ts-paths.mjs \
//     server/parity/mpe-candidates-flow.mjs <operator user id> <candidate id>
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!/@(127\.0\.0\.1|localhost):/.test(process.env.DATABASE_URL ?? "")) {
  console.error("refusing to run against a database that is not on localhost");
  process.exit(2);
}
register("data:text/javascript," + encodeURIComponent(`
export async function resolve(specifier, context, next) {
  if (specifier === "next/headers") return { url: "data:text/javascript,export async function cookies(){return {get(){},getAll(){return []}}};export async function headers(){return new Headers()}", shortCircuit: true };
  return next(specifier, context);
}`));
console.log = console.info = console.warn = console.error;
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
const [userId, candidateId] = process.argv.slice(2);
const { createPlanClient } = await import(path.join(ROOT, "lib/db/plan.ts"));
const { executePlan } = await import(path.join(ROOT, "lib/db/execute.ts"));
const { createAdminClient } = await import(path.join(ROOT, "lib/db/admin.ts"));
const { generateCandidateMatches } = await import(path.join(ROOT, "lib/mpe/candidates.server.ts"));

const identity = { userId, role: "authenticated", anonymous: false };
const database = createPlanClient((plan, signal) => executePlan(plan, identity, signal));
let captured = null;
const client = {
  from: database.from.bind(database),
  rpc(name, args) {
    if (name === "replace_mpe_candidate_matches") {
      captured = args.p_matches;
      return Promise.resolve({ data: [], error: null });
    }
    return database.rpc(name, args);
  },
  auth: { getUser: async () => ({ data: { user: { id: userId } }, error: null }) },
};
await generateCandidateMatches(candidateId, client, createAdminClient());
process.stdout.write(`${JSON.stringify(captured)}\n`);
process.exit(0);
