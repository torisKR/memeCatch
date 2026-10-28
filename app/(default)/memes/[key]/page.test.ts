import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/(default)/memes/[key]/page.tsx"),
  "utf-8",
);

describe("밈 상세 hreflang 계약", () => {
  it("공개 제작 배경 제목은 관리자 입력 라벨과 분리한다", () => {
    expect(source).toContain("publicOriginSectionHeading(meme.origin_kind)");
    expect(source).not.toContain("{originSectionHeading(meme.origin_kind)}");
  });
  it("short-only 경로만 현재 canonical slug로 임시 이동한다", () => {
    expect(source).toContain('import { notFound, redirect } from "next/navigation";');
    expect(source).toContain("canonicalMemeRedirectPath(key");
    expect(source).toContain("if (redirectPath) redirect(redirectPath);");
    expect(source.indexOf("if (!meme) notFound();")).toBeLessThan(
      source.indexOf("canonicalMemeRedirectPath(key"),
    );
  });

  it("x-default는 번역 유무와 무관하게 ko 원문을 가리킨다", () => {
    expect(source).toContain('["x-default", path]');
    expect(source).not.toContain('"x-default": hreflangs.en ?? path');
  });

  it("canonical은 ko 원문 경로를 유지한다", () => {
    expect(source).toContain("alternates: { canonical: path, ...(isPageIndexable ? { languages } : {}) }");
  });

  it("동적 상세 metadata는 production 사이트 기준 URL을 가진다", () => {
    expect(source).toContain("metadataBase: new URL(SITE_URL)");
  });

  it("언어별 canonical 검증은 유지하되 상세 본문에서 Plus 번역 홍보를 반복하지 않는다", () => {
    expect(source).not.toContain("<TranslationPriorityButton");
    expect(source).not.toContain("global-translation-title");
    expect(source).toContain("getAvailableTranslationLocales(memeId)");
  });

  it("모바일 첫 화면 CTA는 대표 콘텐츠보다 앞의 정답 카드에 한 번만 둔다", () => {
    const answerCard = source.indexOf("<AnswerCard meme={answerCardMeme} saveMemeId={meme.id}");
    const shareButton = source.indexOf('<ShareButton path={path} title={meme.title} label="공유" />');
    const representativeContent = source.indexOf("<MemeEmbed", answerCard);

    expect(answerCard).toBeGreaterThan(-1);
    expect(shareButton).toBeGreaterThan(answerCard);
    expect(shareButton).toBeLessThan(representativeContent);
    expect(answerCard).toBeLessThan(representativeContent);
    expect(source.match(/saveMemeId=\{meme\.id\}/g)).toHaveLength(1);
    expect(source.match(/<ShareButton path=\{path\}/g)).toHaveLength(1);
    expect(source).toContain('actions={<ShareButton path={path} title={meme.title} label="공유" />}');
  });

  it("뜻·유래는 무료 펼침으로 보존하고 본문에서 유료·후원·로그인 안내를 제거한다", () => {
    const answerCard = source.indexOf("<AnswerCard meme={answerCardMeme}");
    const description = source.indexOf("{readerDescription && (");
    const origin = source.indexOf("{(meme.origin || isHouseOriginal(meme.origin_kind)) && (");

    expect(answerCard).toBeGreaterThan(-1);
    expect(description).toBeGreaterThan(answerCard);
    expect(origin).toBeGreaterThan(description);
    expect(source).toContain("{aboutSectionHeading(meme.origin_kind)}");
    expect(source).toMatch(/<details\s+id="meme-story"/);
    for (const promotion of ["<MemeUseKit", "<MemeTrendPanel", "<DonateCard", "<AuthInvite", "<MeteredGate"]) {
      expect(source).not.toContain(promotion);
    }
  });

  it("상세 끝에는 관련 밈 4개만 두고 무한 스트림으로 문서를 늘리지 않는다", () => {
    expect(source).toContain('aria-labelledby="related-memes-title"');
    expect(source).toContain('<TrackedBlock event="next_meme_click"');
    expect(source).not.toContain("<ContinueStream");
  });

  it("WebPage에는 실제 게시일과 화면에 표시되는 저장 출처만 전달하고 DB 생성일은 대체값으로 쓰지 않는다", () => {
    expect(source).toContain("datePublished={meme.published_at}");
    expect(source).toContain("sources={originalSources}");
    expect(source).toContain("getPublicMemeMedia(meme.meme_sources, meme.meme_contents)");
    expect(source).toContain("contents: publicMedia.contents,");
    expect(source).toContain("sources: publicMedia.sources,");
    expect(source).toContain("const originalSources = [...delivery.originalSources];");
    expect(source).toContain("resolveMemeDelivery({");
    expect(source).not.toContain("datePublished={meme.published_at ?? meme.created_at}");
  });

  it("독자 설명과 WebPage 구조화 데이터는 같은 공개 설명 투영을 사용한다", () => {
    expect(source).toContain("const readerDescription = publicReaderDescription(meme.description);");
    expect(source).toContain("description={readerDescription}");
    expect(source).toContain("{readerDescription && (");
    expect(source).toContain("{readerDescription}</p>");
  });

  it("related social content reuses the same unavailable-resource filter as the representative", () => {
    expect(source).toContain("const liveContents = delivery.renderableContents;");
    expect(source).not.toContain("meme.meme_contents.filter(isRenderableContent)");
  });

  it("클라이언트 정답 카드에는 명시적인 공개 필드만 전달한다", () => {
    expect(source).toContain("const answerCardMeme = publicAnswerCardMeme(meme);");
    expect(source).toContain("<AnswerCard meme={answerCardMeme}");
    expect(source).not.toContain("<AnswerCard meme={meme}");
    expect(source).toContain("content={publicMemeEmbedContent(representative)}");
    expect(source).toContain("content={publicMemeEmbedContent(content)}");
    expect(source).not.toContain("content={representative}");
    expect(source).not.toContain("content={content}");
  });

  it("metadata와 본문 색인·광고·상태는 같은 공개 미디어만 집계한다", () => {
    expect(source.match(/const publicDepthInput = publicEditorialEligibilityInput\(\{/g)).toHaveLength(2);
    expect(source.match(/isIndexableMeme\(publicDepthInput\)/g)).toHaveLength(3);
    expect(source).toContain("originalSources: delivery.originalSources,");
    expect(source).toContain("renderableContents: delivery.renderableContents,");
    expect(source).toContain("isAdsenseContentEligible(publicDepthInput)");
    expect(source).toContain("<DocStatusNote meme={publicDepthInput}");
    expect(source).not.toContain("isIndexableMeme(meme)");
    expect(source).not.toContain("isAdsenseContentEligible(meme)");
    expect(source).not.toContain("<DocStatusNote meme={meme}");
  });

  it("metadata와 본문은 요청 내 공개 미디어 조회를 공유하고 독립 작업을 함께 시작한다", () => {
    expect(source).toContain("getPublicMemeMedia(");
    expect(source).not.toContain("await filterPublicMemeMedia({");
    expect(source).toContain("const [localizedVersions, publicMedia] = await Promise.all([");
    expect(source).toContain("const [publicMedia, related, reactionCounts, producedVideos, externalTrendEvidence] = await Promise.all([");
  });

  it("원본 업로드 시각이 없는 대표 영상에는 VideoObject를 만들지 않는다", () => {
    expect(source).not.toContain("<MemeVideoJsonLd");
    expect(source).not.toContain("uploadDate={meme.created_at}");
  });

  it("검증된 자체 영상 섹션에만 색인 가능한 상세 경로를 전달한다", () => {
    expect(source).toContain("getPublicMemeProducedVideos(meme.id)");
    expect(source).toContain("<MemeProducedVideos videos={producedVideos}");
    expect(source).toContain("structuredDataPath={isIndexableMeme(publicDepthInput) ? path : undefined}");
  });

  it("JSON-LD와 동일한 홈·분류·현재 항목의 이동 경로를 화면에도 표시한다", () => {
    expect(source).toContain('aria-label="이동 경로"');
    expect(source).toContain('href={`/explore?category=${resolveDisplayCategory(meme.category)}`}');
    expect(source).toContain("{DISPLAY_CATEGORIES[resolveDisplayCategory(meme.category)].user}");
    expect(source).toContain('<span aria-current="page">{meme.title}</span>');
  });
});
