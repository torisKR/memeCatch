"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n-client";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { selectPremiumSubscription } from "@/lib/billing/entitlements";
import { normalizePathname } from "@/lib/normalize-pathname";

/**
 * 전역 헤더가 /admin 경로에서 숨도록 감싸는 클라이언트 게이트.
 * layout은 클라이언트 탐색에서 재사용되므로 최신 pathname은 여기서 읽는다.
 * BottomNav와 동일한 admin 숨김 규칙을 재사용한다.
 */
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}

/**
 * 프로필 아바타 드롭다운 / 로그인 버튼 — DESIGN.md §10 'AuthMenu'.
 * 세션은 클라이언트에서 조회해 요청별 로케일 SSR과 인증 데이터 조회를 분리한다.
 * 마운트 후 profiles.nickname을 읽어 상태 확정.
 * - 비로그인/조회 전: "로그인" 버튼 → /login?next=현재경로
 * - 로그인: 이니셜 아바타 → 드롭다운(MY·저장한 밈·로그아웃)
 * - 드롭다운 fade+scale 진입, 바깥 클릭/esc 닫기, 열릴 때 첫 항목 포커스.
 * - prefers-reduced-motion 존중. 터치 타깃 44px+.
 */
/** 로그인 상태 힌트 — 직전 로그인의 닉네임을 보관해 재방문 시 즉시 아바타를 그린다. */
const AUTH_HINT_KEY = "mc_auth_nick";
/** Plus 멤버십 힌트 — 구독자는 재방문 시 헤더 PLUS 배지를 즉시 그린다. */
const PLUS_HINT_KEY = "mc_auth_plus";

function hydrationSafeLoginPathname(pathname: string): string {
  const detail = pathname.match(
    /^(\/(?:(?:en|ja|zh|zh-tw)\/)?memes\/[a-z0-9]{8})(?:-.*)?$/,
  );
  return detail?.[1] ?? pathname;
}

export function AuthMenu() {
  const routePathname = normalizePathname(usePathname());
  // Proxy rewrites can give usePathname() a different value on the server and
  // in the browser. For detail routes, the short-id-only URL is stable across
  // both values and still resolves to the same document without JavaScript.
  // Other routes retain their original login return path on the first render.
  const [pathname, setPathname] = useState(() =>
    hydrationSafeLoginPathname(routePathname),
  );
  const reduce = useReducedMotion();
  // null = 아직 조회 전, string = 로그인, "" = 비로그인 확정
  const [nickname, setNickname] = useState<string | null>(null);
  // 헤더 PLUS 배지 노출 여부 — billing_subscriptions self-read로 확정.
  const [isPremium, setIsPremium] = useState(false);
  const { messages } = useLocale();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rewrite-safe hydration requires a stable first render
    setPathname(routePathname);
  }, [routePathname]);

  useEffect(() => {
    let alive = true;
    // 낙관적 초기 반영 — 직전 로그인에서 저장한 힌트를 localStorage에서 동기로 읽어
    // 즉시 아바타를 렌더한다. 헤더는 ISR 레이아웃에 있어 서버에서 세션을 읽을 수
    // 없으므로(읽으면 전 페이지 dynamic 강등 → 상세 500), 네트워크 getUser 지연
    // 동안의 "로그인" 깜빡임을 이 힌트로 없앤다. 초기 state는 null로 유지해 SSR/
    // hydration 불일치는 만들지 않는다(마운트 직후 힌트로 교체).
    try {
      const hint = window.localStorage.getItem(AUTH_HINT_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (hint) setNickname(hint);
      if (window.localStorage.getItem(PLUS_HINT_KEY) === "1") setIsPremium(true);
    } catch {
      // 저장소 접근 실패(시크릿 모드 등)는 무시 — 아래 네트워크 조회로 확정된다
    }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!alive) return;
      if (!user) {
        setNickname("");
        setIsPremium(false);
        try {
          window.localStorage.removeItem(AUTH_HINT_KEY);
          window.localStorage.removeItem(PLUS_HINT_KEY);
        } catch {}
        return;
      }
      // 닉네임과 구독 상태를 병렬 조회 — billing_subscriptions는 self-read RLS로
      // 본인 행만 반환된다. 활성 구독이 하나라도 있으면 헤더에 PLUS를 그린다.
      const [{ data }, { data: subs }] = await Promise.all([
        supabase.from("profiles").select("nickname").eq("id", user.id).single(),
        supabase
          .from("billing_subscriptions")
          .select("status, current_period_end, last_event_at"),
      ]);
      if (!alive) return;
      const nick = data?.nickname ?? "밈러";
      setNickname(nick);
      const premium = selectPremiumSubscription(subs ?? []) !== null;
      setIsPremium(premium);
      try {
        window.localStorage.setItem(AUTH_HINT_KEY, nick);
        window.localStorage.setItem(PLUS_HINT_KEY, premium ? "1" : "0");
      } catch {}
    });
    // 로그인/로그아웃 변화 반영
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) {
        setNickname("");
        setIsPremium(false);
        try {
          window.localStorage.removeItem(AUTH_HINT_KEY);
          window.localStorage.removeItem(PLUS_HINT_KEY);
        } catch {}
      }
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  if (!nickname) {
    const next = encodeURIComponent(pathname || "/");
    return (
      <Link
        href={`/login?next=${next}`}
        // 모바일: 고스트(외곽선)로 시각 비중 낮춤 — 첫 화면 주인공은 검색.
        // md+: 기존 솔리드 유지.
        className="inline-flex h-10 shrink-0 items-center whitespace-nowrap rounded-xl border border-border bg-transparent px-3 text-sm font-semibold text-foreground transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:h-11 md:border-0 md:bg-accent-strong md:px-4 md:text-white md:shadow-sm"
      >
        {messages.login}
      </Link>
    );
  }

  return (
    <LoggedInMenu nickname={nickname} reduce={reduce} isPremium={isPremium} />
  );
}

