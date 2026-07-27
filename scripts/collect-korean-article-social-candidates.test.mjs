import { strict as assert } from "node:assert";
import { existsSync, readFileSync } from "node:fs";
import { instagramPublicPageFallback } from "./collect-korean-article-social-candidates.mjs";

const scriptUrl = new URL("./collect-korean-article-social-candidates.mjs", import.meta.url);
assert.ok(existsSync(scriptUrl), "korean article social collector must exist");

const source = readFileSync(scriptUrl, "utf8");
assert.match(source, /korean_article_embedded/);
assert.match(source, /namu_individual_page|ko_wikipedia/);
assert.match(source, /--exclude/);
assert.match(source, /skippedDup|skipped_duplicates|exclude/);
assert.match(source, /collectPublicArticleSocialCandidates/);
assert.match(source, /parseNativeSocialContent/);
assert.match(source, /needs_thumb_backfill/);
assert.match(source, /never used|Login, challenge bypass/i);
assert.doesNotMatch(source, /html\.duckduckgo\.com|TIKTOK_CLIENT_/);
assert.doesNotMatch(source, /INSTAGRAM_ACCESS_TOKEN/);

// Behavioral: fallback extracts public embed-page metadata (metadata-first,
// even when the HTML also contains login-wall markup that false-positives
// the challenge heuristic).
const captionedEmbedHtml = `
  <html><body>
    <div>login required</div>
    <img class="EmbeddedMediaImage" src="https://instagram.example/thumb.jpg" />
    <a class="CaptionUsername">meme_author</a>
    <div class="Caption"><a class="CaptionUsername">meme_author</a> 밈 캡션 텍스트</div>
  </body></html>`;
const fallbackHit = await instagramPublicPageFallback("https://www.instagram.com/p/TESTPOST/", {
  fetchImpl: async () =>
    new Response(captionedEmbedHtml, { headers: { "content-type": "text/html" } }),
});
assert.ok(fallbackHit, "fallback must extract metadata from a captioned embed page");
assert.equal(fallbackHit.thumbnail_url, "https://instagram.example/thumb.jpg");
assert.equal(fallbackHit.author_name, "meme_author");
assert.match(fallbackHit.title ?? "", /밈 캡션/);

// Behavioral: a wall page with no public metadata yields null (skip, no bypass).
const wallHtml = "<html><body><form>log in to continue</form></body></html>";
const fallbackMiss = await instagramPublicPageFallback("https://www.instagram.com/p/TESTPOST/", {
  fetchImpl: async () => new Response(wallHtml, { headers: { "content-type": "text/html" } }),
});
assert.equal(fallbackMiss, null, "fallback must return null when no public metadata exists");

// Behavioral: non-HTML and non-OK responses yield null.
assert.equal(
  await instagramPublicPageFallback("https://www.instagram.com/p/TESTPOST/", {
    fetchImpl: async () => new Response("{}", { headers: { "content-type": "application/json" } }),
  }),
  null,
);
assert.equal(
  await instagramPublicPageFallback("https://www.instagram.com/p/TESTPOST/", {
    fetchImpl: async () => new Response("nope", { status: 403, headers: { "content-type": "text/html" } }),
  }),
  null,
);

console.log("collect-korean-article-social-candidates safeguards OK");
