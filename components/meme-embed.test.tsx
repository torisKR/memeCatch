// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
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

  it("renders TikTok immediately without requesting the login-only oEmbed endpoint", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(
      <MemeEmbed
        content={tiktokContent}
        title="심쿵"
        isRepresentative={false}
      />
    );

    const frame = screen.getByTitle("심쿵 — TikTok 관련 콘텐츠");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(frame.getAttribute("src")).toContain(
      "www.tiktok.com/player/v1/6833754937747361025"
    );
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
    expect(html).toContain("맥락 자료 링크가 있어요.");
    expect(html).toContain("출처에서 원본 맥락 보기");
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
    expect(html).toContain("원본 콘텐츠 재생 불가.");
    expect(html).not.toContain("뜻과 맥락은 여기 남아 있어요");
    expect(html).not.toContain("출처 상태 확인하기");
  });

  it("does not present a confirmed unavailable source as currently playable", () => {
    const html = renderToStaticMarkup(
      <MemeEmbed
        content={{
          platform: "YouTube",
          content_id: "abcdefghijk",
          url: "https://www.youtube.com/watch?v=abcdefghijk",
          thumbnail_url: null,
          availability: "dead",
          caption: null,
        }}
        title="사라진 밈"
        isRepresentative
      />,
    );

    expect(html).not.toContain("youtube-nocookie.com/embed");
    expect(html).toContain("원본 콘텐츠 재생 불가.");
    expect(html).not.toContain("원본 링크가 있어요.");
    expect(html).not.toContain("아래 설명이 이 밈의 기록이에요");
  });

  it("renders Instagram immediately without requesting the login-only oEmbed endpoint", () => {
    const instagramContent = {
      ...tiktokContent,
      platform: "Instagram",
      content_id: "DGYAH_wviX0",
      url: "https://www.instagram.com/reel/DGYAH_wviX0/",
    };
    const fetchMock = vi.fn();
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
    expect(fetchMock).not.toHaveBeenCalled();
    expect(frame.getAttribute("src")).toBe(
      "https://www.instagram.com/reel/DGYAH_wviX0/embed/captioned/"
    );
    expect(frame.className).toContain("max-w-[540px]");
    expect(screen.queryByText(/재생하면/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it.each([
    ["Facebook", "https://www.facebook.com/watch/?v=123", "Facebook 밈"],
    ["Threads", "https://www.threads.net/@memecatch/post/abc123", "Threads 밈"],
  ])(
    "uses an honest link fallback for %s without a public provider request",
    (platform, url, title) => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);

      render(
        <MemeEmbed
          content={{
            ...tiktokContent,
            platform,
            content_id: "abc123",
            url,
          }}
          title={title}
          isRepresentative={false}
        />
      );

      expect(fetchMock).not.toHaveBeenCalled();
      expect(screen.queryByTitle(new RegExp(title))).toBeNull();
      expect(
        screen
          .getByRole("link", { name: /출처에서 원본 보기/ })
          .getAttribute("href")
      ).toBe(url);
      expect(screen.getByText("원본 링크가 있어요.")).toBeTruthy();
    }
  );

  it("updates the immediate iframe when the source identity changes", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(
      <MemeEmbed content={tiktokContent} title="첫 영상" isRepresentative={false} />
    );

    expect(
      screen.getByTitle("첫 영상 — TikTok 관련 콘텐츠").getAttribute("src")
    ).toContain(tiktokContent.content_id);

    rerender(
      <MemeEmbed
        content={{
          ...tiktokContent,
          content_id: "7512345678901234567",
          url: "https://www.tiktok.com/@coco.midnight/video/7512345678901234567",
        }}
        title="둘째 영상"
        isRepresentative={false}
      />
    );

    expect(screen.queryByTitle("첫 영상 — TikTok 관련 콘텐츠")).toBeNull();
    expect(
      screen.getByTitle("둘째 영상 — TikTok 관련 콘텐츠").getAttribute("src")
    ).toContain("7512345678901234567");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders English fallback copy on English pages without Korean UI text", () => {
    const html = renderToStaticMarkup(
      <MemeEmbed
        content={null}
        fallbackSourceUrl="https://en.wikipedia.org/wiki/KPop_Demon_Hunters"
        title="KPop Demon Hunters"
        category="song"
        originYear={2025}
        locale="en"
      />
    );

    expect(html).toContain("Context source available.");
    expect(html).toContain("See the context at the source");
    expect(html).toContain("Song");
    expect(html).toContain("around 2025");
    expect(html).not.toMatch(/[가-힣]/);
  });

  it("keeps Korean fallback copy by default", () => {
    const html = renderToStaticMarkup(
      <MemeEmbed
        content={null}
        fallbackSourceUrl="https://ko.wikipedia.org/wiki/%EB%A7%88%EB%9D%BC%ED%83%95%ED%9B%84%EB%A3%A8"
        title="마라탕후루"
        category="song"
        originYear={2024}
      />
    );

    expect(html).toContain("맥락 자료 링크가 있어요.");
    expect(html).toContain("2024년 무렵");
  });
});
