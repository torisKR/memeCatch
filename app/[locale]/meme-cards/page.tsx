import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MemeCollectibleGallery } from "@/components/meme-collectible-gallery";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";
import { buildLocalizedMetadata, isSeoContentLocale } from "@/lib/i18n-routing";
import { isMemeCardId, parseMemeCardPage, type MemeCardDiscoveryPage } from "@/lib/meme-collectible";
import { getMemeCardCatalogPage, getMemeCollectibleCard } from "@/lib/meme-collectible.server";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };
  const copy = MEME_CARDS_COPY[locale];
  return buildLocalizedMetadata({
    locale,
    pathname: "/meme-cards",
    title: copy.title,
    description: copy.description,
  });
}

export default async function LocalizedMemeCardsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) notFound();

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
  return (
    <MemeCollectibleGallery
      key={`${catalog.page}:${cardId ?? ""}:${initialRevealed}`}
      catalog={discovery}
      initialSelected={selected ? { id: selected.id } : null}
      initialCard={initialRevealed ? selected : null}
      initialRevealed={initialRevealed}
      selectedMissing={Boolean(cardId && !selected)}
    />
  );
}
