"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CATEGORIES, DIFFICULTY, LIFECYCLE_STATUS } from "@/lib/labels";
import type { SocialPlatform, SocialPlatformCounts } from "@/lib/source-platform";

/**
 * 레인 B 여정2 — 탐색 필터 바 (URL 쿼리 동기화, deep link/뒤로가기 보존).
 * - 검색 인풋(이 목록 안 검색 → ?q=, 서버가 search_memes RPC로 필터)
 * - 정렬 세그먼트(급상승·최신·인기·논쟁 중)
 * - 카테고리 칩(다중, 가로 스크롤) — 각 칩이 자기 카테고리 틴트 색 = 필터가 곧 색 범례.
 *   (DESIGN.md §11 소프트 틴트: 틴트 bg + 어두운 텍스트, 선택 시 텍스트색 테두리+진하게)
 * - 접이식 상세 필터(난이도·연도대·미디어, 각 단일)
 * - 필터 초기화
 * 선택 시 router.push({ scroll:false })로 쿼리만 갱신 → 서버가 새 결과 스트리밍.
 * 카테고리 색 토큰(--cat-*)은 레인 A(globals.css)가 제공한다.
 */

const SORTS = [
  { key: "trending", label: "급상승" },
  { key: "recent", label: "최신" },
  { key: "popular", label: "인기" },
  { key: "controversial", label: "논쟁 중" },
] as const;

const PLATFORMS = [
  { key: "", label: "전체 출처" },
  { key: "youtube", label: "YouTube" },
  { key: "youtube_shorts", label: "Shorts" },
  { key: "tiktok", label: "TikTok" },
  { key: "instagram", label: "Instagram" },
] as const;

const PLATFORM_DOT: Record<SocialPlatform, string> = {
  youtube: "bg-red-500",
  youtube_shorts: "bg-rose-500",
  tiktok: "bg-cyan-500",
  instagram: "bg-fuchsia-500",
};

const YEARS = [
  { key: "2020s", label: "2020년대" },
  { key: "2010s", label: "2010년대" },
  { key: "2000s", label: "2000년대" },
] as const;

const MEDIA = [
  { key: "image", label: "짤" },
  { key: "video", label: "영상" },
  { key: "audio", label: "오디오" },
  { key: "text", label: "텍스트" },
  { key: "embed", label: "임베드" },
] as const;

const CATEGORY_ENTRIES = Object.entries(CATEGORIES) as [
  keyof typeof CATEGORIES,
  { user: string },
][];
const DIFFICULTY_ENTRIES = Object.entries(DIFFICULTY) as [
  keyof typeof DIFFICULTY,
  { user: string },
][];
const LIFECYCLE_ENTRIES = Object.entries(LIFECYCLE_STATUS) as [
  keyof typeof LIFECYCLE_STATUS,
  { user: string },
][];

const chipBase =
  "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-[color,border-color,background-color,transform] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const chipOff = "border-border bg-surface text-muted hover:border-accent hover:text-accent";
const chipOn = "border-accent bg-accent-soft font-semibold text-accent";

// 카테고리 틴트 칩 — 항상 자기 카테고리 색(틴트 bg + 어두운 텍스트)으로 렌더해
// 필터 바 자체가 색 범례 역할을 한다. 폭 변화 없게 테두리는 상시 2px(off는 투명).
const catChipBase =
  "inline-flex min-h-11 shrink-0 items-center gap-1 rounded-full border-2 px-3.5 text-sm transition-[border-color,box-shadow,transform] active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** 카테고리 키 → --cat-* 토큰 인라인 스타일 (레인 A 제공 토큰). 선택 시 텍스트색 테두리 강조. */
function catChipStyle(key: string, on: boolean): React.CSSProperties {
  return {
    backgroundColor: `var(--cat-${key}-bg)`,
    color: `var(--cat-${key}-text)`,
    borderColor: on ? `var(--cat-${key}-text)` : "transparent",
    boxShadow: on ? "0 1px 3px rgb(0 0 0 / 0.12)" : "none",
  };
}

