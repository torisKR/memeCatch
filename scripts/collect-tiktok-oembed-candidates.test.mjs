import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./collect-tiktok-oembed-candidates.mjs", import.meta.url), "utf8");

assert.match(source, /parseNativeSocialContent/);
assert.match(source, /source\.platform !== "TikTok"/);
assert.match(source, /https:\/\/www\.tiktok\.com\/oembed/);
assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /does not use the TikTok Display API/);
console.log("collect-tiktok-oembed-candidates safeguards OK");
