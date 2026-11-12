// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemeCard, MemeCardFace } from "@/components/meme-card";
import type { MemeCardModel } from "@/components/meme-card";

const cardCss = readFileSync("components/meme-card.module.css", "utf8");

const ART = "/api/media/meme-card-art/jung.webp";

const meme: MemeCardModel = {
  short_id: "m1",
  slug: "test-meme",
  title: "테스트 밈",
  summary: "한 줄로 끝나는 카드 설명입니다. 둘째 줄은 잘려야 해요.",
  category: "phrase",
  safety_level: "green",
  origin_year: 2024,
  meme_contents: [
    {
      thumbnail_url: "https://i.ytimg.com/vi/example/hqdefault.jpg",
      is_representative: true,
    },
  ],
};

describe("MemeCard", () => {
  it("uses the poster chrome and refuses YouTube stills", () => {
    const html = renderToStaticMarkup(<MemeCard meme={meme} />);

    expect(html).toContain("rounded-[16px]");
    expect(cardCss).toContain("aspect-ratio: 4 / 3");
    expect(html).toContain('data-meme-card-title=""');
    expect(html).toContain('data-title-size="grid"');
    expect(html).toContain('data-meme-card-summary=""');
    expect(html).toContain("써도 됨");
    expect(html).toContain("2024");
    expect(html).toContain('data-meme-card-art="fallback"');
    expect(html).toContain("rgb(20 20 20 / 0.85)");
    expect(html).not.toContain("hqdefault");
    expect(html).not.toContain("ytimg.com");
    expect(html).not.toContain("밈 용어");
    expect(html).not.toContain("출처 국가");
    expect(html).not.toContain("YouTube");
    expect(html.match(/테스트 밈/g)).toHaveLength(2);
  });

  it("renders owned 4:3 art with srcset and localized alt text", () => {
    const korean = renderToStaticMarkup(
      <MemeCard meme={{ ...meme, card_art_url: `https://catchmeme.com${ART}` }} />,
    );
    const english = renderToStaticMarkup(
      <MemeCard
        meme={{ ...meme, title: "Test meme", card_art_url: ART }}
        locale="en"
        titleSize="detail"
      />,
    );

    expect(korean).toContain(`src="${ART}?w=1200"`);
    expect(korean).toContain(`${ART}?w=600 600w`);
    expect(korean).toContain(`${ART}?w=900 900w`);
    expect(korean).toContain(`${ART}?w=1200 1200w`);
    expect(korean).toContain('alt="테스트 밈 상징 일러스트"');
    expect(korean).toContain('width="1200"');
    expect(korean).toContain('height="900"');
    expect(english).toContain('alt="Test meme symbol illustration"');
    expect(english).toContain("Safe to use");
    expect(english).toContain('data-title-size="detail"');
    expect(english).not.toContain("써도 됨");
    expect(english).not.toContain("밈 용어(유행어)");
  });

  it("keeps one hover and focus treatment", () => {
    const html = renderToStaticMarkup(<MemeCard meme={meme} sourcePlatform="youtube" rank={1} />);
    expect(html).toContain("hover:-translate-y-0.5");
    expect(html).toContain("focus-visible:outline-2");
    expect(html).not.toContain("data-tilt");
    expect(html).not.toContain("YouTube");
  });

  it("falls back when owned art fails and does not paint the title into the bubble", () => {
    const view = render(<MemeCard meme={{ ...meme, card_art_url: ART }} />);
    const image = view.container.querySelector("img");
    expect(image).toBeTruthy();
    fireEvent.error(image!);
    expect(view.container.querySelector("img")).toBeNull();
    expect(view.container.querySelector("[data-meme-card-bubble]")?.textContent).toBe("");
    expect(view.container.querySelector("[data-meme-card-art='fallback']")?.textContent).not.toContain("테스트 밈");
    expect(view.getByText("테스트 밈")).toBeTruthy();
  });

  it("shares the same face without a link for collectible fronts", () => {
    const html = renderToStaticMarkup(
      <MemeCardFace
        title="PPAP"
        summary="펜과 사과"
        year={2016}
        art={null}
        locale="en"
      />,
    );
    expect(html).not.toContain("<a ");
    expect(html).toContain("PPAP");
    expect(html).toContain("2016");
    expect(html).toContain('data-meme-card-art="fallback"');
  });

  it("keeps grid titles on one line and gives narrow cards a two-line title without a summary", () => {
    const narrow = cardCss.slice(cardCss.indexOf("@container (max-width: 199px)"));
    expect(cardCss).toContain("-webkit-line-clamp: 1");
    expect(cardCss).toContain("font-size: 20px");
    expect(cardCss).toContain("font-size: 14px");
    expect(cardCss).toContain("font-size: 28px");
    expect(cardCss).toContain("padding: 24px 0 8px 24px");
    expect(cardCss).toContain("min-height: 2.5em");
    expect(cardCss).toContain("min-height: 12rem");
    expect(cardCss).toContain("grid-template-rows: 30%");
    expect(cardCss).toContain("word-break: keep-all");
    expect(narrow).toContain("font-size: 16px");
    expect(narrow).toContain("-webkit-line-clamp: 2");
    expect(narrow).toContain("min-height: 2.5em");
    expect(narrow).toContain("display: none");
    expect(narrow).not.toContain("flex-wrap: wrap");
    expect(cardCss).toContain("flex-wrap: nowrap");
    expect(cardCss).toContain("white-space: nowrap");
    expect(cardCss).toContain("text-overflow: ellipsis");
  });

  it("leaves the country pill and category badge off the poster in English and Korean", () => {
    const english = renderToStaticMarkup(<MemeCard meme={meme} locale="en" />);
    const korean = renderToStaticMarkup(<MemeCard meme={meme} />);

    expect(english).toContain("Safe to use");
    expect(english).not.toContain("Origin unconfirmed");
    expect(english).not.toContain("Meme terms");
    expect(english).not.toContain("Meme videos");
    expect(english).not.toContain("data-country-flag");
    expect(korean).toContain("써도 됨");
    expect(korean).not.toContain("출처 국가");
    expect(korean).not.toContain("밈 용어");
    expect(korean).not.toContain("밈 영상");
  });

  it("server-renders a verified public image for the 410 page", () => {
    const html = renderToStaticMarkup(
      <MemeCard
        meme={{
          ...meme,
          title: "새우 예수",
          meme_contents: [{ thumbnail_url: "/ai-memes/ai-slop.jpg", is_representative: true }],
        }}
        href="/memes/m1-test-meme"
        locale="ko"
        imageAspect="4/3"
        staticMarkup
        thumbnailAlt="새우 예수 상징 일러스트"
      />,
    );

    expect(html).toContain('href="/memes/m1-test-meme"');
    expect(html).toContain("aspect-[4/3]");
    expect(html).not.toContain("aspect-[4/5]");
    expect(html).toContain('alt="새우 예수 상징 일러스트"');
    expect(html).toContain('src="/ai-memes/ai-slop.jpg"');
    expect(html).toContain("<img");
    expect(html).toContain('data-thumbnail-state="image"');
    expect(html).not.toContain("ytimg");
    expect(html).not.toContain("data-country-flag");
  });

  it("uses the retired fallback when the 410 image is not a verified public file", () => {
    const html = renderToStaticMarkup(
      <MemeCard meme={meme} staticMarkup thumbnailAlt="should not appear" />,
    );

    expect(html).toContain('data-meme-card-art="fallback"');
    expect(html).toContain('fill="#ff5c38"');
    expect(html).toContain("bg-[#141414]");
    expect(html).not.toContain("<img");
    expect(html).not.toContain("should not appear");
    expect(html).not.toContain("ytimg.com");
  });
});
