import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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
const COOKIE_NAME = "mc_growth_session";
const SIGNING_CONTEXT = "memecatch:growth-session-signing:v1";
const NETWORK_HASH_CONTEXT = "memecatch:growth-network-hash:v1";
const COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

function signingKey(): Buffer | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return secret ? createHmac("sha256", secret).update(SIGNING_CONTEXT).digest() : null;
}

function cookieValue(request: Request): string | null {
  const raw = request.headers.get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`))
    ?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

function signature(sessionId: string, key: Buffer): Buffer {
  return createHmac("sha256", key).update(`v1:${sessionId}`).digest();
}

function verifiedSessionId(value: string | null, key: Buffer): string | null {
  if (!value) return null;
  const [sessionId, encodedMac, extra] = value.split(".");
  if (!sessionId || !encodedMac || extra || !UUID_RE.test(sessionId)) return null;
  const actual = Buffer.from(encodedMac, "base64url");
  const expected = signature(sessionId, key);
  return actual.length === expected.length && timingSafeEqual(actual, expected) ? sessionId : null;
}

export function growthSessionIdFromRequest(request: Request): string | null {
  const key = signingKey();
  return key ? verifiedSessionId(cookieValue(request), key) : null;
}

export function growthNetworkHash(networkIdentity: string): string | null {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  return secret
    ? createHmac("sha256", secret).update(`${NETWORK_HASH_CONTEXT}:${networkIdentity}`).digest("hex")
    : null;
}

export type GrowthSession = {
  sessionId: string;
  setCookie: string | null;
};

export function resolveGrowthSession(request: Request): GrowthSession | null {
  const key = signingKey();
  if (!key) return null;
  const existing = verifiedSessionId(cookieValue(request), key);
  if (existing) return { sessionId: existing, setCookie: null };

  const sessionId = randomUUID();
  const token = `${sessionId}.${signature(sessionId, key).toString("base64url")}`;
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    sessionId,
    setCookie: `${COOKIE_NAME}=${token}; Path=/; Max-Age=${COOKIE_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`,
  };
}

type GrowthRpcError = { code?: string; message?: string };
type GrowthRpcClient = {
  rpc(name: "record_bounded_client_growth_event", args: {
    p_event_name: ClientGrowthEvent["eventName"];
    p_session_id: string;
    p_network_hash: string;
    p_user_id: string | null;
    p_meme_id: string | null;
    p_surface: string | null;
    p_format: string | null;
    p_locale: string | null;
    p_path: string | null;
    p_dedupe_key: string;
    p_metadata: Json;
    p_occurred_at: string;
  }): Promise<{ data: string | null; error: GrowthRpcError | null }>;
};

export function isGrowthRateLimitError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P0429");
}

export async function recordClientGrowthEvent(
  event: ClientGrowthEvent,
  networkHash: string,
): Promise<void> {
  const admin = createAdminClient() as unknown as GrowthRpcClient;
  const { error } = await admin.rpc("record_bounded_client_growth_event", {
    p_event_name: event.eventName,
    p_session_id: event.sessionId,
    p_network_hash: networkHash,
    p_user_id: event.userId,
    p_meme_id: event.memeId,
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
