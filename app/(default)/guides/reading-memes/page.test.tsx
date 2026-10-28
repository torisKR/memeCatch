// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ReadingMemesGuidePage, { metadata } from "./page";
import { SITE_URL } from "@/lib/site";
import { OrganizationJsonLd } from "@/components/json-ld";

describe("ReadingMemesGuidePage", () => {
  it("separates source roles and gives three authored hypothetical examples", () => {
    const html = renderToStaticMarkup(<ReadingMemesGuidePage />);

    for (const label of [
      "원본 또는 최초 확인 자료",
      "재게시물과 2차 사용",
      "설명 자료",
      "밈캐치 자체 제작",
    ]) {
      expect(html).toContain(label);
    }
    expect(html.match(/밈캐치 편집 예시\(가상\)/g)).toHaveLength(3);
    expect(html).toContain("상대:");
    expect(html).toContain("장소:");
    expect(html).toContain("말투:");
    expect(html).toContain("권리:");
  });

  it("uses the checked Saebbing sources without claiming an absolute origin", () => {
    const html = renderToStaticMarkup(<ReadingMemesGuidePage />);

    expect(html).toContain("https://www.youtube.com/watch?v=JnQu_5O4lh4");
    expect(html).toContain("https://cjnews.cj.net/?p=32515");
    expect(html).toContain("/memes/89b37mrx-%EC%83%88%EC%82%A5%20%EC%B1%8C%EB%A6%B0%EC%A7%80%20(%EC%A7%80%EC%BD%94)");
    expect(html).toContain("인터넷 전체의 최초 게시물이라는 결론까지 내릴 수는 없습니다");
    expect(html).toContain("밈캐치 편집");
    expect(html).toContain('dateTime="2026-10-12T18:34:36+09:00"');
  });

  it("publishes canonical metadata for the guide", () => {
    expect(metadata.alternates).toEqual({ canonical: "/guides/reading-memes" });
    expect(metadata.title).toBe("밈의 원본과 사용 맥락을 확인하는 방법");
  });

  it("matches Article fields and breadcrumbs to the visible guide without invented evidence", () => {
    const html = renderToStaticMarkup(<ReadingMemesGuidePage />);
    const doc = new DOMParser().parseFromString(html, "text/html");
    const data = JSON.parse(doc.querySelector('script[type="application/ld+json"]')!.textContent!);
    const article = data["@graph"].find((node: Record<string, unknown>) => node["@type"] === "Article");
    const page = data["@graph"].find((node: Record<string, unknown>) => node["@type"] === "WebPage");
    const breadcrumb = data["@graph"].find((node: Record<string, unknown>) => node["@type"] === "BreadcrumbList");
    const url = `${SITE_URL}/guides/reading-memes`;

    expect(article.headline).toBe(doc.querySelector("h1")!.textContent);
    expect(article.description).toBe(metadata.description);
    expect(article.datePublished).toBe(doc.querySelector("time")!.getAttribute("datetime"));
    expect(article.author).toMatchObject({ "@type": "Organization", "@id": `${SITE_URL}#org`, name: "밈캐치", url: SITE_URL });
    const organizationDoc = new DOMParser().parseFromString(renderToStaticMarkup(<OrganizationJsonLd />), "text/html");
    const organization = JSON.parse(organizationDoc.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(article.author["@id"]).toBe(organization["@id"]);
    expect(article.author.url).toBe(organization.url);
    expect(doc.querySelector('article a[href="/about"]')!.textContent).toBe(article.author.name);
    expect(article).not.toHaveProperty("image");
    expect(article).not.toHaveProperty("dateModified");
    expect(article).not.toHaveProperty("video");
    expect(article.mainEntityOfPage).toEqual({ "@id": url });
    expect(page.mainEntity).toEqual({ "@id": article["@id"] });
    expect(page.breadcrumb).toEqual({ "@id": breadcrumb["@id"] });
    const visibleLinks = Array.from(doc.querySelectorAll("article a[href]"), (link) => new URL(link.getAttribute("href")!, SITE_URL).href);
    for (const citation of article.citation) expect(visibleLinks).toContain(citation);
    const visibleCrumbs = Array.from(doc.querySelectorAll('nav[aria-label="이동 경로"] a, nav[aria-label="이동 경로"] [aria-current="page"]'), (item) => item.textContent);
    expect(breadcrumb.itemListElement.map((item: { name: string }) => item.name)).toEqual(visibleCrumbs);
    expect(breadcrumb.itemListElement.map((item: { position: number }) => item.position)).toEqual([1, 2]);
  });
});
