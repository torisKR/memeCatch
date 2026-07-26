/**
 * 밈 상세 문서의 콘텐츠 충실도(content depth) 판정.
 *
 * 색인 노출면을 통제하기 위한 단일 기준점이다. 밈 레코드 자체가 들고 있는
 * "고유 산문 + 근거"만 센다. 템플릿·내비게이션·관련 밈 링크처럼 모든 문서에
 * 똑같이 붙는 요소는 점수에 넣지 않는다(대량생산 얇은 문서를 걸러내는 게 목적이라
 * 공통 껍데기를 세면 전부 통과해버린다).
 *
 * 소비처는 두 곳이며 **반드시 같은 신호를 넘겨야** 판정이 갈리지 않는다:
 *   - app/sitemap.ts        — 얇은 밈을 사이트맵에서 제외
 *   - app/memes/[key]/page.tsx — 얇은 밈에 robots noindex,follow 부착
 *
 * 데이터는 삭제하지 않는다. 페이지는 그대로 200으로 살아 있고 색인 노출만 줄인다.
 */

/** 임계값 — 운영하며 조정하는 값이라 전부 여기 모아 둔다. */
export const CONTENT_DEPTH_THRESHOLDS = {
  /** 이 문서만의 산문 총량(설명+유래+사용법+주의+예문) 하한. 미만이면 무조건 얇음. */
  MIN_PROSE_CHARS: 250,
  /** 종합 점수 하한. 산문 하한을 넘겨도 이 점수 미만이면 얇음. */
  MIN_SCORE: 5,
  /** 정의 본문(description) 길이 구간 → 3 / 2 / 1점 */
  DESCRIPTION_RICH: 400,
  DESCRIPTION_SOLID: 250,
  DESCRIPTION_BASIC: 150,
  /** 유래 서술(origin) 길이 구간 → 2 / 1점 */
  ORIGIN_RICH: 60,
  ORIGIN_BASIC: 30,
  /** 사용법·주의 문단이 한 줄짜리 상투구가 아니라고 볼 최소 길이 → 각 1점 */
  SUPPORTING_PROSE: 40,
  /** 태그가 분류로서 의미를 갖는 최소 개수 → 1점 */
  TAGS: 3,
} as const;

/** 점수 만점 — 3(정의) + 2(유래) + 2(예문) + 2(출처) + 1(미디어) + 1(사용법) + 1(주의) + 1(태그) */
export const MAX_CONTENT_DEPTH_SCORE = 13;

export type DepthSourceRef = { source_url?: string | null };
export type DepthContentRef = {
  availability?: string | null;
  moderation_status?: string | null;
};
export type DepthTagRef = { tag_id?: string | null };

/**
 * 충실도 계산에 필요한 최소 형태. MemeDetail(상세)과 사이트맵 전용 select 결과가
 * 둘 다 구조적으로 이 타입에 들어맞도록 전 필드를 옵셔널로 둔다.
 * 신호를 select에서 빠뜨리면 그만큼 점수가 낮게(=보수적으로) 나온다.
 */
export type ContentDepthInput = {
  description?: string | null;
  origin?: string | null;
  usage_note?: string | null;
  caution?: string | null;
  /** jsonb — 형태를 신뢰할 수 없어 런타임 검증 후 센다. */
  usage_examples?: unknown;
  meme_sources?: DepthSourceRef[] | null;
  meme_contents?: DepthContentRef[] | null;
  meme_tags_map?: DepthTagRef[] | null;
};

export type ContentDepthSignals = {
  descriptionChars: number;
  originChars: number;
  /** usage_note + caution 중 상투구 하한을 넘긴 문단들의 글자 수 합 */
  supportingProseChars: number;
  usageExampleCount: number;
  usageExampleChars: number;
  /** URL 기준 중복 제거 후 출처 링크 수 */
  sourceCount: number;
  /** 살아 있는(dead 아님 + approved) 임베드·썸네일 콘텐츠 수 */
  mediaCount: number;
  tagCount: number;
};

export type ContentDepth = {
  score: number;
  /** 이 문서에만 있는 산문 글자 수 합계 */
  proseChars: number;
  /** 색인에 남길 만큼 충실한가 */
  isSubstantial: boolean;
  /** 색인에서 뺄 얇은 문서인가 (= !isSubstantial) */
  isThin: boolean;
  signals: ContentDepthSignals;
};

function textLength(value: unknown): number {
  return typeof value === "string" ? value.trim().length : 0;
}

