// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemeExternalTrendEvidence } from "./meme-external-trend-evidence";

describe("MemeExternalTrendEvidence", () => {
  it("renders reviewed scope and does not claim whole-SNS popularity", () => {
    render(<MemeExternalTrendEvidence evidence={{
      memeId: "meme-1",
      href: "/memes/abc-test",
      title: "테스트",
      summary: "요약",
      state: "rising",
      reason: "지난 구간보다 서로 다른 작성자의 독립 사용례가 늘었어요.",
      evidenceScope: "TikTok 공개 URL 제보 4건",
      independentUseCount: 4,
      score: 72,
      confidence: 0.8,
      lastVerifiedAt: "2026-10-13T00:00:00.000Z",
      stale: false,
      evidenceLinks: [{ url: "https://example.com/post", label: "사용례 1" }],
    }} />);

    expect(screen.getByRole("heading", { name: "왜 지금 뜨나요?" })).toBeDefined();
    expect(screen.getByText("TikTok 공개 URL 제보 4건")).toBeDefined();
    expect(screen.getByText(/전체 인터넷이나 전체 SNS의 인기도를 뜻하지 않아요/)).toBeDefined();
  });

  it("renders nothing without an approved public projection", () => {
    const { container } = render(<MemeExternalTrendEvidence evidence={null} />);
    expect(container.innerHTML).toBe("");
  });

  it("labels stale evidence as a past observation rather than a current trend", () => {
    cleanup();
    const html = renderToStaticMarkup(<MemeExternalTrendEvidence evidence={{
      memeId: "meme-1", href: "/memes/abc-test", title: "테스트", summary: "요약",
      state: "rising", reason: "지난 관찰 구간에서 독립 사용례가 늘었어요.",
      evidenceScope: "운영자 검수 URL 3건", independentUseCount: 3,
      score: 65, confidence: 0.8, lastVerifiedAt: "2026-07-01T00:00:00.000Z",
      stale: true, evidenceLinks: [],
    }} />);

    expect(html).toContain("마지막 확산 관찰");
    expect(html).toContain("현재 확산 여부는 다시 확인해야 해요");
    expect(html).not.toContain("왜 지금 뜨나요?");
    expect(html).not.toContain(">외부 확산 상승<");
    expect(html).toContain('dateTime="2026-07-01T00:00:00.000Z"');
  });
});
