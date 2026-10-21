import "server-only";

import type { Json } from "@/lib/database.types";
import { memePathFrom } from "@/lib/labels";
import { createStaticClient } from "@/lib/supabase/server";

export type PublicTrendEvidenceLink = {
  url: string;
  label: string;
};

export type PublicMemeTrendSummary = {
  memeId: string;
  href: string;
  title: string;
  summary: string;
  state: "rising" | "revival";
  reason: string;
  evidenceScope: string;
  independentUseCount: number;
  score: number | null;
  confidence: number;
  lastVerifiedAt: string;
  stale: boolean;
  evidenceLinks: PublicTrendEvidenceLink[];
};

type SummaryRow = {
  meme_id: string;
  external_state: string;
  reason: string;
  evidence_scope: string;
  independent_use_count: number;
  external_score: number | null;
  confidence: number;
  evidence_links: Json;
  last_verified_at: string;
  stale_after: string;
};

function evidenceLinks(value: Json): PublicTrendEvidenceLink[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const url = typeof item.url === "string" ? item.url : "";
    const label = typeof item.label === "string" ? item.label : "원문";
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return [];
      return [{ url: parsed.toString(), label: label.trim() || "원문" }];
    } catch {
      return [];
    }
  });
}

function isPublicState(value: string): value is "rising" | "revival" {
  return value === "rising" || value === "revival";
}

async function resolveSummaries(rows: SummaryRow[]): Promise<PublicMemeTrendSummary[]> {
  if (rows.length === 0) return [];
  const supabase = createStaticClient({ cachePublicCatalog: true });
  const { data, error } = await supabase
    .from("memes")
    .select("id, short_id, slug, title, summary, moderation_status")
    .in("id", rows.map((row) => row.meme_id))
    .eq("moderation_status", "approved");
  if (error || !data) return [];
  const memes = new Map(data.map((meme) => [meme.id, meme]));
  const now = Date.now();

  return rows.flatMap((row) => {
    const meme = memes.get(row.meme_id);
    if (!meme || !isPublicState(row.external_state)) return [];
    return [{
      memeId: row.meme_id,
      href: memePathFrom(meme.short_id, meme.slug),
      title: meme.title,
      summary: meme.summary,
      state: row.external_state,
      reason: row.reason,
      evidenceScope: row.evidence_scope,
      independentUseCount: row.independent_use_count,
      score: row.external_score,
      confidence: row.confidence,
      lastVerifiedAt: row.last_verified_at,
      stale: Date.parse(row.stale_after) <= now,
      evidenceLinks: evidenceLinks(row.evidence_links),
    }];
  });
}

export async function getPublicHomeTrendSummaries(limit = 4): Promise<PublicMemeTrendSummary[]> {
  const boundedLimit = Math.min(8, Math.max(0, Math.floor(limit)));
  if (boundedLimit === 0) return [];
  try {
    const supabase = createStaticClient({ cachePublicCatalog: true });
    const { data, error } = await supabase
      .from("public_meme_trend_summaries")
      .select("meme_id, external_state, reason, evidence_scope, independent_use_count, external_score, confidence, evidence_links, last_verified_at, stale_after")
      .order("last_verified_at", { ascending: false })
      .limit(boundedLimit);
    if (error || !data) return [];
    return (await resolveSummaries(data as SummaryRow[])).filter((summary) => !summary.stale);
  } catch {
    return [];
  }
}

export async function getPublicMemeTrendSummary(
  memeId: string,
): Promise<PublicMemeTrendSummary | null> {
  try {
    const supabase = createStaticClient({ cachePublicCatalog: true });
    const { data, error } = await supabase
      .from("public_meme_trend_summaries")
      .select("meme_id, external_state, reason, evidence_scope, independent_use_count, external_score, confidence, evidence_links, last_verified_at, stale_after")
      .eq("meme_id", memeId)
      .maybeSingle();
    if (error || !data) return null;
    return (await resolveSummaries([data as SummaryRow]))[0] ?? null;
  } catch {
    return null;
  }
}
