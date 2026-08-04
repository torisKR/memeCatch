"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { track } from "@/lib/analytics";
import { useLocale } from "@/lib/i18n-client";

/**
 * 헤더 🎲 — 랜덤 밈. 서버가 무작위 1건을 고르는 1~2초 동안 무반응이던 문제를,
 * 클릭 즉시 "밈 찾는 중" 오버레이(카드를 뒤적이는 인터랙션)로 채운다.
 *
 * 흐름: 클릭 → 오버레이 표시 → /api/random-meme 로 목적지 경로만 받아
 * router.push. 목적지 페이지가 커밋되면(pathname 변경) 오버레이를 닫는다.
 * 실패·타임아웃 시 서버 302 라우트로 폴백. 이미 진행 중이면 중복 클릭 무시.
 * 주사위 SVG 사용(이모지 금지 규칙 준수).
 */
export function RandomMemeButton() {
  const { messages } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const startPathRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const close = useCallback(() => {
    setLoading(false);
    startPathRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  // 목적지 페이지가 실제로 커밋되면(경로가 시작 시점과 달라지면) 오버레이 종료
  useEffect(() => {
    if (loading && startPathRef.current !== null && pathname !== startPathRef.current) {
      close();
    }
  }, [pathname, loading, close]);

  // 오버레이 동안 배경 스크롤 잠금 + Esc 취소
  useEffect(() => {
    if (!loading) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [loading, close]);

  const handleClick = useCallback(async () => {
    if (loading) return;
    track("random_meme");
    startPathRef.current = pathname;
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;
    // 네트워크가 오래 걸려도 UX가 갇히지 않도록 상한(6s) → 서버 302 폴백
    const timer = setTimeout(() => controller.abort(), 6000);

    let target = "/memes/random";
    try {
      const res = await fetch("/api/random-meme", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { path?: string };
        if (data?.path) target = data.path;
      }
    } catch {
      // 취소/실패 → 서버 라우트가 스스로 무작위+폴백 처리
      target = "/memes/random";
    } finally {
      clearTimeout(timer);
    }

    if (abortRef.current === controller) {
      router.push(target);
      // 커밋 실패 대비 안전 종료(최대 8s) — 성공 시 pathname effect가 먼저 닫음
      setTimeout(() => close(), 8000);
    }
  }, [loading, pathname, router, close]);

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={messages.random}
        aria-busy={loading}
        title={messages.random}
        className="holo-sheen flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-2 active:scale-[0.95]"
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 ${loading ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
          <circle cx="8.6" cy="8.6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15.4" cy="8.6" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="8.6" cy="15.4" r="1.5" fill="currentColor" stroke="none" />
          <circle cx="15.4" cy="15.4" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {loading && <FindingOverlay label={messages.findingMeme} onCancel={close} />}
    </>
  );
}

/** 전체 화면 "밈 찾는 중" 오버레이 — 카드 3장을 뒤적이는 애니메이션 */
function FindingOverlay({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div
      className="rm-overlay fixed inset-0 z-50 flex flex-col items-center justify-center gap-7 bg-background/85 backdrop-blur-md"
      role="status"
      aria-live="polite"
      onClick={onCancel}
    >
      {/* 카드 뒤적임 — 3장이 시차를 두고 섞인다 */}
      <div className="relative flex h-28 w-24 items-end justify-center">
        {[
          { r: "-11deg", z: "z-10" },
          { r: "3deg", z: "z-20" },
          { r: "13deg", z: "z-30" },
        ].map((c, i) => (
          <span
            key={i}
            className={`rm-card absolute bottom-0 h-24 w-16 rounded-xl border border-border bg-surface shadow-lg ${c.z}`}
            style={{ "--rm-r": c.r } as React.CSSProperties}
          >
            {/* 카드 안 미니 밈 프레임 */}
            <span className="absolute inset-2 rounded-md bg-gradient-to-br from-accent/25 to-accent/5" />
            <span className="absolute inset-x-2 bottom-2 h-1.5 rounded-full bg-border" />
          </span>
        ))}
      </div>

      <p className="flex items-center gap-1 text-sm font-semibold text-foreground">
        <span>{label}</span>
        <span className="rm-dot inline-block h-1 w-1 rounded-full bg-accent" />
        <span className="rm-dot inline-block h-1 w-1 rounded-full bg-accent" />
        <span className="rm-dot inline-block h-1 w-1 rounded-full bg-accent" />
      </p>
    </div>
  );
}
