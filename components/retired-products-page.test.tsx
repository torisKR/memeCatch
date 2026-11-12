import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeListItem } from "@/lib/queries";

const getTrendingMemes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/queries", () => ({
  getTrendingMemes,
}));

import { metadata as koreanMetadata } from "@/app/(default)/retired-products/page";
import KoreanRetiredProductsPage from "@/app/(default)/retired-products/page";
import { generateMetadata as englishMetadata } from "@/app/[locale]/retired-products/page";
import EnglishRetiredProductsPage from "@/app/[locale]/retired-products/page";
import { RetiredProductsPage } from "@/components/retired-products-page";
import { RETIRED_PRODUCTS_ROBOTS } from "@/lib/retired-products";

function meme(index: number): MemeListItem {
  return {
    id: `meme-${index}`,
    short_id: `m${index}`,
    slug: `meme-${index}`,
    title: `인기 밈 ${index}`,
    summary: "한 줄 설명",
    category: "phrase",
    safety_level: "green",
    lifecycle_status: "rising",
    media_type: "image",
    origin_year: 2026,
    trend_score: 100 - index,
    meme_contents: [{ thumbnail_url: "/ai-memes/ai-slop.jpg", is_representative: true }],
  } as MemeListItem;
}

describe("retired products page", () => {
  beforeEach(() => {
    getTrendingMemes.mockReset();
  });

  it("contains the explore button and a noindex meta tag", () => {
    const html = renderToStaticMarkup(
      <RetiredProductsPage locale="ko" memes={[]} />,
    );

    expect(html).toContain("밈상품 페이지는 더 이상 운영하지 않아요.");
    expect(html).toContain("밈 탐색");
    expect(html).toContain('href="/explore"');
    expect(html).toContain('name="robots"');
    expect(html).toContain("noindex");
    expect(html).not.toContain("지금은 보여드릴 인기 밈이 없어요.");
    expect(html).not.toContain("지금 많이 보는 밈");
    expect(html).not.toContain("<ul");
    expect(koreanMetadata.robots).toEqual(RETIRED_PRODUCTS_ROBOTS);
    expect(koreanMetadata.robots).toMatchObject({ index: false });
  });

  it("renders four popular meme cards and drops the rest", () => {
    const html = renderToStaticMarkup(
      <RetiredProductsPage locale="ko" memes={[1, 2, 3, 4, 5].map(meme)} />,
    );

    expect(html).toContain("인기 밈 1");
    expect(html).toContain("인기 밈 4");
    expect(html).not.toContain("인기 밈 5");
    expect(html).not.toContain("지금은 보여드릴 인기 밈이 없어요.");
    expect(html).toContain("aspect-[4/3]");
    expect(html).not.toContain("aspect-[4/5]");
    expect(html).toContain("rounded-[16px]");
    expect(html).not.toContain("data-country-flag");
    expect(html).not.toContain("밈 용어");
    expect(html).toContain('alt="인기 밈 1 상징 일러스트"');
    expect(html).toContain("<img");
    expect(html).not.toContain("background-image");
    expect(html).toContain('href="/memes/m1-meme-1"');
    expect(html).toContain("grid-cols-2");
    expect(html).toContain("xl:grid-cols-4");
  });

  it("keeps card links unprefixed while the alt follows the page locale", () => {
    const html = renderToStaticMarkup(
      <RetiredProductsPage locale="ko" routeLocale="zh-tw" memes={[meme(1)]} />,
    );
    expect(html).toContain('href="/memes/m1-meme-1"');
    expect(html).toContain('alt="인기 밈 1象徵插畫"');
    expect(html).not.toContain('href="/zh-tw/memes/');
    expect(html).not.toContain('href="/en/memes/');
    expect(html).not.toContain('href="/ja/memes/');
    expect(html).not.toContain('href="/zh/memes/');
  });

  it("uses the English copy on the English gone page", async () => {
    const html = renderToStaticMarkup(
      <RetiredProductsPage locale="en" memes={[]} />,
    );
    expect(html).toContain("Meme product pages are no longer available.");
    expect(html).toContain("Explore memes");
    expect(html).toContain('href="/en/explore"');
    expect(html).toContain("noindex");
    expect(html).not.toContain("No popular memes to show right now.");
    expect(html).not.toContain("<ul");
    await expect(englishMetadata({ params: Promise.resolve({ locale: "en" }) })).resolves.toMatchObject({
      robots: RETIRED_PRODUCTS_ROBOTS,
    });
  });

  it("loads four trending memes for the Korean and English documents", async () => {
    getTrendingMemes.mockResolvedValue([1, 2, 3, 4].map(meme));

    const korean = renderToStaticMarkup(await KoreanRetiredProductsPage());
    const english = renderToStaticMarkup(
      await EnglishRetiredProductsPage({ params: Promise.resolve({ locale: "en" }) }),
    );

    expect(getTrendingMemes).toHaveBeenCalledWith(4);
    expect(korean).toContain("인기 밈 4");
    expect(korean).toContain('href="/explore"');
    expect(english).toContain("Explore memes");
    expect(english).toContain("인기 밈 1");
  });
});
