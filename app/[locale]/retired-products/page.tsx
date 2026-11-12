import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RetiredProductsPage } from "@/components/retired-products-page";
import { isSeoContentLocale } from "@/lib/i18n-routing";
import { loadRetiredProductMemes } from "@/lib/retired-product-memes";
import {
  RETIRED_PRODUCTS_ROBOTS,
  type RetiredProductLocale,
} from "@/lib/retired-products";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }> };

function pageLocale(locale: string): RetiredProductLocale {
  return locale === "en" ? "en" : "ko";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) return { robots: { index: false, follow: false } };
  const copyLocale = pageLocale(locale);
  return {
    title:
      copyLocale === "en"
        ? "Meme product pages are no longer available"
        : "밈상품 페이지는 더 이상 운영하지 않아요",
    robots: RETIRED_PRODUCTS_ROBOTS,
  };
}

export default async function LocalizedRetiredProductsPage({ params }: Props) {
  const { locale } = await params;
  if (!isSeoContentLocale(locale)) notFound();
  const memes = await loadRetiredProductMemes();
  return <RetiredProductsPage locale={pageLocale(locale)} memes={memes} />;
}
