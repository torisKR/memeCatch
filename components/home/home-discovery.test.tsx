// @vitest-environment jsdom

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

function mockInteractionMedia({
  finePointer = true,
  reducedMotion = false,
}: {
  finePointer?: boolean;
  reducedMotion?: boolean;
} = {}) {
  const records = new Map<string, {
    listeners: Set<(event: MediaQueryListEvent) => void>;
    mediaQuery: MediaQueryList;
  }>();

  vi.stubGlobal("matchMedia", vi.fn((query: string) => {
    const listeners = new Set<(event: MediaQueryListEvent) => void>();
    const initialMatches = query === "(pointer: fine)" ? finePointer : reducedMotion;
    const mediaQuery = {
      matches: initialMatches,
      media: query,
      onchange: null,
      addEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.add(listener);
      }),
      removeEventListener: vi.fn((_name: string, listener: (event: MediaQueryListEvent) => void) => {
        listeners.delete(listener);
      }),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList;
    records.set(query, { listeners, mediaQuery });
    return mediaQuery;
  }));

  return {
    emit(query: "(pointer: fine)" | "(prefers-reduced-motion: reduce)", matches: boolean) {
      const record = records.get(query);
      if (!record) throw new Error(`No media query registered for ${query}`);
      Object.defineProperty(record.mediaQuery, "matches", {
        configurable: true,
        value: matches,
      });
      record.listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent));
    },
  };
}

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
      expect(html).toContain(copy.previewTitle);
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

  it("server-renders an original abstract print inside every native card link", () => {
    const { container } = render(<HomeDiscovery locale="en" entries={entries} />);
    const cards = [...container.querySelectorAll<HTMLAnchorElement>("a[data-interactive-card]")];

    expect(cards).toHaveLength(entries.length);
    expect(cards.map((card) => card.getAttribute("href"))).toEqual(entries.map((entry) => entry.href));
    expect(cards.map((card) => card.getAttribute("data-tilt"))).toEqual(["0,0", "0,0", "0,0"]);
    expect(cards.map((card) => card.querySelector("[data-card-artwork]")?.getAttribute("data-card-artwork")))
      .toEqual(["orbit", "cutout", "signal"]);
    expect(cards.every((card) => card.querySelector("svg[aria-hidden='true']"))).toBe(true);
    expect(cards.every((card, index) => card.textContent?.includes(entries[index]!.title))).toBe(true);
    expect(cards.every((card, index) => card.textContent?.includes(entries[index]!.summary))).toBe(true);
  });

  it("applies capped fine-pointer tilt and spotlight without scheduling animation frames", () => {
    mockInteractionMedia();
    const requestAnimationFrame = vi.fn();
    vi.stubGlobal("requestAnimationFrame", requestAnimationFrame);
    const { container } = render(<HomeDiscovery locale="en" entries={entries} />);
    const card = container.querySelector<HTMLElement>("[data-interactive-card]")!;
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      bottom: 120,
      height: 100,
      left: 20,
      right: 220,
      top: 20,
      width: 200,
      x: 20,
      y: 20,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(card, { clientX: 220, clientY: 20, pointerType: "mouse" });

    expect(card.style.getPropertyValue("--card-tilt-x")).toBe("4.00deg");
    expect(card.style.getPropertyValue("--card-tilt-y")).toBe("4.00deg");
    expect(card.style.getPropertyValue("--card-light-x")).toBe("100.00%");
    expect(card.style.getPropertyValue("--card-light-y")).toBe("0.00%");
    expect(card.getAttribute("data-tilt")).toBe("4.00,4.00");
    expect(requestAnimationFrame).not.toHaveBeenCalled();

    fireEvent.pointerLeave(card);

    expect(card.style.getPropertyValue("--card-tilt-x")).toBe("");
    expect(card.style.getPropertyValue("--card-tilt-y")).toBe("");
    expect(card.style.getPropertyValue("--card-light-x")).toBe("");
    expect(card.style.getPropertyValue("--card-light-y")).toBe("");
    expect(card.getAttribute("data-tilt")).toBe("0,0");
  });

  it("resets active cards on media changes and unmount", () => {
    const media = mockInteractionMedia();
    const { container, unmount } = render(<HomeDiscovery locale="en" entries={entries} />);
    const card = container.querySelector<HTMLElement>("[data-interactive-card]")!;
    vi.spyOn(card, "getBoundingClientRect").mockReturnValue({
      bottom: 100,
      height: 100,
      left: 0,
      right: 100,
      top: 0,
      width: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.pointerMove(card, { clientX: 75, clientY: 25, pointerType: "mouse" });
    expect(card.getAttribute("data-tilt")).not.toBe("0,0");

    media.emit("(pointer: fine)", false);
    expect(card.getAttribute("data-tilt")).toBe("0,0");
    expect(card.getAttribute("data-pointer-active")).toBeNull();

    media.emit("(pointer: fine)", true);
    fireEvent.pointerMove(card, { clientX: 75, clientY: 25, pointerType: "mouse" });
    expect(card.getAttribute("data-tilt")).not.toBe("0,0");

    media.emit("(prefers-reduced-motion: reduce)", true);
    expect(card.getAttribute("data-tilt")).toBe("0,0");
    expect(card.getAttribute("data-pointer-active")).toBeNull();

    media.emit("(prefers-reduced-motion: reduce)", false);
    fireEvent.pointerMove(card, { clientX: 75, clientY: 25, pointerType: "mouse" });
    expect(card.getAttribute("data-tilt")).not.toBe("0,0");

    unmount();
    expect(card.style.getPropertyValue("--card-tilt-x")).toBe("");
    expect(card.style.getPropertyValue("--card-light-x")).toBe("");
    expect(card.getAttribute("data-tilt")).toBe("0,0");
    expect(card.getAttribute("data-pointer-active")).toBeNull();
  });

  it.each([
    { finePointer: false, reducedMotion: false, label: "coarse pointer" },
    { finePointer: true, reducedMotion: true, label: "reduced motion" },
  ])("keeps $label input inert", ({ finePointer, reducedMotion }) => {
    mockInteractionMedia({ finePointer, reducedMotion });
    const { container } = render(<HomeDiscovery locale="en" entries={entries} />);
    const card = container.querySelector<HTMLElement>("[data-interactive-card]")!;
    vi.spyOn(card, "getBoundingClientRect");

    fireEvent.pointerMove(card, { clientX: 80, clientY: 20, pointerType: "mouse" });

    expect(card.getBoundingClientRect).not.toHaveBeenCalled();
    expect(card.getAttribute("data-tilt")).toBe("0,0");
    expect(card.getAttribute("style")).toBeNull();
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
    expect(screen.getByText(copy.noResultsTitle)).toBeTruthy();
    expect(link.closest("form")?.getAttribute("method")).toBe("get");
    expect(screen.getByRole("searchbox", { name: copy.searchLabel }).getAttribute("name")).toBe("q");
  });

  it("renders a real representative thumbnail and keeps the original art when it fails", () => {
    const { container } = render(<HomeDiscovery locale="en" entries={[
      { ...entries[0]!, thumbnailUrl: "https://images.example.com/cat.jpg", category: "image" },
      entries[1]!,
    ]} />);
    const cards = container.querySelectorAll<HTMLAnchorElement>("a[data-interactive-card]");
    const image = cards[0]!.querySelector("img")!;
    expect(image.getAttribute("src")).toBe("https://images.example.com/cat.jpg");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("alt")).toBe("");
    expect(cards[0]!.querySelector("[data-card-artwork]")).toBeNull();
    expect(cards[1]!.querySelector("[data-card-artwork]")?.getAttribute("data-card-artwork")).toBe("cutout");
    fireEvent.error(image);
    expect(cards[0]!.querySelector("img")).toBeNull();
    expect(cards[0]!.querySelector("[data-card-artwork]")?.getAttribute("data-card-artwork")).toBe("orbit");
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
});
