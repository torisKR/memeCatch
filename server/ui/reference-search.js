// components/meme-reference-search.tsx, for /search and /studio (a module
// their page bundles carry, scripts/build-ui.mjs PAGE_FILES). `section` is
// the server's markup of the idle state; a click asks POST
// /api/memes/semantic-search, a second click cancels. `reset(query)` is a
// new query: React mounts a fresh component for it.
const FALLBACK_MESSAGE = "의미 검색이 준비되지 않아 이름·별칭 검색 결과를 보여드려요.";
const REASONS = new Set(["disabled", "model_unavailable", "index_empty", "rpc_unavailable"]);
const SHORT_ID = /^[a-zA-Z0-9]{1,32}$/;

const memePath = (item) => `/memes/${item.short_id}-${encodeURIComponent(item.slug)}`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function readResult(value) {
  const valid = value && typeof value === "object" && (value.mode === "hybrid" || value.mode === "keyword")
    && Array.isArray(value.items) && value.items.length <= 12
    && (value.reason === undefined || (typeof value.reason === "string" && REASONS.has(value.reason)));
  if (!valid) throw new Error("invalid_response");
  const items = value.items.map((row) => {
    const ok = row && typeof row === "object" && typeof row.id === "string" && row.id.trim()
      && typeof row.short_id === "string" && SHORT_ID.test(row.short_id)
      && typeof row.slug === "string" && row.slug.trim()
      && typeof row.title === "string" && row.title.trim() && typeof row.summary === "string";
    if (!ok) throw new Error("invalid_item");
    // Also rejects malformed Unicode that cannot form a safely encoded path.
    memePath(row);
    return row;
  });
  return { mode: value.mode, reason: value.reason, items };
}

export function referenceSearch(section, initialQuery) {
  const button = section.querySelector("button");
  const label = button.textContent;
  const status = section.querySelector('[role="status"]');
  let query = initialQuery;
  let request = null;

  function show(state) {
    button.textContent = state.status === "pending" ? "검색 취소" : label;
    status.replaceChildren();
    section.querySelectorAll("[data-reference-out]").forEach((node) => node.remove());
    const line = (text) => status.append(el("p", "", text));
    if (state.status === "pending") line("참고할 밈을 찾고 있어요.");
    if (state.status === "cancelled") line("검색을 취소했어요.");
    if (state.status === "ready" && state.result.mode === "keyword") line(FALLBACK_MESSAGE);
    if (state.status === "ready" && state.result.items.length === 0) {
      line(state.result.reason === "index_empty"
        ? "아직 참고 자료가 준비되지 않았어요. 다른 검색어로 찾아보세요."
        : "참고할 밈을 찾지 못했어요. 다른 검색어로 찾아보세요.");
    }
    if (state.status === "error") {
      const alert = el("p", "mt-3 text-sm text-muted", "밈을 찾지 못했어요. 잠시 후 다시 시도해 주세요.");
      alert.setAttribute("role", "alert");
      alert.dataset.referenceOut = "";
      section.append(alert);
    }
    if (state.status === "ready" && state.result.items.length > 0) {
      const list = el("ul", "mt-3 grid gap-2 sm:grid-cols-2");
      list.dataset.referenceOut = "";
      for (const item of state.result.items) {
        const link = el("a", "block rounded-xl border border-border p-3 hover:border-accent focus-visible:outline-2 focus-visible:outline-accent");
        link.href = memePath(item);
        link.append(el("span", "block font-semibold", item.title), el("span", "mt-1 block text-sm text-muted", item.summary));
        const row = el("li");
        row.append(link);
        list.append(row);
      }
      section.append(list);
    }
  }

  function abort() {
    request?.abort();
    request = null;
  }

  button.addEventListener("click", async () => {
    if (request) {
      abort();
      show({ status: "cancelled" });
      return;
    }
    if (button.disabled) return;
    const controller = new AbortController();
    request = controller;
    show({ status: "pending" });
    try {
      const response = await fetch("/api/memes/semantic-search", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, limit: 12 }), cache: "no-store", signal: controller.signal,
      });
      if (!response.ok) throw new Error("request_failed");
      const value = await response.json();
      if (controller.signal.aborted || request !== controller) return;
      show({ status: "ready", result: readResult(value) });
    } catch {
      if (controller.signal.aborted || request !== controller) return;
      show({ status: "error" });
    } finally {
      if (request === controller) request = null;
    }
  });

  return {
    abort,
    reset(next) {
      abort();
      query = next;
      button.disabled = !(next.length >= 2 && next.length <= 120);
      show({ status: "idle" });
    },
  };
}
