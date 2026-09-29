"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CREATOR_PRODUCT_CATEGORIES, CREATOR_RELATIONSHIPS, type CreatorProduct } from "@/lib/creator-products";
import { submitCreatorProduct, updateCreatorProduct } from "@/lib/creator-products/actions";
import { uploadCreatorProductImage } from "@/lib/creator-products/upload";

const categoryLabels: Record<(typeof CREATOR_PRODUCT_CATEGORIES)[number], string> = {
  apparel: "의류", accessories: "액세서리", prints: "인쇄물", digital: "디지털 상품", other: "기타",
};
const relationshipLabels: Record<(typeof CREATOR_RELATIONSHIPS)[number], string> = {
  creator: "내가 만든 상품", affiliate: "제휴 링크 또는 수수료를 받을 수 있어요",
  gifted: "상품을 제공받았어요", other: "그 밖의 홍보 관계가 있어요",
};

export function CreatorProductForm({ product }: { product?: CreatorProduct }) {
  const router = useRouter();
  const [imagePath, setImagePath] = useState(product?.image_path ?? "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage("");
    setSuccess(false);
    setUploading(true);
    try {
      const result = await uploadCreatorProductImage(file);
      if (result.ok) setImagePath(result.path);
      else setMessage(result.error);
    } catch {
      setMessage("상품 이미지 업로드에 실패했어요. 다시 시도해 주세요.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || uploading || (success && !product)) return;
    setMessage("");
    setSuccess(false);
    const form = new FormData(event.currentTarget);
    const input = {
      title: String(form.get("title") ?? ""),
      description: String(form.get("description") ?? ""),
      externalUrl: String(form.get("externalUrl") ?? ""),
      imagePath,
      price: String(form.get("price") ?? ""),
      category: String(form.get("category") ?? ""),
      relationshipDisclosure: String(form.get("relationshipDisclosure") ?? ""),
      rightsAccepted: form.get("rightsAccepted") === "on",
    };
    setBusy(true);
    try {
      const result = product
        ? await updateCreatorProduct(product.id, input)
        : await submitCreatorProduct(input);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setSuccess(true);
      setMessage("상품을 접수했어요. 검토가 끝나면 공개돼요.");
      router.refresh();
      if (!product) router.push("/products/mine");
    } catch {
      setMessage("요청을 처리하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-2xl border border-border bg-surface p-5 shadow-sm sm:p-7">
      <label className="block text-base font-semibold" htmlFor="creator-product-title">
        상품 이름 <span className="text-muted">(2~120자)</span>
        <input id="creator-product-title" name="title" required minLength={2} maxLength={120} defaultValue={product?.title ?? ""}
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
      </label>

      <label className="block text-base font-semibold" htmlFor="creator-product-description">
        상품 설명 <span className="text-muted">(5~2,000자)</span>
        <textarea id="creator-product-description" name="description" required minLength={5} maxLength={2000} rows={5} defaultValue={product?.description ?? ""}
          className="mt-2 w-full rounded-xl border border-border bg-background p-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
      </label>

      <div>
        <label className="block text-base font-semibold" htmlFor="creator-product-image">상품 이미지</label>
        <p className="mt-1 text-sm text-muted">JPG, PNG, WebP 또는 GIF · 5MB 이하</p>
        <input id="creator-product-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" required={!imagePath} onChange={onImageChange}
          className="mt-2 block min-h-11 w-full rounded-xl border border-border bg-background p-2 text-sm file:mr-3 file:min-h-9 file:rounded-lg file:border-0 file:bg-accent-soft file:px-3 file:font-semibold" />
        {uploading && <p role="status" className="mt-2 text-sm text-muted">이미지를 올리고 있어요…</p>}
        {imagePath && <p role="status" className="mt-2 break-all text-sm text-safety-green">이미지 준비 완료</p>}
      </div>

      <label className="block text-base font-semibold" htmlFor="creator-product-url">
        상품을 볼 수 있는 주소 <span className="text-muted">(HTTPS)</span>
        <input id="creator-product-url" name="externalUrl" type="url" inputMode="url" required maxLength={2048} defaultValue={product?.external_url ?? ""} placeholder="https://…"
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
        <span className="mt-1 block text-sm font-normal text-muted">주소에 접속해 확인하지 않아요. 구매·배송은 연결된 판매처에서 진행돼요.</span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-base font-semibold" htmlFor="creator-product-price">
          가격 <span className="font-normal text-muted">(선택)</span>
          <input id="creator-product-price" name="price" type="number" min="1" max="100000000" step="1" defaultValue={product?.price ?? ""} placeholder="예: 19000"
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" />
        </label>
        <label className="block text-base font-semibold" htmlFor="creator-product-category">
          상품 종류
          <select id="creator-product-category" name="category" required defaultValue={product?.category ?? ""}
            className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <option value="" disabled>종류를 선택해 주세요</option>
            {CREATOR_PRODUCT_CATEGORIES.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
          </select>
        </label>
      </div>

      <label className="block text-base font-semibold" htmlFor="creator-product-relationship">
        홍보 관계 공개
        <select id="creator-product-relationship" name="relationshipDisclosure" required defaultValue={product?.relationship_disclosure ?? ""}
          className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 font-normal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          <option value="" disabled>해당하는 항목을 선택해 주세요</option>
          {CREATOR_RELATIONSHIPS.map((value) => <option key={value} value={value}>{relationshipLabels[value]}</option>)}
        </select>
      </label>

      <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-border bg-surface-2 p-3 text-sm leading-relaxed">
        <input name="rightsAccepted" type="checkbox" required className="mt-1 size-5 shrink-0 accent-[var(--accent)]" />
        <span>상품과 이미지의 게시 권한이 있고, 필요한 홍보 관계를 공개했음을 확인해요.</span>
      </label>

      {message && <p role={success ? "status" : "alert"} className={success ? "rounded-xl bg-safety-green-bg p-3 text-base font-semibold text-safety-green" : "rounded-xl bg-safety-red-bg p-3 text-base text-safety-red"}>{message}</p>}
      <button type="submit" disabled={busy || uploading || !imagePath || (success && !product)}
        className="min-h-11 w-full rounded-xl bg-accent-strong px-5 py-3 font-bold text-white hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? "접수 중…" : product ? "수정 내용 검토 요청" : "검토 요청하기"}
      </button>
      <p className="text-sm leading-relaxed text-muted">등록 후 운영자 검토를 거쳐 공개돼요. 공개된 상품을 수정하면 다시 검토 대기 상태가 돼요.</p>
    </form>
  );
}
