import type { CreatorProduct, PublicCreatorProduct } from "@/lib/creator-products";

const relationshipLabels: Record<CreatorProduct["relationship_disclosure"], string> = {
  creator: "크리에이터 제작", affiliate: "제휴 홍보", gifted: "상품 제공", other: "홍보 관계 공개",
};
const categoryLabels: Record<CreatorProduct["category"], string> = {
  apparel: "의류", accessories: "액세서리", prints: "인쇄물", digital: "디지털", other: "기타",
};

export function creatorProductImageUrl(id: string): string {
  return `/api/creator-products/image/${encodeURIComponent(id)}`;
}

export function CreatorProductCard({ product }: { product: PublicCreatorProduct }) {
  return (
    <article className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="aspect-[4/3] overflow-hidden bg-surface-2">
        {product.id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={creatorProductImageUrl(product.id)} alt={`${product.title} 상품 이미지`} loading="lazy" className="size-full object-cover" />
        ) : <div className="grid size-full place-items-center p-4 text-center text-muted">상품 이미지</div>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text">크리에이터 홍보</span>
          <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted">{relationshipLabels[product.relationship_disclosure]}</span>
        </div>
        <h3 className="mt-3 break-words text-lg font-extrabold leading-snug">{product.title}</h3>
        <p className="mt-1 text-sm text-muted">{categoryLabels[product.category]}</p>
        <p className="mt-3 line-clamp-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{product.description}</p>
        <div className="mt-auto pt-4">
          <p className="mb-3 text-base font-bold">{product.price === null ? "판매처에서 가격 확인" : `${new Intl.NumberFormat("ko-KR").format(product.price)}원`}</p>
          <a href={product.external_url} target="_blank" rel="sponsored noopener noreferrer"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-border px-4 py-2 text-center font-bold hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            판매처에서 보기 <span className="sr-only"> — {product.title}</span>
          </a>
          <p className="mt-2 text-xs leading-relaxed text-muted">외부 판매처로 이동해요. 상품·가격·구매는 판매처에서 확인해 주세요.</p>
        </div>
      </div>
    </article>
  );
}
