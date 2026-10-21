import "server-only";

import { createHash } from "node:crypto";
import type { Database, Json } from "@/lib/database.types";
import type {
  TrendPipelineFunctions,
  TrendPipelineTables,
} from "@/lib/trend/database-contract";
import {
  collectYouTubeDiscovery,
  type DiscoveryLane,
  type YouTubeDiscoveryRecord,
  type YouTubeDiscoverySeed,
} from "@/lib/trend/discovery-collector";
import { extractRadarHashtags, normalizeRadarText } from "@/lib/trend/radar";

type QueryError = { code?: string; message?: string };
type QueryResult<T> = PromiseLike<{ data: T | null; error: QueryError | null }>;

type ExternalSignalRow = Database["public"]["Tables"]["external_signals"]["Row"];
type PendingCandidateRow = Pick<
  Database["public"]["Tables"]["trend_candidates"]["Row"],
  "id" | "display_name" | "normalized_phrase" | "status" | "last_assessed_at"
>;

type RuntimeTableRows = {
  radar_source_policies: TrendPipelineTables["radar_source_policies"]["Row"];
  radar_discovery_seeds: TrendPipelineTables["radar_discovery_seeds"]["Row"];
  radar_collection_runs: TrendPipelineTables["radar_collection_runs"]["Row"];
  radar_metric_snapshots: TrendPipelineTables["radar_metric_snapshots"]["Row"];
  external_signals: ExternalSignalRow;
  trend_candidates: PendingCandidateRow;
};

export interface TrendDiscoverySelectQuery<Row> extends QueryResult<Row[]> {
  eq(column: string, value: unknown): TrendDiscoverySelectQuery<Row>;
  in(column: string, values: readonly unknown[]): TrendDiscoverySelectQuery<Row>;
  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): TrendDiscoverySelectQuery<Row>;
  limit(value: number): TrendDiscoverySelectQuery<Row>;
}

export interface TrendDiscoveryMutationQuery<Row> extends QueryResult<Row[] | null> {
  select(columns: string): TrendDiscoverySelectQuery<Row>;
}

export interface TrendDiscoveryUpdateQuery<Row> extends QueryResult<Row[] | null> {
  eq(column: string, value: unknown): TrendDiscoveryUpdateQuery<Row>;
}

export interface TrendDiscoveryTableQuery<Row> {
  select(columns: string): TrendDiscoverySelectQuery<Row>;
  upsert(
    values: readonly Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): TrendDiscoveryMutationQuery<Row>;
  update(values: Record<string, unknown>): TrendDiscoveryUpdateQuery<Row>;
}

export interface TrendDiscoveryAdmin {
  from<Name extends keyof RuntimeTableRows>(name: Name): TrendDiscoveryTableQuery<RuntimeTableRows[Name]>;
  rpc<Name extends keyof TrendPipelineFunctions>(
    name: Name,
    args: TrendPipelineFunctions[Name]["Args"],
  ): QueryResult<TrendPipelineFunctions[Name]["Returns"]>;
}

export type TrendDiscoveryRuntimeOptions = {
  env?: Readonly<Record<string, string | undefined>>;
  fetch?: typeof fetch;
  now?: () => Date;
  maxRuntimeMs?: number;
  requestTimeoutMs?: number;
  dailyCallLimit?: number;
  candidateDailyLimit?: number;
  maxTrackingCandidates?: number;
  newDiscoveryLookbackDays?: number;
  runRetention?: boolean;
};

export type TrendDiscoveryLaneResult = {
  claimed: boolean;
  runId: string | null;
  status: "completed" | "partial" | "failed" | "budget_exhausted" | "skipped";
  callsUsed: number;
};

export type TrendDiscoveryRuntimeResult = {
  status: "completed" | "partial" | "disabled" | "failed";
  disabledReason: "missing_api_key" | "source_policy_disabled" | null;
  lanes: Record<DiscoveryLane, TrendDiscoveryLaneResult>;
  persistedSignals: number;
  persistedSnapshots: number;
  discoveredCandidates: number;
  errorCodes: string[];
};

type ClaimedRun = {
  lane: DiscoveryLane;
  runId: string;
  leaseToken: string;
  perRunLimit: number;
};

