import { isIndexableMeme, type ContentDepthInput } from "@/lib/content-depth";

/**
 * Shared public eligibility for Korean meme documents and listings.
 *
 * This deliberately matches the pre-existing main-branch index gate:
 * `isIndexableMeme` requires at least 150 characters of unique prose and a
 * content-depth score of at least 5. Listings, sitemap inclusion, and Korean
 * detail robots must not add a stricter independent body-length threshold.
 */
/** Home rails, related memes, rankings, and other card rails stay hidden below this. */
export const MIN_PUBLIC_LISTING_CARDS = 3;

/** Prose columns a listing query must select alongside depth relations. */
export const THIN_MEME_BODY_COLUMNS =
  "description, origin, usage_note, caution, usage_examples" as const;

const LISTING_SCAN_CAP = 400;

export function isThinMeme(meme: ContentDepthInput | null | undefined): boolean {
  return !isIndexableMeme(meme);
}

export function omitThinMemes<T>(memes: readonly T[]): T[] {
  return memes.filter((meme) => !isThinMeme(meme as ContentDepthInput));
}

export function hasPublicListing(count: number): boolean {
  return count >= MIN_PUBLIC_LISTING_CARDS;
}

/** How many rows to read before a limit so thin documents do not occupy the slots. */
export function indexableScanLimit(limit: number): number {
  return Math.min(LISTING_SCAN_CAP, Math.max(limit * 20, limit));
}

export function takeIndexableMemes<T>(memes: readonly T[], limit: number): T[] {
  return omitThinMemes(memes).slice(0, limit);
}

/**
 * Robots for a Korean detail document. Thin pages stay followable and return 200,
 * but they are not indexable. Passing pages omit the override.
 */
export function koreanDetailRobots(
  meme: ContentDepthInput | null | undefined,
): { index: false; follow: true } | undefined {
  return isThinMeme(meme) ? { index: false, follow: true } : undefined;
}

/**
 * Walk a keyset/range listing until `want` non-thin rows are collected or the
 * catalog runs out. `scanned` is the raw row count consumed, so the next page
 * starts after both kept and skipped rows.
 */
export async function collectIndexableWindow<T>(
  fetchRange: (from: number, to: number) => Promise<readonly T[]>,
  start: number,
  want: number,
  options?: { pageSize?: number; scanCap?: number },
): Promise<{ items: T[]; scanned: number; hasMore: boolean }> {
  const pageSize = options?.pageSize ?? Math.max(want, 50);
  const scanCap = options?.scanCap ?? LISTING_SCAN_CAP;
  const items: T[] = [];
  let scanned = 0;
  let hasMore = false;

  while (items.length < want && scanned < scanCap) {
    const batch = await fetchRange(start + scanned, start + scanned + pageSize - 1);
    if (batch.length === 0) {
      hasMore = false;
      break;
    }
    let consumed = 0;
    for (const row of batch) {
      consumed += 1;
      if (!isThinMeme(row as ContentDepthInput)) items.push(row);
      if (items.length === want) break;
    }
    scanned += consumed;
    const batchContinues = batch.length === pageSize;
    hasMore = consumed < batch.length || batchContinues;
    if (items.length === want) break;
    if (!batchContinues) {
      hasMore = false;
      break;
    }
  }

  return { items: items.slice(0, want), scanned, hasMore };
}
