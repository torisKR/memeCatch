const TIKTOK_VIDEO_URL = /https:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9._-]+)\/video\/(\d{10,25})/g;
const ARCHIVE_YEAR = /(?:TikTok|틱톡)[^<>]{0,100}\b(20(?:0\d|1\d|2[0-6]))\b/i;

export function tiktokVideoUrlsFromNewsroomHtml(html) {
  const normalized = String(html ?? "")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&");
  const urls = [];
  const seen = new Set();
  for (const match of normalized.matchAll(TIKTOK_VIDEO_URL)) {
    const url = `https://www.tiktok.com/@${match[1]}/video/${match[2]}`;
    if (seen.has(url)) continue;
    seen.add(url);
    urls.push(url);
  }
  return urls;
}

export function officialTikTokNewsroomUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.hostname !== "newsroom.tiktok.com" || url.username || url.password) {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function originYearFromNewsroomHtml(html) {
  const match = String(html ?? "").match(ARCHIVE_YEAR);
  return match ? Number(match[1]) : null;
}

function cleanText(value, limit) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

async function tiktokOEmbed(sourceUrl, fetchImpl) {
  const endpoint = new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url", sourceUrl);
  const response = await fetchImpl(endpoint, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)" },
    signal: AbortSignal.timeout(8_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.provider_name !== "TikTok" || typeof data.html !== "string") {
    throw new Error(`TikTok oEmbed HTTP ${response.status}`);
  }
  return {
    title: cleanText(data.title, 500),
    author_name: cleanText(data.author_name, 200),
  };
}

export async function collectTikTokNewsroomCandidates(articleUrl, { fetchImpl = fetch, max = 100 } = {}) {
  const canonicalArticleUrl = officialTikTokNewsroomUrl(articleUrl);
  if (!canonicalArticleUrl) throw new Error("an official TikTok Newsroom URL is required");

  const response = await fetchImpl(canonicalArticleUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
      "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)",
    },
    signal: AbortSignal.timeout(10_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
    throw new Error(`TikTok Newsroom HTTP ${response.status}`);
  }
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > 2_000_000) throw new Error("TikTok Newsroom page exceeded metadata size limit");
  const originYear = originYearFromNewsroomHtml(html);
  if (!originYear) throw new Error("TikTok Newsroom archive year was not found");

  const safeMax = Number.isFinite(max) ? Math.max(1, Math.min(100, Math.floor(max))) : 100;
  const sourceUrls = tiktokVideoUrlsFromNewsroomHtml(html).slice(0, safeMax);
  const candidates = [];
  const errors = [];
  for (const sourceUrl of sourceUrls) {
    try {
      const oembed = await tiktokOEmbed(sourceUrl, fetchImpl);
      const contentId = sourceUrl.match(/\/video\/(\d+)/)?.[1] ?? null;
      candidates.push({
        meme_title: oembed.title ?? `TikTok ${originYear} viral video ${contentId}`,
        origin_year: originYear,
        aliases: [],
        source_platform: "TikTok",
        source_url: sourceUrl,
        content_id: contentId,
        oembed_title: oembed.title,
        oembed_author_name: oembed.author_name,
        oembed_verified_at: new Date().toISOString(),
        editorial_source_url: canonicalArticleUrl,
        editorial_signal: "official_tiktok_newsroom",
        catalog_match_status: "unmapped",
        review_status: "needs_human_source_match",
        collection_note: "Official TikTok Newsroom editorial selection with public oEmbed verification; review title mapping, originality, and rights before publication.",
      });
    } catch (error) {
      errors.push({ source_url: sourceUrl, message: error instanceof Error ? error.message : String(error) });
    }
  }
  return { candidates, errors, discovered: sourceUrls.length };
}
