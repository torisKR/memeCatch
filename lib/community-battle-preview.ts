import { isLocalMarkdownMedia, isVideoUrl } from "@/lib/markdown";
import { normalizeSourceUrl } from "@/lib/sources/url";

const MARKDOWN_IMAGE = /!\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g;
const MARKDOWN_LINK = /!?\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))/g;
const HTTPS_URL = /https:\/\/[^\s<>"']+/g;

function markdownDestinations(body: string, pattern: RegExp): string[] {
  return Array.from(body.matchAll(pattern), (match) => match[1] ?? match[2] ?? "")
    .filter(Boolean);
}

function trimTrailingPunctuation(value: string): string {
  return value.replace(/[\])}>,.!?;:]+$/g, "");
}

/**
 * 커뮤니티 본문에 이미 공개된 안전한 미디어만 작은 순위 미리보기로 사용한다.
 * 로컬 업로드는 서버가 소유한 고정 경로만, YouTube는 정규화된 영상 ID로 만든
 * i.ytimg.com 주소만 반환한다. 이 함수 자체는 어떤 외부 URL도 요청하지 않는다.
 */
export function communityBattleThumbnail(body: string): string | null {
  for (const destination of markdownDestinations(body, MARKDOWN_IMAGE)) {
    const url = trimTrailingPunctuation(destination);
    if (
      url.startsWith("/api/media/meme-uploads/")
      && isLocalMarkdownMedia(url)
      && !isVideoUrl(url)
    ) {
      return url;
    }
  }

  const candidates = [
    ...markdownDestinations(body, MARKDOWN_LINK),
    ...(body.match(HTTPS_URL) ?? []),
  ];
  for (const candidate of candidates) {
    const source = normalizeSourceUrl(trimTrailingPunctuation(candidate));
    if (source?.platform === "youtube" || source?.platform === "youtube_shorts") {
      return `https://i.ytimg.com/vi/${source.externalId}/hqdefault.jpg`;
    }
  }
  return null;
}
