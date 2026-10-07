import type { ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemeCollectibleGallery } from "@/components/meme-collectible-gallery";

const loaders = vi.hoisted(() => ({ catalog: vi.fn(), card: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/meme-collectible.server", () => ({ getMemeCardCatalogPage: loaders.catalog, getMemeCollectibleCard: loaders.card }));
vi.mock("@/lib/supabase/server", () => ({ createClient: loaders.auth }));
vi.mock("@/components/meme-collectible-gallery", () => ({ MemeCollectibleGallery: (props: ComponentProps<typeof MemeCollectibleGallery>) => <div data-page={props.catalog.page} data-card-id={props.initialSelected?.id} data-revealed={props.initialRevealed} data-selected-missing={props.selectedMissing}/> }));
import MemeCardsPage from "./page";

beforeEach(() => {
  loaders.catalog.mockImplementation(async ({ page }: { page: number }) => ({ page, cards: [], total: 1000, pageSize: 24, hasMore: true }));
  loaders.card.mockResolvedValue({ id: "mc-0042" });
});
describe("public meme card page", () => {
  it("hydrates the exact revealed card after login even when it differs from the catalog page", async () => {
    const element = await MemeCardsPage({ searchParams: Promise.resolve({ page: "3", card: "mc-0042", revealed: "1", query: "PPAP" }) });
    const html = renderToStaticMarkup(element);
    expect(html).toContain('data-card-id="mc-0042"'); expect(html).toContain('data-revealed="true"');
    expect(loaders.catalog).toHaveBeenCalledWith(expect.objectContaining({ page: 3, query: "PPAP" }));
    expect(loaders.card).toHaveBeenCalledWith("mc-0042"); expect(loaders.auth).not.toHaveBeenCalled();
  });
  it("reports unavailable return cards instead of silently selecting a different one", async () => {
    loaders.card.mockResolvedValue(null);
    const html = renderToStaticMarkup(await MemeCardsPage({ searchParams: Promise.resolve({ card: "mc-0042", revealed: "1" }) }));
    expect(html).toContain('data-selected-missing="true"'); expect(html).not.toContain("data-card-id");
  });
  it("does not query arbitrary card ids or create unbounded catalog page keys", async () => {
    await MemeCardsPage({ searchParams: Promise.resolve({ card: "https://example.test", page: "99999" }) });
    expect(loaders.card).not.toHaveBeenCalled(); expect(loaders.catalog).toHaveBeenCalledWith({ page: 1 });
  });
});
