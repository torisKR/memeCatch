"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { memePathFrom } from "@/lib/labels";
import { track } from "@/lib/analytics";
import { SearchSuggest, type SearchSuggestion } from "@/components/search-suggest";

const RECENT_KEY = "mc_recent_searches";
const MAX_RECENT = 8;

function loadRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    /* 프라이빗 모드 등에서 저장 실패해도 검색은 계속 동작해야 함 */
  }
}

/** 검색 인풋 — 디바운스 300ms + URL(?q=) 동기화 + 자동완성/최근·인기 검색어 드롭다운.
 *  초성 검색은 서버 RPC(search_memes)가 처리. JS 없이도 form 제출로 /search 이동은 그대로 동작. */
export function SearchInput({
  initialQuery,
  popularTerms,
}: {
  initialQuery: string;
  popularTerms: string[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const lastPushed = useRef(initialQuery);

  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const uid = useId();
  const listboxId = `search-suggest-listbox-${uid}`;
  const optionId = useCallback((i: number) => `search-suggest-option-${uid}-${i}`, [uid]);

  const trimmed = value.trim();
  const hasQuery = trimmed.length > 0;

  // 최근 검색어는 localStorage 기반 — 마운트 후 클라이언트에서만 읽어 하이드레이션 불일치 방지
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(loadRecent());
  }, []);

  // URL(?q=) 동기화 — 기존 동작 유지(직접 이동 폴백 겸 결과 목록 갱신)
  useEffect(() => {
    if (trimmed === lastPushed.current) return;
    const timer = window.setTimeout(() => {
      lastPushed.current = trimmed;
      router.replace(trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : "/search");
    }, 300);
    return () => window.clearTimeout(timer);
  }, [trimmed, router]);

  // 자동완성 — 300ms 디바운스로 search_memes RPC 호출(브라우저 클라이언트)
  useEffect(() => {
    if (!hasQuery) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      setActiveIndex(-1);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      supabase
        .rpc("search_memes", { p_query: trimmed, p_limit: 6 })
        .then(({ data, error }) => {
          if (cancelled) return;
          setLoading(false);
          setActiveIndex(-1);
          if (error || !data) {
            setSuggestions([]);
            return;
          }
          setSuggestions(
            data.map((row) => ({
              id: row.id,
              short_id: row.short_id,
              slug: row.slug,
              title: row.title,
              summary: row.summary,
              category: row.category,
            }))
          );
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmed, hasQuery, supabase]);

  // 바깥 클릭 시 드롭다운 닫힘
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function recordRecent(term: string) {
    const t = term.trim();
    if (!t) return;
    const next = [t, ...recent.filter((r) => r !== t)].slice(0, MAX_RECENT);
    setRecent(next);
    saveRecent(next);
  }

  function goToSearch(term: string) {
    const t = term.trim();
    lastPushed.current = t;
    router.replace(t ? `/search?q=${encodeURIComponent(t)}` : "/search");
  }

  function handleSelectSuggestion(item: SearchSuggestion) {
    track("search_suggest_click", { query: trimmed, meme_short_id: item.short_id });
    recordRecent(trimmed);
    setOpen(false);
    router.push(memePathFrom(item.short_id, item.slug));
  }

  function handleSelectRecent(term: string) {
    setValue(term);
    recordRecent(term);
    goToSearch(term);
    setOpen(false);
  }

  function handleSelectPopular(term: string) {
    setValue(term);
    recordRecent(term);
    goToSearch(term);
    setOpen(false);
  }

  function handleRemoveRecent(term: string) {
    const next = recent.filter((r) => r !== term);
    setRecent(next);
    saveRecent(next);
  }

  function handleClearRecent() {
    setRecent([]);
    saveRecent([]);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || !hasQuery) return;
    if (e.key === "ArrowDown") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && suggestions[activeIndex]) {
        e.preventDefault();
        handleSelectSuggestion(suggestions[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          recordRecent(trimmed);
          setOpen(false);
          goToSearch(trimmed);
        }}
      >
        <label htmlFor="search-q" className="sr-only">
          밈 검색
        </label>
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            aria-hidden
            className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            id="search-q"
            name="q"
            type="search"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder="무슨 밈인지 검색해보세요"
            autoComplete="off"
            enterKeyHint="search"
            autoFocus={!initialQuery}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? optionId(activeIndex) : undefined}
            className="h-14 w-full rounded-2xl border border-border bg-surface pl-12 pr-4 text-base shadow-sm outline-none transition-[border-color,box-shadow] duration-200 focus:border-accent focus:ring-4 focus:ring-accent/20"
          />
        </div>
      </form>

      {open && (
        <SearchSuggest
          hasQuery={hasQuery}
          loading={loading}
          suggestions={suggestions}
          activeIndex={activeIndex}
          listboxId={listboxId}
          optionId={optionId}
          onHoverIndex={setActiveIndex}
          onSelect={handleSelectSuggestion}
          recent={recent}
          onSelectRecent={handleSelectRecent}
          onRemoveRecent={handleRemoveRecent}
          onClearRecent={handleClearRecent}
          popularTerms={popularTerms}
          onSelectPopular={handleSelectPopular}
        />
      )}
    </div>
  );
}
