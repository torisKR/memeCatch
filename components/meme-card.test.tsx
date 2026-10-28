import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemeCard } from "@/components/meme-card";
import type { MemeListItem } from "@/lib/queries";

const meme = {
  id: "meme-1",
  short_id: "m1",
  slug: "test-meme",
  title: "테스트 밈",
  summary: "카드 정보 구조를 확인하는 설명",
  category: "phrase",
  safety_level: "green",
  lifecycle_status: "rising",
  media_type: "video",
  origin_year: 2026,
  trend_score: 99,
  meme_contents: [
    {
      thumbnail_url: "https://i.ytimg.com/vi/example/hqdefault.jpg",
      is_representative: true,
      platform: "youtube",
      url: "https://youtube.com/watch?v=example",
    },
  ],
} as MemeListItem;

describe("MemeCard", () => {
  it("keeps platform chrome out of the default grid card", () => {
    const html = renderToStaticMarkup(<MemeCard meme={meme} />);

    expect(html).toContain("테스트 밈");
    expect(html).toContain("급상승");
    expect(html).toContain("aspect-[4/3]");
    expect(html).not.toContain("aspect-[4/5]");
    expect(html).not.toContain("safety-pulse");
    expect(html).not.toContain("출처 국가 미확인");
    expect(html).not.toContain("YouTube");
    expect(html).not.toContain("영상");
  });

  it("keeps the summary to one scan line and renders rank as a compact label", () => {
    const html = renderToStaticMarkup(<MemeCard meme={meme} rank={2} />);

    expect(html).toContain("line-clamp-1");
    expect(html).toContain("2위");
    expect(html).not.toContain("text-[2.35rem]");
  });

  it("shows one source only when a platform filter provides that context", () => {
    const html = renderToStaticMarkup(
      <MemeCard meme={meme} sourcePlatform="youtube" />,
    );

    expect(html).toContain("YouTube");
  });
});
