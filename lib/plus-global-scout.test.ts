import { describe, expect, it } from "vitest";
import {
  buildPlusGlobalScoutDeck,
  buildPlusGlobalScoutEvidenceDeck,
  type PlusGlobalScoutSourceRow,
  type PlusGlobalScoutTranslationRow,
} from "@/lib/plus-global-scout";
import {
  MAX_USAGE_EXAMPLE_SITUATION_LENGTH,
  MAX_USAGE_EXAMPLE_TEXT_LENGTH,
  parseUsageExamples,
} from "@/lib/usage-examples";

function source(
  id: string,
  overrides: Partial<PlusGlobalScoutSourceRow> = {},
): PlusGlobalScoutSourceRow {
  return {
    id,
    short_id: `short-${id}`,
    slug: `canonical-${id}`,
    title: `한국어 제목 ${id}`,
    summary: `한국어 요약 ${id}`,
    description: `한국어 설명 ${id} `.repeat(40),
    origin: `한국어 유래 ${id} `.repeat(12),
    usage_note: `한국어 사용법 ${id} `.repeat(5),
    caution: `한국어 주의 ${id} `.repeat(5),
    usage_examples: [
      { situation: "친구와", text: `한국어 예문 ${id}` },
      { situation: "대화방", text: `한국어 예문 둘 ${id}` },
    ],
    meme_sources: [
      { source_url: `https://example.com/${id}/1` },
      { source_url: `https://example.com/${id}/2` },
    ],
    meme_contents: [{ availability: "live", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "one" }, { tag_id: "two" }, { tag_id: "three" }],
    moderation_status: "approved",
    safety_level: "green",
    lifecycle_status: "rising",
    trend_score: 50,
    updated_at: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

function translation(
  memeId: string,
  locale: string,
  overrides: Partial<PlusGlobalScoutTranslationRow> = {},
): PlusGlobalScoutTranslationRow {
  return {
    meme_id: memeId,
    locale,
    status: "reviewed",
    localized_slug: `${locale}-${memeId}`,
    title: `${locale} title ${memeId}`,
    summary: `${locale} summary ${memeId}`,
    description: `${locale} description ${memeId}`,
    origin: `${locale} origin ${memeId}`,
    usage_note: `${locale} usage ${memeId}`,
    caution: `${locale} caution ${memeId}`,
    source_updated_at: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

function build(
  sources: readonly PlusGlobalScoutSourceRow[],
  overrides: Partial<Parameters<typeof buildPlusGlobalScoutDeck>[0]> = {},
) {
  return buildPlusGlobalScoutDeck({
    locale: "ko",
    dateKey: "2026-08-09",
    sources,
    translations: [],
    ...overrides,
  });
}

describe("buildPlusGlobalScoutDeck", () => {
  it("keeps only public, safe, current sources with complete canonical fields", () => {
    const valid = source("valid");
    const deck = build([
      valid,
      source("limited-yellow-active", {
        moderation_status: "limited",
        safety_level: "yellow",
        lifecycle_status: "active",
      }),
      source("pending", { moderation_status: "pending" }),
      source("red", { safety_level: "red" }),
      source("gray", { safety_level: "gray" }),
      source("cooling", { lifecycle_status: "cooling" }),
      source("archived", { lifecycle_status: "archived" }),
      source("missing", { origin: "  " }),
    ]);

    expect(deck.map((item) => item.id).sort()).toEqual([
      "limited-yellow-active",
      "valid",
    ]);
  });

  it("rejects sources that would fail the public detail depth gate", () => {
    expect(
      build([
        source("thin", {
          description: "짧은 설명",
          origin: "",
          usage_note: null,
          caution: null,
          usage_examples: null,
          meme_sources: [],
          meme_contents: [],
          meme_tags_map: [],
        }),
        source("dead", {
          description: "짧은 설명",
          origin: "",
          usage_note: null,
          caution: null,
          usage_examples: null,
          meme_sources: [],
          meme_contents: [{ availability: "dead", moderation_status: "approved" }],
          meme_tags_map: [],
        }),
      ]),
    ).toEqual([]);
  });

  it("uses the Korean canonical source and only the exact current reviewed locale", () => {
    const meme = source("one");
    const english = translation("one", "en", {
      localized_slug: "english-slug",
      source_updated_at: "2026-08-09T09:00:00+09:00",
    });

    expect(build([meme])[0]).toMatchObject({
      slug: "canonical-one",
      title: "한국어 제목 one",
      locale: "ko",
    });
    expect(build([meme], { locale: "en", translations: [english] })[0]).toMatchObject({
      slug: "english-slug",
      title: "en title one",
      locale: "en",
      sourceUpdatedAt: meme.updated_at,
    });
  });

  it.each([
    ["missing", []],
    ["wrong locale", [translation("one", "ja")]],
    ["machine", [translation("one", "en", { status: "machine" })]],
    ["stale", [translation("one", "en", { source_updated_at: "2026-08-08T00:00:00.000Z" })]],
    ["incomplete", [translation("one", "en", { description: " " })]],
    ["missing localized slug", [translation("one", "en", { localized_slug: " " })]],
  ])("does not fallback for a %s translation", (_case, translations) => {
    expect(build([source("one")], { locale: "en", translations })).toEqual([]);
  });

  it("rotates deterministically by KST date while preserving input-order independence", () => {
    const rows = [
      source("a", { trend_score: 80 }),
      source("b", { trend_score: 100 }),
      source("c", { trend_score: 80 }),
      source("d", { trend_score: 80 }),
    ];

    const first = build(rows);
    const repeated = build(rows);
    const reordered = build([...rows].reverse());

    expect(first).toEqual(repeated);
    expect(first).toEqual(reordered);
    expect(first.map((item) => item.id)).toEqual(repeated.map((item) => item.id));
    expect(first.map((item) => item.id)).toEqual(reordered.map((item) => item.id));

    const nextDay = build(rows, { dateKey: "2026-08-10" });
    expect(nextDay.map((item) => item.id)).not.toEqual(first.map((item) => item.id));
    expect(new Set(first.map((item) => item.id))).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("deduplicates IDs and clamps the requested limit to five", () => {
    const rows = Array.from({ length: 7 }, (_, index) =>
      source(`meme-${index}`, { trend_score: 100 - index }),
    );

    const deck = build([rows[0], rows[0], ...rows.slice(1)], { limit: 99 });

    expect(deck).toHaveLength(5);
    expect(new Set(deck.map((item) => item.id)).size).toBe(5);
    expect(build(rows, { limit: 2 })).toHaveLength(2);
    expect(build(rows, { limit: -1 })).toEqual([]);
  });

  it("lets the internal evidence deck request at most twenty with exact UI ordering parity", () => {
    const rows = Array.from({ length: 24 }, (_, index) =>
      source(`meme-${index}`, { trend_score: 100 - index }),
    );
    const input = {
      locale: "ko" as const,
      dateKey: "2026-08-09",
      sources: rows,
      translations: [],
    };

    const ui = buildPlusGlobalScoutDeck({ ...input, limit: 20 });
    const evidence = buildPlusGlobalScoutEvidenceDeck({ ...input, limit: 99 });

    expect(ui).toHaveLength(5);
    expect(evidence).toHaveLength(20);
    expect(evidence.slice(0, 5)).toEqual(ui);
  });

  it("preserves optional usage and caution without making them eligibility gates", () => {
    const meme = source("one", { usage_note: null, caution: null });
    const localized = translation("one", "zh-tw", {
      usage_note: null,
      caution: "在公開場合使用前請確認語境。",
    });

    expect(build([meme])[0]).toMatchObject({ usageNote: null, caution: null });
    expect(build([meme], { locale: "zh-tw", translations: [localized] })[0]).toMatchObject({
      usageNote: null,
      caution: "在公開場合使用前請確認語境。",
    });
  });

  it("carries only the canonical or exact current reviewed locale examples", () => {
    const meme = source("examples");
    const english = translation("examples", "en", {
      usage_examples: [
        { situation: "English chat", text: "Use the reviewed English line." },
      ],
    });

    expect(build([meme])[0]?.usageExamples).toEqual(meme.usage_examples);
    expect(build([meme], { locale: "en", translations: [english] })[0]?.usageExamples).toEqual([
      { situation: "English chat", text: "Use the reviewed English line." },
    ]);
  });

  it("projects only bounded usage example fields", () => {
    const parsed = parseUsageExamples([
      {
        situation: "Keep this situation",
        text: "Keep this line",
        private_note: "must not cross the DTO boundary",
      },
      {
        situation: "s".repeat(MAX_USAGE_EXAMPLE_SITUATION_LENGTH + 1),
        text: "too long",
      },
      {
        situation: "Too long text",
        text: "t".repeat(MAX_USAGE_EXAMPLE_TEXT_LENGTH + 1),
      },
    ]);

    expect(parsed).toEqual([{ situation: "Keep this situation", text: "Keep this line" }]);
    expect(parsed[0]).not.toHaveProperty("private_note");
  });
});
