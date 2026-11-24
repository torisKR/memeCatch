// components/submit-form.tsx for /submit (src/pages/account/submit.rs): the
// draft on this device, the duplicate search (`search_memes` through the
// planner, as the browser client sends it), the link preview
// (components/content-url-preview.tsx: R11's GET /api/oembed), an image
// uploaded when the form is sent (lib/upload.ts, bundled here), and
// POST /api/submit, which answers with the action's state. The form's text
// follows the language switch: the frame brings the page copy
// (`memecatch:page-copy`); until then, the Korean copy in the page.
import { MAX_UPLOAD_BYTES, uploadMemeImage, validateUploadFile } from "@/server/ui/lib/upload";
import { createPlanClient } from "@/lib/db/plan";
import { memePathFrom } from "@/server/ui/lib/labels";

const DRAFT_KEY = "memecatch:submit-draft:v1";
const FIELDS = ["name", "seenAt", "sourceUrl", "description", "guessReason", "tags"];
const PLACEHOLDERS = {
  name: "namePlaceholder",
  seenAt: "seenAtPlaceholder",
  sourceUrl: "sourceUrlPlaceholder",
  description: "descriptionPlaceholder",
  guessReason: "guessPlaceholder",
  tags: "tagsPlaceholder",
};
const DUP_DELAY_MS = 400;
const DRAFT_DELAY_MS = 500;
const PROVIDER_NAMES = { youtube: "YouTube", tiktok: "TikTok", instagram: "Instagram", facebook: "Facebook", threads: "Threads" };

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

// content-url-preview.tsx's `detectProvider` and `isTrustedEmbedUrl`.
function detectProvider(rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname.toLowerCase();
    const isHost = (domain) => hostname === domain || hostname.endsWith(`.${domain}`);
    if (isHost("youtube.com") || isHost("youtu.be")) return "youtube";
    if (isHost("tiktok.com")) return "tiktok";
    if (isHost("instagram.com")) return "instagram";
    if (isHost("facebook.com") || hostname === "fb.watch") return "facebook";
    if (isHost("threads.net") || isHost("threads.com")) return "threads";
    return null;
  } catch {
    return null;
  }
}
function isTrustedEmbedUrl(provider, rawUrl) {
  if (!rawUrl) return false;
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (provider === "youtube") return url.hostname === "www.youtube-nocookie.com" && url.pathname.startsWith("/embed/");
    if (provider === "tiktok") return url.hostname === "www.tiktok.com" && url.pathname.startsWith("/player/v1/");
    if (provider === "instagram") return url.hostname === "www.instagram.com" && url.pathname.endsWith("/embed/captioned/");
    if (provider === "facebook") return url.hostname === "www.facebook.com" && url.pathname.startsWith("/plugins/");
    return false;
  } catch {
    return false;
  }
}
const threadsDocument = (html) =>
  `<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center}</style></head><body>${html}</body></html>`;

