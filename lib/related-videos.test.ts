import { describe, expect, it } from "vitest";
import type { RelatedVideoContent } from "./related-videos";
import { relatedVideoSourceUrl, selectRelatedVideos } from "./related-videos";

function video(
  id: string,
  platform: string,
  url: string | null,
  overrides: Partial<RelatedVideoContent> = {},
): RelatedVideoContent {
  return {
    id: `row-${id}-${platform}`,
    platform,
    content_id: id,
    url,
    thumbnail_url: null,
    availability: "live",
    caption: null,
    moderation_status: "approved",
    is_representative: false,
    manual_video_verified: false,
    type: "video",
    ...overrides,
  };
}

describe("selectRelatedVideos", () => {
  it("keeps verified production-shaped Instagram posts beyond the first four", () => {
    const contents = [
      video("1234567890123456789", "TikTok", "https://www.tiktok.com/@user/video/1234567890123456789"),
      video("ReelOne", "Instagram", "https://www.instagram.com/reel/ReelOne/"),
      video("1234567890123456790", "TikTok", "https://www.tiktok.com/@user/video/1234567890123456790"),
      video("ReelTwo", "Instagram", "https://www.instagram.com/reel/ReelTwo/"),
      video("C6oL0KyvcMM", "Instagram", "https://www.instagram.com/p/C6oL0KyvcMM/", {
        type: "embed",
        manual_video_verified: true,
      }),
      video("C8ljA6up_xE", "Instagram", "https://www.instagram.com/p/C8ljA6up_xE/", {
        type: "embed",
        manual_video_verified: true,
      }),
      video("Unverified1", "Instagram", "https://www.instagram.com/p/Unverified1/", {
        type: "embed",
      }),
    ];

    expect(selectRelatedVideos(contents, null).map((content) => content.content_id)).toEqual([
      "1234567890123456789",
      "ReelOne",
      "1234567890123456790",
      "ReelTwo",
      "C6oL0KyvcMM",
      "C8ljA6up_xE",
    ]);
  });

  it("deduplicates a separate YouTube watch and Shorts identity", () => {
    const watch = video(
      "YtDup12345A",
      "YouTube",
      "https://www.youtube.com/watch?v=YtDup12345A",
      { type: "embed" },
    );
    const shorts = video(
      "YtDup12345A",
      "YouTube Shorts",
      "https://www.youtube.com/shorts/YtDup12345A",
      { id: "duplicate-youtube-row", type: "embed" },
    );

    expect(selectRelatedVideos([watch, shorts], null)).toEqual([watch]);
  });

  it("keeps verified Instagram post and reel paths distinct, without showing an unverified post", () => {
    const post = video("Post123", "Instagram", "https://www.instagram.com/p/Post123/", { manual_video_verified: true });
    const reel = video("Post123", "Instagram", "https://www.instagram.com/reel/Post123/", { id: "reel" });
    const unverified = video("Other456", "Instagram", "https://www.instagram.com/p/Other456/", { manual_video_verified: false });
    expect(selectRelatedVideos([post, reel, unverified], null)).toEqual([post, reel]);
    expect(selectRelatedVideos([post, reel], post)).toEqual([reel]);
  });

  it("excludes the representative identity and unverified Instagram posts", () => {
    const representative = video(
      "YtRep12345A",
      "YouTube",
      "https://www.youtube.com/watch?v=YtRep12345A",
      { id: "representative" },
    );
    const duplicateRepresentative = video("YtRep12345A", "YouTube", null);
    const unverifiedPost = video(
      "PostOnly1",
      "Instagram",
      "https://www.instagram.com/p/PostOnly1/",
    );

    expect(selectRelatedVideos([duplicateRepresentative, unverifiedPost], representative)).toEqual([]);
  });

  it("provides a canonical no-JavaScript link for reviewed URL-less YouTube rows", () => {
    const content = video("YtNull1234A", "YouTube", null, { type: "embed" });

    expect(relatedVideoSourceUrl(content)).toBe(
      "https://www.youtube.com/watch?v=YtNull1234A",
    );
  });

  it("preserves video rows while excluding non-video media types", () => {
    const playableVideo = video(
      "abcdefghijk",
      "YouTube",
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
    const image = video(
      "lmnopqrstuv",
      "YouTube",
      "https://www.youtube.com/watch?v=lmnopqrstuv",
      { type: "image" },
    );

    expect(selectRelatedVideos([playableVideo, image], null)).toEqual([playableVideo]);
  });

  it("does not fall back to platform and ID when a stored URL is unsupported or invalid", () => {
    const unsupported = video(
      "abcdefghijk",
      "YouTube",
      "https://example.com/watch?v=abcdefghijk",
      { type: "embed" },
    );
    const invalid = video("lmnopqrstuv", "YouTube", "not-a-url", { type: "embed" });

    expect(selectRelatedVideos([unsupported, invalid], null)).toEqual([]);
    expect(relatedVideoSourceUrl(unsupported)).toBeNull();
    expect(relatedVideoSourceUrl(invalid)).toBeNull();
  });
});
