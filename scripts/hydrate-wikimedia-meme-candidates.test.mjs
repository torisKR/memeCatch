import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(
  new URL("./hydrate-wikimedia-meme-candidates.mjs", import.meta.url),
  "utf8"
);

assert.match(source, /review_status: "pending"/);
assert.match(source, /Pending editorial review/);
assert.match(source, /startsWith\("wikimedia-"\)/);
assert.match(source, /const BATCH_SIZE = 20/);
assert.match(source, /setTimeout\(done, 1_000\)/);
assert.doesNotMatch(source, /createClient|SUPABASE_SERVICE_ROLE_KEY|meme_contents|meme_sources/);
console.log("hydrate-wikimedia-meme-candidates safeguards OK");
