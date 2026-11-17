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
  it.each([
    ["YouTube watch", "youtube", "abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk", "https://www.youtube.com/shorts/abcdefghijk"],
    ["YouTube shorts", "youtube_shorts", "abcdefghijk", "https://www.youtube.com/shorts/abcdefghijk", "https://www.youtube.com/watch?v=abcdefghijk"],
    ["TikTok alias", "tiktok", "1234567890123456789", "https://www.tiktok.com/@old/video/1234567890123456789", "https://www.tiktok.com/@new/video/1234567890123456789"],
    ["Instagram path", "instagram", "Post123", "https://www.instagram.com/p/Post123/", "https://www.instagram.com/reel/Post123/"],
  ].flatMap(([label, platform, id, ledgerUrl, contentUrl]) => [false, true].map((embeddable) => ({ label, platform, id, ledgerUrl, contentUrl, embeddable }))))("enforces link-only rights for $label with embeddable=$embeddable", ({ platform, id, ledgerUrl, contentUrl, embeddable }) => {
    const item = liveContent({ platform, content_id: id, url: contentUrl, is_representative: true });
    const source = reviewedYouTube({ platform, external_id: id, canonical_url: ledgerUrl, rights_basis: "link_only", embeddable, last_checked_at: "2020-01-01T00:00:00.000Z" });
    const result = resolveMemeDelivery({ contents: [item], sources: [], reviewedMediaSources: [source] });
    expect(result.representative).toEqual(item);
    expect(result.embeddingAllowed).toBe(false);
    expect(result.embeddableContents).toEqual([]);
    expect(result.fallbackSourceUrl).toBe(contentUrl);
  });
  it.each([
    { removed_at: "2026-01-01T00:00:00Z" }, { public_status: "private" }, { public_status: "unlisted" }, { review_state: "removed" }, { review_state: "rejected" },
  ].flatMap((restriction) => [false, true].map((embeddable) => ({ ...restriction, embeddable }))))("retains restriction $public_status $review_state $removed_at with link-only rights", (restriction) => {
    const item = liveContent({ is_representative: true });
    const result = resolveMemeDelivery({ contents: [item], sources: [{ source_url: item.url }], reviewedMediaSources: [reviewedYouTube({ rights_basis: "link_only", ...restriction })] });
    expect(result.representative).toBeNull();
    expect(result.sourceLinks).toEqual([]);
  });
  it("does not select an arbitrary representative among distinct nonrepresentative videos", () => {
    const first = liveContent({ id: "first", type: "video", is_representative: false });
    const second = liveContent({ id: "second", type: "video", is_representative: false, content_id: "lmnopqrstuv", url: "https://www.youtube.com/watch?v=lmnopqrstuv" });
    for (const contents of [[first, second], [second, first]]) {
      const result = resolveMemeDelivery({ contents, sources: [] });
      expect(result.representative).toBeNull();
      expect(result.representativeAmbiguous).toBe(true);
      expect(result.embeddableContents).toHaveLength(2);
    }
  });

  it("keeps duplicate rows for one video as one identity", () => {
    const first = liveContent({ id: "first", type: "video" });
    const duplicate = liveContent({ id: "second", type: "video", url: "https://youtu.be/abcdefghijk" });
    const result = resolveMemeDelivery({ contents: [first, duplicate], sources: [] });
    expect(result.representative?.content_id).toBe("abcdefghijk");
    expect(result.representativeAmbiguous).toBe(false);
  });

  it("withholds the representative if another video identity cannot be verified", () => {
    const known = liveContent({ id: "known", type: "video" });
    const unknown = liveContent({ id: "other", type: "video", platform: "Facebook", content_id: "facebook-id", url: "https://www.facebook.com/video/123" });
    const result = resolveMemeDelivery({ contents: [known, unknown], sources: [] });
    expect(result.representative).toBeNull();
    expect(result.representativeAmbiguous).toBe(true);
  });

  it("does not let an unverified Instagram post veto the unique video", () => {
    const known = liveContent({ id: "known", type: "video" });
    const post = liveContent({ id: "post", type: "embed", platform: "Instagram", content_id: "Post123", url: "https://www.instagram.com/p/Post123/", manual_video_verified: false });
    expect(resolveMemeDelivery({ contents: [post, known], sources: [] }).representative).toEqual(known);
  });
  it.each([
    ["blocked rights", { rights_basis: "blocked" }],
    ["rejected review", { review_state: "rejected" }],
    ["private", { public_status: "private" }],
    ["removed", { removed_at: "2026-11-18T00:00:00.000Z" }],
    ["not embeddable", { embeddable: false }],
  ])("suppresses all TikTok account aliases for a single source with %s", (_reason, override) => {
    const id = "1234567890123456789";
    const source = reviewedYouTube({ platform: "tiktok", external_id: id, canonical_url: `https://www.tiktok.com/@old/video/${id}`, embeddable: true, public_status: null, ...override });
    const contents = ["old", "new"].map((account) => liveContent({ id: account, platform: "TikTok", content_id: id, url: `https://www.tiktok.com/@${account}/video/${id}` }));
    for (const content of contents) {
      const result = resolveMemeDelivery({ contents: [content], sources: [{ source_url: content.url }], reviewedMediaSources: [source] });
      expect(result.representative).toBeNull();
      expect(result.sourceLinks).toEqual([]);
    }
  });

  it("permits both TikTok aliases for one approved embeddable source", () => {
    const id = "1234567890123456789";
    const source = reviewedYouTube({ platform: "tiktok", external_id: id, canonical_url: `https://www.tiktok.com/@old/video/${id}`, embeddable: true, public_status: null });
    for (const account of ["old", "new"]) {
      const content = liveContent({ platform: "TikTok", content_id: id, url: `https://www.tiktok.com/@${account}/video/${id}` });
      const result = resolveMemeDelivery({ contents: [content], sources: [], reviewedMediaSources: [source] });
      expect(result.representative).toEqual(content);
      expect(result.embeddingAllowed).toBe(true);
    }
  });

  it("applies restrictive Instagram evidence by identity across post paths", () => {
    const source = reviewedYouTube({ platform: "instagram", external_id: "Post123", canonical_url: "https://www.instagram.com/p/Post123/", embeddable: true, public_status: null, rights_basis: "blocked" });
    const post = liveContent({ platform: "Instagram", content_id: "Post123", url: source.canonical_url });
    const reel = { ...post, url: "https://www.instagram.com/reel/Post123/" };
    expect(resolveMemeDelivery({ contents: [post], sources: [], reviewedMediaSources: [source] }).representative).toBeNull();
    expect(resolveMemeDelivery({ contents: [reel], sources: [], reviewedMediaSources: [source] }).representative).toBeNull();
  });

  it("does not use an Instagram approval from another path as positive evidence", () => {
    const source = reviewedYouTube({ platform: "instagram", external_id: "Post123", canonical_url: "https://www.instagram.com/p/Post123/", embeddable: true, public_status: null });
    const post = liveContent({ platform: "Instagram", content_id: "Post123", url: source.canonical_url });
    const reel = { ...post, url: "https://www.instagram.com/reel/Post123/" };
    expect(resolveMemeDelivery({ contents: [post], sources: [], reviewedMediaSources: [source] }).representative).toEqual(post);
    // With no exact row, the legacy approved-content fallback remains intact.
    expect(resolveMemeDelivery({ contents: [reel], sources: [], reviewedMediaSources: [source] }).representative).toEqual(reel);
  });

  it("normalizes harmless Instagram URL variants without hiding the verified post", () => {
    const source = reviewedYouTube({ platform: "instagram", external_id: "Post123", canonical_url: "https://www.instagram.com/p/Post123/", embeddable: true, public_status: null });
    const post = liveContent({ platform: "Instagram", content_id: "Post123", url: "https://instagram.com/p/Post123/?utm_source=share", manual_video_verified: true });
    expect(resolveMemeDelivery({ contents: [post], sources: [], reviewedMediaSources: [source] }).representative).toEqual(post);
  });

  it("does not apply an unrelated Instagram shortcode's block to a different post", () => {
    const source = reviewedYouTube({ platform: "instagram", external_id: "Other456", canonical_url: "https://www.instagram.com/p/Other456/", embeddable: true, public_status: null, rights_basis: "blocked" });
    const reel = liveContent({ platform: "Instagram", content_id: "Post123", url: "https://www.instagram.com/reel/Post123/" });
    expect(resolveMemeDelivery({ contents: [reel], sources: [], reviewedMediaSources: [source] }).representative).toEqual(reel);
  });

  it("applies an Instagram block even if the ledger URL is HTTP", () => {
    const source = reviewedYouTube({ platform: "instagram", external_id: "Post123", canonical_url: "http://www.instagram.com/p/Post123/", embeddable: true, public_status: null, rights_basis: "blocked" });
    const reel = liveContent({ platform: "Instagram", content_id: "Post123", url: "https://www.instagram.com/reel/Post123/" });
    expect(resolveMemeDelivery({ contents: [reel], sources: [], reviewedMediaSources: [source] }).representative).toBeNull();
  });

  it.each([
    ["http canonical URL", { canonical_url: "http://www.youtube.com/watch?v=abcdefghijk", rights_basis: "blocked" }],
    ["mismatched canonical ID", { canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv", rights_basis: "blocked" }],
    ["invalid rights", { rights_basis: "bad-rights" }],
    ["invalid review state", { review_state: "bad-state" }],
    ["invalid public status", { public_status: "bad-status" }],
    ["invalid embeddable value", { embeddable: "false" }],
    ["invalid platform", { platform: "bad-platform", rights_basis: "blocked" }],
    ["invalid positive canonical", { canonical_url: "http://www.youtube.com/watch?v=abcdefghijk" }],
  ])("fails closed on matching identity with %s", (_label, override) => {
    const item = liveContent({ is_representative: true });
    const source = reviewedYouTube({ embeddable: true, ...override });
    const result = resolveMemeDelivery({ contents: [item], sources: [], reviewedMediaSources: [source] });
    expect(result.representative).toBeNull();
    expect(result.embeddableContents).toEqual([]);
  });

  it("does not interpret a corrupt content availability as live", () => {
    const item = liveContent({ availability: "deleted", is_representative: true });
    expect(resolveMemeDelivery({ contents: [item], sources: [], reviewedMediaSources: [] }).representative).toBeNull();
  });

  it.each([
    { content: "https://www.youtube.com/shorts/abcdefghijk", ledger: "https://www.youtube.com/watch?v=abcdefghijk", platform: "youtube" },
    { content: "https://youtu.be/abcdefghijk", ledger: "https://www.youtube.com/shorts/abcdefghijk", platform: "youtube_shorts" },
  ])("applies link-only policy across YouTube URL variants", ({ content, ledger, platform }) => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ url: content })],
      sources: [],
      reviewedMediaSources: [reviewedYouTube({ canonical_url: ledger, platform })],
    });
    expect(result.representative).not.toBeNull();
    expect(result.embeddingAllowed).toBe(false);
    expect(result.fallbackSourceUrl).toBe(content);
  });

  it("suppresses a YouTube row whose URL and content ID disagree", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ url: "https://www.youtube.com/shorts/ZYXWVUTSRQP" })],
      sources: [],
      reviewedMediaSources: [reviewedYouTube({ review_state: "rejected" })],
    });
    expect(result.representative).toBeNull();
    expect(result.sourceLinks).toEqual([]);
  });
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
      representativeAmbiguous: false,
      renderableContents: [],
      embeddableContents: [],
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
    expect(result.embeddableContents).toEqual([]);
    expect(result.embeddingAllowed).toBe(false);
    expect(result.fallbackReason).toBeNull();
    expect(result.fallbackSourceUrl).toBe(
      "https://www.youtube.com/watch?v=abcdefghijk",
    );
  });

  it("does not restore a dead projection even with fresh public non-embeddable evidence", () => {
    const now = Date.parse("2026-11-17T12:00:00.000Z");
    const result = resolveMemeDelivery({
      contents: [liveContent({ availability: "dead", is_representative: true })],
      sources: [],
      reviewedMediaSources: [reviewedYouTube({ last_checked_at: "2026-11-17T11:00:00.000Z" })],
      now,
    });

    expect(result.representative).toBeNull();
    expect(result.fallbackSourceUrl).toBeNull();
    expect(result.fallbackReason).toBe("confirmed_unavailable");
  });

  it("does not revive a dead projection merely because rights are link-only", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ availability: "dead", is_representative: true })],
      sources: [],
      reviewedMediaSources: [reviewedYouTube({ rights_basis: "link_only", embeddable: true, last_checked_at: "2026-11-17T11:00:00.000Z" })],
      now: Date.parse("2026-11-17T12:00:00.000Z"),
    });
    expect(result.representative).toBeNull();
    expect(result.sourceLinks).toEqual([]);
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

  it("does not apply an unrelated platform ledger row", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ is_representative: true })],
      sources: [],
      reviewedMediaSources: [reviewedYouTube({ platform: "instagram", canonical_url: "https://www.instagram.com/p/abcdefghijk/" })],
    });

    expect(result.embeddingAllowed).toBe(true);
    expect(result.representative?.id).toBe("live-1");
  });

  it.each([
    ["content ID", { external_id: "lmnopqrstuv" }],
    ["canonical URL", { canonical_url: "https://www.youtube.com/watch?v=lmnopqrstuv" }],
  ])("fails closed on an identity conflict in %s", (_label, sourceOverride) => {
    const result = resolveMemeDelivery({ contents: [liveContent({ is_representative: true })], sources: [], reviewedMediaSources: [reviewedYouTube(sourceOverride)] });
    expect(result.representative).toBeNull();
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

  it("fails closed for external embeds and source links when the ledger lookup fails", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ is_representative: true })],
      sources: [{ source_url: "https://namu.wiki/w/context", platform: "Community" }],
      reviewedMediaSources: { ok: false, sources: [] },
    });

    expect(result.representative).toBeNull();
    expect(result.renderableContents).toEqual([]);
    expect(result.embeddableContents).toEqual([]);
    expect(result.sourceLinks).toEqual([]);
    expect(result.publicSources).toEqual([]);
    expect(result.fallbackReason).toBe("no_playback_reference");
  });

  it("does not embed a YouTube ID without a URL when the ledger lookup fails", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ platform: "YouTube", content_id: "abcdefghijk", url: null })],
      sources: [],
      reviewedMediaSources: { ok: false, sources: [] },
    });

    expect(result.representative).toBeNull();
    expect(result.embeddableContents).toEqual([]);
  });

  it("uses a reviewed original link for an ID-only public non-embeddable video", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ url: null, is_representative: true })],
      sources: [],
      reviewedMediaSources: { ok: true, sources: [reviewedYouTube()] },
    });

    expect(result.representative?.id).toBe("live-1");
    expect(result.embeddingAllowed).toBe(false);
    expect(result.fallbackSourceUrl).toBe("https://www.youtube.com/watch?v=abcdefghijk");
  });

  it("filters a blocked ID-only video's source URL from fallback links", () => {
    const url = "https://www.youtube.com/watch?v=abcdefghijk";
    const result = resolveMemeDelivery({
      contents: [liveContent({ url: null })],
      sources: [{ source_url: url, platform: "YouTube" }],
      reviewedMediaSources: { ok: true, sources: [reviewedYouTube({ rights_basis: "blocked" })] },
    });

    expect(result.representative).toBeNull();
    expect(result.sourceLinks).toEqual([]);
    expect(result.fallbackSourceUrl).toBeNull();
  });

  it("preserves legacy delivery after a successful empty ledger lookup", () => {
    const result = resolveMemeDelivery({
      contents: [liveContent({ is_representative: true })],
      sources: [],
      reviewedMediaSources: { ok: true, sources: [] },
    });

    expect(result.representative?.id).toBe("live-1");
    expect(result.renderableContents).toHaveLength(1);
    expect(result.embeddableContents).toHaveLength(1);
  });

  it.each(["pending", "blocked", "rejected", "removed", "unknown"])(
    "lets an exact %s row restrict conflicting approved evidence",
    (reviewState) => {
      const result = resolveMemeDelivery({
        contents: [liveContent({ is_representative: true })],
        sources: [],
        reviewedMediaSources: [
          reviewedYouTube({ embeddable: true }),
          reviewedYouTube({ review_state: reviewState, embeddable: true }),
        ],
      });

      expect(result.representative).toBeNull();
      expect(result.renderableContents).toEqual([]);
    },
  );

  it.each(["unknown", "blocked"])(
    "lets exact %s rights restrict conflicting approved evidence",
    (rightsBasis) => {
      const result = resolveMemeDelivery({
        contents: [liveContent({ is_representative: true })],
        sources: [],
        reviewedMediaSources: [
          reviewedYouTube({ embeddable: true }),
          reviewedYouTube({ rights_basis: rightsBasis, embeddable: true }),
        ],
      });

      expect(result.representative).toBeNull();
      expect(result.renderableContents).toEqual([]);
    },
  );

  it.each(["tiktok", "instagram"])(
    "keeps an approved live %s embed visible when re-ingest resets public status to unknown",
    (platform) => {
      const url = platform === "tiktok"
        ? "https://www.tiktok.com/@creator/video/1234567890"
        : "https://www.instagram.com/reel/AbC123/";
      const contentId = platform === "tiktok" ? "1234567890" : "AbC123";
      const result = resolveMemeDelivery({
        contents: [liveContent({ platform, content_id: contentId, url, is_representative: true })],
        sources: [],
        reviewedMediaSources: [{
          ...reviewedYouTube(),
          platform,
          external_id: contentId,
          canonical_url: url,
          embeddable: true,
          public_status: "unknown",
        }],
      });

      expect(result.representative?.id).toBe("live-1");
      expect(result.renderableContents).toHaveLength(1);
      expect(result.embeddableContents).toHaveLength(1);
      expect(result.fallbackReason).toBeNull();
    },
  );
});
