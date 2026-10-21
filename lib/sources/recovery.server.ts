import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  sourceIngestionFailure,
  type SourceIngestionErrorCode,
} from "./ingestion-errors";

export const MAX_RETRY_DELAY_MS = 24 * 60 * 60 * 1_000;
const INITIAL_RETRY_DELAY_MS = 5 * 60 * 1_000;

export type RecoveryPlatform = "youtube" | "youtube_shorts" | "tiktok" | "instagram";
const RECOVERY_PLATFORMS = ["youtube", "youtube_shorts", "tiktok", "instagram"] as const;
const RECOVERY_ERROR_CODES = [
  "invalid_url",
  "missing_meme",
  "provider_transient",
  "provider_uncertain",
  "metadata_mismatch",
  "db_failure",
] as const;

function isRecoveryPlatform(value: unknown): value is RecoveryPlatform {
  return typeof value === "string" && RECOVERY_PLATFORMS.some((platform) => platform === value);
}

function isSourceIngestionErrorCode(value: unknown): value is SourceIngestionErrorCode {
  return typeof value === "string" && RECOVERY_ERROR_CODES.some((code) => code === value);
}

export type SourceAcquisitionFailureInput = {
  readonly sourceKey: string;
  readonly idempotencyKey: string;
  readonly platform: RecoveryPlatform;
  readonly sourceId?: string | null;
  readonly externalId: string | null;
  readonly canonicalUrl: string | null;
  readonly code: SourceIngestionErrorCode;
  readonly attempt: number;
  readonly occurredAt: Date;
};

export type SourceAcquisitionFailureResult = {
  readonly attemptCount: number;
  readonly nextRetryAt: string | null;
  readonly recorded: boolean;
};

export type SourceAcquisitionResolution = {
  readonly sourceKey: string;
  readonly attemptIdempotencyKey: string;
  readonly attemptStartedAt: Date;
  readonly resolvedAt: Date;
};

export type SourceAcquisitionRecoveryDto = {
  readonly sourceKey: string;
  readonly sourceId: string | null;
  readonly platform: RecoveryPlatform;
  readonly externalId: string | null;
  readonly canonicalUrl: string | null;
  readonly attemptCount: number;
  readonly nextRetryAt: string | null;
  readonly lastErrorCode: SourceIngestionErrorCode;
  readonly lastErrorRetryable: boolean;
  readonly lastAttemptedAt: string;
  readonly resolvedAt: string | null;
};

type RecoveryRpcResult = {
  data: unknown;
  error: { message: string } | null;
  count?: number | null;
};

type RecoveryRpcCall = PromiseLike<RecoveryRpcResult> & {
  eq?: (column: string, value: NonNullable<unknown>) => RecoveryRpcCall;
  in?: (column: string, values: readonly NonNullable<unknown>[]) => RecoveryRpcCall;
  not?: (column: string, operator: string, value: unknown) => RecoveryRpcCall;
  lte?: (column: string, value: NonNullable<unknown>) => RecoveryRpcCall;
  or?: (filters: string) => RecoveryRpcCall;
  limit?: (count: number) => RecoveryRpcCall;
  order?: (column: string, options: { ascending: true }) => RecoveryRpcCall;
  select?: (columns: string) => RecoveryRpcCall;
};

type RecoveryRpc = {
  rpc(name: string, args: Record<string, unknown>, options?: { count: "exact"; head: true }): RecoveryRpcCall;
};

function recoveryRecord(data: unknown): Record<string, unknown> | null {
  if (!Array.isArray(data)) return null;
  const first = data[0];
  if (!first || typeof first !== "object" || Array.isArray(first)) return null;
  return first as Record<string, unknown>;
}

function recoveryDtos(data: unknown): SourceAcquisitionRecoveryDto[] {
  if (!Array.isArray(data)) throw new Error("source_recovery_query_invalid");
  return data.flatMap((row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return [];
    const record = row as Record<string, unknown>;
    if (
      typeof record.source_key !== "string" ||
      typeof record.platform !== "string" ||
      typeof record.attempt_count !== "number" ||
      typeof record.last_error_code !== "string" ||
      typeof record.last_error_retryable !== "boolean" ||
      typeof record.last_attempted_at !== "string" ||
      !isRecoveryPlatform(record.platform) ||
      !isSourceIngestionErrorCode(record.last_error_code)
    ) return [];
    return [{
      sourceKey: record.source_key,
      sourceId: typeof record.source_id === "string" ? record.source_id : null,
      platform: record.platform,
      externalId: typeof record.external_id === "string" ? record.external_id : null,
      canonicalUrl: typeof record.canonical_url === "string" ? record.canonical_url : null,
      attemptCount: record.attempt_count,
      nextRetryAt: typeof record.next_retry_at === "string" ? record.next_retry_at : null,
      lastErrorCode: record.last_error_code,
      lastErrorRetryable: record.last_error_retryable,
      lastAttemptedAt: record.last_attempted_at,
      resolvedAt: typeof record.resolved_at === "string" ? record.resolved_at : null,
    }];
  });
}

