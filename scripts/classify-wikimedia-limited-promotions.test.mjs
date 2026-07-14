import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./classify-wikimedia-limited-promotions.mjs", import.meta.url), "utf8");

assert.match(source, /EXCLUDED_DUPLICATE_TITLE = "Mundial Ronaldinho Soccer 64"/);
assert.match(source, /target_status: "limited"/);
assert.match(source, /DANGEROUS/);
assert.match(source, /ADULT/);
assert.match(source, /HATE/);
assert.match(source, /safetyLevel = dangerous \|\| adult \|\| hate \? "red" : "yellow"/);
assert.match(source, /original source and precise year still require editorial review/);
assert.match(source, /selected\.length !== expected/);

console.log("Wikimedia limited promotion classifier safeguards OK");
