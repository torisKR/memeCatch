import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./collect-instagram-oembed-candidates.mjs", import.meta.url), "utf8");

assert.match(source, /html\.duckduckgo\.com\/html/);
assert.match(source, /link\.searchParams\.get\("uddg"\)/);
assert.match(source, /parseNativeSocialContent/);
assert.match(source, /instagram_oembed/);
assert.match(source, /site:instagram\.com\/reel/);
assert.match(source, /site:instagram\.com\/p/);
assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /stores returned embed HTML/);
assert.match(source, /requested a challenge; stopping without retrying/);
console.log("collect-instagram-oembed-candidates safeguards OK");

