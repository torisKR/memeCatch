import { readFileSync } from "node:fs";
import type { ComponentPropsWithoutRef } from "react";
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
      data-scene
      data-scene-variant={variant}
      data-interactive-locale={locale}
      className={className}
    >
      {label}
    </figure>
  ),
}));

vi.mock("@/components/usage-guide", () => ({
  SafetySignalGuide: ({ locale = "ko" }: { locale?: SeoRouteLocale }) => (
    <section data-signal-guide={locale}>Signal guide</section>
  ),
}));

import {
  HomeExperience,
  type HomeEntry,
} from "@/components/home/home-experience";
import { HOME_COPY, HOME_LOCALES } from "@/lib/home-copy";
import { HOME_IMMERSIVE_COPY } from "@/lib/home-immersive-copy";
import type { SeoRouteLocale } from "@/lib/i18n-routing";
import { getSafetySignalCopy } from "@/lib/safety-copy";

const entry: HomeEntry = {
  id: "published-entry",
  href: "/memes/ABC123/published-entry",
  title: "Published entry",
  summary: "A real published summary.",
  categoryLabel: "Phrase",
  originalTitle: "공개된 항목",
  safetyLevel: "green",
};

function railEntries(count: number): HomeEntry[] {
  return Array.from({ length: count }, (_, index) => ({
    ...entry,
    id: `published-${index}`,
    title: index === 0 ? entry.title : `Published ${index}`,
    href: `/memes/ABC123/published-${index}`,
  }));
}

describe("HomeExperience", () => {
  it.each(HOME_LOCALES)("keeps the shared story and downstream section order for %s", (locale) => {
    const html = renderToStaticMarkup(
      <HomeExperience locale={locale} entries={railEntries(3)} />,
    );
    const sectionOrder = [...html.matchAll(/data-home-section="([^"]+)"/g)].map(
      (match) => match[1],
    );

    expect(sectionOrder).toEqual([
      "hero-search",
      "recent-content",
      "safety-showcase",
      "safety-quiz",
      "usage-signals",
      "pathways",
      "editorial-trust",
    ]);
    expect(html).toContain('id="home-top"');
    expect(html.match(/data-home-scroll-track=/g)).toHaveLength(1);
    expect(html.match(/data-home-scroll-pin=/g)).toHaveLength(1);
    expect(html).toContain('id="home-story-discover"');
    expect(html).toContain('id="home-story-context"');
    expect(html).toContain('id="home-story-participate"');
    expect(html).toContain('id="home-latest"');
    expect(html).toContain('id="home-signals"');
    expect(html).toContain('id="home-pathways"');
    expect(html).toContain('id="home-editorial"');
    for (const anchor of [
      "#home-story-discover",
      "#home-story-context",
      "#home-story-participate",
      "#home-latest",
      "#home-signals",
    ]) {
      expect(html).toContain(`href="${anchor}"`);
    }
    expect(html.match(/<h1[ >]/g)).toHaveLength(1);
    expect(html).toContain(`action="${locale === "ko" ? "/search" : `/${locale}/search`}"`);
    expect(html).toContain('href="/community"');
    expect(html).not.toContain('href="/products"');
    expect(html).toContain('href="/community/new"');
    expect(html).toContain('href="/submit"');
    expect(html).not.toContain('href="/products/new"');
    if (locale === "ko") {
      expect(html).toContain("오리지널 보러 가기");
      expect(html).toContain("밈 올리기");
      expect(html).toContain('href="/originals"');
    } else {
      expect(html).not.toContain("오리지널 보러 가기");
      expect(html).not.toContain("밈 올리기");
    }
    expect(html).toContain(
      `href="${locale === "ko" ? "/explore?sort=recent" : `/${locale}/explore?sort=recent`}"`,
    );
    expect(html).toContain('data-safety-icon="green"');
    expect(html).toContain(getSafetySignalCopy(locale).levels.green.label);
    expect(html).toContain('data-signal-guide=');
    expect(html).toContain(HOME_IMMERSIVE_COPY[locale].chapters[0].title);
  });

  it.each(HOME_LOCALES)("uses one persistent story scene for %s", (locale) => {
    const html = renderToStaticMarkup(<HomeExperience locale={locale} entries={[]} />);
    expect(html.match(/data-scene="true"/g)).toHaveLength(1);
    expect(html).toContain(`data-interactive-locale="${locale}"`);
    expect(html).toContain('data-scene-variant="story"');
    expect(html).not.toMatch(/data-scene[^>]*class="[^"]*(?:h-56|lg:h-80|xl:h-96)/);
    expect(html).toContain('data-home-artwork="immersive-story"');
  });

  it("renders a recent rail of at least 3 cards and hides a shorter one", () => {
    const populated = renderToStaticMarkup(
      <HomeExperience locale="en" entries={railEntries(3)} />,
    );
    expect(populated).toContain(entry.title);
    expect(populated).toContain(entry.summary);
    expect(populated).toContain('data-home-section="recent-content"');

    for (const count of [0, 1, 2]) {
      const hidden = renderToStaticMarkup(
        <HomeExperience locale="en" entries={railEntries(count)} />,
      );
      expect(hidden).not.toContain('data-home-section="recent-content"');
      expect(hidden).not.toContain('id="home-latest"');
      expect(hidden).not.toContain(HOME_COPY.en.recent.title);
      expect(hidden).not.toContain(HOME_COPY.en.recent.empty);
    }
  });

  it("keeps the pathway link row clear of the mobile chat launcher", () => {
    const css = readFileSync(new URL("./home-web3.module.css", import.meta.url), "utf8");
    const mobile = css.slice(css.indexOf("@media (max-width: 47.99rem)"));
    expect(mobile).toContain("padding-right: calc(4rem + 1rem + 2rem)");
    expect(mobile).toContain("margin-bottom: calc(4rem + 1rem)");
    expect(mobile).toContain("padding-right: calc(4rem + 1rem)");
  });
});
