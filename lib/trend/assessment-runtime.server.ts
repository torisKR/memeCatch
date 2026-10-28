import "server-only";

import { createHash } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/database.types";
import { buildObservationAssessment, type CandidateSignalObservation, type ComparableWindowPair } from "./observation-assessment";
import { generateEvidenceDraft, type EvidenceDraftCompletion } from "./evidence-draft";

type Admin = ReturnType<typeof createAdminClient>;
const DAY = 86400000;
const SLOT = 6 * 3600000;

export function completedCollectionWindows(
  rows: ReadonlyArray<{ connector_key: string; discovery_lane: string; status: string; started_at: string | null; observation_scope: string; policy_config_fingerprint: string | null }>,
  policyKeys: readonly string[],
  now: Date,
): ComparableWindowPair | null {
  if (!policyKeys.length) return null;
  const end = Math.floor(now.getTime() / DAY) * DAY;
  const currentStart = end - 7 * DAY;
  const previousStart = currentStart - 7 * DAY;
  const scopes: string[] = [];
  for (const key of policyKeys) {
    const relevant = rows.filter((row) => row.connector_key === key && row.discovery_lane === "new_discovery" && row.started_at && Date.parse(row.started_at) >= previousStart && Date.parse(row.started_at) < end);
    if (relevant.some((row) => row.status !== "completed" || !row.observation_scope)) return null;
    const scopeSet = new Set(relevant.map((row) => row.observation_scope));
    const policySet = new Set(relevant.map((row) => row.policy_config_fingerprint));
    if (scopeSet.size !== 1 || policySet.size !== 1 || ![...policySet][0]) return null;
    const buckets = new Set(relevant.map((row) => Math.floor(Date.parse(row.started_at!) / SLOT)));
    for (let bucket = previousStart / SLOT; bucket < end / SLOT; bucket += 1) {
      if (!buckets.has(bucket)) return null;
    }
    scopes.push(`${key}:${[...scopeSet][0]}:${[...policySet][0]}`);
  }
  const fingerprint = createHash("sha256").update(scopes.sort().join("|")).digest("hex");
  const window = (start: number, stop: number) => ({
    kind: "daily_7d" as const, windowStart: new Date(start).toISOString(), windowEnd: new Date(stop).toISOString(),
    status: "completed" as const, observationScopeFingerprint: fingerprint,
    expectedBuckets: 28 * policyKeys.length, completedBuckets: 28 * policyKeys.length,
    apiFailureCount: 0, delayedBucketCount: 0,
  });
  return { current: window(currentStart, end), previous: window(previousStart, currentStart) };
}

function check(error: { message: string } | null, code: string) {
  if (error) throw new Error(code);
}

type SourcePolicyRow = {
  policy_key: string;
  platform: string;
  enabled: unknown;
  approval_basis: unknown;
  verified_at: unknown;
  derived_analysis_allowed: unknown;
  cross_platform_combination_allowed: unknown;
};

function hasValidApprovalMetadata(policy: SourcePolicyRow, now: Date): boolean {
  if (
    typeof policy.policy_key !== "string" || !policy.policy_key.trim() ||
    typeof policy.platform !== "string" || !policy.platform.trim() ||
    typeof policy.approval_basis !== "string" || !policy.approval_basis.trim() ||
    typeof policy.verified_at !== "string"
  ) return false;
  const verifiedAt = Date.parse(policy.verified_at);
  return Number.isFinite(verifiedAt) && verifiedAt <= now.getTime();
}

function permitsDerivedAnalysis(policy: SourcePolicyRow, now: Date): boolean {
  return policy.enabled === true &&
    policy.derived_analysis_allowed === true &&
    hasValidApprovalMetadata(policy, now);
}

function linkedSourcesPermitDerivedAnalysis(
  signals: ReadonlyArray<{ connector_key: string; platform: string }>,
  linkCount: number,
  policies: ReadonlyMap<string, SourcePolicyRow>,
  now: Date,
): boolean {
  if (signals.length !== linkCount || signals.length === 0) return false;
  const linkedPolicies = [...new Set(signals.map((signal) => signal.connector_key))].map((key) => policies.get(key));
  if (
    linkedPolicies.some((policy) => !policy || !permitsDerivedAnalysis(policy, now)) ||
    signals.some((signal) => {
      const policy = policies.get(signal.connector_key);
      return !policy || policy.platform.toLowerCase() !== signal.platform.toLowerCase();
    })
  ) return false;
  const platforms = new Set(signals.map((signal) => signal.platform.toLowerCase()));
  return platforms.size <= 1 || linkedPolicies.every(
    (policy) => policy?.cross_platform_combination_allowed === true,
  );
}

