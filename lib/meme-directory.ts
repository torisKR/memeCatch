import { CANONICAL_MEME_ALIAS_MAP } from "@/lib/canonical-meme-path";
import type { ContentDepthInput } from "@/lib/content-depth";
import { isThinMeme } from "@/lib/thin-meme";

/**
 * The crawlable "all memes" directory at /memes?page=N.
 *
 * It lists exactly the Korean meme documents the sitemap publishes: not an
 * alias, inside the discovery index, and not thin. Thin (noindex) documents
 * never appear here, so the directory adds no links to them.
 */
export const MEME_DIRECTORY_PATH = "/memes";
export const MEME_DIRECTORY_PAGE_SIZE = 100;

export type MemeDirectoryItem = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  origin_year: number | null;
};

export type MemeDirectoryCandidate = ContentDepthInput & {
  id: string;
  short_id: string;
  slug: string;
};

/** One predicate for the sitemap and the directory. */
export function isDirectoryMeme(
  meme: MemeDirectoryCandidate,
  discoveryIds: ReadonlySet<string>,
): boolean {
  if (CANONICAL_MEME_ALIAS_MAP[meme.short_id]) return false;
  if (!discoveryIds.has(meme.id)) return false;
  return !isThinMeme(meme);
}

const collator = new Intl.Collator("ko", { sensitivity: "base", numeric: true });

/** 가나다순. Page contents stay put when a meme is added elsewhere in the alphabet. */
export function sortDirectory(items: readonly MemeDirectoryItem[]): MemeDirectoryItem[] {
  return [...items].sort(
    (a, b) => collator.compare(a.title.trim(), b.title.trim()) || a.short_id.localeCompare(b.short_id),
  );
}

export function directoryPageCount(total: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / MEME_DIRECTORY_PAGE_SIZE));
}

/** `/memes` for page 1, `/memes?page=N` after it. Used for links and canonicals. */
export function directoryPagePath(page: number): string {
  return page <= 1 ? MEME_DIRECTORY_PATH : `${MEME_DIRECTORY_PATH}?page=${page}`;
}

/**
 * Parse `?page=`. Null for anything that is not a plain positive integer
 * (`0`, `-1`, `2.5`, `02`, `abc`, repeated params). `?page=1` is valid but not
 * canonical; the page redirects it to `/memes`.
 */
export function parseDirectoryPage(raw: string | string[] | undefined): number | null {
  if (raw === undefined) return 1;
  if (Array.isArray(raw)) return null;
  if (!/^[1-9]\d{0,5}$/.test(raw)) return null;
  return Number(raw);
}

export function directoryPage<T>(
  items: readonly T[],
  page: number,
): { items: T[]; page: number; pageCount: number } | null {
  const pageCount = directoryPageCount(items.length);
  if (page < 1 || page > pageCount) return null;
  const start = (page - 1) * MEME_DIRECTORY_PAGE_SIZE;
  return { items: items.slice(start, start + MEME_DIRECTORY_PAGE_SIZE), page, pageCount };
}

/**
 * Same-category and same-year neighbours for a detail page, drawn from the
 * directory so every link points at an indexable document.
 */
export function directoryNeighbours(
  items: readonly MemeDirectoryItem[],
  meme: { id: string; category: string; origin_year: number | null },
  options: { exclude?: ReadonlySet<string>; limit?: number } = {},
): { sameCategory: MemeDirectoryItem[]; sameYear: MemeDirectoryItem[] } {
  const limit = options.limit ?? 8;
  const taken = new Set(options.exclude ?? []);
  taken.add(meme.id);
  // Rotate the start by the meme id so neighbouring pages do not all link the
  // same first entries of the alphabet.
  const rotate = (list: MemeDirectoryItem[]) => {
    if (list.length === 0) return list;
    let hash = 0;
    for (const ch of meme.id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    const start = hash % list.length;
    return [...list.slice(start), ...list.slice(0, start)];
  };
  const pick = (predicate: (item: MemeDirectoryItem) => boolean) => {
    const picked: MemeDirectoryItem[] = [];
    for (const item of rotate(items.filter(predicate))) {
      if (picked.length >= limit) break;
      if (taken.has(item.id)) continue;
      taken.add(item.id);
      picked.push(item);
    }
    return picked;
  };
  const sameCategory = pick((item) => item.category === meme.category);
  const sameYear = meme.origin_year == null
    ? []
    : pick((item) => item.origin_year === meme.origin_year);
  return { sameCategory, sameYear };
}
