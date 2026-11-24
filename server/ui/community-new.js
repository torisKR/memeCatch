// components/community-post-form.tsx for /community/new
// (src/pages/community/new.rs): a title, a Markdown body with write and
// preview tabs and a toolbar (bold, link, upload), uploads by drag and drop,
// paste or the file picker (lib/upload.ts, bundled here), an optional meme
// found with `search_memes` (through the planner, as the browser client
// sends it), and the draft kept on this device. The preview is the server's
// MarkdownBody (POST /api/community/preview); the post goes to
// POST /api/community/post, which answers as `createCommunityPost`.
import { uploadCommunityMedia } from "@/lib/upload";
import { createPlanClient } from "@/lib/db/plan";

const TITLE_MAX = 100;
const BODY_MAX = 5000;
const DRAFT_KEY = "memecatch:community-post-draft";
const SEARCH_DELAY_MS = 300;
const TOOLBAR = "relative flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-semibold text-muted transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-2 hover:text-foreground disabled:opacity-50";
const TAB_ON = "bg-surface-2 text-foreground shadow-[inset_0_-2px_0_0_var(--signal-cyan)]";
const EDITOR = "mt-1.5 overflow-hidden rounded-xl border bg-surface transition-colors focus-within:ring-4 focus-within:ring-accent/20";
const EDITOR_DRAG = "border-dashed border-(--flame-500) shadow-[0_0_0_1px_color-mix(in_srgb,var(--flame-500)_25%,transparent),0_0_20px_-4px_color-mix(in_srgb,var(--flame-500)_60%,transparent)]";
const EDITOR_IDLE = "border-border focus-within:border-accent";

const postPlan = async (plan) => {
  const response = await fetch("/api/db/query", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ plan }),
  });
  return response.json();
};

const element = (tag, attributes = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    if (value !== undefined && value !== null && value !== false) node.setAttribute(name, value === true ? "" : value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
  return node;
};

const readDraft = () => {
  try {
    const saved = localStorage.getItem(DRAFT_KEY);
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};
const persistDraft = (title, body) => {
  try {
    if (title.trim() || body.trim()) localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body }));
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* this device only */
  }
};

