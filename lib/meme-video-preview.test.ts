import { describe, expect, it } from "vitest";
import { socialVideoPreview, videoPreview, youtubeVideoPreview } from "./meme-video-preview";

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

  it("builds an official embed only for the exact representative post", () => {
    expect(socialVideoPreview([instagram])).toEqual({
      platform: "instagram",
      sourceUrl: "https://www.instagram.com/reel/DX0AR6UzAWW/",
      embedUrl: "https://www.instagram.com/reel/DX0AR6UzAWW/embed/captioned/",
      contentId: "DX0AR6UzAWW",
    });
    expect(socialVideoPreview([{ ...instagram, content_id: "different" }])).toBeNull();
    expect(socialVideoPreview([{ ...instagram, availability: "dead" }])).toBeNull();
    expect(socialVideoPreview([{ ...instagram, moderation_status: "pending" }])).toBeNull();
  });

  it("withholds ambiguous Instagram /p/ posts, including mixed carousels with a later video", () => {
    const post = {
      ...instagram,
      // DJiODQnTOfj has image slides first and a video on its sixth slide, but
      // the stored card content has no trusted per-slide media-kind metadata.
      url: "https://www.instagram.com/p/DJiODQnTOfj/",
      content_id: "DJiODQnTOfj",
    };

    expect(socialVideoPreview([post])).toBeNull();
    expect(socialVideoPreview([{
      ...post,
      thumbnail_url: "https://catchmeme.com/api/media/meme-thumbs/verified/instagram/DJiODQnTOfj.jpg",
    }])).toBeNull();
    expect(videoPreview([{
      ...post,
      thumbnail_url: "https://catchmeme.com/api/media/meme-thumbs/verified/instagram/DJiODQnTOfj.jpg",
    }])).toBeNull();
  });

  it("keeps Instagram URL forms that unambiguously identify video content", () => {
    const tv = {
      ...instagram,
      url: "https://www.instagram.com/tv/IGTV12345/",
      content_id: "IGTV12345",
    };

    expect(socialVideoPreview([tv])).toEqual({
      platform: "instagram",
      sourceUrl: "https://www.instagram.com/tv/IGTV12345/",
      embedUrl: "https://www.instagram.com/tv/IGTV12345/embed/captioned/",
      contentId: "IGTV12345",
    });
  });

  it("uses the same TikTok post ID for the card preview and official player", () => {
    const tiktok = {
      ...instagram,
      url: "https://www.tiktok.com/@creator/video/6833754937747361025",
      content_id: "6833754937747361025",
    };
    expect(socialVideoPreview([tiktok])).toEqual({
      platform: "tiktok",
      sourceUrl: "https://www.tiktok.com/@creator/video/6833754937747361025",
      embedUrl: "https://www.tiktok.com/player/v1/6833754937747361025?description=1&music_info=1",
      contentId: "6833754937747361025",
    });
  });

  it("does not pick an arbitrary post when the representative is ambiguous", () => {
    const other = { ...instagram, url: "https://www.instagram.com/reel/AbCdEf12345/", content_id: "AbCdEf12345" };
    expect(socialVideoPreview([instagram, other])).toBeNull();
    expect(socialVideoPreview([{ ...instagram, is_representative: false }, { ...other, is_representative: false }])).toBeNull();
    expect(socialVideoPreview([instagram, { ...other, is_representative: false }])?.contentId).toBe(instagram.content_id);
    expect(socialVideoPreview([{ ...instagram, is_representative: false }])?.contentId).toBe(instagram.content_id);
  });
});
