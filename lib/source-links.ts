export type SourceLink = {
  source_url?: string | null;
  platform?: string | null;
  hidden_from_public?: boolean | null;
};

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
  hidden_from_public?: boolean | null;
};

export type CitableSource = {
  url: string;
  title: string;
  /** 발행처 — 작성자명이 있으면 우선, 없으면 플랫폼명 */
  publisher: string | null;
  /** 저장된 수집 시점. 원문 발행일이나 사실 검증 완료일을 뜻하지 않는다. */
  capturedAt: string | null;
  /** 원본·보도가 아니라 맥락 확인용 위키인가 */
  isContext: boolean;
};

function cleanText(value?: string | null): string {
  return typeof value === "string" ? value.trim() : "";
}


/** Editorial flag: keep the row, but do not render it in public citation lists. */
export function isPublicDisplaySource(source: object): boolean {
  return (source as { hidden_from_public?: boolean | null }).hidden_from_public !== true;
}

/** Public citation and gating counts should ignore hidden rows. */
export function publicDisplaySources<T extends object>(sources: T[] | null | undefined): T[] {
  return Array.isArray(sources) ? sources.filter(isPublicDisplaySource) : [];
}

/** Public citation links only. This validates syntax; it does not fetch or certify a source. */
export function publicSourceUrl(value?: string | null): string | null {
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return null;
    // Sources use public domain names. Literal IPs and local/reserved suffixes are not evidence links.
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('[')) return null;
    if (['localhost', 'local', 'internal', 'invalid', 'test', 'example', 'onion', 'home.arpa'].some(
      (suffix) => host === suffix || host.endsWith(`.${suffix}`),
    )) return null;
    if (!host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
    url.hostname = host;
    return url.href;
  } catch {
    return null;
  }
}

/** Preserve resource/query case; anchors on the same document do not create independent evidence. */
function sourceDocumentKey(url: string): string {
  return url.split('#')[0];
}

/** A stored date is not a reviewed date. Invalid, impossible or future timestamps are omitted. */
export function evidenceTimestamp(value?: string | null, now = Date.now()): string | null {
  const text = cleanText(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d))?$/.exec(text);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day) return null;
  const time = Date.parse(text);
  return Number.isFinite(time) && time <= now ? text : null;
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
    if (!isPublicDisplaySource(source)) continue;
    const url = publicSourceUrl(source.source_url);
    const title = cleanText(source.title);
    if (!url || !title) continue;
    const key = sourceDocumentKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      url,
      title,
      publisher: cleanText(source.creator_name) || cleanText(source.platform) || null,
      capturedAt: evidenceTimestamp(source.captured_at),
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

/**
 * 이 문서가 실제로 들고 있는 근거의 양과 종류.
 *
 * 왜 필요한가: 상세 페이지가 출처 유무와 무관하게 "밈캐치 검수팀 확인"을 출력하고
 * 있었다. 공개 문서의 34.1%(1,330건)는 근거 출처 URL이 하나도 없다 — 근거보다
 * 신뢰 주장이 앞선 상태다. 화면이 상태별로 다른 문장을 쓰려면 먼저 상태를 셀 수
 * 있어야 한다.
 *
 * `meme_sources`만 센다. 재생용 `meme_contents.url`은 콘텐츠를 보여 주는 링크지
 * 주장을 입증하는 근거가 아니다(둘을 합치면 근거 0건 문서가 1건으로 보인다).
 */
export type EvidenceSummary = {
  /** URL 기준 중복 제거한 근거 출처 수 */
  total: number;
  /** 맥락 위키가 아닌 일반 출처 수. 이름은 호환성 유지용이며 1차 자료 인증이 아니다. */
  primary: number;
  /** 나무위키·위키백과 등 맥락 확인용 보조 출처 */
  context: number;
  /**
   * primary 중 서지 정보(제목 또는 작성자)가 있는 것.
   *
   * 루프 023 전수 확인: meme_sources 4,608행 중 2,876행(62.4%)이 title·creator
   * 둘 다 null인 맨 URL이다. URL만 있는 행을 「원본·보도 확인」으로 세면 문서
   * 안에서 그 출처가 무엇인지 확인할 수 없는데도 확인을 주장하게 된다 —
   * citableSources()가 제목 없는 출처를 근거 목록에서 제외하는 것과 같은 원칙.
   */
  identifiedPrimary: number;
};

/** 근거 요약 입력 — URL에 더해 서지 확인용 title/creator를 선택적으로 받는다. */
export type EvidenceSourceInput = SourceLink & {
  title?: string | null;
  creator_name?: string | null;
};

export function summarizeEvidence(sources: EvidenceSourceInput[]): EvidenceSummary {
  const seen = new Set<string>();
  let primary = 0;
  let context = 0;
  let identifiedPrimary = 0;
  for (const source of sources) {
    if (!isPublicDisplaySource(source)) continue;
    const url = publicSourceUrl(source.source_url);
    if (!url) continue;
    const key = sourceDocumentKey(url);
    if (seen.has(key)) continue;
    seen.add(key);
    if (isContextSourceUrl(url)) {
      context += 1;
    } else {
      primary += 1;
      if (cleanText(source.title) || cleanText(source.creator_name)) {
        identifiedPrimary += 1;
      }
    }
  }
  return { total: seen.size, primary, context, identifiedPrimary };
}

/** 원본·공식·보도 링크를 먼저 보여 주고, 없을 때만 맥락 출처를 폴백한다. */
export function preferredSourceUrl(sources: SourceLink[]) {
  const urls = sources
    .filter(isPublicDisplaySource)
    .map((source) => publicSourceUrl(source.source_url))
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
    .flatMap((source) => {
      if (!isPublicDisplaySource(source)) return [];
      const url = publicSourceUrl(source.source_url);
      if (!url) return [];
      const key = sourceDocumentKey(url);
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ ...source, source_url: url }];
    });
}
