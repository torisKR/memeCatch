// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TrustNote } from "./trust-note";

const base = {
  updatedAt: "2026-07-15T00:00:00.000Z",
  moderationStatus: "approved",
  title: "테스트 밈",
};

describe("TrustNote", () => {
  it("근거 출처가 없으면 검수 완료를 주장하지 않는다", () => {
    const html = renderToStaticMarkup(<TrustNote {...base} sources={[]} />);

    // DQ-001의 핵심 — 공개 문서 1,330건이 근거 없이 검수를 주장하고 있었다.
    expect(html).not.toContain("검수팀 확인");
    expect(html).toContain("근거 출처 준비 중");
    expect(html).toContain("출처를 아시면 알려 주세요");
    expect(html).toContain("/submit?name=");
  });

  it("URL이 공백뿐인 출처는 근거로 세지 않는다", () => {
    const html = renderToStaticMarkup(
      <TrustNote {...base} sources={[{ source_url: "   ", platform: "web" }]} />
    );

    expect(html).toContain("근거 출처 준비 중");
  });

  it("맥락 위키만 있으면 원본 미확인 상태를 밝힌다", () => {
    const html = renderToStaticMarkup(
      <TrustNote
        {...base}
        sources={[{ source_url: "https://namu.wiki/w/test", platform: "web" }]}
      />
    );

    expect(html).toContain("맥락 출처 1개로 확인");
    expect(html).toContain("원본은 아직 찾는 중");
    expect(html).not.toContain("검수팀 확인");
  });

  it("원본 출처가 있으면 확인한 근거 수를 센다", () => {
    const html = renderToStaticMarkup(
      <TrustNote
        {...base}
        sources={[
          { source_url: "https://www.youtube.com/watch?v=a", platform: "YouTube" },
          { source_url: "https://news.example.com/b", platform: "web" },
        ]}
      />
    );

    expect(html).toContain("근거 출처 2개 확인");
    expect(html).not.toContain("원본은 아직 찾는 중");
  });

  it("원본과 맥락이 섞이면 원본 개수를 따로 밝힌다", () => {
    const html = renderToStaticMarkup(
      <TrustNote
        {...base}
        sources={[
          { source_url: "https://www.youtube.com/watch?v=a", platform: "YouTube" },
          { source_url: "https://namu.wiki/w/test", platform: "web" },
        ]}
      />
    );

    expect(html).toContain("근거 출처 2개 확인");
    expect(html).toContain("원본·보도 1개");
  });

  it("limited 문서는 출처 확인 중임을 함께 알린다", () => {
    const html = renderToStaticMarkup(
      <TrustNote
        {...base}
        moderationStatus="limited"
        sources={[{ source_url: "https://news.example.com/b", platform: "web" }]}
      />
    );

    expect(html).toContain("출처 확인 중인 문서예요");
  });

  it("마지막 업데이트는 기계 판독 가능한 datetime을 함께 남긴다", () => {
    const html = renderToStaticMarkup(
      <TrustNote
        {...base}
        sources={[{ source_url: "https://news.example.com/b", platform: "web" }]}
      />
    );

    expect(html).toMatch(/<time [^>]*="2026-07-15T00:00:00\.000Z"/i);
    expect(html).toContain("2026년 7월 15일");
  });
});
