"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { memePathFrom } from "@/lib/labels";
import { track } from "@/lib/analytics";
import { SearchSuggest, type SearchSuggestion } from "@/components/search-suggest";
import { GLOBAL_SEARCH_COPY, type SearchInputCopy } from "@/lib/i18n-global-search";
import { createSearchSuggestionCache, SEARCH_SUGGESTION_COLUMNS } from "@/lib/search-suggestions";
import { signalMemeIntentSubmit } from "@/lib/meme-intent-submit.client";

const RECENT_KEY = "mc_recent_searches";
const MAX_RECENT = 8;
const MAX_ISSUED_QUERIES = 8;

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
  searchPath = "/search",
  copy = GLOBAL_SEARCH_COPY.ko.input,
  locale = "ko",
}: {
  initialQuery: string;
  popularTerms: string[];
  searchPath?: string;
  copy?: SearchInputCopy;
  locale?: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);
  const [isComposing, setIsComposing] = useState(false);
  const lastPushed = useRef(initialQuery);
  const lastInitialQuery = useRef(initialQuery);
  const issuedQueries = useRef<string[]>([]);
  const suggestionRequest = useRef<AbortController | null>(null);

  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = useMemo(() => createClient(), []);
  const suggestionCache = useMemo(() => createSearchSuggestionCache(), []);
  const uid = useId();
  const listboxId = `search-suggest-listbox-${uid}`;
  const optionId = useCallback((i: number) => `search-suggest-option-${uid}-${i}`, [uid]);

  const trimmed = value.trim();
  const hasQuery = trimmed.length > 0;

  function rememberIssuedQuery(query: string) {
    issuedQueries.current = [...issuedQueries.current, query].slice(-MAX_ISSUED_QUERIES);
  }

  // 최근 검색어는 localStorage 기반 — 마운트 후 클라이언트에서만 읽어 하이드레이션 불일치 방지
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecent(loadRecent());
  }, []);

  // URL(?q=) 동기화 — 직접 입력은 300ms 뒤 URL로 보내고, 뒤로/앞으로 가기처럼
  // 서버가 새 initialQuery를 주면 로컬 초안과 대기 중인 이동을 먼저 폐기한다.
  useEffect(() => {
    const initialChanged = lastInitialQuery.current !== initialQuery;
    lastInitialQuery.current = initialQuery;
    const nextInitial = initialQuery.trim();
    if (initialChanged) {
      const issuedIndex = issuedQueries.current.indexOf(nextInitial);
      if (issuedIndex >= 0) {
        issuedQueries.current = [
          ...issuedQueries.current.slice(0, issuedIndex),
          ...issuedQueries.current.slice(issuedIndex + 1),
        ];
      } else {
        issuedQueries.current = [];
        lastPushed.current = nextInitial;
        suggestionRequest.current?.abort();
        suggestionRequest.current = null;
        setValue(initialQuery);
        setSuggestions([]);
        setActiveIndex(-1);
        setLoading(false);
        setIsComposing(false);
        return;
      }
    }
    if (isComposing || trimmed === lastPushed.current) return;
    const timer = window.setTimeout(() => {
      lastPushed.current = trimmed;
      rememberIssuedQuery(trimmed);
      router.replace(trimmed ? `${searchPath}?q=${encodeURIComponent(trimmed)}` : searchPath);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [initialQuery, trimmed, router, searchPath, isComposing]);

  // 열린 자동완성만 조회하고, 같은 입력은 30초 동안 최대 32개까지 재사용한다.
  useEffect(() => {
    if (!hasQuery || !open || isComposing) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions([]);
      setActiveIndex(-1);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const controller = new AbortController();
    suggestionRequest.current = controller;
    setLoading(true);
    const timer = window.setTimeout(() => {
      const cached = suggestionCache.get(trimmed);
      if (cached) {
        setSuggestions(cached);
        setActiveIndex(-1);
        setLoading(false);
        return;
      }
      supabase
        .rpc("search_memes", { p_query: trimmed, p_limit: 6 })
        .select(SEARCH_SUGGESTION_COLUMNS)
        .abortSignal(controller.signal)
        .then(({ data, error }) => {
          if (cancelled || controller.signal.aborted) return;
          setLoading(false);
          setActiveIndex(-1);
          if (error || !data) {
            setSuggestions([]);
            return;
          }
          suggestionCache.set(trimmed, data);
          setSuggestions(data);
        }, () => {
          if (cancelled || controller.signal.aborted) return;
          setLoading(false);
          setActiveIndex(-1);
          setSuggestions([]);
        });
    }, 300);
    return () => {
      cancelled = true;
      controller.abort();
      if (suggestionRequest.current === controller) suggestionRequest.current = null;
      window.clearTimeout(timer);
    };
  }, [trimmed, hasQuery, open, isComposing, supabase, suggestionCache]);

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
    rememberIssuedQuery(t);
    router.replace(t ? `${searchPath}?q=${encodeURIComponent(t)}` : searchPath);
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
    // Safari may report isComposing=false on the IME confirmation Enter,
    // while retaining the IME keyCode (229). Neither path submits or selects.
    if (isComposing || e.nativeEvent.isComposing || e.nativeEvent.keyCode === 229) {
      if (e.key === "Enter") e.preventDefault();
      return;
    }
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
          if (isComposing) return;
          recordRecent(trimmed);
          setOpen(false);
          if (locale === "ko") signalMemeIntentSubmit(trimmed, locale);
          goToSearch(trimmed);
        }}
      >
        <label htmlFor="search-q" className="sr-only">{copy.label}</label>
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
            onChange={(e) => {
              const next = e.target.value;
              if (next.trim() !== trimmed) {
                setSuggestions([]);
                setActiveIndex(-1);
              }
              setValue(next);
            }}
            onCompositionStart={() => {
              setIsComposing(true);
              setSuggestions([]);
              setActiveIndex(-1);
            }}
            onCompositionEnd={() => setIsComposing(false)}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            placeholder={copy.placeholder}
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
          copy={copy}
        />
      )}
    </div>
  );
}
