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

  it("한국어 상세에는 Plus 요금·사용 키트·미터링 게이트·후원 카드가 없다", () => {
    expect(source).not.toContain("/pricing");
    expect(source).not.toContain("data-plus-pricing-slot");
    expect(source).not.toContain("PlusPricingHashScroll");
    expect(source).not.toContain("PREMIUM_COPY");
    expect(source).not.toContain("<MemeUseKit");
    expect(source).not.toContain("<MemeTrendPanel");
    expect(source).not.toContain("<MeteredGate");
    expect(source).not.toContain("<DonateCard");
    expect(source).not.toContain("TranslationPriorityButton");
    expect(source).toContain("usageRegionLabelledBy");
    expect(source).not.toContain('aria-labelledby="meme-usage"');

    const sources = source.indexOf("<SourceEvidence");
    const related = source.indexOf("<ContinueStream");
    // #65 moves ContinueStream into the reading order (after origin, before sources).
    expect(related).toBeGreaterThan(-1);
    expect(related).toBeLessThan(sources);

    const railStart = source.indexOf("왼쪽 레일");
    const column = source.slice(railStart, source.indexOf("<MemeEmbed", railStart));
    expect(column).toContain('className="space-y-4"');
    expect(column).not.toContain("sticky");
  });

  it("모바일 첫 화면 CTA는 대표 콘텐츠보다 앞의 정답 카드에 한 번만 둔다", () => {
    const answerCard = source.indexOf("<AnswerCard meme={meme} saveMemeId={meme.id}");
    const shareButton = source.indexOf('<ShareButton path={path} title={meme.title} label="공유" />');
    const representativeContent = source.indexOf("<MemeEmbed", answerCard);

    expect(answerCard).toBeGreaterThan(-1);
    expect(shareButton).toBeGreaterThan(answerCard);
    expect(shareButton).toBeLessThan(representativeContent);
    expect(answerCard).toBeLessThan(representativeContent);
    expect(source.match(/saveMemeId=\{meme\.id\}/g)).toHaveLength(1);
    expect(source.match(/<ShareButton path=\{path\}/g)).toHaveLength(1);
  });

  it("뜻·유래·기본 안전성을 정답 카드 다음 순서로 둔다", () => {
    const answerCard = source.indexOf("<AnswerCard meme={meme}");
    const description = source.indexOf("{meme.description && (");
    const origin = source.indexOf("{(meme.origin || isHouseOriginal(meme.origin_kind)) && (");

    expect(answerCard).toBeGreaterThan(-1);
    expect(description).toBeGreaterThan(answerCard);
    expect(origin).toBeGreaterThan(description);
  });

  it("WebPage에는 실제 게시일과 화면에 표시되는 저장 출처만 전달하고 DB 생성일은 대체값으로 쓰지 않는다", () => {
    expect(source).toContain("datePublished={meme.published_at}");
    expect(source).toContain("sources={delivery.publicSources}");
    expect(source).not.toContain("datePublished={meme.published_at ?? meme.created_at}");
  });

  it("원본 업로드 시각이 없는 대표 영상에는 VideoObject를 만들지 않는다", () => {
    expect(source).not.toContain("<MemeVideoJsonLd");
    expect(source).not.toContain("uploadDate={meme.created_at}");
  });

  it("검수된 미디어 원장으로 임베드와 공개 출처를 함께 제한한다", () => {
    expect(source).toContain("getReviewedMemeMediaSources(meme.id)");
    expect(source).toContain("reviewedMediaSources,");
    expect(source).toContain("embeddingAllowed={delivery.embeddingAllowed}");
    expect(source).toContain("sources={delivery.publicSources}");
    expect(source).not.toContain("<SourceEvidence sources={meme.meme_sources}");
  });

  it("관련 소셜 임베드는 원본 목록이 아니라 정책 필터 결과만 사용한다", () => {
    expect(source).toContain("const relatedSocialContents = delivery.embeddableContents");
    expect(source).toContain("socialVideoPreview([content]) !== null");
    expect(source).not.toContain("meme.meme_contents.filter(isRenderableContent)");
  });
});
