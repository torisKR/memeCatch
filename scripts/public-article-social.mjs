/**
 * Extract final public TikTok / Instagram post URLs from already-public HTML
 * pages (editorial articles, wiki pages, review notes) and verify each URL
 * through platform oEmbed. No login, cookies, app keys, challenge bypass, or
 * media download.
 */
import { parseNativeSocialContent } from "./social-content.mjs";

// Large wiki/editorial pages (e.g. namu period memes, Wikipedia) routinely
// exceed 2MB; keep a hard cap so we never buffer unbounded HTML.
const MAX_HTML_BYTES = 5_000_000;
const YEAR_PATTERN = /\b(20(?:0\d|1\d|2[0-6]))\b/;

function cleanText(value, limit) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function normalizeHtml(html) {
  return String(html ?? "")
    .replace(/\\\//g, "/")
    .replace(/&amp;/gi, "&")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#47;/g, "/");
}

/**
 * Pull canonical TikTok video and Instagram post/reel/tv URLs from free text
 * or HTML. Short links, profiles, hashtags, and discover pages are ignored.
 */
export function socialPostUrlsFromHtml(html) {
  const normalized = normalizeHtml(html);
  const found = [];
  const seen = new Set();
  const patterns = [
    /https:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+\/video\/\d{10,25}/g,
    /https:\/\/(?:www\.)?instagram\.com\/(?:reel|p|tv)\/[A-Za-z0-9_-]+\/?/g,
  ];
  for (const pattern of patterns) {
    for (const match of normalized.matchAll(pattern)) {
      const parsed = parseNativeSocialContent(match[0]);
      if (!parsed || !["TikTok", "Instagram"].includes(parsed.platform) || seen.has(parsed.url)) {
        continue;
      }
      seen.add(parsed.url);
      found.push(parsed);
    }
  }
  return found;
}

export function officialHttpsArticleUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    // Block direct platform post pages here — use seed oEmbed collectors for those.
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "tiktok.com" || host === "instagram.com" || host === "vm.tiktok.com") {
      return null;
    }
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function originYearFromArticleHtml(html) {
  const text = String(html ?? "");
  const published = text.match(
    /(?:datePublished|dateCreated|article:published_time)["'\s:=]+(?:"|')?(20(?:0\d|1\d|2[0-6]))/i,
  );
  if (published) return Number(published[1]);
  const heading = text.match(/<(?:h1|title)[^>]*>[^<]{0,120}?\b(20(?:0\d|1\d|2[0-6]))\b/i);
  if (heading) return Number(heading[1]);
  const any = text.match(YEAR_PATTERN);
  return any ? Number(any[1]) : null;
}

async function verifyOEmbed(platform, sourceUrl, fetchImpl) {
  if (platform === "TikTok") {
    const endpoint = new URL("https://www.tiktok.com/oembed");
    endpoint.searchParams.set("url", sourceUrl);
    const response = await fetchImpl(endpoint, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)",
      },
      signal: AbortSignal.timeout(8_000),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || data?.provider_name !== "TikTok" || typeof data.html !== "string") {
      throw new Error(`TikTok oEmbed HTTP ${response.status}`);
    }
    return {
      title: cleanText(data.title, 500),
      author_name: cleanText(data.author_name, 200),
      thumbnail_url: cleanText(data.thumbnail_url, 2_000),
    };
  }

  const endpoint = new URL("https://graph.facebook.com/v25.0/instagram_oembed");
  endpoint.searchParams.set("url", sourceUrl);
  endpoint.searchParams.set("omitscript", "true");
  const response = await fetchImpl(endpoint, {
    headers: { "user-agent": "CatchMemeSourceCollector/1.0 (+https://catchmeme.com)" },
    signal: AbortSignal.timeout(8_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || data?.type !== "rich") {
    throw new Error(`Instagram oEmbed HTTP ${response.status}`);
  }
  return {
    title: cleanText(data.title, 500),
    author_name: cleanText(data.author_name, 200),
    thumbnail_url: cleanText(data.thumbnail_url, 2_000),
  };
}

/**
 * Match only against public post metadata (oEmbed title/author). Never use the
 * surrounding article HTML — long wiki pages mention many meme names while
 * citing unrelated embed URLs, which produced false "title_overlap" rows.
 *
 * Needles shorter than 4 compact characters, or pure digits (e.g. "1122"), are
 * ignored so aliases cannot claim every post that happens to share a year code.
 */
export function matchCatalogMeme(snippet, memes) {
  if (!Array.isArray(memes) || memes.length === 0) return null;
  const hay = String(snippet ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s\p{P}\p{S}_]+/gu, "");
  if (!hay) return null;

  let best = null;
  let bestLen = 0;
  for (const meme of memes) {
    for (const needle of meme.needles ?? []) {
      const key = String(needle ?? "")
        .normalize("NFKC")
        .toLocaleLowerCase("ko-KR")
        .replace(/[\s\p{P}\p{S}_]+/gu, "");
      if (key.length < 4 || /^\d+$/.test(key)) continue;
      if (hay.includes(key) && key.length > bestLen) {
        best = meme;
        bestLen = key.length;
      }
    }
  }
  return best;
}

