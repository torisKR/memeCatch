import { describe, expect, it } from "vitest";

import {
  CONTENT_DEPTH_THRESHOLDS as T,
  contentDepth,
  isIndexableMeme,
  type ContentDepthInput,
} from "@/lib/content-depth";

/** 한글 n글자 — 길이 경계를 정확히 맞추기 위한 헬퍼(공백 없음, trim 영향 없음). */
const chars = (n: number) => "밈".repeat(n);

/** 실제 프로덕션 중앙값에 가까운 얇은 밈 — 정의 135자, 유래 31자, 출처 1개. */
function thinMeme(overrides: ContentDepthInput = {}): ContentDepthInput {
  return {
    description: chars(135),
    origin: chars(31),
    usage_note: chars(25),
    caution: null,
    usage_examples: null,
    meme_sources: [{ source_url: "https://namu.wiki/w/example" }],
    meme_contents: [],
    meme_tags_map: [],
    ...overrides,
  };
}

/** 충실한 밈 — 긴 정의·유래 서술 + 예문 2개 + 출처 2개 + 살아 있는 임베드. */
function substantialMeme(overrides: ContentDepthInput = {}): ContentDepthInput {
  return {
    description: chars(420),
    origin: chars(80),
    usage_note: chars(60),
    caution: chars(50),
    usage_examples: [
      { situation: "친구와", text: chars(30) },
      { situation: "직장에서", text: chars(30) },
    ],
    meme_sources: [
      { source_url: "https://www.youtube.com/watch?v=abc123" },
      { source_url: "https://namu.wiki/w/example" },
    ],
    meme_contents: [{ availability: "live", moderation_status: "approved" }],
    meme_tags_map: [{ tag_id: "a" }, { tag_id: "b" }, { tag_id: "c" }],
    ...overrides,
  };
}

describe("contentDepth 판정", () => {
  it("전형적인 얇은 밈을 얇음으로 판정한다", () => {
    const depth = contentDepth(thinMeme());
    expect(depth.isThin).toBe(true);
    expect(depth.isSubstantial).toBe(false);
    expect(depth.proseChars).toBeLessThan(T.MIN_PROSE_CHARS);
  });

  it("충실한 밈을 충실로 판정한다", () => {
    const depth = contentDepth(substantialMeme());
    expect(depth.isSubstantial).toBe(true);
    expect(depth.isThin).toBe(false);
    expect(depth.score).toBeGreaterThanOrEqual(T.MIN_SCORE);
    expect(depth.proseChars).toBeGreaterThanOrEqual(T.MIN_PROSE_CHARS);
  });

  it("isSubstantial과 isThin은 항상 반대다", () => {
    for (const meme of [thinMeme(), substantialMeme(), {}]) {
      const depth = contentDepth(meme);
      expect(depth.isThin).toBe(!depth.isSubstantial);
    }
  });

  it("isIndexableMeme은 isSubstantial과 같은 답을 준다", () => {
    expect(isIndexableMeme(substantialMeme())).toBe(true);
    expect(isIndexableMeme(thinMeme())).toBe(false);
  });
});

describe("두 관문 — 산문 총량 AND 종합 점수", () => {
  it("점수가 충분해도 고유 산문이 하한 미만이면 얇음이다", () => {
    // 링크·임베드·예문으로만 점수를 채운 문서: 출처 2 + 미디어 1 + 예문 2 = 5점.
    const depth = contentDepth({
      description: null,
      origin: null,
      usage_examples: [
        { situation: "가", text: "나" },
        { situation: "다", text: "라" },
      ],
      meme_sources: [
        { source_url: "https://a.example/1" },
        { source_url: "https://b.example/2" },
      ],
      meme_contents: [{ availability: "live", moderation_status: "approved" }],
    });

    expect(depth.score).toBeGreaterThanOrEqual(T.MIN_SCORE);
    expect(depth.proseChars).toBeLessThan(T.MIN_PROSE_CHARS);
    expect(depth.isThin).toBe(true);
  });

  it("산문이 길어도 점수가 하한 미만이면 얇음이다", () => {
    // 정의 본문만 긴 문서: 유래·예문·출처·미디어 없음 → 2점.
    const depth = contentDepth({
      description: chars(T.MIN_PROSE_CHARS + 100),
      meme_sources: [],
      meme_contents: [],
    });

    expect(depth.proseChars).toBeGreaterThanOrEqual(T.MIN_PROSE_CHARS);
    expect(depth.score).toBeLessThan(T.MIN_SCORE);
    expect(depth.isThin).toBe(true);
  });

  it("두 하한을 정확히 채우면 통과하고, 산문 1글자가 모자라면 탈락한다", () => {
    // 정의 190(1점) + 유래 60(2점) + 출처 2개(2점) = 5점, 산문 250자.
    const atBoundary: ContentDepthInput = {
      description: chars(190),
      origin: chars(60),
      meme_sources: [
        { source_url: "https://a.example/1" },
        { source_url: "https://b.example/2" },
      ],
    };
    const pass = contentDepth(atBoundary);
    expect(pass.score).toBe(T.MIN_SCORE);
    expect(pass.proseChars).toBe(T.MIN_PROSE_CHARS);
    expect(pass.isSubstantial).toBe(true);

    const fail = contentDepth({ ...atBoundary, description: chars(189) });
    expect(fail.score).toBe(T.MIN_SCORE);
    expect(fail.proseChars).toBe(T.MIN_PROSE_CHARS - 1);
    expect(fail.isSubstantial).toBe(false);
  });
});