export function sourceAcquisitionKey(
  platform: RecoveryPlatform,
  externalId: string,
): string {
  return `${platform}:${externalId}`;
}

export function retryDelayMs(attempt: number): number {
  const safeAttempt = Math.max(1, Math.trunc(attempt));
  return Math.min(
    MAX_RETRY_DELAY_MS,
    INITIAL_RETRY_DELAY_MS * 2 ** Math.min(safeAttempt - 1, 31),
  );
}

export function buildRecoveryFailure(input: {
  readonly code: SourceIngestionErrorCode;
  readonly attempt: number;
  readonly now: Date;
}) {
  const failure = sourceIngestionFailure(input.code);
  return {
    retryable: failure.retryable,
    nextRetryAt: failure.retryable
      ? new Date(input.now.getTime() + retryDelayMs(input.attempt)).toISOString()
      : null,
  };
}

export async function recordSourceAcquisitionFailure(
  input: SourceAcquisitionFailureInput,
  admin: RecoveryRpc = createAdminClient(),
): Promise<SourceAcquisitionFailureResult> {
  const schedule = buildRecoveryFailure({
    code: input.code,
    attempt: input.attempt,
    now: input.occurredAt,
  });
  const { data, error } = await admin.rpc("record_source_acquisition_failure", {
    p_source_key: input.sourceKey,
    p_source_id: input.sourceId ?? null,
    p_idempotency_key: input.idempotencyKey,
    p_platform: input.platform,
    p_external_id: input.externalId,
    p_canonical_url: input.canonicalUrl,
    p_error_code: input.code,
    p_retryable: schedule.retryable,
    p_attempted_at: input.occurredAt.toISOString(),
    p_next_retry_at: null,
  });
  if (error) throw new Error("source_recovery_record_failed");
  const record = recoveryRecord(data);
  if (!record) throw new Error("source_recovery_record_missing");
  const attemptCount = record.attempt_count;
  if (typeof attemptCount !== "number") throw new Error("source_recovery_record_invalid");
  return {
    attemptCount,
    nextRetryAt: typeof record.next_retry_at === "string" ? record.next_retry_at : null,
    recorded: record.recorded === true,
  };
}

export async function resolveSourceAcquisitionFailure(
  input: SourceAcquisitionResolution,
  admin: RecoveryRpc = createAdminClient(),
): Promise<void> {
  if (!input.attemptIdempotencyKey || !input.attemptStartedAt) {
    throw new Error("source_recovery_resolution_context_required");
  }
  const { data, error } = await admin.rpc("resolve_source_acquisition_failure", {
    p_source_key: input.sourceKey,
    p_attempt_idempotency_key: input.attemptIdempotencyKey,
    p_attempt_started_at: input.attemptStartedAt.toISOString(),
    p_resolved_at: input.resolvedAt.toISOString(),
  });
  const record = recoveryRecord(data);
  if (error || record?.resolved !== true) {
    throw new Error("source_recovery_resolution_failed");
  }
}

export async function listDueSourceAcquisitionRecovery(
  now: Date,
  limit: number,
  admin: RecoveryRpc = createAdminClient(),
): Promise<SourceAcquisitionRecoveryDto[]> {
  const { data, error } = await admin.rpc("list_due_source_acquisition_recovery", {
    p_now: now.toISOString(),
    p_limit: Math.max(1, Math.min(limit, 500)),
  });
  if (error) throw new Error("source_recovery_query_failed");
  return recoveryDtos(data);
}

export function isSourceAcquisitionRecoveryCircuitOpen(recovery: {
  attemptCount: number;
  lastErrorCode: SourceIngestionErrorCode;
}) {
  return recovery.attemptCount >= (recovery.lastErrorCode === "db_failure" ? 2 : 3);
}

const ELIGIBLE_DUE_FILTER =
  "and(last_error_code.eq.db_failure,attempt_count.lt.2),and(last_error_code.neq.db_failure,attempt_count.lt.3)";
const CIRCUIT_OPEN_FILTER =
  "and(last_error_code.eq.db_failure,attempt_count.gte.2),and(last_error_code.neq.db_failure,attempt_count.gte.3)";

