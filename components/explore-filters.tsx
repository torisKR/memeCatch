"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DISPLAY_CATEGORIES,
  DISPLAY_CATEGORY_LIST,
  DIFFICULTY,
  LIFECYCLE_STATUS,
  type DisplayCategoryKey,
  expandDisplayCategoryTokens,
} from "@/lib/labels";
import type { SocialPlatform, SocialPlatformCounts } from "@/lib/source-platform";

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

const DIFFICULTY_ENTRIES = Object.entries(DIFFICULTY) as [
  keyof typeof DIFFICULTY,
  { user: string },
][];
const LIFECYCLE_ENTRIES = Object.entries(LIFECYCLE_STATUS) as [
  keyof typeof LIFECYCLE_STATUS,
  { user: string },
][];

const chipBase =
  "inline-flex min-h-10 items-center rounded-full border px-3 text-sm font-medium transition-[color,border-color,background-color] motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const chipOff = "border-border bg-surface text-muted hover:border-accent/60 hover:text-foreground";
const chipOn = "border-accent bg-accent-soft font-semibold text-accent";

/** 검색과 결과 사이를 한 줄 도구막대로 정돈한 URL 동기화 필터. */
export function ExploreFilters({
  platformCounts,
}: {
  platformCounts: SocialPlatformCounts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeDisplayCategories = expandDisplayCategoryTokens(
    searchParams.getAll("category")
  );
  const sort = searchParams.get("sort") ?? "trending";
  const difficulty = searchParams.get("difficulty") ?? "";
  const year = searchParams.get("year") ?? "";
  const media = searchParams.get("media") ?? "";
  const lifecycle = searchParams.get("lifecycle") ?? "";
  const platform = searchParams.get("platform") ?? "";
  const activeQuery = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(activeQuery);

  useEffect(() => {
    // 뒤로가기와 초기화로 URL이 바뀌면 입력값도 같은 상태로 되돌린다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(searchParams.get("q") ?? "");
  }, [searchParams]);

  const filterCount =
    activeDisplayCategories.length +
    Number(Boolean(difficulty)) +
    Number(Boolean(year)) +
    Number(Boolean(media)) +
    Number(Boolean(lifecycle)) +
    Number(Boolean(platform));
  const hasAnyState = filterCount > 0 || Boolean(activeQuery) || sort !== "trending";

  const pushParams = useCallback(
    (next: URLSearchParams) => {
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router],
  );

  const setSingle = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (value) next.set(key, value);
      else next.delete(key);
      pushParams(next);
    },
    [pushParams, searchParams],
  );

  const toggleSingle = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(searchParams);
      if (next.get(key) === value) next.delete(key);
      else next.set(key, value);
      pushParams(next);
    },
    [pushParams, searchParams],
  );

  const toggleCategory = useCallback(
    (value: string) => {
      const token = expandDisplayCategoryTokens([value])[0];
      if (!token) return;
      const next = new URLSearchParams(searchParams);
      const current = new Set(activeDisplayCategories);
      if (current.has(token)) current.delete(token);
      else current.add(token);
      next.delete("category");
      for (const item of current) next.append("category", item);
      pushParams(next);
    },
    [activeDisplayCategories, pushParams, searchParams],
  );

  const submitSearch = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const next = new URLSearchParams(searchParams);
      const trimmed = query.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      pushParams(next);
    },
    [pushParams, query, searchParams],
  );

  const clearSearch = useCallback(() => {
    setQuery("");
    const next = new URLSearchParams(searchParams);
    next.delete("q");
    pushParams(next);
  }, [pushParams, searchParams]);

  const reset = useCallback(() => {
    router.push(pathname, { scroll: false });
  }, [pathname, router]);

  const activeChips = [
    ...activeDisplayCategories.map((key) => ({
      key: `category:${key}`,
      label: DISPLAY_CATEGORIES[key as DisplayCategoryKey]?.user ?? key,
      clear: () => toggleCategory(key),
    })),
    ...(platform
      ? [{
          key: `platform:${platform}`,
          label: PLATFORMS.find((item) => item.key === platform)?.label ?? platform,
          clear: () => setSingle("platform", ""),
        }]
      : []),
    ...(difficulty
      ? [{
          key: `difficulty:${difficulty}`,
          label: DIFFICULTY[difficulty as keyof typeof DIFFICULTY]?.user ?? difficulty,
          clear: () => setSingle("difficulty", ""),
        }]
      : []),
    ...(lifecycle
      ? [{
          key: `lifecycle:${lifecycle}`,
          label: LIFECYCLE_STATUS[lifecycle as keyof typeof LIFECYCLE_STATUS]?.user ?? lifecycle,
          clear: () => setSingle("lifecycle", ""),
        }]
      : []),
    ...(year
      ? [{
          key: `year:${year}`,
          label: YEARS.find((item) => item.key === year)?.label ?? year,
          clear: () => setSingle("year", ""),
        }]
      : []),
    ...(media
      ? [{
          key: `media:${media}`,
          label: MEDIA.find((item) => item.key === media)?.label ?? media,
          clear: () => setSingle("media", ""),
        }]
      : []),
  ];

  return (
    <div className="mt-6 border-y border-border py-4">
      <form role="search" onSubmit={submitSearch} className="relative">
        <svg
          viewBox="0 0 24 24"
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
        <input
          type="search"
          name="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="밈 이름이나 뜻으로 검색"
          aria-label="밈 이름이나 뜻으로 검색"
          enterKeyHint="search"
          className="min-h-12 w-full rounded-xl border border-border bg-surface py-2 pl-11 pr-28 text-base text-foreground placeholder:text-muted focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:appearance-none"
        />
        <div className="absolute inset-y-0 right-2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="검색어 지우기"
              className="grid size-9 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              <span aria-hidden>×</span>
            </button>
          )}
          <button
            type="submit"
            className="inline-flex h-9 items-center rounded-lg bg-accent-strong px-4 text-sm font-bold text-white transition-[filter] hover:brightness-110"
          >
            검색
          </button>
        </div>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm">
          <span className="text-muted">정렬</span>
          <select
            value={sort}
            onChange={(event) => setSingle("sort", event.target.value)}
            aria-label="정렬 방식"
            className="rounded-sm bg-transparent font-semibold text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {SORTS.map((item) => (
              <option key={item.key} value={item.key}>{item.label}</option>
            ))}
          </select>
        </label>

        <label className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm">
          <span className="text-muted">출처</span>
          <select
            value={platform}
            onChange={(event) => setSingle("platform", event.target.value)}
            aria-label="원본 플랫폼"
            className="rounded-sm bg-transparent font-semibold text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {PLATFORMS.map((item) => {
              const count = item.key
                ? platformCounts[item.key as SocialPlatform]
                : null;
              return (
                <option key={item.key || "all"} value={item.key}>
                  {item.label}{count === null ? "" : ` · ${count}`}
                </option>
              );
            })}
          </select>
        </label>

        <button
          type="button"
          aria-expanded={open}
          aria-controls="explore-filter-panel"
          onClick={() => setOpen((value) => !value)}
          className={`${chipBase} ${filterCount > 0 ? chipOn : chipOff}`}
        >
          필터{filterCount > 0 ? ` ${filterCount}` : ""}
          <span aria-hidden className={`ml-1 transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
        </button>

        {hasAnyState && (
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-10 items-center px-2 text-sm font-semibold text-muted underline decoration-border underline-offset-4 transition-colors hover:text-accent"
          >
            초기화
          </button>
        )}
      </div>

      {activeChips.length > 0 && (
        <ul aria-label="적용된 필터" className="mt-3 flex flex-wrap gap-2">
          {activeChips.map((item) => (
            <li key={item.key}>
              <button
                type="button"
                onClick={item.clear}
                aria-label={`${item.label} 필터 해제`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-sm font-semibold text-foreground transition-colors hover:text-accent"
              >
                {item.label} <span aria-hidden>×</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div id="explore-filter-panel" className="mt-4 space-y-5 border-t border-border pt-4">
          <fieldset>
            <legend className="text-sm font-bold">카테고리</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DISPLAY_CATEGORY_LIST.map(({ key, user }) => {
                const on = activeDisplayCategories.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleCategory(key)}
                    className={`${chipBase} ${on ? chipOn : chipOff}`}
                  >
                    {user}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-5 md:grid-cols-2">
            <FilterGroup label="난이도">
              {DIFFICULTY_ENTRIES.map(([key, meta]) => (
                <FilterButton
                  key={key}
                  on={difficulty === key}
                  onClick={() => toggleSingle("difficulty", key)}
                >
                  {meta.user}
                </FilterButton>
              ))}
            </FilterGroup>
            <FilterGroup label="생애주기">
              {LIFECYCLE_ENTRIES.map(([key, meta]) => (
                <FilterButton
                  key={key}
                  on={lifecycle === key}
                  onClick={() => toggleSingle("lifecycle", key)}
                >
                  {meta.user}
                </FilterButton>
              ))}
            </FilterGroup>
            <FilterGroup label="연도대">
              {YEARS.map((item) => (
                <FilterButton
                  key={item.key}
                  on={year === item.key}
                  onClick={() => toggleSingle("year", item.key)}
                >
                  {item.label}
                </FilterButton>
              ))}
            </FilterGroup>
            <FilterGroup label="미디어">
              {MEDIA.map((item) => (
                <FilterButton
                  key={item.key}
                  on={media === item.key}
                  onClick={() => toggleSingle("media", item.key)}
                >
                  {item.label}
                </FilterButton>
              ))}
            </FilterGroup>
          </div>
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset>
      <legend className="text-sm font-bold">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function FilterButton({
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
