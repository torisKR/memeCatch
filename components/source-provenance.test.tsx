// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SourceEvidence } from "./source-evidence";
import { TrustNote } from "./trust-note";
import { MemeWebPageJsonLd } from "./json-ld";

const source = { source_url: "https://news.example.com/a", title: "An article", captured_at: "2026-07-01T12:00:00Z" };
const base = { updatedAt: "2026-07-01T12:00:00Z", moderationStatus: "approved", title: "A meme", shortId: "abcd1234" };

describe("truthful visible provenance", () => {
  it("labels captured_at as a collection date without inventing a connection or verification date", () => {
    const html = renderToStaticMarkup(<SourceEvidence sources={[source]} shortId="abcd1234" />);
    expect(html).toContain("자료 수집일");
    expect(html).toContain("2026년 7월 1일");
    expect(html).not.toContain("연결일");
    expect(html).not.toContain("독립적인 사실 검증");
    expect(html).not.toContain("아래 자료를 확인해 뜻·유래를 정리했어요");
  });
  it("does not certify non-wiki sources just because they have titles", () => {
    const html = renderToStaticMarkup(<TrustNote {...base} sources={[source, { source_url: "https://namu.wiki/w/example", title: "Context" }]} />);
    expect(html).toContain("근거 링크 2개 연결");
    expect(html).not.toContain("원본·보도 1개");
    expect(html).not.toContain("근거 출처 2개 확인");
  });
  it("does not render an invented or invalid update date", () => {
    const html = renderToStaticMarkup(<TrustNote {...base} updatedAt="not-a-date" sources={[]} />);
    expect(html).not.toContain("Invalid Date");
    expect(html).not.toContain("<time");
    expect(html).toContain("기록 미확인");
  });
  it("emits only the same citable public URLs and valid stored dates in JSON-LD", () => {
    const html = renderToStaticMarkup(<MemeWebPageJsonLd name="A meme" summary="Meaning" description="Full explanation" shortId="abcd1234" slug="test" datePublished="not-a-date" dateModified="2099-01-01T00:00:00Z" {...{ sources: [source, { source_url: "javascript:alert(1)", title: "Bad" }, { source_url: "https://example.com/untitled", title: null }] }} />);
    const data = JSON.parse(html.match(/<script[^>]*>([\s\S]+)<\/script>/)![1]);
    expect(data.citation).toEqual([source.source_url]);
    expect(data).not.toHaveProperty("datePublished");
    expect(data).not.toHaveProperty("dateModified");
  });
});