function dueRecoveryQuery(
  now: Date,
  filter: string,
  admin: RecoveryRpc,
  options?: { count: "exact"; head: true },
): RecoveryRpcCall {
  const query = options
    ? admin.rpc("list_active_source_acquisition_recovery", {}, options)
    : admin.rpc("list_active_source_acquisition_recovery", {});
  const not = query.not;
  const lte = query.lte;
  const or = query.or;
  if (
    typeof not !== "function" ||
    typeof lte !== "function" ||
    typeof or !== "function"
  ) {
    throw new Error("source_recovery_query_failed");
  }
  const sourceLinked = not.call(query, "source_id", "is", null);
  if (typeof sourceLinked.lte !== "function") {
    throw new Error("source_recovery_query_failed");
  }
  const due = sourceLinked.lte("next_retry_at", now.toISOString());
  if (typeof due.or !== "function") {
    throw new Error("source_recovery_query_failed");
  }
  return due.or(filter);
}

export async function listEligibleDueSourceAcquisitionRecovery(
  now: Date,
  limit: number,
  admin: RecoveryRpc = createAdminClient(),
): Promise<SourceAcquisitionRecoveryDto[]> {
  const boundedLimit = Math.max(1, Math.min(limit, 500));
  const query = dueRecoveryQuery(now, ELIGIBLE_DUE_FILTER, admin);
  if (typeof query.in !== "function" || typeof query.order !== "function" || typeof query.limit !== "function") {
    throw new Error("source_recovery_query_failed");
  }
  // Deferred social adapters must not consume the supported provider queue.
  const { data, error } = await query.in("platform", ["youtube", "youtube_shorts"])
    .order!("next_retry_at", { ascending: true })
    .order!("source_key", { ascending: true })
    .limit!(boundedLimit);
  if (error) throw new Error("source_recovery_query_failed");
  const rows = recoveryDtos(data);
  if (
    !Array.isArray(data) ||
    rows.length !== data.length ||
    rows.length > boundedLimit ||
    rows.some((row) => (
      row.sourceId === null ||
      (row.platform !== "youtube" && row.platform !== "youtube_shorts") ||
      row.nextRetryAt === null ||
      !Number.isFinite(Date.parse(row.nextRetryAt)) ||
      Date.parse(row.nextRetryAt) > now.getTime() ||
      isSourceAcquisitionRecoveryCircuitOpen(row)
    ))
  ) {
    throw new Error("source_recovery_query_invalid");
  }
  return rows;
}

export async function countDueSourceAcquisitionCircuits(
  now: Date,
  admin: RecoveryRpc = createAdminClient(),
): Promise<number> {
  const query = dueRecoveryQuery(now, CIRCUIT_OPEN_FILTER, admin, { count: "exact", head: true });
  if (typeof query.select !== "function") throw new Error("source_recovery_query_failed");
  const { count, error } = await query.select("source_key");
  if (error || typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new Error("source_recovery_query_failed");
  }
  return count;
}

export async function listActiveSourceAcquisitionRecovery(
  admin: RecoveryRpc = createAdminClient(),
  sourceId?: string,
): Promise<SourceAcquisitionRecoveryDto[]> {
  const query = admin.rpc("list_active_source_acquisition_recovery", {});
  let request: PromiseLike<RecoveryRpcResult> = query;
  if (sourceId !== undefined) {
    if (typeof query.eq !== "function") {
      throw new Error("source_recovery_query_failed");
    }
    request = query.eq("source_id", sourceId);
  }
  const { data, error } = await request;
  if (error) throw new Error("source_recovery_query_failed");
  const rows = recoveryDtos(data);
  if (
    !Array.isArray(data) ||
    rows.length !== data.length ||
    (sourceId !== undefined && rows.some((row) => row.sourceId !== sourceId))
  ) {
    throw new Error("source_recovery_query_invalid");
  }
  return rows;
}

export async function listActiveSourceAcquisitionRecoveryForSources(
  admin: RecoveryRpc,
  sourceIds: readonly string[],
): Promise<SourceAcquisitionRecoveryDto[]> {
  const selectedSourceIds = [...new Set(sourceIds)];
  if (selectedSourceIds.length === 0) return [];

  const query = admin.rpc("list_active_source_acquisition_recovery", {});
  if (typeof query.in !== "function") {
    throw new Error("source_recovery_query_failed");
  }
  const { data, error } = await query.in("source_id", selectedSourceIds);
  if (error) throw new Error("source_recovery_query_failed");

  const allowed = new Set(selectedSourceIds);
  const rows = recoveryDtos(data);
  if (
    !Array.isArray(data) ||
    rows.length !== data.length ||
    rows.some((row) => row.sourceId === null || !allowed.has(row.sourceId))
  ) {
    throw new Error("source_recovery_query_invalid");
  }
  return rows;
}
