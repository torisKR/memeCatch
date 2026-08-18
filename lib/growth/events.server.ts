import "server-only";

import type { Json } from "@/lib/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type ClientGrowthEvent = {
  eventName:
    | "meme_view"
    | "follow_click"
    | "copy"
    | "paywall_view"
    | "share_click"
    | "quiz_start"
    | "quiz_complete"
    | "traffic_source"
    | "plus_weekly_brief_opened"
    | "plus_weekly_brief_clicked";
  sessionId: string;
  userId: string | null;
  memeId: string | null;
  surface: string | null;
  format: string | null;
  locale: string | null;
  path: string | null;
  dedupeKey: string;
  metadata: Record<string, string | number>;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function growthSessionIdFromRequest(request: Request): string | null {
  const raw = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("mc_growth_session="))
    ?.slice("mc_growth_session=".length);
  if (!raw) return null;
  try {
    const value = decodeURIComponent(raw);
    return UUID_RE.test(value) ? value : null;
  } catch {
    return null;
  }
}

export async function recordClientGrowthEvent(event: ClientGrowthEvent): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("record_growth_event", {
    p_event_name: event.eventName,
    p_source: "client",
    p_session_id: event.sessionId,
    p_user_id: event.userId,
    p_meme_id: event.memeId,
    p_order_id: null,
    p_surface: event.surface,
    p_format: event.format,
    p_locale: event.locale,
    p_path: event.path,
    p_dedupe_key: event.dedupeKey,
    p_metadata: event.metadata as Json,
    p_occurred_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function captureGrowthFunnelBaseline(): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.rpc("capture_growth_funnel_baseline");
  if (error) throw error;
}
