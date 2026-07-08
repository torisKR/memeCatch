"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { signOut } from "@/lib/actions/auth";

/**
 * 전역 헤더가 /admin 경로에서 숨도록 감싸는 클라이언트 게이트.
 * (GlobalHeader는 세션 조회를 위한 서버 컴포넌트라 usePathname을 쓸 수 없어 여기서 처리)
 * BottomNav와 동일한 admin 숨김 규칙을 재사용한다.
 */
export function HideOnAdmin({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <>{children}</>;
}

/**
 * 프로필 아바타 드롭다운 / 로그인 버튼 — DESIGN.md §10 'AuthMenu'.
 * - nickname=null(비로그인): "로그인" 버튼 → /login?next=현재경로
 * - nickname 있음(로그인): 이니셜 아바타 → 드롭다운(MY·저장한 밈·로그아웃)
 * - 드롭다운 fade+scale 진입, 바깥 클릭/esc 닫기, 열릴 때 첫 항목 포커스.
 * - prefers-reduced-motion 존중. 터치 타깃 44px+.
 */
export function AuthMenu({ nickname }: { nickname: string | null }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();

  if (!nickname) {
    const next = encodeURIComponent(pathname || "/");
    return (
      <Link
        href={`/login?next=${next}`}
        className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-white shadow-sm transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        로그인
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
        className="flex h-11 w-11 items-center justify-center rounded-full bg-accent text-sm font-bold text-white shadow-sm transition-transform active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
