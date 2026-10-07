import { describe, expect, test } from "vitest";
import { buildChecks, buildReport, type Row } from "./quality-check.mts";
import { isIndexableMeme } from "../lib/content-depth";

/** 검사기가 잡아야 하는 결함만 최소로 심는 행 팩토리. */
function row(over: Partial<Row> = {}): Row {
  return {
    id: "id-1",
    short_id: "aaaaaaaa",
    title: "테스트 밈",
    aliases: [],
    summary: "한 줄 뜻",
    description: "설명",
    origin: "유래",
    usage_note: null,
    caution: null,
    usage_context: { work: "green", friends: "yellow", family: "green", sns: "green" },
    usage_examples: [],
    origin_year: 2024,
    moderation_status: "approved",
    updated_at: "2026-08-01T00:00:00.000Z",
    trend_score: 0,
    meme_sources: [
      { source_url: "https://example.com/a", copyright_status: "embeddable" },
    ],
    meme_contents: [
      {
        availability: "live",
        moderation_status: "approved",
        is_representative: true,
        thumbnail_url: "https://example.com/t.jpg",
      },
    ],
    meme_tags_map: [{ tag_id: "t1" }],
    ...over,
  };
}

function countOf(rows: Row[], id: string): number {
  const check = buildChecks(rows).find((c) => c.id === id);
  if (!check) throw new Error(`unknown check: ${id}`);
  return check.count;
}