type SeedWithBudget = YouTubeDiscoverySeed & { callBudget: number };

const LANES = ["new_discovery", "candidate_tracking"] as const;
const CONNECTOR_KEY = "youtube";
const SIX_HOURS_MS = 6 * 60 * 60 * 1_000;

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.floor(parsed)));
}

function emptyLane(): TrendDiscoveryLaneResult {
  return { claimed: false, runId: null, status: "skipped", callsUsed: 0 };
}

function fail(code: string): Error {
  const error = new Error(code);
  error.name = "TrendDiscoveryRuntimeError";
  return error;
}

function errorCode(error: unknown, fallback: string): string {
  return error instanceof Error && /^[A-Z0-9_]{3,100}$/u.test(error.message)
    ? error.message
    : fallback;
}

function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function stableBucket(at: Date): string {
  const bucket = Math.floor(at.getTime() / SIX_HOURS_MS) * SIX_HOURS_MS;
  return new Date(bucket).toISOString();
}

function earliest(left: string | null | undefined, right: string | null | undefined): string | null {
  return [left, right].filter((value): value is string => Boolean(value)).sort()[0] ?? null;
}

function latest(left: string | null | undefined, right: string | null | undefined): string | null {
  return [left, right].filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

function policyFields(fields: readonly string[]): string[] {
  const allowed = new Set([
    "title",
    "description",
    "channel_id",
    "published_at",
    "duration",
    "statistics.view_count",
    "statistics.like_count",
    "statistics.comment_count",
    "status.privacy_status",
    "status.embeddable",
  ]);
  return [...new Set(fields.filter((field) => allowed.has(field)))];
}

function policyConfigFingerprint(policy: TrendPipelineTables["radar_source_policies"]["Row"]): string {
  return createHash("sha256").update(JSON.stringify({
    policy_key: policy.policy_key,
    platform: policy.platform,
    collectable_fields: [...policy.collectable_fields].sort(),
    derived_analysis_allowed: policy.derived_analysis_allowed,
    cross_platform_combination_allowed: policy.cross_platform_combination_allowed,
    retention_days: policy.retention_days,
    verified_at: policy.verified_at,
  })).digest("hex");
}

function configuredSeeds(
  rows: readonly TrendPipelineTables["radar_discovery_seeds"]["Row"][],
  lane: DiscoveryLane,
): SeedWithBudget[] {
  return rows.flatMap((row) => {
    if (!row.enabled || row.discovery_lane !== lane || row.platform !== CONNECTOR_KEY) return [];
    if (row.seed_type === "term") {
      return [{ id: row.id, query: row.seed_value, callBudget: boundedInteger(row.call_budget_per_run, 0, 0, 100) }];
    }
    if (row.seed_type === "account") {
      return [{ id: row.id, query: "", channelId: row.seed_value, callBudget: boundedInteger(row.call_budget_per_run, 0, 0, 100) }];
    }
    return [];
  });
}

function trackingSeeds(
  rows: readonly PendingCandidateRow[],
  maximum: number,
): SeedWithBudget[] {
  return rows.slice(0, maximum).flatMap((candidate) => {
    const query = candidate.display_name.trim();
    return query ? [{ id: `candidate:${candidate.id}`, query, callBudget: 2 }] : [];
  });
}

function observationScope(
  lane: DiscoveryLane,
  seeds: readonly SeedWithBudget[],
  newDiscoveryLookbackDays: number,
  maxPagesPerSeed: number,
): string {
  const scope = {
    provider: CONNECTOR_KEY,
    lane,
    cadence_hours: 6,
    max_pages_per_seed: maxPagesPerSeed,
    max_results_per_page: 25,
    published_after_window_days: lane === "new_discovery" ? newDiscoveryLookbackDays : null,
    seeds: seeds.map((seed) => ({
      query: normalizeRadarText(seed.query),
      channel_id: seed.channelId?.trim().toLowerCase() ?? null,
      call_budget: seed.callBudget,
    })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  };
  return `youtube:${lane}:6h:${createHash("sha256").update(JSON.stringify(scope)).digest("hex")}`;
}

function availability(record: YouTubeDiscoveryRecord): {
  status: string;
  reason: string | null;
  unavailableAt: string | null;
} {
  if (record.verificationStatus === "verified") {
    if (record.privacyStatus === "private" || record.privacyStatus === "unlisted") {
      return { status: "private", reason: `youtube_${record.privacyStatus}`, unavailableAt: record.measuredAt };
    }
    return { status: "available", reason: null, unavailableAt: null };
  }
  return {
    status: "unknown",
    reason: record.verificationStatus,
    unavailableAt: record.verificationStatus === "video_unavailable_or_private" ? record.measuredAt : null,
  };
}

function rawMetricPayload(record: YouTubeDiscoveryRecord): {
  values: Record<string, string>;
  missing: Record<string, string>;
} {
  const values: Record<string, string> = {};
  const missing: Record<string, string> = {};
  for (const [name, metric] of Object.entries(record.rawMetrics)) {
    const storageName = name.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`);
    if (metric.value !== null) values[storageName] = metric.value;
    else if (metric.missingReason) missing[storageName] = metric.missingReason;
  }
  return { values, missing };
}

function signalUpsert(
  record: YouTubeDiscoveryRecord,
  derivedAnalysisAllowed: boolean,
  existing?: ExternalSignalRow,
): Record<string, unknown> {
  const text = [record.title, record.description].filter(Boolean).join("\n").slice(0, 10_000) || null;
  const metrics = rawMetricPayload(record);
  const state = availability(record);
  const existingPayload = asObject(existing?.payload) ?? {};
  return {
    platform: "youtube",
    connector_key: record.sourcePolicyKey,
    platform_content_id: record.platformContentId,
    creator_key: record.creatorKey ?? existing?.creator_key ?? null,
    canonical_identity_key: `youtube:${record.platformContentId}`,
    signal_kind: "content_observation",
    canonical_url: record.canonicalUrl,
    query_seed: record.querySeed.slice(0, 500),
    text: text ?? existing?.text ?? null,
    hashtags: derivedAnalysisAllowed && text ? extractRadarHashtags(text) : [],
    published_at: earliest(existing?.published_at, record.sourcePublishedAt),
    observed_at: record.measuredAt,
    collected_at: record.measuredAt,
    first_seen_at: earliest(existing?.first_seen_at, record.firstDiscoveredAt) ?? record.firstDiscoveredAt,
    last_seen_at: latest(existing?.last_seen_at, record.measuredAt) ?? record.measuredAt,
    metrics_json: metrics.values,
    normalized_text_hash: derivedAnalysisAllowed && text
      ? createHash("sha256").update(normalizeRadarText(text)).digest("hex")
      : null,
    ingestion_version: 1,
    rights_mode: "api_metadata",
    payload: {
      ...existingPayload,
      youtube: {
        title: record.title,
        description: record.description,
        channel_id: record.channelId,
        duration_seconds: record.durationSeconds,
        privacy_status: record.privacyStatus,
        embeddable: record.embeddable,
        verification_status: record.verificationStatus,
        raw_metrics: metrics.values,
        missing_metrics: metrics.missing,
        source_policy_verified_at: record.sourcePolicyVerifiedAt,
      },
    } satisfies Json,
    raw_expires_at: record.metadataExpiresAt,
    retention_until: record.metadataExpiresAt,
    availability_status: state.status,
    unavailable_reason: state.reason,
    unavailable_at: state.unavailableAt,
  };
}

function snapshotUpserts(
  record: YouTubeDiscoveryRecord,
  signalId: string,
): Record<string, unknown>[] {
  return Object.entries(record.rawMetrics).map(([name, metric]) => ({
    signal_id: signalId,
    policy_key: record.sourcePolicyKey,
    metric_name: name.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`),
    metric_class: "raw",
    value: metric.value,
    unit: "count",
    observation_scope: "youtube_video_total",
    missing_reason: metric.missingReason,
    observed_at: record.measuredAt,
    collected_at: record.measuredAt,
    retention_until: record.metadataExpiresAt,
  }));
}

