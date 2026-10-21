import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import PrivacyPage, { metadata } from "./page";

describe("PrivacyPage", () => {
  it("does not claim that search questions are sent through the retired AI Gateway", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);

    expect(html).not.toContain("AI 검색 의도 분류 보충 안내");
    expect(html).not.toContain("Vercel AI Gateway");
    expect(html).not.toContain("Boundless");
    expect(html).not.toContain("AI 검색 의도 분류(선택)");
    expect(html).not.toContain("검색 의도 분류 요청 전달");
  });

  it("discloses the limited raw YouTube API collection and retention", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);

    expect(html).toContain("YouTube API 서비스 보충 안내 (2026년 10월 14일)");
    expect(html).toContain("YouTube API Services(YouTube API 서비스)를 사용해");
    expect(html).toContain("공개 영상 후보의 영상 ID·URL");
    expect(html).toContain("운영자 검수용으로만 수집");
    expect(html).toContain("밈 문서나 트렌드 순위에 자동 공개하지 않습니다");
    expect(html).toContain("30일 이내에 갱신하거나 삭제");
    expect(html).toContain("재생 시간");
    expect(html).toContain("검수 근거에서 제외합니다");
    expect(html).not.toContain("보관 대상에서 제외합니다");
    expect(html).toContain("YouTube 계정 OAuth 정보·비공개 시청 기록을 수집하지 않고");
    expect(html).toContain("영상·음성 파일을 다운로드하거나 재업로드하지 않습니다");
    expect(html).not.toContain("YouTube 계정을 연결하면");
    expect(html).not.toContain("YouTube에 업로드할 수 있습니다");
  });

  it("links Google's privacy policy without changing the existing policy date", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);

    expect(html).toMatch(
      /href="https:\/\/policies\.google\.com\/privacy" target="_blank" rel="noopener noreferrer"/,
    );
    expect(html).toContain("시행일: 2026년 8월 18일");
    expect(html).toContain("변경되는 경우 시행 7일 전 사이트 공지");
    expect(metadata.alternates).toEqual({ canonical: "/privacy" });
  });
});
