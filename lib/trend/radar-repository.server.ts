import "server-only";

import type { Json, TablesInsert } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  NormalizedRadarSignal,
  RadarState,
} from "@/lib/trend/radar";
import type {
  RadarConnectorHealthResult,
  RadarConnectorStateMap,
  RadarConnectorPlatform,
} from "@/lib/trend/radar-connectors.server";
import type {
  PersistedRadarSignal,
  RadarMeme,
  RadarRepository,
} from "@/lib/trend/radar-pulse.server";

type AdminClient = ReturnType<typeof createAdminClient>;

function fail(message: string): never {
  throw new Error(message);
}

function stateFromLifecycle(value: string): RadarState {
  if (value === "rising") return "rising";
  if (value === "cooling") return "cooling";
  if (value === "archived") return "archive";
  return "trending";
}

function connectorState(row: {
  connector_key: string;
  last_success_at: string | null;
  consecutive_failures: number;
  cursor_state: Json;
}): [RadarConnectorPlatform, RadarConnectorStateMap[RadarConnectorPlatform]] {
  const cursor = typeof row.cursor_state === "object" && row.cursor_state !== null && !Array.isArray(row.cursor_state)
    ? row.cursor_state
    : {};
  const stringValue = (key: string) => typeof cursor[key] === "string" ? cursor[key] : null;
  const numberValue = (key: string) => typeof cursor[key] === "number" ? cursor[key] : null;
  return [
    row.connector_key as RadarConnectorPlatform,
    {
      cursor: stringValue("cursor"),
      lastSuccessAt: row.last_success_at,
      consecutiveFailures: row.consecutive_failures,
      quotaRemaining: numberValue("quota_remaining"),
      quotaResetAt: stringValue("quota_reset_at"),
      backoffUntil: stringValue("backoff_until"),
    },
  ];
}

function signalInsert(signal: NormalizedRadarSignal): TablesInsert<"external_signals"> {
  const collectedAt = signal.collectedAt ?? signal.observedAt;
  return {
    platform: signal.platform,
    connector_key: signal.platform,
    platform_content_id: signal.platformContentId,
    signal_kind: signal.signalKind ?? "content_observation",
    canonical_url: signal.canonicalUrl,
    query_seed: signal.querySeed,
    text: signal.text,
    hashtags: [...(signal.hashtags ?? [])],
    published_at: signal.publishedAt,
    observed_at: signal.observedAt,
    collected_at: collectedAt,
    first_seen_at: signal.observedAt,
    last_seen_at: signal.observedAt,
    metrics_json: signal.metrics ?? {},
    language: signal.language,
    language_confidence: signal.languageConfidence,
    korean_relevance: signal.koreanRelevance,
    normalized_text_hash: signal.normalizedTextHash,
    ingestion_version: signal.ingestionVersion ?? 1,
    rights_mode: signal.rightsMode ?? "api_metadata",
    payload: signal.metadata ?? {},
    raw_expires_at: signal.rawExpiresAt,
  };
}

