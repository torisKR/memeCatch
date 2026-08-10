import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TranslationCoveragePanel } from "./translation-coverage-panel";

describe("TranslationCoveragePanel", () => {
  it("renders computed locale coverage and links actionable review queues", () => {
    const html = renderToStaticMarkup(
      <TranslationCoveragePanel
        rows={[
          {
            locale: "en",
            totalPublic: 380,
            reviewedCurrent: 96,
            reviewNeeded: 12,
            stale: 4,
            missing: 268,
            completionPercentage: 25.3,
          },
          {
            locale: "ja",
            totalPublic: 380,
            reviewedCurrent: 112,
            reviewNeeded: 0,
            stale: 0,
            missing: 268,
            completionPercentage: 29.5,
          },
          {
            locale: "zh-tw",
            totalPublic: 380,
            reviewedCurrent: 380,
            reviewNeeded: 0,
            stale: 0,
            missing: 0,
            completionPercentage: 100,
          },
        ]}
      />,
    );

    expect(html).toContain("전체 공개");
    expect(html).toContain("검수 완료·최신");
    expect(html).toContain("검토 필요");
    expect(html).toContain("원문 변경");
    expect(html).toContain("누락");
    expect(html).toContain("완료율");
    expect(html).toContain("25.3%");
    expect(html).toContain('href="/admin/translations?locale=en&amp;status=machine"');
    expect(html).toContain('aria-label="English 검토 필요 12건 보기"');
    expect(html).toContain('href="/admin/translations?locale=en&amp;status=stale"');
    expect(html).toContain('aria-label="English 원문 변경 4건 보기"');
    expect(html).toContain('href="/admin/translations?locale=en"');
    expect(html).toContain('aria-label="English 누락 번역 268건 작업 열기"');
    expect(html).toContain('href="/admin/translations?locale=ja"');
    expect(html).toContain('aria-label="日本語 누락 번역 268건 작업 열기"');
    expect(html).not.toContain('href="/admin/translations?locale=zh-tw"');
    expect(html).toContain("누락 행은 오프라인에서 번역 초안을 생성한 뒤 사람의 검토를 거쳐야 합니다.");
  });

  it("shows an unavailable state instead of pretending the catalog is empty", () => {
    const html = renderToStaticMarkup(<TranslationCoveragePanel rows={[]} error="database unavailable" />);

    expect(html).toContain("번역 현황을 불러오지 못했어요");
    expect(html).toContain("0건으로 간주하지 않았습니다");
    expect(html).not.toContain("표시할 로케일별 번역 현황이 없어요");
  });
});
