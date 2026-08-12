import { describe, expect, it, vi } from "vitest";
import type { RawRadarSignal } from "@/lib/trend/radar";
import {
  RADAR_CONNECTOR_PLATFORMS,
  runRadarConnectors,
  type RadarConnector,
  type RadarConnectorPlatform,
  type RadarConnectorRegistry,
} from "./radar-connectors.server";

function rawSignal(platform: RadarConnectorPlatform): RawRadarSignal {
  return {
    platform,
    platformContentId: `${platform}-content`,
    canonicalUrl: `https://example.com/${platform}`,
    text: `${platform} signal`,
    observedAt: "2026-08-12T00:00:00.000Z",
  };
}

function fakeConnector(
  platform: RadarConnectorPlatform,
  collect: RadarConnector<RadarConnectorPlatform>["collect"],
): RadarConnector {
  return { platform, collect };
}

function fakeRegistry(
  overrides: Partial<Record<RadarConnectorPlatform, RadarConnector>> = {},
): RadarConnectorRegistry {
  return Object.fromEntries(
    RADAR_CONNECTOR_PLATFORMS.map((platform) => [
      platform,
      overrides[platform] ??
        fakeConnector(platform, async () => ({ signals: [rawSignal(platform)] })),
    ]),
  ) as RadarConnectorRegistry;
}

describe("runRadarConnectors", () => {
  it("isolates one failure, attempts every connector, and returns durable health rows", async () => {
    const calls = new Map<RadarConnectorPlatform, ReturnType<typeof vi.fn>>();
    const connectors = fakeRegistry();

    for (const platform of RADAR_CONNECTOR_PLATFORMS) {
      const collect = vi.fn(async () => ({
        signals: [rawSignal(platform)],
        cursor: `${platform}-next`,
        quotaRemaining: 90,
        quotaResetAt: "2026-08-12T01:00:00.000Z",
        backoffUntil: null,
      }));
      calls.set(platform, collect);
      connectors[platform] = fakeConnector(platform, collect) as never;
    }
    calls.get("threads")!.mockRejectedValueOnce(new Error("threads unavailable"));

    const result = await runRadarConnectors({
      connectors,
      previousState: {
        threads: {
          cursor: "threads-before",
          lastSuccessAt: "2026-08-11T00:30:00.000Z",
          consecutiveFailures: 2,
          quotaRemaining: 4,
          backoffUntil: "2026-08-12T00:45:00.000Z",
        },
      },
      now: () => new Date("2026-08-12T00:30:00.000Z"),
    });

    expect(result.status).toBe("partial");
    expect([...calls.values()].every((collect) => collect.mock.calls.length === 1)).toBe(true);
    expect(result.signals).toHaveLength(RADAR_CONNECTOR_PLATFORMS.length - 1);
    expect(result.signals.map((signal) => signal.platform)).not.toContain("threads");
    expect(result.signals[0]).toHaveProperty("normalizedTextHash");
    expect(result.health).toHaveLength(RADAR_CONNECTOR_PLATFORMS.length);
    expect(result.health.find(({ connector_key }) => connector_key === "threads")).toEqual({
      connector_key: "threads",
      status: "down",
      last_checked_at: "2026-08-12T00:30:00.000Z",
      last_success_at: "2026-08-11T00:30:00.000Z",
      consecutive_failures: 3,
      latency_ms: null,
      cursor_state: {
        cursor: "threads-before",
        attempted_at: "2026-08-12T00:30:00.000Z",
        succeeded_at: "2026-08-11T00:30:00.000Z",
        failed_at: "2026-08-12T00:30:00.000Z",
        quota_remaining: 4,
        quota_reset_at: null,
        backoff_until: "2026-08-12T00:45:00.000Z",
      },
      last_error: "threads unavailable",
    });
    expect(result.health.find(({ connector_key }) => connector_key === "x")).toMatchObject({
      status: "healthy",
      last_success_at: "2026-08-12T00:30:00.000Z",
      consecutive_failures: 0,
      cursor_state: { cursor: "x-next", quota_remaining: 90 },
      last_error: null,
    });
  });

  it("reports ok when all connectors succeed and failed when all fail", async () => {
    const ok = await runRadarConnectors({ connectors: fakeRegistry() });
    expect(ok.status).toBe("ok");

    const failed = await runRadarConnectors({
      connectors: fakeRegistry(
        Object.fromEntries(
          RADAR_CONNECTOR_PLATFORMS.map((platform) => [
            platform,
            fakeConnector(platform, async () => {
              throw new Error(`${platform} failed`);
            }),
          ]),
        ),
      ),
    });
    expect(failed.status).toBe("failed");
    expect(failed.signals).toEqual([]);
    expect(failed.health.every((row) => row.cursor_state.failed_at !== null)).toBe(true);
  });

  it("rejects a connector signal tagged as another platform without stopping peers", async () => {
    const connectors = fakeRegistry({
      x: fakeConnector("x", async () => ({
        signals: [rawSignal("instagram")],
      })),
    });

    const result = await runRadarConnectors({ connectors });

    expect(result.status).toBe("partial");
    expect(result.health.find(({ connector_key }) => connector_key === "x")?.last_error).toMatch(
      /tagged instagram/,
    );
    expect(result.signals).toHaveLength(RADAR_CONNECTOR_PLATFORMS.length - 1);
  });

  it("times out a hung connector without blocking peers", async () => {
    const connectors = fakeRegistry({
      threads: fakeConnector("threads", ({ signal }) =>
        new Promise((_, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), {
            once: true,
          });
        }),
      ),
    });

    const result = await runRadarConnectors({ connectors, timeoutMs: 5 });

    expect(result.status).toBe("partial");
    expect(result.signals).toHaveLength(RADAR_CONNECTOR_PLATFORMS.length - 1);
    expect(
      result.health.find(({ connector_key }) => connector_key === "threads")?.last_error,
    ).toMatch(/timed out/);
  });

  it("runs only configured connectors", async () => {
    const result = await runRadarConnectors({
      connectors: {
        instagram: fakeConnector("instagram", async () => ({
          signals: [rawSignal("instagram")],
        })) as RadarConnector<"instagram">,
      },
    });

    expect(result.status).toBe("ok");
    expect(result.health.map(({ connector_key }) => connector_key)).toEqual([
      "instagram",
    ]);
  });
});
