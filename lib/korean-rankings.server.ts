import "server-only";

import { createStaticClient } from "@/lib/supabase/server";
import {
  liveRankingHasRows,
  resolveKoreanRankings,
  type KoreanRankings,
  type PublicRankingMeme,
} from "@/lib/korean-rankings";

const MEME_FIELDS =
  "id,short_id,slug,title,summary,safety_level,lifecycle_status,trend_score,published_at";

const NAV_TTL_MS = 60_000;

let cached: { at: number; result: KoreanRankings } | null = null;

export function clearKoreanRankingsCache(): void {
  cached = null;
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return "";
}

function logRankingsFailure(scope: string, error: unknown): void {
  const message = errorText(error);
  const safe = /postgres(ql)?:\/\//i.test(message) || /password/i.test(message)
    ? "database unavailable"
    : message.slice(0, 180) || "query failed";
  console.error(`[rankings] ${scope}: ${safe}`);
}

async function loadLive(): Promise<Omit<
  Extract<KoreanRankings, { kind: "live" }>,
  "kind" | "weekly" | "weeklyLocked" | "lastRollupDate" | "topWeeklyViews"
>> {
  const supabase = createStaticClient();
  const { data: top, error: topErr } = await supabase
    .from("memes")
    .select(MEME_FIELDS)
    .eq("moderation_status", "approved")
    .order("trend_score", { ascending: false })
    .limit(30);
  if (topErr) throw topErr;

  const memes = (top ?? []) as PublicRankingMeme[];
  const needsFallback =
    memes.length < 10 || memes.every((meme) => (meme.trend_score ?? 0) <= 0);

  if (needsFallback) {
    const { data: fresh, error: freshErr } = await supabase
      .from("memes")
      .select(MEME_FIELDS)
      .eq("moderation_status", "approved")
      .not("published_at", "is", null)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(12);
    if (freshErr) throw freshErr;
    return {
      fallback: (fresh ?? []) as PublicRankingMeme[],
      today: [],
      comeback: [],
    };
  }

  const today = [...memes]
    .sort(
      (a, b) =>
        (a.lifecycle_status === "rising" ? 0 : 1) -
          (b.lifecycle_status === "rising" ? 0 : 1) ||
        (b.trend_score ?? 0) - (a.trend_score ?? 0),
    )
    .slice(0, 20);

  const oldCutoff = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data: comebackRows, error: comebackErr } = await supabase
    .from("memes")
    .select(MEME_FIELDS)
    .eq("moderation_status", "approved")
    .lt("published_at", oldCutoff)
    .gt("trend_score", 0)
    .order("trend_score", { ascending: false })
    .limit(20);
  if (comebackErr) throw comebackErr;

  return {
    fallback: null,
    today,
    comeback: (comebackRows ?? []) as PublicRankingMeme[],
  };
}

async function loadPublishedMemes(): Promise<PublicRankingMeme[]> {
  const supabase = createStaticClient();
  const { data, error } = await supabase
    .from("memes")
    .select(MEME_FIELDS)
    .eq("moderation_status", "approved")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) throw error;
  return (data ?? []) as PublicRankingMeme[];
}

/**
 * Public rankings use the static client only.
 *
 * The old page called getPremiumEntitlement() — which reads headers() — inside
 * the same try/catch as the meme query. On the hourly ISR render that throw
 * was swallowed, and the error panel was stored as HTTP 200. Product tables
 * are not part of this read: it uses published meme rows, not affiliate or
 * shop tables. Weekly view totals stay behind Plus and are not loaded here,
 * so a missing metrics table cannot blank the public page.
 */
export async function loadKoreanRankings(): Promise<KoreanRankings> {
  const now = Date.now();
  if (cached && now - cached.at < NAV_TTL_MS) return cached.result;

  let live: Awaited<ReturnType<typeof loadLive>> | null = null;
  let liveError = false;
  try {
    live = await loadLive();
  } catch (error) {
    liveError = true;
    logRankingsFailure("live query failed", error);
  }

  let published: PublicRankingMeme[] | null = null;
  if (liveError || !liveRankingHasRows(live)) {
    try {
      published = await loadPublishedMemes();
    } catch (error) {
      published = null;
      logRankingsFailure("published fallback failed", error);
    }
  }

  const result = resolveKoreanRankings({ liveError, live, published });
  if (result.kind !== "outage") cached = { at: now, result };
  return result;
}

export async function koreanRankingsVisible(): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) return true;
  try {
    const result = await loadKoreanRankings();
    return result.kind !== "unavailable";
  } catch (error) {
    logRankingsFailure("visibility check failed", error);
    return true;
  }
}