/**
 * usage_examples jsonb → 검증된 {situation, text} 배열.
 * components/usage-examples.tsx의 렌더 조건과 같은 기준이어야 한다
 * (화면에 안 나오는 예문을 점수에 넣으면 안 된다).
 */
function validUsageExamples(value: unknown): { situation: string; text: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { situation: string; text: string } => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const o = item as Record<string, unknown>;
    return (
      typeof o.situation === "string" &&
      o.situation.trim().length > 0 &&
      typeof o.text === "string" &&
      o.text.trim().length > 0
    );
  });
}

/** 같은 URL이 여러 번 실려 와도 근거는 하나로 센다. */
function distinctSourceCount(sources?: DepthSourceRef[] | null): number {
  if (!Array.isArray(sources)) return 0;
  const seen = new Set<string>();
  for (const s of sources) {
    const url = typeof s?.source_url === "string" ? s.source_url.trim().toLowerCase() : "";
    if (url) seen.add(url);
  }
  return seen.size;
}

/** 상세 페이지가 실제로 렌더하는 콘텐츠만 미디어로 인정 (dead·미승인 제외). */
function liveMediaCount(contents?: DepthContentRef[] | null): number {
  if (!Array.isArray(contents)) return 0;
  return contents.filter(
    (c) => c?.availability !== "dead" && c?.moderation_status === "approved"
  ).length;
}

/** 밈 레코드 → 충실도 점수와 충실/얇음 판정. 순수 함수(DB·네트워크 접근 없음). */
export function contentDepth(meme: ContentDepthInput | null | undefined): ContentDepth {
  const t = CONTENT_DEPTH_THRESHOLDS;

  const descriptionChars = textLength(meme?.description);
  const originChars = textLength(meme?.origin);
  const usageNoteChars = textLength(meme?.usage_note);
  const cautionChars = textLength(meme?.caution);

  const examples = validUsageExamples(meme?.usage_examples);
  const usageExampleChars = examples.reduce(
    (sum, e) => sum + e.situation.trim().length + e.text.trim().length,
    0
  );

  const signals: ContentDepthSignals = {
    descriptionChars,
    originChars,
    // 상투구 하한을 넘긴 문단만 "서술"로 인정 — 산문 총량도 같은 기준으로 센다.
    supportingProseChars:
      (usageNoteChars >= t.SUPPORTING_PROSE ? usageNoteChars : 0) +
      (cautionChars >= t.SUPPORTING_PROSE ? cautionChars : 0),
    usageExampleCount: examples.length,
    usageExampleChars,
    sourceCount: distinctSourceCount(meme?.meme_sources),
    mediaCount: liveMediaCount(meme?.meme_contents),
    tagCount: Array.isArray(meme?.meme_tags_map) ? meme.meme_tags_map.length : 0,
  };

  let score = 0;
  if (descriptionChars >= t.DESCRIPTION_RICH) score += 3;
  else if (descriptionChars >= t.DESCRIPTION_SOLID) score += 2;
  else if (descriptionChars >= t.DESCRIPTION_BASIC) score += 1;

  if (originChars >= t.ORIGIN_RICH) score += 2;
  else if (originChars >= t.ORIGIN_BASIC) score += 1;

  if (signals.usageExampleCount >= 2) score += 2;
  else if (signals.usageExampleCount === 1) score += 1;

  if (signals.sourceCount >= 2) score += 2;
  else if (signals.sourceCount === 1) score += 1;

  if (signals.mediaCount >= 1) score += 1;
  if (usageNoteChars >= t.SUPPORTING_PROSE) score += 1;
  if (cautionChars >= t.SUPPORTING_PROSE) score += 1;
  if (signals.tagCount >= t.TAGS) score += 1;

  const proseChars =
    descriptionChars + originChars + signals.supportingProseChars + usageExampleChars;

  // 두 관문을 모두 통과해야 충실. 점수만 높고 산문이 짧은 문서(링크·임베드로만
  // 점수를 채운 경우)를 색인에 남기지 않으려는 의도적 AND 조건이다.
  const isSubstantial = proseChars >= t.MIN_PROSE_CHARS && score >= t.MIN_SCORE;

  return { score, proseChars, isSubstantial, isThin: !isSubstantial, signals };
}

/** 사이트맵 포함·robots index 허용 여부. 색인 노출 판단은 전부 이 함수를 거친다. */
export function isIndexableMeme(meme: ContentDepthInput | null | undefined): boolean {
  return contentDepth(meme).isSubstantial;
}
