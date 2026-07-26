export type SourceLink = { source_url?: string | null; platform?: string | null };

/**
 * 근거 목록에 실을 수 있는 출처 — URL만 있는 링크와 달리 "무엇을 근거로 삼았는지"를
 * 독자가 확인할 수 있는 서지 정보(제목)를 가진 항목이다.
 */
export type CitableSourceInput = {
  source_url?: string | null;
  platform?: string | null;
  title?: string | null;
  creator_name?: string | null;
  captured_at?: string | null;
};

export type CitableSource = {
  url: string;
  title: string;
  /** 발행처 — 작성자명이 있으면 우선, 없으면 플랫폼명 */
  publisher: string | null;
  /** 밈캐치가 이 출처를 확인한 시점(발행일이 아니다 — 원문 발행일은 수집하지 않는다) */
  capturedAt: string | null;
  /** 원본·보도가 아니라 맥락 확인용 위키인가 */
  isContext: boolean;
};

function cleanText(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * 근거로 제시할 수 있는 출처만 추린다. 제목이 없는 항목은 "링크 하나"일 뿐 근거
 * 목록이 되지 못하므로 제외한다(제목을 URL에서 지어내지 않는다). 같은 URL은 한 번만.
 * 목록이 비면 호출부가 근거 섹션 자체를 렌더하지 않는다.
 */
export function citableSources(sources: CitableSourceInput[]): CitableSource[] {
  const seen = new Set<string>();
  const out: CitableSource[] = [];
  for (const source of sources) {
    const url = cleanText(source.source_url);
    const title = cleanText(source.title);
    if (!url || !title) continue;
    const key = url.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url,
      title,
      publisher: cleanText(source.creator_name) || cleanText(source.platform) || null,
      capturedAt: cleanText(source.captured_at) || null,
      isContext: isContextSourceUrl(url),
    });
  }
  return out;
}

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
