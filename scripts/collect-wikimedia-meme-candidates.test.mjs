import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./collect-wikimedia-meme-candidates.mjs", import.meta.url), "utf8");

assert.match(source, /Category:Internet_memes_introduced_in_/);
assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /await sleep\(2_000\)/);
assert.match(source, /direct original source before publishing/);
console.log("collect-wikimedia-meme-candidates safeguards OK");
