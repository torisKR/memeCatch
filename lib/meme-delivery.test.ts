import { describe, expect, it } from "vitest";
import {
  resolveMemeDelivery,
  selectSecondaryReferenceContents,
} from "./meme-delivery";

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

  it("does not resurrect unavailable YouTube media through watch/shorts/short-link variants", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ url: "https://youtu.be/abcdefghijk?t=10", availability: "dead" })],
      sources: [
        { source_url: "https://www.youtube.com/watch?v=abcdefghijk&feature=share" },
        { source_url: "https://www.youtube.com/shorts/abcdefghijk?si=tracking" },
        { source_url: "https://www.youtube.com/embed/abcdefghijk" },
        { source_url: "https://example.org/explanation" },
      ],
    });
    expect(result.sourceLinks.map((source) => source.source_url)).toEqual(["https://example.org/explanation"]);
    expect(result.fallbackSourceUrl).toBe("https://example.org/explanation");
  });

  it("does not select a live-looking duplicate of a confirmed unavailable platform ID", () => {
    const result = resolveMemeDelivery({
      contents: [
        liveContent({ id: "dead", url: "https://youtu.be/abcdefghijk", availability: "dead" }),
        liveContent({ id: "duplicate", url: "https://www.youtube.com/shorts/abcdefghijk", is_representative: true }),
        liveContent({ id: "alternate", url: "https://youtu.be/zyxwvutsrqp" }),
      ],
      sources: [],
    });
    expect(result.representative?.id).toBe("alternate");
    expect(result.sourceLinks.map((source) => source.source_url)).toEqual(["https://youtu.be/zyxwvutsrqp"]);
  });

  it("blocks Instagram tracking variants while preserving shortcode case", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ url: "https://www.instagram.com/reel/AbC123/?igsh=tracking", availability: "dead" })],
      sources: [
        { source_url: "https://www.instagram.com/reel/AbC123/" },
        { source_url: "https://www.instagram.com/reel/abc123/" },
      ],
    });
    expect(result.sourceLinks.map((source) => source.source_url)).toEqual(["https://www.instagram.com/reel/abc123/"]);
  });

  it("returns editorial-only delivery when media and sources are absent", () => {
    expect(resolveMemeDelivery({ contents: [], sources: [] })).toEqual({
      representative: null,
      fallbackSourceUrl: null,
      sourceLinks: [],
      originalSources: [],
      renderableContents: [],
      fallbackReason: "no_playback_reference",
    });
  });

  it("returns one safe content set for representative and related social embeds", () => {
    const safe = liveContent({ id: "safe", url: "https://www.instagram.com/reel/Other1/" });
    const evidence = { source_url: "https://example.org/reference", title: "Evidence" };
    const result = resolveMemeDelivery({
      contents: [
        liveContent({ id: "dead", url: "https://www.instagram.com/reel/AbC123/", availability: "dead" }),
        liveContent({ id: "duplicate", url: "https://www.instagram.com/p/AbC123/?igsh=tracking" }),
        liveContent({ id: "produced", production_id: "owned", url: "https://youtu.be/abcdefghijk" }),
        safe,
      ],
      sources: [{ source_url: "https://www.instagram.com/reel/AbC123/" }, evidence],
    });
    expect(result.renderableContents).toEqual([safe]);
    expect(result.originalSources).toEqual([evidence]);
    expect(result.originalSources[0]).toBe(evidence);
  });

  it("does not let produced explainers become original representative media or source links", () => {
    const result = resolveMemeDelivery({
      contents: [
        { id: "p", production_id: "production-1", url: "https://youtu.be/abcdefghijk", availability: "live", moderation_status: "approved", is_representative: true },
        { id: "o", url: "https://youtu.be/original01", availability: "live", moderation_status: "approved", is_representative: true },
      ],
      sources: [
        { source_url: "https://catchmeme.com/memes/own", production_id: "production-1" },
        { source_url: "https://example.org/origin", platform: "web" },
      ],
    });
    expect(result.representative?.id).toBe("o");
    expect(result.sourceLinks.map((source) => source.source_url)).not.toContain("https://catchmeme.com/memes/own");
    expect(result.sourceLinks.map((source) => source.source_url)).toContain("https://example.org/origin");
  });

  it("keeps an approved secondary reference renderable but never promotes it to representative", () => {
    const reference = liveContent({
      id: "reference",
      meme_id: "meme-1",
      content_id: "abcdefghijk",
      url: "https://www.youtube.com/shorts/abcdefghijk",
      platform: "youtube_shorts",
      is_representative: true,
    });
    const source = {
      meme_id: "meme-1",
      source_url: "https://youtu.be/abcdefghijk",
      platform: "YouTube",
      source_role: "secondary_reference",
      rights_basis: "official_embed",
    };
    const result = resolveMemeDelivery({ contents: [reference], sources: [source] });

    expect(result.representative).toBeNull();
    expect(result.fallbackSourceUrl).toBeNull();
    expect(result.renderableContents).toEqual([reference]);
    expect(selectSecondaryReferenceContents({
      memeId: "meme-1",
      contents: result.renderableContents,
      sources: result.originalSources,
      representative: result.representative,
    })).toEqual([reference]);
  });

  it("preserves an independent live primary representative beside a secondary reference", () => {
    const primary = liveContent({ id: "primary", meme_id: "meme-1", is_representative: false });
    const reference = liveContent({
      id: "reference",
      meme_id: "meme-1",
      content_id: "abcdefghijk",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      platform: "youtube",
      is_representative: true,
    });
    const result = resolveMemeDelivery({
      contents: [reference, primary],
      sources: [{
        meme_id: "meme-1",
        source_url: "https://www.youtube.com/shorts/abcdefghijk",
        source_role: "secondary_reference",
        rights_basis: "official_embed",
      }],
    });

    expect(result.representative).toBe(primary);
  });

  it("does not inherit a same-video secondary approval from another meme", () => {
    const primary = liveContent({
      id: "primary",
      meme_id: "meme-1",
      content_id: "abcdefghijk",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      platform: "youtube",
      is_representative: true,
    });
    const result = resolveMemeDelivery({
      contents: [primary],
      sources: [{
        meme_id: "meme-2",
        source_url: "https://youtu.be/abcdefghijk",
        source_role: "secondary_reference",
        rights_basis: "official_embed",
      }],
    });

    expect(result.representative).toBe(primary);
    expect(result.fallbackSourceUrl).toBe("https://www.youtube.com/watch?v=abcdefghijk");
  });

  it("keeps legacy content representative when scoped parent IDs are missing", () => {
    const legacy = liveContent({
      id: "legacy",
      content_id: "abcdefghijk",
      url: "https://www.youtube.com/watch?v=abcdefghijk",
      platform: "youtube",
      is_representative: true,
    });
    const sourceWithoutParent = {
      source_url: "https://youtu.be/abcdefghijk",
      source_role: "secondary_reference",
      rights_basis: "official_embed",
    };
    const result = resolveMemeDelivery({ contents: [legacy], sources: [sourceWithoutParent] });

    expect(result.representative).toBe(legacy);
    expect(selectSecondaryReferenceContents({
      memeId: "meme-1",
      contents: [legacy],
      sources: [sourceWithoutParent],
      representative: result.representative,
    })).toEqual([]);
  });
});

