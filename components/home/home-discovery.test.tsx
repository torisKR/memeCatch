// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import type { ComponentPropsWithoutRef } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: ComponentPropsWithoutRef<"a">) => (
    <a {...props}>{children}</a>
  ),
}));

import {
  HomeDiscovery,
} from "@/components/home/home-discovery";
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
  vi.unstubAllGlobals();
});

function getDeck() {
  return screen.getByRole("list", { name: HOME_DISCOVERY_COPY.en.resultsLabel });
}

describe("HomeDiscovery", () => {
  it.each(SEO_ROUTE_LOCALES)(
    "server-renders every genuine recent record and localized UI for %s",
    (locale) => {
      const html = renderToStaticMarkup(
        <HomeDiscovery locale={locale} entries={entries} />,
      );
      const copy = HOME_DISCOVERY_COPY[locale];

      for (const entry of entries) {
        expect(html).toContain(entry.title);
        expect(html).toContain(entry.summary);
        expect(html).toContain(`href="${entry.href}"`);
      }
      expect(html).toContain(copy.searchScope);
      expect(html).toContain(copy.resultStatus(3, 3));
      expect(html.replace(/<[^>]+>/g, "")).toContain(copy.previewTitle);
      expect(html).not.toMatch(/likes|users online|minted/iu);
    },
  );

  it("keeps each real entry's safety signal attached to its card", () => {
    const { container } = render(<HomeDiscovery locale="en" entries={entries} />);
    const list = container.querySelector('[aria-label="Filtered recent entries"]');
    expect(list?.querySelectorAll('[data-safety-icon]')).toHaveLength(3);
    for (const entry of entries) {
      const card = [...list!.querySelectorAll('li')].find(node => node.textContent?.includes(entry.title));
      expect(card?.querySelector('[data-safety-icon]')?.getAttribute('data-safety-icon')).toBe(entry.safetyLevel);
    }
  });

  it("renders every home entry as the shared poster card without a 3D tilt", () => {
    const { container } = render(<HomeDiscovery locale="en" entries={entries} />);
    const cards = [...container.querySelectorAll<HTMLAnchorElement>("[data-meme-card]")];

    expect(cards).toHaveLength(entries.length);
    expect(cards.map((card) => card.getAttribute("href"))).toEqual(entries.map((entry) => entry.href));
    expect(cards.every((card) => card.getAttribute("data-tilt") === null)).toBe(true);
    expect(cards.every((card) => card.querySelector("[data-meme-card-art='fallback']"))).toBe(true);
    expect(cards.every((card) => card.className.includes("hover:-translate-y-0.5"))).toBe(true);
    expect(cards.every((card, index) => card.textContent?.includes(entries[index]!.title))).toBe(true);
    expect(cards.every((card, index) => card.textContent?.includes(entries[index]!.summary))).toBe(true);
    expect(container.querySelector("[data-safety-icon='green']")).toBeTruthy();
    expect(container.textContent).toContain("Safe to use");
    expect(container.textContent).not.toContain("써도 됨");

    fireEvent.pointerMove(cards[0]!, { clientX: 220, clientY: 20, pointerType: "mouse" });
    expect(cards[0]!.getAttribute("data-tilt")).toBeNull();
    expect(cards[0]!.style.getPropertyValue("--card-tilt-x")).toBe("");
  });

  it("normalizes Unicode and reports the exact filtered count", async () => {
    const user = userEvent.setup();
    render(<HomeDiscovery locale="en" entries={entries} />);

    await user.type(screen.getByRole("searchbox", { name: "Filter this recent set" }), "cat");

    expect(within(getDeck()).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("status").textContent).toBe("Showing 2 of 3 recent entries.");
    expect(within(getDeck()).getByText("ＣＡＴ 밈")).toBeTruthy();
    expect(within(getDeck()).getByText("Cat reaction video")).toBeTruthy();
  });

  it("derives category chips from records and combines category and text filters", async () => {
    const user = userEvent.setup();
    render(<HomeDiscovery locale="en" entries={entries} />);

    const categoryGroup = screen.getByRole("group", { name: "Filter by category" });
    expect(within(categoryGroup).getAllByRole("button").map((button) => button.textContent)).toEqual([
      "All",
      "Phrase",
      "Challenge",
      "Video",
    ]);

    await user.click(within(categoryGroup).getByRole("button", { name: "Phrase" }));
    await user.type(screen.getByRole("searchbox", { name: "Filter this recent set" }), "냥");

    expect(within(getDeck()).getAllByRole("listitem")).toHaveLength(1);
    expect(within(getDeck()).getByText("ＣＡＴ 밈")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Showing 1 of 3 recent entries.");
  });

  it("offers a localized no-results state that clears both filters", async () => {
    const user = userEvent.setup();
    render(<HomeDiscovery locale="en" entries={entries} />);

    await user.click(screen.getByRole("button", { name: "Challenge" }));
    await user.type(screen.getByRole("searchbox", { name: "Filter this recent set" }), "not-here");

    expect(screen.queryByRole("list", { name: "Filtered recent entries" })).toBeNull();
    expect(screen.getByText("No recent entries match")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe("Showing 0 of 3 recent entries.");

    await user.click(screen.getByRole("button", { name: "Clear filters" }));

    expect(within(getDeck()).getAllByRole("listitem")).toHaveLength(3);
    expect((screen.getByRole("searchbox", { name: "Filter this recent set" }) as HTMLInputElement).value)
      .toBe("");
    expect(screen.getByRole("button", { name: "All" }).getAttribute("aria-pressed")).toBe("true");
  });

  it.each(SEO_ROUTE_LOCALES)("offers full archive search without making a request for %s", async (locale) => {
    const user = userEvent.setup();
    const copy = HOME_DISCOVERY_COPY[locale];
    render(<HomeDiscovery locale={locale} entries={entries} />);
    await user.type(screen.getByRole("searchbox", { name: copy.searchLabel }), "  ＴＭＩ & 냥  ");
    const link = screen.getByRole("link", { name: copy.searchArchive("TMI & 냥") });
    expect(link.getAttribute("href")).toBe(`${locale === "ko" ? "" : `/${locale}`}/search?q=TMI+%26+%EB%83%A5`);
    expect(screen.getByRole("heading", { level: 3, name: copy.noResultsTitle })).toBeTruthy();
    expect(link.closest("form")?.getAttribute("method")).toBe("get");
    expect(screen.getByRole("searchbox", { name: copy.searchLabel }).getAttribute("name")).toBe("q");
  });

  it("shows owned 4:3 art and falls back instead of using an external still", () => {
    const owned = "/api/media/meme-card-art/cat.webp";
    const { container } = render(<HomeDiscovery locale="en" entries={[
      { ...entries[0]!, thumbnailUrl: owned, category: "image" },
      { ...entries[1]!, thumbnailUrl: "https://i.ytimg.com/vi/example/hqdefault.jpg" },
    ]} />);
    const cards = container.querySelectorAll<HTMLAnchorElement>("[data-meme-card]");
    const image = cards[0]!.querySelector("img")!;
    expect(image.getAttribute("src")).toBe(`${owned}?w=1200`);
    expect(image.getAttribute("srcset")).toContain(`${owned}?w=600 600w`);
    expect(image.getAttribute("alt")).toBe(`${entries[0]!.title} symbol illustration`);
    expect(cards[1]!.querySelector("img")).toBeNull();
    expect(cards[1]!.querySelector("[data-meme-card-art='fallback']")).toBeTruthy();
    expect(cards[1]!.innerHTML).not.toContain("hqdefault");
    fireEvent.error(image);
    expect(cards[0]!.querySelector("img")).toBeNull();
    expect(cards[0]!.querySelector("[data-meme-card-art='fallback']")).toBeTruthy();
    expect(cards[0]!.textContent).toContain(entries[0]!.title);
  });

  it("cycles a deterministic preview through real linked records", async () => {
    const user = userEvent.setup();
    render(<HomeDiscovery locale="en" entries={entries} />);

    const preview = screen.getByLabelText("Next pick preview");
    expect(within(preview).getByRole("link", { name: /ＣＡＴ 밈/u }).getAttribute("href"))
      .toBe(entries[0]?.href);

    await user.click(within(preview).getByRole("button", { name: "Show next pick" }));
    expect(within(preview).getByRole("link", { name: /Dance loop/u }).getAttribute("href"))
      .toBe(entries[1]?.href);

    await user.click(within(preview).getByRole("button", { name: "Show next pick" }));
    expect(within(preview).getByRole("link", { name: /Cat reaction video/u }).getAttribute("href"))
      .toBe(entries[2]?.href);

    await user.click(within(preview).getByRole("button", { name: "Show next pick" }));
    expect(within(preview).getByRole("link", { name: /ＣＡＴ 밈/u }).getAttribute("href"))
      .toBe(entries[0]?.href);
  });

  it("handles zero or one record without fake preview data", () => {
    const { rerender } = render(<HomeDiscovery locale="en" entries={[]} />);

    expect(screen.getByText("No recent entries are available")).toBeTruthy();
    expect(screen.queryByLabelText("Next pick preview")).toBeNull();
    expect(screen.queryByRole("searchbox")).toBeNull();

    rerender(<HomeDiscovery locale="en" entries={[entries[1]!]} />);

    const preview = screen.getByLabelText("Next pick preview");
    expect(within(preview).getByText("Dance loop")).toBeTruthy();
    expect((within(preview).getByRole("button", { name: "Show next pick" }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it("resets an invalid category and preview position when props and locale change", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<HomeDiscovery locale="en" entries={entries} />);

    await user.click(screen.getByRole("button", { name: "Show next pick" }));
    expect(within(screen.getByLabelText("Next pick preview")).getByText("Dance loop"))
      .toBeTruthy();

    rerender(<HomeDiscovery locale="ja" entries={entries} />);

    expect(within(screen.getByLabelText(HOME_DISCOVERY_COPY.ja.previewLabel)).getByText("ＣＡＴ 밈"))
      .toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Video" }));
    rerender(<HomeDiscovery locale="ja" entries={[entries[1]!]} />);

    expect(screen.queryByRole("button", { name: "Video" })).toBeNull();
    expect(screen.getByRole("button", { name: HOME_DISCOVERY_COPY.ja.allCategories }).getAttribute("aria-pressed"))
      .toBe("true");
    expect(screen.getByRole("status").textContent).toBe(
      HOME_DISCOVERY_COPY.ja.resultStatus(1, 1),
    );
    expect(within(screen.getByLabelText(HOME_DISCOVERY_COPY.ja.previewLabel)).getByText("Dance loop"))
      .toBeTruthy();
  });

  it("keeps Korean heading breaks and lets ja/zh/zh-tw wrap the title and discovery headings", () => {
    const css = readFileSync("components/home/home-discovery.module.css", "utf8");
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    document.body.innerHTML = `
      <h2 class="title">title</h2>
      <aside class="preview"><h3>preview</h3></aside>
      <div class="emptyState"><h3>empty</h3></div>
    `;

    try {
      document.documentElement.lang = "ko";
      const title = getComputedStyle(document.querySelector(".title")!);
      const preview = getComputedStyle(document.querySelector(".preview h3")!);
      const empty = getComputedStyle(document.querySelector(".emptyState h3")!);
      expect(title.wordBreak).toBe("keep-all");
      expect(preview.wordBreak).toBe("keep-all");
      expect(preview.overflowWrap).toBe("normal");
      expect(empty.wordBreak).toBe("keep-all");

      for (const lang of ["ja", "zh", "zh-Hans", "zh-Hant"]) {
        document.documentElement.lang = lang;
        expect(getComputedStyle(document.querySelector(".title")!).wordBreak).toBe("normal");
        expect(getComputedStyle(document.querySelector(".title")!).overflowWrap).toBe("anywhere");
        for (const node of [
          document.querySelector(".preview h3"),
          document.querySelector(".emptyState h3"),
        ]) {
          const computed = getComputedStyle(node!);
          expect(computed.wordBreak).toBe("auto-phrase");
          expect(computed.overflowWrap).toBe("anywhere");
          expect(computed.lineBreak).toBe("strict");
        }
      }
    } finally {
      style.remove();
      document.body.innerHTML = "";
      document.documentElement.lang = "en";
    }
  });

  it("uses auto-phrase for the ja/zh preview heading from 64rem and leaves ko and en on keep-all", () => {
    const css = readFileSync("components/home/home-discovery.module.css", "utf8");
    const desktop = css.match(
      /@media \(min-width: 64rem\) \{\s*:lang\(ja\) \.preview h3,\s*:lang\(zh\) \.preview h3 \{([^}]+)\}/,
    );
    expect(desktop).not.toBeNull();
    const declarations = desktop?.[1] ?? "";
    expect(declarations).toContain("font-size: clamp(1.75rem, 2.75vw, 2.2rem);");
    expect(declarations).toContain("word-break: auto-phrase;");
    expect(declarations).toContain("overflow-wrap: anywhere;");
    expect(declarations).toContain("line-break: strict;");

    const korean = css.match(
      /@media \(min-width: 64rem\) \{\s*:lang\(ja\) \.preview h3,\s*:lang\(zh\) \.preview h3 \{[^}]+\}\s*:lang\(ko\) \.preview h3 \{([^}]+)\}/,
    );
    expect(korean).not.toBeNull();
    const koreanDeclarations = korean?.[1] ?? "";
    expect(koreanDeclarations).toContain("font-size: clamp(1.75rem, 2.75vw, 2.2rem);");
    expect(koreanDeclarations).not.toContain("word-break");
    expect(koreanDeclarations).not.toContain("overflow-wrap");

    // jsdom does not evaluate min-width media features, so the 64rem block never
    // becomes computed style on its own. The declarations are copied from that block.
    const style = document.createElement("style");
    style.textContent = `${css}\n:lang(ja) .preview h3, :lang(zh) .preview h3 {${declarations}}`;
    document.head.appendChild(style);
    document.body.innerHTML = `
      <h2 class="title">title</h2>
      <aside class="preview"><h3>preview</h3></aside>
    `;

    try {
      for (const lang of ["ja", "zh", "zh-Hans", "zh-Hant"]) {
        document.documentElement.lang = lang;
        const preview = getComputedStyle(document.querySelector(".preview h3")!);
        expect(preview.wordBreak).toBe("auto-phrase");
        expect(preview.overflowWrap).toBe("anywhere");
        expect(preview.lineBreak).toBe("strict");
        expect(getComputedStyle(document.querySelector(".title")!).wordBreak).toBe("normal");
      }

      for (const lang of ["ko", "en"]) {
        document.documentElement.lang = lang;
        const preview = getComputedStyle(document.querySelector(".preview h3")!);
        expect(preview.wordBreak).toBe("keep-all");
        expect(preview.overflowWrap).toBe("normal");
      }
    } finally {
      style.remove();
      document.body.innerHTML = "";
      document.documentElement.lang = "en";
    }
  });

  it("keeps Japanese heading phrases whole when auto-phrase is dropped", async () => {
    const user = userEvent.setup();
    const css = readFileSync("components/home/home-discovery.module.css", "utf8");
    expect(css.match(/word-break: normal;\n\s*word-break: auto-phrase;/g)).toHaveLength(3);
    expect(css).toContain(".keepPhrase {\n  white-space: nowrap;\n}");

    const copy = HOME_DISCOVERY_COPY.ja;
    const { container } = render(<HomeDiscovery locale="ja" entries={entries} />);
    const preview = within(screen.getByLabelText(copy.previewLabel)).getByRole("heading", { level: 3 });
    expect([...preview.querySelectorAll("span")].map((span) => span.textContent)).toEqual([
      "まず一つ",
      "読んで",
      "みませんか",
    ]);
    expect(preview.textContent).toBe(copy.previewTitle);

    await user.type(screen.getByRole("searchbox", { name: copy.searchLabel }), "zzzz-no-match-qa");
    const empty = container.querySelector("h3");
    expect(empty?.textContent).toBe(copy.noResultsTitle);
    expect(empty?.querySelector("span")?.textContent).toBe("ありません");

    cleanup();
    render(<HomeDiscovery locale="ja" entries={[]} />);
    const unavailable = screen.getByRole("heading", { level: 3 });
    expect(unavailable.textContent).toBe(copy.emptyTitle);
    expect(unavailable.querySelector("span")?.textContent).toBe("ありません");
  });
});
