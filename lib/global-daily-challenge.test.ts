import { describe, expect, it } from "vitest";
import {
  buildGlobalDailyCandidate,
  buildGlobalDailyQuestions,
  globalDailyDate,
  isValidGlobalDailyQuestion,
  projectGlobalDailyOneCutCandidate,
  type GlobalDailyBaseMeme,
  type GlobalDailyTranslation,
} from "@/lib/global-daily-challenge";

function base(overrides: Partial<GlobalDailyBaseMeme> = {}): GlobalDailyBaseMeme {
  return {
    id: "meme-1",
    short_id: "abc123",
    slug: "global-meme",
    title: "Global Meme",
    summary: "A sufficiently long Korean source summary for the daily challenge.",
    description: "A reviewed explanation of the meme and how people use it. This source-backed context explains the phrase, its audience, and the situations where it appears in current conversation.",
    origin: "The source history is recorded in the Korean editorial document, with a dated explanation of how the phrase moved from its original community into wider use.",
    usage_note: "Use it only when the surrounding conversation makes the intended tone clear. ".repeat(2),
    caution: "Check the relationship and context before using it with someone unfamiliar. ".repeat(2),
    usage_examples: [
      { situation: "A casual group chat", text: "Use the phrase after the context has already been established." },
    ],
    meme_sources: [{ source_url: "https://example.com/global-meme-source" }],
    meme_contents: [{ availability: "available", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
    category: "phrase",
    origin_year: 2024,
    safety_level: "green",
    lifecycle_status: "rising",
    moderation_status: "approved",
    updated_at: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

function translation(locale: string, overrides: Partial<GlobalDailyTranslation> = {}): GlobalDailyTranslation {
  return {
    meme_id: "meme-1",
    locale,
    status: "reviewed",
    localized_slug: `global-meme-${locale}`,
    title: `Global Meme ${locale}`,
    summary: `A sufficiently long ${locale} summary for the daily challenge.`,
    description: `A reviewed ${locale} explanation of the meme and how people use it.`,
    origin: `The ${locale} source history is recorded in the editorial document.`,
    source_updated_at: "2026-08-09T00:00:00.000Z",
    ...overrides,
  };
}

const allTranslations = [translation("en"), translation("ja"), translation("zh"), translation("zh-tw")];

describe("Global Meme Daily contract", () => {
  it("uses the KST calendar boundary", () => {
    expect(globalDailyDate(new Date("2026-08-09T14:59:59.999Z"))).toBe("2026-08-09");
    expect(globalDailyDate(new Date("2026-08-09T15:00:00.000Z"))).toBe("2026-08-10");
  });

  it("requires reviewed, current, complete content and an indexable source", () => {
    const candidate = buildGlobalDailyCandidate(base(), allTranslations);
    expect(candidate?.locales).toEqual(expect.objectContaining({ ko: expect.anything(), en: expect.anything(), ja: expect.anything(), zh: expect.anything(), "zh-tw": expect.anything() }));

    expect(buildGlobalDailyCandidate(base(), allTranslations.filter((row) => row.locale !== "zh"))).toBeNull();
    expect(buildGlobalDailyCandidate(base(), [
      ...allTranslations.filter((row) => row.locale !== "ja"),
      translation("ja", { status: "machine" }),
    ])).toBeNull();
    expect(buildGlobalDailyCandidate(base(), [
      ...allTranslations.filter((row) => row.locale !== "zh"),
      translation("zh", { source_updated_at: "2026-08-08T00:00:00Z" }),
    ])).toBeNull();
    expect(buildGlobalDailyCandidate(base(), [
      ...allTranslations.filter((row) => row.locale !== "en"),
      translation("en", { description: "   " }),
    ])).toBeNull();
    expect(buildGlobalDailyCandidate(base({
      description: "too short",
      origin: "short",
      usage_note: null,
      caution: null,
      usage_examples: [],
      meme_sources: [],
      meme_contents: [],
      meme_tags_map: [],
    }), allTranslations)).toBeNull();
  });

  it("keeps question selection stable regardless of candidate order", () => {
    const candidates = Array.from({ length: 12 }, (_, index) => {
      const itemBase = base({
        id: `meme-${String(index).padStart(2, "0")}`,
        short_id: `abc${String(index).padStart(3, "0")}`,
        slug: `global-meme-${index}`,
        title: `Global Meme ${index}`,
        summary: `A sufficiently long summary for global meme number ${index}, with distinct context.`,
      });
      const rows = allTranslations.map((row) => ({
        ...row,
        meme_id: itemBase.id,
        localized_slug: `${itemBase.slug}-${row.locale}`,
        title: `${itemBase.title} ${row.locale}`,
        summary: `A sufficiently long ${row.locale} summary for global meme number ${index}, with distinct context.`,
      }));
      return buildGlobalDailyCandidate(itemBase, rows)!;
    });

    const first = buildGlobalDailyQuestions(candidates, "en", "2026-08-09");
    const second = buildGlobalDailyQuestions([...candidates].reverse(), "en", "2026-08-09");
    expect(first).toEqual(second);
    expect(first).toHaveLength(3);
    expect(first.every((question) => question.meme.id?.startsWith("meme-"))).toBe(true);
    expect(first.every((question) => question.options)).toBe(true);
  });

  it("fails closed for malformed question answer contracts", () => {
    const candidates = Array.from({ length: 12 }, (_, index) => {
      const itemBase = base({
        id: `meme-${String(index).padStart(2, "0")}`,
        short_id: `abc${String(index).padStart(3, "0")}`,
        slug: `global-meme-${index}`,
        title: `Global Meme ${index}`,
      });
      return buildGlobalDailyCandidate(
        itemBase,
        allTranslations.map((row) => ({
          ...row,
          meme_id: itemBase.id,
          title: `${row.title} ${index}`,
          summary: `${row.summary} ${index}`,
        })),
      )!;
    });
    const question = buildGlobalDailyQuestions(candidates, "en", "2026-08-09")[0]!;

    expect(question).toBeTruthy();
    expect(isValidGlobalDailyQuestion(question)).toBe(true);
    expect(isValidGlobalDailyQuestion({ ...question, answerIndex: question.options.length })).toBe(false);
    expect(isValidGlobalDailyQuestion({ ...question, options: question.options.slice(0, 3) })).toBe(false);
  });

  it("projects only current, usable Global Daily candidates into One-Cut", () => {
    const candidate = buildGlobalDailyCandidate(base(), allTranslations);
    expect(projectGlobalDailyOneCutCandidate(candidate, "ja")).toMatchObject({
      memeId: "meme-1",
      shortId: "abc123",
      slug: "global-meme-ja",
      locale: "ja",
      safetyLevel: "green",
      lifecycleStatus: "rising",
    });
    expect(
      projectGlobalDailyOneCutCandidate(
        buildGlobalDailyCandidate(base({ safety_level: "red" }), allTranslations),
        "en",
      ),
    ).toBeNull();
    expect(
      projectGlobalDailyOneCutCandidate(
        buildGlobalDailyCandidate(base({ lifecycle_status: "cooling" }), allTranslations),
        "en",
      ),
    ).toBeNull();
    expect(
      projectGlobalDailyOneCutCandidate(
        candidate
          ? { ...candidate, locales: { ...candidate.locales, en: { ...candidate.locales.en, summary: "" } } }
          : null,
        "en",
      ),
    ).toBeNull();
  });
});
