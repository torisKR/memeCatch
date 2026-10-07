import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeCollectibleGallery } from "@/components/meme-collectible-gallery";
import type { MemeCollectibleCard } from "@/lib/meme-collectible";

type GalleryProps = ComponentProps<typeof MemeCollectibleGallery>;
const loaders = vi.hoisted(() => ({ catalog: vi.fn(), card: vi.fn(), auth: vi.fn(), gallery: vi.fn() }));
vi.mock("@/lib/meme-collectible.server", () => ({ getMemeCardCatalogPage: loaders.catalog, getMemeCollectibleCard: loaders.card }));
vi.mock("@/lib/supabase/server", () => ({ createClient: loaders.auth }));
vi.mock("@/components/meme-collectible-gallery", () => ({
  MemeCollectibleGallery: (props: GalleryProps) => {
    loaders.gallery(props);
    return <div data-card-id={props.initialSelected?.id} data-revealed={props.initialRevealed} data-selected-missing={props.selectedMissing}>{JSON.stringify(props)}</div>;
  },
}));
import MemeCardsPage from "./page";

const catalogCard: MemeCollectibleCard = {
  id: "mc-0001", cardNo: 1, edition: 1, artSeed: 42, memeId: "meme-a",
  title: "Secret catalog title", slug: "secret-catalog", href: "/memes/abc123-secret-catalog",
  summary: "Secret catalog summary", category: "song", originYear: 2016,
  thumbnailUrl: "https://example.test/secret-catalog.png", artMotif: "pen-pineapple",
  artSymbols: ["secret-symbol"], artComposition: "exchange",
};
const selectedCard: MemeCollectibleCard = {
  ...catalogCard, id: "mc-0042", cardNo: 42, title: "Secret selected title", summary: "Secret selected summary",
};

beforeEach(() => {
  vi.clearAllMocks();
  loaders.catalog.mockImplementation(async ({ page }: { page: number }) => ({ page, cards: [catalogCard], total: 1000, pageSize: 24, hasMore: true }));
  loaders.card.mockResolvedValue(selectedCard);
});

async function renderPage(params: Record<string, string | string[] | undefined>) {
  const html = renderToStaticMarkup(await MemeCardsPage({ searchParams: Promise.resolve(params) }));
  const props = loaders.gallery.mock.lastCall?.[0] as GalleryProps;
  return { html, props };
}

function expectSealed(props: GalleryProps, html: string) {
  expect(props.catalog.cards).toEqual([{ id: "mc-0001" }]);
  expect(props.initialCard).toBeNull();
  expect(props.initialRevealed).toBe(false);
  const serialized = JSON.stringify(props);
  for (const field of ["title", "summary", "category", "cardNo", "edition", "artSeed", "memeId", "slug", "href", "originYear", "thumbnailUrl", "artMotif", "artSymbols", "artComposition"]) {
    expect(serialized).not.toContain(`"${field}"`);
  }
  for (const secret of [catalogCard.title, catalogCard.summary, selectedCard.title, selectedCard.summary, catalogCard.artSymbols[0]]) {
    expect(html).not.toContain(secret);
  }
}

describe("sealed public meme card page", () => {
  it("passes only card seals and pagination into the client before discovery", async () => {
    const { html, props } = await renderPage({});
    expect(props).toEqual({
      catalog: { cards: [{ id: "mc-0001" }], total: 1000, page: 1, pageSize: 24, hasMore: true },
      initialSelected: null, initialCard: null, initialRevealed: false, selectedMissing: false,
    });
    expectSealed(props, html);
    expect(loaders.catalog).toHaveBeenCalledWith({ page: 1 });
    expect(loaders.card).not.toHaveBeenCalled();
    expect(loaders.auth).not.toHaveBeenCalled();
  });

  it("keeps an eligible selected card sealed until an explicit previous reveal", async () => {
    const { html, props } = await renderPage({ card: "mc-0042" });
    expect(props.initialSelected).toEqual({ id: "mc-0042" });
    expect(props.selectedMissing).toBe(false);
    expectSealed(props, html);
    expect(loaders.card).toHaveBeenCalledWith("mc-0042");
    expect(loaders.auth).not.toHaveBeenCalled();
  });

  it("hydrates the exact revealed card after login even when it differs from the catalog page", async () => {
    const { html, props } = await renderPage({ page: "3", card: "mc-0042", revealed: "1", query: "PPAP", category: "song" });
    expect(props.catalog.cards).toEqual([{ id: "mc-0001" }]);
    expect(props.initialSelected).toEqual({ id: "mc-0042" });
    expect(props.initialCard).toEqual(selectedCard);
    expect(props.initialRevealed).toBe(true);
    expect(html).toContain(selectedCard.title);
    expect(html).not.toContain(catalogCard.title);
    expect(loaders.catalog).toHaveBeenCalledWith({ page: 3 });
    expect(loaders.card).toHaveBeenCalledWith("mc-0042");
    expect(loaders.auth).not.toHaveBeenCalled();
  });

  it.each([{ revealed: undefined }, { revealed: "true" }, { revealed: "0" }, { revealed: ["1"] }])("does not restore full card content for other reveal values: %j", async ({ revealed }) => {
    const { html, props } = await renderPage({ card: "mc-0042", revealed });
    expect(props.initialSelected).toEqual({ id: "mc-0042" });
    expectSealed(props, html);
  });

  it("reports withdrawn return cards without revealing stale content or selecting a replacement", async () => {
    loaders.card.mockResolvedValue(null);
    const { html, props } = await renderPage({ card: "mc-0042", revealed: "1" });
    expect(props.initialSelected).toBeNull();
    expect(props.selectedMissing).toBe(true);
    expectSealed(props, html);
    expect(loaders.card).toHaveBeenCalledWith("mc-0042");
  });

  it.each([{ card: "https://example.test" }, { card: "mc-0000" }, { card: "mc-1001" }, { card: ["mc-0042"] }])("does not query invalid or ambiguous selected card IDs: %j", async ({ card }) => {
    const { html, props } = await renderPage({ card, revealed: "1" });
    expect(props.initialSelected).toBeNull();
    expect(props.selectedMissing).toBe(false);
    expectSealed(props, html);
    expect(loaders.card).not.toHaveBeenCalled();
  });

  it.each([{ page: "99999" }, { page: "43" }, { page: "0" }, { page: "01" }, { page: ["2", "3"] }])("falls back to one bounded catalog page for invalid pagination: %j", async ({ page }) => {
    await renderPage({ page });
    expect(loaders.catalog).toHaveBeenCalledWith({ page: 1 });
  });

  it("ignores old discovery search and category parameters while retaining valid pagination", async () => {
    const { html, props } = await renderPage({ page: "2", query: "a".repeat(200), category: ["song", "unknown"] });
    expect(loaders.catalog).toHaveBeenCalledWith({ page: 2 });
    expect(props).not.toHaveProperty("query");
    expect(props).not.toHaveProperty("category");
    expectSealed(props, html);
  });
});
