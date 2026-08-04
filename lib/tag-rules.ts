/**
 * 태그 backfill 후보 산정 규칙 — 순수 함수. DB·네트워크 접근 없음.
 *
 * 근거: artifacts/renewal/loop-023/proposals/HG-004.md §2 (규칙 테이블) · §6.4 (회귀 테스트).
 * 소비처: scripts/tag-backfill-preview.mts(프리뷰), scripts/tag-backfill-preview.test.ts(회귀 가드).
 *
 * R1(category) · R3(origin_year 연도대)도 여기 정의하지만 **기본 실행은 R2만**이다
 * (제안서 §5.1 — 정렬 없는 `.limit(30)` 관련 조회 앞에서는 대형 태그가 추천을 악화시킨다).
 */

/** DB 제약과 동일해야 한다 — supabase/migrations/20260708004500_schema_v2.sql:161-171 */
export type TagType = "topic" | "generation" | "platform" | "emotion" | "risk";

export type RuleId = "r1" | "r2" | "r3";

/** 기본 실행 규칙 — 제안서 §0-5 "권고안은 R2만 적용". */
export const DEFAULT_RULES: readonly RuleId[] = ["r2"];

/** tagCandidates가 요구하는 최소 문서 형태. memes 테이블 select 결과가 그대로 들어맞는다. */
export type TagDoc = {
  title: string;
  aliases?: readonly string[] | null;
  category: string;
  origin_year?: number | null;
};

/** R2 패턴이 title/alias 중 어디서 발견됐는지 — "alias에서만 적중" 검토 대상 판별용(§6.3 [7]). */
export type TagMatchLocation = "title" | "alias" | "both" | "combined" | "n/a";

export type TagCandidate = {
  tag: string;
  type: TagType;
  rule: "R1" | "R2" | "R3";
  /** R1=category 값, R2=매칭된 키워드, R3=origin_year */
  matchedOn: string;
  location: TagMatchLocation;
  /** ASCII 단어경계 규칙으로 매칭됐는가(R2 전용). */
  wordBoundary: boolean;
};

// ── 2.0 문자열 정규화 ──────────────────────────────────────────────────────

/** norm()이 지우는 문자 — 공백류 + 구두점류. 순서·중복은 무관. */
const STRIP_CHARS = new Set([
  "·", ",", "-", "–", "—", "/", "(", ")", "[", "]",
  '"', "'", "’", "“", "”", "!", "?", "~", ":", ";", ".",
]);

/** NFC 정규화 + 공백·구두점 제거 + 소문자화 — 한글 부분일치 매칭의 좌변/우변에 공통 적용. */
export function norm(s: string): string {
  let out = "";
  for (const ch of s.normalize("NFC")) {
    if (STRIP_CHARS.has(ch) || /\s/.test(ch)) continue;
    out += ch;
  }
  return out.toLowerCase();
}

/** 패턴이 ASCII 문자·숫자로만 구성됐는가 — 단어경계 매칭 대상인지 결정한다. */
function isAsciiPattern(pattern: string): boolean {
  return /^[A-Za-z0-9]+$/.test(pattern);
}

const boundaryRegexCache = new Map<string, RegExp>();
/** `(?<![A-Za-z0-9])PAT(?![A-Za-z0-9])`, 대소문자 무시 — ASCII 패턴 전용. */
function boundaryRegex(pattern: string): RegExp {
  let re = boundaryRegexCache.get(pattern);
  if (!re) {
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, "i");
    boundaryRegexCache.set(pattern, re);
  }
  return re;
}

/** 원문(비정규화) 대상 검사 — ASCII 패턴은 단어경계, 한글 패턴은 정규화 부분일치. */
function patternHits(pattern: string, rawText: string, normText: string): boolean {
  return isAsciiPattern(pattern)
    ? boundaryRegex(pattern).test(rawText)
    : normText.includes(norm(pattern));
}

/** title/alias 각각에 대해 어디서 적중했는지 — 리포트용(매칭 여부 자체는 patternHits가 결정). */
function locationOf(pattern: string, title: string, aliasText: string): TagMatchLocation {
  const ascii = isAsciiPattern(pattern);
  const hitsTitle = ascii ? boundaryRegex(pattern).test(title) : norm(title).includes(norm(pattern));
  const hitsAlias = ascii
    ? boundaryRegex(pattern).test(aliasText)
    : norm(aliasText).includes(norm(pattern));
  if (hitsTitle && hitsAlias) return "both";
  if (hitsTitle) return "title";
  if (hitsAlias) return "alias";
  // title과 alias를 이어붙인 결과에서만 나타나는 경계 우연 일치(드묾) — combined로 표시.
  return "combined";
}

// ── 2.1 R1 — category 태그(topic), 적용 보류(기본 미실행) ──────────────────

export const R1_CATEGORY_TAGS: Readonly<Record<string, string>> = {
  phrase: "유행어",
  dance: "춤·안무",
  song: "노래",
  image: "짤",
  comment: "댓글·드립",
  challenge: "챌린지",
};

// ── 2.2 R2 — 제목·alias 키워드 태그(기본 실행) ──────────────────────────────

type R2Rule = {
  tag: string;
  type: TagType;
  patterns: readonly string[];
  /** 패턴 → 이 문자열이 텍스트에 있으면 해당 패턴의 매칭을 취소한다(차단어). */
  blocklist?: Readonly<Record<string, readonly string[]>>;
};

