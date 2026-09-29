import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyCreatorProducts } from "@/lib/creator-products/server";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "내가 등록한 상품 · 밈캐치" };
const statuses = { pending: "검토 대기", approved: "공개 중", rejected: "반려됨" } as const;

export default async function MyCreatorProductsPage() {
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect("/login?next=%2Fproducts%2Fmine");
  const result = await getMyCreatorProducts();

  return <main className="mx-auto max-w-4xl px-4 py-8">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-3xl font-black tracking-tight">내가 등록한 상품</h1><p className="mt-2 text-base text-muted">검토 상태를 확인하고 상품 정보를 관리해요.</p></div>
      <Link href="/products/new" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent-strong px-5 py-2 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">상품 등록</Link>
    </div>
    {!result.ok ? <p role="alert" className="mt-6 rounded-xl border border-safety-red bg-safety-red-bg p-4 text-base text-safety-red">{result.error}</p>
      : result.data?.length === 0 ? <section className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center"><h2 className="text-xl font-bold">아직 등록한 상품이 없어요</h2><p className="mt-2 text-base text-muted">내가 만든 밈 상품을 커뮤니티에 소개해 보세요.</p><Link href="/products/new" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-accent-strong px-5 font-bold text-white">첫 상품 등록하기</Link></section>
      : <ul className="mt-6 space-y-4">{result.data?.map((product) => <li key={product.id} className="rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h2 className="break-words text-xl font-bold">{product.title}</h2><p className="mt-1 text-sm text-muted">등록 {new Date(product.created_at).toLocaleDateString("ko-KR")}</p></div>
          <span className="rounded-full bg-surface-2 px-3 py-1 text-sm font-bold">{statuses[product.moderation_status]}</span></div>
        {product.rejection_reason && <p className="mt-3 rounded-xl bg-safety-red-bg p-3 text-sm text-safety-red">반려 사유: {product.rejection_reason}</p>}
        {product.moderation_status === "approved" && <p className="mt-3 text-sm text-muted">상품을 수정하면 다시 검토 대기 상태가 돼요.</p>}
        <Link href={`/products/new?edit=${encodeURIComponent(product.id)}`} className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-4 font-semibold hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">상품 정보 수정</Link>
      </li>)}</ul>}
  </main>;
}
