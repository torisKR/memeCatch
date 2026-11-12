import type { ComponentPropsWithoutRef } from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock("@/components/home/home-scene", () => ({
  HomeScene: ({
    label,
    className,
    locale,
    variant,
  }: {
    label?: string;
    className?: string;
    locale?: string;
    variant?: string;
  }) => (
    <figure
      className={className}
      data-home-scene="true"
      data-interactive-locale={locale}
      data-scene-variant={variant}
    >
      {label}
    </figure>
  ),
}));

import { HomeImmersiveStory } from "@/components/home/home-immersive-story";
import {
  HOME_IMMERSIVE_COPY,
  HOME_IMMERSIVE_LOCALES,
} from "@/lib/home-immersive-copy";

describe("HomeImmersiveStory", () => {
  it.each(HOME_IMMERSIVE_LOCALES)(
    "server-renders one layered scene and three semantic chapters for %s",
    (locale) => {
      const html = renderToStaticMarkup(<HomeImmersiveStory locale={locale} />);
      const copy = HOME_IMMERSIVE_COPY[locale];

      expect(html).toContain('id="home-top"');
      expect(html).toContain('data-home-section="hero-search"');
      expect(html.match(/data-home-scroll-track=/g)).toHaveLength(1);
      expect(html.match(/data-home-scroll-pin=/g)).toHaveLength(1);
      expect(html.match(/data-home-scene="true"/g)).toHaveLength(1);
      expect(html).toContain('data-scene-variant="story"');
      expect(html).toContain(`data-interactive-locale="${locale}"`);

      expect(
        [...html.matchAll(/<section[^>]*data-story-chapter="([^"]+)"/g)].map(
          (match) => match[1],
        ),
      ).toEqual(["discover", "context", "participate"]);
      expect(html).toContain('id="home-story-discover"');
      expect(html).toContain('id="home-story-context"');
      expect(html).toContain('id="home-story-participate"');
      expect(html.match(/data-home-scroll-range=/g)).toHaveLength(1);
      // Search → persistent scene controls → later chapter actions is the
      // keyboard order, even though all share one CSS composition.
      const sceneIndex = html.indexOf('data-home-scene="true"');
      expect(html.indexOf('role="search"')).toBeLessThan(sceneIndex);
      expect(sceneIndex).toBeLessThan(html.indexOf('id="home-story-context"'));
      expect(html.match(/<h1[ >]/g)).toHaveLength(1);
      expect(html.match(/<h2[ >]/g)).toHaveLength(2);

      for (const [index, chapter] of copy.chapters.entries()) {
        expect(html).toContain(`href="${chapter.href}"`);
        expect(html).toContain(`0${index + 1}`);
        expect(html).toContain(chapter.title);
        expect(html).toContain(chapter.description);
      }

      expect(html).toContain('href="#home-latest"');
      expect(html).toContain('href="#home-signals"');
      expect(html).toContain('href="/community"');
      expect(html).not.toContain('href="/products"');
      expect(html).toContain('name="q"');
      expect(html).toContain(
        `action="${locale === "ko" ? "/search" : `/${locale}/search`}"`,
      );
      expect(html).toContain(copy.search.label);
      expect(html).toContain(copy.search.placeholder);
      expect(html).toContain(copy.search.button);
    },
  );

  it("defines one overlapping sticky composition with compact fallbacks", () => {
    const css = readFileSync(
      "components/home/home-immersive-story.module.css",
      "utf8",
    );

    expect(css).toContain('--story-header: 4rem');
    expect(css).toContain('--story-header: 6.75rem');
    expect(css).toContain('--story-bottom-nav: 4.75rem');
    expect(css).toContain('--story-controls-reserve: 64px');
    expect(css).toContain('.story[data-home-scroll-ready="true"] .composition');
    expect(css).toContain('grid-area: 1 / 1');
    expect(css).toContain('position: sticky');
    expect(css).toContain('min-height: var(--story-viewport)');
    expect(css).toContain("word-break: keep-all");
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toMatch(/\.chapter\s*\{[\s\S]*?pointer-events:\s*none/);
    expect(css).toMatch(/\.searchForm,[\s\S]*?\.actionRow\s*\{[\s\S]*?pointer-events:\s*auto/);
  });
});
