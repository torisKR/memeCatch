import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./official-social-promotions-to-sql.mjs", import.meta.url), "utf8");

assert.match(source, /rights_holder_confirmed !== true/);
assert.match(source, /promotion_status !== "approved"/);
assert.match(source, /source\.isShort/);
assert.match(source, /moderation_status in \('approved', 'limited'\)/);
assert.match(source, /is_representative, availability, moderation_status/);
assert.match(source, /false, 'live', 'approved'/);
assert.match(source, /where not exists/);
assert.match(source, /copyright_status/);

console.log("official social promotion SQL safeguards OK");
