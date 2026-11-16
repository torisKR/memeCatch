import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/db/server";
import { expireInstagramVideoVerificationCache } from "@/lib/instagram-video-verification-cache";
import { hasTrustedOrigin } from "@/lib/origin";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// This endpoint only expires cache entries. It never repeats the decision.
export async function POST(request: NextRequest) {
  if (!hasTrustedOrigin(request)) return NextResponse.json({ ok: false }, { status: 403 });
  const quota = rateLimit(`instagram-video-cache:${getClientIp(request)}`, { limit: 30, windowMs: 60_000 });
  if (!quota.ok) return NextResponse.json({ ok: false }, { status: 429, headers: { "retry-after": String(quota.retryAfterSec) } });

  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: isOperator, error } = await db.rpc("is_operator");
  if (error || !isOperator) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    expireInstagramVideoVerificationCache();
    return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
  } catch {
    console.error({ event: "instagram_video_verification_cache_invalidation_pending" });
    return NextResponse.json({ ok: false }, { status: 503, headers: { "retry-after": "1" } });
  }
}
