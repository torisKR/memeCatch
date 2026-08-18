import { isAuthSessionMissingError } from "@supabase/supabase-js";
import {
  growthSessionIdFromRequest,
  recordClientGrowthEvent,
  type ClientGrowthEvent,
} from "@/lib/growth/events.server";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const CLIENT_EVENTS = new Set<ClientGrowthEvent["eventName"]>([
  "meme_view",
  "follow_click",
  "copy",
  "paywall_view",
  "share_click",
  "quiz_start",
  "quiz_complete",
  "traffic_source",
  "plus_weekly_brief_opened",
  "plus_weekly_brief_clicked",
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bounded(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const allowedOrigins = new Set([new URL(request.url).origin, new URL(SITE_URL).origin]);
  if (origin && !allowedOrigins.has(origin)) {
    return Response.json({ ok: false, error: "origin_not_allowed" }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
  }

  let payload: unknown;
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return Response.json({ ok: false, error: "payload_too_large" }, { status: 413 });
    }
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Response.json({ ok: false, error: "invalid_payload" }, { status: 400 });
  }

  const body = payload as Record<string, unknown>;
  const eventName = body.eventName;
  const sessionId = growthSessionIdFromRequest(request);
  if (
    typeof eventName !== "string" ||
    !CLIENT_EVENTS.has(eventName as ClientGrowthEvent["eventName"]) ||
    !sessionId
  ) {
    return Response.json({ ok: false, error: "invalid_event" }, { status: 400 });
  }

  const params = body.params && typeof body.params === "object" && !Array.isArray(body.params)
    ? body.params as Record<string, unknown>
    : {};
  const memeId = bounded(params.meme_id, 36);
  if (memeId && !UUID_RE.test(memeId)) {
    return Response.json({ ok: false, error: "invalid_meme" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError && !isAuthSessionMissingError(authError)) {
    return Response.json({ ok: false, error: "auth_unavailable" }, { status: 503 });
  }

  const surface = bounded(params.surface, 80);
  const format = bounded(params.format, 80);
  const locale = bounded(params.locale, 12);
  const path = bounded(body.path, 300);
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const briefId = bounded(params.brief_id, 32);
  const position = typeof params.position === "number" && Number.isInteger(params.position)
    ? params.position
    : null;
  const identity = memeId ?? (briefId ? `${briefId}:${position ?? "open"}` : null)
    ?? format ?? surface ?? path ?? "event";
  const dedupeKey = `client:${sessionId}:${eventName}:${identity}:${minuteBucket}`.slice(0, 220);
  const metadataKeys = new Set([
    "result", "state", "channel", "brief_id", "meme_id", "item_count", "position",
    "source", "method", "to", "mode", "score", "medium", "resolved_by",
    "in_app_browser", "first_source", "first_medium", "first_resolved_by",
    "landing_page", "is_returning",
  ]);
  const metadata = Object.fromEntries(Object.entries(params).flatMap(([key, value]) => {
    if (!metadataKeys.has(key)) return [];
    if (typeof value === "string") {
      const normalized = bounded(value, 100);
      return normalized ? [[key, normalized]] : [];
    }
    return typeof value === "number" && Number.isFinite(value) ? [[key, value]] : [];
  }).slice(0, 12)) as Record<string, string | number>;

  await recordClientGrowthEvent({
    eventName: eventName as ClientGrowthEvent["eventName"],
    sessionId,
    userId: user?.id ?? null,
    memeId,
    surface,
    format,
    locale,
    path,
    dedupeKey,
    metadata,
  });

  return Response.json({ ok: true }, { status: 202 });
}
