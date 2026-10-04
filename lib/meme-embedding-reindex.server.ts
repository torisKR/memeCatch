import "server-only";

import { randomUUID } from "node:crypto";
import { embedBundledMemePassage } from "@/lib/meme-embedding-runtime.server";
import { createAdminClient } from "@/lib/supabase/admin";

const MAX_DOCUMENTS = 25;
const WORK_BUDGET_MS = 90_000;
const LEASE_TTL_SECONDS = 180;
const RPC_TIMEOUT_MS = 10_000;

export type MemeEmbeddingRunError =
  | "model_unavailable"
  | "rpc_unavailable"
  | "deadline_exceeded"
  | "store_failed"
  | "internal_error";

export type MemeEmbeddingReindexResult = {
  status: "succeeded" | "partial" | "failed" | "deferred";
  indexed: number;
  stale: number;
  remaining: number;
  errorCode: MemeEmbeddingRunError | null;
};

type RpcError = { code?: string; message?: string };
type RpcResult = { data: unknown; error: RpcError | null };
type RpcOperation = PromiseLike<RpcResult> & {
  abortSignal?: (signal: AbortSignal) => PromiseLike<RpcResult>;
};
type ReindexClient = {
  rpc(name: string, args?: Record<string, unknown>): RpcOperation;
};
type EmbeddingJob = { meme_id: string; document: string; source_hash: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH_RE = /^[0-9a-f]{32}$/;

function pendingCount(data: unknown): number | null {
  const row = Array.isArray(data) ? data[0] : null;
  if (!row || typeof row !== "object" || !("pending" in row)) return null;
  const pending = Number(row.pending);
  return Number.isSafeInteger(pending) && pending >= 0 && pending <= 10_000_000 ? pending : null;
}

function embeddingJobs(data: unknown): EmbeddingJob[] | null {
  if (!Array.isArray(data) || data.length > MAX_DOCUMENTS) return null;
  const jobs: EmbeddingJob[] = [];
  for (const value of data) {
    if (!value || typeof value !== "object") return null;
    const row = value as Record<string, unknown>;
    if (typeof row.meme_id !== "string" || !UUID_RE.test(row.meme_id)
      || typeof row.source_hash !== "string" || !HASH_RE.test(row.source_hash)
      || typeof row.document !== "string" || !row.document.trim()
      || Array.from(row.document).length > 6_900) return null;
    jobs.push({ meme_id: row.meme_id, source_hash: row.source_hash, document: row.document });
  }
  return jobs;
}

async function rpcWithTimeout(
  client: ReindexClient,
  name: string,
  args: Record<string, unknown> | undefined,
  timeoutMs: number,
): Promise<RpcResult> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return { data: null, error: { code: "deadline" } };
  }
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<RpcResult>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve({ data: null, error: { code: "timeout" } });
    }, Math.max(1, Math.floor(timeoutMs)));
    timer.unref?.();
  });
  try {
    const operation = client.rpc(name, args);
    const abortable = operation.abortSignal?.(controller.signal) ?? operation;
    return await Promise.race([Promise.resolve(abortable), timeout]);
  } catch {
    return { data: null, error: { code: "rpc_failed" } };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function remainingWorkMs(startedAt: number): number {
  return Math.max(0, WORK_BUDGET_MS - (Date.now() - startedAt));
}

function workRpc(
  client: ReindexClient,
  name: string,
  args: Record<string, unknown> | undefined,
  startedAt: number,
): Promise<RpcResult> {
  return rpcWithTimeout(client, name, args, Math.min(RPC_TIMEOUT_MS, remainingWorkMs(startedAt)));
}

async function loadBacklog(client: ReindexClient, startedAt: number): Promise<number | null> {
  const { data, error } = await workRpc(client, "meme_embedding_backlog", undefined, startedAt);
  return error ? null : pendingCount(data);
}

async function finishRun(
  client: ReindexClient,
  owner: string,
  result: Omit<MemeEmbeddingReindexResult, "status"> & { status: "succeeded" | "partial" | "failed" },
): Promise<boolean> {
  const { data, error } = await rpcWithTimeout(client, "finish_meme_embedding_run", {
    p_owner: owner,
    p_status: result.status,
    p_indexed: result.indexed,
    p_stale: result.stale,
    p_remaining: result.remaining,
    p_error_code: result.errorCode,
  }, RPC_TIMEOUT_MS);
  return !error && data === true;
}

/**
 * Runs one bounded public-catalog delta pass. The service-only RPCs keep raw
 * documents, vectors, lease owners, and database errors out of the result.
 */
export async function runMemeEmbeddingReindex(): Promise<MemeEmbeddingReindexResult> {
  const startedAt = Date.now();
  let client: ReindexClient;
  try {
    client = createAdminClient() as unknown as ReindexClient;
  } catch {
    return { status: "failed", indexed: 0, stale: 0, remaining: 0, errorCode: "rpc_unavailable" };
  }

  const owner = randomUUID();
  let acquired = false;
  try {
    const { data, error } = await workRpc(client, "acquire_meme_embedding_run", {
      p_owner: owner,
      p_ttl_seconds: LEASE_TTL_SECONDS,
    }, startedAt);
    if (error) {
      return { status: "failed", indexed: 0, stale: 0, remaining: 0, errorCode: "rpc_unavailable" };
    }
    acquired = data === true;
    if (!acquired) {
      return {
        status: "deferred",
        indexed: 0,
        stale: 0,
        remaining: await loadBacklog(client, startedAt) ?? 0,
        errorCode: null,
      };
    }
  } catch {
    return { status: "failed", indexed: 0, stale: 0, remaining: 0, errorCode: "rpc_unavailable" };
  }

  let indexed = 0;
  let stale = 0;
  let initialPending = 0;
  let status: "succeeded" | "partial" | "failed" = "succeeded";
  let errorCode: MemeEmbeddingRunError | null = null;

  try {
    const backlog = await loadBacklog(client, startedAt);
    if (backlog === null) {
      status = "failed";
      errorCode = "rpc_unavailable";
    } else {
      initialPending = backlog;
    }

    if (!errorCode && initialPending > 0) {
      const { data, error } = await workRpc(client, "list_meme_embedding_jobs", { p_limit: MAX_DOCUMENTS }, startedAt);
      const jobs = error ? null : embeddingJobs(data);
      if (!jobs) {
        status = "failed";
        errorCode = "rpc_unavailable";
      } else {
        for (const job of jobs) {
          if (Date.now() - startedAt >= WORK_BUDGET_MS) {
            status = "partial";
            errorCode = "deadline_exceeded";
            break;
          }

          const vector = await embedBundledMemePassage(job.document);
          if (!vector) {
            status = "failed";
            errorCode = "model_unavailable";
            break;
          }
          if (remainingWorkMs(startedAt) === 0) {
            status = "partial";
            errorCode = "deadline_exceeded";
            break;
          }

          const stored = await workRpc(client, "store_meme_embedding", {
            p_meme_id: job.meme_id,
            p_source_hash: job.source_hash,
            p_embedding: vector,
          }, startedAt);
          if (stored.error || typeof stored.data !== "boolean") {
            status = "failed";
            errorCode = "store_failed";
            break;
          }
          if (stored.data) indexed += 1;
          else stale += 1;
        }
      }
    }
  } catch {
    status = "failed";
    errorCode = "internal_error";
  }

  const observedRemaining = remainingWorkMs(startedAt) > 0
    ? await loadBacklog(client, startedAt).catch(() => null)
    : null;
  const remaining = observedRemaining ?? Math.max(0, initialPending - indexed);
  if (status === "succeeded" && remaining > 0) status = "partial";
  if (status === "succeeded" && remainingWorkMs(startedAt) === 0) {
    status = "partial";
    errorCode = "deadline_exceeded";
  }
  const result = { status, indexed, stale, remaining, errorCode };

  try {
    if (await finishRun(client, owner, result)) return result;
  } catch { /* The lease expires independently; do not expose database details. */ }
  return { status: "failed", indexed, stale, remaining, errorCode: "rpc_unavailable" };
}
