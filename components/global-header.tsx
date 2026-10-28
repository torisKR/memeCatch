"use client";

import Link from "next/link";
import { AuthMenu, HideOnAdmin } from "@/components/auth-menu";
import { HeaderDiscoveryLinks } from "@/components/header-discovery-links";
import { BrandTile } from "@/components/brand-mark";
import { HeaderMenu } from "@/components/header-menu";
import { useLocale } from "@/lib/i18n-client";
import { localizedStaticPath } from "@/lib/i18n-routing";

/**
 * 전역 헤더 — 탐색과 검색만 기본 노출한다.
 * 제보·커뮤니티·제품·언어 같은 보조 동선은 HeaderMenu로 모아 모든 화면에서
 * 한 줄 높이를 유지한다.
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
        <div className="mx-auto flex min-h-16 max-w-6xl flex-nowrap items-center gap-2 px-3 sm:px-6">
          <Link
            href={localizedStaticPath("/", locale)}
            aria-label={messages.home}
            className="flex min-h-11 min-w-11 shrink-0 items-center gap-2 rounded-xl pr-1 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <BrandTile className="size-7 sm:size-8" />
            <span className="shrink-0 whitespace-nowrap text-base font-extrabold tracking-[-0.045em] sm:text-lg">
              {messages.brand}
            </span>
          </Link>

          <HeaderDiscoveryLinks />

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
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
                  className="h-11 w-48 rounded-xl border border-border bg-surface-2 pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:ring-4 focus:ring-accent/20 xl:w-60"
                />
              </div>
            </form>

            <Link
              href={localizedStaticPath("/search", locale)}
              aria-label={messages.search}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-transparent text-foreground transition-colors hover:border-border hover:bg-surface-2 lg:hidden"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>

            <AuthMenu />
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
