import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CreatorProductForm } from "@/components/creator-products/creator-product-form";
import { createClient } from "@/lib/supabase/server";
import { getMyCreatorProducts } from "@/lib/creator-products/server";

export const metadata: Metadata = {
  title: "상품 등록 · 밈캐치",
  robots: { index: false, follow: true },
};

export default async function NewCreatorProductPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const params = await searchParams;
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(params.edit ? `/products/new?edit=${params.edit}` : "/products/new")}`);

  let product;
  if (params.edit) {
    const list = await getMyCreatorProducts();
    if (!list.ok) throw new Error(list.error);
    product = list.data?.find((item) => item.id === params.edit);
    if (!product) notFound();
  }

  return <main className="mx-auto max-w-3xl px-4 py-8">
    <Link href="/products" className="inline-flex min-h-11 items-center text-base text-accent-text underline">← 상품 둘러보기</Link>
    <h1 className="mt-3 text-3xl font-black tracking-tight">{product ? "내 상품 수정" : "내 밈 상품 등록"}</h1>
    <p className="mt-2 mb-6 text-base leading-relaxed text-muted">직접 만든 밈 상품을 소개해 보세요. 운영자 검토를 마친 상품만 상품 페이지에 공개돼요.</p>
    <CreatorProductForm product={product} />
  </main>;
}
