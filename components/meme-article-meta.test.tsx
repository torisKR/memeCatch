import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CuratedMemeArticle } from "@/components/curated-meme-article";
import { MemeArticleArt, MemeArticleFooter, MemeByline } from "@/components/meme-article-meta";
import { RelatedMemeLinks } from "@/components/related-meme-links";
import { CURATED_CORE_MEMES } from "@/lib/curated-memes";

describe("meme article readability", () => {
  it("puts the byline under the title and links the author to the editorial policy", () => {
    const html = renderToStaticMarkup(<MemeByline updatedAt="2026-11-11T02:00:00.000Z" />);
    expect(html).toContain("작성 toris");
    expect(html).toContain('href="/editorial"');
    expect(html).toContain("최종 수정");
    expect(html).toContain("2026-11-11");
  });

  it("keeps the editorial policy link when the article has no revision timestamp", () => {
    const html = renderToStaticMarkup(<MemeByline />);
    expect(html).toContain("작성 toris");
    expect(html).toContain("최종 수정일");
  });

  it("links every article footer to the editorial policy", () => {
    const html = renderToStaticMarkup(<MemeArticleFooter />);
    expect(html).toContain("편집 방침");
    expect(html).toContain('href="/editorial"');
  });

  it("drops the repeating title card when there is no real illustration", () => {
    const html = renderToStaticMarkup(<MemeArticleArt title="중꺾마" artUrl={null} />);
    expect(html).toBe("");
  });

  it("shows a last-reviewed date only when one is provided", () => {
    const html = renderToStaticMarkup(
      <MemeByline updatedAt="2026-11-11T02:00:00.000Z" reviewedAt="2026-11-11T02:00:00.000Z" />,
    );
    expect(html).toContain("최종 검토일");
    expect(html).toContain("2026년 11월 11일");
    const hidden = renderToStaticMarkup(<MemeByline updatedAt="2026-11-11T02:00:00.000Z" />);
    expect(hidden).not.toContain("최종 검토일");
  });

  it("hides the related heading until there are at least two links and stops at six", () => {
    const few = renderToStaticMarkup(
      <RelatedMemeLinks items={[{ href: "/memes/a", title: "하나" }]} />,
    );
    expect(few).toBe("");
    const pair = renderToStaticMarkup(
      <RelatedMemeLinks
        items={[
          { href: "/memes/a", title: "하나" },
          { href: "/memes/b", title: "둘" },
        ]}
      />,
    );
    expect(pair).toContain("관련 밈");
    expect(pair).toContain("둘");

    const many = Array.from({ length: 8 }, (_, index) => ({
      href: `/memes/item-${index}`,
      title: `밈 ${index}`,
      summary: `요약 ${index}`,
    }));
    const html = renderToStaticMarkup(<RelatedMemeLinks items={many} />);
    expect(html).toContain("관련 밈");
    expect(html.match(/href="\/memes\/item-/g)).toHaveLength(6);
    expect(html).not.toContain("밈 6");
  });

  it("renders a readable curated article without an empty section or a duplicate title card", () => {
    const meme = {
      ...CURATED_CORE_MEMES[0],
      caution: null,
      usage_examples: [],
    };
    const html = renderToStaticMarkup(<CuratedMemeArticle meme={meme} />);
    expect(html).toContain("<h1");
    expect(html).toContain(meme.title);
    expect(html).toContain("작성 toris");
    expect(html).toContain("max-w-[680px]");
    expect(html).toContain("text-[17px]");
    expect(html).toContain("leading-[1.75]");
    expect(html).toContain("어디서 쓸까");
    expect(html).toContain("직장");
    expect(html).toContain("편집 방침");
    expect(html).not.toContain("관련 밈");
    expect(html).not.toContain(">주의<");
    expect(html).not.toContain("이렇게 써요");
    expect(html).not.toContain("<img");
  });
});
