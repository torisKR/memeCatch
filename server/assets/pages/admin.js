(() => {
"use strict";
const lib = {};
lib.adminTranslations = (() => {
const FLASH = "memecatch-admin-translation-flash";
const LANGUAGE_NAMES = { en: "English", ja: "日本語", zh: "中文(简体)", "zh-tw": "中文(繁體)" };
const AI_RECOMMENDATION_COPY = { approve: "발행 가능", edit: "교정 후 발행", reject: "발행 보류" };
const RECOMMENDATION_COPY = { approve: "발행 가능", edit: "수정 후 검토", reject: "발행 보류" };
const CONFIDENCE_COPY = { high: "높음", medium: "보통", low: "낮음" };
const DELETE_CLASS = "min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-50";
const here = () => `${location.pathname}${location.search}`;
const keep = (state) => {
    try {
        sessionStorage.setItem(FLASH, JSON.stringify({ ...state, path: here() }));
    }
    catch {
    }
};
const takeKept = () => {
    try {
        const kept = JSON.parse(sessionStorage.getItem(FLASH) ?? "null");
        sessionStorage.removeItem(FLASH);
        return kept && kept.path === here() ? kept : null;
    }
    catch {
        return null;
    }
};
function translationComponents({ post, element }) {
    const kept = takeKept();
    const translationReview = (root) => {
        const body = JSON.parse(root.dataset.adminBody);
        const fresh = root.dataset.adminFresh === "true";
        const field = (name) => root.querySelector(`[data-admin-field="${name}"]`);
        const button = (name) => root.querySelector(`[data-admin-action="${name}"]`);
        const [gpt, approve, reject, remove] = ["gpt", "approve", "reject", "delete"].map(button);
        const configured = !gpt.disabled;
        const name = LANGUAGE_NAMES[body.locale];
        let pending = false;
        let reviewing = false;
        let confirming = false;
        const say = (ok, text) => {
            root.querySelector(":scope > [data-admin-message]")?.remove();
            if (text === null)
                return;
            const message = element("p", `rounded-lg px-3 py-2.5 text-sm font-semibold ${ok ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`, text);
            message.dataset.adminMessage = "";
            message.setAttribute("role", ok ? "status" : "alert");
            root.firstElementChild.after(message);
        };
        const sync = () => {
            const busy = pending || reviewing;
            gpt.disabled = busy || !configured;
            gpt.textContent = reviewing ? "GPT 검수 중…" : "GPT-5.6 Sol high 검수";
            approve.disabled = busy || !fresh;
            approve.textContent = busy ? "처리 중…" : "승인·발행";
            reject.disabled = busy;
            remove.disabled = busy;
            remove.className = `${DELETE_CLASS} ${confirming ? "border-safety-red bg-safety-red-bg text-safety-red" : "border-border bg-surface-2 text-muted"}`;
            remove.textContent = confirming ? "정말 삭제할까요? 다시 클릭" : "삭제";
        };
        const run = async (action, payload, done, reload) => {
            say(true, null);
            pending = true;
            sync();
            const result = await post(action, payload);
            if (result === null)
                return false;
            if (!result.ok) {
                pending = false;
                sync();
                say(false, result.error ?? "처리하지 못했어요.");
                return false;
            }
            if (reload) {
                keep({ key: root.dataset.adminKey, ok: true, text: done });
                location.reload();
                return true;
            }
            pending = false;
            sync();
            say(true, done);
            return true;
        };
        approve.addEventListener("click", () => {
            void run("translation-review", {
                ...body,
                title: field("title").value,
                summary: field("summary").value,
                description: field("description").value,
                origin: field("origin").value,
                usageNote: field("usageNote").value,
                caution: field("caution").value,
                aliases: field("aliases").value.split(",").map((alias) => alias.trim()).filter(Boolean),
            }, `${name} 번역을 승인하고 발행했어요.`, true);
        });
        gpt.addEventListener("click", async () => {
            say(true, null);
            reviewing = true;
            sync();
            try {
                const result = await post("translation-gpt-review", body);
                if (result === null)
                    return;
                if (!result.ok) {
                    say(false, result.error);
                    return;
                }
                const draft = result.data;
                const fill = (key, value) => {
                    if (value !== undefined && value !== null)
                        field(key).value = String(value);
                };
                fill("title", draft.title);
                fill("summary", draft.summary);
                fill("description", draft.description);
                fill("origin", draft.origin);
                fill("usageNote", draft.usage_note);
                fill("caution", draft.caution);
                fill("aliases", draft.aliases.join(", "));
                const notes = draft.review_notes.slice(0, 2).join(" · ");
                say(true, `GPT 검수 의견: ${AI_RECOMMENDATION_COPY[draft.recommendation]} · 신뢰도 ${draft.confidence}${notes ? ` · ${notes}` : ""}`);
            }
            finally {
                reviewing = false;
                sync();
            }
        });
        reject.addEventListener("click", async () => {
            const reason = field("reason");
            if (!reason.value.trim()) {
                say(false, "반려 사유를 입력해 주세요.");
                return;
            }
            if (await run("translation-reject", { ...body, reason: reason.value }, "반려 사유를 감사 로그에 기록했어요.", false))
                reason.value = "";
        });
        remove.addEventListener("click", () => {
            if (!confirming) {
                confirming = true;
                sync();
                return;
            }
            void run("translation-delete", body, `${name} 번역을 삭제했어요.`, true);
        });
        if (kept && kept.key === root.dataset.adminKey)
            say(kept.ok, kept.text);
    };
    const missingTranslation = (root) => {
        const locale = root.dataset.adminLocale;
        if (!locale)
            return;
        const rows = JSON.parse(root.dataset.adminRows);
        const lane = locale === "zh";
        const items = [...root.querySelectorAll("li[data-admin-meme]")];
        let active = items.find((item) => item.querySelector("[data-admin-active]"))?.dataset.adminMeme ?? null;
        let loading = null;
        let saving = false;
        let error = root.querySelector("[data-admin-error]")?.textContent ?? null;
        let saved = null;
        let preview = null;
        let form = null;
        const showError = () => {
            root.querySelector("[data-admin-error]")?.remove();
            if (error === null)
                return;
            const alert = element("p", "mt-4 rounded-xl border border-safety-red/30 bg-safety-red-bg p-4 text-sm text-safety-red", error);
            alert.dataset.adminError = "";
            alert.setAttribute("role", "alert");
            root.querySelector("[data-admin-list]")?.before(alert);
        };
        const showRows = () => {
            for (const item of items) {
                const id = item.dataset.adminMeme;
                const on = lane && active === id;
                item.className = `flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 ${on ? "border-accent bg-accent-soft/10" : "border-border bg-surface-2"}`;
                item.dataset.translationOperatorActive = on ? "true" : "false";
                const badge = item.querySelector("[data-admin-active]");
                if (on && !badge) {
                    const span = element("span", "mt-2 inline-flex rounded-full bg-surface px-2 py-1 text-xs font-semibold text-accent-text", "현재 후보");
                    span.dataset.adminActive = "";
                    item.firstElementChild.append(span);
                }
                else if (!on)
                    badge?.remove();
                const go = item.querySelector("button");
                go.disabled = loading !== null;
                go.textContent = loading === id ? "GPT-5.6 Sol high 생성 중…" : "GPT-5.6 Sol high로 미리보기";
            }
        };
        const previewField = (label, value) => {
            const box = element("div");
            box.append(element("dt", "text-xs font-semibold uppercase tracking-wide text-muted", label), element("dd", "mt-1 whitespace-pre-wrap text-sm leading-relaxed", value || "—"));
            return box;
        };
        const textList = (values) => (values.length > 0 ? values.join(", ") : "—");
        const draftField = (label, key, multiline) => {
            const box = element("label", "block");
            box.append(element("span", "mb-1 block text-xs font-semibold uppercase tracking-wide text-muted", label));
            const input = multiline ? element("textarea", "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm leading-relaxed") : element("input", "min-h-11 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm");
            if (multiline)
                input.rows = 4;
            input.value = key === "aliases" ? form.aliases.join("\n") : form[key];
            input.addEventListener("input", () => {
                if (key !== "aliases") {
                    form = { ...form, [key]: input.value };
                    return;
                }
                form = { ...form, aliases: input.value.split(/[\n,]/).map((alias) => alias.trim()).filter(Boolean) };
                input.value = form.aliases.join("\n");
            });
            box.append(input);
            return box;
        };
        const saveButton = () => {
            const button = element("button", "mt-5 min-h-11 rounded-lg bg-accent-strong px-5 py-2 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60", "검수 대기 초안 저장");
            button.type = "button";
            button.addEventListener("click", () => void save(button));
            return button;
        };
        const previewArticle = () => {
            const { draft, row } = preview;
            const article = element("article", "mt-5 rounded-xl border border-accent/30 bg-background p-5");
            article.setAttribute("aria-labelledby", "translation-draft-preview-result-title");
            const title = element("h3", "text-lg font-bold", `${row.title} 번역 초안 미리보기`);
            title.id = "translation-draft-preview-result-title";
            const list = element("dl", "mt-4 grid gap-4 lg:grid-cols-2");
            list.append(previewField("title", draft.title), previewField("summary", draft.summary), previewField("description", draft.description), previewField("origin", draft.origin), previewField("usage_note", draft.usage_note), previewField("caution", draft.caution), previewField("aliases", textList(draft.aliases)), previewField("recommendation", `${RECOMMENDATION_COPY[draft.recommendation]} (${draft.recommendation})`), previewField("confidence", `${CONFIDENCE_COPY[draft.confidence]} (${draft.confidence})`), previewField("review_notes", textList(draft.review_notes)));
            article.append(title, element("p", "mt-2 rounded-lg bg-safety-yellow-bg px-3 py-2.5 text-sm font-semibold leading-relaxed text-safety-yellow", "이 미리보기는 저장되거나 발행되지 않았습니다. 반드시 사람이 검토해야 합니다."), list);
            if (form) {
                const editor = element("div", "mt-6 rounded-xl border border-border bg-surface-2 p-4");
                const fields = element("div", "mt-4 grid gap-4 lg:grid-cols-2");
                fields.append(draftField("title", "title", false), draftField("summary", "summary", true), draftField("description", "description", true), draftField("origin", "origin", true), draftField("usage_note", "usage_note", true), draftField("caution", "caution", true), draftField("aliases", "aliases", true));
                editor.append(element("h4", "text-base font-bold", "운영자 편집본"), element("p", "mt-1 text-sm leading-relaxed text-muted", "내용을 직접 다듬은 뒤 저장해야 기존 machine 검수 큐에 들어갑니다."), fields, saveButton());
                article.append(editor);
            }
            return article;
        };
        const render = () => {
            showError();
            showRows();
            root.querySelectorAll(":scope > [data-admin-after]").forEach((node) => node.remove());
            const after = [];
            if (loading) {
                const status = element("p", "mt-4 text-sm font-semibold text-accent-text", "GPT-5.6 Sol high가 읽기 전용 번역 초안을 만들고 있어요.");
                status.setAttribute("role", "status");
                after.push(status);
            }
            if (preview)
                after.push(previewArticle());
            if (saved) {
                const note = element("p", "mt-4 rounded-lg bg-accent-soft px-3 py-2.5 text-sm font-semibold text-accent-text", saved);
                note.setAttribute("role", "status");
                after.push(note);
            }
            for (const node of after) {
                node.dataset.adminAfter = "";
                root.append(node);
            }
        };
        const request = async (row) => {
            if (loading)
                return;
            error = null;
            saved = null;
            preview = null;
            form = null;
            active = row.memeId;
            loading = row.memeId;
            render();
            try {
                const result = await post("translation-preview", { memeId: row.memeId, locale, expectedSourceUpdatedAt: row.updatedAt });
                if (result === null)
                    return;
                if (!result.ok) {
                    error = result.error;
                    return;
                }
                const { draft, sourceUpdatedAt } = result.data;
                preview = { row, draft, sourceUpdatedAt };
                form = { title: draft.title, summary: draft.summary, description: draft.description, origin: draft.origin, usage_note: draft.usage_note, caution: draft.caution, aliases: draft.aliases };
            }
            catch (caught) {
                error = caught instanceof Error ? caught.message : "번역 초안 미리보기를 만들지 못했어요.";
            }
            finally {
                loading = null;
                render();
            }
        };
        const save = async (button) => {
            if (!preview || !form || saving)
                return;
            error = null;
            saved = null;
            showError();
            root.querySelectorAll(":scope > [data-admin-after][role=status]").forEach((node) => node.remove());
            saving = true;
            button.disabled = true;
            button.textContent = "검수 대기 초안 저장 중…";
            const result = await post("translation-draft", {
                memeId: preview.row.memeId,
                locale,
                expectedSourceUpdatedAt: preview.sourceUpdatedAt,
                title: form.title,
                summary: form.summary,
                description: form.description,
                origin: form.origin,
                usageNote: form.usage_note,
                caution: form.caution,
                aliases: form.aliases,
            });
            if (result === null)
                return;
            saving = false;
            if (!result.ok) {
                error = result.error;
                button.disabled = false;
                button.textContent = "검수 대기 초안 저장";
                showError();
                return;
            }
            let state;
            if (lane) {
                const index = rows.findIndex((row) => row.memeId === preview.row.memeId);
                const next = index >= 0 ? rows[index + 1] : undefined;
                state = {
                    active: next?.memeId ?? null,
                    saved: next
                        ? `machine 초안을 저장했어요. 공개 발행은 아직 되지 않았습니다. 다음 후보: ${next.title}`
                        : "machine 초안을 저장했어요. 공개 발행은 아직 되지 않았습니다. 이 배치의 후보를 모두 처리했어요.",
                    preview: null,
                    form: null,
                };
            }
            else {
                state = { active, saved: "machine 초안을 검수 큐에 저장했어요. 공개 발행은 아직 되지 않았습니다.", preview, form };
            }
            keep({ key: "missing-translation", ...state });
            location.reload();
        };
        for (const item of items) {
            const row = rows.find((each) => each.memeId === item.dataset.adminMeme);
            item.querySelector("button").addEventListener("click", () => void request(row));
        }
        if (kept && kept.key === "missing-translation") {
            ({ active, saved, preview, form } = kept);
            render();
        }
    };
    return { "translation-review": translationReview, "missing-translation": missingTranslation };
}
return { translationComponents };
})();
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
lib.adminMemes = (() => {
const { sanitizeStudioText } = lib.memeArtifacts;
const STUDIO = "/api/admin/meme-studio";
function memeComponents({ post, element }) {
    const houseOriginal = (form) => {
        const countries = JSON.parse(form.dataset.adminCountries);
        const field = (name) => form.querySelector(`[data-admin-field="${name}"]`);
        const studio = form.querySelector("[data-admin-studio]");
        const generate = studio.querySelector("[data-admin-generate]");
        const submitButton = form.querySelector("button[type=submit]");
        const studioFields = ["topic", "country", "tone", "format"].map(field);
        let pending = false;
        let loading = false;
        let result = null;
        let selected = null;
        let saving = null;
        let studioError = null;
        const showError = (text) => {
            form.querySelector(":scope > [data-admin-error]")?.remove();
            if (text === null)
                return;
            const alert = element("p", "rounded-lg bg-safety-red-bg p-3 text-base text-safety-red", text);
            alert.dataset.adminError = "";
            alert.setAttribute("role", "alert");
            studio.after(alert);
        };
        const sync = () => {
            generate.disabled = field("topic").value.trim().length < 2 || loading;
            generate.textContent = loading ? "초안 만드는 중…" : "자체 밈 초안 3개 만들기";
            for (const each of studioFields)
                each.disabled = loading;
            submitButton.disabled = pending;
            submitButton.textContent = pending ? "저장 중…" : "대기로 저장";
        };
        const usageContext = () => Object.fromEntries(["work", "friends", "family", "sns"].map((key) => [key, field(key).value]));
        const conceptInput = (concept) => {
            const topic = sanitizeStudioText(field("topic").value.trim());
            const label = countries[concept.country_code] ?? countries[field("country").value];
            return {
                title: sanitizeStudioText(concept.headline).replace(/\s+/g, " ").trim(),
                summary: sanitizeStudioText(concept.caption).replace(/\s+/g, " ").trim(),
                description: `현지 맥락: ${sanitizeStudioText(concept.cultural_anchor).trim()}\n\n비주얼: ${sanitizeStudioText(concept.visual_brief).trim()}\n\n왜 통하나요? ${sanitizeStudioText(concept.why_it_works).trim()}\n\n추천 활용: ${sanitizeStudioText(concept.usage_context).trim()}`,
                origin: `밈캐치가 ${label}의 "${topic}" 주제로 문구를 자체 기획해 만든 밈입니다. 외부 SNS 원본이나 제3자 미디어를 사용하지 않았습니다.`,
                country: concept.country_code,
                localTitle: sanitizeStudioText(concept.local_caption).replace(/\s+/g, " ").trim(),
                safetyLevel: "yellow",
                category: field("format").value === "caption" ? "phrase" : "image",
                difficulty: "normal",
                originYear: new Date().getFullYear(),
                usageContext: usageContext(),
            };
        };
        const renderStudio = () => {
            studio.querySelectorAll(":scope > [data-admin-after]").forEach((node) => node.remove());
            const after = [];
            if (studioError) {
                const alert = element("p", "rounded-lg bg-safety-red-bg p-3 text-sm text-safety-red", studioError);
                alert.setAttribute("role", "alert");
                after.push(alert);
            }
            if (result) {
                const box = element("div", "space-y-3");
                box.setAttribute("aria-live", "polite");
                const grid = element("div", "grid gap-3 lg:grid-cols-3");
                result.concepts.forEach((concept, index) => grid.append(conceptCard(concept, index)));
                box.append(element("p", "text-sm font-semibold text-accent-text", result.mode === "ai" && result.provider === "bedrock" ? "AWS Bedrock 초안" : "$0 기본 템플릿 초안"), grid);
                after.push(box);
            }
            for (const node of after) {
                node.dataset.adminAfter = "";
                studio.append(node);
            }
        };
        const save = async (input, onFailure) => {
            pending = true;
            sync();
            renderStudio();
            const answer = await post("house-original", input);
            if (answer === null)
                return;
            if (!answer.ok) {
                pending = false;
                onFailure?.();
                sync();
                renderStudio();
                showError(answer.error);
                return;
            }
            location.assign(`/admin/memes/${answer.data?.memeId}`);
        };
        const conceptCard = (concept, index) => {
            const card = element("article", `rounded-lg border bg-surface p-3 ${selected === index ? "border-accent" : "border-border"}`);
            const headline = sanitizeStudioText(concept.headline);
            const labelled = (label, text, className) => {
                const line = element("p", className);
                line.append(element("strong", "", label), ` ${text}`);
                return line;
            };
            card.append(element("h3", "font-bold", headline), element("p", "mt-1 text-xs font-semibold text-accent-text", countries[concept.country_code] ?? concept.country_code), element("p", "mt-2 whitespace-pre-line text-sm leading-relaxed", sanitizeStudioText(concept.caption)), labelled("현지 문구:", sanitizeStudioText(concept.local_caption), "mt-2 text-sm leading-relaxed"), labelled("현지 맥락:", sanitizeStudioText(concept.cultural_anchor), "mt-2 text-xs leading-relaxed text-muted"), labelled("비주얼:", sanitizeStudioText(concept.visual_brief), "mt-2 text-xs leading-relaxed text-muted"), element("p", "mt-2 text-xs leading-relaxed text-muted", sanitizeStudioText(concept.why_it_works)));
            const buttons = element("div", "mt-3 grid gap-2");
            const direct = element("button", "min-h-11 rounded-lg bg-accent-strong px-3 text-sm font-semibold text-white disabled:opacity-50", saving === index ? "대기로 저장 중…" : "대기로 바로 저장");
            direct.type = "button";
            direct.disabled = pending;
            direct.setAttribute("aria-label", `“${headline}” 대기로 바로 저장`);
            direct.addEventListener("click", () => {
                showError(null);
                saving = index;
                void save(conceptInput(concept), () => {
                    saving = null;
                });
            });
            const apply = element("button", "min-h-11 rounded-lg border border-accent px-3 text-sm font-semibold text-accent-text disabled:opacity-50", selected === index ? "아래 항목에 적용됨" : "수정 후 저장");
            apply.type = "button";
            apply.disabled = pending;
            apply.setAttribute("aria-label", `“${headline}” 초안 사용`);
            apply.addEventListener("click", () => {
                const input = conceptInput(concept);
                for (const key of ["title", "summary", "description", "origin"])
                    field(key).value = input[key];
                field("originYear").value = String(input.originYear);
                field("category").value = input.category;
                selected = index;
                showError(null);
                renderStudio();
            });
            buttons.append(direct, apply);
            card.append(buttons);
            return card;
        };
        const reset = () => {
            result = null;
            selected = null;
            studioError = null;
            renderStudio();
            sync();
        };
        for (const each of studioFields)
            each.addEventListener(each.tagName === "INPUT" ? "input" : "change", reset);
        generate.addEventListener("click", async () => {
            const topic = field("topic").value.trim();
            if (topic.length < 2 || loading)
                return;
            loading = true;
            studioError = null;
            sync();
            renderStudio();
            try {
                const response = await fetch(STUDIO, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ topic, tone: field("tone").value, format: field("format").value, country: field("country").value }),
                });
                const payload = await response.json().catch(() => null);
                if (!response.ok || !payload || "error" in payload) {
                    studioError = response.status === 429 ? "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." : "초안을 만들지 못했습니다. 입력을 확인하고 다시 시도해 주세요.";
                    return;
                }
                result = payload;
                selected = null;
            }
            catch {
                studioError = "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
            }
            finally {
                loading = false;
                sync();
                renderStudio();
            }
        });
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            showError(null);
            const raw = field("originYear").value.trim();
            const year = raw ? Number(raw) : null;
            if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
                showError("제작 연도는 1980~2100 사이 숫자로 입력해 주세요.");
                return;
            }
            const title = field("title").value;
            void save({
                title,
                summary: field("summary").value,
                description: field("description").value,
                origin: field("origin").value,
                safetyLevel: field("safetyLevel").value,
                category: field("category").value,
                difficulty: field("difficulty").value,
                originYear: year,
                usageContext: usageContext(),
                country: field("country").value,
                localTitle: selected === null ? title : result?.concepts[selected]?.local_caption ?? title,
            });
        });
    };
    const catalog = (form) => {
        const field = (scope, name) => scope.querySelector(`[data-admin-field="${name}"]`);
        const sourcesSection = form.querySelector("[data-admin-sources]");
        const addButton = sourcesSection.querySelector("[data-admin-add]");
        const checkButton = form.querySelector("[data-admin-check]");
        const submitButton = form.querySelector("button[type=submit]");
        const fieldsets = () => [...sourcesSection.querySelectorAll("fieldset[data-admin-source]")];
        let pending = false;
        let message = null;
        let duplicates = [];
        let checked = null;
        let registrationKey = null;
        const fingerprint = () => JSON.stringify([field(form, "title").value.trim(), ...fieldsets().map((set) => field(set, "url").value.trim())]);
        const render = () => {
            form.querySelectorAll(":scope > [data-admin-after-intro]").forEach((node) => node.remove());
            const intro = form.firstElementChild;
            const nodes = [];
            if (message) {
                const note = element("p", "rounded-lg border border-border bg-surface-2 p-3 text-sm", message);
                note.setAttribute("role", "status");
                nodes.push(note);
            }
            if (duplicates.length > 0) {
                const list = element("ul", "space-y-2 rounded-xl border border-safety-yellow bg-safety-yellow-bg p-4");
                list.setAttribute("aria-label", "중복 후보");
                for (const match of duplicates) {
                    const item = element("li", "text-sm");
                    const link = element("a", "font-semibold underline", match.title);
                    link.href = `/admin/memes/${match.memeId}`;
                    item.append(link, ` · ${match.reason === "title" ? "제목 일치" : "출처 URL 일치"}`);
                    list.append(item);
                }
                nodes.push(list);
            }
            for (const node of nodes.reverse()) {
                node.dataset.adminAfterIntro = "";
                intro.after(node);
            }
            checkButton.disabled = pending;
            submitButton.disabled = pending || duplicates.length > 0;
            submitButton.textContent = pending ? "확인 중…" : "대기 상태로 등록";
            const count = fieldsets().length;
            addButton.disabled = count >= 8;
            addButton.textContent = `출처 추가 (${count}/8)`;
        };
        const changed = () => {
            checked = null;
            duplicates = [];
            message = null;
            registrationKey = null;
            render();
        };
        form.addEventListener("input", changed);
        form.addEventListener("change", changed);
        const relabel = () => fieldsets().forEach((set, index) => {
            if (index >= 2)
                set.querySelector("legend").textContent = `추가 출처 ${index - 1}`;
        });
        addButton.addEventListener("click", () => {
            if (fieldsets().length >= 8)
                return;
            const copy = fieldsets()[1].cloneNode(true);
            for (const input of copy.querySelectorAll("input"))
                input.value = "";
            const roles = field(copy, "sourceRole");
            roles.replaceChildren(...JSON.parse(form.dataset.adminRoles).map(([value, label]) => {
                const option = element("option", "", label);
                option.value = value;
                return option;
            }));
            roles.value = "usage_example";
            field(copy, "platform").value = "web";
            field(copy, "rightsBasis").value = "unknown";
            const remove = element("button", "min-h-11 rounded-lg border border-border px-3 text-sm text-muted", "이 출처 제거");
            remove.type = "button";
            remove.addEventListener("click", () => {
                copy.remove();
                relabel();
                changed();
            });
            copy.append(remove);
            addButton.before(copy);
            relabel();
            changed();
        });
        const lines = (value) => value.split(",").map((part) => part.trim()).filter(Boolean);
        const year = (value) => (value.trim() ? Number(value) : null);
        const check = async () => {
            message = null;
            duplicates = [];
            render();
            const result = await post("catalog-duplicates", { title: field(form, "title").value, sourceUrls: fieldsets().map((set) => field(set, "url").value) });
            if (result === null)
                return null;
            if (!result.ok) {
                message = result.error.message;
                return false;
            }
            checked = fingerprint();
            duplicates = result.data.matches;
            if (duplicates.length > 0) {
                message = "기존 항목과 겹칠 가능성이 있어요. 기존 밈을 확인한 뒤 등록 여부를 다시 판단해 주세요.";
                return false;
            }
            message = "중복 후보가 없어요. 이제 대기 상태로 등록할 수 있어요.";
            return true;
        };
        const run = async (work) => {
            pending = true;
            render();
            const done = await work();
            if (done === null)
                return;
            pending = false;
            render();
        };
        checkButton.addEventListener("click", () => void run(check));
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const before = duplicates.length;
            void run(async () => {
                if (checked !== fingerprint()) {
                    const ok = await check();
                    if (ok !== true)
                        return ok;
                }
                if (before > 0)
                    return false;
                registrationKey ?? (registrationKey = crypto.randomUUID());
                const body = (name) => field(form, name).value;
                const result = await post("catalog-register", {
                    registrationKey,
                    title: body("title"),
                    aliases: lines(body("aliases")),
                    summary: body("summary"),
                    description: body("description"),
                    origin: body("origin"),
                    sourceWorkYear: year(body("sourceWorkYear")),
                    memeFirstSeenYear: year(body("memeFirstSeenYear")),
                    koreaViralYear: year(body("koreaViralYear")),
                    yearPrecision: body("yearPrecision"),
                    tags: lines(body("tags")),
                    safetyLevel: body("safetyLevel"),
                    category: body("category"),
                    difficulty: body("difficulty"),
                    sentiment: body("sentiment"),
                    usageContext: Object.fromEntries(["work", "friends", "family", "sns"].map((key) => [key, body(key)])),
                    sources: fieldsets().map((set) => ({
                        url: field(set, "url").value,
                        platform: field(set, "platform").value,
                        sourceRole: field(set, "sourceRole").value,
                        rightsBasis: field(set, "rightsBasis").value,
                        title: field(set, "title").value,
                        creatorName: field(set, "creatorName").value,
                        reviewNote: field(set, "reviewNote").value,
                    })),
                });
                if (result === null)
                    return null;
                if (!result.ok) {
                    message = result.error.message;
                    return false;
                }
                if (result.data.status === "duplicate") {
                    duplicates = result.data.matches;
                    message = "저장 직전에 중복 항목이 확인되어 등록하지 않았어요.";
                    return false;
                }
                location.assign(`/admin/memes/${result.data.memeId}`);
                return null;
            });
        });
    };
    return { "house-original": houseOriginal, catalog };
}
return { memeComponents };
})();
lib.adminMemeEditor = (() => {
const { dictionaryCard } = lib.dictionaryCard;
const FLASH = "memecatch-admin-editor-flash";
const LANGUAGE_NAMES = { en: "English", ja: "日本語", zh: "中文(简体)", "zh-tw": "中文(繁體)" };
const AI_RECOMMENDATION_COPY = { approve: "발행 가능", edit: "교정 후 발행", reject: "발행 보류" };
const keep = (key, ok, text) => {
    try {
        sessionStorage.setItem(FLASH, JSON.stringify({ key, ok, text, path: location.pathname }));
    }
    catch {
    }
};
const takeKept = () => {
    try {
        const kept = JSON.parse(sessionStorage.getItem(FLASH) ?? "null");
        sessionStorage.removeItem(FLASH);
        return kept && kept.path === location.pathname ? kept : null;
    }
    catch {
        return null;
    }
};
function editorComponents({ post, element }) {
    const kept = takeKept();
    const restore = (key, say) => {
        if (kept && kept.key === key)
            say(kept.ok, kept.text);
    };
    const memeStatus = (root) => {
        const memeId = root.dataset.adminMeme;
        const house = root.dataset.adminHouse === "true";
        const blocked = root.dataset.adminBlocked === "true";
        const attest = root.querySelector("[data-admin-attest]");
        const buttons = [...root.querySelectorAll("button[data-admin-to]")];
        if (buttons.length === 0)
            return;
        const confirms = {};
        let pending = false;
        const showError = (text) => {
            root.querySelector(":scope > [data-admin-error]")?.remove();
            if (text === null)
                return;
            const alert = element("p", "rounded-lg bg-safety-red-bg p-3 text-base text-safety-red", text);
            alert.dataset.adminError = "";
            alert.setAttribute("role", "alert");
            const anchor = root.querySelector("#house-original-rights-evidence") ?? attest?.closest("label") ?? buttons[0].parentElement;
            anchor.before(alert);
        };
        const sync = () => {
            for (const button of buttons) {
                const to = button.dataset.adminTo;
                button.disabled = pending || (blocked && (to === "limited" || to === "approved"));
            }
            for (const [to, panel] of Object.entries(confirms)) {
                const run = panel.querySelector("[data-admin-run]");
                for (const button of panel.querySelectorAll("button"))
                    button.disabled = pending;
                run.textContent = pending ? (to === "approved" ? "게시 중…" : "전환 중…") : to === "approved" ? "확인하고 게시" : "제한 공개로 전환";
            }
        };
        const open = (to) => {
            if (confirms[to])
                return;
            const panel = root.querySelector(`template[data-admin-confirm="${to}"]`).content.firstElementChild.cloneNode(true);
            panel.querySelector("[data-admin-run]").addEventListener("click", () => void run(to));
            panel.querySelector("[data-admin-cancel]").addEventListener("click", () => {
                panel.remove();
                delete confirms[to];
            });
            confirms[to] = panel;
            if (to === "approved" && confirms.limited)
                confirms.limited.before(panel);
            else
                root.append(panel);
            sync();
        };
        const run = async (to) => {
            showError(null);
            const publishing = to === "approved" || to === "limited";
            if (house && publishing && !attest?.checked) {
                showError("자체 제작 권리 확인에 동의해 주세요.");
                return;
            }
            pending = true;
            sync();
            const result = await post("meme-transition", { memeId, to, ...(house && publishing ? { attested: true } : {}) });
            if (result === null)
                return;
            if (!result.ok) {
                pending = false;
                sync();
                showError(result.error);
                return;
            }
            location.reload();
        };
        for (const button of buttons) {
            const to = button.dataset.adminTo;
            button.addEventListener("click", () => {
                if (to === "limited")
                    open("limited");
                else if (to === "approved" && !house)
                    open("approved");
                else
                    void run(to);
            });
        }
    };
    const statusMessage = (root, ok, text, className) => {
        root.querySelector("[data-admin-message]")?.remove();
        if (text === null)
            return null;
        const message = element("p", className(ok), text);
        message.dataset.adminMessage = "";
        message.setAttribute("role", ok ? "status" : "alert");
        return message;
    };
    const memeCountry = (root) => {
        const form = root.querySelector("form");
        const button = form.querySelector("button[type=submit]");
        const say = (ok, text) => {
            const message = statusMessage(root, ok, text, (good) => `rounded-lg p-3 text-sm ${good ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`);
            if (message)
                root.append(message);
        };
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            say(true, null);
            button.disabled = true;
            button.textContent = "저장 중…";
            const result = await post("meme-origin-country", {
                memeId: root.dataset.adminMeme,
                country: form.querySelector('[data-admin-field="country"]').value,
                localTitle: form.querySelector('[data-admin-field="localTitle"]').value,
            });
            if (result === null)
                return;
            if (result.ok) {
                keep("meme-country", true, "출처 국가 검수를 저장했어요.");
                location.reload();
                return;
            }
            button.disabled = false;
            button.textContent = "출처 국가 검수 저장";
            say(false, result.error);
        });
        restore("meme-country", say);
    };
    const memeTranslation = (root) => {
        const body = JSON.parse(root.dataset.adminBody);
        const fresh = root.dataset.adminFresh === "true";
        const field = (name) => root.querySelector(`[data-admin-field="${name}"]`);
        const button = (name) => root.querySelector(`[data-admin-action="${name}"]`);
        const [gpt, save, review, stale] = ["gpt", "save", "review", "stale"].map(button);
        const configured = !gpt.disabled;
        const isStale = stale.disabled;
        const name = LANGUAGE_NAMES[body.locale];
        const prefix = `[${body.locale}]`;
        let pending = false;
        let reviewing = false;
        const say = (ok, text) => {
            const message = statusMessage(root, ok, text, (good) => `rounded-lg px-3 py-2.5 text-sm font-semibold ${good ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`);
            if (message)
                root.firstElementChild.after(message);
        };
        const sync = () => {
            const busy = pending || reviewing;
            gpt.disabled = busy || !configured;
            gpt.textContent = reviewing ? "GPT 검수 중…" : "GPT-5.6 Sol high 검수";
            save.disabled = busy;
            save.textContent = busy ? "처리 중…" : `${prefix} 초안 저장`;
            review.disabled = busy || !fresh;
            stale.disabled = busy || isStale;
        };
        const content = () => ({
            ...body,
            title: field("title").value,
            summary: field("summary").value,
            description: field("description").value,
            origin: field("origin").value,
            usageNote: field("usageNote").value,
            caution: field("caution").value,
            aliases: field("aliases").value.split(",").map((alias) => alias.trim()).filter(Boolean),
        });
        const run = async (action, payload, done) => {
            say(true, null);
            pending = true;
            sync();
            const result = await post(action, payload);
            if (result === null)
                return;
            if (!result.ok) {
                pending = false;
                sync();
                say(false, result.error ?? "처리하지 못했어요.");
                return;
            }
            keep(root.dataset.adminKey, true, done);
            location.reload();
        };
        save.addEventListener("click", () => void run("translation-save", content(), `${name} 번역을 저장했어요. 다시 검수해 주세요.`));
        review.addEventListener("click", () => void run("translation-review", content(), `${name} 번역을 검수 완료하고 발행했어요.`));
        stale.addEventListener("click", () => void run("translation-stale", body, `${name} 번역을 stale로 표시했어요.`));
        gpt.addEventListener("click", async () => {
            say(true, null);
            reviewing = true;
            sync();
            try {
                const result = await post("translation-gpt-review", body);
                if (result === null)
                    return;
                if (!result.ok) {
                    say(false, result.error);
                    return;
                }
                const draft = result.data;
                const fill = (key, value) => {
                    if (value !== undefined && value !== null)
                        field(key).value = String(value);
                };
                fill("title", draft.title);
                fill("summary", draft.summary);
                fill("description", draft.description);
                fill("origin", draft.origin);
                fill("usageNote", draft.usage_note);
                fill("caution", draft.caution);
                fill("aliases", draft.aliases.join(", "));
                const notes = draft.review_notes.slice(0, 2).join(" · ");
                say(true, `GPT 검수 의견: ${AI_RECOMMENDATION_COPY[draft.recommendation]} · 신뢰도 ${draft.confidence}${notes ? ` · ${notes}` : ""}`);
            }
            finally {
                reviewing = false;
                sync();
            }
        });
        restore(root.dataset.adminKey, say);
    };
    const memeEdit = (form) => {
        const memeId = form.dataset.adminMeme;
        const field = (name) => form.querySelector(`[data-admin-field="${name}"]`);
        const draftButton = form.querySelector("[data-admin-draft]");
        const submit = form.querySelector("button[type=submit]");
        const configured = !draftButton.disabled;
        let pending = false;
        let translating = false;
        const say = (ok, text) => {
            form.querySelector(":scope > [data-admin-message]")?.remove();
            if (text === null)
                return;
            const message = element("p", `rounded-lg p-3 text-base ${ok ? "bg-safety-green-bg text-safety-green" : "bg-safety-red-bg text-safety-red"}`, text);
            message.dataset.adminMessage = "";
            message.setAttribute("role", "status");
            form.firstElementChild.after(message);
        };
        const sync = () => {
            draftButton.disabled = pending || translating || !configured;
            draftButton.textContent = translating ? "GPT 검수 중…" : "GPT-5.6 Sol high로 검수 초안";
            submit.disabled = pending;
            submit.textContent = pending ? "저장 중…" : "저장";
        };
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            say(true, null);
            const raw = field("originYear").value;
            const year = raw.trim() ? Number(raw) : null;
            if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
                say(false, "연도는 1980~2100 사이 숫자로 입력해 주세요.");
                return;
            }
            pending = true;
            sync();
            const result = await post("meme-update", {
                memeId,
                title: field("title").value,
                summary: field("summary").value,
                description: field("description").value,
                origin: field("origin").value,
                usageNote: field("usageNote").value,
                caution: field("caution").value,
                aliases: field("aliases").value.split(",").map((alias) => alias.trim()).filter(Boolean),
                safetyLevel: field("safetyLevel").value,
                lifecycleStatus: field("lifecycleStatus").value,
                category: field("category").value,
                difficulty: field("difficulty").value,
                sentiment: field("sentiment").value,
                originYear: year,
                usageContext: Object.fromEntries(["work", "friends", "family", "sns"].map((key) => [key, field(key).value])),
            });
            if (result === null)
                return;
            if (!result.ok) {
                pending = false;
                sync();
                say(false, result.error);
                return;
            }
            keep("meme-edit", true, result.data?.revertedToRightsChecking
                ? "저장했어요. 본문이 바뀌어 권리 확인으로 돌아갔어요. 다시 수동 게시해야 공개됩니다."
                : result.data?.safetyReviewQueued
                    ? "내용을 저장하고 안전 등급 변경은 Radar 검수 대기열에 추가했어요."
                    : "저장했어요.");
            location.reload();
        });
        draftButton.addEventListener("click", async () => {
            say(true, null);
            translating = true;
            sync();
            try {
                const result = await post("meme-korean-draft", memeId);
                if (result === null)
                    return;
                if (!result.ok) {
                    say(false, result.error);
                    return;
                }
                const draft = result.data;
                const fill = (key, value) => {
                    if (value !== undefined && value !== null)
                        field(key).value = String(value);
                };
                fill("title", draft.title);
                fill("summary", draft.summary);
                fill("description", draft.description);
                fill("origin", draft.origin);
                fill("usageNote", draft.usage_note);
                fill("caution", draft.caution);
                say(true, draft.review_basis === "korean_wikipedia"
                    ? "한국어 위키백과 자료로 검수 초안을 채웠어요. 항목 일치 여부와 사실관계를 확인한 뒤 저장해 주세요."
                    : "한국어 검수 초안을 채웠어요. 사실관계와 고유명사를 확인한 뒤 저장해 주세요.");
            }
            finally {
                translating = false;
                sync();
            }
        });
        restore("meme-edit", say);
    };
    const dictionaryStudio = (root) => {
        const rights = root.querySelector('input[name="rights-confirmed"]');
        const note = root.querySelector(':scope > p[role="status"]');
        const card = dictionaryCard(root.querySelector("[data-studio-artifact]"), rights);
        rights.addEventListener("change", () => {
            if (rights.checked)
                note.remove();
            else
                rights.closest("label").after(note);
            card.update();
        });
    };
    const memeContents = (root) => {
        for (const facade of root.querySelectorAll("[data-admin-youtube]")) {
            facade.addEventListener("click", () => {
                const frame = element("iframe", "h-full w-full border-0");
                frame.src = `https://www.youtube-nocookie.com/embed/${facade.dataset.adminYoutube}?rel=0&autoplay=1`;
                frame.title = facade.dataset.adminYoutubeTitle;
                frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-popups allow-presentation");
                frame.allow = "autoplay; encrypted-media; picture-in-picture";
                frame.allowFullscreen = true;
                frame.loading = "lazy";
                facade.replaceWith(frame);
            });
        }
        for (const box of root.querySelectorAll("[data-admin-social]")) {
            const loading = box.querySelector("[data-admin-loading]");
            if (!loading)
                continue;
            const provider = box.dataset.adminSocial;
            const source = box.dataset.adminSource;
            const trusted = (url) => {
                try {
                    const parsed = new URL(url);
                    if (parsed.protocol !== "https:")
                        return false;
                    if (provider === "tiktok")
                        return parsed.hostname === "www.tiktok.com" && parsed.pathname.startsWith("/player/v1/");
                    if (provider === "instagram")
                        return parsed.hostname === "www.instagram.com" && parsed.pathname.endsWith("/embed/captioned/");
                    if (provider === "threads")
                        return false;
                    return parsed.hostname === "www.facebook.com" && parsed.pathname.startsWith("/plugins/");
                }
                catch {
                    return false;
                }
            };
            void (async () => {
                try {
                    const response = await fetch(`/api/oembed?url=${encodeURIComponent(source)}`);
                    const data = await response.json();
                    if (!response.ok || !("embedUrl" in data))
                        throw new Error("error" in data ? data.error : undefined);
                    const good = provider === "threads" ? typeof data.embedHtml === "string" && data.embedHtml.length > 0 : typeof data.embedUrl === "string" && trusted(data.embedUrl);
                    if (data.provider !== provider || !good)
                        throw new Error("안전한 임베드 주소를 확인하지 못했습니다.");
                    const frame = element("iframe", box.dataset.adminFrame);
                    if (data.embedHtml) {
                        frame.srcdoc = `<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center}</style></head><body>${data.embedHtml}</body></html>`;
                    }
                    if (data.embedUrl)
                        frame.src = data.embedUrl;
                    frame.title = box.dataset.adminFrameTitle;
                    frame.setAttribute("sandbox", box.dataset.adminSandbox);
                    frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
                    frame.allowFullscreen = true;
                    frame.loading = "lazy";
                    frame.referrerPolicy = "strict-origin-when-cross-origin";
                    loading.replaceWith(frame);
                }
                catch (error) {
                    const failure = element("div", "mx-auto flex min-h-32 w-full max-w-[540px] flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-surface-2 p-5 text-center");
                    const alert = element("p", "text-sm text-muted", error instanceof Error && error.message ? error.message : "콘텐츠를 불러오지 못했습니다.");
                    alert.setAttribute("role", "alert");
                    failure.append(alert);
                    if (provider !== "tiktok") {
                        const link = element("a", "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-bold transition-colors hover:border-accent hover:text-accent");
                        link.href = source;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";
                        const arrow = element("span", "", "↗");
                        arrow.setAttribute("aria-hidden", "true");
                        link.append(`${box.querySelector("span.font-bold").textContent}에서 보기 `, arrow);
                        failure.append(link);
                    }
                    loading.replaceWith(failure);
                }
            })();
        }
    };
    return {
        "meme-status": memeStatus,
        "meme-country": memeCountry,
        "meme-translation": memeTranslation,
        "meme-edit": memeEdit,
        "dictionary-studio": dictionaryStudio,
        "meme-contents": memeContents,
    };
}
return { editorComponents };
})();
const { translationComponents } = lib.adminTranslations;
const { memeComponents } = lib.adminMemes;
const { editorComponents } = lib.adminMemeEditor;
{
    const ENDPOINT = "/_axum/admin/";
    const FLASH = "memecatch-admin-flash";
    const post = async (action, body) => {
        let response;
        try {
            response = await fetch(`${ENDPOINT}${action}`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
                credentials: "same-origin",
            });
        }
        catch {
            return { ok: false, error: "실패했어요." };
        }
        if (response.status === 401) {
            location.assign(`/login?next=${encodeURIComponent(location.pathname)}`);
            return null;
        }
        if (response.status === 403) {
            location.assign("/");
            return null;
        }
        try {
            return await response.json();
        }
        catch {
            return { ok: false, error: "실패했어요." };
        }
    };
    const STATUS_CLASS = {
        true: "rounded-xl px-4 py-3 text-sm font-semibold bg-safety-green-bg text-safety-green",
        false: "rounded-xl px-4 py-3 text-sm font-semibold bg-safety-red-bg text-safety-red",
    };
    const showMessage = (root, ok, text) => {
        root.querySelector(":scope > [data-admin-message]")?.remove();
        if (text === null)
            return;
        const message = document.createElement("p");
        message.dataset.adminMessage = "";
        message.setAttribute("role", ok ? "status" : "alert");
        message.className = STATUS_CLASS[ok];
        message.textContent = text;
        root.prepend(message);
    };
    const keepForReload = (root, ok, text) => {
        try {
            sessionStorage.setItem(FLASH, JSON.stringify({ path: location.pathname, key: root.dataset.adminControls, ok, text }));
        }
        catch {
        }
    };
    const restoreFlash = () => {
        let flash = null;
        try {
            flash = JSON.parse(sessionStorage.getItem(FLASH) ?? "null");
            sessionStorage.removeItem(FLASH);
        }
        catch {
            return;
        }
        if (!flash || flash.path !== location.pathname)
            return;
        const root = [...document.querySelectorAll("[data-admin-controls]")].find((element) => element.dataset.adminControls === flash.key);
        if (root)
            showMessage(root, flash.ok, flash.text);
    };
    const userControls = (root) => {
        const field = root.querySelector("[data-admin-password]");
        const buttons = [...root.querySelectorAll("button[data-admin-action]")];
        const alwaysOff = new Set(buttons.filter((button) => button.disabled && !button.hasAttribute("data-admin-needs-password")));
        let pending = false;
        const sync = () => {
            for (const button of buttons) {
                const short = button.hasAttribute("data-admin-needs-password") && field.value.length < 8;
                button.disabled = pending || alwaysOff.has(button) || short;
            }
        };
        field?.addEventListener("input", sync);
        for (const button of buttons) {
            button.addEventListener("click", async () => {
                if (button.disabled)
                    return;
                showMessage(root, true, null);
                let body = JSON.parse(button.dataset.adminBody);
                if (button.hasAttribute("data-admin-needs-password"))
                    body = { ...body, password: field.value };
                pending = true;
                sync();
                const result = await post(button.dataset.adminAction, body);
                if (result === null)
                    return;
                pending = false;
                const text = result.ok ? button.dataset.adminDone : (result.error ?? "실패했어요.");
                if (result.ok)
                    field.value = "";
                sync();
                if (result.ok && button.hasAttribute("data-admin-refresh")) {
                    keepForReload(root, true, text);
                    location.reload();
                    return;
                }
                showMessage(root, Boolean(result.ok), text);
            });
        }
    };
    const radarReview = (form) => {
        const buttons = [...form.querySelectorAll("button[name=decision]")];
        const row = buttons[0]?.parentElement;
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const decision = event.submitter?.value === "approved" ? "approved" : "rejected";
            const reviewNote = String(new FormData(form).get("reviewNote") ?? "");
            for (const button of buttons)
                button.disabled = true;
            const pending = document.createElement("span");
            pending.className = "text-xs text-muted";
            pending.textContent = "처리 중…";
            row?.append(pending);
            const result = await post("radar-review", { reviewId: form.dataset.adminReview, decision, reviewNote });
            if (result === null)
                return;
            pending.remove();
            for (const button of buttons)
                button.disabled = false;
            form.reset();
            if (result.ok) {
                location.reload();
                return;
            }
            form.querySelector(":scope > [data-admin-message]")?.remove();
            const message = document.createElement("p");
            message.dataset.adminMessage = "";
            message.setAttribute("role", "alert");
            message.className = "text-sm text-danger";
            message.textContent = result.error ?? "실패했어요.";
            form.append(message);
        });
    };
    const refreshButtons = (errorClass) => (root) => {
        const buttons = [...root.querySelectorAll("button[data-admin-action]")];
        for (const button of buttons) {
            button.addEventListener("click", async () => {
                root.querySelector(":scope > [data-admin-message]")?.remove();
                for (const each of buttons)
                    each.disabled = true;
                const result = await post(button.dataset.adminAction, JSON.parse(button.dataset.adminBody));
                if (result === null)
                    return;
                if (result.ok) {
                    location.reload();
                    return;
                }
                for (const each of buttons)
                    each.disabled = false;
                const message = document.createElement("p");
                message.dataset.adminMessage = "";
                message.setAttribute("role", "alert");
                message.className = errorClass;
                message.textContent = result.error ?? "실패했어요.";
                root.prepend(message);
            });
        }
    };
    const inquiryActions = (root) => {
        const field = root.querySelector("textarea");
        const answer = root.querySelector("[data-admin-answer]");
        const toggle = root.querySelector("[data-admin-status]");
        let pending = false;
        const sync = () => {
            answer.disabled = pending || field.value.trim().length === 0;
            toggle.disabled = pending;
            answer.textContent = pending ? "저장 중…" : "답변 저장";
        };
        field.addEventListener("input", sync);
        const run = async (action, body) => {
            if (pending)
                return;
            root.querySelector("[data-admin-message]")?.remove();
            pending = true;
            sync();
            const result = await post(action, body);
            if (result === null)
                return;
            if (result.ok) {
                location.reload();
                return;
            }
            pending = false;
            sync();
            const message = document.createElement("p");
            message.dataset.adminMessage = "";
            message.setAttribute("role", "alert");
            message.className = "mt-1.5 text-sm font-medium text-foreground";
            message.textContent = result.error ?? "실패했어요.";
            field.after(message);
        };
        const inquiryId = root.dataset.adminInquiry;
        answer.addEventListener("click", () => run("inquiry-answer", { inquiryId, reply: field.value }));
        toggle.addEventListener("click", () => run("inquiry-status", { inquiryId, status: toggle.dataset.adminStatus }));
    };
    const contributionReview = (root) => {
        const buttons = root.querySelector("[data-admin-buttons]");
        const approve = root.querySelector("[data-admin-approve]");
        const openReject = root.querySelector("[data-admin-open-reject]");
        const rejectTemplate = root.querySelector("template[data-admin-reject]");
        const rejectButtonsTemplate = root.querySelector("template[data-admin-reject-buttons]");
        let mode = "idle";
        let pending = false;
        let reject = null;
        let rejectButtons = [];
        const field = (name) => root.querySelector(`[data-admin-field="${name}"]`);
        const sync = () => {
            for (const input of root.querySelectorAll("[data-admin-field]"))
                input.disabled = pending;
            approve.disabled = pending || mode === "reject";
            approve.textContent = pending ? "처리 중…" : "승인 → 문서에 반영";
            openReject.disabled = pending;
            const [submit, cancel] = rejectButtons;
            if (submit)
                submit.disabled = pending || !field("rejectReason").value.trim();
            if (cancel)
                cancel.disabled = pending;
        };
        const setMode = (next) => {
            mode = next;
            reject?.remove();
            for (const button of rejectButtons)
                button.remove();
            reject = null;
            rejectButtons = [];
            openReject.hidden = mode === "reject";
            if (mode === "reject") {
                reject = rejectTemplate.content.firstElementChild.cloneNode(true);
                buttons.before(reject);
                rejectButtons = [...rejectButtonsTemplate.content.children].map((button) => button.cloneNode(true));
                buttons.append(...rejectButtons);
                field("rejectReason").addEventListener("input", sync);
                rejectButtons[0].addEventListener("click", () => submit("reject"));
                rejectButtons[1].addEventListener("click", () => setMode("idle"));
            }
            sync();
        };
        const kind = root.dataset.adminKind;
        const submit = async (decision) => {
            root.querySelector(":scope > [data-admin-message]")?.remove();
            pending = true;
            sync();
            const value = (name) => field(name)?.value;
            const result = await post("contribution-review", {
                contributionId: root.dataset.adminContribution,
                decision,
                sourceTitle: kind === "source" ? value("sourceTitle") : undefined,
                situation: kind === "example" ? value("situation") : undefined,
                text: kind === "example" ? value("text") : undefined,
                rejectReason: decision === "reject" ? value("rejectReason") : undefined,
            });
            if (result === null)
                return;
            if (result.ok) {
                location.reload();
                return;
            }
            pending = false;
            sync();
            const message = document.createElement("p");
            message.dataset.adminMessage = "";
            message.setAttribute("role", "status");
            message.className = "rounded-lg p-3 text-base bg-safety-red-bg text-safety-red";
            message.textContent = result.error ?? "실패했어요.";
            (reject ?? buttons).before(message);
        };
        approve.addEventListener("click", () => submit("approve"));
        openReject.addEventListener("click", () => setMode("reject"));
    };
    const SAFETY_ICON = { green: "●", yellow: "▲", gray: "◌", red: "✕" };
    const MESSAGE_CLASS = {
        error: "rounded-lg p-3 text-base bg-safety-red-bg text-safety-red",
        warning: "rounded-lg p-3 text-base bg-safety-yellow-bg text-safety-yellow",
        success: "rounded-lg p-3 text-base bg-safety-green-bg text-safety-green",
    };
    const MODE_CLASS = {
        approve: ["border-safety-green", "bg-safety-green-bg", "text-safety-green"],
        reject: ["border-safety-red", "bg-safety-red-bg", "text-safety-red"],
    };
    const submissionReview = (root) => {
        const submissionId = root.dataset.adminSubmission;
        const heading = root.querySelector("h2");
        const claimButton = root.querySelector("[data-admin-claim]");
        const draftButton = root.querySelector("[data-admin-draft]");
        const hasKey = draftButton.dataset.adminKey === "1";
        const modeButtons = [...root.querySelectorAll("[data-admin-mode]")];
        const forms = {};
        for (const template of root.querySelectorAll("template[data-admin-form]")) {
            forms[template.dataset.adminForm] = template.content.firstElementChild.cloneNode(true);
        }
        let mode = "idle";
        let pending = false;
        let drafting = false;
        let saved = null;
        let message = null;
        const field = (form, name) => forms[form].querySelector(`[data-admin-field="${name}"]`);
        const busy = () => pending || drafting || saved !== null;
        const render = () => {
            root.querySelector(":scope > [data-admin-message]")?.remove();
            root.querySelector(":scope > [data-admin-saved]")?.remove();
            if (message) {
                const p = document.createElement("p");
                p.dataset.adminMessage = "";
                p.setAttribute("role", message.kind === "warning" ? "alert" : "status");
                p.className = MESSAGE_CLASS[message.kind];
                p.textContent = message.text;
                heading.after(p);
                if (saved && (message.kind === "warning" || message.kind === "error")) {
                    const links = document.createElement("div");
                    links.dataset.adminSaved = "";
                    links.className = "flex flex-wrap gap-x-4 gap-y-2 text-base";
                    const link = (href, text) => {
                        const a = document.createElement("a");
                        a.href = href;
                        a.className = "text-accent-text underline";
                        a.textContent = text;
                        return a;
                    };
                    links.append(link(`/admin/memes/${saved.id}`, `${saved.published ? "게시된 밈 관리" : "등록된 밈 관리"} (ID: ${saved.id})`), link(`/admin/submissions/${submissionId}`, `제보 상태 확인 (ID: ${submissionId})`));
                    p.after(links);
                }
            }
            if (claimButton) {
                claimButton.disabled = busy();
                claimButton.textContent = pending ? "처리 중…" : "내가 검토하기 (claim)";
            }
            draftButton.disabled = busy() || !hasKey;
            draftButton.textContent = drafting ? "GPT 검수 중…" : "GPT-5.6 Sol high로 검수 초안";
            for (const button of modeButtons) {
                button.disabled = busy();
                const on = mode === button.dataset.adminMode;
                button.classList.toggle("border-border", !on);
                button.classList.toggle("bg-surface-2", !on);
                for (const name of MODE_CLASS[button.dataset.adminMode])
                    button.classList.toggle(name, on);
            }
            for (const [name, form] of Object.entries(forms)) {
                if (name === mode && !form.isConnected)
                    root.append(form);
                if (name !== mode)
                    form.remove();
                const submit = form.querySelector("button[type=submit]");
                submit.disabled = busy();
                submit.textContent = pending ? (name === "approve" ? "생성 중…" : "처리 중…") : name === "approve" ? "밈 생성 및 게시" : "반려하기";
            }
            for (const label of forms.reject.querySelectorAll("[data-admin-choice]")) {
                const on = label.querySelector("input").checked;
                label.classList.toggle("border-border", !on);
                label.classList.toggle("bg-surface-2", !on);
                for (const name of ["border-safety-red", "bg-safety-red-bg", "font-semibold", "text-safety-red"])
                    label.classList.toggle(name, on);
            }
        };
        const say = (kind, text) => {
            message = text === null ? null : { kind, text };
            render();
        };
        const setSafety = (name, value) => {
            const select = field("approve", name);
            select.value = value;
            select.dispatchEvent(new Event("change"));
        };
        for (const radio of forms.reject.querySelectorAll("input[type=radio]"))
            radio.addEventListener("change", render);
        for (const button of modeButtons) {
            button.addEventListener("click", () => {
                mode = mode === button.dataset.adminMode ? "idle" : button.dataset.adminMode;
                render();
            });
        }
        claimButton?.addEventListener("click", async () => {
            say(null, null);
            pending = true;
            render();
            const result = await post("submission-claim", submissionId);
            if (result === null)
                return;
            if (result.ok) {
                location.reload();
                return;
            }
            pending = false;
            say("error", result.error);
        });
        draftButton.addEventListener("click", async () => {
            say(null, null);
            drafting = true;
            render();
            const result = await post("submission-draft", submissionId);
            drafting = false;
            if (result === null)
                return;
            if (!result.ok) {
                say("error", result.error);
                return;
            }
            const draft = result.data;
            field("approve", "summary").value = draft.summary;
            field("approve", "description").value = draft.description;
            field("approve", "origin").value = draft.origin;
            setSafety("safetyLevel", draft.safety_level);
            for (const key of ["work", "friends", "family", "sns"])
                setSafety(`usage.${key}`, draft.usage_context[key]);
            mode = "approve";
            say("success", "GPT-5.6 Sol high 검수 초안을 채웠어요. 내용을 검토하고 수정해 주세요.");
        });
        forms.approve.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (saved)
                return;
            say(null, null);
            const yearText = field("approve", "originYear").value;
            const year = yearText.trim() ? Number(yearText) : null;
            if (year !== null && (!Number.isInteger(year) || year < 1980 || year > 2100)) {
                say("error", "연도는 1980~2100 사이 숫자로 입력해 주세요.");
                return;
            }
            pending = true;
            render();
            const value = (name) => field("approve", name).value;
            const result = await post("submission-approve", {
                submissionId,
                title: value("title"),
                summary: value("summary"),
                description: value("description"),
                origin: value("origin"),
                safetyLevel: value("safetyLevel"),
                category: value("category"),
                difficulty: value("difficulty"),
                originYear: year,
                tags: value("tags").split(",").map((tag) => tag.trim()).filter(Boolean),
                usageContext: Object.fromEntries(["work", "friends", "family", "sns"].map((key) => [key, value(`usage.${key}`)])),
            });
            if (result === null)
                return;
            pending = false;
            if (!result.ok) {
                if (result.createdMemeId)
                    saved = { id: result.createdMemeId, published: false };
                say("error", result.error);
                return;
            }
            saved = { id: result.data.memeId, published: true };
            if (result.data.warning) {
                say("warning", result.data.warning);
                return;
            }
            location.assign("/admin/submissions");
        });
        forms.reject.addEventListener("submit", async (event) => {
            event.preventDefault();
            say(null, null);
            const category = forms.reject.querySelector("input[type=radio]:checked")?.value ?? "";
            const reason = field("reject", "rejectReason").value;
            if (!category) {
                say("error", "반려 사유 카테고리를 선택해 주세요.");
                return;
            }
            if (!reason.trim()) {
                say("error", "반려 사유를 입력해 주세요.");
                return;
            }
            pending = true;
            render();
            const result = await post("submission-reject", { submissionId, category, reason });
            if (result === null)
                return;
            pending = false;
            if (!result.ok) {
                say("error", result.error);
                return;
            }
            location.assign("/admin/submissions");
        });
        render();
    };
    const sourceReview = (root) => {
        const preview = root.querySelector("[data-admin-preview]");
        preview?.addEventListener("click", () => {
            if (preview.disabled || !root.dataset.adminEmbed)
                return;
            const frame = document.createElement("iframe");
            frame.src = root.dataset.adminEmbed;
            frame.title = root.dataset.adminEmbedTitle;
            frame.className = `${preview.dataset.adminPreviewClass} rounded-lg border border-border bg-black`;
            frame.loading = "lazy";
            frame.allow = "accelerometer; encrypted-media; gyroscope; picture-in-picture";
            frame.allowFullscreen = true;
            preview.replaceWith(frame);
        });
        const buttons = [...root.querySelectorAll("[data-admin-decision]")];
        const field = (name) => root.querySelector(`[data-admin-field="${name}"]`);
        for (const button of buttons) {
            button.addEventListener("click", async () => {
                root.querySelector("[data-admin-message]")?.remove();
                for (const each of buttons)
                    each.disabled = true;
                const decision = button.dataset.adminDecision;
                const note = field("note").value;
                const result = await post("source-review", {
                    ...JSON.parse(root.dataset.adminBody),
                    decision,
                    sourceRole: field("sourceRole").value,
                    rightsBasis: field("rightsBasis").value,
                    note: note || undefined,
                });
                if (result === null)
                    return;
                for (const each of buttons)
                    each.disabled = false;
                if (!result.ok) {
                    const message = document.createElement("p");
                    message.dataset.adminMessage = "";
                    message.className = "text-sm text-safety-red";
                    message.textContent = result.error ?? "실패했어요.";
                    field("note").after(message);
                    return;
                }
                location.reload();
            });
        }
    };
    const INGESTION = "/api/admin/source-ingestions";
    const INGESTION_KEY = "memecatch-admin-ingestion";
    const INGEST_PLATFORM = { youtube: "YouTube", youtube_shorts: "YouTube Shorts", tiktok: "TikTok", instagram: "Instagram" };
    const RIGHTS_MODE = { METADATA_ONLY: "메타데이터 전용", official_embed: "공식 임베드", api_metadata: "API 메타데이터", link_only: "링크 전용" };
    const element = (tag, className, text) => {
        const node = document.createElement(tag);
        if (className)
            node.className = className;
        if (text !== undefined)
            node.textContent = text;
        return node;
    };
    const ingestionData = (payload) => {
        const data = payload && payload.ok === true ? payload.data : null;
        return data && typeof data.status === "string" && typeof data.platform === "string" && typeof data.canonicalUrl === "string"
            && typeof data.rightsMode === "string" && typeof data.duplicate === "boolean" ? data : null;
    };
    const sourceIngestion = (root) => {
        const form = root.querySelector("form");
        const url = root.querySelector('[data-admin-field="url"]');
        const target = root.querySelector('[data-admin-field="targetMemeId"]');
        const submitButton = form.querySelector("button[type=submit]");
        const noMemes = submitButton.disabled;
        let pending = false;
        let failedInput = null;
        const clear = () => root.querySelectorAll("[data-admin-result]").forEach((node) => node.remove());
        const showFailure = (failure) => {
            clear();
            const box = element("div", "mt-4 rounded-lg bg-safety-red-bg p-3 text-sm text-safety-red");
            box.dataset.adminResult = "";
            box.setAttribute("role", "alert");
            box.append(element("p", "", failure.error), element("p", "mt-1 text-xs", "자동 메타데이터 확인 결과일 뿐, 원본성이나 권리를 승인한 것은 아니에요."));
            if (failure.retryable && failedInput) {
                const retry = element("button", "mt-3 min-h-11 rounded-lg border border-current px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50", "같은 입력으로 다시 확인");
                retry.type = "button";
                retry.addEventListener("click", () => submit(true, retry));
                box.append(retry);
            }
            root.append(box);
        };
        const showResult = (result) => {
            clear();
            const box = element("div", "mt-4 rounded-lg bg-safety-green-bg p-3 text-sm text-safety-green");
            box.dataset.adminResult = "";
            box.setAttribute("role", "status");
            box.append(element("p", "font-semibold", result.duplicate ? "이미 등록된 출처예요." : "검수 대기 후보를 만들었어요."));
            if (result.warning === "recovery_resolution_failed") {
                box.append(element("p", "mt-2 rounded-lg bg-safety-yellow-bg p-3 text-sm text-safety-yellow", "출처 접수는 성공했어요. 다만 이전 복구 기록 정리가 완료되지 않았어요. 이 성공한 접수를 다시 제출하지 말고, 아래 복구 상태에서 운영자가 확인해 주세요."));
            }
            const list = element("dl", "mt-2 grid gap-x-4 gap-y-1 sm:grid-cols-[max-content_1fr]");
            const status = result.duplicate || result.status === "duplicate" ? "중복" : result.status === "metadata_ready" ? "메타데이터 준비" : "검수 대기";
            const rows = [["플랫폼", INGEST_PLATFORM[result.platform] ?? result.platform], ["권리 모드", RIGHTS_MODE[result.rightsMode] ?? result.rightsMode], ["상태", status]];
            if (!result.duplicate)
                rows.push(["다음 단계", "운영자 검수 후에만 공개돼요."]);
            for (const [term, value] of rows)
                list.append(element("dt", "", term), element("dd", "", value));
            const link = element("a", "block truncate text-accent-text underline underline-offset-2", result.canonicalUrl);
            link.href = result.canonicalUrl;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            const dd = element("dd", "min-w-0");
            dd.append(link);
            list.append(element("dt", "", "정규 URL"), dd);
            box.append(list);
            root.append(box);
        };
        const submit = async (retry, retryButton) => {
            if (pending)
                return;
            if (retry && (!failedInput || failedInput.url !== url.value || failedInput.targetMemeId !== target.value)) {
                failedInput = null;
                showFailure({ error: "입력한 URL 또는 연결할 밈이 바뀌었어요. 현재 값으로 다시 시도해 주세요.", retryable: false });
                return;
            }
            pending = true;
            submitButton.disabled = true;
            submitButton.textContent = "수집 중…";
            if (retryButton) {
                retryButton.disabled = true;
                retryButton.textContent = "다시 확인 중…";
            }
            else
                clear();
            const input = { url: url.value, targetMemeId: target.value };
            try {
                const response = await fetch(INGESTION, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...input, ...(retry ? { retry: true } : {}) }),
                });
                const payload = await response.json();
                const data = ingestionData(payload);
                if (!response.ok || !data) {
                    const error = typeof payload?.error === "string" ? payload.error : null;
                    failedInput = input;
                    showFailure(error === null
                        ? { error: "출처를 수집하지 못했어요. 잠시 후 다시 시도해 주세요.", retryable: true }
                        : { error, retryable: typeof payload.code === "string" && typeof payload.retryable === "boolean" ? payload.retryable : false });
                    return;
                }
                try {
                    sessionStorage.setItem(INGESTION_KEY, JSON.stringify(data));
                }
                catch {
                }
                location.reload();
                return;
            }
            catch {
                failedInput = input;
                showFailure({ error: "출처를 수집하지 못했어요. 네트워크 상태를 확인한 뒤 다시 시도해 주세요.", retryable: true });
            }
            finally {
                pending = false;
                submitButton.disabled = noMemes;
                submitButton.textContent = "검수 후보 만들기";
            }
        };
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            void submit(false);
        });
        try {
            const kept = JSON.parse(sessionStorage.getItem(INGESTION_KEY) ?? "null");
            sessionStorage.removeItem(INGESTION_KEY);
            if (kept)
                showResult(kept);
        }
        catch {
        }
    };
    const sourceRecovery = (root) => {
        let pending = null;
        const buttons = [...root.querySelectorAll("li[data-admin-recovery] button")];
        const say = (kind, text) => {
            root.querySelector(":scope > [data-admin-message]")?.remove();
            const message = element("p", `mt-4 rounded-lg p-3 text-sm ${kind === "error" ? "bg-safety-red-bg text-safety-red" : "bg-safety-green-bg text-safety-green"}`, text);
            message.dataset.adminMessage = "";
            message.setAttribute("role", kind === "error" ? "alert" : "status");
            root.append(message);
        };
        for (const button of buttons) {
            const item = button.closest("li");
            const label = button.textContent;
            button.addEventListener("click", async () => {
                const targetMemeId = item.querySelector("select").value;
                if (!targetMemeId || !item.dataset.adminUrl) {
                    say("error", "재시도할 URL과 연결할 밈을 모두 선택해 주세요. 기존 source_id가 없어도 밈을 추측하지 않아요.");
                    return;
                }
                if (pending)
                    return;
                pending = item;
                root.querySelector(":scope > [data-admin-message]")?.remove();
                for (const each of buttons)
                    each.disabled = true;
                button.textContent = "다시 확인 중…";
                try {
                    const response = await fetch(INGESTION, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ url: item.dataset.adminUrl, targetMemeId, retry: true }),
                    });
                    const payload = await response.json();
                    if (!response.ok || !payload || typeof payload !== "object" || payload.ok !== true) {
                        say("error", "수동 재시도를 기록하지 못했어요. 입력과 운영자 권한을 확인해 주세요.");
                        return;
                    }
                    say("success", payload.warning === "recovery_resolution_failed"
                        ? "출처 재확인은 성공했어요. 다만 이전 복구 기록 정리가 완료되지 않았어요. 이 성공한 요청을 다시 제출하지 말고 상태를 운영자 검토 대상으로 남겨 주세요."
                        : "같은 출처를 선택한 밈에 다시 확인 요청했어요. 승인이나 원본 확인을 뜻하지 않아요.");
                }
                catch {
                    say("error", "수동 재시도에 실패했어요. 네트워크 상태를 확인해 주세요.");
                }
                finally {
                    pending = null;
                    for (const each of buttons)
                        each.disabled = false;
                    button.textContent = label;
                }
            });
        }
    };
    const COMPONENTS = {
        user: userControls,
        "source-ingestion": sourceIngestion,
        "source-recovery": sourceRecovery,
        "source-review": sourceReview,
        submission: submissionReview,
        contribution: contributionReview,
        inquiry: inquiryActions,
        "radar-review": radarReview,
        report: refreshButtons("rounded-lg bg-safety-red-bg p-3 text-base text-safety-red"),
        ...translationComponents({ post, element }),
        ...memeComponents({ post, element }),
        ...editorComponents({ post, element }),
    };
    document.addEventListener("change", (event) => {
        const select = event.target;
        if (!(select instanceof HTMLSelectElement))
            return;
        const icon = select.parentElement?.querySelector(":scope > [data-admin-safety-icon]");
        if (!icon || !(select.value in SAFETY_ICON))
            return;
        icon.textContent = SAFETY_ICON[select.value];
        icon.style.color = `var(--safety-${select.value})`;
    });
    for (const root of document.querySelectorAll("[data-admin-controls]")) {
        COMPONENTS[root.dataset.adminControls]?.(root);
    }
    restoreFlash();
}
})();
