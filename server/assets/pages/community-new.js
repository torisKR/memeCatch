(() => {
"use strict";
const lib = {};
lib.uploadShared = (() => {
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_UPLOAD_BYTES = 20 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
};
const ALLOWED_VIDEO_TYPES = {
    "video/mp4": "mp4",
    "video/webm": "webm",
};
const UPLOAD_ACCEPT = Object.keys(ALLOWED_IMAGE_TYPES).join(",");
const UPLOAD_ACCEPT_MEDIA = [
    ...Object.keys(ALLOWED_IMAGE_TYPES),
    ...Object.keys(ALLOWED_VIDEO_TYPES),
].join(",");
return { MAX_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, UPLOAD_ACCEPT, UPLOAD_ACCEPT_MEDIA };
})();
lib.upload = (() => {
"use client";
const { ALLOWED_IMAGE_TYPES, ALLOWED_VIDEO_TYPES, MAX_UPLOAD_BYTES, MAX_VIDEO_UPLOAD_BYTES, UPLOAD_ACCEPT, UPLOAD_ACCEPT_MEDIA, } = lib.uploadShared;
function validateUploadFile(file) {
    if (!ALLOWED_IMAGE_TYPES[file.type]) {
        return "JPG·PNG·WebP·GIF 이미지만 올릴 수 있어요";
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return "이미지는 5MB 이하만 올릴 수 있어요";
    }
    return null;
}
function validateMediaFile(file) {
    if (ALLOWED_VIDEO_TYPES[file.type]) {
        if (file.size > MAX_VIDEO_UPLOAD_BYTES) {
            return "동영상은 20MB 이하만 올릴 수 있어요";
        }
        return null;
    }
    if (ALLOWED_IMAGE_TYPES[file.type]) {
        if (file.size > MAX_UPLOAD_BYTES) {
            return "이미지는 5MB 이하만 올릴 수 있어요";
        }
        return null;
    }
    return "이미지(JPG·PNG·WebP·GIF) 또는 동영상(MP4·WebM)만 올릴 수 있어요";
}
async function postUpload(file, failMessage) {
    const form = new FormData();
    form.set("file", file);
    try {
        const res = await fetch("/api/upload", { method: "POST", body: form });
        const json = (await res.json());
        if (!res.ok || !json.ok || !json.path) {
            if (json.error === "login_required") {
                return {
                    ok: false,
                    code: "login_required",
                    error: "로그인이 필요해요. 로그인 후 다시 시도해 주세요",
                };
            }
            if (json.error === "rate_limited") {
                return {
                    ok: false,
                    code: "rate_limited",
                    error: "업로드가 너무 잦아요. 잠시 후 다시 시도해 주세요",
                };
            }
            if (json.error === "storage_quota_exceeded") {
                return { ok: false, error: "업로드 저장 용량 한도에 도달했어요. 관리자에게 문의해 주세요" };
            }
            return { ok: false, error: failMessage };
        }
        return { ok: true, path: json.path };
    }
    catch {
        return { ok: false, error: failMessage };
    }
}
async function uploadMemeImage(file) {
    const invalid = validateUploadFile(file);
    if (invalid)
        return { ok: false, error: invalid };
    return postUpload(file, "이미지 업로드에 실패했어요. 다시 시도해 주세요");
}
async function uploadCommunityMedia(file) {
    const invalid = validateMediaFile(file);
    if (invalid)
        return { ok: false, error: invalid };
    return postUpload(file, "파일 업로드에 실패했어요. 다시 시도해 주세요");
}
return { validateUploadFile, validateMediaFile, uploadMemeImage, uploadCommunityMedia };
})();
lib.plan = (() => {
const IDENT = /^[a-z_][a-z0-9_]*$/i;
function isIdent(value) {
    return IDENT.test(value);
}
function quoteIdent(value) {
    if (!isIdent(value))
        throw new Error("invalid identifier");
    return `"${value}"`;
}
function splitTop(input, separator) {
    const parts = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (ch === "(")
            depth += 1;
        else if (ch === ")")
            depth -= 1;
        else if (ch === separator && depth === 0) {
            parts.push(input.slice(start, i).trim());
            start = i + 1;
        }
    }
    const tail = input.slice(start).trim();
    if (tail)
        parts.push(tail);
    return parts.filter(Boolean);
}
function parseFields(input) {
    if (!input.trim() || input.trim() === "*")
        return [{ kind: "star" }];
    return splitTop(input, ",").map(parseField);
}
function parseField(token) {
    const embed = token.match(/^(?:([A-Za-z_][A-Za-z0-9_]*):)?([A-Za-z_][A-Za-z0-9_]*)(?:!([A-Za-z_][A-Za-z0-9_]*))?(?:!([A-Za-z_][A-Za-z0-9_]*))?\((.*)\)$/);
    if (!embed) {
        if (token === "*")
            return { kind: "star" };
        if (!isIdent(token))
            throw new Error("invalid identifier");
        return { kind: "column", name: token };
    }
    const alias = embed[1] ?? embed[2];
    const table = embed[2];
    const mods = [embed[3], embed[4]].filter((item) => Boolean(item));
    if (!alias || !table || !isIdent(alias) || !isIdent(table))
        throw new Error("invalid identifier");
    const inner = mods.includes("inner");
    const hint = mods.find((item) => item !== "inner") ?? null;
    if (hint && !isIdent(hint))
        throw new Error("invalid identifier");
    return {
        kind: "embed",
        embed: {
            alias,
            table,
            inner,
            hint,
            fields: parseFields(embed[5] ?? ""),
            filters: [],
            orGroups: [],
            orders: [],
            limit: null,
        },
    };
}
const OR_OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in", "contains", "not"]);
function parseOrFilter(raw) {
    return splitTop(raw, ",").map((part) => {
        const pieces = part.trim().split(".");
        let opIndex = 1;
        while (opIndex < pieces.length && !OR_OPS.has(pieces[opIndex] ?? ""))
            opIndex += 1;
        const column = pieces.slice(0, opIndex).join(".");
        let rest = pieces.slice(opIndex);
        let negate = false;
        if (rest[0] === "not") {
            negate = true;
            rest = rest.slice(1);
        }
        const op = rest[0];
        let value = rest.slice(1).join(".");
        if (!column || !op)
            throw new Error("invalid filter");
        if (op === "is") {
            if (value === "null")
                value = null;
            else if (value === "true")
                value = true;
            else if (value === "false")
                value = false;
        }
        else if ((op === "like" || op === "ilike") && typeof value === "string") {
            value = value.replaceAll("*", "%");
        }
        else if (op === "in" && typeof value === "string") {
            value = value.replace(/^\(|\)$/g, "").split(",").filter(Boolean);
        }
        return { column, op, value, negate };
    });
}
function relationOf(options) {
    return options?.referencedTable ?? options?.foreignTable;
}
function findEmbed(fields, relation) {
    for (const field of fields) {
        if (field.kind !== "embed")
            continue;
        if (field.embed.alias === relation || field.embed.table === relation)
            return field.embed;
        const nested = findEmbed(field.embed.fields, relation);
        if (nested)
            return nested;
    }
    return null;
}
function findDirectEmbed(fields, relation) {
    for (const field of fields) {
        if (field.kind === "embed" &&
            (field.embed.alias === relation || field.embed.table === relation)) {
            return field.embed;
        }
    }
    return null;
}
class QueryBuilder {
    constructor(execute, op, target) {
        this.execute = execute;
        this.plan = {
            op,
            table: target.table,
            fn: target.fn,
            fields: [{ kind: "star" }],
            filters: [],
            orGroups: [],
            orders: [],
            limit: null,
            offset: null,
            single: false,
            maybeSingle: false,
            count: null,
            head: false,
            values: target.values,
            onConflict: null,
            ignoreDuplicates: false,
            returning: op === "select" || op === "rpc",
            args: target.args,
        };
    }
    select(columns, options) {
        if (typeof columns === "string")
            this.plan.fields = parseFields(columns);
        if (options?.count === "exact")
            this.plan.count = "exact";
        if (options?.head)
            this.plan.head = true;
        this.plan.returning = true;
        return this;
    }
    eq(column, value) { return this.filter(column, "eq", value); }
    neq(column, value) { return this.filter(column, "neq", value); }
    gt(column, value) { return this.filter(column, "gt", value); }
    gte(column, value) { return this.filter(column, "gte", value); }
    lt(column, value) { return this.filter(column, "lt", value); }
    lte(column, value) { return this.filter(column, "lte", value); }
    like(column, value) { return this.filter(column, "like", value); }
    ilike(column, value) { return this.filter(column, "ilike", value); }
    is(column, value) { return this.filter(column, "is", value); }
    in(column, value) { return this.filter(column, "in", value); }
    contains(column, value) { return this.filter(column, "contains", value); }
    not(column, op, value) {
        this.plan.filters.push({ column, op, value, negate: true });
        return this;
    }
    filter(column, op, value) {
        this.plan.filters.push({ column, op, value });
        return this;
    }
    or(filters, options) {
        const group = parseOrFilter(filters);
        const relation = relationOf(options);
        if (relation) {
            const embed = findEmbed(this.plan.fields, relation);
            if (!embed)
                throw new Error("invalid identifier");
            embed.orGroups.push(group);
            if (filters.includes("!inner") || this.plan.fields.some((field) => field.kind === "embed" && field.embed.alias === relation && field.embed.inner)) {
                embed.inner = embed.inner || true;
            }
        }
        else {
            this.plan.orGroups.push(group);
        }
        return this;
    }
    order(column, options) {
        const order = {
            column,
            ascending: options?.ascending !== false,
            nullsFirst: options?.nullsFirst,
        };
        const relation = relationOf(options);
        if (relation) {
            const embed = findEmbed(this.plan.fields, relation);
            if (!embed)
                throw new Error("invalid identifier");
            embed.orders.push(order);
        }
        else {
            this.plan.orders.push(order);
        }
        return this;
    }
    limit(count, options) {
        const relation = relationOf(options);
        if (relation) {
            const embed = findEmbed(this.plan.fields, relation);
            if (!embed)
                throw new Error("invalid identifier");
            embed.limit = count;
        }
        else {
            this.plan.limit = count;
        }
        return this;
    }
    range(from, to) {
        this.plan.offset = from;
        this.plan.limit = to - from + 1;
        return this;
    }
    single() {
        this.plan.single = true;
        this.plan.returning = true;
        return this;
    }
    maybeSingle() {
        this.plan.maybeSingle = true;
        this.plan.returning = true;
        return this;
    }
    overrideTypes() {
        return this;
    }
    abortSignal(signal) {
        this.signal = signal;
        return this;
    }
    returns() {
        return this.execute(this.plan, this.signal);
    }
    upsert(values, options) {
        this.plan.op = "upsert";
        this.plan.values = values;
        this.plan.onConflict = options?.onConflict ?? null;
        this.plan.ignoreDuplicates = options?.ignoreDuplicates === true;
        this.plan.returning = false;
        return this;
    }
    then(onfulfilled, onrejected) {
        return this.execute(this.plan, this.signal).then(onfulfilled, onrejected);
    }
}
function createPlanClient(execute) {
    const client = {
        from(table) {
            const builder = new QueryBuilder(execute, "select", { table });
            return {
                select: builder.select.bind(builder),
                insert(values) {
                    const write = new QueryBuilder(execute, "insert", { table, values });
                    return write;
                },
                update(values) {
                    return new QueryBuilder(execute, "update", { table, values });
                },
                delete() {
                    return new QueryBuilder(execute, "delete", { table });
                },
                upsert: builder.upsert.bind(builder),
            };
        },
        rpc(fn, args) {
            return new QueryBuilder(execute, "rpc", { fn, args: args ?? {} });
        },
    };
    return client;
}
function attachDottedFilters(plan) {
    const keep = [];
    for (const filter of plan.filters) {
        const path = filter.column.split(".");
        if (path.length === 1) {
            keep.push(filter);
            continue;
        }
        if (path.some((part) => !isIdent(part)))
            throw new Error("invalid identifier");
        const column = path.pop();
        if (!column)
            throw new Error("invalid identifier");
        let fields = plan.fields;
        let embed = null;
        for (const relation of path) {
            embed = findDirectEmbed(fields, relation);
            if (!embed)
                throw new Error("invalid identifier");
            fields = embed.fields;
        }
        if (!embed)
            throw new Error("invalid identifier");
        embed.filters.push({ ...filter, column });
    }
    plan.filters = keep;
}
return { isIdent, quoteIdent, parseOrFilter, createPlanClient, attachDottedFilters };
})();
const { uploadCommunityMedia } = lib.upload;
const { createPlanClient } = lib.plan;
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
        if (value !== undefined && value !== null && value !== false)
            node.setAttribute(name, value === true ? "" : value);
    }
    node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
    return node;
};
const readDraft = () => {
    try {
        const saved = localStorage.getItem(DRAFT_KEY);
        return saved ? JSON.parse(saved) : null;
    }
    catch {
        return null;
    }
};
const persistDraft = (title, body) => {
    try {
        if (title.trim() || body.trim())
            localStorage.setItem(DRAFT_KEY, JSON.stringify({ title, body }));
        else
            localStorage.removeItem(DRAFT_KEY);
    }
    catch {
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
        preview: null,
    };
    let dragDepth = 0;
    let searchSeq = 0;
    let searchTimer = 0;
    let previewSeq = 0;
    const categoryTag = (category) => document.querySelector(`template[data-category-tag="${category}"]`)?.content.firstElementChild.cloneNode(true) ?? null;
    const memeText = (meme) => element("span", { class: "min-w-0 flex-1" }, element("span", { class: "block truncate text-sm font-bold" }, meme.title), element("span", { class: "block truncate text-xs text-muted" }, meme.summary));
    const renderMeme = () => {
        const parts = [memeLegend];
        if (state.meme) {
            const clear = element("button", { type: "button", "aria-label": "밈 첨부 해제", class: "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-surface-2" });
            clear.innerHTML = '<svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"></path></svg>';
            clear.addEventListener("click", () => {
                state.meme = null;
                renderMeme();
            });
            parts.push(element("div", { class: "mt-1.5 flex min-h-11 items-center gap-2.5 rounded-xl border border-accent bg-accent-soft/40 px-3 py-2" }, categoryTag(state.meme.category), memeText(state.meme), clear));
        }
        else {
            parts.push(search);
            if (search.value.trim()) {
                const items = [];
                if (state.searching)
                    items.push(element("li", { class: "px-3 py-3 text-sm text-muted" }, "검색 중…"));
                if (!state.searching && state.results !== null && state.results.length === 0) {
                    items.push(element("li", { class: "px-3 py-3 text-sm text-muted" }, "검색 결과가 없어요."));
                }
                if (!state.searching) {
                    for (const meme of state.results ?? []) {
                        const pick = element("button", { type: "button", class: "flex min-h-11 w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-surface-2" }, categoryTag(meme.category), memeText(meme));
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
        for (const tool of tools)
            tool.disabled = state.uploading || state.tab === "preview";
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
            if (!body.value.trim())
                panel.append(element("p", { class: "text-base text-muted" }, "미리 볼 내용이 없어요."));
            else if (state.preview !== null)
                panel.innerHTML = state.preview;
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
    async function loadPreview() {
        state.preview = null;
        render();
        const draft = body.value;
        if (!draft.trim())
            return;
        const seq = ++previewSeq;
        let html = null;
        try {
            const response = await fetch("/api/community/preview", {
                method: "POST",
                headers: { "content-type": "application/json" },
                credentials: "same-origin",
                body: JSON.stringify({ body: draft }),
            });
            if (response.ok)
                html = (await response.json()).html;
        }
        catch {
        }
        if (seq !== previewSeq || state.tab !== "preview")
            return;
        state.preview = html ?? '<p class="text-base text-muted">미리보기를 불러오지 못했어요.</p>';
        render();
    }
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
    function wrapSelection(prefix, suffix, placeholder) {
        const start = body.selectionStart;
        const end = body.selectionEnd;
        const current = body.value;
        const selected = current.slice(start, end) || placeholder;
        const next = current.slice(0, start) + prefix + selected + suffix + current.slice(end);
        if (next.length > BODY_MAX)
            return;
        body.value = next;
        persistDraft(title.value, next);
        render();
        requestAnimationFrame(() => {
            body.focus();
            body.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
        });
    }
    async function handleFiles(list) {
        if (list.length === 0 || state.uploading)
            return;
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
                }
                else {
                    const name = file.name.replace(/[[\]()]/g, "").trim() || "이미지";
                    insertAtCursor(`\n![${name}](${url})\n`);
                }
            }
        }
        finally {
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
                ({ data } = await createPlanClient(postPlan).rpc("search_memes", { p_query: query, p_limit: 5 }));
            }
            catch {
            }
            if (seq !== searchSeq)
                return;
            state.searching = false;
            state.results = (data ?? []).map((meme) => ({ id: meme.id, title: meme.title, summary: meme.summary, category: meme.category }));
            renderMeme();
        }, SEARCH_DELAY_MS);
    }
    const showError = () => {
        const template = document.querySelector("template[data-action-error]");
        const page = document.querySelector("main");
        if (!template || !page)
            return;
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
            if (state.tab === "preview")
                void loadPreview();
            else
                render();
        });
    }
    for (const tool of tools) {
        tool.addEventListener("click", () => {
            if (tool.dataset.postTool === "bold")
                wrapSelection("**", "**", "굵은 텍스트");
            else if (tool.dataset.postTool === "link")
                wrapSelection("[", "](https://)", "링크 텍스트");
            else
                files.click();
        });
    }
    files.addEventListener("change", () => {
        const picked = [...(files.files ?? [])];
        files.value = "";
        void handleFiles(picked);
    });
    editor.addEventListener("dragenter", (event) => {
        if (!event.dataTransfer?.types.includes("Files"))
            return;
        event.preventDefault();
        dragDepth += 1;
        state.dragOver = true;
        render();
    });
    editor.addEventListener("dragover", (event) => {
        if (event.dataTransfer?.types.includes("Files"))
            event.preventDefault();
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
        if (state.pending || state.uploading || title.value.trim().length < 2 || !body.value.trim())
            return;
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
        }
        catch {
            showError();
            return;
        }
        if (result.ok) {
            try {
                localStorage.removeItem(DRAFT_KEY);
            }
            catch {
            }
            location.assign(`/community/${result.data.postId}`);
            return;
        }
        state.pending = false;
        setNotice({ kind: "error", message: result.message, loginLink: result.error === "login_required" });
    });
    const draft = readDraft();
    if (draft?.title)
        title.value = draft.title;
    if (draft?.body)
        body.value = draft.body;
    render();
}
})();
