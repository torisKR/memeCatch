(() => {
"use strict";
const lib = {};
lib.memeArtifacts = (() => {
const IMAGE_PRESETS = {
    square: { label: "정사각형 1080", width: 1080, height: 1080 },
    vertical: { label: "세로 1080 × 1920", width: 1080, height: 1920 },
    landscape: { label: "가로 1200 × 630", width: 1200, height: 630 },
};
function sanitizeStudioText(value) {
    return value.replace(/[\u2013\u2014]/g, "-");
}
function drawWrappedText(context, text, centerX, startY, maxWidth, maxLines, fromBottom = false) {
    const sanitized = sanitizeStudioText(text);
    if (!sanitized.trim())
        return;
    const words = sanitized.trim().split(/\s+/);
    const lines = [];
    let line = "";
    for (const word of words) {
        const next = line ? `${line} ${word}` : word;
        if (context.measureText(next).width <= maxWidth || !line)
            line = next;
        else {
            lines.push(line);
            line = word;
        }
    }
    if (line)
        lines.push(line);
    const visible = lines.slice(0, maxLines);
    if (lines.length > maxLines)
        visible[maxLines - 1] = `${visible[maxLines - 1]}…`;
    const lineHeight = Number.parseInt(context.font, 10) * 1.16;
    visible.forEach((value, index) => {
        const y = fromBottom
            ? startY - (visible.length - 1 - index) * lineHeight
            : startY + index * lineHeight;
        context.strokeText(value, centerX, y);
        context.fillText(value, centerX, y);
    });
}
function fitCaptionFont(context, text, width, height) {
    let size = Math.round(Math.min(width, height) * 0.09);
    const minimum = Math.round(Math.min(width, height) * 0.045);
    while (size > minimum) {
        context.font = `900 ${size}px Arial, sans-serif`;
        if (context.measureText(text).width <= width * 1.8)
            break;
        size -= 4;
    }
    context.font = `900 ${size}px Arial, sans-serif`;
    context.lineWidth = Math.max(6, Math.round(size * 0.12));
}
function renderImageArtifact(canvas, image, preset, options) {
    const { width, height } = IMAGE_PRESETS[preset];
    const context = canvas.getContext("2d");
    if (!context)
        throw new Error("canvas_unavailable");
    canvas.width = width;
    canvas.height = height;
    const sourceWidth = "videoWidth" in image ? image.videoWidth : "naturalWidth" in image ? image.naturalWidth : width;
    const sourceHeight = "videoHeight" in image ? image.videoHeight : "naturalHeight" in image ? image.naturalHeight : height;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    const gradient = context.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, "rgba(0,0,0,.68)");
    gradient.addColorStop(0.28, "rgba(0,0,0,0)");
    gradient.addColorStop(0.72, "rgba(0,0,0,0)");
    gradient.addColorStop(1, "rgba(0,0,0,.72)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "#fff";
    context.strokeStyle = "#050505";
    context.lineJoin = "round";
    fitCaptionFont(context, `${options.topText} ${options.bottomText}`, width, height);
    drawWrappedText(context, options.topText, width / 2, height * 0.055, width * 0.9, 3);
    context.textBaseline = "bottom";
    drawWrappedText(context, options.bottomText, width / 2, height * 0.91, width * 0.9, 3, true);
    context.textAlign = "left";
    context.textBaseline = "bottom";
    context.font = `700 ${Math.max(20, Math.round(width * 0.022))}px Arial, sans-serif`;
    context.lineWidth = 4;
    const footer = options.attribution?.trim() ? `출처: ${sanitizeStudioText(options.attribution.trim())}  ·  밈캐치` : "밈캐치";
    context.strokeText(footer, width * 0.035, height * 0.975);
    context.fillText(footer, width * 0.035, height * 0.975);
}
function renderDictionaryCard(canvas, preset, input) {
    const { width, height } = IMAGE_PRESETS[preset];
    const context = canvas.getContext("2d");
    if (!context)
        throw new Error("canvas_unavailable");
    canvas.width = width;
    canvas.height = height;
    const gradient = context.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#241612");
    gradient.addColorStop(0.55, "#6a2b1d");
    gradient.addColorStop(1, "#d63c1b");
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
    context.fillStyle = "rgba(255,255,255,.1)";
    context.fillRect(width * 0.055, height * 0.07, width * 0.89, height * 0.86);
    context.textAlign = "left";
    context.textBaseline = "top";
    context.fillStyle = "#ffb19c";
    context.font = `800 ${Math.round(width * 0.035)}px Arial, sans-serif`;
    context.fillText("밈 사전", width * 0.09, height * 0.12);
    context.fillStyle = "#fff";
    context.strokeStyle = "rgba(0,0,0,.55)";
    context.lineJoin = "round";
    context.textAlign = "center";
    context.font = `900 ${Math.round(width * 0.075)}px Arial, sans-serif`;
    context.lineWidth = 6;
    drawWrappedText(context, input.name, width * 0.5, height * 0.23, width * 0.8, 2);
    context.textAlign = "center";
    context.font = `700 ${Math.round(width * 0.035)}px Arial, sans-serif`;
    context.lineWidth = 4;
    drawWrappedText(context, input.summary, width * 0.5, height * 0.43, width * 0.75, 4);
    context.fillStyle = "#ffb19c";
    context.font = `800 ${Math.round(width * 0.028)}px Arial, sans-serif`;
    context.fillText(`사용 안전: ${sanitizeStudioText(input.safety || "검수 필요")}`, width * 0.5, height * 0.72);
    context.fillStyle = "#fff";
    context.font = `600 ${Math.round(width * 0.021)}px Arial, sans-serif`;
    context.fillText(sanitizeStudioText(input.detailUrl), width * 0.5, height * 0.79);
    context.fillText(input.source ? `출처: ${sanitizeStudioText(input.source)}` : "출처: 밈캐치 편집 데이터", width * 0.5, height * 0.84);
    context.font = `900 ${Math.round(width * 0.028)}px Arial, sans-serif`;
    context.fillText("밈캐치", width * 0.5, height * 0.9);
}
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
}
return { IMAGE_PRESETS, sanitizeStudioText, renderImageArtifact, renderDictionaryCard, downloadBlob };
})();
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
lib.referenceSearch = (() => {
const FALLBACK_MESSAGE = "의미 검색이 준비되지 않아 이름·별칭 검색 결과를 보여드려요.";
const REASONS = new Set(["disabled", "model_unavailable", "index_empty", "rpc_unavailable"]);
const SHORT_ID = /^[a-zA-Z0-9]{1,32}$/;
const memePath = (item) => `/memes/${item.short_id}-${encodeURIComponent(item.slug)}`;
function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
}
function readResult(value) {
    const valid = value && typeof value === "object" && (value.mode === "hybrid" || value.mode === "keyword")
        && Array.isArray(value.items) && value.items.length <= 12
        && (value.reason === undefined || (typeof value.reason === "string" && REASONS.has(value.reason)));
    if (!valid)
        throw new Error("invalid_response");
    const items = value.items.map((row) => {
        const ok = row && typeof row === "object" && typeof row.id === "string" && row.id.trim()
            && typeof row.short_id === "string" && SHORT_ID.test(row.short_id)
            && typeof row.slug === "string" && row.slug.trim()
            && typeof row.title === "string" && row.title.trim() && typeof row.summary === "string";
        if (!ok)
            throw new Error("invalid_item");
        memePath(row);
        return row;
    });
    return { mode: value.mode, reason: value.reason, items };
}
function referenceSearch(section, initialQuery) {
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
        if (state.status === "pending")
            line("참고할 밈을 찾고 있어요.");
        if (state.status === "cancelled")
            line("검색을 취소했어요.");
        if (state.status === "ready" && state.result.mode === "keyword")
            line(FALLBACK_MESSAGE);
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
        if (button.disabled)
            return;
        const controller = new AbortController();
        request = controller;
        show({ status: "pending" });
        try {
            const response = await fetch("/api/memes/semantic-search", {
                method: "POST", headers: { "content-type": "application/json" },
                body: JSON.stringify({ query, limit: 12 }), cache: "no-store", signal: controller.signal,
            });
            if (!response.ok)
                throw new Error("request_failed");
            const value = await response.json();
            if (controller.signal.aborted || request !== controller)
                return;
            show({ status: "ready", result: readResult(value) });
        }
        catch {
            if (controller.signal.aborted || request !== controller)
                return;
            show({ status: "error" });
        }
        finally {
            if (request === controller)
                request = null;
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
return { referenceSearch };
})();
lib.dictionaryCard = (() => {
const { downloadBlob, renderDictionaryCard } = lib.memeArtifacts;
const CANVAS = "mx-auto max-h-[650px] w-full object-contain";
const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className)
        node.className = className;
    if (text !== undefined)
        node.textContent = text;
    return node;
};
function dictionaryCard(root, rights) {
    const field = (name) => root.querySelector(`[name="${name}"]`);
    const [renderButton, download] = root.querySelectorAll(".flex.flex-wrap.gap-2 > button");
    const names = ["dictionary-name", "dictionary-summary", "dictionary-safety", "dictionary-detail-url", "dictionary-source"];
    const detailUrl = field("dictionary-detail-url");
    const preset = field("artifact-preset");
    const canvas = root.querySelector("canvas");
    const placeholder = canvas.nextElementSibling;
    let rendered = false;
    const existing = detailUrl.closest("label").nextElementSibling;
    let urlError = existing?.matches('p[role="alert"]') ? existing : null;
    const show = () => {
        canvas.className = `${CANVAS} ${rendered ? "block" : "hidden"}`;
        if (rendered)
            placeholder.remove();
        else if (!placeholder.isConnected)
            canvas.after(placeholder);
    };
    const validUrl = () => {
        try {
            const parsed = new URL(detailUrl.value.trim());
            return parsed.protocol === "https:" && Boolean(parsed.hostname);
        }
        catch {
            return false;
        }
    };
    const data = () => ({
        name: field("dictionary-name").value,
        summary: field("dictionary-summary").value,
        safety: field("dictionary-safety").value,
        detailUrl: detailUrl.value,
        source: field("dictionary-source").value,
    });
    const ready = () => {
        const value = data();
        return value.name.trim().length > 0 && value.summary.trim().length > 0 && validUrl() && value.source.trim().length > 0;
    };
    const update = () => {
        const invalid = Boolean(detailUrl.value) && !validUrl();
        if (detailUrl.value)
            detailUrl.setAttribute("aria-invalid", String(invalid));
        else
            detailUrl.removeAttribute("aria-invalid");
        if (invalid && !urlError) {
            urlError = element("p", "text-sm text-accent-text", "https로 시작하는 올바른 주소를 입력해 주세요.");
            urlError.setAttribute("role", "alert");
            detailUrl.closest("label").after(urlError);
        }
        else if (!invalid && urlError) {
            urlError.remove();
            urlError = null;
        }
        renderButton.disabled = !rights.checked || !ready();
        download.disabled = !(rights.checked && rendered);
        show();
    };
    for (const name of names) {
        field(name).addEventListener("input", () => {
            rendered = false;
            update();
        });
    }
    preset.addEventListener("change", () => {
        rendered = false;
        update();
    });
    renderButton.addEventListener("click", () => {
        if (!rights.checked || !ready())
            return;
        renderDictionaryCard(canvas, preset.value, data());
        rendered = true;
        update();
    });
    download.addEventListener("click", () => canvas.toBlob((blob) => blob && downloadBlob(blob, "memecatch-dictionary-card.png"), "image/png"));
    update();
    return { root, update, dispose: () => { } };
}
return { dictionaryCard };
})();
const { downloadBlob, renderImageArtifact, sanitizeStudioText } = lib.memeArtifacts;
const { dictionaryCard } = lib.dictionaryCard;
const { validateUploadFile } = lib.upload;
const { referenceSearch } = lib.referenceSearch;
{
    const main = document.querySelector("main[data-studio]");
    if (main) {
        const COPIED_MS = 2000;
        const SELECTED = "border-accent bg-accent-strong text-white";
        const UNSELECTED = "border-border bg-surface text-muted hover:border-accent hover:text-accent";
        const WORKSPACE = "min-h-11 rounded-xl border px-4 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";
        const TONE = "min-h-11 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";
        const FORMAT = "inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
        const MODE = "min-h-11 rounded-full border px-4 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none";
        const CANVAS = "mx-auto max-h-[650px] w-full object-contain";
        const el = (tag, className, text) => {
            const node = document.createElement(tag);
            if (className)
                node.className = className;
            if (text !== undefined)
                node.textContent = text;
            return node;
        };
        const choose = (buttons, attribute, value, base, hint) => {
            for (const button of buttons) {
                const active = button.getAttribute(attribute) === value;
                button.setAttribute("aria-pressed", String(active));
                button.className = `${base} ${active ? SELECTED : UNSELECTED}`;
                const small = hint ? button.querySelectorAll("span")[1] : null;
                if (small)
                    small.className = `block text-xs ${active ? hint[0] : hint[1]}`;
            }
        };
        const workspaces = main.querySelectorAll("[data-studio-workspace]");
        for (const button of workspaces) {
            button.addEventListener("click", () => {
                const value = button.dataset.studioWorkspace;
                choose(workspaces, "data-studio-workspace", value, WORKSPACE, ["text-white/85", "text-muted"]);
                for (const other of workspaces) {
                    document.getElementById(`studio-workspace-${other.dataset.studioWorkspace}`).hidden = other !== button;
                }
            });
        }
        const topic = main.querySelector("#studio-topic");
        const generateButton = main.querySelector("[data-studio-generate]");
        const results = main.querySelector("[data-studio-results]");
        const tones = main.querySelectorAll("[data-studio-tone]");
        const formats = main.querySelectorAll("[data-studio-format]");
        const reference = referenceSearch(main.querySelector("[data-studio-reference]"), "");
        let tone = [...tones].find((button) => button.getAttribute("aria-pressed") === "true").dataset.studioTone;
        let format = [...formats].find((button) => button.getAttribute("aria-pressed") === "true").dataset.studioFormat;
        let loading = false;
        let errorMsg = null;
        let result = null;
        let copyState = null;
        let heading = null;
        let referenceQuery = "";
        const emptyState = results.firstElementChild;
        for (const button of tones) {
            button.addEventListener("click", () => {
                tone = button.dataset.studioTone;
                choose(tones, "data-studio-tone", tone, TONE, ["text-white/80", ""]);
            });
        }
        for (const button of formats) {
            button.addEventListener("click", () => {
                format = button.dataset.studioFormat;
                choose(formats, "data-studio-format", format, FORMAT);
            });
        }
        const canSubmit = () => topic.value.trim().length >= 2 && !loading;
        const headingText = () => `“${sanitizeStudioText(topic.value.trim())}” 게시물 아이디어 ${result.concepts.length}개`;
        function renderButton() {
            generateButton.disabled = !canSubmit();
            generateButton.textContent = loading ? "아이디어를 만드는 중입니다" : "밈 아이디어 만들기";
        }
        function renderResults() {
            results.setAttribute("aria-busy", String(loading));
            results.replaceChildren();
            heading = null;
            if (errorMsg) {
                const alert = el("p", "rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm font-medium text-accent-text", errorMsg);
                alert.setAttribute("role", "alert");
                results.append(alert);
            }
            if (loading) {
                for (let index = 0; index < 3; index += 1) {
                    const bone = el("div", "mt-3 h-40 animate-pulse rounded-xl border border-border bg-surface-2 motion-reduce:animate-none");
                    bone.setAttribute("aria-hidden", "true");
                    results.append(bone);
                }
            }
            if (!loading && result) {
                const head = el("div", "flex items-center justify-between gap-3");
                heading = el("h2", "text-lg font-extrabold tracking-tight", headingText());
                head.append(heading, el("span", "shrink-0 rounded-full border border-accent bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-text", result.mode === "ai" ? "Ox Alpha 생성" : "기본 템플릿"));
                results.append(head);
                result.concepts.forEach((concept, index) => results.append(article(concept, index)));
            }
            if (!loading && !result && !errorMsg)
                results.append(emptyState);
        }
        function article(concept, index) {
            const node = el("article", "mt-4 overflow-hidden rounded-xl border border-border bg-surface p-5");
            node.append(el("p", "text-sm font-bold text-accent", sanitizeStudioText(concept.headline)));
            node.append(el("blockquote", "mt-2 rounded-xl bg-accent-soft px-4 py-3 text-base font-extrabold leading-relaxed text-foreground", `“${sanitizeStudioText(concept.caption)}”`));
            const list = el("dl", "mt-3 space-y-1.5 text-sm leading-relaxed text-muted");
            for (const [term, value] of [["포인트:", concept.why_it_works], ["활용:", concept.usage_context]]) {
                const row = el("div", "flex gap-2");
                row.append(el("dt", "shrink-0 font-bold text-foreground", term), el("dd", "", sanitizeStudioText(value)));
                list.append(row);
            }
            node.append(list);
            const copy = el("button", "mt-4 inline-flex min-h-11 items-center rounded-full border border-border bg-background px-4 text-sm font-semibold text-muted transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none");
            copy.type = "button";
            copy.setAttribute("aria-live", "polite");
            const label = () => {
                copy.textContent = copyState?.index === index ? (copyState.ok ? "문구를 복사했어요" : "복사 실패, 다시 시도") : "문구 복사";
            };
            label();
            copy.addEventListener("click", async () => {
                const ok = await copyText(sanitizeStudioText(concept.caption));
                copyState = { index, ok };
                results.querySelectorAll("article button").forEach((button) => button.dispatchEvent(new Event("studio-copy")));
                setTimeout(() => {
                    if (copyState?.index === index)
                        copyState = null;
                    results.querySelectorAll("article button").forEach((button) => button.dispatchEvent(new Event("studio-copy")));
                }, COPIED_MS);
            });
            copy.addEventListener("studio-copy", label);
            node.append(copy);
            return node;
        }
        async function copyText(text) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            }
            catch {
                try {
                    const area = document.createElement("textarea");
                    area.value = text;
                    area.setAttribute("readonly", "");
                    area.style.position = "fixed";
                    area.style.opacity = "0";
                    document.body.appendChild(area);
                    area.select();
                    const ok = document.execCommand("copy");
                    document.body.removeChild(area);
                    return ok;
                }
                catch {
                    return false;
                }
            }
        }
        const errorMessage = (status) => {
            if (status === 429)
                return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
            if (status === 400)
                return "토픽과 선택 항목을 확인해 주세요.";
            return "아이디어를 만들지 못했습니다. 잠시 후 다시 시도해 주세요.";
        };
        async function generate() {
            if (!canSubmit())
                return;
            loading = true;
            errorMsg = null;
            renderButton();
            renderResults();
            try {
                const response = await fetch("/api/meme-studio", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ topic: topic.value.trim(), tone, format }),
                });
                const payload = await response.json().catch(() => null);
                if (!response.ok || !payload || "error" in payload) {
                    errorMsg = errorMessage(response.status);
                    return;
                }
                result = payload;
                copyState = null;
            }
            catch {
                errorMsg = "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
            }
            finally {
                loading = false;
                renderButton();
                renderResults();
            }
        }
        topic.addEventListener("input", () => {
            renderButton();
            if (heading)
                heading.textContent = headingText();
            const query = topic.value.trim();
            if (query !== referenceQuery) {
                referenceQuery = query;
                reference.reset(query);
            }
        });
        topic.addEventListener("keydown", (event) => {
            if (event.key === "Enter" && !event.isComposing && event.keyCode !== 229)
                void generate();
        });
        generateButton.addEventListener("click", () => void generate());
        const studio = main.querySelector("#studio-workspace-artifacts section");
        const rights = studio.querySelector('input[name="rights-confirmed"]');
        const rightsNote = studio.querySelector('p[role="status"]');
        const modes = studio.querySelectorAll("[data-studio-mode]");
        const templates = {
            image: studio.querySelector("[data-studio-artifact]").cloneNode(true),
            dictionary: studio.querySelector("template[data-studio-dictionary]").content.firstElementChild,
        };
        let mode = "image";
        let artifact = start("image", studio.querySelector("[data-studio-artifact]"));
        rights.addEventListener("change", () => {
            if (rights.checked)
                rightsNote.remove();
            else
                rights.closest("label").after(rightsNote);
            artifact.update();
        });
        for (const button of modes) {
            button.addEventListener("click", () => {
                const next = button.dataset.studioMode;
                choose(modes, "data-studio-mode", next, MODE);
                if (next === mode)
                    return;
                mode = next;
                const fresh = templates[next].cloneNode(true);
                artifact.root.replaceWith(fresh);
                artifact.dispose();
                artifact = start(next, fresh);
            });
        }
        function start(kind, root) {
            return kind === "image" ? imageArtifact(root) : dictionaryArtifact(root);
        }
        function field(root, name) {
            return root.querySelector(`[name="${name}"]`);
        }
        function buttonsOf(root) {
            return root.querySelectorAll(".flex.flex-wrap.gap-2 > button");
        }
        function output(root) {
            const canvas = root.querySelector("canvas");
            const placeholder = canvas.nextElementSibling;
            return {
                canvas,
                show(rendered) {
                    canvas.className = `${CANVAS} ${rendered ? "block" : "hidden"}`;
                    if (rendered)
                        placeholder.remove();
                    else if (!placeholder.isConnected)
                        canvas.after(placeholder);
                },
            };
        }
        function imageArtifact(root) {
            const [renderButton, download] = buttonsOf(root);
            const file = field(root, "image-file");
            const attribution = field(root, "image-attribution");
            const preset = field(root, "artifact-preset");
            const view = output(root);
            let image = null;
            let imageReady = false;
            let rendered = false;
            let url = null;
            let fileError = null;
            const update = () => {
                const attributed = Boolean(attribution.value.trim());
                renderButton.disabled = !rights.checked || !imageReady || !attributed;
                download.disabled = !(rights.checked && attributed && rendered);
                view.show(rendered);
            };
            const stale = () => {
                rendered = false;
                update();
            };
            file.addEventListener("change", () => {
                const next = file.files?.[0] ?? null;
                const error = next ? validateUploadFile(next) : null;
                fileError?.remove();
                fileError = null;
                if (error) {
                    fileError = el("p", "text-sm text-(--accent-text)", error);
                    fileError.setAttribute("role", "alert");
                    file.closest("label").after(fileError);
                }
                if (url)
                    URL.revokeObjectURL(url);
                url = error || !next ? null : URL.createObjectURL(next);
                imageReady = false;
                rendered = false;
                update();
                if (!url)
                    return;
                const loaded = new Image();
                loaded.onload = () => {
                    image = loaded;
                    imageReady = true;
                    update();
                };
                loaded.src = url;
            });
            for (const name of ["image-top-text", "image-bottom-text", "image-attribution"])
                field(root, name).addEventListener("input", stale);
            preset.addEventListener("change", stale);
            renderButton.addEventListener("click", () => {
                if (!rights.checked || !attribution.value.trim() || !image)
                    return;
                renderImageArtifact(view.canvas, image, preset.value, {
                    topText: field(root, "image-top-text").value,
                    bottomText: field(root, "image-bottom-text").value,
                    attribution: attribution.value,
                });
                rendered = true;
                update();
            });
            download.addEventListener("click", () => view.canvas.toBlob((blob) => blob && downloadBlob(blob, "memecatch-meme.png"), "image/png"));
            return {
                root,
                update,
                dispose: () => url && URL.revokeObjectURL(url),
            };
        }
        function dictionaryArtifact(root) {
            return dictionaryCard(root, rights);
        }
    }
}
})();
