"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale } from "@/lib/i18n-client";
import { track } from "@/lib/analytics";

/**
 * 헤더 우측 통합 메뉴 드롭다운 (2026-07 헤더 IA 개편).
 * 좌측 상시 내비를 탐색(주 동선) 하나로 줄이고, 보조 목적지(연표·
 * 랭킹·소식·랜덤)를 이 메뉴로 통합한다. 항목은 전부 i18n 키 보유분만.
 * 접근성: disclosure 패턴(button aria-expanded + nav) — 링크 목록엔 role=menu보다
 * 권장. ESC(버튼 포커스 복귀)·바깥 클릭·라우트 변경 시 닫힘. 포커스 트랩 불필요
 * (모달 아님, Tab 순서가 자연스럽게 패널을 통과).
 */
export function HeaderMenu() {
  const { messages } = useLocale();
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
    icon: React.ReactNode;
    prefetch?: false;
    onClick?: () => void;
  }[] = [
    { href: "/timeline", label: messages.timeline, prefetch: false, icon: <TimelineIcon /> },
    { href: "/rankings", label: messages.rankings, prefetch: false, icon: <TrophyIcon /> },
    { href: "/news", label: messages.news, prefetch: false, icon: <NewsIcon /> },
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
        className={`flex h-11 w-11 items-center justify-center rounded-full border border-transparent transition-colors hover:border-(--signal-cyan) active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
          open ? "bg-surface-2 text-foreground" : "text-foreground hover:bg-surface-2"
        }`}
      >
        {/* 앱 그리드 도트 아이콘 — 햄버거보다 "목적지 모음" 의미에 가깝다 */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
          <circle cx="7" cy="7" r="2" />
          <circle cx="17" cy="7" r="2" />
          <circle cx="7" cy="17" r="2" />
          <circle cx="17" cy="17" r="2" />
        </svg>
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
                    <span className={active ? "text-accent" : "text-muted"}>{item.icon}</span>
                    {item.label}
                    {active && (
                      <span
                        aria-hidden
                        className="signal-live ml-auto size-1.5 shrink-0 rounded-full bg-(--signal-cyan)"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div aria-hidden className="mx-3 my-1.5 h-px bg-border" />
          {/* 랜덤 밈 — 기존 헤더 주사위 버튼을 메뉴로 이동(analytics 이벤트 유지) */}
          <Link
            href="/memes/random"
            prefetch={false}
            onClick={() => {
              track("random_meme");
              setOpen(false);
            }}
            className="hover-glow-flame flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-sm font-medium text-foreground/85 transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
          >
            <span className="text-muted">
              <DiceIcon />
            </span>
            {messages.random}
          </Link>
        </nav>
      )}
    </div>
  );
}

/* 아이콘 — 중립 stroke SVG(이모지 금지 규칙), 하단탭·홈 카드와 동일 문법 */

function iconProps(extra?: string) {
  return {
    viewBox: "0 0 24 24",
    className: `h-[18px] w-[18px] ${extra ?? ""}`,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
}

function TimelineIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M4 12h16" />
      <circle cx="7" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="13" cy="12" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TrophyIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4a2 2 0 0 0 2 4h1M17 6h3a2 2 0 0 1-2 4h-1" />
    </svg>
  );
}

function NewsIcon() {
  return (
    <svg {...iconProps()}>
      <path d="M5 4h14v16H5z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </svg>
  );
}

function DiceIcon() {
  return (
    <svg {...iconProps()}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <circle cx="8.6" cy="8.6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="8.6" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8.6" cy="15.4" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="15.4" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
