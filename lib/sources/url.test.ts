import { describe, expect, it } from "vitest";
import { embedUrlFor, isYouTubePlatform, normalizeSourceUrl } from "./url";

describe("normalizeSourceUrl", () => {
  it("YouTube watch URL을 정규화한다", () => {
    expect(
      normalizeSourceUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s"),
    ).toEqual({
      platform: "youtube",
      externalId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("youtu.be 단축 URL을 정규화한다", () => {
    expect(normalizeSourceUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      platform: "youtube",
      externalId: "dQw4w9WgXcQ",
      canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
  });

  it("YouTube Shorts를 별도 플랫폼으로 정규화한다", () => {
    expect(
      normalizeSourceUrl("https://www.youtube.com/shorts/jrruPm_tU_A"),
    ).toEqual({
      platform: "youtube_shorts",
      externalId: "jrruPm_tU_A",
      canonicalUrl: "https://www.youtube.com/shorts/jrruPm_tU_A",
    });
  });

  it("YouTube embed URL도 인식한다", () => {
    expect(
      normalizeSourceUrl("https://www.youtube.com/embed/dQw4w9WgXcQ"),
    ).toMatchObject({ platform: "youtube", externalId: "dQw4w9WgXcQ" });
  });

  it("TikTok 최종 공개 URL을 정규화한다", () => {
    expect(
      normalizeSourceUrl(
        "https://www.tiktok.com/@coco.midnight/video/6833754937747361025?lang=ko",
      ),
    ).toEqual({
      platform: "tiktok",
      externalId: "6833754937747361025",
      canonicalUrl:
        "https://www.tiktok.com/@coco.midnight/video/6833754937747361025",
    });
  });

  it("Instagram 릴스와 게시물을 정규화한다", () => {
    expect(
      normalizeSourceUrl("https://www.instagram.com/reel/DGYAH_wviX0/"),
    ).toEqual({
      platform: "instagram",
      externalId: "DGYAH_wviX0",
      canonicalUrl: "https://www.instagram.com/reel/DGYAH_wviX0/",
    });
    expect(
      normalizeSourceUrl("https://www.instagram.com/p/CAbCdEfGhIj"),
    ).toMatchObject({
      platform: "instagram",
      externalId: "CAbCdEfGhIj",
      canonicalUrl: "https://www.instagram.com/p/CAbCdEfGhIj/",
    });
  });

  it("http·비정상·미지원 URL은 거부한다", () => {
    expect(normalizeSourceUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(normalizeSourceUrl("not a url")).toBeNull();
    expect(normalizeSourceUrl("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(normalizeSourceUrl("https://vt.tiktok.com/ZSjKwVd8x/")).toBeNull();
    expect(normalizeSourceUrl("https://www.instagram.com/explore/")).toBeNull();
    expect(normalizeSourceUrl("https://www.youtube.com/shorts/too-short")).toBeNull();
    expect(normalizeSourceUrl("")).toBeNull();
  });
});

describe("embedUrlFor", () => {
  it("YouTube는 nocookie 임베드를 반환한다", () => {
    expect(
      embedUrlFor({
        platform: "youtube",
        externalId: "dQw4w9WgXcQ",
        canonicalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      }),
    ).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
  });

  it("Instagram은 게시물 유형을 유지한다", () => {
    expect(
      embedUrlFor({
        platform: "instagram",
        externalId: "CAbCdEfGhIj",
        canonicalUrl: "https://www.instagram.com/p/CAbCdEfGhIj/",
      }),
    ).toBe("https://www.instagram.com/p/CAbCdEfGhIj/embed/captioned/");
  });

  it("isYouTubePlatform은 shorts를 포함한다", () => {
    expect(isYouTubePlatform("youtube")).toBe(true);
    expect(isYouTubePlatform("youtube_shorts")).toBe(true);
    expect(isYouTubePlatform("tiktok")).toBe(false);
  });
});
