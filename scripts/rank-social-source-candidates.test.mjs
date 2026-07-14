import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./rank-social-source-candidates.mjs", import.meta.url), "utf8");

assert.match(source, /review_status: "needs_human_source_match"/);
assert.match(source, /source_match_score/);
assert.match(source, /public embed\/page metadata verified/);
assert.match(source, /public_page_title/);
assert.match(source, /public_page_author_name/);
assert.match(source, /metadataWeight > previousWeight/);
assert.match(source, /tiktok-newsroom/);
assert.match(source, /official_tiktok_newsroom/);
assert.match(source, /catalog_match_status === "unmapped"/);
assert.match(source, /candidate is not mapped to a CatchMeme record/);
assert.match(source, /derivative-content hint/);
assert.match(source, /short generic title needs manual context review/);
assert.doesNotMatch(source, /meme_contents|meme_sources|SUPABASE_SERVICE_ROLE_KEY/);
console.log("rank-social-source-candidates safeguards OK");
