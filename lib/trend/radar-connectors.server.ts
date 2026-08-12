import {
  normalizeRadarSignal,
  type NormalizedRadarSignal,
  type RadarPlatform,
  type RawRadarSignal,
} from "@/lib/trend/radar";

export const RADAR_CONNECTOR_PLATFORMS = [
  "x",
  "threads",
  "instagram",
  "internal",
  "youtube",
  "youtube_shorts",
] as const satisfies readonly RadarPlatform[];

export type RadarConnectorPlatform = (typeof RADAR_CONNECTOR_PLATFORMS)[number];

export type RadarConnectorCollection = {
  signals: readonly RawRadarSignal[];
  cursor?: string | null;
  quotaRemaining?: number | null;
  quotaResetAt?: string | null;
  backoffUntil?: string | null;
};

export type RadarConnectorContext = {
  cursor: string | null;
  attemptedAt: string;
  signal: AbortSignal;
};

export interface RadarConnector<P extends RadarConnectorPlatform = RadarConnectorPlatform> {
  readonly platform: P;
  collect(context: RadarConnectorContext): Promise<RadarConnectorCollection>;
}

export type RadarConnectorRegistry = {
  [P in RadarConnectorPlatform]?: RadarConnector<P>;
};

export type RadarConnectorState = {
  cursor?: string | null;
  lastSuccessAt?: string | null;
  consecutiveFailures?: number;
  quotaRemaining?: number | null;
  quotaResetAt?: string | null;
  backoffUntil?: string | null;
};

export type RadarConnectorStateMap = Partial<
  Record<RadarConnectorPlatform, RadarConnectorState>
>;

export type RadarConnectorHealthResult = {
  connector_key: RadarConnectorPlatform;
  status: "healthy" | "down";
  last_checked_at: string;
  last_success_at: string | null;
  consecutive_failures: number;
  latency_ms: number | null;
  cursor_state: {
    cursor: string | null;
    attempted_at: string;
    succeeded_at: string | null;
    failed_at: string | null;
    quota_remaining: number | null;
    quota_reset_at: string | null;
    backoff_until: string | null;
  };
  last_error: string | null;
};

export type RadarConnectorRunResult = {
  status: "ok" | "partial" | "failed";
  signals: NormalizedRadarSignal[];
  health: RadarConnectorHealthResult[];
};

export type RunRadarConnectorsOptions = {
  connectors: RadarConnectorRegistry;
  previousState?: RadarConnectorStateMap;
  now?: () => Date;
  timeoutMs?: number;
};

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown connector failure";
}

export async function runRadarConnectors({
  connectors,
  previousState = {},
  now = () => new Date(),
  timeoutMs = 30_000,
}: RunRadarConnectorsOptions): Promise<RadarConnectorRunResult> {
  const attemptedAt = now().toISOString();
  const platforms = RADAR_CONNECTOR_PLATFORMS.filter(
    (platform) => connectors[platform] !== undefined,
  );
  const results = await Promise.all(
    platforms.map(async (platform) => {
      const connector = connectors[platform]!;
      const previous = previousState[platform];
      const previousCursor = previous?.cursor ?? null;

      try {
        const controller = new AbortController();
        let timeout: ReturnType<typeof setTimeout> | undefined;
        const collected = await Promise.race([
          connector.collect({
            cursor: previousCursor,
            attemptedAt,
            signal: controller.signal,
          }),
          new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
              reject(new Error(`Connector ${platform} timed out`));
              queueMicrotask(() => controller.abort());
            }, Math.max(1, timeoutMs));
          }),
        ]).finally(() => clearTimeout(timeout));
        const signals = collected.signals.map((raw) => {
          if (raw.platform !== platform) {
            throw new Error(
              `Connector ${platform} returned a signal tagged ${raw.platform}`,
            );
          }
          const policySignal =
            platform === "x" || platform === "threads"
              ? {
                  ...raw,
                  signalKind: "text_mention" as const,
                  rightsMode: "link_only" as const,
                  metrics: { volume: 1 },
                  metadata: undefined,
                }
              : raw;
          return normalizeRadarSignal(policySignal);
        });

        return {
          ok: true as const,
          signals,
          health: {
            connector_key: platform,
            status: "healthy",
            last_checked_at: attemptedAt,
            last_success_at: attemptedAt,
            consecutive_failures: 0,
            latency_ms: null,
            cursor_state: {
              cursor: collected.cursor ?? previousCursor,
              attempted_at: attemptedAt,
              succeeded_at: attemptedAt,
              failed_at: null,
              quota_remaining: collected.quotaRemaining ?? null,
              quota_reset_at: collected.quotaResetAt ?? null,
              backoff_until: collected.backoffUntil ?? null,
            },
            last_error: null,
          } satisfies RadarConnectorHealthResult,
        };
      } catch (error) {
        return {
          ok: false as const,
          signals: [] as NormalizedRadarSignal[],
          health: {
            connector_key: platform,
            status: "down",
            last_checked_at: attemptedAt,
            last_success_at: previous?.lastSuccessAt ?? null,
            consecutive_failures: (previous?.consecutiveFailures ?? 0) + 1,
            latency_ms: null,
            cursor_state: {
              cursor: previousCursor,
              attempted_at: attemptedAt,
              succeeded_at: previous?.lastSuccessAt ?? null,
              failed_at: attemptedAt,
              quota_remaining: previous?.quotaRemaining ?? null,
              quota_reset_at: previous?.quotaResetAt ?? null,
              backoff_until: previous?.backoffUntil ?? null,
            },
            last_error: errorMessage(error),
          } satisfies RadarConnectorHealthResult,
        };
      }
    }),
  );

  const succeeded = results.filter((result) => result.ok).length;
  const status =
    succeeded === results.length ? "ok" : succeeded === 0 ? "failed" : "partial";

  return {
    status,
    signals: results.flatMap((result) => result.signals),
    health: results.map((result) => result.health),
  };
}
