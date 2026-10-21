import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "app/[locale]/memes/[key]/page.tsx"),
  "utf-8",
);

describe("localized meme detail metadata", () => {
  it("temporarily redirects only short-id routes to the current localized canonical slug", () => {
    expect(source).toContain('import { notFound, redirect } from "next/navigation";');
    expect(source).toContain("canonicalMemeRedirectPath(key");
    expect(source).toContain("if (redirectPath) redirect(redirectPath);");
    expect(source.indexOf("if (!meme) notFound();")).toBeLessThan(
      source.indexOf("canonicalMemeRedirectPath(key"),
    );
  });

  it("uses the Korean source as x-default and advertises alternates only for an indexable page", () => {
    expect(source).toContain('["x-default", koreanPath]');
    expect(source).toContain("...(isPageIndexable ? { languages } : {})");
    expect(source).not.toContain("const englishVersion = indexableVersions.find");
  });

  it("turns a missing localized meme into a not-found result", () => {
    expect(source).toContain("if (!meme) notFound();");
  });

  it("keeps only the core save and reviewed-share actions in the default flow", () => {
    expect(source).toContain("<SaveButton memeId={meme.id} compact />");
    expect(source).toContain("<ShareButton");
    expect(source).not.toContain("TranslationPriorityButton");
    expect(source).not.toContain("ExportButton");
    expect(source).not.toContain("MemeUseKit");
    expect(source).not.toContain("MemeTrendPanel");
  });

  it("offers the localized canonical share action only after editorial review", () => {
    expect(source).toContain('import { ShareButton } from "@/components/share-button";');
    expect(source).toContain("{!needsReview && (");
    expect(source).toContain("path={canonical}");
    expect(source).toContain("label={copy.share}");
    expect(source).toContain("copiedLabel={copy.shareCopied}");
    expect(source).toContain("copiedStatus={copy.shareCopiedStatus}");
    expect(source).toContain("siteName={seo.siteName}");
  });

  it("uses shared guarded JSON-LD with no database-created publication fallback", () => {
    expect(source).toContain("<MemeWebPageJsonLd");
    expect(source).toContain("datePublished={meme.published_at}");
    expect(source).toContain("dateModified={meme.translation.updatedAt}");
    expect(source).toContain("sources={sourceLinks}");
    expect(source).not.toContain("meme.published_at ?? meme.created_at");
  });

  it("uses one public reader description for localized prose and WebPage JSON-LD", () => {
    expect(source).toContain("const readerDescription = publicReaderDescription(meme.description);");
    expect(source).toContain("description: publicReaderDescription(meme.description),");
    expect(source).toContain("description={readerDescription}");
    expect(source).toContain("{(readerDescription || meme.origin) && (");
    expect(source).toContain("{readerDescription && (");
    expect(source).toContain("{readerDescription}</p>");
  });

  it("uses the same verified own-video gate with an indexable localized canonical", () => {
    expect(source).toContain("getPublicMemeProducedVideos(meme.id)");
    expect(source).toContain("<MemeProducedVideos videos={producedVideos}");
    expect(source).toContain("structuredDataPath={isPageIndexable ? canonical : undefined}");
    expect(source).not.toContain("<MemeVideoJsonLd");
  });

  it("renders only the filtered representative original as the primary media", () => {
    expect(source).toContain('import { MemeEmbed } from "@/components/meme-embed";');
    expect(source).toContain("publicMemeEmbedContent(delivery.representative)");
    expect(source).toContain("fallbackSourceUrl={delivery.fallbackSourceUrl}");
    expect(source).toContain("fallbackReason={delivery.fallbackReason}");
    expect(source).not.toContain("content={meme.meme_contents");
  });

  it("scores metadata and body eligibility from filtered public delivery only", () => {
    expect(source).toContain("function isIndexableLocalizedDelivery(");
    expect(source).toContain("meme_sources: [...delivery.originalSources]");
    expect(source).toContain("meme_contents: [...delivery.renderableContents]");
    expect(source).toContain("const [versions, publicMedia] = await Promise.all([");
    expect(source).toContain("const isPageIndexable = isIndexableLocalizedDelivery(meme, delivery);");
    expect(source).toContain("isIndexableLocalizedDelivery(version, delivery)");
    expect(source).toContain("...(isPageIndexable ? {} : { robots: { index: false, follow: true } })");
    expect(source).toContain("const needsReview = !isPageIndexable;");
    expect(source).not.toContain("const needsReview = !isIndexableLocalizedMeme(meme);");
  });

  it("shares public-media work per render and starts it with independent localized reads", () => {
    expect(source).toContain("getPublicMemeMedia(");
    expect(source).not.toContain("await filterPublicMemeMedia({");
    expect(source).toContain("const [versions, marketPassport, producedVideos, publicMedia] = await Promise.all([");
  });

  it("renders only public safe source URLs, keeping JSON-LD citations within the visible list", () => {
    expect(source).toContain("publicSourceUrl(source.source_url)");
    expect(source).toContain("source_url: url");
    expect(source).toContain("href={source.source_url}");
    expect(source).toContain("resolveMemeDelivery({");
    expect(source).toContain("getPublicMemeMedia(meme.meme_sources, meme.meme_contents)");
    expect(source).toContain("contents: publicMedia.contents,");
    expect(source).toContain("sources: publicMedia.sources,");
    expect(source).toContain("resolveMemeDelivery({");
    expect(source).toContain("delivery.originalSources.flatMap");
    expect(source).not.toContain("href={source.source_url!}");
  });

  it("renders the same localized category hierarchy as its breadcrumb markup", () => {
    expect(source).toContain('aria-label="Breadcrumb"');
    expect(source).toContain('href={localizedPath(`/explore?category=${resolveDisplayCategory(meme.category)}`, locale)}');
    expect(source).toContain("categoryName={seo.categories[meme.category]}");
    expect(source).toContain('<span aria-current="page">{meme.title}</span>');
  });

  it("keeps long evidence in native-language disclosure sections without decorative panels", () => {
    expect(source).toContain("copy.moreDetails");
    expect(source).toContain("copy.marketDetails");
    expect(source).toContain("<details");
    expect(source).not.toContain("glass-panel");
    expect(source).not.toContain("instrument-grid");
  });

  it("builds an on-page navigation from real conditional sections only", () => {
    expect(source).toContain('import { MemeDetailNavigation } from "@/components/meme-detail-navigation";');
    expect(source).toContain("const detailNavigationItems = [");
    expect(source).toContain('{ id: "meme-media", label: copy.mediaNavigation }');
    expect(source).toContain("...(meme.usage_note");
    expect(source).toContain('{ id: "meme-usage", label: copy.usageNavigation }');
    expect(source).toContain('(readerDescription || meme.origin)');
    expect(source).toContain('{ id: "meme-story", label: copy.storyNavigation }');
    expect(source).toContain("...(sourceLinks.length > 0");
    expect(source).toContain('{ id: "meme-sources", label: copy.sourcesNavigation }');
    expect(source).toContain("<MemeDetailNavigation");
    expect(source).toContain("label={copy.pageNavigation}");
    expect(source).toContain("items={detailNavigationItems}");
  });

  it("localizes the reading navigation for every supported detail locale", () => {
    expect(source).toContain('pageNavigation: "On this page"');
    expect(source).toContain('storyNavigation: "Meaning and origin"');
    expect(source).toContain('pageNavigation: "このページの内容"');
    expect(source).toContain('storyNavigation: "意味と由来"');
    expect(source).toContain('pageNavigation: "本页内容"');
    expect(source).toContain('storyNavigation: "含义与来源"');
    expect(source).toContain('pageNavigation: "本頁內容"');
    expect(source).toContain('storyNavigation: "含義與來源"');
    expect(source).toContain('readerTools: "Reader tools"');
    expect(source).toContain('readerTools: "活用ツール"');
    expect(source).toContain('readerTools: "使用工具"');
    expect(source).toContain('readerTools: "應用工具"');
  });

  it("keeps the meaning and origin narrative visible in an open native disclosure", () => {
    expect(source).toMatch(/<details\s+id="meme-story"\s+open\s+tabIndex=\{-1\}/);
    expect(source).toContain('className="scroll-mt-28 border-y border-border"');
    expect(source).toContain('<h2 id="meme-description"');
    expect(source).toContain('<h2 id="meme-origin"');
    expect(source).toContain("{readerDescription}</p>");
    expect(source).toContain("{meme.origin}</p>");
  });

  it("keeps navigation and document reading order aligned", () => {
    const navigation = source.slice(
      source.indexOf("const detailNavigationItems = ["),
      source.indexOf("];", source.indexOf("const detailNavigationItems = [")),
    );
    expect(navigation.indexOf('id: "meme-media"')).toBeLessThan(navigation.indexOf('id: "meme-usage"'));
    expect(navigation.indexOf('id: "meme-usage"')).toBeLessThan(navigation.indexOf('id: "meme-story"'));
    expect(navigation.indexOf('id: "meme-story"')).toBeLessThan(navigation.indexOf('id: "meme-sources"'));

    expect(source.indexOf('id="meme-media"')).toBeLessThan(source.indexOf('id="meme-usage"'));
    expect(source.indexOf('id="meme-usage"')).toBeLessThan(source.indexOf('id="meme-story"'));
    expect(source.indexOf('id="meme-story"')).toBeLessThan(source.indexOf('id="meme-sources"'));
  });

  it("gives media, usage, and sources stable readable targets", () => {
    expect(source).toContain('id="meme-media"');
    expect(source).toContain('aria-labelledby="meme-media-title"');
    expect(source).toContain('<h2 id="meme-media-title"');
    expect(source).toContain("{copy.originalMedia}");
    expect(source).toContain('id="meme-usage" aria-labelledby="meme-usage-title"');
    expect(source).toContain('<details id="meme-sources" open className="scroll-mt-28');
  });

  it("renders reviewed secondary-reference performances with locale-specific caveats", () => {
    expect(source).toContain("const secondaryReferenceContents = selectSecondaryReferenceContents({");
    expect(source).toContain("copy.referenceVideoTitle");
    expect(source).toContain("copy.referenceVideoBody");
    expect(source).toContain("Reviewed reference videos");
    expect(source).toContain("not evidence of the challenge's origin or independent spread");
    expect(source).toContain("理解を助ける補助資料であり");
    expect(source).toContain("这些视频是帮助理解的补充资料");
    expect(source).toContain("這些影片是幫助理解的補充資料");
  });
});
