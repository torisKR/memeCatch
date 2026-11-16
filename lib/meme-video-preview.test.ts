import { describe, expect, it } from "vitest";
import { youtubeVideoPreview } from "./meme-video-preview";

const video = { url: "https://www.youtube.com/shorts/abcdefghijk", content_id: "abcdefghijk", moderation_status: "approved", availability: "live", is_representative: true };

describe("youtubeVideoPreview", () => {
  it("uses the same representative and video ID as the detail player", () => {
    expect(youtubeVideoPreview([video])).toBe("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(youtubeVideoPreview([{ ...video, content_id: "12345678901" }])).toBeNull();
    expect(youtubeVideoPreview([{ ...video, url: "https://example.com/watch?v=abcdefghijk" }])).toBeNull();
  });
  it("does not display unavailable, unapproved, or a nonrepresentative video behind another representative", () => {
    expect(youtubeVideoPreview([{ ...video, availability: "dead" }])).toBeNull();
    expect(youtubeVideoPreview([{ ...video, moderation_status: "pending" }])).toBeNull();
    expect(youtubeVideoPreview([{ ...video, url: "https://example.com/", content_id: null }, { ...video, is_representative: false }])).toBeNull();
  });
});
