import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSourceUrl } from "./source-url.mjs";

test("normalizes YouTube watch / shorts / youtu.be / embed URLs", () => {
  assert.deepEqual(normalizeSourceUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3"), {
    platform: "youtube",
    externalId: "dQw4w9WgXcQ",
    canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  });
  assert.deepEqual(normalizeSourceUrl("https://www.youtube.com/shorts/jrruPm_tU_A"), {
    platform: "youtube_shorts",
    externalId: "jrruPm_tU_A",
    canonicalUrl: "https://www.youtube.com/shorts/jrruPm_tU_A",
  });
  assert.equal(
    normalizeSourceUrl("https://youtu.be/dQw4w9WgXcQ").canonicalUrl,
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  );
  assert.equal(
    normalizeSourceUrl("https://www.youtube.com/embed/dQw4w9WgXcQ").externalId,
    "dQw4w9WgXcQ"
  );
});

test("normalizes TikTok and Instagram final public URLs", () => {
  assert.deepEqual(
    normalizeSourceUrl("https://www.tiktok.com/@coco.midnight/video/6833754937747361025?lang=ko"),
    {
      platform: "tiktok",
      externalId: "6833754937747361025",
      canonicalUrl: "https://www.tiktok.com/@coco.midnight/video/6833754937747361025",
    }
  );
  assert.deepEqual(normalizeSourceUrl("https://www.instagram.com/reel/DGYAH_wviX0/"), {
    platform: "instagram",
    externalId: "DGYAH_wviX0",
    canonicalUrl: "https://www.instagram.com/reel/DGYAH_wviX0/",
  });
  assert.equal(
    normalizeSourceUrl("https://www.instagram.com/p/CAbCdEfGhIj").canonicalUrl,
    "https://www.instagram.com/p/CAbCdEfGhIj/"
  );
});

test("rejects http, short links, and non-content URLs", () => {
  assert.equal(normalizeSourceUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(normalizeSourceUrl("https://vt.tiktok.com/ZSjKwVd8x/"), null);
  assert.equal(normalizeSourceUrl("https://www.instagram.com/explore/"), null);
  assert.equal(normalizeSourceUrl("https://www.youtube.com/shorts/short"), null);
  assert.equal(normalizeSourceUrl("not a url"), null);
  assert.equal(normalizeSourceUrl(""), null);
});
