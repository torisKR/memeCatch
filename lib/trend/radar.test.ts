import { describe, expect, it } from "vitest";
import {
  buildRadarDedupeKey,
  calculateRadarSignal,
  extractRadarHashtags,
  hashRadarDedupeKey,
  matchRadarEntity,
  normalizeRadarSignal,
  normalizeRadarText,
  normalizeRadarTimestamp,
  recommendRadarState,
  transitionRadarState,
  type RadarObservation,
  type RadarStateSnapshot,
} from "@/lib/trend/radar";

describe("radar external signal normalization", () => {
  it("normalizes compatibility text, URLs, case, whitespace, and hashtags", () => {
    expect(
      normalizeRadarText("  ＭＥＭＥ\tCatch https://example.com/x  밈  "),
    ).toBe("meme catch 밈");
    expect(extractRadarHashtags("#ＭＥＭＥ #밈 #meme https://x.test/#ignored")).toEqual([
      "meme",
      "밈",
    ]);
  });

  it("creates a stable SHA-256 dedupe hash and UTC timestamp", () => {
    const left = {
      platform: "Threads",
      externalId: " POST-1 ",
      text: "ＨＥＬＬＯ https://example.com/a",
      url: "https://example.com/post-1",
      observedAt: "2026-08-12T09:30:00",
    };
    const right = {
      platform: "threads",
      externalId: "post-1",
      text: "hello",
      url: "HTTPS://EXAMPLE.COM/POST-1",
      observedAt: "2026-08-12T09:30:00Z",
    };

    expect(buildRadarDedupeKey(left)).toBe(buildRadarDedupeKey(right));
    expect(hashRadarDedupeKey(left)).toBe(hashRadarDedupeKey(right));
    expect(hashRadarDedupeKey(left)).toMatch(/^[a-f0-9]{64}$/u);
    expect(normalizeRadarTimestamp("2026-08-12T09:30:00+09:00")).toBe(
      "2026-08-12T00:30:00.000Z",
    );
    expect(normalizeRadarTimestamp("not-a-date")).toBeNull();
    expect(normalizeRadarTimestamp(Number.MAX_VALUE)).toBeNull();
    expect(
      hashRadarDedupeKey({ ...right, url: "https://example.com/post-2" }),
    ).not.toBe(hashRadarDedupeKey(right));
  });

  it("normalizes a connector signal into UTC fields and a text hash", () => {
    const normalized = normalizeRadarSignal({
      platform: "instagram",
      platformContentId: "post-1",
      canonicalUrl: "https://example.com/post-1",
      text: " ＨＥＬＬＯ https://example.com/noise ",
      hashtags: ["#ＭＥＭＥ", "#밈"],
      publishedAt: "2026-08-12T09:00:00+09:00",
      observedAt: "2026-08-12T09:30:00",
      collectedAt: "2026-08-12T09:31:00Z",
    });

    expect(normalized).toMatchObject({
      hashtags: ["meme", "밈"],
      publishedAt: "2026-08-12T00:00:00.000Z",
      observedAt: "2026-08-12T09:30:00.000Z",
      collectedAt: "2026-08-12T09:31:00.000Z",
    });
    expect(normalized.normalizedTextHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(() =>
      normalizeRadarSignal({
        platform: "x",
        platformContentId: "bad",
        canonicalUrl: "https://example.com/bad",
        observedAt: "invalid",
      }),
    ).toThrow(/observedAt/u);
  });
});

describe("radar entity matching", () => {
  const entities = [
    { id: "alpha", canonicalName: "고양이 밈", aliases: ["냥밈"] },
    { id: "beta", canonicalName: "다른 밈", aliases: ["냥밈"] },
  ] as const;

  it("uses deterministic match methods, confidence, and tie-breaking", () => {
    expect(matchRadarEntity("냥밈", entities)).toEqual({
      entityId: "alpha",
      matchMethod: "alias_exact",
      confidence: 0.96,
      matchedValue: "냥밈",
    });
    expect(matchRadarEntity("오늘의 #고양이밈 반응", entities)).toEqual({
      entityId: "alpha",
      matchMethod: "canonical_hashtag",
      confidence: 0.94,
      matchedValue: "고양이 밈",
    });
    expect(matchRadarEntity("관련 없음", entities)).toBeNull();
  });
});

describe("radar heat and confidence", () => {
  function observation(
    platform: string,
    overrides: Partial<RadarObservation> = {},
  ): RadarObservation {
    return {
      platform,
      observedAt: "2026-08-12T00:00:00.000Z",
      volume: 60,
      velocity: 80,
      engagement: 70,
      sourceReliability: 0.8,
      ...overrides,
    };
  }

  it("excludes YouTube variants from every aggregate while preserving them", () => {
    const eligible = observation("threads");
    const youtube = observation("youtube", {
      volume: 100,
      velocity: 100,
      engagement: 100,
      sourceReliability: 1,
    });
    const shorts = observation("youtube_shorts", {
      volume: 0,
      velocity: 0,
      engagement: 0,
      sourceReliability: 0,
    });
    const base = calculateRadarSignal({
      observations: [eligible],
      referenceAt: "2026-08-12T00:00:00Z",
    });
    const withYoutube = calculateRadarSignal({
      observations: [eligible, youtube, shorts],
      referenceAt: "2026-08-12T00:00:00Z",
    });

    expect(withYoutube.heat).toBe(base.heat);
    expect(withYoutube.confidence).toBe(base.confidence);
    expect(withYoutube.observations).toEqual([eligible, youtube, shorts]);
    expect(withYoutube.aggregationObservations).toEqual([eligible]);
    expect(withYoutube.excludedObservations).toEqual([youtube, shorts]);
    expect(withYoutube.aggregatedPlatforms).toEqual(["threads"]);
  });
});

describe("radar hysteresis state engine", () => {
  it("recommends the next threshold state without applying consecutive-observation policy", () => {
    expect(recommendRadarState("candidate", 60, 0.8)).toBe("rising");
    expect(recommendRadarState("rising", 80, 0.8)).toBe("trending");
    expect(recommendRadarState("trending", 30, 0.8)).toBe("cooling");
    expect(recommendRadarState("archive", 10, 0.9)).toBe("archive");
  });

  function apply(
    current: RadarStateSnapshot,
    heat: number,
    confidence = 0.9,
  ): RadarStateSnapshot {
    return transitionRadarState({ ...current, heat, confidence });
  }

  it("requires consecutive observations through promotion, cooling, and archive", () => {
    let current: RadarStateSnapshot = {
      state: "candidate",
      consecutiveHigh: 0,
      consecutiveLow: 0,
    };

    current = apply(current, 55);
    expect(current).toEqual({
      state: "candidate",
      consecutiveHigh: 1,
      consecutiveLow: 0,
    });
    current = apply(current, 55);
    expect(current.state).toBe("rising");
    current = apply(current, 80);
    expect(current.state).toBe("rising");
    current = apply(current, 80);
    expect(current.state).toBe("trending");
    current = apply(current, 40);
    expect(current.state).toBe("trending");
    current = apply(current, 40);
    expect(current.state).toBe("cooling");
    current = apply(current, 10);
    current = apply(current, 10);
    expect(current.state).toBe("cooling");
    current = apply(current, 10);
    expect(current.state).toBe("archive");
  });

  it("resets interrupted streaks and requires three highs to revive archive", () => {
    let current: RadarStateSnapshot = {
      state: "archive",
      consecutiveHigh: 0,
      consecutiveLow: 0,
    };

    current = apply(current, 60);
    current = apply(current, 20);
    expect(current.consecutiveHigh).toBe(0);
    current = apply(current, 60);
    current = apply(current, 60);
    expect(current.state).toBe("archive");
    current = apply(current, 60);
    expect(current).toEqual({
      state: "candidate",
      consecutiveHigh: 0,
      consecutiveLow: 0,
    });
  });
});
