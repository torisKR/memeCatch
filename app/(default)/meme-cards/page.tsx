import type { Metadata } from "next";
import { MemeCollectibleGallery } from "@/components/meme-collectible-gallery";
import { getMemeCardCatalogPage, getMemeCollectibleCard } from "@/lib/meme-collectible.server";
import { isMemeCardId, parseMemeCardPage, type MemeCardDiscoveryPage } from "@/lib/meme-collectible";

export const metadata: Metadata = {
  title: "밈카드",
  description: "원하는 밈카드를 긁어 공개하고 내 무료 컬렉션에 모으세요.",
  alternates: { canonical: "/meme-cards" },
};

export default async function MemeCardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const page = parseMemeCardPage(typeof sp.page === "string" ? sp.page : null) ?? 1;
  const cardId = isMemeCardId(sp.card) ? sp.card : null;
  const [catalog, selected] = await Promise.all([
    getMemeCardCatalogPage({ page }),
    cardId ? getMemeCollectibleCard(cardId) : Promise.resolve(null),
  ]);
  const discovery: MemeCardDiscoveryPage = {
    cards: catalog.cards.map(({ id }) => ({ id })),
    total: catalog.total,
    page: catalog.page,
    pageSize: catalog.pageSize,
    hasMore: catalog.hasMore,
  };
  const initialRevealed = Boolean(selected && sp.revealed === "1");
  return <MemeCollectibleGallery
    key={`${catalog.page}:${cardId ?? ""}:${initialRevealed}`}
    catalog={discovery}
    initialSelected={selected ? { id: selected.id } : null}
    initialCard={initialRevealed ? selected : null}
    initialRevealed={initialRevealed}
    selectedMissing={Boolean(cardId && !selected)}
  />;
}
