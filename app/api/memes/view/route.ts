import { createHmac } from "node:crypto";
import { growthSessionIdFromRequest } from "@/lib/growth/events.server";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { SITE_URL } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128;
const VIEW_RATE_LIMIT = { limit: 120, windowMs: 60_000 };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([new URL(request.url).origin, new URL(SITE_URL).origin]);
  if (origin && !allowedOrigins.has(origin)) {
    return Response.json({ ok: false, error: "origin_not_allowed" }, { status: 403 });
  }

  const viewerAddress = getClientIp(request);
  const limit = rateLimit(`meme-view:${viewerAddress}`, VIEW_RATE_LIMIT);
  if (!limit.ok) {
    return Response.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSec) } },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  let memeId: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) {
      return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }
    const payload: unknown = JSON.parse(raw);
    memeId = payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>).memeId
      : null;
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (typeof memeId !== "string" || !UUID_RE.test(memeId)) {
    return Response.json({ ok: false, error: "invalid_meme" }, { status: 400 });
  }

  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date());
  const signingSecret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!signingSecret) {
    return Response.json({ ok: false, error: "view_unavailable" }, { status: 503 });
  }
  const growthSessionId = growthSessionIdFromRequest(request);
  const viewerIdentity = growthSessionId
    ? `session:${growthSessionId}`
    : `network:${viewerAddress}`;
  const viewerKey = createHmac("sha256", signingSecret)
    .update(`${day}\0${viewerIdentity}`)
    .digest("hex");

  const { error } = await createAdminClient().rpc("increment_view", {
    p_meme_id: memeId,
    p_session_hash: viewerKey,
  });
  if (error) {
    return Response.json({ ok: false, error: "view_unavailable" }, { status: 503 });
  }
  return Response.json({ ok: true }, { status: 202 });
}
