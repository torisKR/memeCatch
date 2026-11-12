"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Dices,
  Layers3,
  Globe2,
  Grid2X2,
  Milestone,
  Newspaper,
  Trophy,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";
import { useLocale } from "@/lib/i18n-client";
import { track } from "@/lib/analytics";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";

/**
 * 헤더 우측 통합 메뉴 드롭다운 (2026-07 헤더 IA 개편).
 * 좌측 상시 내비를 탐색(주 동선) 하나로 줄이고, 보조 목적지(연표·
 * 랭킹·소식·랜덤)를 이 메뉴로 통합한다. 항목은 전부 i18n 키 보유분만.
 * 접근성: disclosure 패턴(button aria-expanded + nav) — 링크 목록엔 role=menu보다
 * 권장. ESC(버튼 포커스 복귀)·바깥 클릭·라우트 변경 시 닫힘. 포커스 트랩 불필요
 * (모달 아님, Tab 순서가 자연스럽게 패널을 통과).
 */
export function HeaderMenu() {
  const { locale = "ko", messages } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  // 바깥 클릭 + ESC — 열려 있을 때만 리스너 부착
  // (항목 클릭 닫기는 각 Link onClick에서 직접 처리 — effect 내 setState 회피)
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const items: {
    href: string;
    label: string;
    icon: LucideIcon;
    prefetch?: boolean;
  }[] = [
    { href: "/meme-cards", label: MEME_CARDS_COPY[locale].nav, prefetch: false, icon: Layers3 },
    {
      href: "/global",
      label: locale === "ko" ? "글로벌 피드" : "Global feed",
      prefetch: false,
      icon: Globe2,
    },
    {
      href: "/studio",
      label: locale === "ko" ? "밈 스튜디오" : "Meme studio (Korean)",
      prefetch: false,
      icon: WandSparkles,
    },
    { href: "/timeline", label: messages.timeline, prefetch: false, icon: Milestone },
    { href: "/rankings", label: messages.rankings, prefetch: false, icon: Trophy },
    { href: "/news", label: messages.news, prefetch: false, icon: Newspaper },
  ];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls="header-menu-panel"
        aria-label={messages.menu}
        onClick={() => setOpen((v) => !v)}
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-transparent transition-colors hover:border-(--signal-cyan) active:scale-[0.95] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          open ? "bg-surface-2 text-foreground" : "text-foreground hover:bg-surface-2"
        }`}
      >
        <Grid2X2 className="size-5" strokeWidth={1.8} aria-hidden />
      </button>

      {open && (
        <nav
          id="header-menu-panel"
          aria-label={messages.menu}
          className="menu-pop instrument-grid absolute right-0 top-[calc(100%+10px)] z-50 w-60 rounded-2xl border border-border bg-surface/95 p-2 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md"
        >
          <p
            aria-hidden
            className="px-3 pb-1.5 pt-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted"
          >
            Menu
          </p>
          <ul>
            {items.map((item) => {
              const active = pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={item.prefetch}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`hover-glow-flame flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
                      active
                        ? "bg-surface-2 font-semibold text-foreground"
                        : "font-medium text-foreground/85 hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <Icon
                      className={active ? "size-[18px] text-accent" : "size-[18px] text-muted"}
                      strokeWidth={1.8}
                      aria-hidden
                    />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div aria-hidden className="mx-3 my-1.5 h-px bg-border" />
          <Link
            href="/memes/random"
            prefetch={false}
            onClick={() => {
              track("random_meme");
              setOpen(false);
            }}
            className="hover-glow-flame flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-foreground/85 transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <Dices className="size-[18px] text-muted" strokeWidth={1.8} aria-hidden />
            {messages.random}
          </Link>
        </nav>
      )}
    </div>
  );
}
