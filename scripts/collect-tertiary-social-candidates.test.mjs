import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";

const scriptUrl = new URL("./collect-tertiary-social-candidates.mjs", import.meta.url);
assert.ok(existsSync(scriptUrl));
const source = readFileSync(scriptUrl, "utf8");
assert.match(source, /bing\.com\/search/);
assert.match(source, /reddit\.com\/r\//);
assert.match(source, /tertiary_/);
assert.match(source, /oEmbed|oembed/);
assert.doesNotMatch(source, /html\.duckduckgo\.com|challenge bypass|TIKTOK_CLIENT_/);
assert.match(source, /exclude|Dedup|dedup/i);
console.log("collect-tertiary-social-candidates safeguards OK");
