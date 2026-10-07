import type { Metadata } from "next";
import { MemeCollectibleGallery } from "@/components/meme-collectible-gallery";
import { getMemeCardCatalogPage, getMemeCollectibleCard } from "@/lib/meme-collectible.server";
import { isMemeCardId, parseMemeCardPageOptions } from "@/lib/meme-collectible";

export const metadata: Metadata = {
  title: "밈카드",
  description: "원하는 밈카드를 긁어 공개하고 내 무료 컬렉션에 모으세요.",
  alternates: { canonical: "/meme-cards" },
};

export default async function MemeCardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const params = new URLSearchParams();
  for (const key of ["page", "query", "category"]) {
    const value = sp[key];
    if (typeof value === "string") params.set(key, value);
  }
  const options = parseMemeCardPageOptions(params) ?? { page: 1 };
  const cardId = isMemeCardId(sp.card) ? sp.card : null;
  const [catalog, selected] = await Promise.all([
    getMemeCardCatalogPage(options),
    cardId ? getMemeCollectibleCard(cardId) : Promise.resolve(null),
  ]);
  return <MemeCollectibleGallery key={`${catalog.page}:${options.query ?? ""}:${options.category ?? ""}:${cardId ?? ""}:${sp.revealed === "1"}`} catalog={catalog} initialSelected={selected} initialRevealed={sp.revealed === "1"} selectedMissing={Boolean(cardId && !selected)} query={options.query} category={options.category}/>;
}
