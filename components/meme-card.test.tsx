// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MemeCard, MemeCardFace } from "@/components/meme-card";
import type { MemeCardModel } from "@/components/meme-card";

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

    expect(html).toContain("aspect-[4/3]");
    expect(html).toContain("rounded-[16px]");
    expect(html).toContain("p-6");
    expect(html).toContain("text-[20px]");
    expect(html).toContain("text-[14px]");
    expect(html).toContain("line-clamp-1");
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
    expect(english).toContain("text-[28px]");
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
    expect(view.container.querySelector("[data-meme-card-art='fallback'] svg")?.textContent).toBe("");
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
});