/** §2.2 표 그대로 — 22종. 순서는 dedupe 우선순위와 무관(태그명 Set로 dedupe). */
export const R2_RULES: readonly R2Rule[] = [
  { tag: "챌린지", type: "topic", patterns: ["챌린지"] },
  { tag: "신드롬", type: "topic", patterns: ["신드롬", "열풍", "대란"] },
  {
    tag: "케이팝",
    type: "topic",
    patterns: [
      "뉴진스", "에스파", "르세라핌", "블랙핑크", "아이브",
      "원더걸스", "세븐틴", "트와이스", "소녀시대", "BTS",
    ],
  },
  {
    tag: "예능",
    type: "topic",
    patterns: [
      "무한도전", "무한상사", "런닝맨", "개그콘서트", "봉숭아학당",
      "라디오스타", "나는솔로", "아는형님", "1박2일",
    ],
  },
  { tag: "논란", type: "risk", patterns: ["논란", "사태"] },
  { tag: "짤", type: "topic", patterns: ["짤"] },
  { tag: "사건", type: "topic", patterns: ["사건"] },
  { tag: "광고", type: "topic", patterns: ["CM송", "광고"] },
  {
    tag: "게임·스트리밍",
    type: "topic",
    patterns: ["페이커", "트위치", "치지직", "침착맨", "롤드컵", "이세계아이돌"],
  },
  { tag: "동물", type: "topic", patterns: ["고양이", "강아지", "푸바오"] },
  {
    tag: "스포츠",
    type: "topic",
    patterns: ["올림픽", "금메달", "월드컵", "세리머니"],
    // e스포츠 「오버워치 월드컵」은 스포츠 종목이 아니다(§2.2 차단어).
    blocklist: { 월드컵: ["오버워치 월드컵"] },
  },
  { tag: "명대사", type: "topic", patterns: ["명대사"] },
  { tag: "댓글·드립", type: "topic", patterns: ["드립"] },
  { tag: "드라마·영화", type: "topic", patterns: ["오징어게임", "우영우"] },
  { tag: "상황극", type: "topic", patterns: ["상황극"] },
  { tag: "먹방", type: "topic", patterns: ["먹방", "편의점"] },
  { tag: "유행어", type: "topic", patterns: ["유행어"] },
  { tag: "AI", type: "topic", patterns: ["AI"] },
  { tag: "공포", type: "topic", patterns: ["점프스케어"] },
  { tag: "뷰티", type: "topic", patterns: ["메이크업"] },
  { tag: "신조어", type: "topic", patterns: ["신조어"] },
  { tag: "성대모사", type: "topic", patterns: ["성대모사"] },
];

// ── 2.3 R3 — origin_year 연도대 태그(generation), 적용 보류 ─────────────────

/** origin_year → "{decade}년대". null이면 태그 없음. */
export function r3DecadeTag(originYear: number | null | undefined): string | null {
  if (originYear == null) return null;
  const decade = Math.floor(originYear / 10) * 10;
  return `${decade}년대`;
}

// ── tagCandidates ───────────────────────────────────────────────────────

/**
 * 문서 하나에 대해 활성 규칙이 만드는 태그 후보 목록(dedupe 적용).
 * 규칙 적용 순서는 R1 → R2 → R3(§2.2 note — R1이 먼저 선점하면 같은 이름의 R2 매칭이 흡수된다).
 */
export function tagCandidates(
  doc: TagDoc,
  rules: readonly RuleId[] = DEFAULT_RULES
): TagCandidate[] {
  const active = new Set(rules);
  const aliases = (doc.aliases ?? []).filter((a): a is string => !!a);
  const aliasText = aliases.join(" ");
  const rawText = [doc.title, ...aliases].filter(Boolean).join(" ");
  const normText = norm(rawText);

  const seen = new Set<string>();
  const out: TagCandidate[] = [];
  const add = (candidate: TagCandidate) => {
    if (seen.has(candidate.tag)) return;
    seen.add(candidate.tag);
    out.push(candidate);
  };

  if (active.has("r1")) {
    const tag = R1_CATEGORY_TAGS[doc.category];
    if (tag) {
      add({
        tag,
        type: "topic",
        rule: "R1",
        matchedOn: doc.category,
        location: "n/a",
        wordBoundary: false,
      });
    }
  }

  if (active.has("r2")) {
    for (const rule of R2_RULES) {
      for (const pattern of rule.patterns) {
        if (!patternHits(pattern, rawText, normText)) continue;
        const blocked = rule.blocklist?.[pattern];
        if (blocked?.some((word) => normText.includes(norm(word)))) continue;
        add({
          tag: rule.tag,
          type: rule.type,
          rule: "R2",
          matchedOn: pattern,
          location: locationOf(pattern, doc.title, aliasText),
          wordBoundary: isAsciiPattern(pattern),
        });
        break; // 같은 규칙(태그)에서 한 번 매칭되면 나머지 패턴은 볼 필요 없다.
      }
    }
  }

  if (active.has("r3")) {
    const tag = r3DecadeTag(doc.origin_year);
    if (tag) {
      add({
        tag,
        type: "generation",
        rule: "R3",
        matchedOn: String(doc.origin_year),
        location: "n/a",
        wordBoundary: false,
      });
    }
  }

  return out;
}
