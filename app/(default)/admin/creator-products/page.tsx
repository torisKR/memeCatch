import { CreatorProductModerationQueue } from "@/components/creator-products/moderation-queue";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { getCreatorProductReviewQueue } from "@/lib/creator-products/server";

export const metadata = { title: "크리에이터 상품 검토 · 밈캐치" };

export default async function CreatorProductsReviewPage() {
  await requireOperatorPage("/admin/creator-products");
  const result = await getCreatorProductReviewQueue();
  return <div className="space-y-6">
    <header><h1 className="text-2xl font-bold">크리에이터 상품 검토</h1><p className="mt-1 text-base text-muted">상품 정보와 홍보 관계, 권리 확인을 검토한 뒤 승인 또는 반려해요.</p></header>
    {!result.ok ? <p role="alert" className="rounded-xl border border-safety-red bg-safety-red-bg p-4 text-base text-safety-red">{result.error}</p>
      : result.data?.length === 0 ? <div className="rounded-xl border border-border bg-surface p-10 text-center"><p className="text-lg font-semibold">검토 대기 상품이 없어요</p><p className="mt-1 text-base text-muted">새 등록 상품이 접수되면 이곳에 표시돼요.</p></div>
      : <CreatorProductModerationQueue products={result.data ?? []} />}
  </div>;
}
