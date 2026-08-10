import { describe, expect, it } from "vitest";
import {
  buildPlusTranslationFulfillment,
  type PlusTranslationFulfillmentRequestRow,
  type PlusTranslationFulfillmentTranslationRow,
} from "@/lib/plus-translation-fulfillment";

function request(
  id: string,
  status: string,
  locale = "en",
): PlusTranslationFulfillmentRequestRow {
  return {
    id,
    meme_id: `meme-${id}`,
    locale,
    status,
    created_at: "2026-08-09T00:00:00.000Z",
    updated_at: "2026-08-09T01:00:00.000Z",
    completed_at:
      status === "completed" ? "2026-08-09T02:00:00.000Z" : null,
    meme: {
      id: `meme-${id}`,
      short_id: id,
      slug: `source-${id}`,
      title: `Meme ${id}`,
      summary: `Source summary ${id}`,
      description:
        `A detailed definition for ${id} explains the recognizable expression, the context in which people use it, and the social signal it carries in everyday conversation. `.repeat(2),
      origin: `The format for ${id} became popular through online communities and was adapted across several contexts over time.`,
      usage_note: `Use ${id} with the right audience.`,
      caution: `Check the context for ${id}.`,
      usage_examples: [
        { situation: "When a team needs a quick reaction", text: `Use ${id} to make the shared mood explicit.` },
      ],
      meme_sources: [{ source_url: `https://example.com/${id}` }],
      meme_contents: [{ availability: "available", moderation_status: "approved" }],
      meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
      safety_level: "green",
      lifecycle_status: "rising",
      trend_score: 7,
      moderation_status: "approved",
      updated_at: "2026-08-09T00:00:00.000Z",
    },
  };
}

function translation(
  id: string,
  locale = "en",
  sourceUpdatedAt = "2026-08-09T09:00:00+09:00",
): PlusTranslationFulfillmentTranslationRow {
  return {
    meme_id: `meme-${id}`,
    locale,
    status: "reviewed",
    source_updated_at: sourceUpdatedAt,
    localized_slug: `localized-${id}`,
    title: `Localized ${id}`,
    summary: `Summary ${id}`,
    description: `Description ${id}`,
    origin: `Origin ${id}`,
    usage_note: `Localized usage ${id}`,
    caution: `Localized caution ${id}`,
    updated_at: "2026-08-09T02:00:00.000Z",
  };
}

describe("buildPlusTranslationFulfillment", () => {
  it("maps every request status and only marks a current exact-locale completion ready", () => {
    const result = buildPlusTranslationFulfillment({
      requests: [
        request("requested", "requested"),
        request("review", "in_review"),
        request("ready", "completed", "ja"),
        request("stale", "completed"),
        request("dismissed", "dismissed"),
      ],
      translations: [
        translation("ready", "ja"),
        translation("stale", "ja"),
      ],
    });

    expect(result.status).toBe("active");
    expect(
      Object.fromEntries(
        result.items.map((item) => [
          item.requestId,
          [item.requestStatus, item.state],
        ]),
      ),
    ).toEqual({
      ready: ["completed", "ready"],
      stale: ["completed", "stale"],
      dismissed: ["dismissed", "dismissed"],
      review: ["in_review", "in_review"],
      requested: ["requested", "requested"],
    });
    expect(result.items.find((item) => item.requestId === "ready")).toMatchObject({
      slug: "localized-ready",
      title: "Localized ready",
      summary: "Summary ready",
      usageNote: "Localized usage ready",
      caution: "Localized caution ready",
      safetyLevel: "green",
      lifecycleStatus: "rising",
      trendScore: 7,
    });
  });

  it("treats equivalent timestamp strings as the same instant", () => {
    const result = buildPlusTranslationFulfillment({
      requests: [request("ready", "completed", "zh-tw")],
      translations: [translation("ready", "zh-tw")],
    });

    expect(result.items[0]).toMatchObject({
      locale: "zh-tw",
      requestStatus: "completed",
      state: "ready",
    });
  });

  it("keeps completed rows stale for draft, outdated, or wrong-locale translations", () => {
    const draft = { ...translation("draft"), status: "machine" };
    const result = buildPlusTranslationFulfillment({
      requests: [
        request("draft", "completed"),
        request("outdated", "completed"),
        request("wrong-locale", "completed", "ja"),
      ],
      translations: [
        draft,
        translation("outdated", "en", "2026-08-08T00:00:00.000Z"),
        translation("wrong-locale", "en"),
      ],
    });

    expect(result.items.map((item) => item.state)).toEqual([
      "stale",
      "stale",
      "stale",
    ]);
  });

  it("keeps an incomplete reviewed translation stale", () => {
    const incomplete = { ...translation("incomplete"), description: " " };
    const result = buildPlusTranslationFulfillment({
      requests: [request("incomplete", "completed")],
      translations: [incomplete],
    });

    expect(result.items[0]?.state).toBe("stale");
  });

  it("does not mark a completed translation ready when the source is too thin for public indexing", () => {
    const thin = request("thin", "completed");
    thin.meme = {
      ...thin.meme!,
      description: "Short",
      origin: "",
      usage_note: null,
      caution: null,
      usage_examples: [],
      meme_sources: [],
      meme_contents: [],
      meme_tags_map: [],
    };

    const result = buildPlusTranslationFulfillment({
      requests: [thin],
      translations: [translation("thin")],
    });

    expect(result.items[0]?.state).toBe("source_incomplete");
  });

  it("filters invalid locales, non-public memes, and blank identifiers", () => {
    const invalidLocale = request("invalid-locale", "requested", "ko");
    const privateMeme = request("private", "requested");
    privateMeme.meme = { ...privateMeme.meme!, moderation_status: "draft" };
    const blankRequest = request("blank-request", "requested");
    blankRequest.id = " ";
    const blankMeme = request("blank-meme", "requested");
    blankMeme.meme_id = "";
    const blankShortId = request("blank-short", "requested");
    blankShortId.meme = { ...blankShortId.meme!, short_id: " " };
    const blankSlug = request("blank-slug", "requested");
    blankSlug.meme = { ...blankSlug.meme!, slug: "" };
    const publicMeme = request("public", "requested");
    publicMeme.meme = { ...publicMeme.meme!, moderation_status: "limited" };

    const result = buildPlusTranslationFulfillment({
      requests: [
        invalidLocale,
        privateMeme,
        blankRequest,
        blankMeme,
        blankShortId,
        blankSlug,
        publicMeme,
      ],
      translations: [],
    });

    expect(result.items.map((item) => item.requestId)).toEqual(["public"]);
  });

  it("orders newest changes deterministically before applying the bounded limit", () => {
    const alpha = request("alpha", "in_review");
    const beta = request("beta", "in_review");
    const newest = request("newest", "in_review");
    alpha.updated_at = "2026-08-09T01:00:00.000Z";
    beta.updated_at = "2026-08-09T01:00:00.000Z";
    newest.updated_at = "2026-08-09T03:00:00.000Z";

    const result = buildPlusTranslationFulfillment({
      requests: [beta, alpha, newest],
      translations: [],
      limit: 2,
    });

    expect(result.items.map((item) => item.requestId)).toEqual([
      "newest",
      "alpha",
    ]);
  });

  it("distinguishes failed reads from a successful empty result", () => {
    expect(
      buildPlusTranslationFulfillment({ requests: null, translations: [] }),
    ).toEqual({ status: "unavailable", items: [] });
    expect(
      buildPlusTranslationFulfillment({ requests: [], translations: [] }),
    ).toEqual({ status: "empty", items: [] });
  });
});
