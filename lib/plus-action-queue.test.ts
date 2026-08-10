import { describe, expect, it } from "vitest";
import {
  buildPlusActionQueue,
  type PlusAction,
} from "@/lib/plus-action-queue";
import type { SavedReuseRadarItem } from "@/lib/saved-reuse-radar";

function item(
  id: string,
  overrides: Partial<SavedReuseRadarItem> = {},
): SavedReuseRadarItem {
  return {
    id,
    shortId: id,
    slug: id,
    title: id,
    summary: `${id} summary`,
    safetyLevel: "green",
    lifecycleStatus: "rising",
    trendScore: 10,
    savedAt: "2026-08-08T00:00:00.000Z",
    collection: null,
    ...overrides,
  };
}

describe("buildPlusActionQueue", () => {
  it("selects one safe action from each saved-meme state", () => {
    const actions = buildPlusActionQueue([
      item("ready", { trendScore: 90 }),
      item("context", { safetyLevel: "yellow", trendScore: 70 }),
      item("review", { safetyLevel: "red", trendScore: 20 }),
    ]);

    expect(actions.map(({ kind, item: entry }) => [kind, entry.id])).toEqual([
      ["useNow", "ready"],
      ["checkContext", "context"],
      ["review", "review"],
    ]);
  });

  it("does not invent a queue item when a state has no saved meme", () => {
    const actions: PlusAction[] = buildPlusActionQueue([
      item("ready"),
      item("cooling", { lifecycleStatus: "cooling" }),
    ]);

    expect(actions.map(({ kind }) => kind)).toEqual(["useNow", "review"]);
  });
});
