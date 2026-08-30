import { describe, expect, test } from "vitest";
import { buildChecks, buildReport, type Row } from "./quality-check.mts";

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

  test("다른 문서의 제목을 alias로 가지면 C4가 잡고, 자기 제목은 잡지 않는다", () => {
    const collide = [
      row({ id: "a", short_id: "aaaaaaaa", title: "밈 A", aliases: ["밈 B"] }),
      row({ id: "b", short_id: "bbbbbbbb", title: "밈 B" }),
    ];
    expect(countOf(collide, "DQ-C4-alias-title-collision")).toBe(1);
    expect(countOf([row({ aliases: ["테스트 밈"] })], "DQ-C4-alias-title-collision")).toBe(0);
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
    // 고유 산문 250자 미만 → thin. 검사기와 sitemap이 같은 함수를 쓰는지 확인한다.
    const report = buildReport([row({ description: "짧음" })]);
    expect(report.depth.thin).toBe(1);
    expect(report.depth.substantial).toBe(0);
    expect(report.scope.documents).toBe(1);
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
