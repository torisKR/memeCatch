import { describe, expect, it } from "vitest";
import {
  classifyTranslationWorklistSource,
  missingTranslationPriorityMemeIds,
  prioritizeTranslationWorklistRows,
  sortTranslationWorklistRows,
} from "@/lib/translation-worklist";

const richSource = {
  memeId: "meme-rich",
  shortId: "rich",
  title: "충실한 원문",
  updatedAt: "2026-08-09T02:00:00.000Z",
  description: "가".repeat(160),
  origin: "나".repeat(30),
  usage_note: "다".repeat(40),
  caution: "라".repeat(40),
  usage_examples: [
    { situation: "친구", text: "마" },
    { situation: "댓글", text: "바" },
  ],
  meme_sources: [{ source_url: "https://example.com/source" }],
  meme_contents: [{ availability: "live", moderation_status: "approved" }],
  meme_tags_map: [{ tag_id: "tag-1" }, { tag_id: "tag-2" }, { tag_id: "tag-3" }],
};

describe("translation worklist", () => {
  it("marks only an indexable source as a route-unlock candidate", () => {
    expect(classifyTranslationWorklistSource(richSource).routeUnlockCandidate).toBe(true);
    expect(
      classifyTranslationWorklistSource({
        ...richSource,
        memeId: "meme-thin",
        description: "짧은 원문",
        origin: "",
        usage_note: null,
        caution: null,
        usage_examples: [],
        meme_sources: [],
        meme_contents: [],
        meme_tags_map: [],
      }).routeUnlockCandidate,
    ).toBe(false);
  });

  it("sorts route-unlock candidates before thin sources with stable revision ordering", () => {
    const rows = [
      { memeId: "thin-new", updatedAt: "2026-08-10T00:00:00.000Z", routeUnlockCandidate: false },
      { memeId: "ready-old", updatedAt: "2026-08-08T00:00:00.000Z", routeUnlockCandidate: true },
      { memeId: "ready-new", updatedAt: "2026-08-09T00:00:00.000Z", routeUnlockCandidate: true },
      { memeId: "thin-old", updatedAt: "2026-08-08T00:00:00.000Z", routeUnlockCandidate: false },
    ];

    expect(sortTranslationWorklistRows(rows).map((row) => row.memeId)).toEqual([
      "ready-new",
      "ready-old",
      "thin-new",
      "thin-old",
    ]);
  });

  it("moves Plus-priority rows to the front without changing their deterministic order", () => {
    const rows = [
      { memeId: "thin-new", updatedAt: "2026-08-10T00:00:00.000Z", routeUnlockCandidate: false },
      { memeId: "plus-old", updatedAt: "2026-08-08T00:00:00.000Z", routeUnlockCandidate: false },
      { memeId: "ready-new", updatedAt: "2026-08-09T00:00:00.000Z", routeUnlockCandidate: true },
      { memeId: "plus-new", updatedAt: "2026-08-09T00:00:00.000Z", routeUnlockCandidate: false },
    ];

    expect(
      prioritizeTranslationWorklistRows(rows, new Set(["plus-old", "plus-new"])).map(
        (row) => row.memeId,
      ),
    ).toEqual(["plus-new", "plus-old", "ready-new", "thin-new"]);
  });

  it("keeps missing Plus requests locale-scoped across every SEO locale", () => {
    const rows = [
      { memeId: "en-missing", locale: "en", translationStatus: null },
      { memeId: "en-machine", locale: "en", translationStatus: "machine" },
      { memeId: "ja-missing", locale: "ja", translationStatus: null },
      { memeId: "zh-ready", locale: "zh", translationStatus: "reviewed" },
    ];

    expect(missingTranslationPriorityMemeIds(rows, "en")).toEqual(["en-missing"]);
    expect(missingTranslationPriorityMemeIds(rows, "ja")).toEqual(["ja-missing"]);
    expect(missingTranslationPriorityMemeIds(rows, "zh")).toEqual([]);
  });
});
