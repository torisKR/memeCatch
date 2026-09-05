"use client";

import Link from "next/link";
import { AuthMenu, HideOnAdmin } from "@/components/auth-menu";
import { ExploreNavLink } from "@/components/explore-nav-link";
import { BrandTile } from "@/components/brand-mark";
import { HeaderMenu } from "@/components/header-menu";
import { LanguageSelector } from "@/components/language-selector";
import { TrendAlertsBell } from "@/components/premium/trend-alerts-bell";
import { useLocale } from "@/lib/i18n-client";
import { localizedStaticPath } from "@/lib/i18n-routing";

/**
 * 전역 헤더 — DESIGN.md §10 + 2026-07 IA 개편(검색·탐색 중심 제품형 내비).
 * 좌: 워드마크 + 언어 선택 + 주 동선 "탐색".
 * 우: 검색(모바일=아이콘, 데스크톱=미니 검색바) → 제보 강조 CTA →
 *     로그인/프로필(<AuthMenu/>) → 통합 메뉴 드롭다운(<HeaderMenu/> — 연표·
 *     랭킹·소식·랜덤).
 * 연표 상시 링크와 주사위 버튼은 드롭다운으로 이동해 바를 정리했다.
 *
 * 요청 로케일은 layout의 LocaleProvider가 주입해 첫 SSR부터 문서 언어와 맞춘다.
 * 인증 세션은 AuthMenu가 클라이언트에서 별도로 조회해 전역 SSR을 막지 않는다.
 * /admin 경로에선 HideOnAdmin으로 숨긴다.
 */
export function GlobalHeader() {
  const { locale, messages } = useLocale();
  return (
    <HideOnAdmin>
      <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur supports-[backdrop-filter]:bg-surface/70">
        <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-1.5 sm:flex-nowrap sm:py-0">
          <div className="flex w-full items-center justify-between gap-3 sm:w-auto">
            {/* 워드마크 — 불꽃 SVG(오렌지) + 텍스트 */}
            <Link
              href={localizedStaticPath("/", locale)}
              aria-label={messages.home}
              className="group flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-xl py-1 pr-1 transition-transform active:scale-[0.97]"
            >
              <BrandTile className="size-8 shadow-[0_4px_14px_color-mix(in_srgb,var(--accent)_24%,transparent)] transition-transform duration-300 group-hover:-rotate-6" />
              {/* 브랜드명은 모바일에서도 노출(신규 방문자 브랜드 인지) — 도메인 서브라벨만 sm+ */}
              <span className="flex shrink-0 flex-col whitespace-nowrap leading-none">
                <span className="text-lg font-extrabold tracking-[-0.045em]">{messages.brand}</span>
                <span className="mt-1 hidden font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-muted sm:block">
                  catchmeme.com
                </span>
              </span>
            </Link>

            <LanguageSelector />
          </div>

          {/* 데스크톱 탐색 링크 — 모바일은 하단탭에 탐색이 있어 md 이상만 노출 */}
          <ExploreNavLink />

          <div className="flex w-full flex-wrap items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap sm:justify-start">
            {/* 데스크톱: 미니 검색바 */}
            <form
              action={localizedStaticPath("/search", locale)}
              role="search"
              className="hidden lg:block"
            >
              <label htmlFor="header-search" className="sr-only">
                {messages.search}
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="header-search"
                  name="q"
                  type="search"
                  placeholder={messages.searchPlaceholder}
                  autoComplete="off"
                  enterKeyHint="search"
                  className="hover-glow-flame h-11 w-52 rounded-full border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow,width] duration-200 focus:w-64 focus:border-accent focus:ring-4 focus:ring-accent/20"
                />
              </div>
            </form>

            {/* 제보 강조 CTA — 데스크톱 전용(모바일은 하단탭 제보가 담당) */}
            <Link
              href="/submit"
              className="hover-glow-flame hidden min-h-10 items-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:inline-flex"
            >
              {messages.submit}
            </Link>

            {/* 모바일: 검색 아이콘 버튼 */}
            <Link
              href={localizedStaticPath("/search", locale)}
              aria-label={messages.search}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-transparent text-foreground transition-colors hover:border-(--signal-cyan) hover:bg-surface-2 active:scale-[0.95] lg:hidden"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>

            {/* Plus 구독자에게만 렌더된다(내부에서 usePremium 가드) */}
            <TrendAlertsBell />

            <AuthMenu />

            {/* 통합 메뉴 드롭다운 — 연표·랭킹·소식·랜덤 */}
            <HeaderMenu />
          </div>
        </div>
      </header>
    </HideOnAdmin>
  );
}


function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
