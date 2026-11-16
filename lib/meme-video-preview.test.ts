import { describe, expect, it } from "vitest";
import { videoPreview, youtubeVideoPreview } from "./meme-video-preview";

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

describe("verified social video previews", () => {
  const instagram = { url: "https://www.instagram.com/reel/DX0AR6UzAWW/", content_id: "DX0AR6UzAWW", thumbnail_url: "https://catchmeme.com/api/media/meme-thumbs/verified/instagram/DX0AR6UzAWW.jpg", moderation_status: "approved", availability: "live", is_representative: true };
  it("shows only a verified cover keyed to the representative post", () => {
    expect(videoPreview([instagram])).toBe("/api/media/meme-thumbs/verified/instagram/DX0AR6UzAWW.jpg");
    expect(videoPreview([{ ...instagram, content_id: "different" }])).toBeNull();
    expect(videoPreview([{ ...instagram, thumbnail_url: instagram.thumbnail_url.replace("DX0AR6UzAWW.jpg", "different.jpg") }])).toBeNull();
    expect(videoPreview([{ ...instagram, thumbnail_url: instagram.thumbnail_url.replace("catchmeme.com", "evil.example") }])).toBeNull();
    expect(videoPreview([{ ...instagram, availability: "dead" }])).toBeNull();
    expect(videoPreview([{ ...instagram, moderation_status: "pending" }])).toBeNull();
  });
});
