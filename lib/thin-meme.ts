import {
  contentDepth,
  isBoilerplateOrigin,
  type ContentDepthInput,
} from "@/lib/content-depth";
import { parseUsageExamples } from "@/lib/usage-examples";

/**
 * QA content checklist C1 for a Korean meme detail page.
 *
 * A page is thin when either of these is true:
 * - its meaningful body is under {@link THIN_MEME_MIN_BODY_CHARS} characters, or
 * - the detail page renders the stub banner (`DocStatusNote`).
 *
 * The predicate is computed from the current record. There is no stored flag.
 * Once a content update pushes the record over the bar, the next render,
 * sitemap build, and revalidated listing include it again.
 *
 * Body characters (trimmed, UTF-16 code units — one Hangul syllable is one unit,
 * the same counter the rest of the catalog uses):
 *
 * Counted:
 * - `description` — the "무슨 뜻이에요?" explanation
 * - `origin`, except boilerplate Wikimedia import sentences
 *   (`isBoilerplateOrigin`, "공개 Wikimedia 기록을 바탕으로 …")
 * - `usage_note`
 * - `caution`
 * - usage examples `parseUsageExamples` would actually render (at most three):
 *   the situation label, plus each dialogue line when dialogue is shown,
 *   otherwise the single example sentence. Speaker names are labels, not body.
 *
 * Not counted: title, summary, aliases, tags, category and year chips, source
 * URLs, navigation, breadcrumbs, share and save chrome, section headings, and
 * template copy from the stub banner, trust note, safety guide, or lifecycle guide.
 *
 * The stub banner is the aside `DocStatusNote` renders only when
 * `contentDepth(meme).isThin` (unique prose under 250 characters, or score under 5).
 * Its heading is "아직 정리 중인 문서예요". When no specific gap is named, the
 * body says "이 문서는 아직 내용을 보강하는 중이에요."
 */
export const THIN_MEME_MIN_BODY_CHARS = 400;

/** Home rails, related memes, rankings, and other card rails stay hidden below this. */
export const MIN_PUBLIC_LISTING_CARDS = 3;

/** Columns a listing query must select so `isThinMeme` sees the same body as the detail page. */
export const THIN_MEME_BODY_COLUMNS =
  "description, origin, usage_note, caution, usage_examples" as const;

const LISTING_SCAN_CAP = 400;

function textLength(value: unknown): number {
  return typeof value === "string" ? value.trim().length : 0;
}

/** Meaningful explanation and body length. See the module comment for the exact set. */
export function memeBodyChars(meme: ContentDepthInput | null | undefined): number {
  if (!meme) return 0;
  let total = textLength(meme.description);
  if (!isBoilerplateOrigin(meme.origin)) total += textLength(meme.origin);
  total += textLength(meme.usage_note);
  total += textLength(meme.caution);
  for (const example of parseUsageExamples(meme.usage_examples)) {
    total += example.situation.trim().length;
    if (example.dialogue && example.dialogue.length > 0) {
      for (const line of example.dialogue) total += line.line.trim().length;
    } else {
      total += example.text.trim().length;
    }
  }
  return total;
}

/** True when the Korean detail page renders the "내용 보강 중" stub banner. */
export function showsContentStubBanner(
  meme: ContentDepthInput | null | undefined,
): boolean {
  return contentDepth(meme).isThin;
}

export function isThinMeme(meme: ContentDepthInput | null | undefined): boolean {
  if (!meme) return true;
  return memeBodyChars(meme) < THIN_MEME_MIN_BODY_CHARS || showsContentStubBanner(meme);
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