function recordPreference(record: YouTubeDiscoveryRecord): number {
  if (record.verificationStatus === "verified") return 3;
  if (record.verificationStatus === "video_unavailable_or_private") return 2;
  if (record.verificationStatus === "videos_list_failed") return 1;
  return 0;
}

function uniqueSignalRecords(records: readonly YouTubeDiscoveryRecord[]): YouTubeDiscoveryRecord[] {
  const unique = new Map<string, YouTubeDiscoveryRecord>();
  for (const record of records) {
    const current = unique.get(record.platformContentId);
    if (!current) {
      unique.set(record.platformContentId, record);
      continue;
    }
    const preferred = recordPreference(record) > recordPreference(current) ? record : current;
    unique.set(record.platformContentId, {
      ...preferred,
      firstDiscoveredAt: earliest(current.firstDiscoveredAt, record.firstDiscoveredAt) ?? preferred.firstDiscoveredAt,
    });
  }
  return [...unique.values()];
}

async function loadPolicy(admin: TrendDiscoveryAdmin) {
  const { data, error } = await admin
    .from("radar_source_policies")
    .select("policy_key,platform,collectable_fields,derived_analysis_allowed,cross_platform_combination_allowed,retention_days,approval_basis,verified_at,enabled")
    .eq("policy_key", CONNECTOR_KEY)
    .limit(1);
  if (error) throw fail("TREND_POLICY_READ_FAILED");
  return data?.[0] ?? null;
}

