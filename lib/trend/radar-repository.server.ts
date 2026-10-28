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
import { buildEvidenceContentKey } from "@/lib/trend/external-evidence";

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
    creator_key: signal.creatorKey,
    canonical_identity_key: buildEvidenceContentKey({
      platform: signal.platform,
      platformContentId: signal.platformContentId,
      url: signal.canonicalUrl,
    }),
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
        .select("id,platform,platform_content_id,creator_key,signal_kind,canonical_url,query_seed,text,hashtags,published_at,observed_at,collected_at,metrics_json,language,language_confidence,korean_relevance,normalized_text_hash,ingestion_version,rights_mode,payload,raw_expires_at");
      if (error) fail("RADAR_SIGNAL_WRITE_FAILED");
      return (data ?? []).map<PersistedRadarSignal>((row) => ({
        id: row.id,
        platform: row.platform,
        platformContentId: row.platform_content_id,
        creatorKey: row.creator_key ?? undefined,
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

    async persistDiscoveredCandidates(candidates) {
      if (!candidates.length) return;
      const now = new Date().toISOString();
      const phrases = candidates.map((candidate) => candidate.normalizedPhrase);
      const { data: existingRows, error: existingError } = await admin
        .from("trend_candidates")
        .select("id,normalized_phrase,status,first_discovered_at,content_published_at,evidence_ids,source_policy_keys,score_components")
        .in("normalized_phrase", phrases);
      if (existingError) fail("RADAR_CANDIDATE_READ_FAILED");
      const existingByPhrase = new Map(
        (existingRows ?? []).map((row) => [row.normalized_phrase, row]),
      );
      const activeCandidates = candidates.filter((candidate) => {
        const status = existingByPhrase.get(candidate.normalizedPhrase)?.status;
        return status !== "approved" && status !== "rejected" && status !== "merged";
      });
      if (!activeCandidates.length) return;
      const { data, error } = await admin
        .from("trend_candidates")
        .upsert(
          activeCandidates.map((candidate) => {
            const existing = existingByPhrase.get(candidate.normalizedPhrase);
            const firstDiscoveredAt = [existing?.first_discovered_at, candidate.firstDiscoveredAt]
              .filter((value): value is string => Boolean(value))
              .sort()[0];
            const contentPublishedAt = [existing?.content_published_at, candidate.earliestPublishedAt]
              .filter((value): value is string => Boolean(value))
              .sort()[0] ?? null;
            const existingComponents =
              existing?.score_components &&
              typeof existing.score_components === "object" &&
              !Array.isArray(existing.score_components)
                ? existing.score_components
                : {};
            return {
              normalized_phrase: candidate.normalizedPhrase,
              display_name: candidate.displayName,
              candidate_kind: "new_meme",
              status: existing?.status ?? "discovered",
              content_published_at: contentPublishedAt,
              first_discovered_at: firstDiscoveredAt,
              last_assessed_at: now,
              external_state: "observing",
              confidence: 0,
              independent_use_count: 0,
              comparable_growth: false,
              score_components: {
                ...existingComponents,
                observed_content_count: candidate.observedContentCount,
                observed_creator_count: candidate.observedCreatorCount,
                note: "candidate_only_not_trend_evidence",
              },
              source_policy_keys: [...new Set([
                ...(existing?.source_policy_keys ?? []),
                ...candidate.platforms.map((platform) => `${platform}_api`),
              ])],
              evidence_ids: [...new Set([
                ...(existing?.evidence_ids ?? []),
                ...candidate.signalIds,
              ])],
              discovery_reason: `${candidate.observedContentCount}개의 실제 수집 게시물에서 반복된 표현입니다. 독립 사용례와 성장 근거는 아직 검수 전입니다.`,
            };
          }),
          { onConflict: "normalized_phrase" },
        )
        .select("id,normalized_phrase");
      if (error) fail("RADAR_CANDIDATE_WRITE_FAILED");

      const candidateByPhrase = new Map((data ?? []).map((row) => [row.normalized_phrase, row.id]));
      const links = activeCandidates.flatMap((candidate) => {
        const candidateId = candidateByPhrase.get(candidate.normalizedPhrase);
        if (!candidateId) return [];
        return candidate.signalIds.map((signalId) => ({
          candidate_id: candidateId,
          signal_id: signalId,
          relationship: "unknown",
          counts_as_independent: false,
          relationship_reviewed: false,
        }));
      });
      if (!links.length) return;
      const { error: linkError } = await admin
        .from("trend_candidate_signals")
        .upsert(links, { onConflict: "candidate_id,signal_id", ignoreDuplicates: true });
      if (linkError) fail("RADAR_CANDIDATE_SIGNAL_WRITE_FAILED");
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
