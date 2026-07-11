import Link from "next/link";
import { AuthMenu, HideOnAdmin } from "@/components/auth-menu";
import { ExploreNavLink } from "@/components/explore-nav-link";
import { BrandTile } from "@/components/brand-mark";
import { RandomMemeButton } from "@/components/random-meme-button";

/**
 * 전역 헤더 — DESIGN.md §10.
 * sticky top-0, 반투명 배경 + blur. 좌: 밈캐치 불꽃 워드마크(이모지 금지, SVG 불꽃)
 * + 데스크톱 "탐색" 링크(/explore, active 표시 — <ExploreNavLink/> 클라이언트 헬퍼).
 * 우: 검색 진입(모바일=아이콘→/search, 데스크톱=미니 검색바→/search) + <AuthMenu/>.
 * 모바일 탐색은 하단탭(BottomNav)이 담당하므로 헤더는 로고+검색만 유지.
 *
 * 순수 정적 컴포넌트 — 쿠키/세션을 서버에서 읽지 않는다.
 * (layout에서 쿠키를 읽으면 모든 페이지가 dynamic으로 강등돼 상세/홈 ISR이
 *  DYNAMIC_SERVER_USAGE로 깨진다. 세션은 AuthMenu가 클라이언트에서 조회한다.)
 * /admin 경로에선 HideOnAdmin으로 숨긴다.
 */
export function GlobalHeader() {
  return (
    <HideOnAdmin>
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          {/* 워드마크 — 불꽃 SVG(오렌지) + 텍스트 */}
          <Link
            href="/"
            aria-label="밈캐치 홈"
            className="group flex min-h-11 items-center gap-2 rounded-xl py-1 pr-1 transition-transform active:scale-[0.97]"
          >
            <BrandTile className="size-8 shadow-[0_4px_14px_color-mix(in_srgb,var(--accent)_24%,transparent)] transition-transform duration-300 group-hover:-rotate-6" />
            <span className="flex flex-col leading-none">
              <span className="text-lg font-extrabold tracking-[-0.045em]">밈캐치</span>
              <span className="mt-1 hidden font-mono text-[8px] font-semibold uppercase tracking-[0.13em] text-muted sm:block">
                catchmeme.com
              </span>
            </span>
          </Link>

          {/* 데스크톱 탐색 링크 — 모바일은 하단탭에 탐색이 있어 md 이상만 노출 */}
          <ExploreNavLink />

          <div className="ml-auto flex items-center gap-2">
            {/* 데스크톱: 미니 검색바 */}
            <form
              action="/search"
              role="search"
              className="hidden md:block"
            >
              <label htmlFor="header-search" className="sr-only">
                밈 검색
              </label>
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="header-search"
                  name="q"
                  type="search"
                  placeholder="밈 검색"
                  autoComplete="off"
                  enterKeyHint="search"
                  className="h-10 w-52 rounded-full border border-border bg-surface pl-9 pr-3 text-sm outline-none transition-[border-color,box-shadow,width] duration-200 focus:w-64 focus:border-accent focus:ring-4 focus:ring-accent/20"
                />
              </div>
            </form>

            <RandomMemeButton />

            {/* 모바일: 검색 아이콘 버튼 */}
            <Link
              href="/search"
              aria-label="밈 검색"
              className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-2 active:scale-[0.95] md:hidden"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>

            <AuthMenu />
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
