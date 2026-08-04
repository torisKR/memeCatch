import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DefinedTermSetJsonLd,
  MemeBreadcrumbJsonLd,
  MemeDefinedTermJsonLd,
  MemeWebPageJsonLd,
  WebSiteJsonLd,
} from "@/components/json-ld";
import { SITE_URL } from "@/lib/site";

function readJsonLd(element: React.ReactNode): Record<string, unknown> {
  const html = renderToStaticMarkup(element);
  const json = html.match(/<script type="application\/ld\+json">([\s\S]+)<\/script>/)?.[1];
  if (!json) throw new Error("JSON-LD script was not rendered");
  return JSON.parse(json) as Record<string, unknown>;
}

describe("localized JSON-LD", () => {
  it("keeps existing WebSite calls Korean and unprefixed", () => {
    const data = readJsonLd(<WebSiteJsonLd />);

    expect(data).toMatchObject({
      "@type": "WebSite",
      name: "밈캐치",
      url: SITE_URL,
      inLanguage: "ko",
    });
    expect(data.potentialAction).toMatchObject({
      target: { urlTemplate: `${SITE_URL}/search?q={search_term_string}` },
    });
  });

  it("localizes WebSite and DefinedTermSet identity", () => {
    const site = readJsonLd(<WebSiteJsonLd locale="en" />);
    const glossary = readJsonLd(<DefinedTermSetJsonLd locale="en" />);

    expect(site).toMatchObject({
      name: "MemeCatch",
      url: `${SITE_URL}/en`,
      inLanguage: "en",
    });
    expect(site.potentialAction).toMatchObject({
      target: { urlTemplate: `${SITE_URL}/en/search?q={search_term_string}` },
    });
    expect(glossary).toMatchObject({
      "@id": `${SITE_URL}/en#glossary`,
      name: "MemeCatch Korean Meme Dictionary",
      url: `${SITE_URL}/en`,
      inLanguage: "en",
    });
  });

  it("uses localized meme URLs and a language-stable speakable selector", () => {
    const data = readJsonLd(
      <MemeWebPageJsonLd
        locale="zh-tw"
        name="迷因名稱"
        summary="一句話說明"
        description="完整說明"
        shortId="a1b2c3"
        slug="한국-밈"
        datePublished="2026-07-01T00:00:00Z"
        dateModified="2026-07-28T00:00:00Z"
      />,
    );

    expect(data).toMatchObject({
      name: "迷因名稱",
      inLanguage: "zh-Hant",
      isPartOf: { name: "MemeCatch", url: `${SITE_URL}/zh-tw` },
      speakable: { cssSelector: ["h1", "#meme-summary"] },
      mainEntity: {
        name: "迷因名稱",
        description: "完整說明",
        inDefinedTermSet: {
          "@id": `${SITE_URL}/zh-tw#glossary`,
          name: "MemeCatch 韓國迷因辭典",
        },
      },
    });
    expect(data.url).toBe(
      `${SITE_URL}/zh-tw/memes/a1b2c3-%ED%95%9C%EA%B5%AD-%EB%B0%88`,
    );
  });

  it("renders a standalone top-level DefinedTerm using the meme summary as its definition", () => {
    const data = readJsonLd(
      <MemeDefinedTermJsonLd
        name="갑분싸"
        summary="갑자기 분위기가 싸해짐"
        shortId="a1b2c3"
        slug="갑분싸"
      />,
    );

    expect(data).toMatchObject({
      "@type": "DefinedTerm",
      name: "갑분싸",
      description: "갑자기 분위기가 싸해짐",
      inLanguage: "ko",
      inDefinedTermSet: {
        "@type": "DefinedTermSet",
        "@id": `${SITE_URL}#glossary`,
        name: "밈캐치 밈 사전",
        url: SITE_URL,
      },
    });
  });

  it("localizes the standalone DefinedTerm's inLanguage and glossary reference", () => {
    const data = readJsonLd(
      <MemeDefinedTermJsonLd
        locale="en"
        name="Gapbunssa"
        summary="Sudden awkward silence in the room"
        shortId="a1b2c3"
        slug="gapbunssa"
      />,
    );

    expect(data).toMatchObject({
      "@type": "DefinedTerm",
      inLanguage: "en",
      url: `${SITE_URL}/en/memes/a1b2c3-gapbunssa`,
      inDefinedTermSet: {
        "@id": `${SITE_URL}/en#glossary`,
        name: "MemeCatch Korean Meme Dictionary",
        url: `${SITE_URL}/en`,
      },
    });
  });

  it("accepts explicit localized names and paths for breadcrumbs", () => {
    const data = readJsonLd(
      <MemeBreadcrumbJsonLd
        locale="ja"
        category="phrase"
        name="ミーム名"
        categoryName="韓国の流行語"
        path="/ja/memes/custom"
        shortId="ignored"
        slug="ignored"
      />,
    );

    expect(data.itemListElement).toEqual([
      { "@type": "ListItem", position: 1, name: "MemeCatch", item: `${SITE_URL}/ja` },
      {
        "@type": "ListItem",
        position: 2,
        name: "韓国の流行語",
        item: `${SITE_URL}/ja/explore?category=meme_term`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: "ミーム名",
        item: `${SITE_URL}/ja/memes/custom`,
      },
    ]);
  });
});
