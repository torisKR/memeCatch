// /explore: components/explore-filters.tsx and components/explore-grid.tsx.
// A filter, the sort or a search changes the address and the page body in
// place (keeping the scroll, the open panel and focus), as Next's router does.
// The grid adds 24 cards as its end nears, twice, then on a button; each
// window's cards are checked with POST /api/explore/previews as React checks
// them, and a failed check can be tried again.
{
  const DISPLAY = ["ai-meme", "meme_term", "challenge_dance", "song", "drama_scene", "meme_video"];
  const LEGACY = { phrase: "meme_term", dance: "challenge_dance", song: "song", image: "meme_video", comment: "drama_scene", challenge: "challenge_dance" };
  const AI_MEME = "ai-meme";
  const PAGE_SIZE = 24;
  const AUTO_LOAD_PAGES = 2;
  const HOVER_PREVIEW_DELAY = 450;

  // expandDisplayCategoryTokens
  const displayTokens = (tokens) => [...new Set(tokens.map((token) => (DISPLAY.includes(token) ? token : LEGACY[token])).filter(Boolean))];

  const parseHtml = (html) => {
    const template = document.createElement("template");
    template.innerHTML = html;
    return template.content;
  };

  // mergeSearchPresentationItems over { id, key, pref }.
  const merge = (items) => {
    const winners = new Map();
    for (const item of items) {
      const current = winners.get(item.key);
      if (!current || item.pref > current.pref) winners.set(item.key, item);
    }
    const emitted = new Set();
    return items.filter((item) => {
      if (emitted.has(item.key) || winners.get(item.key) !== item) return false;
      emitted.add(item.key);
      return true;
    });
  };
  // preserveItemPositions
  const preserve = (previous, next) => {
    const winners = new Map(next.map((item) => [item.key, item]));
    return [...previous, ...next].flatMap((item) => {
      const winner = winners.get(item.key);
      if (!winner) return [];
      winners.delete(item.key);
      return [winner];
    });
  };
  const curated = (item) => item.id.startsWith("curated-");

  // fetchQualifiedPreviews: the ids the route answered for, or null.
  async function checkPreviews(ids) {
    if (!ids.length) return new Set();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const response = await fetch("/api/explore/previews", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }), signal: controller.signal,
      });
      if (!response.ok) return null;
      const body = await response.json();
      const rows = body && typeof body === "object" ? body.previews : null;
      if (!Array.isArray(rows)) return null;
      const allowed = new Set(ids);
      const result = new Set();
      for (const row of rows) {
        if (!row || typeof row !== "object") return null;
        if (typeof row.id !== "string" || !allowed.has(row.id) || !Array.isArray(row.contents) || result.has(row.id)) return null;
        result.add(row.id);
      }
      return result;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  // Reuse only the YouTube ID the server chose for this card's reviewed still.
  // Keep one player, with no provider request before a deliberate mouse hover.
  const hoverTarget = "[data-explore-list] [data-meme-card]";
  const hoverPlayback = matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
  let hoveredCard = null;
  let hoverTimer = 0;
  let hoverPlayer = null;
  function stopHoverPreview() {
    clearTimeout(hoverTimer);
    hoveredCard = null;
    hoverPlayer?.remove();
    hoverPlayer = null;
  }

  function startHoverPreviews() {
    const target = (event) => event.target instanceof Element ? event.target.closest(hoverTarget) : null;
    document.addEventListener("pointerover", (event) => {
      if (event.pointerType !== "mouse" || !hoverPlayback.matches) return;
      const card = target(event);
      if (!card || card === hoveredCard || (event.relatedTarget instanceof Node && card.contains(event.relatedTarget))) return;
      stopHoverPreview();
      hoveredCard = card;
      hoverTimer = setTimeout(() => {
        if (document.hidden || !card.isConnected || !card.matches(":hover")) return;
        const art = card.querySelector(".meme-card-art");
        const src = art?.querySelector('img[data-meme-card-art="video"]')?.getAttribute("src") ?? "";
        const id = /^https:\/\/i\.ytimg\.com\/vi\/([A-Za-z0-9_-]{11})\/hqdefault\.jpg$/.exec(src)?.[1];
        if (!id) return;
        const rect = art.getBoundingClientRect();
        const visibleHeight = Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top);
        if (rect.width < 200 || rect.height < 200 || visibleHeight <= rect.height / 2) return;
        const player = document.createElement("iframe");
        player.className = "explore-hover-player";
        player.title = "음소거 영상 미리보기";
        player.tabIndex = -1;
        player.setAttribute("aria-hidden", "true");
        player.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
        player.allow = "autoplay; encrypted-media";
        player.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1&controls=0&disablekb=1&rel=0`;
        hoverPlayer = player;
        art.append(player);
      }, HOVER_PREVIEW_DELAY);
    });
    document.addEventListener("pointerout", (event) => {
      if (hoveredCard && target(event) === hoveredCard
        && !(event.relatedTarget instanceof Node && hoveredCard.contains(event.relatedTarget))) stopHoverPreview();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") stopHoverPreview();
    });
    document.addEventListener("visibilitychange", stopHoverPreview);
    window.addEventListener("blur", stopHoverPreview);
    window.addEventListener("pagehide", stopHoverPreview);
    hoverPlayback.addEventListener("change", stopHoverPreview);
  }

  let generation = 0;
  let panelOpen = false;

  function focusSelector(element) {
    for (const name of ["data-explore-action", "data-explore-select"]) {
      if (element.hasAttribute(name)) return `[${name}="${CSS.escape(element.getAttribute(name))}"]`;
    }
    if (element.hasAttribute("data-explore-panel-toggle")) return "[data-explore-panel-toggle]";
    if (element.matches('input[name="q"]')) return 'input[name="q"]';
    return null;
  }

  // The body for the current address, in place of the old one.
  async function refresh() {
    stopHoverPreview();
    const mine = (generation += 1);
    let html;
    try {
      const response = await fetch(`/_axum/explore/body${location.search}`, { credentials: "same-origin" });
      if (!response.ok) throw new Error(String(response.status));
      html = await response.text();
    } catch {
      location.reload();
      return;
    }
    if (mine !== generation) return;
    const filtersNow = document.querySelector("[data-explore-filters]");
    const active = document.activeElement;
    const focusKey = active && filtersNow?.contains(active) ? focusSelector(active) : null;
    const fragment = parseHtml(html);
    const filters = fragment.querySelector("[data-explore-filters]");
    const grid = fragment.querySelector("[data-explore-grid]");
    document.querySelector("[data-explore-grid]")?.replaceWith(grid);
    filtersNow?.replaceWith(filters);
    startFilters(filters);
    startGrid(grid);
    if (focusKey) filters.querySelector(focusKey)?.focus({ preventScroll: true });
  }

  function push(next) {
    const qs = next.toString();
    history.pushState(null, "", qs ? `${location.pathname}?${qs}` : location.pathname);
    void refresh();
  }

  function startFilters(root) {
    const current = () => new URLSearchParams(location.search);
    const input = root.querySelector('input[name="q"]');
    const toggle = root.querySelector("[data-explore-panel-toggle]");
    const clearSlot = root.querySelector("template[data-explore-clear]");

    const setSingle = (key, value) => {
      const next = current();
      if (value) next.set(key, value);
      else next.delete(key);
      push(next);
    };
    const toggleSingle = (key, value) => {
      const next = current();
      if (next.get(key) === value) next.delete(key);
      else next.set(key, value);
      push(next);
    };
    const toggleCategory = (value) => {
      const token = displayTokens([value])[0];
      if (!token) return;
      const next = current();
      const active = new Set(displayTokens(next.getAll("category")));
      if (active.has(token)) {
        active.delete(token);
      } else if (token === AI_MEME) {
        active.clear();
        active.add(token);
      } else {
        active.delete(AI_MEME);
        active.add(token);
      }
      next.delete("category");
      for (const item of active) next.append("category", item);
      push(next);
    };

    const showPanel = (open) => {
      panelOpen = open;
      toggle.setAttribute("aria-expanded", String(open));
      toggle.querySelector("span").classList.toggle("rotate-180", open);
      const panel = root.querySelector("#explore-filter-panel");
      if (open && !panel) root.append(root.querySelector("template[data-explore-panel]").content.firstElementChild.cloneNode(true));
      if (!open) panel?.remove();
    };
    if (panelOpen) showPanel(true);

    // The clear button is there while the box has text.
    input.addEventListener("input", () => {
      const button = root.querySelector('button[data-explore-action="clear:q"]');
      if (input.value && !button) clearSlot.before(clearSlot.content.firstElementChild.cloneNode(true));
      if (!input.value) button?.remove();
    });
    root.querySelector('form[role="search"]').addEventListener("submit", (event) => {
      event.preventDefault();
      const next = current();
      const trimmed = input.value.trim();
      if (trimmed) next.set("q", trimmed);
      else next.delete("q");
      push(next);
    });
    for (const select of root.querySelectorAll("[data-explore-select]")) {
      select.addEventListener("change", () => setSingle(select.dataset.exploreSelect, select.value));
    }
    toggle.addEventListener("click", () => showPanel(!panelOpen));
    root.addEventListener("click", (event) => {
      const button = event.target instanceof Element && event.target.closest("[data-explore-action]");
      if (!button || !root.contains(button)) return;
      const [kind, name, value] = button.dataset.exploreAction.split(":");
      if (kind === "reset") {
        history.pushState(null, "", location.pathname);
        void refresh();
      } else if (kind === "clear" && name === "q") {
        input.value = "";
        button.remove();
        setSingle("q", "");
      } else if (kind === "unset" && name === "category") {
        toggleCategory(value);
      } else if (kind === "unset") {
        setSingle(name, "");
      } else if (kind === "category") {
        toggleCategory(name);
      } else if (kind === "toggle") {
        toggleSingle(name, value);
      }
    });
  }

  function startGrid(grid) {
    const start = JSON.parse(grid.dataset.exploreGrid);
    const parts = grid.querySelector("template[data-explore-parts]").content;
    const part = (name) => parts.querySelector(`[data-part="${name}"]`).firstElementChild.cloneNode(true);
    // Each item's node and the card markup it was made from.
    const nodes = new Map();
    const nodeHtml = new WeakMap();
    const html = new Map();
    let items = [...grid.querySelectorAll("li[data-explore-item]")].map((li) => {
      const item = { id: li.dataset.exploreItem, key: li.dataset.key, pref: Number(li.dataset.pref) };
      nodes.set(item.id, li);
      html.set(item.id, li.innerHTML);
      nodeHtml.set(li, li.innerHTML);
      return item;
    });
    const list = grid.querySelector("ul[data-explore-list]") ?? part("list");
    const seen = new Set(items.map((item) => item.id));
    let pending = [...start.pending];
    const pendingCandidates = new Map(items.filter((item) => pending.includes(item.id)).map((item) => [item.id, item]));
    const alternatives = start.alternatives.map(([id, key, pref]) => ({ id, key, pref }));
    const generations = new Map();
    let offset = start.offset;
    let hasMore = start.hasMore;
    let loading = false;
    let failed = false;
    let autoLoads = 0;
    let retrying = false;
    let observer = null;
    // One node of each state, kept so that a button keeps its focus.
    const banner = part("banner");
    const searching = part("searching");
    const pendingMore = part("pending-more");
    const skeleton = part("skeleton");
    const sentinel = part("sentinel");
    const more = part("more");
    const failure = part("failed");
    const end = part("end");

    const itemNode = (item) => {
      let li = nodes.get(item.id);
      if (!li || nodeHtml.get(li) !== html.get(item.id)) {
        li = document.createElement("li");
        li.className = "min-w-0";
        li.dataset.exploreItem = item.id;
        li.dataset.key = item.key;
        li.dataset.pref = String(item.pref);
        li.append(parseHtml(html.get(item.id)));
        nodeHtml.set(li, html.get(item.id));
        nodes.set(item.id, li);
      }
      return li;
    };

    function render() {
      observer?.disconnect();
      observer = null;
      if (start.unavailable && items.length === 0) return;
      const autoPaused = autoLoads >= AUTO_LOAD_PAGES;
      const bannerButton = banner.querySelector("button");
      bannerButton.disabled = retrying;
      bannerButton.textContent = retrying ? "불러오는 중…" : "미리보기 다시 불러오기";
      let content;
      if (items.length === 0 && pending.length > 0) {
        content = document.createElement("div");
        content.append(banner);
        if (hasMore) {
          pendingMore.disabled = loading;
          pendingMore.textContent = loading ? "찾는 중…" : "계속 찾기";
          content.append(pendingMore);
        }
      } else if (items.length === 0 && hasMore) {
        searching.querySelector("[data-explore-searching-title]").textContent = failed ? "다음 밈을 불러오지 못했어요" : "다음 공개 밈을 계속 찾고 있어요";
        const button = searching.querySelector("button");
        button.disabled = loading;
        button.textContent = loading ? "찾는 중…" : failed ? "다시 시도" : "계속 찾기";
        content = searching;
      } else if (items.length === 0) {
        content = part("empty");
      } else {
        content = list.parentElement && grid.contains(list) ? list.parentElement : document.createElement("div");
        list.replaceChildren(...items.map(itemNode));
        const children = [];
        if (pending.length > 0) children.push(banner);
        children.push(list);
        if (loading) children.push(skeleton);
        if (hasMore && !failed && !autoPaused) children.push(sentinel);
        if (hasMore && !failed && autoPaused) {
          const button = more.querySelector("button");
          button.disabled = loading;
          button.textContent = loading ? "불러오는 중…" : "밈 더 보기";
          children.push(more);
        }
        if (failed) children.push(failure);
        if (!hasMore && !loading && !failed) children.push(end);
        content.replaceChildren(...children);
      }
      const shown = grid.firstElementChild;
      if (shown !== content) {
        if (shown && !shown.matches("template")) shown.replaceWith(content);
        else grid.prepend(content);
      }
      if (sentinel.isConnected) watch();
    }

    const autoLoadMore = () => {
      if (loading || !hasMore || autoLoads >= AUTO_LOAD_PAGES) return;
      autoLoads += 1;
      void loadMore();
    };

    function watch() {
      if (typeof window.IntersectionObserver !== "function") {
        const onScroll = () => {
          if (!sentinel.isConnected) {
            removeEventListener("scroll", onScroll);
            return;
          }
          if (sentinel.getBoundingClientRect().top <= innerHeight + 600) autoLoadMore();
        };
        addEventListener("scroll", onScroll, { passive: true });
        onScroll();
        return;
      }
      observer = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting) autoLoadMore();
      }, { rootMargin: "600px 0px" });
      observer.observe(sentinel);
    }

    async function loadMore() {
      if (loading || !hasMore) return;
      loading = true;
      failed = false;
      render();
      const from = offset;
      try {
        const query = start.query ? `${start.query}&` : "";
        const response = await fetch(`/_axum/explore/more?${query}from=${from}`, { credentials: "same-origin" });
        if (!response.ok) throw new Error(String(response.status));
        const batch = await response.json();
        const candidates = batch.items.filter((item) => !seen.has(item.id));
        const confirmed = items.filter((item) => !pendingCandidates.has(item.id));
        const fresh = candidates.filter((item) => merge([...confirmed, item]).some((winner) => winner.id === item.id));
        if (!start.q) {
          // Browse fragments already applied the ledger and card image gate.
          for (const item of candidates) seen.add(item.id);
          for (const item of fresh) html.set(item.id, item.card);
          items = preserve(items, merge([...items, ...fresh]));
          offset = from + batch.scanned;
          hasMore = batch.hasMore;
          return;
        }
        const generationsAt = new Map(fresh.map((item) => [item.key, generations.get(item.key) ?? 0]));
        const ids = fresh.map((item) => item.id);
        const verified = await checkPreviews(ids);
        const existingKeys = new Set(items.map((item) => item.key));
        const staleIds = [];
        const eligible = fresh.filter((item) => {
          if ((generations.get(item.key) ?? 0) !== generationsAt.get(item.key)) {
            pendingCandidates.set(item.id, item);
            staleIds.push(item.id);
            return false;
          }
          if (verified) return verified.has(item.id);
          pendingCandidates.set(item.id, item);
          return !existingKeys.has(item.key);
        });
        const verifiedKeys = new Set(verified ? eligible.map((item) => item.key) : []);
        const base = items.filter((item) => !pendingCandidates.has(item.id) || !verifiedKeys.has(item.key));
        const nextItems = preserve(items, merge([...base, ...eligible]));
        const nextIds = new Set(nextItems.map((item) => item.id));
        const removedIds = new Set(items.filter((item) => !nextIds.has(item.id)).map((item) => item.id));
        if (verified) {
          for (const [key, at] of generationsAt) if ((generations.get(key) ?? 0) === at) generations.set(key, at + 1);
        }
        if (!verified || staleIds.length) pending = [...new Set([...pending, ...(!verified ? ids : staleIds)])];
        for (const item of candidates) seen.add(item.id);
        if (removedIds.size > 0) pending = pending.filter((id) => !removedIds.has(id) || pendingCandidates.has(id));
        // Without a check, a card shows no preview (React's `previews[id] ?? []`).
        for (const item of fresh) html.set(item.id, verified?.has(item.id) ? item.card : item.plain);
        items = nextItems;
        offset = from + batch.scanned;
        hasMore = batch.hasMore;
      } catch {
        failed = true;
      } finally {
        loading = false;
        render();
      }
    }

    async function fetchCards(ids) {
      if (!ids.length) return {};
      try {
        const response = await fetch(`/_axum/explore/cards?${ids.map((id) => `id=${encodeURIComponent(id)}`).join("&")}`, { credentials: "same-origin" });
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    }

    // retryPreviewLookup
    async function retry() {
      if (retrying) return;
      retrying = true;
      render();
      try {
        const groups = new Map();
        for (const id of pending) {
          const candidate = pendingCandidates.get(id);
          const key = candidate ? candidate.key : `id:${id}`;
          const group = groups.get(key) ?? {
            pending: [],
            displayed: items.find((item) => item.key === key),
            candidates: [],
            alternatives: alternatives.filter((item) => !curated(item) && item.key === key),
            generation: generations.get(key) ?? 0,
          };
          group.pending.push(id);
          if (candidate) group.candidates.push(candidate);
          groups.set(key, group);
        }
        const batch = [];
        const selected = new Map();
        for (const [key, group] of groups) {
          const ids = [...new Set([...group.pending, ...group.alternatives.map((item) => item.id), ...(group.displayed && !curated(group.displayed) ? [group.displayed.id] : [])])];
          if (batch.length + ids.length > PAGE_SIZE) break;
          batch.push(...ids);
          selected.set(key, group);
        }
        const verified = await checkPreviews(batch);
        if (!verified) return;
        // The cards again, with the preview the ledger allows now.
        const cards = await fetchCards([...verified]);
        if (!cards) return;
        const checkedIds = new Set();
        const completed = new Set();
        const replacements = [];
        for (const [key, group] of selected) {
          const now = items.find((item) => item.key === key);
          const pendingNow = [...pendingCandidates.values()].filter((item) => item.key === key);
          if ((generations.get(key) ?? 0) !== group.generation || now !== group.displayed || pendingNow.length !== group.candidates.length || pendingNow.some((item) => !group.candidates.includes(item))) continue;
          generations.set(key, group.generation + 1);
          for (const id of group.pending) {
            completed.add(id);
            pendingCandidates.delete(id);
          }
          for (const item of [...group.candidates, ...group.alternatives, ...(now && !curated(now) ? [now] : [])]) {
            checkedIds.add(item.id);
            if (verified.has(item.id) && cards[item.id]) {
              html.set(item.id, cards[item.id]);
              replacements.push(item);
            }
          }
        }
        const base = items.filter((item) => !checkedIds.has(item.id));
        const nextItems = preserve(items, merge([...base, ...replacements]));
        const nextIds = new Set(nextItems.map((item) => item.id));
        const removedIds = new Set(items.filter((item) => !nextIds.has(item.id)).map((item) => item.id));
        items = nextItems;
        pending = pending.filter((id) => !completed.has(id) && (!removedIds.has(id) || pendingCandidates.has(id)));
      } finally {
        retrying = false;
        render();
      }
    }

    grid.addEventListener("click", (event) => {
      const button = event.target instanceof Element && event.target.closest("[data-explore-action]");
      if (!button || !grid.contains(button)) return;
      const action = button.dataset.exploreAction;
      if (action === "more") void loadMore();
      else if (action === "retry") void retry();
      else if (action === "reload") location.reload();
    });
    render();
  }

  const filters = document.querySelector("[data-explore-filters]");
  const grid = document.querySelector("[data-explore-grid]");
  if (filters && grid) {
    startFilters(filters);
    startGrid(grid);
    startHoverPreviews();
    addEventListener("popstate", () => {
      if (document.querySelector("[data-explore-grid]")) void refresh();
    });
  }
}
