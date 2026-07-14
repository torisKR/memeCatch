export type SourceLink = { source_url?: string | null; platform?: string | null };

/** 위키는 원본 복제물이 아니라 맥락 확인용 보조 출처로만 다룬다. */
export function isContextSourceUrl(rawUrl?: string | null) {
  try {
    const host = new URL(rawUrl ?? "").hostname.toLowerCase();
    return host === "namu.wiki" || host.endsWith(".wikipedia.org");
  } catch {
    return false;
  }
}

/** 원본·공식·보도 링크를 먼저 보여 주고, 없을 때만 맥락 출처를 폴백한다. */
export function preferredSourceUrl(sources: SourceLink[]) {
  const urls = sources
    .map((source) => source.source_url)
    .filter((url): url is string => Boolean(url));
  return urls.find((url) => !isContextSourceUrl(url)) ?? urls[0] ?? null;
}

/**
 * `meme_contents`에는 실제 재생에 쓰는 공개 URL이 저장돼 있다. 출처 테이블이
 * 위키 맥락 링크만 가진 경우에도 이를 함께 제시해야 "출처에서 원본 보기"가
 * 실제 콘텐츠로 이어진다. 같은 URL은 한 번만 남긴다.
 */
export function sourceLinksWithContent(
  sources: SourceLink[],
  contents: Array<{ url?: string | null; platform?: string | null }>
) {
  const seen = new Set<string>();
  return [...contents.map((content) => ({ source_url: content.url, platform: content.platform })), ...sources]
    .filter((source) => {
      const url = source.source_url;
      if (!url || seen.has(url)) return false;
      seen.add(url);
      return true;
    });
}
