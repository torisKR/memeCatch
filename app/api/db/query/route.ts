import { NextRequest, NextResponse } from "next/server";
import { hasTrustedOrigin } from "@/lib/origin";
import { ensureAuthSchema, getAuth } from "@/lib/auth/server";
import { executePlan } from "@/lib/db/execute";
import type { QueryPlan } from "@/lib/db/plan";
import type { DbIdentity } from "@/lib/db/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPS = new Set(["select", "insert", "update", "delete", "upsert", "rpc"]);

export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) {
    return NextResponse.json({ data: null, error: { message: "untrusted origin", status: 403 }, count: null }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as { plan?: QueryPlan } | null;
  const plan = body?.plan;
  if (!plan || !OPS.has(plan.op)) {
    return NextResponse.json({ data: null, error: { message: "invalid plan", status: 400 }, count: null }, { status: 400 });
  }
  let identity: DbIdentity = { userId: null, role: "anon", anonymous: false };
  try {
    await ensureAuthSchema();
    const session = await getAuth().api.getSession({ headers: request.headers });
    if (session?.user) identity = { userId: session.user.id, role: "authenticated", anonymous: false };
  } catch {
    return NextResponse.json({ data: null, error: { message: "database unavailable", status: 503 }, count: null }, { status: 503 });
  }
  const result = await executePlan(plan, identity, request.signal);
  return NextResponse.json(result, { status: result.error?.status && result.error.status >= 400 ? result.error.status : 200 });
}