const form = document.querySelector("[data-post-form]");
if (form) {
  const title = form.querySelector("#post-title");
  const body = form.querySelector("#post-body");
  const titleCount = form.querySelector("[data-post-title-count]");
  const bodyCount = form.querySelector("[data-post-body-count]");
  const editor = form.querySelector("[data-post-editor]");
  const toolbar = form.querySelector("[data-post-toolbar]");
  const tabs = [...form.querySelectorAll("[data-post-tab]")];
  const tools = [...form.querySelectorAll("[data-post-tool]")];
  const files = form.querySelector("[data-post-files]");
  const memeField = form.querySelector("[data-post-meme]");
  const memeLegend = memeField.querySelector("legend");
  const search = memeField.querySelector("input");
  const submit = form.querySelector('button[type="submit"]');
  const state = {
    tab: "write",
    dragOver: false,
    uploading: false,
    meme: null,
    results: null,
    searching: false,
    notice: null,
    pending: false,
    preview: null, // the rendered draft, once the server answers
  };
  let dragDepth = 0;
  let searchSeq = 0;
  let searchTimer = 0;
  let previewSeq = 0;

  const categoryTag = (category) => document.querySelector(`template[data-category-tag="${category}"]`)?.content.firstElementChild.cloneNode(true) ?? null;
  const memeText = (meme) => element("span", { class: "min-w-0 flex-1" },
    element("span", { class: "block truncate text-sm font-bold" }, meme.title),
    element("span", { class: "block truncate text-xs text-muted" }, meme.summary));

  const renderMeme = () => {
    const parts = [memeLegend];
    if (state.meme) {
      const clear = element("button", { type: "button", "aria-label": "밈 첨부 해제", class: "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-2" });
      clear.innerHTML = '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';
      clear.addEventListener("click", () => {
        state.meme = null;
        renderMeme();
      });
      parts.push(element("div", { class: "mt-1.5 flex min-h-11 items-center gap-2.5 rounded-xl border border-accent bg-accent-soft/40 px-3 py-2" },
        categoryTag(state.meme.category), memeText(state.meme), clear));
    } else {
      parts.push(search);
      if (search.value.trim()) {
        const items = [];
        if (state.searching) items.push(element("li", { class: "px-3 py-3 text-sm text-muted" }, "검색 중…"));
        if (!state.searching && state.results !== null && state.results.length === 0) {
          items.push(element("li", { class: "px-3 py-3 text-sm text-muted" }, "검색 결과가 없어요."));
        }
        if (!state.searching) {
          for (const meme of state.results ?? []) {
            const pick = element("button", { type: "button", class: "flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2" },
              categoryTag(meme.category), memeText(meme));
            pick.addEventListener("click", () => {
              state.meme = meme;
              search.value = "";
              state.results = null;
              renderMeme();
            });
            items.push(element("li", { class: "border-b border-border last:border-b-0" }, pick));
          }
        }
        parts.push(element("ul", { class: "mt-2 overflow-hidden rounded-xl border border-border bg-surface" }, ...items));
      }
    }
    memeField.replaceChildren(...parts);
  };

  const render = () => {
    titleCount.textContent = `${title.value.length.toLocaleString("ko-KR")}/${TITLE_MAX}자 · 2자 이상`;
    bodyCount.textContent = `마크다운 지원 · 이미지/영상을 끌어다 놓거나 붙여넣으면 업로드돼요 · ${body.value.length.toLocaleString("ko-KR")}/${BODY_MAX.toLocaleString("ko-KR")}자`;
    for (const tab of tabs) {
      const on = tab.dataset.postTab === state.tab;
      tab.setAttribute("aria-pressed", String(on));
      tab.className = `${TOOLBAR} ${on ? TAB_ON : ""}`;
    }
    for (const tool of tools) tool.disabled = state.uploading || state.tab === "preview";
    toolbar.querySelector("[data-post-uploading]")?.remove();
    if (state.uploading) {
      const status = element("span", { class: "ml-auto inline-flex items-center gap-1.5 pr-1 text-sm text-muted", role: "status", "data-post-uploading": "" });
      status.innerHTML = '<svg viewBox="0 0 24 24" class="h-4 w-4 animate-spin" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9"></path></svg>업로드 중…';
      toolbar.append(status);
    }
    editor.className = `${EDITOR} ${state.dragOver ? EDITOR_DRAG : EDITOR_IDLE}`;
    body.className = `w-full resize-y bg-transparent p-3 text-base placeholder:text-muted focus:outline-none ${state.tab === "preview" ? "hidden" : ""}`;
    editor.querySelector("[data-post-preview]")?.remove();
    if (state.tab === "preview") {
      const panel = element("div", { class: "min-h-40 p-3", "data-post-preview": "" });
      if (!body.value.trim()) panel.append(element("p", { class: "text-base text-muted" }, "미리 볼 내용이 없어요."));
      else if (state.preview !== null) panel.innerHTML = state.preview;
      editor.append(panel);
    }
    submit.disabled = state.pending || state.uploading || title.value.trim().length < 2 || !body.value.trim();
    submit.textContent = state.pending ? "올리는 중…" : "글 올리기";
    form.querySelector("[data-post-notice]")?.remove();
    if (state.notice) {
      const login = state.notice.loginLink
        ? [" ", element("a", { href: "/login?next=/community/new", class: "font-semibold underline underline-offset-2" }, "로그인하고 이어서 쓰기")]
        : [];
      form.append(element("p", {
        role: state.notice.kind === "error" ? "alert" : "status",
        class: "text-base",
        style: `color:${state.notice.kind === "error" ? "var(--safety-red)" : "var(--safety-green)"}`,
        "data-post-notice": "",
      }, state.notice.message, ...login));
    }
  };

  const setNotice = (notice) => {
    state.notice = notice;
    render();
  };

  // The server renders what the tab shows; an answer for an older draft is dropped.
  async function loadPreview() {
    state.preview = null;
    render();
    const draft = body.value;
    if (!draft.trim()) return;
    const seq = ++previewSeq;
    let html = null;
    try {
      const response = await fetch("/api/community/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ body: draft }),
      });
      if (response.ok) html = (await response.json()).html;
    } catch {
      /* shown below */
    }
    if (seq !== previewSeq || state.tab !== "preview") return;
    state.preview = html ?? '<p class="text-base text-muted">미리보기를 불러오지 못했어요.</p>';
    render();
  }

  /** At the caret, as the form's `insertAtCursor`. */
  function insertAtCursor(snippet) {
    const current = body.value;
    const start = body.selectionStart ?? current.length;
    const end = body.selectionEnd ?? current.length;
    const next = current.slice(0, start) + snippet + current.slice(end);
    if (next.length > BODY_MAX) {
      setNotice({ kind: "error", message: `본문은 ${BODY_MAX.toLocaleString("ko-KR")}자까지 쓸 수 있어요.` });
      return;
    }
    body.value = next;
    persistDraft(title.value, next);
    render();
    requestAnimationFrame(() => {
      body.focus();
      const at = start + snippet.length;
      body.setSelectionRange(at, at);
    });
  }

  /** The selection between `prefix` and `suffix`, as `wrapSelection`. */
  function wrapSelection(prefix, suffix, placeholder) {
    const start = body.selectionStart;
    const end = body.selectionEnd;
    const current = body.value;
    const selected = current.slice(start, end) || placeholder;
    const next = current.slice(0, start) + prefix + selected + suffix + current.slice(end);
    if (next.length > BODY_MAX) return;
    body.value = next;
    persistDraft(title.value, next);
    render();
    requestAnimationFrame(() => {
      body.focus();
      body.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    });
  }

  async function handleFiles(list) {
    if (list.length === 0 || state.uploading) return;
    state.notice = null;
    state.tab = "write";
    state.uploading = true;
    render();
    try {
      for (const file of list) {
        const result = await uploadCommunityMedia(file);
        if (!result.ok) {
          setNotice({ kind: "error", message: result.error, loginLink: result.code === "login_required" });
          continue;
        }
        const url = `/api/media/${result.path}`;
        if (file.type.startsWith("video/")) {
          insertAtCursor(`\n[동영상](${url})\n`);
        } else {
          const name = file.name.replace(/[[\]()]/g, "").trim() || "이미지";
          insertAtCursor(`\n![${name}](${url})\n`);
        }
      }
    } finally {
      state.uploading = false;
      render();
    }
  }

  function onQuery() {
    clearTimeout(searchTimer);
    const query = search.value.trim();
    if (!query) {
      state.results = null;
      state.searching = false;
      renderMeme();
      return;
    }
    state.searching = true;
    renderMeme();
    const seq = ++searchSeq;
    searchTimer = setTimeout(async () => {
      let data = null;
      try {
        // The planner's builder is thenable, not a Promise: await it.
        ({ data } = await createPlanClient(postPlan).rpc("search_memes", { p_query: query, p_limit: 5 }));
      } catch {
        /* no results */
      }
      if (seq !== searchSeq) return;
      state.searching = false;
      state.results = (data ?? []).map((meme) => ({ id: meme.id, title: meme.title, summary: meme.summary, category: meme.category }));
      renderMeme();
    }, SEARCH_DELAY_MS);
  }

  // `app/(default)/error.tsx`: what a failed action shows.
  const showError = () => {
    const template = document.querySelector("template[data-action-error]");
    const page = document.querySelector("main");
    if (!template || !page) return;
    const panel = template.content.firstElementChild.cloneNode(true);
    panel.querySelector("[data-action-retry]")?.addEventListener("click", () => location.reload());
    page.replaceWith(panel);
  };

  title.addEventListener("input", () => {
    persistDraft(title.value, body.value);
    render();
  });
  body.addEventListener("input", () => {
    persistDraft(title.value, body.value);
    render();
  });
  body.addEventListener("paste", (event) => {
    const pasted = [...(event.clipboardData?.files ?? [])];
    if (pasted.length > 0) {
      event.preventDefault();
      void handleFiles(pasted);
    }
  });
  for (const tab of tabs) {
    tab.addEventListener("click", () => {
      state.tab = tab.dataset.postTab;
      if (state.tab === "preview") void loadPreview();
      else render();
    });
  }
  for (const tool of tools) {
    tool.addEventListener("click", () => {
      if (tool.dataset.postTool === "bold") wrapSelection("**", "**", "굵은 텍스트");
      else if (tool.dataset.postTool === "link") wrapSelection("[", "](https://)", "링크 텍스트");
      else files.click();
    });
  }
  files.addEventListener("change", () => {
    const picked = [...(files.files ?? [])];
    files.value = ""; // the same file can be picked again
    void handleFiles(picked);
  });
  editor.addEventListener("dragenter", (event) => {
    if (!event.dataTransfer?.types.includes("Files")) return;
    event.preventDefault();
    dragDepth += 1;
    state.dragOver = true;
    render();
  });
  editor.addEventListener("dragover", (event) => {
    if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
  });
  editor.addEventListener("dragleave", () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      state.dragOver = false;
      render();
    }
  });
  editor.addEventListener("drop", (event) => {
    event.preventDefault();
    dragDepth = 0;
    state.dragOver = false;
    void handleFiles([...(event.dataTransfer?.files ?? [])]);
  });
  search.addEventListener("input", onQuery);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.pending || state.uploading || title.value.trim().length < 2 || !body.value.trim()) return;
    state.notice = null;
    state.pending = true;
    render();
    let result;
    try {
      const response = await fetch("/api/community/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title: title.value, body: body.value, memeId: state.meme?.id ?? null }),
      });
      result = await response.json();
    } catch {
      showError();
      return;
    }
    if (result.ok) {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* this device only */
      }
      location.assign(`/community/${result.data.postId}`);
      return;
    }
    state.pending = false;
    setNotice({ kind: "error", message: result.message, loginLink: result.error === "login_required" });
  });

  const draft = readDraft();
  if (draft?.title) title.value = draft.title;
  if (draft?.body) body.value = draft.body;
  render();
}
