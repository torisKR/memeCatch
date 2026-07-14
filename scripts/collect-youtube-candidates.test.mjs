import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./collect-youtube-candidates.mjs", import.meta.url), "utf8");

assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /origin_year: meme\.year/);
assert.match(source, /https:\/\/www\.youtube\.com\/watch\?v=\$\{video\.videoId\}/);
console.log("collect-youtube-candidates safeguards OK");
