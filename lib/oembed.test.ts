import { afterEach, describe, expect, it, vi } from "vitest";
import { getOEmbed } from "@/lib/oembed";

afterEach(() => vi.unstubAllGlobals());

describe("Instagram oEmbed availability", () => {
  const url = "https://www.instagram.com/p/THISDOESNOTEXIST123/";

  it("classifies Meta's missing-resource response as unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      error: { code: 24, error_subcode: 2207045, message: "The requested resource does not exist" },
    }, { status: 400 })));

    await expect(getOEmbed(url)).rejects.toMatchObject({ status: 404, code: "UPSTREAM_ERROR" });
  });

  it.each([
    { code: 24, error_subcode: 1234 },
    { code: 100, error_subcode: 2207045 },
    { code: 4 },
  ])("does not mistake other Meta errors for deleted content: %o", async (error) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error }, { status: 400 })));

    await expect(getOEmbed(url)).rejects.toMatchObject({ status: 502, code: "UPSTREAM_ERROR" });
  });

  it("does not claim an independently verified Instagram content ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      title: "post",
      author_name: "creator",
      html: '<blockquote data-instgrm-permalink="https://www.instagram.com/p/DIFFERENT123/">',
    })));

    const result = await getOEmbed("https://www.instagram.com/p/REQUESTED123/");

    expect(result.contentId).toBe("REQUESTED123");
    expect(result.providerContentId).toBeNull();
  });
});

describe("TikTok oEmbed response identity", () => {
  it("uses trusted response HTML identity for a vt.tiktok.com short link", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      title: "video",
      author_name: "creator",
      html: '<blockquote data-video-id="1234567890"></blockquote>',
    })));

    const result = await getOEmbed("https://vt.tiktok.com/ZSshortlink/");

    expect(result.contentId).toBe("1234567890");
    expect(result.providerContentId).toBe("1234567890");
    expect(result.embedUrl).toContain("/1234567890?");
  });

  it("separates the request ID from an independently exposed HTML video ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      title: "video",
      author_name: "creator",
      html: '<blockquote data-video-id="0987654321"></blockquote>',
    })));

    const result = await getOEmbed("https://www.tiktok.com/@a/video/1234567890");

    expect(result.contentId).toBe("1234567890");
    expect(result.providerContentId).toBe("0987654321");
  });

  it("leaves providerContentId unknown when response HTML has no trustworthy ID", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({
      title: "video",
      author_name: "creator",
      html: '<blockquote cite="https://www.tiktok.com/@a/video/0987654321">generic player</blockquote>',
    })));

    const result = await getOEmbed("https://www.tiktok.com/@a/video/1234567890");

    expect(result.contentId).toBe("1234567890");
    expect(result.providerContentId).toBeNull();
  });
});