describe("selectSecondaryReferenceContents", () => {
  const memeId = "meme-1";
  const content = (overrides: Record<string, unknown> = {}) => ({
    id: "reference-1",
    meme_id: memeId,
    content_id: "abcdefghijk",
    url: "https://www.youtube.com/shorts/abcdefghijk?feature=share",
    platform: "youtube_shorts",
    availability: "live",
    moderation_status: "approved",
    is_representative: false,
    caption: "운영자가 검수한 참고 맥락",
    ...overrides,
  });
  const source = (overrides: Record<string, unknown> = {}) => ({
    id: "source-1",
    meme_id: memeId,
    source_url: "https://youtu.be/abcdefghijk?t=3",
    platform: "YouTube",
    source_role: "secondary_reference",
    rights_basis: "official_embed",
    ...overrides,
  });

  it("matches reviewed YouTube aliases by normalized video identity", () => {
    const approved = content();
    expect(selectSecondaryReferenceContents({
      memeId,
      contents: [approved],
      sources: [source()],
      representative: null,
    })).toEqual([approved]);
  });

  it.each([
    ["pending moderation", { moderation_status: "pending" }, {}, null],
    ["dead content", { availability: "dead" }, {}, null],
    ["region-blocked content", { availability: "region_blocked" }, {}, null],
    ["unchecked content", { availability: "unchecked" }, {}, null],
    ["unknown rights", {}, { rights_basis: "unknown" }, null],
    ["usage example", {}, { source_role: "usage_example" }, null],
    ["original source", {}, { source_role: "original" }, null],
    ["mismatched source alias", {}, { source_url: "https://youtu.be/zyxwvutsrqp" }, null],
    ["URL and content ID mismatch", { url: "https://youtu.be/zyxwvutsrqp" }, {}, null],
    ["another meme source", {}, { meme_id: "meme-2" }, null],
    ["another meme content", { meme_id: "meme-2" }, {}, null],
    ["selected representative", {}, {}, "reference-1"],
  ])("excludes %s", (_label, contentOverrides, sourceOverrides, representativeId) => {
    const candidate = content(contentOverrides);
    expect(selectSecondaryReferenceContents({
      memeId,
      contents: [candidate],
      sources: [source(sourceOverrides)],
      representative: representativeId ? content({ id: representativeId }) : null,
    })).toEqual([]);
  });

  it("deduplicates watch/short aliases and caps the dedicated section", () => {
    const first = content();
    const duplicate = content({ id: "duplicate", url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "YouTube" });
    const second = content({ id: "second", content_id: "lmnopqrstuv", url: "https://youtu.be/lmnopqrstuv" });
    const third = content({ id: "third", content_id: "0123456789A", url: "https://www.youtube.com/watch?v=0123456789A" });
    expect(selectSecondaryReferenceContents({
      memeId,
      contents: [first, duplicate, second, third],
      sources: [
        source(),
        source({ id: "source-2", source_url: "https://www.youtube.com/watch?v=lmnopqrstuv" }),
        source({ id: "source-3", source_url: "https://youtu.be/0123456789A" }),
      ],
      representative: null,
      limit: 2,
    })).toEqual([first, second]);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])(
    "fails closed for an invalid limit %s",
    (limit) => {
      expect(selectSecondaryReferenceContents({
        memeId,
        contents: [content()],
        sources: [source()],
        representative: null,
        limit,
      })).toEqual([]);
    },
  );

  it("floors fractional limits while preserving the hard cap", () => {
    const second = content({ id: "second", content_id: "lmnopqrstuv", url: "https://youtu.be/lmnopqrstuv" });
    expect(selectSecondaryReferenceContents({
      memeId,
      contents: [content(), second],
      sources: [source(), source({ id: "source-2", source_url: "https://youtu.be/lmnopqrstuv" })],
      representative: null,
      limit: 1.9,
    })).toHaveLength(1);
  });
});
