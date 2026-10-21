import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TermsPage, { metadata } from "./page";

describe("TermsPage", () => {
  it("does not advertise the retired AI Gateway routing feature", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).not.toContain("AI 검색 의도 분류 보충 안내");
    expect(html).not.toContain("Vercel AI Gateway");
    expect(html).not.toContain("Boundless");
  });

  it("states the supplemental YouTube terms without implying automatic publication", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toContain("YouTube API 서비스 보충 안내 (2026년 10월 14일)");
    expect(html).toContain("YouTube 출처 확인·공식 플레이어 기능");
    expect(html).toContain("YouTube API Services(YouTube API 서비스)를 사용합니다");
    expect(html).toMatch(
      /href="https:\/\/www\.youtube\.com\/t\/terms" target="_blank" rel="noopener noreferrer"/,
    );
    expect(html).toContain("해당 기능을 이용하면");
    expect(html).toContain("YouTube 이용약관");
    expect(html).toContain("운영자 검수 전에는 밈 문서나 트렌드 순위에 자동 공개되지 않습니다");
    expect(html).not.toContain("YouTube 계정을 연결하면");
    expect(html).not.toContain("YouTube에 업로드할 수 있습니다");
  });

  it("preserves the existing effective date, member rights, and canonical route", () => {
    const html = renderToStaticMarkup(<TermsPage />);

    expect(html).toContain("시행일: 2026년 8월 18일");
    expect(html).toContain("회원은 언제든지 탈퇴할 수 있으며");
    expect(html).toContain("저작권은 작성자에게 있습니다");
    expect(html).toContain("고의·중과실이 없는 한 책임지지 않습니다");
    expect(html).toContain("변경 시 시행 7일 전 공지합니다");
    expect(metadata.alternates).toEqual({ canonical: "/terms" });
  });
});
