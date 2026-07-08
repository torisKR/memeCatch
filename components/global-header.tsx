import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AuthMenu, HideOnAdmin } from "@/components/auth-menu";

/**
 * 전역 헤더 — DESIGN.md §10.
 * sticky top-0, 반투명 배경 + blur. 좌: 밈캐치 불꽃 워드마크(이모지 금지, SVG 불꽃).
 * 우: 검색 진입(모바일=아이콘→/search, 데스크톱=미니 검색바→/search) + <AuthMenu/>.
 * 서버 컴포넌트로 세션을 조회해 로그인 상태(nickname)를 AuthMenu(클라)에 전달한다.
 * /admin 경로에선 HideOnAdmin으로 숨긴다.
 */
export async function GlobalHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let nickname: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("nickname")
      .eq("id", user.id)
      .single();
    nickname = data?.nickname ?? null;
  }

  return (
    <HideOnAdmin>
      <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          {/* 워드마크 — 불꽃 SVG(오렌지) + 텍스트 */}
          <Link
            href="/"
            aria-label="밈캐치 홈"
            className="flex items-center gap-1.5 rounded-lg py-1 pr-1 text-lg font-extrabold tracking-tight transition-transform active:scale-[0.97]"
          >
            <FlameMark className="h-5 w-5 text-accent" />
            <span>밈캐치</span>
          </Link>

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

            {/* 모바일: 검색 아이콘 버튼 */}
            <Link
              href="/search"
              aria-label="밈 검색"
              className="flex h-11 w-11 items-center justify-center rounded-full text-foreground transition-colors hover:bg-surface-2 active:scale-[0.95] md:hidden"
            >
              <SearchIcon className="h-5 w-5" />
            </Link>

            <AuthMenu nickname={nickname} />
          </div>
        </div>
      </header>
    </HideOnAdmin>
  );
}

function FlameMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M13.1 2c.5 2.7-.5 4.6-2 6.2-1.5 1.6-3.4 3-3.4 5.9a6.3 6.3 0 0 0 12.6.1c0-2.4-1-4.3-2-5.9-.4 1-1 1.7-1.9 2.1.7-3-.4-6.2-3.3-8.4Zm-.6 9.3c1.2 1.2 2 2.3 2 3.8a2.5 2.5 0 0 1-5 0c0-1 .5-1.8 1.1-2.6.2.6.6 1 1.1 1.3-.1-1 .2-1.8.8-2.5Z" />
    </svg>
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
