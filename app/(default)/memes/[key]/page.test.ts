import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/(default)/memes/[key]/page.tsx"),
  "utf-8",
);

describe("밈 상세 hreflang 계약", () => {
  it("카탈로그 오류와 편집 카드는 없는 문서로 처리하지 않는다", () => {
    expect(source).toContain('if (resolved.kind === "curated") return <CuratedMemeArticle');
    expect(source).toContain('if (resolved.kind === "unavailable") return <MemeCatalogUnavailable');
    expect(source.indexOf('if (resolved.kind === "unavailable")')).toBeLessThan(
      source.indexOf("if (!meme) notFound();"),
    );
  });

  it("존재하는 short-only·오래된 slug 별칭은 저장된 canonical 경로로 영구 이동한다", () => {
    expect(source).toContain('import { notFound, permanentRedirect } from "next/navigation";');
    expect(source).toContain("canonicalMemeRedirectPath(key");
    expect(source).toContain("if (redirectPath) permanentRedirect(redirectPath);");
    expect(source.indexOf("if (!meme) notFound();")).toBeLessThan(
      source.indexOf("canonicalMemeRedirectPath(key"),
    );
  });

  it("x-default는 en 번역이 있으면 영어 문서, 없으면 ko 원문을 가리킨다", () => {
    expect(source).toContain('"x-default": hreflangs.en ?? path');
  });

  it("canonical은 ko 원문 경로를 유지한다", () => {
    expect(source).toContain("alternates: { canonical: path, languages }");
  });

  it("동적 상세 metadata는 production 사이트 기준 URL을 가진다", () => {
    expect(source).toContain("metadataBase: new URL(SITE_URL)");
  });

  it("한국어 상세는 언어별 번역 데스크 대신 접두사 없는 Plus 요금 링크만 둔다", () => {
    expect(source).toContain('href="/pricing"');
    expect(source).toContain("plus-pricing-title");
    expect(source).toContain('item.label === "광고 없는 경험"');
    expect(source).toContain("{feature.label}");
    expect(source).toContain("{feature.detail}");
    expect(source).toContain("PREMIUM_COPY.ko.dashboard.viewPlans");
    expect(source).not.toContain("TranslationPriorityButton");
    expect(source).not.toContain("global-translation-title");
    expect(source).not.toContain('href="/en/pricing"');
    expect(source).not.toContain('href="/ja/pricing"');
    expect(source).not.toContain('href="/zh/pricing"');
    expect(source).not.toContain('href="/zh-tw/pricing"');

    const rail = source.indexOf('data-plus-pricing-slot="rail"');
    const sources = source.indexOf("<SourceEvidence");
    const afterSources = source.indexOf('data-plus-pricing-slot="after-sources"');
    const related = source.indexOf("<ContinueStream");
    expect(source.slice(rail - 40, rail)).toContain("hidden lg:block");
    expect(source.slice(afterSources - 24, afterSources)).toContain("lg:hidden");
    expect(rail).toBeGreaterThan(-1);
    expect(afterSources).toBeGreaterThan(sources);
    // #65 moves ContinueStream into the reading order (after origin, before sources).
    // #67 still places the mobile Plus card immediately after SourceEvidence.
    expect(related).toBeGreaterThan(-1);
    expect(related).toBeLessThan(sources);
  });

  it("모바일 첫 화면 CTA는 대표 콘텐츠보다 앞의 정답 카드에 한 번만 둔다", () => {
    const answerCard = source.indexOf("<AnswerCard meme={meme} saveMemeId={meme.id} />");
    const shareButton = source.indexOf('<ShareButton path={path} title={meme.title} label="공유" />');
    const representativeContent = source.indexOf("<MemeEmbed", answerCard);

    expect(answerCard).toBeGreaterThan(-1);
    expect(shareButton).toBeGreaterThan(answerCard);
    expect(shareButton).toBeLessThan(representativeContent);
    expect(answerCard).toBeLessThan(representativeContent);
    expect(source.match(/saveMemeId=\{meme\.id\}/g)).toHaveLength(1);
    expect(source.match(/<ShareButton path=\{path\}/g)).toHaveLength(1);
  });

  it("무료 뜻·유래·기본 안전성은 Plus 잠금 밖에 둔다", () => {
    const answerCard = source.indexOf("<AnswerCard meme={meme}");
    const description = source.indexOf("{meme.description && (");
    const origin = source.indexOf("{(meme.origin || isHouseOriginal(meme.origin_kind)) && (");
    const useKit = source.indexOf("<MemeUseKit");

    expect(answerCard).toBeGreaterThan(-1);
    expect(description).toBeGreaterThan(answerCard);
    expect(origin).toBeGreaterThan(description);
    expect(useKit).toBeGreaterThan(origin);
  });

  it("WebPage에는 실제 게시일과 화면에 표시되는 저장 출처만 전달하고 DB 생성일은 대체값으로 쓰지 않는다", () => {
    expect(source).toContain("datePublished={meme.published_at}");
    expect(source).toContain("sources={meme.meme_sources}");
    expect(source).not.toContain("datePublished={meme.published_at ?? meme.created_at}");
  });

  it("원본 업로드 시각이 없는 대표 영상에는 VideoObject를 만들지 않는다", () => {
    expect(source).not.toContain("<MemeVideoJsonLd");
    expect(source).not.toContain("uploadDate={meme.created_at}");
  });
});