async function loadSeeds(admin: TrendDiscoveryAdmin) {
  const { data, error } = await admin
    .from("radar_discovery_seeds")
    .select("id,seed_type,seed_value,discovery_lane,platform,enabled,call_budget_per_run")
    .eq("enabled", true)
    .eq("platform", CONNECTOR_KEY);
  if (error) throw fail("TREND_SEED_READ_FAILED");
  return data ?? [];
}

async function loadPendingCandidates(admin: TrendDiscoveryAdmin, limit: number) {
  const { data, error } = await admin
    .from("trend_candidates")
    .select("id,display_name,normalized_phrase,status,last_assessed_at")
    .in("status", ["discovered", "evidence_review", "held"])
    .order("last_assessed_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw fail("TREND_TRACKING_CANDIDATE_READ_FAILED");
  return data ?? [];
}

async function claimRun(
  admin: TrendDiscoveryAdmin,
  lane: DiscoveryLane,
  bucket: string,
  perRunLimit: number,
): Promise<ClaimedRun | null> {
  const { data, error } = await admin.rpc("claim_trend_collection_run", {
    p_connector_key: CONNECTOR_KEY,
    p_lane: lane,
    p_idempotency_key: `${CONNECTOR_KEY}:${lane}:${bucket}`,
  });
  if (error) throw fail("TREND_COLLECTION_CLAIM_FAILED");
  const claim = asObject(data);
  if (!claim) throw fail("TREND_COLLECTION_CLAIM_INVALID");
  if (claim.claimed !== true) return null;
  if (typeof claim.run_id !== "string" || typeof claim.lease_token !== "string") {
    throw fail("TREND_COLLECTION_CLAIM_INVALID");
  }
  return { lane, runId: claim.run_id, leaseToken: claim.lease_token, perRunLimit };
}

async function finishRun(
  admin: TrendDiscoveryAdmin,
  run: ClaimedRun,
  status: "completed" | "failed" | "budget_exhausted",
  error: string | null,
) {
  const result = await admin.rpc("finish_trend_collection_run", {
    p_run_id: run.runId,
    p_lease_token: run.leaseToken,
    p_status: status,
    p_error: error,
  });
  if (result.error) throw fail("TREND_COLLECTION_FINISH_FAILED");
}

async function persistObservationScope(
  admin: TrendDiscoveryAdmin,
  run: ClaimedRun,
  scope: string,
  policyFingerprint: string,
) {
  const result = await admin
    .from("radar_collection_runs")
    .update({
      observation_scope: scope,
      policy_config_fingerprint: policyFingerprint,
    })
    .eq("id", run.runId)
    .eq("lease_token", run.leaseToken);
  if (result.error) throw fail("TREND_COLLECTION_SCOPE_WRITE_FAILED");
}

async function persistRecords(
  admin: TrendDiscoveryAdmin,
  records: readonly YouTubeDiscoveryRecord[],
  derivedAnalysisAllowed: boolean,
): Promise<{ signalIds: Map<string, string>; snapshots: number }> {
  if (!records.length) return { signalIds: new Map(), snapshots: 0 };
  const signalRecords = uniqueSignalRecords(records);
  const ids = signalRecords.map((record) => record.platformContentId);
  const existingResult = await admin
    .from("external_signals")
    .select("id,platform_content_id,creator_key,published_at,text,hashtags,first_seen_at,last_seen_at,payload,normalized_text_hash,retention_until")
    .eq("platform", "youtube")
    .in("platform_content_id", ids);
  if (existingResult.error) throw fail("TREND_SIGNAL_READ_FAILED");
  const existingByContent = new Map((existingResult.data ?? []).map((row) => [row.platform_content_id, row]));
  const rows = signalRecords.map((record) => signalUpsert(
    record,
    derivedAnalysisAllowed,
    existingByContent.get(record.platformContentId),
  ));
  const persisted = await admin
    .from("external_signals")
    .upsert(rows, { onConflict: "platform,platform_content_id" })
    .select("id,platform_content_id");
  if (persisted.error) throw fail("TREND_SIGNAL_WRITE_FAILED");
  const signalIds = new Map((persisted.data ?? []).map((row) => [row.platform_content_id, row.id]));
  if (signalIds.size !== ids.length) throw fail("TREND_SIGNAL_WRITE_INCOMPLETE");

  const snapshots = records.flatMap((record) => {
    const signalId = signalIds.get(record.platformContentId);
    return signalId ? snapshotUpserts(record, signalId) : [];
  });
  const uniqueSnapshots = [...new Map(snapshots.map((snapshot) => [
    `${snapshot.signal_id}:${snapshot.metric_name}:${snapshot.observed_at}`,
    snapshot,
  ])).values()];
  if (uniqueSnapshots.length) {
    const snapshotResult = await admin
      .from("radar_metric_snapshots")
      .upsert(uniqueSnapshots, { onConflict: "signal_id,metric_name,observed_at" });
    if (snapshotResult.error) throw fail("TREND_SNAPSHOT_WRITE_FAILED");
  }
  return { signalIds, snapshots: uniqueSnapshots.length };
}

export async function runTrendDiscoveryRuntime(
  admin: TrendDiscoveryAdmin,
  options: TrendDiscoveryRuntimeOptions = {},
): Promise<TrendDiscoveryRuntimeResult> {
  const env = options.env ?? process.env;
  const lanes: Record<DiscoveryLane, TrendDiscoveryLaneResult> = {
    new_discovery: emptyLane(),
    candidate_tracking: emptyLane(),
  };
  const resultBase = {
    lanes,
    persistedSignals: 0,
    persistedSnapshots: 0,
    discoveredCandidates: 0,
    errorCodes: [] as string[],
  };
  const apiKey = env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) {
    return { ...resultBase, status: "disabled", disabledReason: "missing_api_key" };
  }

  let policy: Awaited<ReturnType<typeof loadPolicy>>;
  try {
    policy = await loadPolicy(admin);
  } catch (error) {
    return {
      ...resultBase,
      status: "failed",
      disabledReason: null,
      errorCodes: [errorCode(error, "TREND_POLICY_READ_FAILED")],
    };
  }
  if (!policy?.enabled || policy.platform !== CONNECTOR_KEY) {
    return { ...resultBase, status: "disabled", disabledReason: "source_policy_disabled" };
  }

  const now = options.now ?? (() => new Date());
  const derivedAnalysisAllowed = policy.derived_analysis_allowed === true;
  const maxRuntimeMs = boundedInteger(options.maxRuntimeMs, 40_000, 1_000, 45_000);
  const dailyCallLimit = boundedInteger(
    options.dailyCallLimit ?? env.RADAR_YOUTUBE_DAILY_CALL_LIMIT,
    derivedAnalysisAllowed ? 90 : 8,
    1,
    100,
  );
  const candidateDailyLimit = boundedInteger(
    options.candidateDailyLimit ?? env.RADAR_DISCOVERY_DAILY_CANDIDATE_LIMIT,
    150,
    1,
    150,
  );
  const maxTrackingCandidates = boundedInteger(options.maxTrackingCandidates, 10, 0, 25);
  const newDiscoveryLookbackDays = boundedInteger(options.newDiscoveryLookbackDays, 14, 1, 30);
  const maxPagesPerSeed = derivedAnalysisAllowed ? 2 : 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("trend_discovery_runtime_timeout"), maxRuntimeMs);
  const claimed = new Map<DiscoveryLane, ClaimedRun>();

  try {
    const seedRows = await loadSeeds(admin);
    const candidates = derivedAnalysisAllowed
      ? await loadPendingCandidates(admin, maxTrackingCandidates)
      : [];
    const referenceAt = now();
    const publishedAfter = new Date(
      referenceAt.getTime() - newDiscoveryLookbackDays * 86_400_000,
    ).toISOString();
    const explicitSeeds = (lane: DiscoveryLane) => configuredSeeds(seedRows, lane).filter((seed) =>
      derivedAnalysisAllowed || seed.query.trim().length > 0,
    );
    const laneSeeds: Record<DiscoveryLane, SeedWithBudget[]> = {
      new_discovery: explicitSeeds("new_discovery").map((seed) => ({
        ...seed,
        publishedAfter,
      })),
      candidate_tracking: [
        ...explicitSeeds("candidate_tracking"),
        ...(derivedAnalysisAllowed ? trackingSeeds(candidates, maxTrackingCandidates) : []),
      ],
    };
    const configuredPerRun: Record<DiscoveryLane, number> = {
      new_discovery: boundedInteger(
        env.RADAR_NEW_DISCOVERY_CALL_BUDGET_PER_RUN,
        derivedAnalysisAllowed ? 20 : 2,
        0,
        dailyCallLimit,
      ),
      candidate_tracking: boundedInteger(
        env.RADAR_CANDIDATE_TRACKING_CALL_BUDGET_PER_RUN,
        derivedAnalysisAllowed ? 30 : 0,
        0,
        dailyCallLimit,
      ),
    };
    const laneBudget: Record<DiscoveryLane, number> = {
      new_discovery: Math.min(
        configuredPerRun.new_discovery,
        laneSeeds.new_discovery.reduce((sum, seed) => sum + seed.callBudget, 0),
      ),
      candidate_tracking: Math.min(
        configuredPerRun.candidate_tracking,
        laneSeeds.candidate_tracking.reduce((sum, seed) => sum + seed.callBudget, 0),
      ),
    };
    const bucket = stableBucket(referenceAt);
    for (const lane of LANES) {
      if (laneSeeds[lane].length === 0 || laneBudget[lane] <= 0) continue;
      const perRunLimit = Math.max(1, laneBudget[lane]);
      const run = await claimRun(admin, lane, bucket, perRunLimit);
      if (!run) continue;
      claimed.set(lane, run);
      await persistObservationScope(
        admin,
        run,
        observationScope(lane, laneSeeds[lane], newDiscoveryLookbackDays, maxPagesPerSeed),
        policyConfigFingerprint(policy),
      );
      lanes[lane] = { claimed: true, runId: run.runId, status: "partial", callsUsed: 0 };
    }

    if (options.runRetention !== false) {
      const retention = await admin.rpc("expire_trend_evidence", {});
      if (retention.error) resultBase.errorCodes.push("TREND_RETENTION_MAINTENANCE_FAILED");
    }

    const seedCalls = new Map<string, number>();
    const collection = await collectYouTubeDiscovery({
      apiKey,
      sourcePolicy: {
        key: policy.policy_key,
        enabled: policy.enabled,
        derivedAnalysisAllowed,
        collectableFields: policyFields(policy.collectable_fields),
        approvalBasis: policy.approval_basis,
        verifiedAt: policy.verified_at,
        retentionDays: policy.retention_days,
      },
      lanes: {
        new_discovery: {
          callBudget: laneBudget.new_discovery,
          seeds: claimed.has("new_discovery") ? laneSeeds.new_discovery : [],
        },
        candidate_tracking: {
          callBudget: laneBudget.candidate_tracking,
          seeds: claimed.has("candidate_tracking") ? laneSeeds.candidate_tracking : [],
        },
      },
      reserveCall: async (request) => {
        const run = claimed.get(request.lane);
        if (!run) return false;
        const seed = laneSeeds[request.lane].find((candidate) => candidate.id === request.seedId);
        if (!seed) return false;
        const used = seedCalls.get(`${request.lane}:${seed.id}`) ?? 0;
        if (used >= seed.callBudget) return false;
        const reservation = await admin.rpc("reserve_trend_collection_call", {
          p_run_id: run.runId,
          p_lease_token: run.leaseToken,
          p_per_run_limit: run.perRunLimit,
          p_daily_limit: dailyCallLimit,
          p_cost_units: 1,
        });
        if (reservation.error) throw fail("TREND_COLLECTION_RESERVE_FAILED");
        if (reservation.data === true) seedCalls.set(`${request.lane}:${seed.id}`, used + 1);
        return reservation.data === true;
      },
      fetch: options.fetch,
      now,
      signal: controller.signal,
      timeoutMs: boundedInteger(options.requestTimeoutMs, 10_000, 500, 15_000),
      maxPagesPerSeed,
      maxResultsPerPage: 25,
      knownPhrases: candidates.flatMap((candidate) => [candidate.display_name, candidate.normalized_phrase]),
    });

    for (const lane of LANES) lanes[lane].callsUsed = collection.callsUsed[lane];
    const persisted = await persistRecords(admin, collection.records, derivedAnalysisAllowed);
    resultBase.persistedSignals = persisted.signalIds.size;
    resultBase.persistedSnapshots = persisted.snapshots;

    for (const term of derivedAnalysisAllowed ? collection.candidateTerms : []) {
      const signalIds = term.platformContentIds.flatMap((contentId) => {
        const id = persisted.signalIds.get(contentId);
        return id ? [id] : [];
      });
      if (signalIds.length < 2) continue;
      const candidate = await admin.rpc("persist_discovered_trend_candidate", {
        p_phrase: term.normalizedPhrase,
        p_display_name: term.displayName,
        p_signal_ids: signalIds,
        p_daily_limit: candidateDailyLimit,
      });
      if (candidate.error) {
        resultBase.errorCodes.push("TREND_CANDIDATE_WRITE_FAILED");
        continue;
      }
      resultBase.discoveredCandidates += 1;
    }

    const failureByLane = new Set(collection.failures.map((failure) => failure.lane));
    for (const lane of LANES) {
      const run = claimed.get(lane);
      if (!run) continue;
      const status = collection.budgetExhausted[lane]
        ? "budget_exhausted"
        : failureByLane.has(lane) || controller.signal.aborted
          ? "failed"
          : "completed";
      const safeError = status === "failed"
        ? controller.signal.aborted ? "TREND_COLLECTION_TIMEOUT" : "YOUTUBE_API_REQUEST_FAILED"
        : null;
      await finishRun(admin, run, status, safeError);
      lanes[lane].status = status;
    }
    resultBase.errorCodes.push(...collection.failures.map(() => "YOUTUBE_API_REQUEST_FAILED"));
    if (controller.signal.aborted) resultBase.errorCodes.push("TREND_COLLECTION_TIMEOUT");
    const partial = resultBase.errorCodes.length > 0 || LANES.some((lane) => lanes[lane].status !== "completed" && lanes[lane].status !== "skipped");
    return {
      ...resultBase,
      status: partial ? "partial" : "completed",
      disabledReason: null,
      errorCodes: [...new Set(resultBase.errorCodes)],
    };
  } catch (error) {
    const code = errorCode(error, "TREND_DISCOVERY_RUNTIME_FAILED");
    resultBase.errorCodes.push(code);
    for (const lane of LANES) {
      const run = claimed.get(lane);
      if (!run) continue;
      try {
        await finishRun(admin, run, "failed", code);
        lanes[lane].status = "failed";
      } catch {
        resultBase.errorCodes.push("TREND_COLLECTION_FINISH_FAILED");
      }
    }
    return {
      ...resultBase,
      status: "failed",
      disabledReason: null,
      errorCodes: [...new Set(resultBase.errorCodes)],
    };
  } finally {
    clearTimeout(timer);
  }
}