describe("quality-check", () => {
  test("건강한 행은 critical 검사를 모두 통과한다", () => {
    const criticals = buildChecks([row()]).filter((c) => c.severity === "critical");
    expect(criticals).toHaveLength(4);
    expect(criticals.map((c) => c.count)).toEqual([0, 0, 0, 0]);
  });

  test("출처 URL이 없거나 공백뿐이면 C1이 잡는다", () => {
    expect(countOf([row({ meme_sources: [] })], "DQ-C1-published-without-source")).toBe(1);
    expect(
      countOf(
        [row({ meme_sources: [{ source_url: "  ", copyright_status: "unknown" }] })],
        "DQ-C1-published-without-source",
      ),
    ).toBe(1);
  });

  test.each([
    "javascript:alert(1)",
    "https://user:pass@archive.org/source",
    "https://127.0.0.1/source",
    "http://10.0.0.1/source",
    "https://foo.local/source",
    "https://archive.org:8443/source",
  ])("공개 출처로 쓸 수 없는 URL은 근거로 세지 않는다: %s", (source_url) => {
    const unsafe = row({ meme_sources: [{ source_url, copyright_status: "embeddable" }] });
    expect(countOf([unsafe], "DQ-C1-published-without-source")).toBe(1);
    expect(countOf([unsafe], "DQ-M4-invalid-source-url")).toBe(1);
  });

  test("유효한 공개 HTTP 출처와 무효 URL이 함께 있으면 두 상태를 구분한다", () => {
    const mixed = row({
      meme_sources: [
        { source_url: "http://example.com/source", copyright_status: "embeddable" },
        { source_url: "https://localhost/source", copyright_status: "unknown" },
      ],
    });
    expect(countOf([mixed], "DQ-C1-published-without-source")).toBe(0);
    expect(countOf([mixed], "DQ-M4-invalid-source-url")).toBe(1);
    expect(countOf([row()], "DQ-M4-invalid-source-url")).toBe(0);
    expect(countOf([row({ meme_sources: [] })], "DQ-M4-invalid-source-url")).toBe(0);
    expect(countOf([row({ meme_sources: [{ source_url: "  ", copyright_status: "unknown" }] })],
      "DQ-M4-invalid-source-url")).toBe(0);
  });

  test("대표 재생 콘텐츠가 있어도 그것을 사실 근거 출처로 세지 않는다", () => {
    const previewOnly = row({ meme_sources: [] });
    expect(countOf([previewOnly], "DQ-C1-published-without-source")).toBe(1);
    expect(countOf([previewOnly], "DQ-H3-no-representative-content")).toBe(0);
  });

  test("대표 콘텐츠가 dead면 C2와 H3가 함께 잡는다", () => {
    const dead = row({
      meme_contents: [
        {
          availability: "dead",
          moderation_status: "approved",
          is_representative: true,
          thumbnail_url: "https://example.com/t.jpg",
        },
      ],
    });
    expect(countOf([dead], "DQ-C2-dead-representative")).toBe(1);
    expect(countOf([dead], "DQ-H3-no-representative-content")).toBe(1);
  });

  test("공백·문장부호만 다른 제목은 중복으로 본다", () => {
    const rows = [
      row({ id: "a", short_id: "aaaaaaaa", title: "잘자 내꿈꿔" }),
      row({ id: "b", short_id: "bbbbbbbb", title: "잘자, 내 꿈 꿔!" }),
    ];
    expect(countOf(rows, "DQ-C3-duplicate-canonical-title")).toBe(2);
  });

  test("NFKC 전각 문자와 기호 변형 제목도 기존 수입 규칙과 같은 중복이다", () => {
    const rows = [
      row({ id: "a", short_id: "aaaaaaaa", title: "ＡＩ 밈★" }),
      row({ id: "b", short_id: "bbbbbbbb", title: "ai 밈" }),
    ];
    expect(countOf(rows, "DQ-C3-duplicate-canonical-title")).toBe(2);
    expect(countOf([
      row({ id: "a", short_id: "aaaaaaaa", title: "AI 밈", aliases: ["ＣＯＯＬ"] }),
      row({ id: "b", short_id: "bbbbbbbb", title: "cool" }),
    ], "DQ-C4-alias-title-collision")).toBe(1);
  });

  test("정규화 키가 비는 서로 다른 기호 제목을 중복으로 묶지 않는다", () => {
    expect(countOf([
      row({ id: "a", short_id: "aaaaaaaa", title: "🌟" }),
      row({ id: "b", short_id: "bbbbbbbb", title: "⭐" }),
    ], "DQ-C3-duplicate-canonical-title")).toBe(0);
  });

  test("정규화 키가 비는 제목과 별칭은 다른 기호와 충돌하지 않는다", () => {
    expect(countOf([
      row({ id: "a", short_id: "aaaaaaaa", title: "⭐", aliases: ["🌟"] }),
      row({ id: "b", short_id: "bbbbbbbb", title: "별 밈", aliases: ["✨"] }),
    ], "DQ-C4-alias-title-collision")).toBe(0);
  });

  test("다른 문서의 제목을 alias로 가지면 C4가 잡고, 자기 제목은 잡지 않는다", () => {
    const collide = [
      row({ id: "a", short_id: "aaaaaaaa", title: "밈 A", aliases: ["밈 B"] }),
      row({ id: "b", short_id: "bbbbbbbb", title: "밈 B" }),
    ];
    expect(countOf(collide, "DQ-C4-alias-title-collision")).toBe(1);
    expect(countOf([row({ aliases: ["테스트 밈"] })], "DQ-C4-alias-title-collision")).toBe(0);
  });

  test.each([
    ["테스트 밈", "테스트 밈"],
    ["나야 들기름", "나야, 들기름!"],
    ["AI 밈", "ＡＩ 밈★"],
  ])("제목을 반복하는 요약을 검수 대상으로 표시한다: %s", (title, summary) => {
    expect(countOf([row({ title, summary })], "DQ-H5-summary-repeats-title")).toBe(1);
  });

  test("AI 거절 문구의 유래·사용 상황을 설명한 정상 패러디 밈은 반복 요약이 아니다", () => {
    const parody = row({
      title: "실시간 정보에 접근할 수 없습니다",
      summary: "챗GPT가 최신 정보 질문에 답하지 못할 때 쓰는 정형 문구를 패러디해요.",
      description: '챗GPT의 "실시간 정보에 접근할 수 없습니다"라는 답변을 흉내 내 최신 소식을 모르는 상황에 사용해요.',
    });
    expect(countOf([parody], "DQ-H5-summary-repeats-title")).toBe(0);
    expect(countOf([parody], "DQ-M3-placeholder-text")).toBe(0);
  });

  test("상황 신호가 전부 같은 값이면 H2가 잡는다", () => {
    const uniform = { work: "green", friends: "green", family: "green", sns: "green" };
    expect(countOf([row({ usage_context: uniform })], "DQ-H2-uniform-usage-context")).toBe(1);
    expect(countOf([row()], "DQ-H2-uniform-usage-context")).toBe(0);
  });

  test("조사 placeholder가 남으면 M3가 잡는다", () => {
    expect(
      countOf([row({ description: "이 밈을(를) 쓸 때는" })], "DQ-M3-placeholder-text"),
    ).toBe(1);
  });

  test("리포트 충실도는 lib/content-depth 판정을 그대로 쓴다", () => {
    // 고유 산문 250자 미만 → 배너·광고 기준 thin. SEO 기준은 별도로 150자다.
    const report = buildReport([row({ description: "짧음" })]);
    expect(report.depth.thin).toBe(1);
    expect(report.depth.substantial).toBe(0);
    expect(report.scope.documents).toBe(1);
  });

  test("H1은 SEO 색인과 다른 250자 정리 중 배너·광고 기준임을 표시한다", () => {
    const gap = row({
      description: "설".repeat(160),
      origin: "유".repeat(40),
      meme_sources: [
        { source_url: "https://example.com/a", copyright_status: "embeddable" },
        { source_url: "https://example.com/b", copyright_status: "embeddable" },
      ],
      meme_tags_map: [{ tag_id: "t1" }, { tag_id: "t2" }, { tag_id: "t3" }],
    });
    expect(isIndexableMeme(gap)).toBe(true);
    expect(buildReport([gap]).depth.thin).toBe(1);
    const check = buildChecks([gap]).find((item) => item.id === "DQ-H1-thin-document");
    expect(check?.count).toBe(1);
    expect(check?.title).toMatch(/배너|광고/);
    expect(check?.title).not.toContain("색인 제외");
  });

  test("C1 표본은 trend_score가 높은 문서를 앞에 둔다", () => {
    const unsourced = (over: Partial<Row>) =>
      row({ meme_sources: [], ...over });
    const samples = buildChecks([
      unsourced({ id: "low", short_id: "lowscore", trend_score: 1.1 }),
      unsourced({ id: "high", short_id: "highscor", trend_score: 9.4 }),
      unsourced({ id: "mid", short_id: "midscore", trend_score: 4.2 }),
    ]).find((c) => c.id === "DQ-C1-published-without-source")?.samples;

    expect(samples).toEqual(["highscor", "midscore", "lowscore"]);
  });
});
