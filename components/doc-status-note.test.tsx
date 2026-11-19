// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DocStatusNote } from "./doc-status-note";

/** 괄호 대안형 조사 — 화면에 그대로 나오면 안 된다. */
const PARTICLE_PLACEHOLDER =
  /을\(를\)|를\(을\)|이\(가\)|가\(이\)|은\(는\)|는\(은\)|와\(과\)|과\(와\)/;

const thin = { description: "짧은 설명", origin: "", meme_sources: [], meme_contents: [] };

describe("DocStatusNote", () => {
  it("조사 placeholder를 화면에 노출하지 않는다", () => {
    // 제목은 받침 유무·비한글 종결이 섞여 있다 — 어느 쪽이든 placeholder가 없어야 한다.
    for (const title of ["나빌레라", "탁걸리", "보아 - No.1", "12-3-30 챌린지"]) {
      const html = renderToStaticMarkup(
        <DocStatusNote meme={thin} title={title} shortId="pp3tzbgm" />
      );
      expect(html).not.toMatch(PARTICLE_PLACEHOLDER);
      expect(html).toContain(title);
    }
  });

  it("얇은 문서에서 무엇이 비었는지 구체적으로 지목한다", () => {
    const html = renderToStaticMarkup(
      <DocStatusNote meme={thin} title="테스트 밈" shortId="pp3tzbgm" />
    );

    expect(html).toContain("아직 정리 중인 문서예요");
    expect(html).toContain("유래");
    expect(html).toContain("출처");
    // 새 밈 제보(/submit)가 아니라 같은 페이지의 보강 제보 폼을 연다.
    expect(html).not.toContain("/submit?name=");
    // 예문이 비어 있으면 예문 탭부터 연다(안내 문구가 「실제로 써 보셨다면」).
    expect(html).toContain('href="#contribute-example"');
  });

  it("예문은 있고 출처가 비었으면 출처 탭부터 연다", () => {
    const html = renderToStaticMarkup(
      <DocStatusNote
        meme={{ ...thin, usage_examples: [{ situation: "단톡방", text: "예문" }] }}
        title="테스트 밈"
        shortId="pp3tzbgm"
      />
    );
    expect(html).toContain('href="#contribute-source"');
  });

  it("충실한 문서에는 아예 렌더하지 않는다", () => {
    const substantial = {
      description: "가".repeat(400),
      origin: "나".repeat(60),
      meme_sources: [{ source_url: "https://example.com/a" }],
      meme_contents: [{ availability: "live", moderation_status: "approved" }],
    };

    expect(
      renderToStaticMarkup(
        <DocStatusNote meme={substantial} title="충실한 밈" shortId="pp3tzbgm" />
      )
    ).toBe("");
  });
});
