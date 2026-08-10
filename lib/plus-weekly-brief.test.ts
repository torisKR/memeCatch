import { describe, expect, it } from "vitest";
import {
  buildPlusWeeklyBriefCandidates,
  buildPlusWeeklyDeltaBrief,
  kstDateWindow,
  resolvePlusWeeklyBriefCoverageState,
  type PlusWeeklyBriefCandidate,
  type PlusWeeklyBriefMetric,
  type PlusWeeklyBriefSource,
  type PlusWeeklyBriefTranslation,
} from "@/lib/plus-weekly-brief";

function candidate(
  id: string,
  overrides: Partial<PlusWeeklyBriefCandidate> = {},
): PlusWeeklyBriefCandidate {
  return {
    id,
    shortId: id,
    slug: id,
    title: id,
    summary: `${id} summary`,
    safetyLevel: "green",
    lifecycleStatus: "rising",
    source: "interest",
    ...overrides,
  };
}

function metric(
  meme_id: string,
  date: string,
  trend_score: number,
): PlusWeeklyBriefMetric {
  return { meme_id, date, trend_score };
}

function source(
  id: string,
  overrides: Partial<PlusWeeklyBriefSource> = {},
): PlusWeeklyBriefSource {
  return {
    id,
    short_id: id,
    slug: `${id}-source-slug`,
    title: `${id} source title`,
    summary: `${id} source summary`,
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "rising",
    media_type: "image",
    origin_year: 2026,
    trend_score: 20,
    description: "A sufficiently detailed description of this meme for the public index gate.",
    origin: "This meme became recognizable through repeated public use and reporting.",
    usage_note: "Use this in a familiar conversation where the shared context is clear.",
    caution: null,
    aliases: [],
    usage_examples: [
      { situation: "friends", text: "A concrete example sentence." },
      { situation: "work", text: "A second example with context." },
    ],
    updated_at: "2026-08-08T00:00:00.000Z",
    moderation_status: "approved",
    meme_contents: [{ availability: "live", moderation_status: "approved", thumbnail_url: null, is_representative: true }],
    meme_sources: [{ source_url: "https://example.com/one" }, { source_url: "https://example.com/two" }],
    meme_tags_map: [{ tag_id: "one" }, { tag_id: "two" }, { tag_id: "three" }],
    source: "interest",
    ...overrides,
  };
}

