import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RetiredProductsPage } from "@/components/retired-products-page";
import { loadRetiredProductMemes } from "@/lib/retired-product-memes";
import { RETIRED_PRODUCTS_ROBOTS } from "@/lib/retired-products";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (locale !== "en") return { robots: { index: false, follow: false } };
  return {
    title: "Meme product pages are no longer available",
    robots: RETIRED_PRODUCTS_ROBOTS,
  };
}

export default async function LocalizedRetiredProductsPage({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") notFound();
  const memes = await loadRetiredProductMemes();
  return <RetiredProductsPage locale="en" memes={memes} />;
}
