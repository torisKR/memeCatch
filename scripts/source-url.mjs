/**
 * 외부 출처 URL → media_sources 정규 형태 변환 (스크립트용).
 * lib/sources/url.ts와 동일 규칙 — 앱 코드는 TypeScript 버전을 쓴다.
 * 단축 URL은 검수자가 확인한 최종 공개 URL이 아니므로 null.
 */

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_ID = /^\d{10,25}$/;
const INSTAGRAM_SHORTCODE = /^[A-Za-z0-9_-]{5,80}$/;

function isHost(url, domain) {
  const hostname = url.hostname.toLowerCase();
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function normalizeSourceUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.length > 2048) return null;
  let url;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;

  if (isHost(url, "youtube.com") || isHost(url, "youtu.be")) {
    const isShortLink = isHost(url, "youtu.be");
    const videoId = isShortLink
      ? url.pathname.split("/").filter(Boolean)[0]
      : url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1] ??
        url.searchParams.get("v");
    if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
    const isShort = url.pathname.startsWith("/shorts/");
    return {
      platform: isShort ? "youtube_shorts" : "youtube",
      externalId: videoId,
      canonicalUrl: isShort
        ? `https://www.youtube.com/shorts/${videoId}`
        : `https://www.youtube.com/watch?v=${videoId}`,
    };
  }

  if (isHost(url, "tiktok.com")) {
    const videoId = url.pathname.match(/\/video\/(\d+)/)?.[1];
    if (!videoId || !TIKTOK_ID.test(videoId)) return null;
    return {
      platform: "tiktok",
      externalId: videoId,
      canonicalUrl: `https://www.tiktok.com${url.pathname.replace(/\/+$/, "")}`,
    };
  }

  if (isHost(url, "instagram.com")) {
    const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/);
    if (!match || !INSTAGRAM_SHORTCODE.test(match[2])) return null;
    return {
      platform: "instagram",
      externalId: match[2],
      canonicalUrl: `https://www.instagram.com/${match[1]}/${match[2]}/`,
    };
  }

  return null;
}

/** meme_contents/meme_sources 표기 라벨 (기존 행과 동일 문자열) */
export const DISPLAY_PLATFORM = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
};
