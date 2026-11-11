import "server-only";
import { createStaticClient } from "@/lib/supabase/server";
import { isPublicMemeArtPath } from "@/lib/meme-poster";
import { SITE_URL } from "@/lib/site";

/**
 * Reads poster art that the offline backfill stored. A missing column (the
 * migration is applied by an operator, not by a request) returns no art so
 * the card draws its fallback.
 */
export async function loadMemeArtUrls(ids: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const art = new Map<string, string>();
  if (unique.length === 0) return art;
  try {
    const { data, error } = await createStaticClient()
      .from("memes")
      .select("id, art_url")
      .in("id", unique);
    if (error || !data) return art;
    for (const row of data) {
      if (row.id && isPublicMemeArtPath(row.art_url)) art.set(row.id, row.art_url);
    }
  } catch {
    return art;
  }
  return art;
}

export async function loadMemeArtByShortId(shortId: string): Promise<string | null> {
  if (!shortId) return null;
  try {
    const { data, error } = await createStaticClient()
      .from("memes")
      .select("art_url")
      .eq("short_id", shortId)
      .maybeSingle();
    if (error || !data) return null;
    return isPublicMemeArtPath(data.art_url) ? data.art_url : null;
  } catch {
    return null;
  }
}

/** Absolute art URL for next/og. A missing file keeps the speech-bubble drawing. */
export async function loadReachableMemeArt(path: string | null): Promise<string | null> {
  if (!isPublicMemeArtPath(path)) return null;
  const absolute = `${SITE_URL}${path}`;
  try {
    const response = await fetch(absolute);
    if (!response.ok) return null;
    return absolute;
  } catch {
    return null;
  }
}
