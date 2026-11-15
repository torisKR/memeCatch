"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n-client";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { MY_COPY } from "@/lib/i18n-my";
import { localizedStaticPath } from "@/lib/i18n-routing";

/**
 * 저장 밈의 컬렉션(폴더)·메모 편집 — Plus 전용.
 * 쓰기는 update_saved_meme RPC가 서버에서 Plus를 재확인하므로,
 * 여기서의 isPremium은 UI 노출 판단일 뿐 권한 근거가 아니다.
 * 카드 전체가 Link라 편집 UI는 링크 바깥에 두고 이벤트 전파를 막는다.
 */
export function SavedMetaEditor({
  memeId,
  isPremium,
  collection,
  note,
}: {
  memeId: string;
  isPremium: boolean;
  collection: string | null;
  note: string | null;
}) {
  const { locale } = useLocale();
  const copy = MY_COPY[locale].saved.library.editor;
  const [open, setOpen] = useState(false);
  const [col, setCol] = useState(collection ?? "");
  const [memo, setMemo] = useState(note ?? "");
  const [saved, setSaved] = useState<{
    collection: string | null;
    note: string | null;
  }>({
    collection,
    note,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!isPremium) {
    // 무료 사용자에겐 잠금 힌트만 — 저장 자체는 무료(30개)라 기능만 구분
    return (
      <p className="mt-2 text-xs text-muted">
        <Link
          href={localizedStaticPath("/pricing", locale)}
          prefetch={false}
          className="font-semibold text-accent-text hover:text-accent"
        >
          {PREMIUM_COPY[locale].productName}
        </Link>
        {copy.freeHint}
      </p>
    );
  }

  function save() {
    setError(null);
    start(async () => {
      const supabase = createClient();
      const { error: rpcError } = await supabase.rpc("update_saved_meme", {
        p_meme_id: memeId,
        p_collection: col.trim() || null,
        p_note: memo.trim() || null,
      });
      if (rpcError) {
        setError(
          rpcError.message.includes("plus_required")
            ? copy.plusRequired
            : copy.saveFailed,
        );
        return;
      }
      setSaved({ collection: col.trim() || null, note: memo.trim() || null });
      setOpen(false);
    });
  }

  return (
    <div className="mt-2">
      {/* 현재 값 요약 */}
      <div className="flex flex-wrap items-center gap-1.5">
        {saved.collection && (
          <span className="stat-mono rounded-full bg-accent-soft px-2 py-0.5 text-xs font-bold text-accent-text">
            {saved.collection}
          </span>
        )}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex min-h-9 items-center rounded-full px-2 text-xs font-semibold text-muted transition-colors hover:text-accent"
        >
          {saved.collection || saved.note ? copy.edit : copy.add}
        </button>
      </div>
      {saved.note && !open && (
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted">
          {saved.note}
        </p>
      )}

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <div>
            <label
              htmlFor={`col-${memeId}`}
              className="block text-xs font-semibold text-muted"
            >
              {copy.collectionLabel}
            </label>
            <input
              id={`col-${memeId}`}
              value={col}
              onChange={(e) => setCol(e.target.value.slice(0, 40))}
              placeholder={copy.collectionPlaceholder}
              className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
          <div>
            <label
              htmlFor={`note-${memeId}`}
              className="block text-xs font-semibold text-muted"
            >
              {copy.noteLabel}
            </label>
            <textarea
              id={`note-${memeId}`}
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, 500))}
              rows={2}
              placeholder={copy.notePlaceholder}
              className="mt-1 w-full resize-y rounded-lg border border-border bg-surface p-2.5 text-sm outline-none focus:border-accent"
            />
          </div>
          {error && (
            <p role="alert" className="text-xs font-semibold text-safety-red">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="hover-glow-flame inline-flex min-h-9 items-center rounded-lg bg-accent-strong px-3 text-xs font-bold text-white disabled:opacity-60"
            >
              {pending ? copy.saving : copy.save}
            </button>
            <button
              type="button"
              onClick={() => {
                setCol(saved.collection ?? "");
                setMemo(saved.note ?? "");
                setOpen(false);
                setError(null);
              }}
              disabled={pending}
              className="inline-flex min-h-9 items-center rounded-lg border border-border bg-surface px-3 text-xs font-semibold"
            >
              {copy.cancel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
