import "server-only";

import { createStaticClient } from "@/lib/db/server";
import {
  koreanRankingsRenderList,
  resolveKoreanRankings,
  type KoreanRankings,
  type PublicRankingMeme,
} from "@/lib/korean-rankings";
import type { ContentDepthInput } from "@/lib/content-depth";
import {
  hasPublicListing,
  indexableScanLimit,
  omitThinMemes,
  THIN_MEME_BODY_COLUMNS,
} from "@/lib/thin-meme";

const MEME_FIELDS =
  "id,short_id,slug,title,summary,safety_level,lifecycle_status,trend_score,published_at";
const RANKING_SELECT =
  `${MEME_FIELDS}, ${THIN_MEME_BODY_COLUMNS}, meme_sources(source_url, hidden_from_public), meme_contents(availability, moderation_status), meme_tags_map(tag_id)`;

type RankedMeme = PublicRankingMeme & ContentDepthInput;

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

function rankToday(memes: PublicRankingMeme[]): PublicRankingMeme[] {
  return [...memes]
    .sort(
      (a, b) =>
        (a.lifecycle_status === "rising" ? 0 : 1) -
          (b.lifecycle_status === "rising" ? 0 : 1) ||
        (b.trend_score ?? 0) - (a.trend_score ?? 0),
    )
    .slice(0, 20);
}

function trendIsUsable(memes: PublicRankingMeme[]): boolean {
  return memes.length >= 10 && memes.some((meme) => (meme.trend_score ?? 0) > 0);
}

/** Trend-score read. This is the query whose failure must not be reused as the list. */
async function loadTrendMemes(): Promise<PublicRankingMeme[]> {
  const db = createStaticClient();
  const { data, error } = await db
    .from("memes")
    .select(RANKING_SELECT)
    .eq("moderation_status", "approved")
    .order("trend_score", { ascending: false })
    .limit(indexableScanLimit(30));
  if (error) throw error;
  return omitThinMemes((data ?? []) as unknown as RankedMeme[]);
}

async function loadComeback(): Promise<PublicRankingMeme[]> {
  const db = createStaticClient();
  const oldCutoff = new Date(Date.now() - 90 * 86400000).toISOString();
  const { data, error } = await db
    .from("memes")
    .select(RANKING_SELECT)
    .eq("moderation_status", "approved")
    .lt("published_at", oldCutoff)
    .gt("trend_score", 0)
    .order("trend_score", { ascending: false })
    .limit(indexableScanLimit(20));
  if (error) throw error;
  const memes = omitThinMemes((data ?? []) as unknown as RankedMeme[]).slice(0, 20);
  return hasPublicListing(memes.length) ? memes : [];
}

async function loadPublishedMemes(): Promise<PublicRankingMeme[]> {
  const db = createStaticClient();
  const { data, error } = await db
    .from("memes")
    .select(RANKING_SELECT)
    .eq("moderation_status", "approved")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(indexableScanLimit(20));
  if (error) throw error;
  return omitThinMemes((data ?? []) as unknown as RankedMeme[]).slice(0, 20);
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
 *
 * The published fallback is a different statement (published_at, not
 * trend_score). It still uses the same static client and the same memes
 * table, so a client or connection throw fails that read too. It is not a
 * retry of the failed trend result, and there is no offline copy.
 */
export async function loadKoreanRankings(): Promise<KoreanRankings> {
  const now = Date.now();
  if (cached && now - cached.at < NAV_TTL_MS) return cached.result;

  let trend: PublicRankingMeme[] | null = null;
  let trendError = false;
  try {
    trend = await loadTrendMemes();
  } catch (error) {
    trendError = true;
    logRankingsFailure("live query failed", error);
  }

  if (!trendError && trend && trendIsUsable(trend)) {
    // Comeback is a side list. Its failure must not drop the trend rows
    // already in hand, or the page falls through to the recency fallback
    // and can 404 when that read fails too.
    let comeback: PublicRankingMeme[] = [];
    try {
      comeback = await loadComeback();
    } catch (error) {
      logRankingsFailure("comeback query failed", error);
    }
    const result = resolveKoreanRankings({
      liveError: false,
      live: { fallback: null, today: rankToday(trend), comeback },
      published: null,
    });
    cached = { at: now, result };
    return result;
  }

  let published: PublicRankingMeme[] | null = null;
  try {
    published = await loadPublishedMemes();
  } catch (error) {
    published = null;
    logRankingsFailure("published fallback failed", error);
  }

  const lowSample = !trendError && trend !== null && !trendIsUsable(trend);
  const result = lowSample && published && hasPublicListing(published.length)
    ? resolveKoreanRankings({
        liveError: false,
        live: { fallback: published.slice(0, 12), today: [], comeback: [] },
        published: null,
      })
    : resolveKoreanRankings({
        liveError: trendError || published === null,
        live: null,
        published:
          published === null
            ? null
            : hasPublicListing(published.length)
              ? published
              : [],
      });
  if (result.kind !== "outage") cached = { at: now, result };
  return result;
}

/**
 * True when the rankings page will render a list. Sitemap and llms.txt use
 * this so a noindex fallback is not advertised. Navigation links do not.
 */
export async function koreanRankingsVisible(): Promise<boolean> {
  try {
    return koreanRankingsRenderList(await loadKoreanRankings());
  } catch (error) {
    logRankingsFailure("visibility check failed", error);
    return false;
  }
}
