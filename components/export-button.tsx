"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/lib/i18n-client";
import { withLocaleFallback, type Locale } from "@/lib/i18n";
import { isSeoContentLocale } from "@/lib/i18n-routing";

/**
 * B2 — 밈 카드 내보내기 UI.
 * 모든 템플릿·포맷을 누구나 쓸 수 있다(1x · catchmeme.com 워터마크 포함).
 */

const COPY_BASE = {
  ko: {
    open: "카드 내보내기",
    close: "닫기",
    title: "밈 카드로 저장",
    template: "템플릿",
    format: "크기",
    classic: "클래식",
    minimal: "미니멀",
    bold: "볼드",
    card: "카드",
    story: "스토리",
    download: "다운로드",
    downloading: "만드는 중…",
    watermarkNote: "저장한 카드에는 catchmeme.com 표시가 들어가요.",
    failed: "저장에 실패했어요. 다시 시도해 주세요.",
  },
  en: {
    open: "Export card",
    close: "Close",
    title: "Save as meme card",
    template: "Template",
    format: "Size",
    classic: "Classic",
    minimal: "Minimal",
    bold: "Bold",
    card: "Card",
    story: "Story",
    download: "Download",
    downloading: "Rendering…",
    watermarkNote: "Exports include a catchmeme.com mark.",
    failed: "Export failed. Please try again.",
  },
  ja: {
    open: "カード書き出し",
    close: "閉じる",
    title: "ミームカードとして保存",
    template: "テンプレート",
    format: "サイズ",
    classic: "クラシック",
    minimal: "ミニマル",
    bold: "ボールド",
    card: "カード",
    story: "ストーリー",
    download: "ダウンロード",
    downloading: "作成中…",
    watermarkNote: "保存したカードにはcatchmeme.comの表示が入ります。",
    failed: "書き出しに失敗しました。もう一度お試しください。",
  },
  zh: {
    open: "导出卡片",
    close: "关闭",
    title: "保存为梗卡片",
    template: "模板",
    format: "尺寸",
    classic: "经典",
    minimal: "极简",
    bold: "醒目",
    card: "卡片",
    story: "故事",
    download: "下载",
    downloading: "生成中…",
    watermarkNote: "导出的卡片会带有 catchmeme.com 标记。",
    failed: "导出失败，请重试。",
  },
} satisfies Record<"ko" | "en" | "ja" | "zh", Record<string, string>>;

const COPY: Record<Locale, Record<string, string>> = withLocaleFallback<Record<string, string>>(COPY_BASE);

type Template = "classic" | "minimal" | "bold";
type Format = "card" | "story";

export function ExportButton({ shortId }: { shortId: string }) {
  const { locale } = useLocale();
  const copy = COPY[locale];

  const [open, setOpen] = useState(false);
  const [template, setTemplate] = useState<Template>("classic");
  const [format, setFormat] = useState<Format>("card");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  // 언마운트 시 blob URL 정리(메모리 누수 방지).
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  function pickTemplate(next: Template) {
    setError(false);
    setTemplate(next);
  }
  function pickFormat(next: Format) {
    setError(false);
    setFormat(next);
  }

  async function handleDownload() {
    setBusy(true);
    setError(false);
    try {
      const qs = new URLSearchParams({ template, format });
      if (isSeoContentLocale(locale)) qs.set("locale", locale);
      const res = await fetch(`/memes/${shortId}/export?${qs.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`export ${res.status}`);
      const blob = await res.blob();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      const a = document.createElement("a");
      a.href = url;
      a.download = `memecatch-${shortId}-${template}-${format}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)] inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface-2 px-5 text-sm font-semibold text-foreground transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span aria-hidden>⬇</span>
        {copy.open}
      </button>
    );
  }

  return (
    <>
      <section
        aria-label={copy.title}
        className="rounded-2xl border border-border bg-surface-2 p-4"
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{copy.title}</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={copy.close}
            className="grid h-11 w-11 place-items-center rounded-full text-text-muted hover:bg-surface"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        {/* 템플릿 */}
        <p className="mb-1.5 text-xs font-semibold text-text-muted">{copy.template}</p>
        <div className="mb-3 flex gap-2">
          {(["classic", "minimal", "bold"] as const).map((tpl) => {
            return (
              <button
                key={tpl}
                type="button"
                onClick={() => pickTemplate(tpl)}
                aria-pressed={template === tpl}
                className={`relative flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  template === tpl
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                {copy[tpl]}
              </button>
            );
          })}
        </div>

        {/* 포맷 */}
        <p className="mb-1.5 text-xs font-semibold text-text-muted">{copy.format}</p>
        <div className="mb-3 flex gap-2">
          {(["card", "story"] as const).map((fmt) => {
            return (
              <button
                key={fmt}
                type="button"
                onClick={() => pickFormat(fmt)}
                aria-pressed={format === fmt}
                className={`relative flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  format === fmt
                    ? "border-accent bg-accent/10 text-foreground"
                    : "border-border bg-surface text-text-muted"
                }`}
              >
                {copy[fmt]}
              </button>
            );
          })}
        </div>

        <p className="mb-2 text-xs text-text-muted">{copy.watermarkNote}</p>
        {error && <p className="mb-2 text-xs text-safety-red">{copy.failed}</p>}

          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_22%,transparent),0_8px_32px_-8px_color-mix(in_srgb,var(--flame-500)_42%,transparent)] inline-flex h-11 w-full items-center justify-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? copy.downloading : copy.download}
          </button>
      </section>
    </>
  );
}