export async function runTrendAssessmentRuntime(
  admin: Admin,
  options: { now?: Date; complete?: EvidenceDraftCompletion; aiDailyLimit?: number } = {},
): Promise<{ assessed: number; drafts: number; observing: number }> {
  const now = options.now ?? new Date();
  const assessedAt = now.toISOString();
  const { data: policyRows, error: policyError } = await admin.from("radar_source_policies").select("*");
  check(policyError, "TREND_POLICY_READ_FAILED");
  const policies = (policyRows ?? []) as unknown as SourcePolicyRow[];
  if (!policies.some((policy) => permitsDerivedAnalysis(policy, now))) {
    return { assessed: 0, drafts: 0, observing: 0 };
  }
  const sourcePolicies = new Map(policies.map((policy) => [policy.policy_key, policy]));
  const mappedPolicies = policies.map((policy) => ({
    policyKey: policy.policy_key,
    platform: policy.platform,
    enabled: policy.enabled === true && hasValidApprovalMetadata(policy, now),
    derivedAnalysisAllowed: policy.derived_analysis_allowed === true,
    crossPlatformCombinationAllowed: policy.cross_platform_combination_allowed === true,
  }));
  const lease = await admin.rpc("claim_trend_collection_run", {
    p_connector_key: "assessment", p_lane: "candidate_tracking", p_idempotency_key: `assessment:${Math.floor(now.getTime() / SLOT)}`,
  });
  check(lease.error, "TREND_ASSESSMENT_CLAIM_FAILED");
  const claim = lease.data as { claimed?: boolean; run_id?: string; lease_token?: string } | null;
  if (!claim?.claimed || !claim.run_id || !claim.lease_token) return { assessed: 0, drafts: 0, observing: 0 };
  let assessed = 0;
  let drafts = 0;
  let observing = 0;
  const deadline = Date.now() + 20000;
  try {
    const runMetadata = await admin.from("radar_collection_runs").update({ observation_scope: "candidate_assessment_v1", policy_config_fingerprint: createHash("sha256").update("candidate_assessment_v1").digest("hex") }).eq("id", claim.run_id).eq("lease_token", claim.lease_token);
    check(runMetadata.error, "TREND_ASSESSMENT_METADATA_FAILED");
    const [{ data: candidates, error: candidateError }, { data: runs, error: runError }] = await Promise.all([
      admin.from("trend_candidates").select("*").in("status", ["discovered", "evidence_review", "held", "approved"]).order("independent_use_count", { ascending: false }).limit(40),
      admin.from("radar_collection_runs").select("connector_key,discovery_lane,status,started_at,observation_scope,policy_config_fingerprint").gte("started_at", new Date(now.getTime() - 15 * DAY).toISOString()).limit(1500),
    ]);
    check(candidateError, "TREND_CANDIDATE_READ_FAILED"); check(runError, "TREND_COVERAGE_READ_FAILED");
    for (const candidate of candidates ?? []) {
      if (Date.now() >= deadline) break;
      const { data: links, error: linkError } = await admin.from("trend_candidate_signals").select("signal_id,relationship,counts_as_independent,relationship_reviewed").eq("candidate_id", candidate.id);
      check(linkError, "TREND_LINK_READ_FAILED");
      if (!links?.length) continue;
      const { data: signals, error: signalError } = await admin.from("external_signals").select("id,platform,connector_key,canonical_identity_key,platform_content_id,creator_key,availability_status,published_at,observed_at,raw_expires_at,retention_until,text,canonical_url,payload").in("id", links.map((link) => link.signal_id));
      check(signalError, "TREND_SIGNAL_READ_FAILED");
      if (!linkedSourcesPermitDerivedAnalysis(
        (signals ?? []).map((signal) => ({ connector_key: signal.connector_key, platform: signal.platform })),
        links.length,
        sourcePolicies,
        now,
      )) continue;
      const signalById = new Map((signals ?? []).map((signal) => [signal.id, signal]));
      const observations = links.flatMap((link): CandidateSignalObservation[] => {
        const signal = signalById.get(link.signal_id);
        return signal ? [{
          id: signal.id, policyKey: signal.connector_key, platform: signal.platform,
          contentKey: signal.canonical_identity_key ?? `${signal.platform}:${signal.platform_content_id}`,
          creatorKey: signal.creator_key, relationship: link.relationship as CandidateSignalObservation["relationship"],
          relationshipReviewed: link.relationship_reviewed,
          countsAsIndependent: link.counts_as_independent && !(signal.payload && typeof signal.payload === "object" && !Array.isArray(signal.payload) && signal.payload.metadata_verified === false),
          availabilityStatus: signal.availability_status as CandidateSignalObservation["availabilityStatus"],
          publishedAt: signal.published_at, observedAt: signal.observed_at,
          retentionUntil: Date.parse(signal.retention_until) < Date.parse(signal.raw_expires_at) ? signal.retention_until : signal.raw_expires_at,
        }] : [];
      });
      const keys = [...new Set(observations.filter((row) => row.relationshipReviewed && row.countsAsIndependent).map((row) => row.policyKey))];
      const result = buildObservationAssessment({
        contentPublishedAt: candidate.content_published_at, firstDiscoveredAt: candidate.first_discovered_at,
        assessedAt, existingMemeId: candidate.target_meme_id, operatorReviewed: candidate.status === "approved",
        links: observations, policies: mappedPolicies,
        windows: completedCollectionWindows(runs ?? [], keys, now), snapshots: [],
      });
      const { assessment } = result;
      const currentCount = result.currentIndependentUseCount;
      const growth = result.assessmentInput.components.growth;
      const qualified = currentCount !== null && currentCount >= 3;
      const externalState = qualified ? assessment.state : "observing";
      const { error: writeError } = await admin.from("trend_candidates").update({
        external_state: externalState, external_score: qualified ? assessment.score : null,
        confidence: assessment.confidence, independent_use_count: currentCount ?? assessment.independentUseCount,
        comparable_growth: Boolean(qualified && growth?.policyAllowed && growth.comparable && growth.value !== null && growth.value > 0),
        last_assessed_at: assessedAt,
        score_components: {
          algorithm_version: "external_evidence_v1", values: assessment.componentValues,
          missing_reasons: assessment.missingReasons, rejection_reasons: result.rejectionReasons,
          current_independent_uses: currentCount, previous_independent_uses: result.previousIndependentUseCount,
          observation_windows: result.assessmentInput.components.growth?.comparable ? completedCollectionWindows(runs ?? [], keys, now) as unknown as Json : null,
        },
        updated_at: assessedAt,
      }).eq("id", candidate.id);
      check(writeError, "TREND_ASSESSMENT_WRITE_FAILED");
      assessed += 1;
      if (externalState === "observing") observing += 1;
      if (candidate.status === "approved" && (!qualified || !assessment.publicEligible)) {
        const { error } = await admin.from("public_meme_trend_summaries").delete().eq("candidate_id", candidate.id);
        check(error, "TREND_PUBLIC_INVALIDATION_FAILED");
      } else if (candidate.status === "approved" && assessment.publicEligible) {
        // Update observations only; never create a projection or rewrite reviewed claims.
        const { error } = await admin.from("public_meme_trend_summaries").update({
          external_state: assessment.state as "rising" | "revival",
          external_score: assessment.score, confidence: assessment.confidence,
          independent_use_count: currentCount!, last_verified_at: assessedAt,
          stale_after: new Date(now.getTime() + 7 * DAY).toISOString(), updated_at: assessedAt,
        }).eq("candidate_id", candidate.id);
        check(error, "TREND_PUBLIC_OBSERVATION_REFRESH_FAILED");
      }
      if (!options.complete || drafts >= 1 || deadline - Date.now() < 15000 || candidate.status === "approved") continue;
      const draftSources = (signals ?? []).filter((signal) => signal.text && signal.availability_status === "available" && Date.parse(signal.raw_expires_at) > now.getTime()).map((signal) => ({
        id: signal.id, text: signal.text!.slice(0, 12000), kind: (links.find((link) => link.signal_id === signal.id)?.relationship === "independent" ? "independent_use" : "other") as "independent_use" | "other",
        observedScope: "title_description" as const, sourceUrl: signal.canonical_url ?? undefined,
        publishedAt: signal.published_at ?? undefined, provenanceStatus: "unverified" as const,
      })).slice(0, 30);
      if (!draftSources.length) continue;
      const reservation = await admin.rpc("reserve_trend_ai_draft", { p_candidate_id: candidate.id, p_daily_limit: Math.min(20, Math.max(0, options.aiDailyLimit ?? 20)) });
      check(reservation.error, "TREND_AI_BUDGET_RESERVATION_FAILED");
      if (!reservation.data) continue;
      const draft = await generateEvidenceDraft({ candidateName: candidate.display_name, suppliedAliases: candidate.aliases, evidence: draftSources }, options.complete);
      const { error: draftError } = await admin.from("trend_candidates").update({ ai_draft: draft as unknown as Json }).eq("id", candidate.id).neq("status", "approved");
      check(draftError, "TREND_AI_DRAFT_WRITE_FAILED");
      drafts += 1;
    }
    const finish = await admin.rpc("finish_trend_collection_run", { p_run_id: claim.run_id, p_lease_token: claim.lease_token, p_status: "completed", p_error: null });
    check(finish.error, "TREND_ASSESSMENT_FINISH_FAILED");
    return { assessed, drafts, observing };
  } catch (error) {
    await admin.rpc("finish_trend_collection_run", { p_run_id: claim.run_id, p_lease_token: claim.lease_token, p_status: "failed", p_error: "TREND_ASSESSMENT_FAILED" });
    throw error;
  }
}
