import { describe, expect, it } from "vitest";
import { resolveMemeDelivery } from "./meme-delivery";

const liveContent = (overrides: Record<string, unknown> = {}) => ({
  id: "live-1",
  platform: "YouTube",
  content_id: "abcdefghijk",
  url: "https://www.youtube.com/watch?v=abcdefghijk",
  availability: "live",
  moderation_status: "approved",
  is_representative: false,
  ...overrides,
});

const reviewedYouTube = (overrides: Record<string, unknown> = {}) => ({
  review_state: "approved",
  rights_basis: "official_embed",
  platform: "youtube",
  external_id: "abcdefghijk",
  canonical_url: "https://www.youtube.com/watch?v=abcdefghijk",
  embeddable: false,
  public_status: "public",
  removed_at: null,
  last_checked_at: new Date().toISOString(),
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

  it.each([
    {
      availability: "dead",
      contentUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      sourceUrl: "https://youtu.be/abcdefghijk",
    },
    {
      availability: "region_blocked",
      contentUrl: "https://www.youtube.com/shorts/abcdefghijk",
      sourceUrl: "https://www.youtube.com/watch?v=abcdefghijk",
    },
  ])(
    "suppresses a $availability YouTube alias by external video identity",
    ({ availability, contentUrl, sourceUrl }) => {
      const result = resolveMemeDelivery({
        contents: [liveContent({
          availability,
          url: contentUrl,
          is_representative: true,
        })],
        sources: [{ source_url: sourceUrl, platform: "YouTube" }],
      });

      expect(result.representative).toBeNull();
      expect(result.sourceLinks).toEqual([]);
      expect(result.publicSources).toEqual([]);
      expect(result.fallbackSourceUrl).toBeNull();
    },
  );

  it("preserves an unrelated arbitrary web fallback", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({
        availability: "dead",
        url: "https://example.com/video/dead",
        is_representative: true,
      })],
      sources: [{ source_url: "https://namu.wiki/w/context", platform: "Community" }],
    });

    expect(result.sourceLinks.map((source) => source.source_url)).toEqual([
      "https://namu.wiki/w/context",
    ]);
    expect(result.fallbackSourceUrl).toBe("https://namu.wiki/w/context");
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
      embeddingAllowed: true,
      fallbackSourceUrl: null,
      sourceLinks: [],
      publicSources: [],
      fallbackReason: "no_playback_reference",
    });
  });

  it("turns an exact public non-embeddable YouTube match into link-only delivery", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ is_representative: true })],
      sources: [],
      reviewedMediaSources: [reviewedYouTube()],
    });

    expect(result.representative?.id).toBe("live-1");
    expect(result.embeddingAllowed).toBe(false);
    expect(result.fallbackReason).toBeNull();
    expect(result.fallbackSourceUrl).toBe(
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
  });

  it("rehabilitates a legacy dead projection only from fresh public non-embeddable evidence", () => {
    const now = Date.parse("2026-11-17T12:00:00.000Z");
    const result = resolveMemeDelivery({
      contents: [liveContent({ availability: "dead", is_representative: true })],
      sources: [],
      reviewedMediaSources: [reviewedYouTube({ last_checked_at: "2026-11-17T11:00:00.000Z" })],
      now,
    });

    expect(result.representative?.id).toBe("live-1");
    expect(result.embeddingAllowed).toBe(false);
    expect(result.fallbackSourceUrl).toBe(
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
    expect(result.fallbackReason).toBeNull();
  });

  it("accepts a URL alias only when it normalizes to the same canonical YouTube identity", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({
        url: "https://youtu.be/abcdefghijk",
        is_representative: true,
      })],
      sources: [],
      reviewedMediaSources: [reviewedYouTube()],
    });

    expect(result.embeddingAllowed).toBe(false);
    expect(result.representative?.id).toBe("live-1");
  });

  it.each([
    ["platform", { platform: "youtube_shorts" }],
    ["content ID", { external_id: "lmnopqrstuv" }],
    ["canonical URL", { canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv" }],
  ])("does not apply an unrelated %s ledger row", (_label, sourceOverride) => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ is_representative: true })],
      sources: [],
      reviewedMediaSources: [reviewedYouTube(sourceOverride)],
    });

    expect(result.embeddingAllowed).toBe(true);
    expect(result.representative?.id).toBe("live-1");
  });

  it("suppresses a region-blocked video even when its exact source is fresh, public, and link-only", () => {
    const url = "https://www.youtube.com/watch?v=abcdefghijk";
    const result = resolveMemeDelivery({
      contents: [liveContent({ availability: "region_blocked", is_representative: true })],
      sources: [{ source_url: url, platform: "YouTube" }],
      reviewedMediaSources: [reviewedYouTube()],
    });

    expect(result.representative).toBeNull();
    expect(result.sourceLinks).toEqual([]);
    expect(result.fallbackSourceUrl).toBeNull();
    expect(result.fallbackReason).toBe("confirmed_unavailable");
  });

  it("suppresses stale public non-embeddable evidence instead of revealing a possibly dead video", () => {
    const now = Date.parse("2026-11-17T12:00:00.000Z");
    const url = "https://www.youtube.com/watch?v=abcdefghijk";
    const result = resolveMemeDelivery({
      contents: [liveContent({ availability: "dead", is_representative: true })],
      sources: [{ source_url: url, platform: "YouTube" }],
      reviewedMediaSources: [reviewedYouTube({ last_checked_at: "2026-11-16T11:59:59.000Z" })],
      now,
    });

    expect(result.representative).toBeNull();
    expect(result.sourceLinks).toEqual([]);
    expect(result.fallbackSourceUrl).toBeNull();
  });

  it("suppresses an exact private source without letting an unrelated public row override it", () => {
    const url = "https://www.youtube.com/watch?v=abcdefghijk";
    const now = Date.parse("2026-11-17T12:00:00.000Z");
    const result = resolveMemeDelivery({
      contents: [liveContent({ is_representative: true })],
      sources: [{ source_url: url, platform: "YouTube" }],
      reviewedMediaSources: [
        reviewedYouTube({ last_checked_at: "2026-11-17T10:00:00.000Z" }),
        reviewedYouTube({
          public_status: "private",
          removed_at: "2026-11-17T11:00:00.000Z",
          last_checked_at: "2026-11-17T11:00:00.000Z",
        }),
        reviewedYouTube({
          external_id: "lmnopqrstuv",
          canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv",
          last_checked_at: "2026-11-17T11:30:00.000Z",
        }),
      ],
      now,
    });

    expect(result.representative).toBeNull();
    expect(result.sourceLinks).toEqual([]);
    expect(result.fallbackSourceUrl).toBeNull();
  });
});
