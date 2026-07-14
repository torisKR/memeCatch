import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./enrich-youtube-oembed-candidates.mjs", import.meta.url), "utf8");

assert.match(source, /https:\/\/www\.youtube\.com\/oembed/);
assert.match(source, /source\.isShort/);
assert.match(source, /row\.review_priority !== priority/);
assert.match(source, /oembed_author_name/);
assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /uses no API key, account login, video download, or Supabase write/);
assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|process\.env|data\.html/);

console.log("YouTube oEmbed candidate enrichment safeguards OK");
