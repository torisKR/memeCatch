import { describe, expect, it } from "vitest";
import { resolveMemeDelivery } from "./meme-delivery";

const liveContent = (overrides: Record<string, unknown> = {}) => ({
  id: "live-1",
  url: "https://www.youtube.com/watch?v=live",
  availability: "live",
  moderation_status: "approved",
  is_representative: false,
  ...overrides,
});

describe("resolveMemeDelivery", () => {
  it("selects a live alternate when the representative is dead", () => {
    const result = resolveMemeDelivery({
      contents: [
        liveContent({ id: "dead-representative", url: "https://example.com/dead", availability: "dead", is_representative: true }),
        liveContent({ id: "live-alternate", url: "https://example.com/live", is_representative: false }),
      ],
      sources: [],
    });

    expect(result.representative?.id).toBe("live-alternate");
    expect(result.fallbackSourceUrl).toBe("https://example.com/live");
    expect(result.sourceLinks.map((source) => source.source_url)).toEqual([
      "https://example.com/live",
    ]);
    expect(result.fallbackReason).toBeNull();
  });

  it("does not offer a duplicated dead or region-blocked URL", () => {
    const result = resolveMemeDelivery({
      contents: [
        liveContent({ url: "https://example.com/dead", availability: "dead", is_representative: true }),
        liveContent({ url: "https://example.com/blocked", availability: "region_blocked" }),
      ],
      sources: [
        { source_url: "https://example.com/dead", platform: "YouTube" },
        { source_url: "HTTPS://EXAMPLE.COM/blocked", platform: "TikTok" },
        { source_url: "https://namu.wiki/w/context", platform: "Community" },
      ],
    });

    expect(result.representative).toBeNull();
    expect(result.fallbackSourceUrl).toBe("https://namu.wiki/w/context");
    expect(result.sourceLinks.map((source) => source.source_url)).toEqual([
      "https://namu.wiki/w/context",
    ]);
    expect(result.fallbackReason).toBe("confirmed_unavailable");
  });

  it("keeps mixed-case YouTube IDs as different resources", () => {
    const result = resolveMemeDelivery({
      contents: [
        liveContent({
          id: "dead-lowercase-id",
          url: "https://www.youtube.com/watch?v=abc123",
          availability: "dead",
          is_representative: true,
        }),
        liveContent({
          id: "live-uppercase-id",
          url: "https://www.youtube.com/watch?v=ABC123",
          is_representative: false,
        }),
      ],
      sources: [],
    });

    expect(result.representative?.id).toBe("live-uppercase-id");
    expect(result.fallbackSourceUrl).toBe("https://www.youtube.com/watch?v=ABC123");
  });

  it("keeps Instagram shortcode path casing distinct", () => {
    const result = resolveMemeDelivery({
      contents: [
        liveContent({
          id: "dead-shortcode",
          url: "https://www.instagram.com/reel/AbC123/",
          availability: "region_blocked",
          is_representative: true,
        }),
      ],
      sources: [
        { source_url: "https://www.instagram.com/reel/abc123/", platform: "Instagram" },
      ],
    });

    expect(result.representative).toBeNull();
    expect(result.fallbackSourceUrl).toBe("https://www.instagram.com/reel/abc123/");
  });

  it("normalizes host casing while preserving the resource path", () => {
    const result = resolveMemeDelivery({
      contents: [
        liveContent({
          id: "dead-host-case",
          url: "https://EXAMPLE.com/video/CaseSensitive",
          availability: "dead",
          is_representative: true,
        }),
      ],
      sources: [
        { source_url: "https://example.COM/video/CaseSensitive", platform: "web" },
      ],
    });

    expect(result.representative).toBeNull();
    expect(result.sourceLinks).toEqual([]);
    expect(result.fallbackSourceUrl).toBeNull();
  });

  it("returns editorial-only delivery when media and sources are absent", () => {
    expect(resolveMemeDelivery({ contents: [], sources: [] })).toEqual({
      representative: null,
      fallbackSourceUrl: null,
      sourceLinks: [],
      fallbackReason: "no_playback_reference",
    });
  });
});
