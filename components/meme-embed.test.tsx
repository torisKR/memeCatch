// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemeEmbed } from "./meme-embed";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const tiktokContent = {
  platform: "TikTok",
  content_id: "6833754937747361025",
  url: "https://www.tiktok.com/@coco.midnight/video/6833754937747361025",
  thumbnail_url: null,
  availability: "live" as const,
  caption: null,
};

describe("MemeEmbed", () => {
  it("renders a live project-owned representative image", () => {
    const html = renderToStaticMarkup(
      <MemeEmbed
        content={{
          platform: "MemeCatch",
          content_id: null,
          url: null,
          thumbnail_url: "/ai-memes/ai-slop.jpg",
          availability: "live",
          caption: "AI 슬롭 — 밈캐치 편집 삽화",
        }}
        fallbackSourceUrl="https://www.merriam-webster.com/dictionary/slop"
        title="AI 슬롭"
        isRepresentative
      />
    );

    expect(html).toContain('src="/ai-memes/ai-slop.jpg"');
    expect(html).toContain('alt="AI 슬롭 대표 이미지"');
    expect(html).toContain("AI 슬롭 — 밈캐치 편집 삽화");
    expect(html).not.toContain("원본 콘텐츠는 출처에서 볼 수 있어요");
  });

  it("renders YouTube Shorts as a playable video instead of a source fallback", () => {
    const html = renderToStaticMarkup(
      <MemeEmbed
        content={{
          platform: "YouTube Shorts",
          content_id: "abcdefghijk",
          url: "https://www.youtube.com/shorts/abcdefghijk",
          thumbnail_url: null,
          availability: "live",
          caption: null,
        }}
        title="쇼츠 밈"
        isRepresentative={false}
      />
    );

    expect(html).toContain("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(html).toContain("쇼츠 밈 관련 영상 재생");
    expect(html).not.toContain("원본 콘텐츠는 출처에서 볼 수 있어요");
  });

  it("includes the TikTok iframe in the initial server markup", () => {
    const html = renderToStaticMarkup(
      <MemeEmbed
        content={tiktokContent}
        title="심쿵"
        isRepresentative={false}
      />
    );

    expect(html).toContain("<iframe");
    expect(html).toContain("www.tiktok.com/player/v1/6833754937747361025");
    expect(html).toContain("h-[min(72svh,680px)]");
    expect(html).not.toContain("재생하면");
  });

  it("loads a non-representative TikTok embed immediately in a viewport-sized frame", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: "tiktok",
        sourceUrl: tiktokContent.url,
        embedUrl: "https://www.tiktok.com/player/v1/6833754937747361025",
        embedHtml: null,
        contentId: tiktokContent.content_id,
        title: "심쿵",
        authorName: "퀸이슬",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemeEmbed
        content={tiktokContent}
        title="심쿵"
        isRepresentative={false}
      />
    );

    const frame = screen.getByTitle("심쿵 — TikTok 관련 콘텐츠");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(frame.className).toContain("h-[min(72svh,680px)]");
    expect(frame.className).toContain("max-w-[382px]");
    expect(screen.getByText("밈 사용 예시")).toBeTruthy();
    expect(screen.queryByText(/재생하면/)).toBeNull();
    expect(screen.queryByText(/원본이 아닌 사용 예시/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByText("대표 콘텐츠 보기")).toBeNull();
  });

  // DQ-011 회귀 — 폴백 히어로의 연도 칩은 단정하지 않는다.
  // year_precision이 공개 문서 전부 unknown이고, 4개 로케일도 "around"로 헤지한다.
  it("does not assert a definite origin year on the fallback hero chip", () => {
    const html = renderToStaticMarkup(
      <MemeEmbed
        content={null}
        fallbackSourceUrl={null}
        title="연도 밈"
        category="phrase"
        originYear={2016}
      />
    );

    expect(html).toContain("2016년 무렵");
    expect(html).not.toContain("2016년 등장");
  });

  // DQ-005 회귀 — region_blocked는 dead와 똑같이 재생 불가로 다뤄야 한다.
  // 랭킹 게이트(is_meme_rank_eligible)가 이미 둘을 함께 제외하는데 화면만
  // dead만 걸러서, 랭킹에 못 오르는 콘텐츠가 상세에는 임베드되고 있었다.
  it("falls back to the source card when a YouTube source is region_blocked", () => {
    const html = renderToStaticMarkup(
      <MemeEmbed
        content={{
          platform: "YouTube",
          content_id: "abcdefghijk",
          url: "https://www.youtube.com/watch?v=abcdefghijk",
          thumbnail_url: null,
          availability: "region_blocked",
          caption: null,
        }}
        fallbackSourceUrl="https://namu.wiki/w/test"
        title="지역 차단 밈"
        isRepresentative
      />
    );

    expect(html).not.toContain("https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg");
    expect(html).toContain("출처에서 원본 보기");
  });

  it("does not embed a region_blocked TikTok source", () => {
    const html = renderToStaticMarkup(
      <MemeEmbed
        content={{ ...tiktokContent, availability: "region_blocked" }}
        title="심쿵"
        isRepresentative={false}
      />
    );

    expect(html).not.toContain("www.tiktok.com/player/v1/6833754937747361025");
    expect(html).toContain("출처에서 원본 보기");
  });

  it("loads Instagram immediately without a click gate", async () => {
    const instagramContent = {
      ...tiktokContent,
      platform: "Instagram",
      content_id: "DGYAH_wviX0",
      url: "https://www.instagram.com/reel/DGYAH_wviX0/",
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        provider: "instagram",
        sourceUrl: instagramContent.url,
        embedUrl: "https://www.instagram.com/reel/DGYAH_wviX0/embed/captioned/",
        embedHtml: null,
        contentId: instagramContent.content_id,
        title: null,
        authorName: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemeEmbed
        content={instagramContent}
        title="검정고무신 애니메이션"
        isRepresentative={false}
      />
    );

    const frame = screen.getByTitle(
      "검정고무신 애니메이션 — Instagram 관련 콘텐츠"
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(frame.className).toContain("max-w-[540px]");
    expect(screen.queryByText(/재생하면/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