function LoggedInMenu({
  nickname,
  reduce,
  isPremium,
}: {
  nickname: string;
  reduce: boolean | null;
  isPremium: boolean;
}) {
  const { locale, messages } = useLocale();
  const premiumCopy = PREMIUM_COPY[locale];
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstItemRef = useRef<HTMLAnchorElement>(null);
  const initial = Array.from(nickname.trim())[0]?.toUpperCase() ?? "?";

  // 바깥 클릭 / esc 닫기
  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // 열릴 때 첫 항목으로 포커스 이동(간단한 포커스 트랩)
  useEffect(() => {
    if (open) firstItemRef.current?.focus();
  }, [open]);

  const itemClass =
    "flex h-11 items-center rounded-lg px-3 text-sm text-foreground transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none";

  return (
    <div ref={rootRef} className="relative flex items-center gap-1.5">
      {/* 헤더 PLUS 배지 — 구독자는 드롭다운을 열지 않아도 멤버십이 보이고,
          탭하면 MY PLUS 대시보드로 바로 이동한다(§10 AuthMenu). */}
      {isPremium && (
        <Link
          href="/premium"
          aria-label={premiumCopy.dashboard.eyebrow}
          className="inline-block select-none whitespace-nowrap rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-black leading-none tracking-wider text-accent-text transition-transform active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:px-2"
        >
          {premiumCopy.badge}
        </Link>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${nickname}${isPremium ? ` · ${premiumCopy.badge}` : ""} · ${messages.accountMenu}`}
        className="hover-glow-flame flex h-11 w-11 items-center justify-center rounded-full bg-accent-strong text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden>{initial}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={messages.accountMenu}
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="instrument-grid absolute right-0 top-[calc(100%+8px)] z-[100] w-64 rounded-2xl border border-border bg-surface p-2.5 shadow-lg"
          >
            <div className="px-3 pb-2 pt-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {nickname}
              </p>
              <p className="text-xs text-muted">{messages.greeting}</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              ref={firstItemRef}
              href="/my"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              {messages.my}
            </Link>
            <Link
              href="/my#saved"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              {messages.savedMemes}
            </Link>
            <Link
              href="/premium"
              role="menuitem"
              className={`${itemClass} justify-between font-semibold text-accent-text`}
              onClick={() => setOpen(false)}
            >
              {premiumCopy.menuLabel}
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-black tracking-wider">
                {premiumCopy.badge}
              </span>
            </Link>
            <div className="my-1 h-px bg-border" />
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="flex h-11 w-full items-center rounded-lg px-3 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:bg-surface-2 focus-visible:text-foreground focus-visible:outline-none"
              >
                {messages.logout}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
