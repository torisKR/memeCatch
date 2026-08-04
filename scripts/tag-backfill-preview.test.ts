import { describe, it, expect } from "vitest";
import { tagCandidates, type TagDoc } from "../lib/tag-rules.ts";

const doc = (title: string, aliases: string[] = [], category = "phrase"): TagDoc => ({
  title,
  aliases,
  category,
  origin_year: null,
});

describe("tag-rules R2", () => {
  it("ASCII 패턴은 단어 경계로만 맞는다 — AGAIN 2002는 AI가 아니다", () => {
    expect(tagCandidates(doc("AGAIN 2002")).map((c) => c.tag)).not.toContain("AI");
    expect(tagCandidates(doc("이거 AI 아니냐 밈")).map((c) => c.tag)).toContain("AI");
  });

  it("alias에서도 적중한다 (242건이 여기서만 나온다)", () => {
    expect(tagCandidates(doc("GPT체", ["AI 문체"])).map((c) => c.tag)).toContain("AI");
  });

  it("이세계아이돌은 케이팝이 아니라 게임·스트리밍이다", () => {
    const t = tagCandidates(doc("이세계아이돌", ["이세돌"])).map((c) => c.tag);
    expect(t).toContain("게임·스트리밍");
    expect(t).not.toContain("케이팝");
  });

  it("차단어 — 오버워치 월드컵은 스포츠가 아니다", () => {
    expect(tagCandidates(doc("2018 오버워치 월드컵 3연속 우승")).map((c) => c.tag)).not.toContain(
      "스포츠"
    );
  });

  it("한 문서에 같은 태그가 두 번 나오지 않는다 (map 복합 PK 충돌 방지)", () => {
    const t = tagCandidates(doc("신드롬 열풍 대란")).map((c) => c.tag);
    expect(t.filter((x) => x === "신드롬")).toHaveLength(1);
  });
});
