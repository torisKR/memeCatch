#!/usr/bin/env node
/**
 * stdin JSON args → service-role RPC on DATABASE_URL → stdout JSON.
 * Bridge for non-Node tools (scripts/meme_embeddings.py) so they reuse the
 * app's role/identity setup instead of re-implementing it.
 *   echo '{"p_limit":1}' | node scripts/db-rpc.mjs list_meme_embedding_jobs
 */
import "./register-ts-paths.mjs";

const name = process.argv[2];
if (!name || !/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error("usage: db-rpc.mjs <function_name>");
let input = "";
for await (const chunk of process.stdin) input += chunk;
const { createAdminClient } = await import("../lib/db/admin.ts");
const { data, error } = await createAdminClient().rpc(name, input.trim() ? JSON.parse(input) : {});
if (error) {
  console.error(`rpc ${name} failed: ${error.message}`);
  process.exit(1);
}
process.stdout.write(JSON.stringify(data ?? null));
process.exit(0);
