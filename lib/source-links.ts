export type SourceLink = { source_url?: string | null };

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
