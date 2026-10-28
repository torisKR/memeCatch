import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { NormalizedRadarSignal, RawRadarSignal } from "@/lib/trend/radar";
import {
  RADAR_CONNECTOR_PLATFORMS,
  type RadarConnectorRegistry,
} from "@/lib/trend/radar-connectors.server";
import { runRadarPulse, type RadarRepository } from "@/lib/trend/radar-pulse.server";

function signal(platform: string, metrics: Record<string, number>): RawRadarSignal {
  return {
    platform,
    platformContentId: `${platform}-1`,
    canonicalUrl: `https://example.com/${platform}/1`,
    text: "냥밈",
    observedAt: "2026-08-12T00:00:00Z",
    metrics,
    ingestionVersion: 1,
    rightsMode: "api_metadata",
  };
}

describe("runRadarPulse", () => {
  it("persists every signal but excludes YouTube from scoring and only enqueues safety review", async () => {
    const connectors = Object.fromEntries(
      RADAR_CONNECTOR_PLATFORMS.map((platform) => [
        platform,
        {
          platform,
          collect: vi.fn(async () => ({
            signals:
              platform === "threads"
                ? [signal(platform, { volume: 80, velocity: 90, engagement: 70 })]
                : platform === "instagram"
                  ? [signal(platform, { volume: 40, velocity: 50, engagement: 40, risk: 0.9 })]
                : platform === "youtube"
                  ? [signal(platform, { volume: 100, velocity: 100, engagement: 100 })]
                  : [],
          })),
        },
      ]),
    ) as unknown as RadarConnectorRegistry;
    const persistMatch = vi.fn().mockResolvedValue(undefined);
    const recordObservation = vi.fn().mockResolvedValue(undefined);
    const enqueueSafetyReview = vi.fn().mockResolvedValue(undefined);
    const repository: RadarRepository = {
      loadConnectorState: vi.fn().mockResolvedValue({}),
      loadMemes: vi.fn().mockResolvedValue([
        { id: "meme-1", canonicalName: "고양이 밈", aliases: ["냥밈"], state: "candidate" },
      ]),
      persistConnectorHealth: vi.fn().mockResolvedValue(undefined),
      persistSignals: vi.fn(async (signals: readonly NormalizedRadarSignal[]) =>
        signals.map((value, index) => ({ ...value, id: `signal-${index + 1}` })),
      ),
      persistMatch,
      recordObservation,
      enqueueSafetyReview,
    };

    await expect(
      runRadarPulse({
        connectors,
        repository,
        now: () => new Date("2026-08-12T00:30:00Z"),
      }),
    ).resolves.toMatchObject({
      status: "ok",
      persistedSignals: 3,
      automaticMatches: 3,
      observations: 1,
      safetyReviews: 1,
    });
    expect(persistMatch).toHaveBeenCalledTimes(3);
    expect(recordObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        memeId: "meme-1",
        factors: {
          platforms: ["instagram"],
          excluded_platforms: ["youtube"],
        },
      }),
    );
    expect(enqueueSafetyReview).toHaveBeenCalledOnce();
    expect(enqueueSafetyReview).toHaveBeenCalledWith(
      expect.objectContaining({ memeId: "meme-1", signalId: "signal-2" }),
    );
  });

  it("does not feed YouTube-only observations into the state engine", async () => {
    const connectors = Object.fromEntries(
      RADAR_CONNECTOR_PLATFORMS.map((platform) => [
        platform,
        {
          platform,
          collect: vi.fn(async () => ({
            signals:
              platform === "youtube"
                ? [signal(platform, { volume: 100, velocity: 100, engagement: 100 })]
                : [],
          })),
        },
      ]),
    ) as unknown as RadarConnectorRegistry;
    const recordObservation = vi.fn().mockResolvedValue(undefined);
    const repository: RadarRepository = {
      loadConnectorState: vi.fn().mockResolvedValue({}),
      loadMemes: vi.fn().mockResolvedValue([
        { id: "meme-1", canonicalName: "고양이 밈", aliases: ["냥밈"], state: "candidate" },
      ]),
      persistConnectorHealth: vi.fn().mockResolvedValue(undefined),
      persistSignals: vi.fn(async (signals: readonly NormalizedRadarSignal[]) =>
        signals.map((value) => ({ ...value, id: "signal-youtube" })),
      ),
      persistMatch: vi.fn().mockResolvedValue(undefined),
      recordObservation,
      enqueueSafetyReview: vi.fn().mockResolvedValue(undefined),
    };

    await expect(
      runRadarPulse({
        connectors,
        repository,
        now: () => new Date("2026-08-12T00:30:00Z"),
      }),
    ).resolves.toMatchObject({ observations: 0, automaticMatches: 1 });
    expect(recordObservation).not.toHaveBeenCalled();
  });

  it("does not turn missing metrics into observed zeroes", async () => {
    const connectors = {
      threads: {
        platform: "threads",
        collect: vi.fn(async () => ({
          signals: [signal("threads", { volume: 30 })],
        })),
      },
    } as unknown as RadarConnectorRegistry;
    const recordObservation = vi.fn().mockResolvedValue(undefined);
    const repository: RadarRepository = {
      loadConnectorState: vi.fn().mockResolvedValue({}),
      loadMemes: vi.fn().mockResolvedValue([
        { id: "meme-1", canonicalName: "고양이 밈", aliases: ["냥밈"], state: "candidate" },
      ]),
      persistConnectorHealth: vi.fn().mockResolvedValue(undefined),
      persistSignals: vi.fn(async (signals: readonly NormalizedRadarSignal[]) =>
        signals.map((value) => ({ ...value, id: "signal-partial" })),
      ),
      persistMatch: vi.fn().mockResolvedValue(undefined),
      recordObservation,
      enqueueSafetyReview: vi.fn().mockResolvedValue(undefined),
    };

    await expect(runRadarPulse({ connectors, repository })).resolves.toMatchObject({
      persistedSignals: 1,
      automaticMatches: 1,
      observations: 0,
    });
    expect(recordObservation).not.toHaveBeenCalled();
  });

  it("persists repeated collected expressions only when discovery is explicitly enabled", async () => {
    const discovered = vi.fn().mockResolvedValue(undefined);
    const connectors = {
      threads: {
        platform: "threads",
        collect: vi.fn(async () => ({ signals: [
          { ...signal("threads", {}), platformContentId: "one", creatorKey: "threads:u1", hashtags: ["새표현"] },
          { ...signal("threads", {}), platformContentId: "two", creatorKey: "threads:u2", hashtags: ["새표현"] },
        ] })),
      },
    } as unknown as RadarConnectorRegistry;
    const repository: RadarRepository = {
      loadConnectorState: vi.fn().mockResolvedValue({}),
      loadMemes: vi.fn().mockResolvedValue([]),
      persistConnectorHealth: vi.fn().mockResolvedValue(undefined),
      persistSignals: vi.fn(async (signals: readonly NormalizedRadarSignal[]) =>
        signals.map((value, index) => ({ ...value, id: `signal-${index}` })),
      ),
      persistDiscoveredCandidates: discovered,
      persistMatch: vi.fn().mockResolvedValue(undefined),
      recordObservation: vi.fn().mockResolvedValue(undefined),
      enqueueSafetyReview: vi.fn().mockResolvedValue(undefined),
    };

    await expect(runRadarPulse({ connectors, repository, discoveryEnabled: true })).resolves.toMatchObject({
      discoveredCandidates: 1,
    });
    expect(discovered).toHaveBeenCalledWith([
      expect.objectContaining({ normalizedPhrase: "새표현", observedContentCount: 2 }),
    ]);
  });

  it("does not advance connector cursors when signal persistence fails", async () => {
    const persistConnectorHealth = vi.fn().mockResolvedValue(undefined);
    const connectors = Object.fromEntries(
      RADAR_CONNECTOR_PLATFORMS.map((platform) => [
        platform,
        {
          platform,
          collect: vi.fn(async () => ({
            signals: platform === "threads" ? [signal(platform, { volume: 10 })] : [],
            cursor: platform === "threads" ? "next-page" : undefined,
          })),
        },
      ]),
    ) as unknown as RadarConnectorRegistry;
    const repository: RadarRepository = {
      loadConnectorState: vi.fn().mockResolvedValue({}),
      loadMemes: vi.fn().mockResolvedValue([]),
      persistConnectorHealth,
      persistSignals: vi.fn().mockRejectedValue(new Error("storage unavailable")),
      persistMatch: vi.fn().mockResolvedValue(undefined),
      recordObservation: vi.fn().mockResolvedValue(undefined),
      enqueueSafetyReview: vi.fn().mockResolvedValue(undefined),
    };

    await expect(runRadarPulse({ connectors, repository })).rejects.toThrow(
      "storage unavailable",
    );
    expect(persistConnectorHealth).not.toHaveBeenCalled();
  });
});
