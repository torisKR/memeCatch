"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { selectPremiumSubscription } from "@/lib/billing/entitlements";
import { useLocale } from "@/lib/i18n-client";
import { withLocaleFallback, type Locale } from "@/lib/i18n";

/**
 * B2 — 밈 카드 내보내기 UI.
 * 무료: 클래식 템플릿 · 카드 포맷 · 1x · 워터마크 포함.
 * Plus: 미니멀/볼드 템플릿 · 스토리 포맷 · 최대 3x · 워터마크 제거.
 *
 * 프리미엄 옵션은 무료 사용자에게 잠금(자물쇠 + PLUS)으로 노출하고,
 * 선택 시 업그레이드로 유도한다. 서버 라우트가 최종 게이팅(402)을 담당.
 */

const COPY_BASE = {
  ko: {
    open: "카드 내보내기",
    title: "밈 카드로 저장",
    template: "템플릿",
    format: "크기",
    quality: "화질",
    classic: "클래식",
    minimal: "미니멀",
    bold: "볼드",
    card: "카드",
    story: "스토리",
    download: "다운로드",
    downloading: "만드는 중…",
    plusOnly: "PLUS 전용",
    upgradeHint: "Plus로 업그레이드하면 워터마크 없이 고화질로 저장할 수 있어요.",
    upgrade: "Plus 보러가기",
    watermarkNote: "무료 저장에는 catchmeme.com 표시가 들어가요.",
    failed: "저장에 실패했어요. 다시 시도해 주세요.",
  },
  en: {
    open: "Export card",
    title: "Save as meme card",
    template: "Template",
    format: "Size",
    quality: "Quality",
    classic: "Classic",
    minimal: "Minimal",
    bold: "Bold",
    card: "Card",
    story: "Story",
    download: "Download",
    downloading: "Rendering…",
    plusOnly: "PLUS only",
    upgradeHint: "Upgrade to Plus for watermark-free, high-resolution exports.",
    upgrade: "See Plus",
    watermarkNote: "Free exports include a catchmeme.com mark.",
    failed: "Export failed. Please try again.",
  },
  ja: {
    open: "カード書き出し",
    title: "ミームカードとして保存",
    template: "テンプレート",
    format: "サイズ",
    quality: "画質",
    classic: "クラシック",
    minimal: "ミニマル",
    bold: "ボールド",
    card: "カード",
    story: "ストーリー",
    download: "ダウンロード",
    downloading: "作成中…",
    plusOnly: "PLUS限定",
    upgradeHint: "Plusにアップグレードすると透かしなし・高画質で保存できます。",
    upgrade: "Plusを見る",
    watermarkNote: "無料保存にはcatchmeme.comの表示が入ります。",
    failed: "書き出しに失敗しました。もう一度お試しください。",
  },
  zh: {
    open: "导出卡片",
    title: "保存为梗卡片",
    template: "模板",
    format: "尺寸",
    quality: "画质",
    classic: "经典",
    minimal: "极简",
    bold: "醒目",
    card: "卡片",
    story: "故事",
    download: "下载",
    downloading: "生成中…",
    plusOnly: "PLUS 专属",
    upgradeHint: "升级 Plus 可无水印、高清导出。",
    upgrade: "查看 Plus",
    watermarkNote: "免费导出会带有 catchmeme.com 标记。",
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
  const [isPremium, setIsPremium] = useState<boolean | null>(null);
  const [template, setTemplate] = useState<Template>("classic");
  const [format, setFormat] = useState<Format>("card");
  const [hiRes, setHiRes] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) {
        setIsPremium(false);
        return;
      }
      const { data: subs } = await supabase
        .from("billing_subscriptions")
        .select("status, current_period_end, last_event_at");
      if (cancelled) return;
      setIsPremium(selectPremiumSubscription(subs ?? []) !== null);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 언마운트 시 blob URL 정리(메모리 누수 방지).
  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const premium = isPremium === true;
  const usingPremiumOption =
    template !== "classic" || format !== "card" || hiRes;
  const locked = !premium && usingPremiumOption;

  function pickTemplate(next: Template) {
    setError(false);
    setTemplate(next);
  }
  function pickFormat(next: Format) {
    setError(false);
    setFormat(next);
  }

  async function handleDownload() {
    if (locked) return; // 잠금 상태에서는 업그레이드 CTA만 노출
    setBusy(true);
    setError(false);
    try {
      const qs = new URLSearchParams({ template, format });
      if (premium && hiRes) qs.set("scale", "3");
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
      a.download = `memecatch-${shortId}-${template}-${format}${premium && hiRes ? "@3x" : ""}.png`;
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
        className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-surface-2 px-5 text-sm font-semibold text-foreground transition-transform active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
            aria-label="close"
            className="grid h-8 w-8 place-items-center rounded-full text-text-muted hover:bg-surface"
          >
            <span aria-hidden>✕</span>
          </button>
        </div>

        {/* 템플릿 */}
        <p className="mb-1.5 text-xs font-semibold text-text-muted">{copy.template}</p>
        <div className="mb-3 flex gap-2">
          {(["classic", "minimal", "bold"] as const).map((tpl) => {
            const isPlus = tpl !== "classic";
            const isLocked = isPlus && !premium;
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
                {isLocked && (
                  <span aria-hidden className="ml-1 text-[10px] opacity-70">
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 포맷 */}
        <p className="mb-1.5 text-xs font-semibold text-text-muted">{copy.format}</p>
        <div className="mb-3 flex gap-2">
          {(["card", "story"] as const).map((fmt) => {
            const isPlus = fmt !== "card";
            const isLocked = isPlus && !premium;
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
                {isLocked && (
                  <span aria-hidden className="ml-1 text-[10px] opacity-70">
                    🔒
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* 화질(Plus) */}
        <label
          className={`mb-3 flex items-center justify-between rounded-xl border border-border px-3 py-2.5 ${
            premium ? "" : "opacity-60"
          }`}
        >
          <span className="text-sm font-semibold text-foreground">
            {copy.quality} · 3x
            {!premium && (
              <span className="ml-1.5 text-[10px] text-accent">{copy.plusOnly}</span>
            )}
          </span>
          <input
            type="checkbox"
            checked={premium && hiRes}
            disabled={!premium}
            onChange={(e) => {
              setError(false);
              setHiRes(e.target.checked);
            }}
            className="h-4 w-4 accent-accent"
          />
        </label>

        {!premium && (
          <p className="mb-2 text-xs text-text-muted">{copy.watermarkNote}</p>
        )}
        {error && <p className="mb-2 text-xs text-safety-red">{copy.failed}</p>}

        {locked ? (
          <div className="rounded-xl border border-accent/40 bg-accent/5 p-3">
            <p className="mb-2 text-xs leading-relaxed text-foreground">
              {copy.upgradeHint}
            </p>
            <Link
              href="/premium"
              className="inline-flex h-10 w-full items-center justify-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98]"
            >
              {copy.upgrade}
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? copy.downloading : copy.download}
          </button>
        )}
      </section>
    </>
  );
}
