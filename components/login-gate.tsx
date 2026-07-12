"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BrandTile } from "@/components/brand-mark";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createClient } from "@/lib/supabase/client";

/**
 * 레인 C — 로그인 유도 게이트. DESIGN.md §10 여정1.
 * 비로그인 사용자가 저장/반응을 시도할 때 띄우는 바텀시트(모바일)/모달(데스크톱).
 * - "로그인하면 저장할 수 있어요" + 카카오/구글/이메일(→/login?next=현재) 버튼.
 * - AnimatePresence 슬라이드업, prefers-reduced-motion 존중.
 * - save-button/reaction-bar(레인 D)가 import해 open/onClose/message/next로 제어.
 */

type Provider = "kakao" | "google";
const PROVIDER_LABEL: Record<Provider, string> = {
  kakao: "카카오",
  google: "구글",
};

export function LoginGate({
  open,
  onClose,
  message = "로그인하면 저장할 수 있어요",
  next,
}: {
  open: boolean;
  onClose: () => void;
  message?: string;
  next: string;
}) {
  const reduce = useReducedMotion();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [oauthBusy, setOauthBusy] = useState<Provider | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  const safeNext =
    next.startsWith("/") && !next.startsWith("//") ? next : "/";

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // 게이트가 열릴 때 이전 OAuth 안내를 초기화(외부 트리거 open에 반응하는 리셋)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOauthNotice(null);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  async function startOAuth(provider: Provider) {
    if (oauthBusy) return;
    setOauthBusy(provider);
    setOauthNotice(null);
    const label = PROVIDER_LABEL[provider];
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        },
      });
      if (error) {
        setOauthBusy(null);
        setOauthNotice(`${label} 로그인은 곧 열려요. 이메일로 시작해 주세요.`);
      }
    } catch {
      setOauthBusy(null);
      setOauthNotice(`${label} 로그인은 곧 열려요. 이메일로 시작해 주세요.`);
    }
  }

  const loginHref = `/login?next=${encodeURIComponent(safeNext)}`;

  return (
    <AnimatePresence
      onExitComplete={() => {
        returnFocusRef.current?.focus({ preventScroll: true });
        returnFocusRef.current = null;
      }}
    >
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <motion.button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="absolute inset-0 h-full w-full bg-black/50"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            ref={panelRef}
            tabIndex={-1}
            className="relative w-full max-w-md rounded-t-3xl border border-border bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] outline-none sm:mx-4 sm:rounded-3xl sm:pb-6"
            initial={reduce ? false : { opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 40 }}
            transition={
              reduce
                ? { duration: 0 }
                : { type: "spring", stiffness: 400, damping: 34 }
            }
          >
            <span
              aria-hidden
              className="mx-auto mb-4 block h-1 w-10 rounded-full bg-border sm:hidden"
            />

            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>

            <div className="flex items-center gap-2">
              <BrandTile className="size-8" />
              <span className="text-base font-extrabold tracking-tight">밈캐치</span>
            </div>

            <h2 id={titleId} className="mt-3 text-xl font-extrabold leading-snug">
              {message}
            </h2>
            <p className="mt-1.5 text-muted">
              몇 초면 시작해요. 보던 화면으로 바로 돌아올게요.
            </p>

            <div className="mt-5 flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => startOAuth("kakao")}
                disabled={!!oauthBusy}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 text-base font-semibold text-[#191600] transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {oauthBusy === "kakao" ? (
                  <Spinner className="border-[#191600]/30 border-t-[#191600]" />
                ) : (
                  <KakaoMark className="h-5 w-5" />
                )}
                카카오로 시작하기
              </button>
              <button
                type="button"
                onClick={() => startOAuth("google")}
                disabled={!!oauthBusy}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-base font-semibold text-foreground transition-transform active:scale-[0.98] disabled:opacity-60"
              >
                {oauthBusy === "google" ? (
                  <Spinner className="border-muted/30 border-t-muted" />
                ) : (
                  <GoogleMark className="h-5 w-5" />
                )}
                구글로 시작하기
              </button>
              <a
                href={`/auth/tiktok?next=${encodeURIComponent(safeNext)}`}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#111111] px-4 text-base font-semibold text-white transition-transform active:scale-[0.98]"
              >
                <TikTokMark className="h-5 w-5" />
                TikTok으로 시작하기
              </a>
              <Link
                href={loginHref}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
              >
                이메일로 시작하기
              </Link>
            </div>

            <p
              role="status"
              aria-live="polite"
              className="mt-2 min-h-5 text-center text-sm text-muted"
            >
              {oauthNotice}
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

function TikTokMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M14.4 3.2c.5 2.5 1.9 4 4.4 4.5v3.1a8.6 8.6 0 0 1-4.4-1.4v6.1a5.8 5.8 0 1 1-5-5.7v3.2a2.7 2.7 0 1 0 1.8 2.5V3.2h3.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`h-4 w-4 animate-spin rounded-full border-2 ${className}`}
    />
  );
}


function KakaoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="#191600" aria-hidden>
      <path d="M12 3.5c-4.97 0-9 3.14-9 7.02 0 2.5 1.68 4.69 4.2 5.94-.14.5-.9 3.1-.93 3.31 0 0-.02.15.08.21.1.06.22.01.22.01.28-.04 3.24-2.13 3.76-2.5.53.08 1.09.12 1.67.12 4.97 0 9-3.14 9-7.1 0-3.87-4.03-7.01-9-7.01Z" />
    </svg>
  );
}

function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.68-.06-1.34-.17-1.97H12v3.73h5.38a4.6 4.6 0 0 1-2 3.02v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.28Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.8-1.76-5.58-4.12H3.06v2.58A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.42 13.9a6 6 0 0 1 0-3.8V7.52H3.06a10 10 0 0 0 0 8.96l3.36-2.58Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.98c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.99 14.7 2 12 2A10 10 0 0 0 3.06 7.52l3.36 2.58C7.2 7.74 9.4 5.98 12 5.98Z"
      />
    </svg>
  );
}
