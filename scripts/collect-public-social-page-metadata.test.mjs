import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./collect-public-social-page-metadata.mjs", import.meta.url), "utf8");

assert.match(source, /parseNativeSocialContent/);
assert.match(source, /\["TikTok", "Instagram"\]/);
assert.match(source, /MAX_HTML_BYTES = 1_000_000/);
assert.match(source, /embed\/captioned/);
assert.match(source, /instagramEmbedMetadataFromHtml/);
assert.match(source, /requested login or a challenge; stopping without bypass/);
assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /public_page_thumbnail_available/);
assert.doesNotMatch(source, /public_page_thumbnail_url/);
assert.match(source, /never publishes candidates to Supabase/);
assert.doesNotMatch(source, /process\.env/);

console.log("public social page collector safeguards OK");
