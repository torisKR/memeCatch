import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/(default)/memes/[key]/page.tsx"),
  "utf-8",
);

describe("밈 상세 hreflang 계약", () => {
  it("x-default는 en 번역이 있으면 영어 문서, 없으면 ko 원문을 가리킨다", () => {
    expect(source).toContain('"x-default": hreflangs.en ?? path');
  });

  it("canonical은 ko 원문 경로를 유지한다", () => {
    expect(source).toContain("alternates: { canonical: path, languages }");
  });

  it("동적 상세 metadata는 production 사이트 기준 URL을 가진다", () => {
    expect(source).toContain("metadataBase: new URL(SITE_URL)");
  });

  it("검수 완료 번역이 없는 글로벌 언어에는 Plus 번역 요청 진입을 제공한다", () => {
    expect(source).toContain("const missingTranslationLocales = SEO_CONTENT_LOCALES.filter");
    expect(source).toContain('translationStatus="missing"');
    expect(source).toContain("global-translation-title");
    expect(source).toContain("getAvailableTranslationLocales(meme.id)");
  });
});
