"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { signOut } from "@/lib/actions/auth";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/lib/i18n-client";

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

export function AuthMenu() {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  // null = 아직 조회 전, string = 로그인, "" = 비로그인 확정
  const [nickname, setNickname] = useState<string | null>(null);
  const { messages } = useLocale();

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
    } catch {
      // 저장소 접근 실패(시크릿 모드 등)는 무시 — 아래 네트워크 조회로 확정된다
    }
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!alive) return;
      if (!user) {
        setNickname("");
        try {
          window.localStorage.removeItem(AUTH_HINT_KEY);
        } catch {}
        return;
      }
      const { data } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", user.id)
        .single();
      if (!alive) return;
      const nick = data?.nickname ?? "밈러";
      setNickname(nick);
      try {
        window.localStorage.setItem(AUTH_HINT_KEY, nick);
      } catch {}
    });
    // 로그인/로그아웃 변화 반영
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session?.user) {
        setNickname("");
        try {
          window.localStorage.removeItem(AUTH_HINT_KEY);
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
        className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-xl bg-accent-strong px-4 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {messages.login}
      </Link>
    );
  }

  return <LoggedInMenu nickname={nickname} reduce={reduce} />;
}

function LoggedInMenu({
  nickname,
  reduce,
}: {
  nickname: string;
  reduce: boolean | null;
}) {
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
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${nickname} 메뉴`}
        className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-strong text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden>{initial}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="내 계정"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -4 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            style={{ transformOrigin: "top right" }}
            className="absolute right-0 top-[calc(100%+8px)] z-[100] w-52 rounded-2xl border border-border bg-surface p-2 shadow-lg"
          >
            <div className="px-3 pb-2 pt-1">
              <p className="truncate text-sm font-semibold text-foreground">
                {nickname}
              </p>
              <p className="text-xs text-muted">님, 어서 오세요</p>
            </div>
            <div className="my-1 h-px bg-border" />
            <Link
              ref={firstItemRef}
              href="/my"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              MY
            </Link>
            <Link
              href="/my#saved"
              role="menuitem"
              className={itemClass}
              onClick={() => setOpen(false)}
            >
              저장한 밈
            </Link>
            <div className="my-1 h-px bg-border" />
            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="flex h-11 w-full items-center rounded-lg px-3 text-left text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:bg-surface-2 focus-visible:text-foreground focus-visible:outline-none"
              >
                로그아웃
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