function translation(
  meme_id: string,
  overrides: Partial<PlusWeeklyBriefTranslation> = {},
): PlusWeeklyBriefTranslation {
  return {
    meme_id,
    locale: "en",
    status: "reviewed",
    localized_slug: `${meme_id}-localized-slug`,
    title: `${meme_id} localized title`,
    summary: `${meme_id} localized summary`,
    description: "A localized description with enough meaning for the contract.",
    origin: "A localized origin explanation.",
    source_updated_at: "2026-08-08T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildPlusWeeklyBriefCandidates", () => {
  it("uses only exact reviewed/current/depth-qualified localized candidates", () => {
    const projection = buildPlusWeeklyBriefCandidates({
      locale: "en",
      sources: [
        source("valid"),
        source("thin", {
          description: "short",
          origin: "short",
          usage_note: null,
          usage_examples: [],
          meme_sources: [],
          meme_contents: [],
          meme_tags_map: [],
        }),
        source("private", { moderation_status: "pending" }),
        source("stale"),
        source("incomplete"),
      ],
      translations: [
        translation("valid"),
        translation("thin"),
        translation("private"),
        translation("stale", { source_updated_at: "2026-08-01T00:00:00.000Z" }),
        translation("incomplete", { summary: "" }),
      ],
    });

    expect(projection.state).toBe("active");
    expect(projection.candidates).toEqual([
      expect.objectContaining({
        id: "valid",
        title: "valid localized title",
        slug: "valid-localized-slug",
      }),
    ]);
  });

  it("backfills an eligible candidate after excluded localized coverage", () => {
    const projection = buildPlusWeeklyBriefCandidates({
      locale: "ja",
      sources: [
        source("thin", {
          description: "short",
          origin: "short",
          usage_note: null,
          usage_examples: [],
          meme_sources: [],
          meme_contents: [],
          meme_tags_map: [],
        }),
        source("ready"),
      ],
      translations: [
        translation("thin", { locale: "ja" }),
        translation("ready", { locale: "ja", title: "準備完了" }),
      ],
    });

    expect(projection.candidates.map((candidate) => candidate.id)).toEqual(["ready"]);
    expect(projection.candidates[0]?.title).toBe("準備完了");
  });

  it("does not fall back to Korean source copy when localized coverage is absent", () => {
    const projection = buildPlusWeeklyBriefCandidates({
      locale: "zh-tw",
      sources: [source("source-only")],
      translations: [],
    });

    expect(projection).toEqual({ state: "empty-coverage", candidates: [] });
  });
});

describe("buildPlusWeeklyDeltaBrief", () => {
  it("returns only positive changes and excludes already surfaced ids", () => {
    const brief = buildPlusWeeklyDeltaBrief({
      candidates: [
        candidate("saved", { source: "saved" }),
        candidate("rising"),
        candidate("flat"),
        candidate("unsafe", { safetyLevel: "yellow" }),
      ],
      metrics: [
        metric("saved", "2026-08-01", 10),
        metric("saved", "2026-08-07", 40),
        metric("rising", "2026-08-01", 20),
        metric("rising", "2026-08-07", 65),
        metric("flat", "2026-08-01", 30),
        metric("flat", "2026-08-07", 30),
        metric("unsafe", "2026-08-01", 10),
        metric("unsafe", "2026-08-07", 90),
      ],
      excludedIds: new Set(["saved"]),
      from: "2026-08-01",
      to: "2026-08-07",
    });

    expect(brief.items.map((item) => [item.memeId, item.delta])).toEqual([
      ["rising", 45],
    ]);
    expect(brief.scannedCount).toBe(2);
    expect(brief.emptyReason).toBeNull();
  });

  it("does not manufacture a recommendation without two metric points", () => {
    const brief = buildPlusWeeklyDeltaBrief({
      candidates: [candidate("new")],
      metrics: [metric("new", "2026-08-07", 99)],
      from: "2026-08-01",
      to: "2026-08-07",
    });

    expect(brief.items).toEqual([]);
    expect(brief.emptyReason).toBe("insufficient_history");
  });

  it("reports no change when history exists but all eligible candidates are flat or declining", () => {
    const brief = buildPlusWeeklyDeltaBrief({
      candidates: [candidate("flat"), candidate("declining")],
      metrics: [
        metric("flat", "2026-08-01", 30),
        metric("flat", "2026-08-07", 30),
        metric("declining", "2026-08-01", 40),
        metric("declining", "2026-08-07", 20),
      ],
      from: "2026-08-01",
      to: "2026-08-07",
    });

    expect(brief.items).toEqual([]);
    expect(brief.emptyReason).toBe("no_change");
  });
});

describe("resolvePlusWeeklyBriefCoverageState", () => {
  it("keeps Korean source query errors unavailable instead of empty", () => {
    expect(
      resolvePlusWeeklyBriefCoverageState({
        locale: "ko",
        sourceError: true,
      }),
    ).toBe("unavailable");
  });

  it("keeps a healthy Korean source projection active", () => {
    expect(
      resolvePlusWeeklyBriefCoverageState({
        locale: "ko",
        sourceError: false,
      }),
    ).toBe("active");
  });
});

describe("kstDateWindow", () => {
  it("uses the KST calendar date and a seven-day inclusive window", () => {
    expect(kstDateWindow(new Date("2026-08-08T16:00:00.000Z"))).toEqual({
      from: "2026-08-03",
      to: "2026-08-09",
    });
  });
});
