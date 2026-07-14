import { describe, expect, it } from "vitest";

import {
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
});
