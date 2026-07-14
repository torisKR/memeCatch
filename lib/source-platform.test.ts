import { describe, expect, it } from "vitest";

import {
  countSocialPlatformReferences,
  sourcePlatformFromMeme,
  sourcePlatformFromReference,
} from "@/lib/source-platform";

describe("source platform normalization", () => {
  it("distinguishes YouTube Shorts from regular YouTube", () => {
    expect(
      sourcePlatformFromReference({
        platform: "youtube",
        url: "https://www.youtube.com/shorts/abc123",
      })
    ).toBe("youtube_shorts");
    expect(
      sourcePlatformFromReference({
        platform: "youtube",
        url: "https://www.youtube.com/watch?v=abc123",
      })
    ).toBe("youtube");
  });

  it("prefers a representative social content platform over a contextual source", () => {
    expect(
      sourcePlatformFromMeme({
        contents: [{ platform: "TikTok", url: "https://www.tiktok.com/@creator/video/1" }],
        sources: [{ platform: "커뮤니티", url: "https://namu.wiki/w/example" }],
      })
    ).toBe("tiktok");
  });

  it("counts unique memes for each social platform", () => {
    expect(
      countSocialPlatformReferences([
        { meme_id: "one", platform: "YouTube", url: "https://youtube.com/watch?v=abcdefghijk" },
        { meme_id: "one", platform: "YouTube", url: "https://youtube.com/watch?v=lmnopqrstuv" },
        { meme_id: "two", platform: "YouTube", url: "https://youtube.com/shorts/abcdefghijk" },
        { meme_id: "three", platform: "TikTok", url: "https://www.tiktok.com/@creator/video/1234567890123456789" },
      ])
    ).toEqual({ youtube: 1, youtube_shorts: 1, tiktok: 1, instagram: 0 });
  });
});
