import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { hasTrustedOrigin } from "@/lib/origin";
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { executePlan } from "@/lib/db/execute";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { readBoundedJson, RequestBodyTooLargeError } from "@/lib/request-body";
import type { QueryPlan } from "@/lib/db/plan";
import type { DbIdentity } from "@/lib/db/pool";
import { PUBLIC_CATALOG_CACHE_TAG } from "@/lib/db/cache-tags";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPS = new Set(["select", "insert", "update", "delete", "upsert", "rpc"]);
// Explore pagination sends the discovery index as UUIDs in an IN filter.
const MAX_BODY_BYTES = 1024 * 1024;
const MAX_ROWS = 1000;
const DEFAULT_ROWS = 500;
const MAX_EMBED_ROWS = 100;
const DEFAULT_EMBED_ROWS = 50;
const MAX_ACTIVE_QUERIES = 6;
let activeQueries = 0;

// This boundary only applies to browser-supplied plans, not trusted server queries.
function boundPlan(plan: QueryPlan): boolean {
  if (!Array.isArray(plan.fields) || !Array.isArray(plan.filters) || !Array.isArray(plan.orGroups) || !Array.isArray(plan.orders)) return false;
  if (plan.op === "select" || plan.op === "rpc") {
    if (plan.limit == null) plan.limit = DEFAULT_ROWS;
    if (!Number.isInteger(plan.limit) || plan.limit < 0 || plan.limit > MAX_ROWS) return false;
  }
  let nodes = 0;
  let rowBudget = plan.op === "select" || plan.op === "rpc" ? plan.limit! : DEFAULT_ROWS;
  const pending: Array<{ fields: QueryPlan["fields"]; depth: number; parents: number }> = [{ fields: plan.fields, depth: 0, parents: rowBudget }];
  while (pending.length) {
    const { fields, depth, parents } = pending.pop()!;
    if (depth > 2 || fields.length > 50) return false;
    for (const field of fields) {
      if (!field || typeof field !== "object" || ++nodes > 100) return false;
      if (field.kind !== "embed") continue;
      const embed = field.embed;
      if (!embed || !Array.isArray(embed.fields) || !Array.isArray(embed.filters) || !Array.isArray(embed.orGroups) || !Array.isArray(embed.orders)) return false;
      if (embed.filters.length > 50 || embed.orGroups.length > 20 || embed.orders.length > 20 || embed.orGroups.some((group) => !Array.isArray(group) || group.length > 50)) return false;
      if (embed.limit == null) embed.limit = DEFAULT_EMBED_ROWS;
      if (!Number.isInteger(embed.limit) || embed.limit < 0 || embed.limit > MAX_EMBED_ROWS) return false;
      const rows = parents * embed.limit;
      rowBudget += rows;
      if (rowBudget > 100_000) return false;
      pending.push({ fields: embed.fields, depth: depth + 1, parents: rows });
    }
  }
  if (plan.filters.length > 50 || plan.orGroups.length > 20 || plan.orders.length > 20 || plan.orGroups.some((group) => !Array.isArray(group) || group.length > 50)) return false;
  return true;
}

function failure(message: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ data: null, error: { message, status }, count: null }, { status, headers });
}

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return failure("untrusted origin", 403);
  }
  const globalQuota = rateLimit("db-query:all", { limit: 1200, windowMs: 60_000 });
  if (!globalQuota.ok) return failure("rate_limited", 429, { "retry-after": String(globalQuota.retryAfterSec) });
  const quota = rateLimit(`db-query:${getClientIp(request)}`, { limit: 180, windowMs: 60_000 });
  if (!quota.ok) return failure("rate_limited", 429, { "retry-after": String(quota.retryAfterSec) });
  let body: { plan?: QueryPlan } | null;
  try {
    body = await readBoundedJson(request, MAX_BODY_BYTES) as { plan?: QueryPlan } | null;
  } catch (error) {
    return error instanceof RequestBodyTooLargeError ? failure("request too large", 413) : failure("invalid plan", 400);
  }
  const plan = body?.plan;
  if (!plan || typeof plan !== "object" || !OPS.has(plan.op) || !boundPlan(plan)) {
    return failure("invalid plan", 400);
  }
  if (activeQueries >= MAX_ACTIVE_QUERIES) return failure("database busy", 503, { "retry-after": "1" });
  activeQueries += 1;
  try {
    let identity: DbIdentity = { userId: null, role: "anon", anonymous: false };
    try {
      await ensureAuthSchema();
      const session = await getAuth().api.getSession({ headers: request.headers });
      if (session?.user) identity = { userId: session.user.id, role: "authenticated", anonymous: false };
    } catch {
      return failure("database unavailable", 503);
    }
    const result = await executePlan(plan, identity, request.signal);
    if (result.error) {
      // Preserve documented application errors used by the UI, but never return raw
      // database details, hints, or arbitrary database error messages to clients.
      const safeMessages = new Set(["login_required", "premium_save_limit"]);
      const message = safeMessages.has(result.error.message) ? result.error.message : "query failed";
      const status = result.error.status && result.error.status >= 400 ? result.error.status : 400;
      return NextResponse.json({ data: null, error: { message, code: result.error.code, status }, count: null }, { status });
    }
    if (plan.op === "rpc" && plan.fn === "record_instagram_post_video_verification") {
      try {
        // Verification and revocation affect every catalog view, including
        // localized detail pages and cached layout output. Retrying the same
        // RPC is idempotent and retries invalidation if this step fails.
        revalidateTag(PUBLIC_CATALOG_CACHE_TAG, { expire: 0 });
        revalidatePath("/", "layout");
      } catch {
        return failure("verification_saved_cache_invalidation_pending", 503, { "retry-after": "1" });
      }
    }
    return NextResponse.json(result);
  } finally {
    activeQueries -= 1;
  }
}
