import { describe, expect, it } from "vitest";
import { buildSavedContextWatch } from "@/lib/saved-context-watch";

const base = {
  id: "meme-1",
  shortId: "meme-1",
  slug: "meme-one",
  title: "Meme one",
  savedAt: "2026-08-08T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
  translation: null,
};

describe("buildSavedContextWatch", () => {
  it("surfaces a reviewed translation when it is current for the saved meme", () => {
    const [item] = buildSavedContextWatch([
      {
        ...base,
        translation: {
          locale: "en",
          status: "reviewed",
          sourceUpdatedAt: "2026-08-08T00:00:00.000Z",
          updatedAt: "2026-08-09T01:00:00.000Z",
        },
      },
    ]);

    expect(item).toMatchObject({
      kind: "translation_reviewed",
      locale: "en",
      changedAt: "2026-08-09T01:00:00.000Z",
    });
  });

  it("prioritizes a stale translation over a generic editorial update", () => {
    const [item] = buildSavedContextWatch([
      {
        ...base,
        updatedAt: "2026-08-09T02:00:00.000Z",
        translation: {
          locale: "ja",
          status: "stale",
          sourceUpdatedAt: "2026-08-08T00:00:00.000Z",
          updatedAt: "2026-08-09T02:00:00.000Z",
        },
      },
    ]);

    expect(item).toMatchObject({ kind: "translation_stale", locale: "ja" });
  });

  it("does not alert for a change that predates the save", () => {
    const items = buildSavedContextWatch([
      {
        ...base,
        savedAt: "2026-08-10T00:00:00.000Z",
        updatedAt: "2026-08-09T00:00:00.000Z",
      },
    ]);

    expect(items).toEqual([]);
  });
});
