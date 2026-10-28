// @vitest-environment jsdom

import type { ComponentPropsWithoutRef } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import { HomeDiscovery } from "@/components/home/home-discovery";
import type { HomeEntry } from "@/components/home/home-experience";
import { HOME_DISCOVERY_COPY } from "@/lib/home-discovery-copy";
import { SEO_ROUTE_LOCALES } from "@/lib/i18n-routing";

const entries: readonly HomeEntry[] = [
  {
    id: "cat-phrase",
    href: "/memes/CAT123/cat-phrase",
    title: "ＣＡＴ 밈",
    summary: "A full-width cat phrase with 냥 context.",
    categoryLabel: "Phrase",
    originalTitle: "고양이 밈",
    safetyLevel: "green",
  },
  {
    id: "dance-loop",
    href: "/memes/DANCE1/dance-loop",
    title: "Dance loop",
    summary: "A short challenge explanation.",
    categoryLabel: "Challenge",
    safetyLevel: "yellow",
  },
  {
    id: "cat-video",
    href: "/memes/CATVID/cat-video",
    title: "Cat reaction video",
    summary: "A reaction clip explained without invented metrics.",
    categoryLabel: "Video",
    safetyLevel: "gray",
  },
];

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("HomeDiscovery", () => {
  it.each(SEO_ROUTE_LOCALES)("renders every genuine record with compact localized copy for %s", (locale) => {
    const html = renderToStaticMarkup(<HomeDiscovery locale={locale} entries={entries} />);
    const copy = HOME_DISCOVERY_COPY[locale];

    expect(html).toContain(copy.title);
    expect(html).toContain(`aria-label="${copy.resultsLabel}"`);
    for (const entry of entries) {
      expect(html).toContain(entry.title);
      expect(html).toContain(entry.summary);
      expect(html).toContain(`href="${entry.href}"`);
    }
    expect(html).not.toMatch(/likes|users online|minted/iu);
    expect(html).not.toContain("data-interactive-card");
    expect(html).not.toContain("preview");
  });

  it("keeps each real entry's safety signal attached to its link", () => {
    render(<HomeDiscovery locale="en" entries={entries} />);
    const list = screen.getByRole("list", { name: HOME_DISCOVERY_COPY.en.resultsLabel });

    for (const entry of entries) {
      const link = within(list).getByRole("link", { name: new RegExp(entry.title, "u") });
      expect(link.querySelector("[data-safety-icon]")?.getAttribute("data-safety-icon"))
        .toBe(entry.safetyLevel);
    }
  });

  it("renders a real thumbnail and falls back cleanly if it fails", () => {
    render(<HomeDiscovery locale="en" entries={[
      { ...entries[0]!, thumbnailUrl: "https://images.example.com/cat.jpg", category: "image" },
    ]} />);
    const image = document.querySelector("img")!;

    expect(image.getAttribute("src")).toBe("https://images.example.com/cat.jpg");
    fireEvent.error(image);
    expect(document.querySelector("img")).toBeNull();
    expect(document.querySelector('[data-thumbnail-state="fallback"]')).toBeTruthy();
  });

  it("renders only the heading when no real entries exist", () => {
    render(<HomeDiscovery locale="en" entries={[]} />);

    expect(screen.getByRole("heading", { name: HOME_DISCOVERY_COPY.en.title })).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();
  });

  it("keeps multiple real meme titles in the same compact list", () => {
    render(<HomeDiscovery locale="ko" entries={entries} />);
    const list = screen.getByRole("list", { name: HOME_DISCOVERY_COPY.ko.resultsLabel });

    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByRole("link", { name: new RegExp(entries[0]!.title, "u") })).toBeTruthy();
    expect(within(list).getByRole("link", { name: new RegExp(entries[1]!.title, "u") })).toBeTruthy();
    expect(list.querySelector('[data-thumbnail-state="fallback"]')).toBeNull();
    expect(list.querySelectorAll("img")).toHaveLength(0);
  });
});
