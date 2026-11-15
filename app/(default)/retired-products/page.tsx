import type { Metadata } from "next";
import { RetiredProductsPage } from "@/components/retired-products-page";
import { loadRetiredProductMemes } from "@/lib/retired-product-memes";
import { RETIRED_PRODUCTS_ROBOTS } from "@/lib/retired-products";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "밈상품 페이지는 더 이상 운영하지 않아요",
  robots: RETIRED_PRODUCTS_ROBOTS,
};

export default async function KoreanRetiredProductsPage() {
  const memes = await loadRetiredProductMemes();
  return <RetiredProductsPage locale="ko" memes={memes} />;
}