export function ExploreFilters({
  platformCounts,
}: {
  platformCounts: SocialPlatformCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeCategories = searchParams.getAll("category");
  const sort = searchParams.get("sort") ?? "trending";
  const difficulty = searchParams.get("difficulty") ?? "";
  const year = searchParams.get("year") ?? "";
  const media = searchParams.get("media") ?? "";
  const lifecycle = searchParams.get("lifecycle") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const activeQuery = searchParams.get("q") ?? "";

  // 검색 인풋은 로컬 상태로 다루되 URL(뒤로가기·초기화)과 동기화한다.
  const [query, setQuery] = useState(activeQuery);
  useEffect(() => {
    // 외부 상태(URL 쿼리)를 로컬 인풋에 반영 — 뒤로가기·필터 초기화 시 동기화
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const hasFilters =
    activeCategories.length > 0 ||
    !!difficulty ||
    !!year ||
    !!media ||
    !!lifecycle ||
    !!platform ||
    !!activeQuery ||
    (sort !== "trending" && !!searchParams.get("sort"));

  const pushParams = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  // 단일 값 토글 — 같은 값 다시 누르면 해제
  const toggleSingle = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (next.get(key) === value) next.delete(key);
      else next.set(key, value);
      pushParams(next);
    },
    [searchParams, pushParams]
  );

  // 다중 값 토글(카테고리)
  const toggleMulti = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      const current = next.getAll(key);
      next.delete(key);
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      for (const v of updated) next.append(key, v);
      pushParams(next);
    },
    [searchParams, pushParams]
  );

  const setSort = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      next.set("sort", value);
      pushParams(next);
    },
    [searchParams, pushParams]
  );

  const setPlatform = useCallback(
    (value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set("platform", value);
      else next.delete("platform");
      pushParams(next);
    },
    [searchParams, pushParams]
  );

  // 검색 제출 — ?q= 갱신(빈 값이면 제거). 다른 필터는 유지.
  const submitSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const next = new URLSearchParams(searchParams);
      const trimmed = query.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      pushParams(next);
    },
    [query, searchParams, pushParams]
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    pushParams(next);
  }, [searchParams, pushParams]);

  const reset = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [router, pathname]);

  return (
    <div className="mt-4 space-y-3">
      {/* 검색 인풋 — 이 목록 안에서 검색(제출 시 ?q=) */}
      <form role="search" onSubmit={submitSearch} className="relative">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-muted"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
        </span>
        <input
          type="search"
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="이 목록에서 검색"
          aria-label="이 목록에서 검색"
          enterKeyHint="search"
          className="min-h-11 w-full rounded-full border border-border bg-surface py-2 pl-11 pr-28 text-base text-foreground placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:appearance-none"
        />
        <div className="absolute inset-y-0 right-1.5 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="검색어 지우기"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted transition-colors hover:text-accent active:scale-95"
            >
              <svg
                viewBox="0 0 24 24"
                aria-hidden
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
          <button
            type="submit"
            className="inline-flex min-h-11 items-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-[filter,transform] hover:brightness-95 active:scale-[0.97]"
          >
            검색
          </button>
        </div>
      </form>

      {/* 신호 레일 — 정렬과 원본 플랫폼을 한 덩어리로 묶어, 필터가 여러 단으로
          흩어져 보이지 않게 한다. */}
      <section className="rounded-2xl border border-border bg-surface p-3.5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold tracking-[0.12em] text-muted">정렬</p>
          <p className="text-xs font-bold tracking-[0.12em] text-muted">원본 플랫폼</p>
        </div>
        <div className="mt-2.5 grid gap-3 lg:grid-cols-2">
          <div
            role="tablist"
            aria-label="정렬"
            className="flex gap-1.5 overflow-x-auto pb-1"
          >
            {SORTS.map((s) => {
              const on = sort === s.key;
              return (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setSort(s.key)}
                  className={`${chipBase} ${on ? chipOn : chipOff}`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <div
            role="tablist"
            aria-label="원본 플랫폼"
            className="flex gap-1.5 overflow-x-auto pb-1"
          >
            {PLATFORMS.map((item) => {
              const on = platform === item.key;
              const count = item.key
                ? platformCounts[item.key as SocialPlatform]
                : null;
              const unavailable = count === 0;
              return (
                <button
                  key={item.key || "all"}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setPlatform(item.key)}
                  className={`${chipBase} ${on ? chipOn : chipOff} ${
                    unavailable && !on ? "border-dashed opacity-70" : ""
                  }`}
                >
                  {item.key && (
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${PLATFORM_DOT[item.key as SocialPlatform]}`}
                    />
                  )}
                  {item.label}
                  {count !== null && (
                    <span
                      aria-label={`${count}개`}
                      className="rounded-full bg-foreground/8 px-1.5 py-0.5 font-mono text-xs tabular-nums transition-transform duration-200 ease-out motion-reduce:transition-none"
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
        <p className="mt-2.5 border-t border-border pt-2.5 text-xs leading-relaxed text-muted">
          숫자는 현재 재생 가능한 공개 콘텐츠 수예요. 0은 아직 검수된 공개 원본이 없다는 뜻이에요.
        </p>
      </section>

      {/* 카테고리 칩(다중) — 각 칩이 자기 카테고리 틴트 색 = 색 범례.
          선택 시 텍스트색 테두리+진하게(고채도는 신호등 독점이라 저채도 틴트만 사용). */}
      <div
        aria-label="카테고리"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
      >
        {CATEGORY_ENTRIES.map(([key, meta]) => {
          const on = activeCategories.includes(key);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleMulti("category", key)}
              style={catChipStyle(key, on)}
              className={`${catChipBase} ${on ? "font-semibold" : "font-medium"}`}
            >
              {meta.user}
            </button>
          );
        })}
      </div>

      {/* 상세 필터 토글 */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className={`${chipBase} ${
            difficulty || year || media || lifecycle ? chipOn : chipOff
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M3 6h18M6 12h12M10 18h4" />
          </svg>
          상세 필터
        </button>
        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold text-muted underline-offset-2 transition-colors hover:text-accent hover:underline active:scale-[0.97]"
          >
            필터 초기화
          </button>
        )}
      </div>

      {open && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface-2 p-4">
          <FilterRow label="난이도">
            {DIFFICULTY_ENTRIES.map(([key, meta]) => (
              <ChipBtn
                key={key}
                on={difficulty === key}
                onClick={() => toggleSingle("difficulty", key)}
              >
                {meta.user}
              </ChipBtn>
            ))}
          </FilterRow>

          <FilterRow label="생애주기">
            {LIFECYCLE_ENTRIES.map(([key, meta]) => (
              <ChipBtn
                key={key}
                on={lifecycle === key}
                onClick={() => toggleSingle("lifecycle", key)}
              >
                {meta.user}
              </ChipBtn>
            ))}
          </FilterRow>

          <FilterRow label="연도대">
            {YEARS.map((y) => (
              <ChipBtn
                key={y.key}
                on={year === y.key}
                onClick={() => toggleSingle("year", y.key)}
              >
                {y.label}
              </ChipBtn>
            ))}
          </FilterRow>

          <FilterRow label="미디어">
            {MEDIA.map((m) => (
              <ChipBtn
                key={m.key}
                on={media === m.key}
                onClick={() => toggleSingle("media", m.key)}
              >
                {m.label}
              </ChipBtn>
            ))}
          </FilterRow>
        </div>
      )}
    </div>
  );
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-semibold text-muted">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function ChipBtn({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`${chipBase} ${on ? chipOn : chipOff}`}
    >
      {children}
    </button>
  );
}