export function createRadarRepository(
  admin: AdminClient = createAdminClient(),
): RadarRepository {
  return {
    async loadConnectorState() {
      const { data, error } = await admin
        .from("connector_health")
        .select("connector_key,last_success_at,consecutive_failures,cursor_state");
      if (error) fail("RADAR_CONNECTOR_STATE_READ_FAILED");
      return Object.fromEntries((data ?? []).map(connectorState));
    },

    async loadMemes() {
      const { data: memes, error: memeError } = await admin
        .from("memes")
        .select("id,title,aliases,lifecycle_status")
        .in("moderation_status", ["approved", "limited"]);
      if (memeError) fail("RADAR_MEME_READ_FAILED");
      const { data: states, error: stateError } = await admin
        .from("radar_meme_state")
        .select("meme_id,current_state");
      if (stateError) fail("RADAR_STATE_READ_FAILED");
      const stateByMeme = new Map((states ?? []).map((row) => [row.meme_id, row.current_state]));
      return (memes ?? []).map<RadarMeme>((meme) => ({
        id: meme.id,
        canonicalName: meme.title,
        aliases: meme.aliases,
        state: (stateByMeme.get(meme.id) as RadarState | undefined) ?? stateFromLifecycle(meme.lifecycle_status),
      }));
    },

    async persistConnectorHealth(rows: RadarConnectorHealthResult[]) {
      if (!rows.length) return;
      const { error } = await admin
        .from("connector_health")
        .upsert(rows, { onConflict: "connector_key" });
      if (error) fail("RADAR_CONNECTOR_HEALTH_WRITE_FAILED");
    },

    async persistSignals(signals) {
      if (!signals.length) return [];
      const uniqueSignals = [
        ...new Map(
          signals.map((signal) => [
            `${signal.platform}:${signal.platformContentId}`,
            signal,
          ]),
        ).values(),
      ];
      const { data, error } = await admin
        .from("external_signals")
        .upsert(uniqueSignals.map(signalInsert), {
          onConflict: "platform,platform_content_id",
          ignoreDuplicates: true,
        })
        .select("id,platform,platform_content_id,signal_kind,canonical_url,query_seed,text,hashtags,published_at,observed_at,collected_at,metrics_json,language,language_confidence,korean_relevance,normalized_text_hash,ingestion_version,rights_mode,payload,raw_expires_at");
      if (error) fail("RADAR_SIGNAL_WRITE_FAILED");
      return (data ?? []).map<PersistedRadarSignal>((row) => ({
        id: row.id,
        platform: row.platform,
        platformContentId: row.platform_content_id,
        canonicalUrl: row.canonical_url ?? "",
        signalKind: row.signal_kind as NormalizedRadarSignal["signalKind"],
        querySeed: row.query_seed ?? undefined,
        text: row.text ?? undefined,
        hashtags: row.hashtags,
        publishedAt: row.published_at ?? undefined,
        observedAt: row.observed_at,
        collectedAt: row.collected_at,
        metrics: row.metrics_json as Record<string, number>,
        language: row.language ?? undefined,
        languageConfidence: row.language_confidence ?? undefined,
        koreanRelevance: row.korean_relevance ?? undefined,
        normalizedTextHash: row.normalized_text_hash ?? "",
        ingestionVersion: row.ingestion_version,
        rightsMode: row.rights_mode as NormalizedRadarSignal["rightsMode"],
        metadata: row.payload as NormalizedRadarSignal["metadata"],
        rawExpiresAt: row.raw_expires_at,
      }));
    },

    async persistMatch(input) {
      const reviewState = input.automatic ? "auto_matched" : "pending";
      const { error } = await admin.from("meme_signal_links").upsert(
        {
          meme_id: input.memeId,
          signal_id: input.signalId,
          match_confidence: input.confidence,
          match_method: input.method,
          review_state: reviewState,
          reviewed_at: input.automatic ? new Date().toISOString() : undefined,
        },
        { onConflict: "meme_id,signal_id" },
      );
      if (error) fail("RADAR_MATCH_WRITE_FAILED");
    },

    async recordObservation(input) {
      const { error } = await admin.rpc("record_radar_trend_observation", {
        p_meme_id: input.memeId,
        p_signal_id: input.signalId,
        p_observed_at: input.observedAt,
        p_heat_score: input.heat,
        p_confidence: input.confidence,
        p_recommended_state: input.recommendedState,
        p_model_version: "radar_v1",
        p_factors: input.factors,
        p_required_observations: 2,
      });
      if (error) fail("RADAR_OBSERVATION_WRITE_FAILED");
    },

    async enqueueSafetyReview(input) {
      const { error } = await admin.rpc("enqueue_safety_review", {
        p_meme_id: input.memeId,
        p_proposed_level: "gray",
        p_reason: "external_context_risk",
        p_evidence: input.evidence,
        p_source_signal_id: input.signalId,
      });
      if (error) fail("RADAR_SAFETY_REVIEW_WRITE_FAILED");
    },
  };
}
