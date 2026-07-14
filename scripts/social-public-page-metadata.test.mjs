import { strict as assert } from "node:assert";
import {
  instagramEmbedMetadataFromHtml,
  looksLikeAccessChallenge,
  publicSocialMetadataFromHtml,
} from "./social-public-page-metadata.mjs";

const metadata = publicSocialMetadataFromHtml(`
  <html>
    <head>
      <meta content="공개 &amp; 검증 제목" property="og:title">
      <meta property="og:description" content="짧은 설명">
      <meta name="author" content="공개 작성자">
      <meta property="og:image" content="https://cdn.example.com/thumb.jpg?x=1&amp;y=2">
    </head>
  </html>
`);

assert.deepEqual(metadata, {
  title: "공개 & 검증 제목",
  description: "짧은 설명",
  author_name: "공개 작성자",
  thumbnail_url: "https://cdn.example.com/thumb.jpg?x=1&y=2",
});

const jsonLd = publicSocialMetadataFromHtml(`
  <script type="application/ld+json">{"name":"JSON 제목","author":{"name":"JSON 작성자"}}</script>
`);
assert.equal(jsonLd.title, "JSON 제목");
assert.equal(jsonLd.author_name, "JSON 작성자");
assert.equal(publicSocialMetadataFromHtml('<meta property="og:image" content="javascript:alert(1)">').thumbnail_url, null);
assert.equal(looksLikeAccessChallenge("Please verify you are human"), true);
assert.equal(looksLikeAccessChallenge("공개 게시물입니다"), false);

const instagram = instagramEmbedMetadataFromHtml(`
  <div class="Caption"><a class="CaptionUsername" href="/creator">creator_kr</a><br />밈 원본 찾기<br />#검정고무신 댓글 137개 모두 보기</div>
  <img class="EmbeddedMediaImage" alt="public post" src="https://cdn.example.com/reel.jpg?x=1&amp;y=2">
`);
assert.deepEqual(instagram, {
  title: "밈 원본 찾기 #검정고무신",
  description: "밈 원본 찾기 #검정고무신",
  author_name: "creator_kr",
  thumbnail_url: "https://cdn.example.com/reel.jpg?x=1&y=2",
});

console.log("social public page metadata parser OK");
