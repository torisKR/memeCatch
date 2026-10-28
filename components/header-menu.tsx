"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CirclePlus,
  Layers3,
  Menu,
  Milestone,
  ShoppingBag,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import { LanguageSelector } from "@/components/language-selector";
import { useLocale } from "@/lib/i18n-client";
import { MEME_CARDS_COPY } from "@/lib/i18n-meme-cards";
import { localizedStaticPath } from "@/lib/i18n-routing";

/**
 * 헤더 우측 통합 메뉴 드롭다운.
 * 기본 바에서는 탐색·검색만 보여 주고 참여, 제품, 언어 등 보조 목적지를
 * 이 메뉴에 모은다.
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
    prefetch?: false;
  }[] = [
    { href: "/submit", label: messages.submit, prefetch: false, icon: CirclePlus },
    { href: "/community", label: messages.community, prefetch: false, icon: Users },
    { href: "/meme-cards", label: MEME_CARDS_COPY[locale].nav, prefetch: false, icon: Layers3 },
    { href: "/timeline", label: messages.timeline, prefetch: false, icon: Milestone },
    { href: "/products", label: messages.products, prefetch: false, icon: ShoppingBag },
    { href: localizedStaticPath("/pricing", locale), label: "Plus", prefetch: false, icon: Star },
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
        className={`flex h-11 w-11 items-center justify-center rounded-xl border border-transparent transition-colors active:scale-[0.97] motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          open ? "bg-surface-2 text-foreground" : "text-foreground hover:bg-surface-2"
        }`}
      >
        <Menu className="size-5" strokeWidth={2} aria-hidden />
      </button>

      {open && (
        <nav
          id="header-menu-panel"
          aria-label={messages.menu}
          className="menu-pop absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-2xl border border-border bg-surface p-2 shadow-lg"
        >
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
                    className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent ${
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
          <div className="mt-1 flex items-center justify-between gap-3 border-t border-border px-3 py-2">
            <span className="text-sm font-medium text-muted">{messages.language}</span>
            <LanguageSelector />
          </div>
        </nav>
      )}
    </div>
  );
}
