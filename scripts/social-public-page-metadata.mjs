const META_TAG = /<meta\s+[^>]*>/gi;
const ATTRIBUTE = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function cleanText(value, limit) {
  const text = decodeHtml(value).replace(/\s+/g, " ").trim();
  return text ? text.slice(0, limit) : null;
}

function attributes(tag) {
  const values = new Map();
  for (const match of tag.matchAll(ATTRIBUTE)) {
    values.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? "");
  }
  return values;
}

function metaValues(html) {
  const values = new Map();
  for (const tag of html.match(META_TAG) ?? []) {
    const attrs = attributes(tag);
    const key = (attrs.get("property") ?? attrs.get("name") ?? "").toLowerCase();
    const content = attrs.get("content");
    if (key && content && !values.has(key)) values.set(key, content);
  }
  return values;
}

function jsonLdValues(html) {
  const candidates = [];
  const scripts = html.matchAll(/<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(match[1]));
      candidates.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      // Invalid JSON-LD should not invalidate otherwise useful public metadata.
    }
  }
  return candidates.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    return Array.isArray(entry["@graph"]) ? [entry, ...entry["@graph"]] : [entry];
  });
}

function firstJsonLdValue(entries, key) {
  for (const entry of entries) {
    const value = entry?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function jsonLdAuthor(entries) {
  for (const entry of entries) {
    const author = entry?.author ?? entry?.creator;
    if (typeof author === "string" && author.trim()) return author;
    if (author && typeof author === "object" && typeof author.name === "string") return author.name;
    if (Array.isArray(author)) {
      const named = author.find((item) => item && typeof item === "object" && typeof item.name === "string");
      if (named) return named.name;
    }
  }
  return null;
}

function safeHttpsUrl(value) {
  try {
    const url = new URL(decodeHtml(value));
    return url.protocol === "https:" ? url.toString().slice(0, 2_000) : null;
  } catch {
    return null;
  }
}

function textFromHtml(fragment, limit) {
  return cleanText(
    String(fragment ?? "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
    limit,
  );
}

export function publicSocialMetadataFromHtml(html) {
  const meta = metaValues(html);
  const jsonLd = jsonLdValues(html);
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];

  return {
    title: cleanText(
      meta.get("og:title") ?? meta.get("twitter:title") ?? firstJsonLdValue(jsonLd, "name") ?? titleTag,
      500,
    ),
    description: cleanText(
      meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description") ?? firstJsonLdValue(jsonLd, "description"),
      1_000,
    ),
    author_name: cleanText(meta.get("author") ?? jsonLdAuthor(jsonLd), 200),
    thumbnail_url: safeHttpsUrl(meta.get("og:image") ?? meta.get("twitter:image") ?? firstJsonLdValue(jsonLd, "thumbnailUrl")),
  };
}

export function instagramEmbedMetadataFromHtml(html) {
  const captionHtml = html.match(/<div\s+class=["']Caption["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  const author = textFromHtml(
    html.match(/<a\s+class=["']CaptionUsername["'][^>]*>([\s\S]*?)<\/a>/i)?.[1],
    200,
  );
  const rawCaption = textFromHtml(captionHtml, 1_200);
  const captionWithUiText = rawCaption && author && rawCaption.startsWith(author)
    ? cleanText(rawCaption.slice(author.length), 1_000)
    : cleanText(rawCaption, 1_000);
  const caption = cleanText(
    String(captionWithUiText ?? "").replace(/(?:댓글\s*[\d,.]+개\s*모두\s*보기|view\s+all\s+[\d,.]+\s+comments?)\s*$/i, ""),
    1_000,
  );
  const imageTag = html.match(/<img\s+[^>]*class=["'][^"']*\bEmbeddedMediaImage\b[^"']*["'][^>]*>/i)?.[0];
  const image = imageTag ? attributes(imageTag).get("src") : null;

  return {
    title: cleanText(caption, 500),
    description: caption,
    author_name: author,
    thumbnail_url: safeHttpsUrl(image),
  };
}

export function looksLikeAccessChallenge(html) {
  return /(?:captcha|unusual traffic|verify you are human|security check|login required|log in to continue)/i.test(html);
}
