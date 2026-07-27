import { strict as assert } from "node:assert";
import {
  collectPublicArticleSocialCandidates,
  matchCatalogMeme,
  officialHttpsArticleUrl,
  originYearFromArticleHtml,
  socialPostUrlsFromHtml,
  verifySocialSeedOEmbed,
} from "./public-article-social.mjs";

const html = `
  <title>2024 Korean meme roundup</title>
  <a href="https://www.tiktok.com/@creator.one/video/6717471303055559937">tt</a>
  <a href="https:\\/\\/www.tiktok.com\\/@creator.two\\/video\\/6700455348173622529">escaped</a>
  <a href="https://www.instagram.com/reel/DGYAH_wviX0/">ig reel</a>
  <a href="https://www.instagram.com/p/DX9CWS-BP2o/?utm_source=ig">ig post</a>
  <a href="https://www.tiktok.com/@creator.one/video/6717471303055559937?lang=ko">dup</a>
  <a href="https://www.instagram.com/korean_meme_and_slang/">profile ignored</a>
  <a href="https://www.tiktok.com/discover/한국밈">discover ignored</a>
  <a href="https://vm.tiktok.com/ZM12345/">short ignored</a>
`;

const posts = socialPostUrlsFromHtml(html);
assert.equal(posts.length, 4);
assert.deepEqual(
  posts.map((post) => [post.platform, post.contentId]),
  [
    ["TikTok", "6717471303055559937"],
    ["TikTok", "6700455348173622529"],
    ["Instagram", "DGYAH_wviX0"],
    ["Instagram", "DX9CWS-BP2o"],
  ],
);

assert.equal(
  officialHttpsArticleUrl("https://www.knowyourmeme.com/memes/example"),
  "https://www.knowyourmeme.com/memes/example",
);
assert.equal(officialHttpsArticleUrl("https://www.tiktok.com/@x/video/1234567890123456789"), null);
assert.equal(officialHttpsArticleUrl("https://www.instagram.com/reel/DGYAH_wviX0/"), null);
assert.equal(officialHttpsArticleUrl("http://example.com/article"), null);

assert.equal(originYearFromArticleHtml(html), 2024);
assert.equal(
  originYearFromArticleHtml(`<meta property="article:published_time" content="2023-05-01"/>`),
  2023,
);

const articleUrl = "https://example.com/memes/2024-roundup";
const requested = [];
const fakeFetch = async (input) => {
  const url = String(input);
  requested.push(url);
  if (url === articleUrl) {
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  }
  const sourceUrl = new URL(url).searchParams.get("url");
  if (url.includes("tiktok.com/oembed")) {
    return Response.json({
      provider_name: "TikTok",
      title: "TikTok meme title",
      author_name: "tt_author",
      thumbnail_url: "https://p16.tiktokcdn.example/thumb.jpg",
      html: `<blockquote cite="${sourceUrl}"></blockquote>`,
    });
  }
  if (url.includes("instagram_oembed")) {
    return Response.json({
      type: "rich",
      title: "Instagram meme title",
      author_name: "ig_author",
      html: "<blockquote></blockquote>",
    });
  }
  return new Response("missing", { status: 404 });
};

const collection = await collectPublicArticleSocialCandidates(articleUrl, {
  fetchImpl: fakeFetch,
  memes: [
    {
      title: "테스트 밈",
      year: 2024,
      aliases: [],
      needles: ["instagrammemetitle", "테스트밈"],
    },
    {
      title: "룩공절(1122)",
      year: 2011,
      aliases: ["룩공절", "1122"],
      // Pure digits and short aliases must not claim every post on a wiki page.
      needles: ["룩공절1122", "룩공절", "1122"],
    },
  ],
});
assert.equal(collection.discovered, 4);
assert.equal(collection.candidates.length, 4);
assert.equal(collection.errors.length, 0);
assert.ok(collection.candidates.every((row) => row.editorial_signal === "public_article_citation"));
assert.ok(collection.candidates.every((row) => row.review_status === "needs_human_source_match"));
assert.equal(
  collection.candidates.filter((row) => row.source_platform === "Instagram").length,
  2,
);
assert.equal(
  collection.candidates.filter((row) => row.source_platform === "TikTok").length,
  2,
);
// verifyOEmbed threads thumbnail_url into rows (additive passthrough).
assert.ok(
  collection.candidates
    .filter((row) => row.source_platform === "TikTok")
    .every((row) => row.thumbnail_url === "https://p16.tiktokcdn.example/thumb.jpg"),
  "TikTok rows must carry the oEmbed thumbnail_url",
);
assert.ok(
  collection.candidates
    .filter((row) => row.source_platform === "Instagram")
    .every((row) => row.thumbnail_url === null),
  "Instagram rows without oEmbed thumbnails must carry an explicit null",
);
// oEmbed titles are "TikTok meme title" / "Instagram meme title" — only IG needle hits.
assert.ok(collection.candidates.some((row) => row.catalog_match_status === "title_overlap"));
assert.ok(
  collection.candidates.every((row) => row.meme_title !== "룩공절(1122)"),
  "numeric alias 1122 must not match unrelated posts via article HTML",
);

// Offline rematch helper: article HTML must not participate.
assert.equal(
  matchCatalogMeme("처음 시작 된 류정란 챌린지", [
    { title: "룩공절(1122)", needles: ["룩공절1122", "룩공절", "1122"] },
    { title: "류정란 챌린지", needles: ["류정란챌린지", "류정란"] },
  ])?.title,
  "류정란 챌린지",
);
assert.equal(
  matchCatalogMeme("random meme page with 1122 buried in html", [
    { title: "룩공절(1122)", needles: ["룩공절1122", "룩공절", "1122"] },
  ]),
  null,
);

await assert.rejects(
  () => collectPublicArticleSocialCandidates("https://www.tiktok.com/@x/video/1234567890123456789", {
    fetchImpl: fakeFetch,
  }),
  /editorial\/article URL/i,
);

const seed = await verifySocialSeedOEmbed("https://www.instagram.com/reel/DGYAH_wviX0/", {
  fetchImpl: fakeFetch,
});
assert.equal(seed.platform, "Instagram");
assert.equal(seed.oembed.author_name, "ig_author");

console.log("public-article-social extraction OK");
