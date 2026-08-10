import { describe, expect, it } from "vitest";
import {
  buildPlusNextMove,
  plusNextMoveDateWindow,
  projectSavedRevisitNextMoveItem,
  savedReuseToPlusNextMoveItem,
} from "@/lib/plus-next-move";
import { PLUS_NEXT_MOVE_COPY } from "@/lib/plus-next-move-copy";
import type { PlusGlobalActionInboxItem } from "@/lib/plus-global-action-inbox";
import type { SavedReuseRadarItem } from "@/lib/saved-reuse-radar";
import { resolvePlusContentLocale } from "@/lib/plus-localized-feed";

function item(memeId: string, title = memeId): PlusGlobalActionInboxItem {
  return {
    id: `signal:${memeId}`,
    memeId,
    shortId: memeId.slice(0, 6),
    slug: title.toLowerCase().replaceAll(" ", "-"),
    title,
    summary: `${title} summary`,
    locale: "en",
    href: `/en/memes/${memeId}`,
    shareText: `${title}\n\n${title} summary`,
    kind: "new_reviewed",
    changedAt: null,
    trendScore: 10,
  };
}

function rating(
  memeId: string,
  value: "hit" | "neutral" | "miss",
  date = "2026-08-09",
  channel: "instagram" | "tiktok" = "instagram",
) {
  return { memeId, completionDate: date, channel, rating: value };
}

describe("Plus next move", () => {
  it("turns a saved ready-now row into locale-safe Use Kit candidates", () => {
    const saved: SavedReuseRadarItem = {
      id: "saved-1",
      shortId: "saved01",
      slug: "saved-meme",
      title: "Saved meme",
      summary: "A saved current meme.",
      safetyLevel: "green",
      lifecycleStatus: "rising",
      trendScore: 90,
      savedAt: "2026-08-09T00:00:00.000Z",
      collection: null,
    };
    const locales = ["ko", "en", "ja", "zh", "zh-tw"] as const;
    for (const locale of locales) {
      const candidate =
        locale === "ko"
          ? savedReuseToPlusNextMoveItem(saved, locale)
          : savedReuseToPlusNextMoveItem(saved, locale, {
              slug: "saved-meme-localized",
              title: "Localized saved meme",
              summary: "A reviewed localized saved meme.",
            });

      expect(candidate).toMatchObject({
        memeId: "saved-1",
        kind: "saved_signal",
        title: locale === "ko" ? "Saved meme" : "Localized saved meme",
        locale,
      });
      expect(candidate.href).toContain("#meme-use-kit-title");
      expect(PLUS_NEXT_MOVE_COPY[locale].signal.saved).toBeTruthy();
      expect(
        buildPlusNextMove({ items: [candidate], ratings: [], ratingsStatus: "available" }),
      ).toMatchObject({ status: "ready", signal: "saved", item: { memeId: "saved-1" } });
    }

    expect(resolvePlusContentLocale("th")).toBe("en");
  });

  it("hides a non-Korean saved candidate when reviewed localized content is missing", () => {
    const saved: SavedReuseRadarItem = {
      id: "saved-2",
      shortId: "saved02",
      slug: "saved-meme",
      title: "Saved meme",
      summary: "A saved current meme.",
      safetyLevel: "green",
      lifecycleStatus: "active",
      trendScore: 50,
      savedAt: "2026-08-09T00:00:00.000Z",
      collection: null,
    };

    expect(projectSavedRevisitNextMoveItem(saved, "en", null)).toBeNull();
  });

  it("uses a previous hit to promote a candidate while staying in learning mode", () => {
    const result = buildPlusNextMove({
      items: [item("new-one"), item("worked-one", "Worked one")],
      ratings: [rating("worked-one", "hit")],
      ratingsStatus: "available",
    });

    expect(result).toMatchObject({
      status: "ready",
      confidence: "learning",
      ratedCount: 1,
      signal: "hit",
      ratingScore: 1,
      item: { memeId: "worked-one" },
    });
  });

  it("pushes misses back and keeps the original order for ties", () => {
    const missResult = buildPlusNextMove({
      items: [item("missed"), item("neutral")],
      ratings: [rating("missed", "miss")],
      ratingsStatus: "available",
    });
    expect(missResult.item?.memeId).toBe("neutral");
    expect(missResult.signal).toBe("new");

    const tieResult = buildPlusNextMove({
      items: [item("first"), item("second")],
      ratings: [rating("first", "neutral"), rating("second", "neutral")],
      ratingsStatus: "available",
    });
    expect(tieResult.item?.memeId).toBe("first");
    expect(tieResult.signal).toBe("neutral");
  });

  it("excludes completed candidates and becomes ready after three ratings", () => {
    const result = buildPlusNextMove({
      items: [item("completed"), item("available")],
      ratings: [rating("completed", "hit"), rating("available", "neutral"), rating("other", "miss")],
      ratingsStatus: "available",
      completedMemeIds: new Set(["completed"]),
    });

    expect(result).toMatchObject({
      status: "ready",
      confidence: "ready",
      item: { memeId: "available" },
    });
  });

  it("keeps data failure distinct from an empty inbox", () => {
    const unavailable = buildPlusNextMove({
      items: [item("one")],
      ratings: [],
      ratingsStatus: "unavailable",
    });
    expect(unavailable.status).toBe("unavailable");

    const empty = buildPlusNextMove({
      items: [],
      ratings: [],
      ratingsStatus: "available",
    });
    expect(empty.status).toBe("empty");
  });

  it("builds a 28-day Asia/Seoul window", () => {
    expect(plusNextMoveDateWindow(new Date("2026-08-08T16:00:00.000Z"))).toEqual({
      from: "2026-07-13",
      to: "2026-08-09",
    });
  });
});
