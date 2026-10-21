export const EXPLORE_PAGE_SIZE = 24;
export const EXPLORE_SEARCH_LIMIT = 50;

type RawParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseExplorePage(value: string | string[] | undefined): number {
  const raw = first(value)?.trim();
  if (!raw || !/^\d+$/.test(raw)) return 1;
  const page = Number(raw);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function isCanonicalExplorePageParam(
  value: string | string[] | undefined,
): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 1 && isCanonicalExplorePageParam(value[0]);
  const page = parseExplorePage(value);
  return page > 1 && value === String(page);
}

export function clampExplorePage(
  page: number,
  total: number,
  pageSize = EXPLORE_PAGE_SIZE,
): number {
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  return Math.min(Math.max(1, page), pageCount);
}

export function explorePageOffset(
  page: number,
  pageSize = EXPLORE_PAGE_SIZE,
): number {
  return (Math.max(1, page) - 1) * pageSize;
}

export function hasExploreFacet(params: RawParams): boolean {
  return Object.entries(params).some(([key, value]) => {
    if (key === "page") return false;
    return Array.isArray(value) ? value.some(Boolean) : Boolean(value);
  });
}

export function buildExplorePageHref(
  pathname: string,
  params: RawParams,
  page: number,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (key === "page" || value == null) continue;
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item) query.append(key, item);
    }
  }
  if (page > 1) query.set("page", String(page));
  const suffix = query.toString();
  return suffix ? `${pathname}?${suffix}` : pathname;
}

export function exploreCanonicalPath(pathname: string, page: number): string {
  return page > 1 ? `${pathname}?page=${page}` : pathname;
}
