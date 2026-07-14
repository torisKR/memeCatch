import assert from "node:assert/strict";
import test from "node:test";
import { parseNativeSocialContent } from "./social-content.mjs";

test("distinguishes YouTube Shorts from regular YouTube videos", () => {
  assert.deepEqual(parseNativeSocialContent("https://www.youtube.com/shorts/aBcdEfGhI12"), {
    platform: "YouTube",
    contentId: "aBcdEfGhI12",
    url: "https://www.youtube.com/shorts/aBcdEfGhI12",
    isShort: true,
    thumbnailUrl: "https://i.ytimg.com/vi/aBcdEfGhI12/hqdefault.jpg",
  });
  assert.equal(
    parseNativeSocialContent("https://www.youtube.com/watch?v=aBcdEfGhI12").isShort,
    false
  );
});

test("accepts canonical TikTok and Instagram public post URLs", () => {
  assert.deepEqual(parseNativeSocialContent("https://www.tiktok.com/@catchmeme/video/7123456789012345678"), {
    platform: "TikTok",
    contentId: "7123456789012345678",
    url: "https://www.tiktok.com/@catchmeme/video/7123456789012345678",
    isShort: false,
    thumbnailUrl: null,
  });
  assert.deepEqual(parseNativeSocialContent("https://www.instagram.com/reel/Cx7_f9Zq_11/"), {
    platform: "Instagram",
    contentId: "Cx7_f9Zq_11",
    url: "https://www.instagram.com/reel/Cx7_f9Zq_11/",
    isShort: false,
    thumbnailUrl: null,
  });
});

test("rejects redirect-only or context URLs", () => {
  assert.equal(parseNativeSocialContent("https://vm.tiktok.com/ZM12345/"), null);
  assert.equal(parseNativeSocialContent("https://namu.wiki/w/test"), null);
});
