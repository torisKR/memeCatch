import { describe, expect, it } from "vitest";
import {
  buildPlusGlobalActionInbox,
  type PlusGlobalActionInboxResult,
} from "@/lib/plus-global-action-inbox";
import type { PlusDailySignalCandidate } from "@/lib/plus-daily-signal.server";
import type { PlusTranslationFulfillmentResult } from "@/lib/plus-translation-fulfillment";
import type { PlusGlobalScoutResult } from "@/lib/plus-global-scout";

const readyFulfillment: PlusTranslationFulfillmentResult = {
  status: "active",
  items: [
    {
      requestId: "request-ready",
      memeId: "m-ready",
      shortId: "ready1",
      slug: "ready-ja",
      title: "Ready translation",
      summary: "A ready localized caption.",
      usageNote: "Use it with the right audience.",
      caution: "Check the context first.",
      safetyLevel: "green",
      lifecycleStatus: "rising",
      trendScore: 12,
      locale: "ja",
      requestStatus: "completed",
      state: "ready",
      changedAt: "2026-08-09T04:00:00.000Z",
    },
  ],
};

const savedSignal: PlusDailySignalCandidate = {
  id: "m-saved",
  shortId: "saved1",
  slug: "saved-signal",
  title: "Saved signal",
  summary: "A saved meme is rising.",
  usageNote: null,
  caution: null,
  shareReady: true,
  trendScore: 92,
  safetyLevel: "green",
  source: "saved_rising",
};

const scout: PlusGlobalScoutResult = {
  status: "active",
  dateKey: "2026-08-09",
  items: [
    {
      id: "m-scout",
      shortId: "scout1",
      slug: "scout-meme",
      title: "New reviewed meme",
      summary: "A newly reviewed global meme.",
      description: "Description",
      origin: "Origin",
      usageNote: null,
      caution: null,
      usageExamples: [{ situation: "Global chat", text: "Use the reviewed global line." }],
      locale: "en",
      safetyLevel: "green",
      lifecycleStatus: "rising",
      trendScore: 80,
      sourceUpdatedAt: "2026-08-09T03:00:00.000Z",
    },
  ],
};

function signal(index: number): PlusDailySignalCandidate {
  return {
    id: `m-signal-${index}`,
    shortId: `sig${index}`,
    slug: `signal-${index}`,
    title: `Signal ${index}`,
    summary: `Signal summary ${index}`,
    usageNote: null,
    caution: null,
    shareReady: true,
    trendScore: 100 - index,
    safetyLevel: "green",
    source: index % 2 === 0 ? "saved_rising" : "interest_rising",
  };
}

