import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./limited-promotions-to-sql.mjs", import.meta.url), "utf8");

assert.match(source, /rows\.length !== expected/);
assert.match(source, /target_status !== "limited"/);
assert.match(source, /limited promotion preflight expected/);
assert.match(source, /moderation_status = 'fact_checking'/);
assert.match(source, /moderation_status = 'rights_checking'/);
assert.match(source, /moderation_status = 'limited'/);
assert.match(source, /get diagnostics affected = row_count/);
assert.match(source, /begin;/);
assert.match(source, /commit;/);

console.log("limited promotion SQL safeguards OK");
