import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  DefinedTermSetJsonLd,
  ExploreCollectionJsonLd,
  ForumPostingJsonLd,
  MemeBreadcrumbJsonLd,
  MemeDefinedTermJsonLd,
  MemeProducedVideoJsonLd,
  MemeWebPageJsonLd,
  OrganizationJsonLd,
  WebSiteJsonLd,
} from "@/components/json-ld";
import { SITE_URL } from "@/lib/site";
import type { PublicMemeProducedVideo } from "@/lib/video-production/public.server";
import { publicReaderDescription } from "@/lib/meme-public-detail";

function readJsonLd(element: React.ReactNode): Record<string, unknown> {
  const html = renderToStaticMarkup(element);
  const json = html.match(/<script type="application\/ld\+json">([\s\S]+)<\/script>/)?.[1];
  if (!json) throw new Error("JSON-LD script was not rendered");
  return JSON.parse(json) as Record<string, unknown>;
}

function renderJsonLd(element: React.ReactNode): string {
  return renderToStaticMarkup(element);
}

describe("localized JSON-LD", () => {
  it("identifies the actual server-rendered Explore page instead of collapsing page 2 to page 1", () => {
    expect(readJsonLd(<ExploreCollectionJsonLd path="/explore?page=2" />).url)
      .toBe(`${SITE_URL}/explore?page=2`);
    expect(readJsonLd(<ExploreCollectionJsonLd />).url).toBe(`${SITE_URL}/explore`);
  });
  it("represents forum likes as a typed Action, not a URL-valued interactionType", () => {
    const data = readJsonLd(<ForumPostingJsonLd
      postId="c968c9a6-96cd-4b6c-bc31-ed85b8bd61fc"
      title="등록된 게시글 제목"
      body="등록된 게시글 본문"
      authorNickname="작성자"
      createdAt="2026-07-06T23:22:49.836+00:00"
      likeCount={0}
      commentCount={2}
    />);
    expect(data["@type"]).toBe("DiscussionForumPosting");
    expect(data.interactionStatistic).toEqual({
      "@type": "InteractionCounter",
      interactionType: { "@type": "LikeAction" },
      userInteractionCount: 0,
    });
    expect(data.commentCount).toBe(2);
    expect(data.headline).toBe("등록된 게시글 제목");
  });
  it("describes the editorial service without an unverified real-time claim", () => {
    const organization = readJsonLd(<OrganizationJsonLd />);
    expect(organization.description).toBe("밈·유행어·챌린지의 뜻과 유래, 사용 맥락과 참고 자료를 정리하는 한국 밈 사전.");
    expect(organization.description).not.toMatch(/실시간|전체 SNS/);
  });

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
    });
    expect(glossary).not.toHaveProperty("inLanguage");
  });

  it("uses localized meme URLs and points at one canonical DefinedTerm entity", () => {
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
      "@id": `${SITE_URL}/zh-tw/memes/a1b2c3-%ED%95%9C%EA%B5%AD-%EB%B0%88#webpage`,
      name: "迷因名稱",
      inLanguage: "zh-Hant",
      isPartOf: { name: "MemeCatch", url: `${SITE_URL}/zh-tw` },
      mainEntity: {
        "@id": `${SITE_URL}/zh-tw/memes/a1b2c3-%ED%95%9C%EA%B5%AD-%EB%B0%88#term`,
      },
    });
    expect(data).not.toHaveProperty("speakable");
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
      "@id": `${SITE_URL}/memes/a1b2c3-%EA%B0%91%EB%B6%84%EC%8B%B8#term`,
      name: "갑분싸",
      description: "갑자기 분위기가 싸해짐",
      inDefinedTermSet: {
        "@type": "DefinedTermSet",
        "@id": `${SITE_URL}#glossary`,
        name: "밈캐치 밈 사전",
        url: SITE_URL,
      },
    });
    expect(data).not.toHaveProperty("inLanguage");
  });

  it("localizes the standalone DefinedTerm URL and glossary reference", () => {
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
      url: `${SITE_URL}/en/memes/a1b2c3-gapbunssa`,
      inDefinedTermSet: {
        "@id": `${SITE_URL}/en#glossary`,
        name: "MemeCatch Korean Meme Dictionary",
        url: `${SITE_URL}/en`,
      },
    });
    expect(data).not.toHaveProperty("inLanguage");
  });

  it("uses the same stable entity ID in WebPage and standalone DefinedTerm", () => {
    const props = {
      name: "갑분싸",
      summary: "갑자기 분위기가 싸해짐",
      shortId: "a1b2c3",
      slug: "갑분싸",
    };
    const page = readJsonLd(
      <MemeWebPageJsonLd
        {...props}
        description="서로 다른 긴 본문"
        datePublished={null}
        dateModified={null}
      />,
    );
    const term = readJsonLd(<MemeDefinedTermJsonLd {...props} />);

    expect(page.mainEntity).toEqual({ "@id": term["@id"] });
    expect(page.description).toBe("서로 다른 긴 본문");
    expect(term.description).toBe(props.summary);
  });

  it.each([
    "특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.",
    "이 항목의 대표 이미지는 특정 원본을 복제하지 않은 편집 일러스트로 운영한다.",
  ])("uses cleaned full reader prose without the internal suffix: %s", (suffix) => {
    const cleaned = publicReaderDescription(`독자가 읽는 전체 설명입니다. ${suffix}`);
    const data = readJsonLd(
      <MemeWebPageJsonLd
        name="브레인롯 밈"
        summary="한 줄 요약"
        description={cleaned}
        shortId="a1b2c3"
        slug="브레인롯-밈"
        datePublished={null}
        dateModified={null}
      />,
    );

    expect(data.description).toBe("독자가 읽는 전체 설명입니다.");
    expect(String(data.description)).not.toContain("특정 파생 작품의 구도를 복제하지 않는 편집 삽화로 대표한다.");
    expect(String(data.description)).not.toContain("이 항목의 대표 이미지는 특정 원본을 복제하지 않은 편집 일러스트로 운영한다.");
  });

  it("falls back to the visible summary when the full description is blank", () => {
    const data = readJsonLd(
      <MemeWebPageJsonLd
        name="갑분싸"
        summary="갑자기 분위기가 싸해짐"
        description={"  \n\t "}
        shortId="a1b2c3"
        slug="갑분싸"
        datePublished={null}
        dateModified={null}
      />,
    );

    expect(data.description).toBe("갑자기 분위기가 싸해짐");
  });

  it("escapes markup-like text before inserting JSON-LD into HTML", () => {
    const html = renderJsonLd(
      <MemeDefinedTermJsonLd
        name={'갑분싸</script><img src=x onerror="alert(1)">'}
        summary="설명"
        shortId="a1b2c3"
        slug="갑분싸"
      />,
    );

    expect(html).not.toContain("</script><img");
    expect(html).toContain("\\u003c/script>\\u003cimg");
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
    expect(data["@id"]).toBe(`${SITE_URL}/ja/memes/custom#breadcrumb`);
  });

  it("labels the breadcrumb category for the resolved display category", () => {
    const data = readJsonLd(
      <MemeBreadcrumbJsonLd
        locale="en"
        category="challenge"
        name="Challenge meme"
        shortId="a1b2c3"
        slug="challenge-meme"
      />,
    );

    expect(data.itemListElement).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          position: 2,
          name: "Challenge dances",
          item: `${SITE_URL}/en/explore?category=challenge_dance`,
        }),
      ]),
    );
  });

  it("emits only citable public sources and valid stored evidence dates", () => {
    const data = readJsonLd(
      <MemeWebPageJsonLd
        name="A meme"
        summary="Meaning"
        description="Full explanation"
        shortId="a1b2c3"
        slug="test"
        datePublished="not-a-date"
        dateModified="2099-01-01T00:00:00Z"
        sources={[
          {
            source_url: "https://news.example.org/article",
            title: "Reported context",
            captured_at: "2026-07-01T12:00:00Z",
          },
          { source_url: "javascript:alert(1)", title: "Unsafe" },
          { source_url: "https://news.example.org/untitled", title: null },
        ]}
      />,
    );

    expect(data.citation).toEqual(["https://news.example.org/article"]);
    expect(data).not.toHaveProperty("datePublished");
    expect(data).not.toHaveProperty("dateModified");
  });

  const producedVideo: PublicMemeProducedVideo = {
    meme_id: "m1", production_id: "p1", content_id: "c1", youtube_video_id: "abcdefghijk",
    caption: "페이지 연결 당시의 설명", privacy_status: "public", site_linked_at: "2026-10-12T00:00:00Z",
    public_embed_verified: true,
    schema_metadata: { name: "밈캐치가 직접 설명하는 사용 예시", description: "실제 영상의 설명",
      thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg", uploadDate: "2026-07-01T12:00:00Z" },
  };

  it("describes only the verified own video with real metadata and the visible player URL", () => {
    const data = readJsonLd(<MemeProducedVideoJsonLd video={producedVideo} path="/memes/test-meme" />);
    expect(data).toMatchObject({
      "@type": "VideoObject", "@id": `${SITE_URL}/memes/test-meme#produced-video-abcdefghijk`,
      name: producedVideo.schema_metadata!.name, description: producedVideo.schema_metadata!.description,
      thumbnailUrl: producedVideo.schema_metadata!.thumbnailUrl, uploadDate: "2026-07-01T12:00:00Z",
      embedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk", publisher: { "@id": `${SITE_URL}#org` },
    });
    expect(data).not.toHaveProperty("contentUrl");
    expect(data).not.toHaveProperty("duration");
    expect(data).not.toHaveProperty("citation");
    expect(data).not.toHaveProperty("production_id");
    expect(data.uploadDate).not.toBe(producedVideo.site_linked_at);
  });

  it.each(["unlisted", "private", "unknown"])("omits own video schema for %s visibility", (privacy) => {
    const video = { ...producedVideo, privacy_status: privacy } as PublicMemeProducedVideo;
    expect(renderToStaticMarkup(<MemeProducedVideoJsonLd video={video} path="/memes/test-meme" />)).toBe("");
  });

  it.each([false, undefined, "true", 1])("requires the exact stored public playback proof: %s", (proof) => {
    const video = { ...producedVideo, public_embed_verified: proof } as PublicMemeProducedVideo;
    expect(renderToStaticMarkup(<MemeProducedVideoJsonLd video={video} path="/memes/test-meme" />)).toBe("");
  });

  it.each([null,
    { ...producedVideo.schema_metadata, name: "" },
    { ...producedVideo.schema_metadata, thumbnailUrl: null },
    { ...producedVideo.schema_metadata, thumbnailUrl: "https://i.ytimg.com/vi/otherabcdef/hqdefault.jpg" },
    { ...producedVideo.schema_metadata, uploadDate: null },
    { ...producedVideo.schema_metadata, uploadDate: "2026-02-30T12:00:00Z" },
    { ...producedVideo.schema_metadata, uploadDate: "2099-01-01T12:00:00Z" },
  ])("fails closed for missing or invalid actual video metadata", (metadata) => {
    const video = { ...producedVideo, schema_metadata: metadata } as PublicMemeProducedVideo;
    expect(renderToStaticMarkup(<MemeProducedVideoJsonLd video={video} path="/memes/test-meme" />)).toBe("");
  });

  it("keeps untrusted video strings inside one escaped JSON-LD script", () => {
    const video = { ...producedVideo, schema_metadata: { ...producedVideo.schema_metadata!, name: "</script><script>alert(1)</script>" } };
    const html = renderToStaticMarkup(<MemeProducedVideoJsonLd video={video} path="/memes/test-meme" />);
    expect(html.match(/<script/g)).toHaveLength(1);
    expect(html).toContain("\\u003c/script>");
    expect(readJsonLd(<MemeProducedVideoJsonLd video={video} path="/memes/test-meme" />).name).toBe(video.schema_metadata.name);
  });
});
