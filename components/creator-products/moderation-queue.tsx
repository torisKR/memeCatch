"use client";

import { useState } from "react";
import type { CreatorProduct } from "@/lib/creator-products";
import { moderateCreatorProduct } from "@/lib/creator-products/actions";
import { creatorProductImageUrl } from "./creator-product-card";

export function CreatorProductModerationQueue({ products }: { products: CreatorProduct[] }) {
  const [reasonById, setReasonById] = useState<Record<string, string>>({});
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function review(id: string, decision: "approved" | "rejected") {
    setErrorById((state) => ({ ...state, [id]: "" }));
    setBusy(true);
    try {
      const result = await moderateCreatorProduct(id, decision, reasonById[id] ?? "");
      if (!result.ok) {
        setErrorById((state) => ({ ...state, [id]: result.error }));
        return;
      }
      window.location.reload();
    } catch {
      setErrorById((state) => ({ ...state, [id]: "검토 상태를 저장하지 못했어요. 잠시 후 다시 시도해 주세요." }));
    } finally {
      setBusy(false);
    }
  }

  return <ul className="space-y-5">
    {products.map((product) => <li key={product.id} className="grid gap-5 rounded-2xl border border-border bg-surface p-4 md:grid-cols-[220px_1fr]">
      <div className="aspect-[4/3] overflow-hidden rounded-xl bg-surface-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={creatorProductImageUrl(product.id)} alt={`${product.title} 상품 이미지`} className="size-full object-cover" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-accent-text">크리에이터 홍보 · {product.relationship_disclosure}</p>
        <h2 className="mt-1 break-words text-xl font-extrabold">{product.title}</h2>
        <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed">{product.description}</p>
        <p className="mt-2 break-all text-sm text-muted">제출자: {product.owner_id} · {product.category}{product.price === null ? "" : ` · ${product.price.toLocaleString("ko-KR")}원`}</p>
        <a className="mt-2 inline-flex min-h-11 items-center break-all text-sm text-accent-text underline" href={product.external_url} target="_blank" rel="noopener noreferrer">외부 주소 열기</a>
        <label className="mt-3 block text-sm font-semibold" htmlFor={`reject-${product.id}`}>반려 사유 <span className="font-normal text-muted">(반려 시 필수, 3~500자)</span></label>
        <textarea id={`reject-${product.id}`} rows={2} maxLength={500} value={reasonById[product.id] ?? ""} onChange={(event) => setReasonById((state) => ({ ...state, [product.id]: event.target.value }))}
          className="mt-1 w-full rounded-xl border border-border bg-background p-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
        {errorById[product.id] && <p role="alert" className="mt-2 text-sm text-safety-red">{errorById[product.id]}</p>}
        <div className="mt-3 flex flex-wrap gap-3">
          <button type="button" disabled={busy} onClick={() => review(product.id, "approved")} className="min-h-11 rounded-xl bg-accent-strong px-5 font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">승인</button>
          <button type="button" disabled={busy} onClick={() => review(product.id, "rejected")} className="min-h-11 rounded-xl border border-border px-5 font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60">반려</button>
        </div>
      </div>
    </li>)}
  </ul>;
}
