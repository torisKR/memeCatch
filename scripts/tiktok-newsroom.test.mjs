import { strict as assert } from "node:assert";

const moduleUrl = new URL("./tiktok-newsroom.mjs", import.meta.url);
const newsroom = await import(moduleUrl).catch(() => null);

assert.ok(newsroom?.tiktokVideoUrlsFromNewsroomHtml, "TikTok Newsroom URL extractor must be exported");

const html = String.raw`
  <blockquote cite="https://www.tiktok.com/@creator.one/video/6717471303055559937"></blockquote>
  <a href="https:\/\/www.tiktok.com\/@creator.two\/video\/6700455348173622529">video</a>
  <a href="https://www.tiktok.com/@creator.one/video/6717471303055559937?lang=ko-KR">duplicate</a>
  <a href="https://example.com/@creator/video/1234567890123456789">not TikTok</a>
`;

assert.deepEqual(newsroom.tiktokVideoUrlsFromNewsroomHtml(html), [
  "https://www.tiktok.com/@creator.one/video/6717471303055559937",
  "https://www.tiktok.com/@creator.two/video/6700455348173622529",
]);

assert.ok(newsroom.officialTikTokNewsroomUrl, "official Newsroom URL validator must be exported");
assert.equal(
  newsroom.officialTikTokNewsroomUrl("https://newsroom.tiktok.com/2019-tiktok-top-100?lang=ko-KR"),
  "https://newsroom.tiktok.com/2019-tiktok-top-100?lang=ko-KR",
);
assert.equal(newsroom.officialTikTokNewsroomUrl("https://newsroom.tiktok.com.evil.example/post"), null);
assert.equal(newsroom.officialTikTokNewsroomUrl("http://newsroom.tiktok.com/post"), null);

assert.ok(newsroom.originYearFromNewsroomHtml, "Newsroom origin-year parser must be exported");
assert.equal(newsroom.originYearFromNewsroomHtml(`
  <script type="application/ld+json">{"datePublished":"2020-01-02T00:00:00Z"}</script>
  <h1>TikTok 2019 Top 100</h1>
`), 2019);

assert.ok(newsroom.collectTikTokNewsroomCandidates, "Newsroom candidate collector must be exported");
const articleUrl = "https://newsroom.tiktok.com/2019-tiktok-top-100?lang=ko-KR";
const articleHtml = `
  <title>TikTok 2019 Top 100</title>
  <blockquote cite="https://www.tiktok.com/@creator.one/video/6717471303055559937"></blockquote>
  <blockquote cite="https://www.tiktok.com/@creator.two/video/6700455348173622529"></blockquote>
`;
const requested = [];
const fakeFetch = async (input) => {
  const url = String(input);
  requested.push(url);
  if (url === articleUrl) {
    return new Response(articleHtml, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const sourceUrl = new URL(url).searchParams.get("url");
  const contentId = sourceUrl?.match(/\/video\/(\d+)/)?.[1];
  return Response.json({
    provider_name: "TikTok",
    title: contentId === "6717471303055559937" ? "할머니의 마음 #comedy" : "귀신이다 #meme",
    author_name: contentId === "6717471303055559937" ? "한국오빠종민" : "Creator Two",
    html: `<blockquote cite="${sourceUrl}"></blockquote>`,
  });
};

const collection = await newsroom.collectTikTokNewsroomCandidates(articleUrl, { fetchImpl: fakeFetch });
assert.equal(collection.candidates.length, 2);
assert.deepEqual(collection.errors, []);
assert.equal(collection.candidates[0].meme_title, "할머니의 마음 #comedy");
assert.equal(collection.candidates[0].origin_year, 2019);
assert.equal(collection.candidates[0].source_platform, "TikTok");
assert.equal(collection.candidates[0].editorial_source_url, articleUrl);
assert.equal(collection.candidates[0].editorial_signal, "official_tiktok_newsroom");
assert.equal(collection.candidates[0].catalog_match_status, "unmapped");
assert.equal(collection.candidates[0].review_status, "needs_human_source_match");
assert.equal(requested.length, 3);

await assert.rejects(
  () => newsroom.collectTikTokNewsroomCandidates("https://example.com/tiktok", { fetchImpl: fakeFetch }),
  /official TikTok Newsroom URL/i,
);

console.log("TikTok Newsroom URL extraction OK");
