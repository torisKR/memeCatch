import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";

const scriptUrl = new URL("./collect-public-article-social-candidates.mjs", import.meta.url);
assert.ok(existsSync(scriptUrl), "public article social collector CLI must exist");

const source = readFileSync(scriptUrl, "utf8");
assert.match(source, /collectPublicArticleSocialCandidates/);
assert.match(source, /officialHttpsArticleUrl/);
assert.match(source, /never published to Supabase/i);
assert.match(source, /login or challenge/);
assert.doesNotMatch(source, /TIKTOK_CLIENT_(?:KEY|SECRET)|INSTAGRAM_ACCESS_TOKEN/);
// Post URLs must go through seed oEmbed — this CLI is article-only.
assert.match(source, /not TikTok\/Instagram/);

console.log("collect-public-article-social-candidates safeguards OK");