/**
 * Fetch one public article and return oEmbed-verified Instagram/TikTok candidates.
 */
export async function collectPublicArticleSocialCandidates(
  articleUrl,
  { fetchImpl = fetch, max = 100, memes = [], originYear: forcedYear = null } = {},
) {
  const canonicalArticleUrl = officialHttpsArticleUrl(articleUrl);
  if (!canonicalArticleUrl) {
    throw new Error("a public HTTPS editorial/article URL is required (not a TikTok/Instagram post URL)");
  }

  const response = await fetchImpl(canonicalArticleUrl, {
    headers: {
      accept: "text/html,application/xhtml+xml",
      "accept-language": "ko-KR,ko;q=0.9,en;q=0.7",
      "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(12_000),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.toLowerCase().includes("text/html")) {
    throw new Error(`public article HTTP ${response.status}`);
  }
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) {
    throw new Error("public article exceeded HTML size limit");
  }
  if (/\b(?:captcha|unusual traffic|login to continue|sign in to continue)\b/i.test(html)) {
    throw new Error("public article requested a login or challenge; stopping without retrying");
  }

  const originYear = Number.isInteger(forcedYear) ? forcedYear : originYearFromArticleHtml(html);
  const safeMax = Number.isFinite(max) ? Math.max(1, Math.min(100, Math.floor(max))) : 100;
  const posts = socialPostUrlsFromHtml(html).slice(0, safeMax);
  const candidates = [];
  const errors = [];

  for (const post of posts) {
    try {
      const oembed = await verifyOEmbed(post.platform, post.url, fetchImpl);
      // Match only oEmbed metadata — never article HTML (see matchCatalogMeme).
      const snippet = `${oembed.title ?? ""}\n${oembed.author_name ?? ""}`;
      const meme = matchCatalogMeme(snippet, memes);
      candidates.push({
        meme_title: meme?.title ?? oembed.title ?? `${post.platform} article citation ${post.contentId}`,
        origin_year: meme?.year ?? originYear,
        aliases: meme?.aliases ?? [],
        source_platform: post.platform,
        source_url: post.url,
        content_id: post.contentId,
        oembed_title: oembed.title,
        oembed_author_name: oembed.author_name,
        thumbnail_url: oembed.thumbnail_url ?? null,
        oembed_verified_at: new Date().toISOString(),
        editorial_source_url: canonicalArticleUrl,
        editorial_signal: "public_article_citation",
        catalog_match_status: meme ? "title_overlap" : "unmapped",
        review_status: "needs_human_source_match",
        collection_note:
          "Public article citation with oEmbed verification only. Catalog match uses oEmbed title/author only (not article HTML). Confirm meme match, originality, and rights before publishing. Embed HTML is not stored.",
      });
    } catch (error) {
      errors.push({
        source_url: post.url,
        platform: post.platform,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { candidates, errors, discovered: posts.length, article_url: canonicalArticleUrl };
}

export async function verifySocialSeedOEmbed(sourceUrl, { fetchImpl = fetch } = {}) {
  const parsed = parseNativeSocialContent(sourceUrl);
  if (!parsed || !["TikTok", "Instagram"].includes(parsed.platform)) {
    throw new Error("seed must be a final public TikTok video or Instagram post/reel/tv URL");
  }
  const oembed = await verifyOEmbed(parsed.platform, parsed.url, fetchImpl);
  return { ...parsed, oembed };
}
