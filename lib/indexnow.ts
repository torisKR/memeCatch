/**
 * IndexNow protocol helpers shared by the app (lib/indexnow.server.ts) and the
 * one-off sitemap submitter (scripts/indexnow-submit-sitemap.mjs).
 *
 * Keep this file free of `@/` imports and runtime-only TypeScript syntax: the
 * script imports it directly through Node's type stripping.
 *
 * The key is public by design. Engines fetch https://catchmeme.com/{key}.txt
 * (public/{key}.txt) and compare it with the submitted key, so it is not a secret.
 */
export const INDEXNOW_KEY = "ead23314e11dd6f3fcad6b6566a1b881";
export const INDEXNOW_HOST = "catchmeme.com";
export const INDEXNOW_ORIGIN = `https://${INDEXNOW_HOST}`;
export const INDEXNOW_KEY_LOCATION = `${INDEXNOW_ORIGIN}/${INDEXNOW_KEY}.txt`;
/** Shared endpoint: one submission reaches Bing, Yandex, Naver, Seznam and the others. */
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";
/** Protocol limit per POST. */
export const INDEXNOW_MAX_URLS = 10_000;

export type IndexNowPayload = {
  host: string;
  key: string;
  keyLocation: string;
  urlList: string[];
};

/**
 * Keep only absolute https URLs on the apex host. www, other hosts, preview
 * origins and malformed strings are dropped; duplicates collapse.
 */
export function indexNowUrls(urls: Iterable<string | null | undefined>): string[] {
  const kept = new Set<string>();
  for (const raw of urls) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      continue;
    }
    if (url.protocol !== "https:" || url.hostname !== INDEXNOW_HOST) continue;
    if (url.port || url.username || url.password) continue;
    url.hash = "";
    kept.add(url.toString());
  }
  return [...kept];
}

/** Split filtered URLs into protocol-sized payloads. */
export function indexNowPayloads(
  urls: Iterable<string | null | undefined>,
  maxUrls: number = INDEXNOW_MAX_URLS,
): IndexNowPayload[] {
  const size = Math.max(1, Math.min(INDEXNOW_MAX_URLS, Math.floor(maxUrls)));
  const list = indexNowUrls(urls);
  const payloads: IndexNowPayload[] = [];
  for (let i = 0; i < list.length; i += size) {
    payloads.push({
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: INDEXNOW_KEY_LOCATION,
      urlList: list.slice(i, i + size),
    });
  }
  return payloads;
}

/** `<loc>` values of a sitemap (urlset). XML entities in URLs are decoded. */
export function sitemapLocs(xml: string): string[] {
  const locs: string[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    locs.push(
      match[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&"),
    );
  }
  return locs;
}

export type IndexNowBatchResult = { urls: number; status: number | null; ok: boolean };

/**
 * POST each payload. 200 and 202 are success (202: key validation pending).
 * Never throws: a network error becomes `status: null`.
 */
export async function postIndexNowPayloads(
  payloads: readonly IndexNowPayload[],
  options: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<IndexNowBatchResult[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const results: IndexNowBatchResult[] = [];
  for (const payload of payloads) {
    try {
      const response = await fetchImpl(INDEXNOW_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
      });
      results.push({
        urls: payload.urlList.length,
        status: response.status,
        ok: response.status === 200 || response.status === 202,
      });
    } catch {
      results.push({ urls: payload.urlList.length, status: null, ok: false });
    }
  }
  return results;
}
