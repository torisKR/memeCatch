/**
 * 외부 출처 URL → media_sources 정규 형태 변환.
 *
 * 원본 파일은 저장하지 않고 플랫폼·외부 ID·정규 URL만 다룬다.
 * 단축 URL(youtu.be 단축 외 vt.tiktok.com, instagr.am 리다이렉트 등)은
 * 최종 공개 URL이 아니므로 null을 반환한다 — 검수자가 확인한 최종 URL만 허용.
 */

export type MediaSourcePlatform =
  | "youtube"
  | "youtube_shorts"
  | "tiktok"
  | "instagram";

export type NormalizedSourceUrl = {
  platform: MediaSourcePlatform;
  externalId: string;
  canonicalUrl: string;
};

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_ID = /^\d{10,25}$/;
const INSTAGRAM_SHORTCODE = /^[A-Za-z0-9_-]{5,80}$/;

function isHost(url: URL, domain: string) {
  const hostname = url.hostname.toLowerCase();
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

function normalizeYoutube(url: URL): NormalizedSourceUrl | null {
  const isShortLink = isHost(url, "youtu.be");
  const videoId = isShortLink
    ? url.pathname.split("/").filter(Boolean)[0]
    : (url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1] ??
      url.searchParams.get("v"));
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

function normalizeTiktok(url: URL): NormalizedSourceUrl | null {
  const videoId = url.pathname.match(/\/video\/(\d+)/)?.[1];
  if (!videoId || !TIKTOK_ID.test(videoId)) return null;
  // 계정·영상 ID가 드러난 최종 공개 URL만 정규 URL로 인정한다.
  return {
    platform: "tiktok",
    externalId: videoId,
    canonicalUrl: `https://www.tiktok.com${url.pathname.replace(/\/+$/, "")}`,
  };
}

function normalizeInstagram(url: URL): NormalizedSourceUrl | null {
  const match = url.pathname.match(/^\/(p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/);
  if (!match || !INSTAGRAM_SHORTCODE.test(match[2])) return null;
  return {
    platform: "instagram",
    externalId: match[2],
    canonicalUrl: `https://www.instagram.com/${match[1]}/${match[2]}/`,
  };
}

/** 지원 플랫폼의 최종 공개 URL을 정규 형태로 변환한다. 미지원·단축 URL은 null. */
export function normalizeSourceUrl(rawUrl: string): NormalizedSourceUrl | null {
  if (!rawUrl || typeof rawUrl !== "string" || rawUrl.length > 2_048) return null;

  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;

  if (isHost(url, "youtube.com") || isHost(url, "youtu.be")) {
    return normalizeYoutube(url);
  }
  if (isHost(url, "tiktok.com")) return normalizeTiktok(url);
  if (isHost(url, "instagram.com")) return normalizeInstagram(url);
  return null;
}

/** media_sources 행 → 공식 임베드 URL. 클릭 전에는 iframe을 만들지 않는다. */
export function embedUrlFor(source: {
  platform: MediaSourcePlatform;
  externalId: string;
  canonicalUrl: string;
}): string {
  switch (source.platform) {
    case "youtube":
    case "youtube_shorts":
      return `https://www.youtube-nocookie.com/embed/${source.externalId}?rel=0`;
    case "tiktok":
      return `https://www.tiktok.com/player/v1/${source.externalId}?description=1&music_info=1`;
    case "instagram": {
      // 게시물(/p/)과 릴스(/reel/)는 임베드 경로가 다르므로 정규 URL의 유형을 유지한다.
      const kind =
        new URL(source.canonicalUrl).pathname.match(/^\/(p|reel|tv)\//)?.[1] ??
        "reel";
      return `https://www.instagram.com/${kind}/${source.externalId}/embed/captioned/`;
    }
  }
}

/** YouTube Data API는 shorts/video를 같은 videos.list로 조회한다. */
export function isYouTubePlatform(
  platform: MediaSourcePlatform,
): platform is "youtube" | "youtube_shorts" {
  return platform === "youtube" || platform === "youtube_shorts";
}