describe("buildPlusGlobalActionInbox", () => {
  it("prioritizes ready translations and deduplicates by meme", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "ja",
      fulfillment: readyFulfillment,
      signals: [
        { ...savedSignal, id: "m-ready", shortId: "ready1", slug: "ready-en" },
        savedSignal,
      ],
      signalStatus: "available",
      scout: {
        ...scout,
        items: [{ ...scout.items[0], id: "m-ready", shortId: "ready1" }, scout.items[0]],
      },
    });

    expect(result.items.map((item) => item.memeId)).toEqual([
      "m-ready",
      "m-saved",
      "m-scout",
    ]);
    expect(result.items[0]?.kind).toBe("translation_ready");
    expect(result.items[0]?.href).toBe("/ja/memes/ready1-ready-ja");
    expect(result.items[0]?.shareText).toContain("/ja/memes/ready1-ready-ja");
    expect(result.items[0]?.creatorPackFacts).toEqual({
      title: "Ready translation",
      summary: "A ready localized caption.",
      usageNote: "Use it with the right audience.",
      caution: "Check the context first.",
      safetyLevel: "green",
      lifecycleStatus: "rising",
    });
  });

  it("keeps a ready requested translation when the UI locale differs", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "en",
      fulfillment: readyFulfillment,
      signals: [],
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
    });

    expect(result.items[0]).toMatchObject({
      kind: "translation_ready",
      locale: "ja",
      href: "/ja/memes/ready1-ready-ja",
    });
  });

  it("prefers the UI locale when the same meme has multiple ready translations", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "en",
      fulfillment: {
        status: "active",
        items: [
          { ...readyFulfillment.items[0], requestId: "ja-request", locale: "ja", changedAt: "2026-08-10T00:00:00.000Z" },
          { ...readyFulfillment.items[0], requestId: "en-request", locale: "en", slug: "ready-en", changedAt: "2026-08-09T00:00:00.000Z" },
        ],
      },
      signals: [],
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
    });

    expect(result.items[0]).toMatchObject({ locale: "en", href: "/en/memes/ready1-ready-en" });
  });

  it("passes reviewed usage examples into creator pack facts", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "en",
      fulfillment: { status: "empty", items: [] },
      signals: [],
      signalStatus: "available",
      scout,
    });

    expect(result.items[0]?.creatorPackFacts?.usageExamples).toEqual([
      { situation: "Global chat", text: "Use the reviewed global line." },
    ]);
  });

  it("does not expose a completed translation whose source is not publicly indexable", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "ja",
      fulfillment: {
        status: "active",
        items: [{ ...readyFulfillment.items[0], state: "source_incomplete" }],
      },
      signals: [],
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
    });

    expect(result.status).toBe("empty");
    expect(result.items).toEqual([]);
  });

  it("keeps deterministic priority and caps the inbox at five items", () => {
    const signals = Array.from({ length: 7 }, (_, index) => signal(index));
    const build = (items: readonly PlusDailySignalCandidate[]): PlusGlobalActionInboxResult =>
      buildPlusGlobalActionInbox({
        locale: "ja",
        fulfillment: { status: "empty", items: [] },
        signals: items,
        signalStatus: "available",
        scout: { status: "empty", dateKey: "2026-08-09", items: [] },
      });

    const forward = build(signals);
    const reverse = build([...signals].reverse());

    expect(forward.items).toHaveLength(5);
    expect(forward.items.map((item) => item.id)).toEqual(reverse.items.map((item) => item.id));
    expect(forward.items[0]?.href).toBe("/ja/memes/sig0-signal-0");
  });

  it("promotes a matching daily signal without trusting an unknown id", () => {
    const signals = [signal(0), signal(1), signal(2), signal(3), signal(4), signal(5)];
    const promoted = buildPlusGlobalActionInbox({
      locale: "en",
      fulfillment: { status: "empty", items: [] },
      signals,
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
      preferredMemeId: "m-signal-4",
    });
    const fallback = buildPlusGlobalActionInbox({
      locale: "en",
      fulfillment: { status: "empty", items: [] },
      signals,
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
      preferredMemeId: "not-an-action",
    });

    expect(promoted.items[0]?.memeId).toBe("m-signal-4");
    expect(fallback.items[0]?.memeId).toBe("m-signal-0");
  });

  it("promotes a verified Global Daily candidate with its content locale and no unreviewed examples", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "ja",
      fulfillment: readyFulfillment,
      signals: [{ ...savedSignal, id: "m-global", shortId: "global1" }],
      signalStatus: "available",
      scout: {
        ...scout,
        items: [{ ...scout.items[0], id: "m-global", shortId: "global1" }],
      },
      preferredMemeId: "m-global",
      globalDailyCandidate: {
        memeId: "m-global",
        shortId: "global1",
        slug: "global-ja",
        title: "Global Japanese",
        summary: "A reviewed Japanese Global Daily summary.",
        locale: "ja",
        safetyLevel: "green",
        lifecycleStatus: "active",
        updatedAt: "2026-08-10T00:00:00.000Z",
      },
    });

    expect(result.items[0]).toMatchObject({
      id: "global_daily:m-global",
      memeId: "m-global",
      locale: "ja",
      href: "/ja/memes/global1-global-ja",
      kind: "new_reviewed",
    });
    expect(result.items[0]?.creatorPackFacts?.usageExamples).toBeUndefined();
    expect(result.items.filter((item) => item.memeId === "m-global")).toHaveLength(1);
  });

  it("fails closed for an invalid Global Daily safety or lifecycle state", () => {
    const build = (candidate: NonNullable<Parameters<typeof buildPlusGlobalActionInbox>[0]["globalDailyCandidate"]>) =>
      buildPlusGlobalActionInbox({
        locale: "en",
        fulfillment: { status: "empty", items: [] },
        signals: [],
        signalStatus: "available",
        scout: { status: "empty", dateKey: "2026-08-10", items: [] },
        globalDailyCandidate: candidate,
      });

    expect(build({
      memeId: "m-red",
      shortId: "red1",
      slug: "red",
      title: "Red",
      summary: "A summary that should not activate the action inbox.",
      locale: "en",
      safetyLevel: "red",
      lifecycleStatus: "active",
      updatedAt: "2026-08-10T00:00:00.000Z",
    }).items).toEqual([]);
    expect(build({
      memeId: "m-cooling",
      shortId: "cool1",
      slug: "cooling",
      title: "Cooling",
      summary: "A summary that should not activate the action inbox.",
      locale: "en",
      safetyLevel: "green",
      lifecycleStatus: "cooling",
      updatedAt: "2026-08-10T00:00:00.000Z",
    }).items).toEqual([]);
  });

  it("puts a verified outcome replay first and removes it after today's completion", () => {
    const replay = {
      id: "outcome-replay:hit1",
      memeId: "m-hit",
      shortId: "hit1",
      slug: "hit-again",
      title: "A past hit",
      summary: "Use the reviewed result again.",
      locale: "en" as const,
      href: "/en/memes/hit1-hit-again",
      shareText: "A past hit\n\nUse the reviewed result again.",
      kind: "outcome_replay" as const,
      changedAt: "2026-08-09T00:00:00.000Z",
      trendScore: 0,
      preferredOutcomeChannel: "threads" as const,
    };
    const result = buildPlusGlobalActionInbox({
      locale: "ko",
      fulfillment: { status: "empty", items: [] },
      signals: [signal(0)],
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
      replayItem: replay,
      preferredMemeId: replay.memeId,
    });
    const completed = buildPlusGlobalActionInbox({
      locale: "ko",
      fulfillment: { status: "empty", items: [] },
      signals: [signal(0)],
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
      replayItem: replay,
      completion: { completedMemeIds: [replay.memeId] },
      preferredMemeId: replay.memeId,
    });

    expect(result.items[0]).toMatchObject({
      kind: "outcome_replay",
      memeId: "m-hit",
      preferredOutcomeChannel: "threads",
    });
    expect(completed.items[0]?.memeId).toBe("m-signal-0");
  });

  it("does not replay a hit when today's completion state is unavailable", () => {
    const replay = {
      id: "outcome-replay:hit-unavailable",
      memeId: "m-hit-unavailable",
      shortId: "hit-unavailable",
      slug: "hit-unavailable",
      title: "A past hit",
      summary: "Use the reviewed result again.",
      locale: "en" as const,
      href: "/en/memes/hit-unavailable-hit-unavailable",
      shareText: "A past hit",
      kind: "outcome_replay" as const,
      changedAt: null,
      trendScore: 0,
    };
    const result = buildPlusGlobalActionInbox({
      locale: "ko",
      fulfillment: { status: "empty", items: [] },
      signals: [signal(0)],
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
      replayItem: replay,
      completion: { status: "unavailable", completedMemeIds: [] },
    });

    expect(result.items.some((item) => item.kind === "outcome_replay")).toBe(false);
    expect(result.items[0]?.memeId).toBe("m-signal-0");
  });

  it("falls back to the normal next action when the preferred signal was completed", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "en",
      fulfillment: { status: "empty", items: [] },
      signals: [signal(0), signal(1)],
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
      completion: { completedMemeIds: ["m-signal-0"] },
      preferredMemeId: "m-signal-0",
    });

    expect(result.items[0]?.memeId).toBe("m-signal-1");
  });

  it("omits signals that are not ready to share", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "en",
      fulfillment: { status: "empty", items: [] },
      signals: [{ ...savedSignal, shareReady: false }],
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
    });

    expect(result.status).toBe("empty");
    expect(result.items).toEqual([]);
    expect(result.unavailableLanes).toEqual([]);
  });

  it("removes today's completed meme and preserves the completion summary", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "en",
      fulfillment: { status: "empty", items: [] },
      signals: [{ ...savedSignal, id: "meme-1", title: "Completed meme" }],
      signalStatus: "available",
      scout: { status: "empty", dateKey: "2026-08-09", items: [] },
      completion: {
        status: "available",
        completedMemeIds: ["meme-1"],
        completedTodayCount: 2,
        currentStreak: 4,
      },
    });

    expect(result.status).toBe("empty");
    expect(result.items).toEqual([]);
    expect(result.completion).toEqual({
      status: "available",
      completedMemeIds: ["meme-1"],
      completedTodayCount: 2,
      currentStreak: 4,
    });
  });

  it("keeps partial source failures visible without turning available actions into empty", () => {
    const result = buildPlusGlobalActionInbox({
      locale: "ja",
      fulfillment: readyFulfillment,
      signals: [],
      signalStatus: "unavailable",
      scout: { status: "unavailable", dateKey: "2026-08-09", items: [] },
    });

    expect(result.status).toBe("active");
    expect(result.items[0]?.kind).toBe("translation_ready");
    expect(result.unavailableLanes).toEqual(["saved_signal", "new_reviewed"]);
  });
});
