import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";

const scriptUrl = new URL("./collect-secondary-social-candidates.mjs", import.meta.url);
assert.ok(existsSync(scriptUrl), "secondary social collector must exist");

const source = readFileSync(scriptUrl, "utf8");
assert.match(source, /secondary_public_article|collection_path/);
assert.match(source, /namu_individual_page|know_your_meme/);
assert.match(source, /skippedDup|skipped_duplicates|exclude/);
assert.match(source, /collectPublicArticleSocialCandidates/);
assert.match(source, /never used|Login, challenge bypass/i);
assert.doesNotMatch(source, /html\.duckduckgo\.com|TIKTOK_CLIENT_/);

console.log("collect-secondary-social-candidates safeguards OK");
