import { describe, expect, it } from "vitest";
import { buildMemeMarketPassport } from "@/lib/meme-market-passport";

describe("buildMemeMarketPassport", () => {
  it("only exposes reviewed profiles and does not synthesize an origin", () => {
    const passport = buildMemeMarketPassport({
      memeId: "meme-1",
      profiles: [
        {
          meme_id: "meme-1",
          market_code: "JP",
          language_tag: "ja",
          role: "active",
          local_title: "現地ミーム",
          local_aliases: [],
          usage_note: "友人同士で使います。",
          caution: null,
          review_state: "reviewed",
        },
        {
          meme_id: "meme-1",
          market_code: "US",
          language_tag: "en",
          role: "active",
          local_title: "Unreviewed meme",
          local_aliases: [],
          usage_note: null,
          caution: null,
          review_state: "pending",
        },
      ],
      variants: [],
      targets: [],
    });

    expect(passport.origin).toBeNull();
    expect(passport.profiles.map((profile) => profile.marketCode)).toEqual(["JP"]);
    expect(passport.hasReviewedData).toBe(true);
  });

  it("rejects self links, unreviewed links, and missing targets", () => {
    const passport = buildMemeMarketPassport({
      memeId: "meme-1",
      profiles: [],
      variants: [
        { id: "self", target_meme_id: "meme-1", relation_kind: "local_variant", review_state: "reviewed" },
        { id: "pending", target_meme_id: "meme-2", relation_kind: "local_variant", review_state: "pending" },
        { id: "missing", target_meme_id: "meme-3", relation_kind: "local_variant", review_state: "reviewed" },
        { id: "no-route", target_meme_id: "meme-4", relation_kind: "local_variant", review_state: "reviewed" },
        { id: "valid", target_meme_id: "meme-2", relation_kind: "derived_from", review_state: "reviewed" },
      ],
      targets: [
          {
            id: "meme-2",
            short_id: "m2",
            slug: "local-variant",
            title: "Local variant",
            href: "/en/memes/m2-local-variant",
          },
          { id: "meme-4", short_id: "m4", slug: "no-route", title: "No route contract" },
        ],
      });

    expect(passport.variants).toEqual([
      expect.objectContaining({
        id: "valid",
        relation: "derived_from",
        targetTitle: "Local variant",
        targetHref: "/en/memes/m2-local-variant",
      }),
    ]);
    expect(passport.origin).toBeNull();
    expect(passport.profiles).toEqual([]);
    expect(passport.hasReviewedData).toBe(true);
  });

  it("marks a fallback-only passport as empty instead of reviewed", () => {
    const passport = buildMemeMarketPassport({
      memeId: "meme-1",
      profiles: [],
      variants: [],
      targets: [],
    });

    expect(passport.hasReviewedData).toBe(false);
  });
});
