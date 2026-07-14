import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./pending-records-to-sql.mjs", import.meta.url), "utf8");

assert.match(source, /'pending'::moderation_status/);
assert.match(source, /'Wikimedia reference'/);
assert.match(source, /original upload still needs verification/);
assert.match(source, /where not exists \(/);
assert.doesNotMatch(source, /'approved'::moderation_status|'limited'::moderation_status/);
assert.doesNotMatch(source, /insert into meme_contents/i);
console.log("pending-records-to-sql safeguards OK");
