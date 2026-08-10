"use client";

import { CategoryTag } from "@/components/category-tag";
import type { SearchInputCopy } from "@/lib/i18n-global-search";
import type { MemeCategory } from "@/lib/labels";

/** 자동완성 항목 — search_memes RPC 반환분 중 드롭다운에 필요한 최소 필드만 */
export type SearchSuggestion = {
  id: string;
  short_id: string;
  slug: string;
  title: string;
  summary: string;
  category: MemeCategory;
};

const chipClass =
  "hover-glow-flame inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-muted hover:text-accent active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * 검색 자동완성 드롭다운 (레인 B) — search-input.tsx가 상태/로직을 쥐고,
 * 이 컴포넌트는 콤보박스 목록 + 최근/인기 검색어 칩을 그린다(순수 표현 계층).
 * ARIA: 부모 input이 role=combobox, 여기 ul이 role=listbox, 각 li가 role=option.
 */
export function SearchSuggest({
  hasQuery,
  loading,
  suggestions,
  activeIndex,
  listboxId,
  optionId,
  onHoverIndex,
  onSelect,
  recent,
  onSelectRecent,
  onRemoveRecent,
  onClearRecent,
  popularTerms,
  onSelectPopular,
  copy,
}: {
  hasQuery: boolean;
  loading: boolean;
  suggestions: SearchSuggestion[];
  activeIndex: number;
  listboxId: string;
  optionId: (index: number) => string;
  onHoverIndex: (index: number) => void;
  onSelect: (item: SearchSuggestion) => void;
  recent: string[];
  onSelectRecent: (term: string) => void;
  onRemoveRecent: (term: string) => void;
  onClearRecent: () => void;
  popularTerms: string[];
  onSelectPopular: (term: string) => void;
  copy: SearchInputCopy;
}) {
  return (
    <div className="glass-panel menu-pop absolute inset-x-0 top-[calc(100%+8px)] z-20 max-h-[70vh] overflow-y-auto rounded-2xl p-2 shadow-xl">
      {hasQuery ? (
        <ul id={listboxId} role="listbox" aria-label={copy.suggestionLabel} className="flex flex-col gap-0.5">
          {suggestions.map((item, i) => (
            <li
              key={item.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === activeIndex}
              onMouseEnter={() => onHoverIndex(i)}
              onClick={() => onSelect(item)}
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition-[background-color,border-color,opacity] ${
                i === activeIndex
                  ? "border-flame-500/50 bg-surface-2 opacity-100"
                  : "border-transparent opacity-85 hover:border-border hover:bg-surface-2 hover:opacity-100"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-bold">{item.title}</span>
                <span className="block truncate text-[13px] text-muted">{item.summary}</span>
              </span>
              <CategoryTag category={item.category} className="shrink-0" />
            </li>
          ))}
          {suggestions.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted">
              {loading ? copy.loading : copy.noMatches}
            </li>
          )}
        </ul>
      ) : (
        <div className="flex flex-col gap-4 p-1">
          {recent.length > 0 && (
            <div>
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold text-muted">{copy.recent}</span>
                <button
                  type="button"
                  onClick={onClearRecent}
                  className="min-h-11 text-xs font-medium text-muted underline-offset-2 hover:text-accent hover:underline"
                >
                  {copy.clearRecent}
                </button>
              </div>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {recent.map((term) => (
                  <li key={term}>
                    <span className="inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-surface pl-3.5 pr-1.5 text-sm font-medium text-muted">
                      <button
                        type="button"
                        onClick={() => onSelectRecent(term)}
                        className="max-w-[9rem] truncate text-left"
                      >
                        {term}
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveRecent(term)}
                        aria-label={`${copy.removeRecent} '${term}'`}
                        className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted/70 transition-colors hover:bg-surface-2 hover:text-foreground"
                      >
                        <svg
                          viewBox="0 0 24 24"
                          aria-hidden
                          className="size-3.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="m6 6 12 12M18 6 6 18" />
                        </svg>
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {popularTerms.length > 0 && (
            <div>
              <span className="px-1 text-xs font-bold text-muted">{copy.popular}</span>
              <ul className="mt-1.5 flex flex-wrap gap-2">
                {popularTerms.map((term) => (
                  <li key={term}>
                    <button type="button" onClick={() => onSelectPopular(term)} className={chipClass}>
                      {term}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {recent.length === 0 && popularTerms.length === 0 && (
            <p className="px-1 py-4 text-center text-sm text-muted">{copy.emptyHint}</p>
          )}
        </div>
      )}
    </div>
  );
}
