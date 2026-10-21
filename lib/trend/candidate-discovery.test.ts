import { describe, expect, it } from "vitest";
import { discoverTrendCandidates } from "./candidate-discovery";

describe("discoverTrendCandidates", () => {
  it("creates candidates only from repeated actually collected signals", () => {
    const candidates = discoverTrendCandidates({
      knownNames: ["기존밈"],
      signals: [
        { id: "a", platform: "x", platformContentId: "1", creatorKey: "x:u1", querySeed: "밈", hashtags: ["새표현", "기존밈"], observedAt: "2026-10-12T00:00:00Z" },
        { id: "b", platform: "threads", platformContentId: "2", creatorKey: "threads:u2", querySeed: "챌린지", hashtags: ["새표현"], observedAt: "2026-10-13T00:00:00Z" },
      ],
    });

    expect(candidates).toEqual([expect.objectContaining({
      normalizedPhrase: "새표현",
      signalIds: ["a", "b"],
      observedContentCount: 2,
      observedCreatorCount: 2,
    })]);
  });

  it("does not turn one signal, a seed, or an existing name into candidate data", () => {
    expect(discoverTrendCandidates({
      knownNames: ["기존밈"],
      signals: [
        { id: "a", platform: "x", platformContentId: "1", querySeed: "밈", hashtags: ["밈", "기존밈", "한번만"], observedAt: "2026-10-12T00:00:00Z" },
      ],
    })).toEqual([]);
  });

  it("deduplicates the same platform post before candidate counting", () => {
    const duplicate = { platform: "x", platformContentId: "1", creatorKey: "x:u1", hashtags: ["새표현"], observedAt: "2026-10-12T00:00:00Z" };
    expect(discoverTrendCandidates({
      knownNames: [],
      signals: [{ id: "a", ...duplicate }, { id: "b", ...duplicate }],
    })).toEqual([]);
  });
});
