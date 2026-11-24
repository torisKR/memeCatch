// /search: app/(default)/search/search-input.tsx with components/search-suggest.tsx,
// components/meme-reference-search.tsx and components/search-outcome-tracker.tsx.
// The box follows what is typed: 300 ms later the address becomes ?q= (replaced,
// as router.replace does) and the body below the box is replaced in place
// (GET /_axum/search/body). An open box suggests six memes (Next's own
// POST /api/db/query plan, 30 s cache), or shows recent and popular terms.
// The page carries lib/search-suggestions.ts and ui/reference-search.js
// (scripts/build-ui.mjs, PAGE_FILES).
import { createSearchSuggestionCache, SEARCH_SUGGESTION_COLUMNS } from "@/lib/search-suggestions";
import { track } from "@/lib/analytics";
import { referenceSearch } from "@/server/ui/reference-search";

{
  const main = document.querySelector("main[data-search-page]");
  const box = main?.querySelector("[data-search-box]");
  if (main && box) {
    const RECENT_KEY = "mc_recent_searches";
    const MAX_RECENT = 8;
    const DEBOUNCE_MS = 300;
    const SETTLE_MS = 900;
    const MAX_QUERY_LENGTH = 64;
    const LISTBOX_ID = "search-suggest-listbox";
    const COPY = {
      suggestionLabel: "자동완성 결과",
      loading: "검색 중…",
      noMatches: "일치하는 밈이 없어요",
      recent: "최근 검색어",
      clearRecent: "전체 지우기",
      popular: "인기 검색어",
      emptyHint: "밈 이름이나 초성으로 검색해보세요",
      removeRecent: "최근 검색어 삭제",
    };
    const CHIP = "hover-glow-flame inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-3.5 text-sm font-medium text-muted hover:text-accent active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
    const OPTION = "flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 transition-[background-color,border-color,opacity]";
    const OPTION_ACTIVE = "border-flame-500/50 bg-surface-2 opacity-100";
    const OPTION_IDLE = "border-transparent opacity-85 hover:border-border hover:bg-surface-2 hover:opacity-100";

    const { popular } = JSON.parse(box.dataset.searchBox);
    const input = box.querySelector("#search-q");
    const form = box.querySelector("form");
    const tags = box.querySelector("template[data-search-tags]").content;
    const cache = createSearchSuggestionCache();
    const memePath = (item) => `/memes/${item.short_id}-${encodeURIComponent(item.slug)}`;

    const el = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text !== undefined) node.textContent = text;
      return node;
    };

    const loadRecent = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
        return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
      } catch {
        return [];
      }
    };
    const saveRecent = (list) => {
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(list));
      } catch {
        /* a private window: the search still works */
      }
    };

    let recent = loadRecent();
    let open = false;
    let composing = false;
    let suggestions = [];
    let loading = false;
    let activeIndex = -1;
    let lastPushed = input.value.trim();
    let suggestTimer = 0;
    let suggestRequest = null;
    let pushTimer = 0;
    let menu = null;
    const trimmed = () => input.value.trim();

    // components/search-suggest.tsx
    function render() {
      menu?.remove();
      menu = null;
      input.setAttribute("aria-expanded", String(open));
      if (activeIndex >= 0) input.setAttribute("aria-activedescendant", `search-suggest-option-${activeIndex}`);
      else input.removeAttribute("aria-activedescendant");
      if (!open) return;
      menu = el("div", "glass-panel menu-pop absolute inset-x-0 top-[calc(100%+8px)] z-20 max-h-[70vh] overflow-y-auto rounded-2xl p-2 shadow-xl");
      if (trimmed()) menu.append(listbox());
      else menu.append(terms());
      box.append(menu);
    }

    function listbox() {
      const list = el("ul", "flex flex-col gap-0.5");
      list.id = LISTBOX_ID;
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", COPY.suggestionLabel);
      suggestions.forEach((item, index) => {
        const option = el("li", `${OPTION} ${index === activeIndex ? OPTION_ACTIVE : OPTION_IDLE}`);
        option.id = `search-suggest-option-${index}`;
        option.setAttribute("role", "option");
        option.setAttribute("aria-selected", String(index === activeIndex));
        const text = el("span", "min-w-0 flex-1");
        text.append(el("span", "block truncate text-[15px] font-bold", item.title), el("span", "block truncate text-[13px] text-muted", item.summary));
        option.append(text);
        const tag = tags.querySelector(`[data-category="${CSS.escape(String(item.category))}"]`)?.firstElementChild;
        if (tag) option.append(tag.cloneNode(true));
        option.addEventListener("mouseenter", () => {
          activeIndex = index;
          render();
        });
        option.addEventListener("click", () => selectSuggestion(item));
        list.append(option);
      });
      if (suggestions.length === 0) list.append(el("li", "px-3 py-6 text-center text-sm text-muted", loading ? COPY.loading : COPY.noMatches));
      return list;
    }

    function terms() {
      const root = el("div", "flex flex-col gap-4 p-1");
      if (recent.length > 0) {
        const group = el("div");
        const head = el("div", "flex items-center justify-between px-1");
        const clear = el("button", "min-h-11 text-xs font-medium text-muted underline-offset-2 hover:text-accent hover:underline", COPY.clearRecent);
        clear.type = "button";
        clear.addEventListener("click", () => setRecent([]));
        head.append(el("span", "text-xs font-bold text-muted", COPY.recent), clear);
        const list = el("ul", "mt-1.5 flex flex-wrap gap-2");
        for (const term of recent) {
          const chip = el("span", "inline-flex min-h-11 items-center gap-1 rounded-full border border-border bg-surface pl-3.5 pr-1.5 text-sm font-medium text-muted");
          const pick = el("button", "max-w-[9rem] truncate text-left", term);
          pick.type = "button";
          pick.addEventListener("click", () => selectTerm(term));
          const remove = el("button", "flex size-7 shrink-0 items-center justify-center rounded-full text-muted/70 transition-colors hover:bg-surface-2 hover:text-foreground");
          remove.type = "button";
          remove.setAttribute("aria-label", `${COPY.removeRecent} '${term}'`);
          remove.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true" class="size-3.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"></path></svg>';
          remove.addEventListener("click", () => setRecent(recent.filter((value) => value !== term)));
          chip.append(pick, remove);
          const item = el("li");
          item.append(chip);
          list.append(item);
        }
        group.append(head, list);
        root.append(group);
      }
      if (popular.length > 0) {
        const group = el("div");
        const list = el("ul", "mt-1.5 flex flex-wrap gap-2");
        for (const term of popular) {
          const chip = el("button", CHIP, term);
          chip.type = "button";
          chip.addEventListener("click", () => selectTerm(term));
          const item = el("li");
          item.append(chip);
          list.append(item);
        }
        group.append(el("span", "px-1 text-xs font-bold text-muted", COPY.popular), list);
        root.append(group);
      }
      if (recent.length === 0 && popular.length === 0) root.append(el("p", "px-1 py-4 text-center text-sm text-muted", COPY.emptyHint));
      return root;
    }

    function setRecent(list) {
      recent = list;
      saveRecent(list);
      render();
    }

    function recordRecent(term) {
      const value = term.trim();
      if (value) setRecent([value, ...recent.filter((item) => item !== value)].slice(0, MAX_RECENT));
    }

    // The suggestions of an open box, 300 ms after the last keystroke.
    function suggest() {
      clearTimeout(suggestTimer);
      suggestRequest?.abort();
      suggestRequest = null;
      const query = trimmed();
      if (!query || !open || composing) {
        suggestions = [];
        activeIndex = -1;
        loading = false;
        return;
      }
      loading = true;
      const controller = new AbortController();
      suggestRequest = controller;
      suggestTimer = setTimeout(async () => {
        const cached = cache.get(query);
        let items = cached;
        if (!items) {
          try {
            items = await fetchSuggestions(query, controller.signal);
            cache.set(query, items);
          } catch {
            items = [];
          }
        }
        if (controller.signal.aborted) return;
        suggestRequest = null;
        suggestions = items;
        activeIndex = -1;
        loading = false;
        render();
      }, DEBOUNCE_MS);
    }

    // `db.rpc("search_memes", { p_query, p_limit: 6 }).select(SEARCH_SUGGESTION_COLUMNS)`.
    async function fetchSuggestions(query, signal) {
      const fields = SEARCH_SUGGESTION_COLUMNS.split(", ").map((name) => ({ kind: "column", name }));
      const plan = {
        op: "rpc", fn: "search_memes", fields, filters: [], orGroups: [], orders: [], limit: null, offset: null,
        single: false, maybeSingle: false, count: null, head: false, onConflict: null, ignoreDuplicates: false,
        returning: true, args: { p_query: query, p_limit: 6 },
      };
      const response = await fetch("/api/db/query", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan }), signal,
      });
      if (!response.ok) throw new Error(String(response.status));
      const body = await response.json();
      if (body?.error || !Array.isArray(body?.data)) throw new Error("search_memes");
      return body.data;
    }

    // `router.replace(?q=)`: the address, then the body Next would render.
    function goTo(term) {
      const value = term.trim();
      clearTimeout(pushTimer);
      lastPushed = value;
      history.replaceState(history.state, "", value ? `${location.pathname}?q=${encodeURIComponent(value)}` : location.pathname);
      void refresh(value);
    }

    function schedulePush() {
      clearTimeout(pushTimer);
      if (composing || trimmed() === lastPushed) return;
      pushTimer = setTimeout(() => goTo(trimmed()), DEBOUNCE_MS);
    }

    let generation = 0;
    async function refresh(query) {
      const mine = (generation += 1);
      let body;
      try {
        const response = await fetch(`/_axum/search/body${query ? `?q=${encodeURIComponent(query)}` : ""}`, { credentials: "same-origin" });
        if (!response.ok) throw new Error(String(response.status));
        body = await response.json();
      } catch {
        location.reload();
        return;
      }
      if (mine !== generation) return;
      reference?.abort();
      reference = null;
      const anchor = box.parentElement;
      while (anchor.nextSibling) anchor.nextSibling.remove();
      const template = document.createElement("template");
      template.innerHTML = body.html;
      anchor.after(template.content);
      startReference(query);
      settle(query, body.results);
    }

    function selectSuggestion(item) {
      track("search_suggest_click", { query: trimmed(), meme_short_id: item.short_id });
      recordRecent(trimmed());
      open = false;
      render();
      location.assign(memePath(item));
    }

    function selectTerm(term) {
      input.value = term;
      recordRecent(term);
      goTo(term);
      open = false;
      suggest();
      render();
    }

    let lastQuery = trimmed();
    input.addEventListener("input", () => {
      const query = trimmed();
      if (query !== lastQuery) {
        suggestions = [];
        activeIndex = -1;
      }
      lastQuery = query;
      schedulePush();
      suggest();
      render();
    });
    input.addEventListener("compositionstart", () => {
      composing = true;
      suggest();
      render();
    });
    input.addEventListener("compositionend", () => {
      composing = false;
      schedulePush();
      suggest();
      render();
    });
    input.addEventListener("focus", () => {
      if (open) return;
      open = true;
      suggest();
      render();
    });
    input.addEventListener("keydown", (event) => {
      // Safari may report isComposing=false on the IME confirmation Enter,
      // while keeping keyCode 229. Neither submits nor selects.
      if (composing || event.isComposing || event.keyCode === 229) {
        if (event.key === "Enter") event.preventDefault();
        return;
      }
      if (!open || !trimmed()) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (suggestions.length === 0) return;
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        activeIndex = (activeIndex + step + suggestions.length) % suggestions.length;
        render();
      } else if (event.key === "Enter") {
        if (activeIndex >= 0 && suggestions[activeIndex]) {
          event.preventDefault();
          selectSuggestion(suggestions[activeIndex]);
        }
      } else if (event.key === "Escape") {
        open = false;
        activeIndex = -1;
        suggest();
        render();
      }
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (composing) return;
      recordRecent(trimmed());
      open = false;
      suggest();
      render();
      goTo(trimmed());
    });
    document.addEventListener("mousedown", (event) => {
      if (open && !box.contains(event.target)) {
        open = false;
        suggest();
        render();
      }
    });

    // components/search-outcome-tracker.tsx: once per query, 900 ms after
    // its results are shown.
    let lastFired = null;
    let settleTimer = 0;
    function settle(query, results) {
      clearTimeout(settleTimer);
      if (!query) return;
      settleTimer = setTimeout(() => {
        if (lastFired === query) return;
        lastFired = query;
        const q = query.slice(0, MAX_QUERY_LENGTH);
        track("search_submit", { query: q, result_count: results });
        if (results === 0) track("search_no_result", { query: q });
      }, SETTLE_MS);
    }

    // components/meme-reference-search.tsx (ui/reference-search.js), only with a query.
    let reference = null;
    function startReference(query) {
      const section = main.querySelector("[data-search-reference]");
      reference = section ? referenceSearch(section, query) : null;
    }

    const initial = JSON.parse(main.dataset.searchPage);
    startReference(initial.query);
    settle(initial.query, initial.results);
    // `autoFocus`: the focus came before this script listened.
    if (document.activeElement === input) {
      open = true;
      render();
    }
  }
}
