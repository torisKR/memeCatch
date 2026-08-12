import "server-only";

import type { Json } from "@/lib/database.types";
import {
  runRadarConnectors,
  type RadarConnectorRegistry,
  type RadarConnectorStateMap,
} from "@/lib/trend/radar-connectors.server";
import {
  calculateRadarSignal,
  isRadarAggregationPlatform,
  matchRadarEntity,
  recommendRadarState,
  type NormalizedRadarSignal,
  type RadarEntity,
  type RadarObservation,
  type RadarState,
} from "@/lib/trend/radar";

export type RadarMeme = RadarEntity & {
  state: RadarState;
};

export type PersistedRadarSignal = NormalizedRadarSignal & {
  id: string;
};

export interface RadarRepository {
  loadConnectorState(): Promise<RadarConnectorStateMap>;
  loadMemes(): Promise<readonly RadarMeme[]>;
  persistConnectorHealth(
    rows: Awaited<ReturnType<typeof runRadarConnectors>>["health"],
  ): Promise<void>;
  persistSignals(signals: readonly NormalizedRadarSignal[]): Promise<PersistedRadarSignal[]>;
  persistMatch(input: {
    memeId: string;
    signalId: string;
    confidence: number;
    method: string;
    automatic: boolean;
  }): Promise<void>;
  recordObservation(input: {
    memeId: string;
    signalId: string | null;
    observedAt: string;
    heat: number;
    confidence: number;
    recommendedState: RadarState;
    factors: Json;
  }): Promise<void>;
  enqueueSafetyReview(input: {
    memeId: string;
    signalId: string;
    evidence: Json;
  }): Promise<void>;
}

export type RadarPulseResult = {
  status: "ok" | "partial" | "failed";
  persistedSignals: number;
  automaticMatches: number;
  pendingMatches: number;
  observations: number;
  safetyReviews: number;
};

const AUTOMATIC_MATCH_CONFIDENCE = 0.9;

function metric(signal: PersistedRadarSignal, name: string): number {
  const value = signal.metrics?.[name];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function observation(signal: PersistedRadarSignal, confidence: number): RadarObservation {
  return {
    platform: signal.platform,
    observedAt: signal.observedAt,
    volume: metric(signal, "volume"),
    velocity: metric(signal, "velocity"),
    engagement: metric(signal, "engagement"),
    sourceReliability: confidence,
  };
}

function isSafetyReviewSignal(signal: PersistedRadarSignal): boolean {
  return metric(signal, "risk") >= 0.7 || metric(signal, "reports") >= 20;
}

export async function runRadarPulse(input: {
  connectors: RadarConnectorRegistry;
  repository: RadarRepository;
  now?: () => Date;
}): Promise<RadarPulseResult> {
  const previousState = await input.repository.loadConnectorState();
  const connectorRun = await runRadarConnectors({
    connectors: input.connectors,
    previousState,
    now: input.now,
  });
  const signals = await input.repository.persistSignals(connectorRun.signals);
  await input.repository.persistConnectorHealth(connectorRun.health);
  const memes = await input.repository.loadMemes();
  const matched = new Map<string, Array<{ signal: PersistedRadarSignal; confidence: number }>>();
  let automaticMatches = 0;
  let pendingMatches = 0;
  let safetyReviews = 0;

  for (const signal of signals) {
    const text = [signal.text ?? "", ...(signal.hashtags ?? []).map((tag) => `#${tag}`)].join(" ");
    const match = matchRadarEntity(text, memes);
    if (!match) continue;

    const automatic = match.confidence >= AUTOMATIC_MATCH_CONFIDENCE;
    await input.repository.persistMatch({
      memeId: match.entityId,
      signalId: signal.id,
      confidence: match.confidence,
      method: match.matchMethod,
      automatic,
    });
    if (!automatic) {
      pendingMatches += 1;
      continue;
    }

    automaticMatches += 1;
    const current = matched.get(match.entityId) ?? [];
    current.push({ signal, confidence: match.confidence });
    matched.set(match.entityId, current);

    if (isSafetyReviewSignal(signal)) {
      await input.repository.enqueueSafetyReview({
        memeId: match.entityId,
        signalId: signal.id,
        evidence: { platform: signal.platform, metrics: signal.metrics ?? {} },
      });
      safetyReviews += 1;
    }
  }

  let observations = 0;
  for (const meme of memes) {
    const matches = matched.get(meme.id);
    if (!matches?.length) continue;

    const score = calculateRadarSignal({
      observations: matches.map(({ signal, confidence }) => observation(signal, confidence)),
      referenceAt: input.now?.() ?? new Date(),
    });
    if (!score.aggregationObservations.length) continue;

    const recommendedState = recommendRadarState(
      meme.state,
      score.heat,
      score.confidence,
    );
    const latest = matches
      .filter(({ signal }) => isRadarAggregationPlatform(signal.platform))
      .sort((left, right) =>
        right.signal.observedAt.localeCompare(left.signal.observedAt),
      )[0].signal;
    await input.repository.recordObservation({
      memeId: meme.id,
      signalId: latest.id,
      observedAt: latest.observedAt,
      heat: score.heat,
      confidence: score.confidence,
      recommendedState,
      factors: {
        platforms: [...score.aggregatedPlatforms],
        excluded_platforms: score.excludedObservations.map(({ platform }) => platform),
      },
    });
    observations += 1;
  }

  return {
    status: connectorRun.status,
    persistedSignals: signals.length,
    automaticMatches,
    pendingMatches,
    observations,
    safetyReviews,
  };
}
