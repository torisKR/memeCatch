const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const TIKTOK_ID = /^\d{10,25}$/;
const INSTAGRAM_SHORTCODE = /^[A-Za-z0-9_-]{5,80}$/;

function socialHost(url, domain) {
  return url.hostname === domain || url.hostname.endsWith(`.${domain}`);
}

/**
 * Extract the canonical platform data we can safely store as an embeddable
 * `meme_contents` row. Short-link redirects deliberately return null: the
 * import must contain the final public post URL that was actually reviewed.
 */
export function parseNativeSocialContent(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") return null;

  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  url.hash = "";

  const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be" || socialHost(url, "youtube.com")) {
    const videoId =
      hostname === "youtu.be"
        ? url.pathname.split("/").filter(Boolean)[0]
        : url.pathname.match(/^\/(?:shorts|embed)\/([^/?]+)/)?.[1] ??
          url.searchParams.get("v");
    if (!videoId || !YOUTUBE_ID.test(videoId)) return null;
    return {
      platform: "YouTube",
      contentId: videoId,
      url: url.toString(),
      isShort: url.pathname.startsWith("/shorts/"),
      thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    };
  }

  if (socialHost(url, "tiktok.com")) {
    const contentId = url.pathname.match(/\/video\/(\d+)/)?.[1];
    if (!contentId || !TIKTOK_ID.test(contentId)) return null;
    return {
      platform: "TikTok",
      contentId,
      url: url.toString(),
      isShort: false,
      thumbnailUrl: null,
    };
  }

  if (socialHost(url, "instagram.com")) {
    const match = url.pathname.match(/^\/(?:p|reel|tv)\/([A-Za-z0-9_-]+)\/?$/);
    if (!match || !INSTAGRAM_SHORTCODE.test(match[1])) return null;
    return {
      platform: "Instagram",
      contentId: match[1],
      url: url.toString(),
      isShort: false,
      thumbnailUrl: null,
    };
  }

  return null;
}

export function nativeSocialValidationMessage(rawUrl) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return "source_url이 필요합니다.";
  }
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return "HTTPS 공개 원본 URL만 허용합니다.";
    if (socialHost(url, "tiktok.com") && !/\/video\/\d+/.test(url.pathname)) {
      return "TikTok은 /video/{숫자 ID} 형식의 최종 공개 URL이 필요합니다.";
    }
    if (socialHost(url, "instagram.com") && !/^\/(?:p|reel|tv)\//.test(url.pathname)) {
      return "Instagram은 /p/, /reel/, /tv/ 공개 게시물 URL이 필요합니다.";
    }
    if ((socialHost(url, "youtube.com") || url.hostname === "youtu.be") && !parseNativeSocialContent(rawUrl)) {
      return "YouTube 영상 또는 Shorts의 최종 공개 URL이 필요합니다.";
    }
  } catch {
    return "올바른 HTTPS URL이 아닙니다.";
  }
  return "YouTube, TikTok 또는 Instagram의 검증된 공개 원본 URL이 필요합니다.";
}
