import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./collect-tiktok-public-search-candidates.mjs", import.meta.url), "utf8");

assert.match(source, /html\.duckduckgo\.com\/html/);
assert.match(source, /link\.searchParams\.get\("uddg"\)/);
assert.match(source, /parseNativeSocialContent/);
assert.match(source, /https:\/\/www\.tiktok\.com\/oembed/);
assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /requested a challenge; stopping without retrying/);
assert.match(source, /does not|without logging into TikTok/);
console.log("collect-tiktok-public-search-candidates safeguards OK");