describe("신호 집계", () => {
  it("정의 본문 길이 구간에 따라 3·2·1·0점을 준다", () => {
    const only = (description: string | null) =>
      contentDepth({ description, meme_sources: [], meme_contents: [] }).score;

    expect(only(chars(T.DESCRIPTION_RICH))).toBe(3);
    expect(only(chars(T.DESCRIPTION_SOLID))).toBe(2);
    expect(only(chars(T.DESCRIPTION_BASIC))).toBe(1);
    expect(only(chars(T.DESCRIPTION_BASIC - 1))).toBe(0);
    expect(only(null)).toBe(0);
  });

  it("유래 서술이 없으면 0점, 짧으면 1점, 길면 2점이다", () => {
    const only = (origin: string | null) => contentDepth({ origin }).score;

    expect(only(null)).toBe(0);
    expect(only(chars(T.ORIGIN_BASIC - 1))).toBe(0);
    expect(only(chars(T.ORIGIN_BASIC))).toBe(1);
    expect(only(chars(T.ORIGIN_RICH))).toBe(2);
  });

  it("형태가 깨진 usage_examples 항목은 세지 않는다", () => {
    const depth = contentDepth({
      usage_examples: [
        { situation: "친구와", text: "제대로 된 예문" },
        { situation: "  ", text: "상황이 비어 있음" },
        { situation: "본문이 비어 있음", text: "   " },
        { situation: "숫자 본문", text: 42 },
        "문자열 항목",
        null,
      ],
    });

    expect(depth.signals.usageExampleCount).toBe(1);
  });

  it("usage_examples가 배열이 아니면 예문 0개로 본다", () => {
    for (const value of [null, undefined, {}, "예문", 3]) {
      expect(contentDepth({ usage_examples: value }).signals.usageExampleCount).toBe(0);
    }
  });

  it("같은 출처 URL이 여러 번 실려 와도 하나로 센다", () => {
    const depth = contentDepth({
      meme_sources: [
        { source_url: "https://www.youtube.com/watch?v=abc" },
        { source_url: "  HTTPS://WWW.YOUTUBE.COM/WATCH?V=ABC  " },
        { source_url: "" },
        { source_url: null },
      ],
    });

    expect(depth.signals.sourceCount).toBe(1);
  });

  it("죽었거나 미승인된 콘텐츠는 미디어로 세지 않는다", () => {
    const depth = contentDepth({
      meme_contents: [
        { availability: "dead", moderation_status: "approved" },
        { availability: "live", moderation_status: "pending" },
        { availability: "live", moderation_status: "approved" },
      ],
    });

    expect(depth.signals.mediaCount).toBe(1);
  });

  it("한 줄짜리 사용법·주의 문구는 점수에도 산문 총량에도 넣지 않는다", () => {
    const short = contentDepth({
      usage_note: chars(T.SUPPORTING_PROSE - 1),
      caution: chars(T.SUPPORTING_PROSE - 1),
    });
    expect(short.score).toBe(0);
    expect(short.signals.supportingProseChars).toBe(0);
    expect(short.proseChars).toBe(0);

    const long = contentDepth({
      usage_note: chars(T.SUPPORTING_PROSE),
      caution: chars(T.SUPPORTING_PROSE),
    });
    expect(long.score).toBe(2);
    expect(long.signals.supportingProseChars).toBe(T.SUPPORTING_PROSE * 2);
  });

  it("태그는 최소 개수를 넘겨야 1점이다", () => {
    const tags = (n: number) =>
      contentDepth({ meme_tags_map: Array.from({ length: n }, (_, i) => ({ tag_id: `${i}` })) });

    expect(tags(T.TAGS - 1).score).toBe(0);
    expect(tags(T.TAGS).score).toBe(1);
    expect(tags(T.TAGS).signals.tagCount).toBe(T.TAGS);
  });

  it("select에서 빠진 관계 필드는 0으로 보수적으로 처리한다", () => {
    const depth = contentDepth({ description: chars(500) });

    expect(depth.signals.sourceCount).toBe(0);
    expect(depth.signals.mediaCount).toBe(0);
    expect(depth.signals.tagCount).toBe(0);
    expect(depth.isThin).toBe(true);
  });

  it("입력이 null·undefined여도 안전하게 얇음으로 판정한다", () => {
    for (const value of [null, undefined]) {
      const depth = contentDepth(value);
      expect(depth.score).toBe(0);
      expect(depth.proseChars).toBe(0);
      expect(depth.isThin).toBe(true);
    }
  });
});