const form = document.querySelector("[data-submit-form]");
if (form) {
  let copy = document.pageCopy?.form ? document.pageCopy : JSON.parse(document.querySelector("[data-submit-copy]")?.textContent ?? "{}");
  const input = (name) => form.querySelector(`[name="${name}"]`);
  const fieldBox = (key) => form.querySelector(`[data-submit-field="${key}"]`);
  const file = form.querySelector('input[type="file"]');
  const submit = form.querySelector('button[type="submit"]');
  const defaultName = form.dataset.defaultName ?? "";
  const state = {
    restored: false,
    dups: [],
    dupLoading: false,
    attachFile: null,
    previewUrl: null,
    uploading: false,
    uploadError: null,
    pending: false,
    result: { status: "idle" },
    preview: { status: "idle" },
  };
  let uploaded = null; // { file, path }: the same file is not sent twice
  let dupSeq = 0;
  let dupTimer = 0;
  let draftTimer = 0;

  const values = () => Object.fromEntries(FIELDS.map((key) => [key, input(key).value]));

  // --- the link preview ------------------------------------------------
  function previewElement() {
    const p = copy.preview;
    const url = input("sourceUrl").value.trim();
    if (!url) return element("p", { class: "mt-2 text-sm text-muted", "data-submit-preview": "" }, p.idle);
    const provider = detectProvider(url);
    if (!provider) return element("p", { class: "mt-2 text-sm text-muted", "data-submit-preview": "" }, p.unsupported);
    const name = PROVIDER_NAMES[provider];
    const current = state.preview.url === url ? state.preview : { status: "idle" };
    const head = element("div", { class: "flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5" },
      element("p", { class: "flex items-center gap-2 text-sm font-bold" },
        element("span", { class: "h-2 w-2 rounded-full bg-accent", "aria-hidden": "true" }), p.checking),
      element("span", { class: "rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted" }, name));
    let body;
    if (current.status === "ready") {
      const data = current.data;
      const portrait = data.provider === "tiktok" || (data.provider === "youtube" && new URL(data.sourceUrl).pathname.startsWith("/shorts/"));
      const tall = data.provider === "instagram" || data.provider === "threads";
      const size = portrait ? "mx-auto aspect-[9/16] w-full max-w-[360px]" : tall ? "mx-auto h-[680px] w-full max-w-[658px]" : "aspect-video w-full";
      const frame = element("iframe", {
        src: data.embedUrl ?? undefined,
        title: p.frameTitle.replace("{provider}", PROVIDER_NAMES[data.provider]),
        sandbox: data.provider === "threads" ? "allow-scripts allow-popups" : "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation",
        allow: "autoplay; encrypted-media; picture-in-picture; fullscreen",
        allowfullscreen: true,
        referrerpolicy: "strict-origin-when-cross-origin",
        class: `${size} rounded-xl border-0 bg-white`,
      });
      if (data.provider === "threads" && data.embedHtml) frame.srcdoc = threadsDocument(data.embedHtml);
      body = element("div", {},
        element("div", { class: "flex items-start gap-2 border-b border-border px-4 py-3" },
          element("span", { "aria-hidden": "true", class: "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-safety-green-bg text-xs font-bold text-safety-green" }, "✓"),
          element("div", { class: "min-w-0" },
            element("p", { class: "text-sm font-bold text-safety-green" }, p.ready),
            element("p", { class: "truncate text-sm text-muted" },
              data.title || p.providerContent.replace("{provider}", name),
              data.authorName ? ` · ${data.authorName}` : ""))),
        element("div", { class: "bg-surface-2 p-2 sm:p-3" }, frame));
    } else {
      const loading = current.status === "loading";
      const verify = element("button", { type: "button", disabled: loading, class: "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft px-4 text-sm font-bold text-accent transition-colors hover:bg-accent-strong hover:text-white disabled:cursor-wait disabled:opacity-60" },
        loading ? element("span", { "aria-hidden": "true", class: "h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" }) : null,
        loading ? p.verifying : p.verify);
      verify.addEventListener("click", () => checkPreview(url, provider));
      body = element("div", { class: "p-4" },
        element("p", { class: "text-sm text-muted" }, p.verifyBody),
        verify,
        current.status === "error" ? element("p", { role: "alert", class: "mt-3 text-sm text-safety-red" }, `${current.message} ${p.errorSuffix}`) : null);
    }
    return element("section", { "aria-label": p.label, class: "mt-3 overflow-hidden rounded-2xl border border-border bg-surface", "data-submit-preview": "" }, head, body);
  }

  async function checkPreview(url, provider) {
    state.preview = { status: "loading", url };
    render();
    try {
      const response = await fetch(`/api/oembed?url=${encodeURIComponent(url)}`);
      const result = await response.json();
      if (!response.ok || !("provider" in result)) throw new Error(copy.preview.genericError);
      const trusted = result.provider === "threads"
        ? typeof result.embedHtml === "string" && result.embedHtml.length > 0
        : isTrustedEmbedUrl(result.provider, result.embedUrl);
      if (result.provider !== provider || !trusted) throw new Error(copy.preview.unsafeError);
      state.preview = { status: "ready", url, data: result };
    } catch (error) {
      state.preview = { status: "error", url, message: error instanceof Error && error.message === copy.preview.unsafeError ? copy.preview.unsafeError : copy.preview.genericError };
    }
    render();
  }

  // --- rendering -------------------------------------------------------
  const errorLine = (id, message) => element("p", { id: `${id}-error`, role: "alert", class: "mt-1.5 text-sm text-safety-red", "data-submit-error": "" }, message);

  function render() {
    if (state.result.status === "success") {
      const f = copy.form;
      form.replaceWith(element("section", { "aria-live": "polite", class: "rounded-2xl border border-border bg-surface p-6" },
        element("span", { class: "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold bg-safety-gray-bg text-safety-gray shadow-[0_0_0_1px_color-mix(in_srgb,var(--safety-gray)_30%,transparent),0_0_10px_-4px_color-mix(in_srgb,var(--safety-gray)_50%,transparent)] " }, f.successBadge),
        element("h2", { class: "mt-3 text-xl font-bold" }, f.successTitle),
        element("p", { class: "mt-2 text-muted" }, f.successBody),
        element("div", { class: "mt-6 flex flex-col gap-3" },
          element("a", { href: "/my", class: "flex h-12 items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white" }, f.viewMy),
          element("a", { href: "/submit", class: "flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-base font-semibold" }, f.submitAnother))));
      return;
    }
    const f = copy.form;
    for (const node of form.querySelectorAll("[data-submit-text]")) {
      const value = node.dataset.submitText.split(".").reduce((at, key) => at?.[key], copy);
      if (typeof value === "string") node.textContent = value;
    }
    // The name's label: its first text, then the marks after it.
    const lead = form.querySelector("[data-submit-lead]");
    const first = [...lead.childNodes].find((node) => node.nodeType === 3);
    if (first) first.data = f.nameLabel;
    form.querySelector("[data-submit-required]").textContent = `(${f.required})`;
    for (const [key, placeholder] of Object.entries(PLACEHOLDERS)) input(key).placeholder = f[placeholder];

    form.querySelector("[data-submit-restored]")?.remove();
    form.querySelector("[data-submit-form-error]")?.remove();
    const formError = state.result.status === "error" ? state.result.formError : undefined;
    if (formError) form.prepend(element("p", { role: "alert", class: "rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red", "data-submit-form-error": "" }, formError));
    if (state.restored) form.prepend(element("p", { class: "rounded-xl bg-surface-2 px-4 py-3 text-muted", role: "status", "data-submit-restored": "" }, f.restored));

    const fieldErrors = state.result.status === "error" ? state.result.fieldErrors ?? {} : {};
    for (const key of FIELDS) {
      const box = fieldBox(key);
      const control = input(key);
      box.querySelector("[data-submit-error]")?.remove();
      control.setAttribute("aria-invalid", String(Boolean(fieldErrors[key])));
      if (fieldErrors[key]) {
        control.setAttribute("aria-describedby", `${control.id}-error`);
        control.after(errorLine(control.id, fieldErrors[key]));
      } else {
        control.removeAttribute("aria-describedby");
      }
    }

    const nameBox = fieldBox("name");
    nameBox.querySelector("[data-submit-dups]")?.remove();
    if (state.dupLoading) {
      nameBox.append(element("p", { class: "mt-2 flex items-center gap-1.5 text-sm text-muted", role: "status", "data-submit-dups": "" },
        element("span", { "aria-hidden": "true", class: "signal-live size-1.5 shrink-0 rounded-full bg-(--signal-cyan)" }), f.duplicateLoading));
    } else if (state.dups.length > 0) {
      nameBox.append(element("div", { class: "mt-2 rounded-xl bg-safety-yellow-bg px-4 py-3", role: "status", "data-submit-dups": "" },
        element("p", { class: "font-medium text-safety-yellow" }, f.duplicateTitle),
        element("ul", { class: "mt-2 flex flex-col gap-1" }, ...state.dups.map((meme) => element("li", {},
          element("a", { href: memePathFrom(meme.short_id, meme.slug), class: "inline-flex min-h-11 items-center text-foreground underline underline-offset-4" }, meme.title)))),
        element("p", { class: "mt-1 text-sm text-muted" }, f.duplicateBody)));
    }

    fieldBox("sourceUrl").querySelector("[data-submit-preview]").replaceWith(previewElement());

    const attachBox = fieldBox("attachment");
    attachBox.querySelector("[data-submit-error]")?.remove();
    attachBox.querySelector("[data-submit-image]")?.remove();
    const attachError = state.uploadError ?? fieldErrors.attachment;
    file.setAttribute("aria-invalid", String(Boolean(attachError)));
    file.setAttribute("aria-describedby", attachError ? `${file.id}-error` : `${file.id}-hint`);
    if (attachError) {
      attachBox.append(element("p", { id: `${file.id}-error`, role: "alert", class: "mt-1.5 text-sm text-safety-red", "data-submit-error": "" }, `${attachError} — ${f.attachmentRetry}`));
    }
    if (state.attachFile && state.previewUrl) {
      const remove = element("button", { type: "button", class: "flex h-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold" }, f.removeAttachment);
      remove.addEventListener("click", removeFile);
      attachBox.append(element("div", { class: "mt-3 flex items-start gap-3", "data-submit-image": "" },
        element("img", { src: state.previewUrl, alt: f.attachmentPreview, class: "max-h-48 w-auto max-w-full rounded-xl border border-border object-contain" }), remove));
    }

    const busy = state.pending || state.uploading;
    submit.disabled = busy;
    submit.replaceChildren(
      busy ? element("span", { "aria-hidden": "true", class: state.uploading ? "signal-live size-2.5 rounded-full bg-(--signal-cyan)" : "h-4 w-4 animate-spin rounded-full border-2 border-flame-200/40 border-t-white" }) : "",
      state.uploading ? f.uploading : state.pending ? f.submitting : f.submit);
  }

  // --- the duplicate search and the draft --------------------------------
  function searchDuplicates() {
    clearTimeout(dupTimer);
    const query = input("name").value.trim();
    if (query.length < 2) {
      state.dups = [];
      state.dupLoading = false;
      return;
    }
    state.dupLoading = true;
    const seq = ++dupSeq;
    dupTimer = setTimeout(async () => {
      let data = null;
      let error = null;
      try {
        ({ data, error } = await createPlanClient(postPlan).rpc("search_memes", { p_query: query, p_limit: 3 }));
      } catch (caught) {
        error = caught;
      }
      if (seq !== dupSeq) return;
      state.dupLoading = false;
      state.dups = error || !data ? [] : data.map((meme) => ({ id: meme.id, short_id: meme.short_id, slug: meme.slug, title: meme.title, summary: meme.summary }));
      render();
    }, DUP_DELAY_MS);
  }
  function saveDraftSoon() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(() => {
      try {
        const fields = values();
        if (Object.values(fields).some((value) => value.trim() !== "")) localStorage.setItem(DRAFT_KEY, JSON.stringify(fields));
      } catch {
        /* this device only */
      }
    }, DRAFT_DELAY_MS);
  }

  // --- the image -----------------------------------------------------------
  function removeFile() {
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.attachFile = null;
    state.previewUrl = null;
    state.uploadError = null;
    file.value = "";
    render();
  }
  file.addEventListener("change", () => {
    const picked = file.files?.[0] ?? null;
    state.uploadError = null;
    if (!picked) {
      render();
      return;
    }
    if (validateUploadFile(picked)) {
      state.uploadError = picked.size > MAX_UPLOAD_BYTES ? copy.errors.imageTooLarge : copy.errors.imageType;
      file.value = "";
      render();
      return;
    }
    if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
    state.attachFile = picked;
    state.previewUrl = URL.createObjectURL(picked);
    render();
  });

  // --- sending -------------------------------------------------------------
  // app/(default)/submit/error.tsx: what a failed action shows.
  const showError = () => {
    const page = document.querySelector("main");
    if (!page) return;
    const retry = element("button", { type: "button", class: "mt-6 h-12 rounded-xl bg-accent-strong px-6 text-base font-bold text-white" }, copy.page.retry);
    retry.addEventListener("click", () => location.reload());
    page.replaceWith(element("main", { class: "mx-auto w-full max-w-site px-4 py-16 text-center" },
      element("div", { class: "mx-auto w-full max-w-md" },
        element("h1", { class: "text-xl font-bold" }, copy.page.loadErrorTitle),
        element("p", { class: "mt-2 text-muted" }, copy.page.loadErrorBody), retry)));
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (state.pending || state.uploading) return;
    state.uploadError = null;
    let attachmentPath = "";
    if (state.attachFile) {
      if (uploaded?.file === state.attachFile) {
        attachmentPath = uploaded.path;
      } else {
        state.uploading = true;
        render();
        try {
          const result = await uploadMemeImage(state.attachFile);
          if (!result.ok) {
            state.uploadError = result.code === "login_required" ? copy.errors.loginRequired
              : result.code === "rate_limited" ? copy.errors.rateLimited
                : copy.errors.imageUploadFailed;
            return;
          }
          uploaded = { file: state.attachFile, path: result.path };
          attachmentPath = result.path;
        } finally {
          state.uploading = false;
          render();
        }
      }
    }
    state.pending = true;
    render();
    try {
      const response = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...values(), attachmentPath }),
      });
      state.result = await response.json();
    } catch {
      showError();
      return;
    }
    state.pending = false;
    if (state.result.status === "success") {
      try {
        localStorage.removeItem(DRAFT_KEY);
      } catch {
        /* this device only */
      }
    }
    render();
  });

  for (const key of FIELDS) {
    input(key).addEventListener("input", () => {
      if (key === "name") searchDuplicates();
      saveDraftSoon();
      render();
    });
  }
  document.addEventListener("memecatch:page-copy", (event) => {
    if (event.detail?.form) {
      copy = event.detail;
      render();
    }
  });

  // The draft, once: a `?name=` given to the page wins over its name.
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (raw) {
      const draft = JSON.parse(raw);
      for (const key of FIELDS) {
        const value = key === "name" ? defaultName || draft.name || "" : draft[key] ?? "";
        input(key).value = value;
      }
      if (Object.values(draft).some((value) => typeof value === "string" && value.trim())) state.restored = true;
    }
  } catch {
    /* this device only */
  }
  searchDuplicates();
  render();
}
