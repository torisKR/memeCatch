// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SourceEvidence } from "@/components/source-evidence";

describe("SourceEvidence", () => {
  it("keeps factual source details while removing repeated processing copy", () => {
    const html = renderToStaticMarkup(
      <SourceEvidence
        shortId="abcd1234"
        sources={[
          {
            source_url: "https://ko.wikipedia.org/wiki/example",
            title: "확인 가능한 참고 자료",
            creator_name: "작성자",
            captured_at: "2026-07-01T12:00:00Z",
          },
        ]}
      />,
    );

    expect(html).toContain("확인 가능한 참고 자료");
    expect(html).toContain('href="https://ko.wikipedia.org/wiki/example"');
    expect(html).toContain("작성자");
    expect(html).toContain("자료 수집일");
    expect(html).not.toContain("연결일");
    expect(html).toContain("2026년 7월 1일");
    expect(html).toContain("맥락 확인용 보조 자료");
    expect(html).not.toContain("수집 기록");
    expect(html).not.toContain("독립적인 사실 검증");
    expect(html).not.toContain("원문과 설명을 함께 비교");
  });

  it("does not render an empty source section", () => {
    const html = renderToStaticMarkup(
      <SourceEvidence shortId="abcd1234" sources={[]} />,
    );

    expect(html).toBe("");
  });

  it("lets the detail reader expose sources initially without changing other callers", () => {
    const props = { shortId: "abcd1234", sources: [{ source_url: "https://example.com/reference", title: "참고 자료" }] };
    const collapsed = renderToStaticMarkup(<SourceEvidence {...props} />);
    const expanded = renderToStaticMarkup(<SourceEvidence {...props} defaultOpen />);
    expect(collapsed).not.toContain('open=""');
    expect(expanded).toContain('open=""');
    expect(expanded).toContain('rel="noopener noreferrer"');
  });
});
