import type { ComponentPropsWithoutRef } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import { HomeImmersiveStory } from "@/components/home/home-immersive-story";
import {
  HOME_IMMERSIVE_COPY,
  HOME_IMMERSIVE_LOCALES,
} from "@/lib/home-immersive-copy";

describe("HomeImmersiveStory", () => {
  it.each(HOME_IMMERSIVE_LOCALES)(
    "server-renders one short search screen for %s",
    (locale) => {
      const html = renderToStaticMarkup(<HomeImmersiveStory locale={locale} />);
      const copy = HOME_IMMERSIVE_COPY[locale];
      const discover = copy.chapters[0];

      expect(html).toContain('id="home-top"');
      expect(html).toContain('data-home-section="hero-search"');
      expect(html).not.toContain("data-home-scroll-track");
      expect(html).not.toContain("data-home-scroll-pin");
      expect(html).not.toContain("data-home-scroll-range");
      expect(html).not.toContain('data-story-chapter="context"');
      expect(html).not.toContain('data-story-chapter="participate"');
      expect(html).not.toContain('href="/products"');
      expect(html).not.toContain(copy.productsAction);
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html.match(/<h2[ >]/g) ?? []).toHaveLength(0);
      expect(html).toContain(discover.title);
      expect(html).toContain(discover.description);
      expect(html).toContain('href="#home-latest"');
      expect(html).toContain('name="q"');
      expect(html).toContain('type="submit"');
      expect(html).toContain(
        `action="${locale === "ko" ? "/search" : `/${locale}/search`}"`,
      );
      expect(html).toContain(copy.search.label);
      expect(html).toContain(copy.search.placeholder);
      expect(html).toContain(copy.search.button);
    },
  );

  it("keeps the hero shorter than a pinned viewport", () => {
    const css = readFileSync(
      "components/home/home-immersive-story.module.css",
      "utf8",
    );

    expect(css).toContain(".hero");
    expect(css).toContain(".searchButton");
    expect(css).not.toContain("100svh");
    expect(css).not.toContain("position: sticky");
    expect(css).not.toContain("data-home-scroll-ready");
    expect(css).not.toContain("min-height: var(--story-viewport)");
  });
});
