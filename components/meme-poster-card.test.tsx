// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { MemePosterCard } from "@/components/meme-poster-card";
import { MemePosterOg } from "@/components/meme-poster-og";

afterEach(cleanup);

const meme = {
  title: "중꺾마",
  summary: "중요한 건 꺾이지 않는 마음",
  safetyLevel: "green" as const,
  year: 2022,
  locale: "ko" as const,
};

describe("MemePosterCard", () => {
  it("draws the charcoal speech bubble when there is no art and never an image", () => {
    const html = renderToStaticMarkup(
      <MemePosterCard {...meme} artUrl={null} size="grid" />,
    );

    expect(html).toContain('data-meme-art="fallback"');
    expect(html).toContain('fill="#141414"');
    expect(html).toContain('fill="#F05A28"');
    expect(html).not.toContain("<img");
    expect(html).toContain("중꺾마");
    expect(html).toContain("써도 됨");
    expect(html).toContain("2022");
    expect(html).toContain("중요한 건 꺾이지 않는 마음");
    expect(html).toContain("rgba(20,20,20,0.85)");
    expect(html).toContain("font-size:20px");
    expect(html).toContain("font-size:14px");
    expect(html).toContain("color:#F4EFE6");
  });

  it("uses the meme title plus the symbol label as alt text and lazy-loads grid art", () => {
    const html = renderToStaticMarkup(
      <MemePosterCard
        {...meme}
        artUrl="/api/media/meme-art/jkm2022k.png"
        size="grid"
      />,
    );

    expect(html).toContain('data-meme-art="image"');
    expect(html).toContain('alt="중꺾마 상징 일러스트"');
    expect(html).toContain('width="640"');
    expect(html).toContain('height="480"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('sizes="(min-width: 64rem) 25vw, 100vw"');
  });

  it("keeps a text label on every usage color", () => {
    for (const [level, label] of [
      ["yellow", "주의"],
      ["red", "금기"],
      ["gray", "이미 늦음"],
    ] as const) {
      const html = renderToStaticMarkup(
        <MemePosterCard {...meme} safetyLevel={level} artUrl={null} size="grid" />,
      );
      expect(html).toContain(label);
      expect(html).toContain(`data-safety-icon="${level}"`);
    }
  });

  it("keeps the detail title at 28px", () => {
    const html = renderToStaticMarkup(
      <MemePosterCard {...meme} artUrl={null} size="detail" heading="h1" priority />,
    );

    expect(html).toContain("<h1");
    expect(html).toContain("font-size:28px");
    expect(html).not.toContain("<img");
  });

  it("replaces a broken image with the speech-bubble fallback", () => {
    render(
      <MemePosterCard
        {...meme}
        artUrl="/api/media/meme-art/missing.png"
        size="grid"
      />,
    );

    fireEvent.error(screen.getByRole("img", { name: "중꺾마 상징 일러스트" }));

    expect(screen.queryByRole("img")).toBeNull();
    expect(document.querySelector('[data-meme-art="fallback"]')).not.toBeNull();
  });
});

describe("MemePosterOg", () => {
  it("keeps the title, badge, and summary in markup when the art is missing", () => {
    const html = renderToStaticMarkup(
      <MemePosterOg
        title="중꺾마"
        summary="중요한 건 꺾이지 않는 마음"
        badgeLabel="써도 됨"
        badgeBackground="#146c43"
        badgeForeground="#F4EFE6"
        year={2022}
        artSrc={null}
        artAlt="중꺾마 상징 일러스트"
      />,
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("중꺾마");
    expect(html).toContain("써도 됨");
    expect(html).toContain("2022");
    expect(html).toContain("중요한 건 꺾이지 않는 마음");
  });
});
