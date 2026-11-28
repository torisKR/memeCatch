(() => {
"use strict";
const lib = {};
lib.analytics = { track: (...args) => window.memecatch.track(...args) };
lib.homeScrollBinding = (() => {
const READY_ATTRIBUTE = "data-home-scroll-ready";
const PROGRESS_ATTRIBUTE = "data-home-scroll-progress";
const PROGRESS_PROPERTY = "--home-scroll-progress";
function clampProgress(value) {
    if (!Number.isFinite(value))
        return 0;
    return Math.min(1, Math.max(0, value));
}
function stickyProgress(track, pin, pinTop) {
    const trackRect = track.getBoundingClientRect();
    const pinRect = pin.getBoundingClientRect();
    const computedTop = Number.parseFloat(pinTop);
    if (!Number.isFinite(computedTop)
        || !Number.isFinite(trackRect.top)
        || !Number.isFinite(trackRect.height)
        || !Number.isFinite(pinRect.height)) {
        return 0;
    }
    const travel = Math.max(trackRect.height - pinRect.height, 1);
    return clampProgress((computedTop - trackRect.top) / travel);
}
function naturalFlowProgress(stage) {
    const stageRect = stage.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    if (!Number.isFinite(stageRect.top)
        || !Number.isFinite(stageRect.height)
        || stageRect.height <= 0
        || !Number.isFinite(viewportHeight)
        || viewportHeight <= 0) {
        return 0;
    }
    const start = viewportHeight * 0.8;
    const end = -(stageRect.height * 0.4);
    const range = start - end;
    if (!Number.isFinite(range) || range <= 0)
        return 0;
    return clampProgress((start - stageRect.top) / range);
}
function restoreAttribute(element, name, previousValue) {
    if (previousValue === null) {
        element.removeAttribute(name);
        return;
    }
    element.setAttribute(name, previousValue);
}
function mountHomeScrollBinding({ stage, track, range = track, pin, onProgress, }) {
    const previousReady = track.getAttribute(READY_ATTRIBUTE);
    const previousProgress = track.getAttribute(PROGRESS_ATTRIBUTE);
    const previousProgressProperty = track.style.getPropertyValue(PROGRESS_PROPERTY);
    const previousProgressPriority = track.style.getPropertyPriority(PROGRESS_PROPERTY);
    const scrollListenerOptions = { passive: true };
    let disposed = false;
    let frameId = null;
    let lastWrittenProgress = null;
    const isHidden = () => document.visibilityState === "hidden";
    function computeProgress() {
        const pinStyle = window.getComputedStyle(pin);
        return pinStyle.position === "sticky"
            ? stickyProgress(range, pin, pinStyle.top)
            : naturalFlowProgress(stage);
    }
    function update() {
        if (disposed || isHidden())
            return;
        const progress = computeProgress();
        const serializedProgress = String(progress);
        if (serializedProgress !== lastWrittenProgress) {
            track.setAttribute(PROGRESS_ATTRIBUTE, serializedProgress);
            track.style.setProperty(PROGRESS_PROPERTY, serializedProgress);
            lastWrittenProgress = serializedProgress;
        }
        onProgress(progress);
    }
    function cancelPendingFrame() {
        if (frameId === null)
            return;
        cancelAnimationFrame(frameId);
        frameId = null;
    }
    function refresh() {
        if (disposed || isHidden())
            return;
        cancelPendingFrame();
        update();
    }
    function scheduleUpdate() {
        if (disposed || isHidden() || frameId !== null)
            return;
        frameId = requestAnimationFrame(() => {
            frameId = null;
            update();
        });
    }
    function onVisibilityChange() {
        if (isHidden()) {
            cancelPendingFrame();
            return;
        }
        refresh();
    }
    track.setAttribute(READY_ATTRIBUTE, "true");
    window.addEventListener("scroll", scheduleUpdate, scrollListenerOptions);
    window.addEventListener("resize", scheduleUpdate);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const resizeObserver = typeof ResizeObserver === "function"
        ? new ResizeObserver(scheduleUpdate)
        : null;
    resizeObserver?.observe(stage);
    resizeObserver?.observe(track);
    resizeObserver?.observe(pin);
    if (range !== track)
        resizeObserver?.observe(range);
    refresh();
    return {
        refresh,
        dispose() {
            if (disposed)
                return;
            disposed = true;
            cancelPendingFrame();
            resizeObserver?.disconnect();
            window.removeEventListener("scroll", scheduleUpdate, scrollListenerOptions);
            window.removeEventListener("resize", scheduleUpdate);
            document.removeEventListener("visibilitychange", onVisibilityChange);
            restoreAttribute(track, READY_ATTRIBUTE, previousReady);
            restoreAttribute(track, PROGRESS_ATTRIBUTE, previousProgress);
            if (previousProgressProperty) {
                track.style.setProperty(PROGRESS_PROPERTY, previousProgressProperty, previousProgressPriority);
            }
            else {
                track.style.removeProperty(PROGRESS_PROPERTY);
            }
        },
    };
}
return { mountHomeScrollBinding };
})();
lib.dailyQuiz = (() => {
function kstDayKey(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Seoul",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).format(now);
}
function hashCode(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++)
        h = (h * 31 + s.charCodeAt(i)) | 0;
    return Math.abs(h);
}
function seededRng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const SHORT_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function dailyPivot(dayKey) {
    const rng = seededRng(hashCode(`daily-quiz:${dayKey}`));
    return Array.from({ length: 8 }, () => SHORT_ID_ALPHABET[Math.floor(rng() * SHORT_ID_ALPHABET.length)]).join("");
}
function previousDayKey(dayKey) {
    const [y, m, d] = dayKey.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
}
const LOCAL_STREAK_KEY = "mc_daily_quiz_v1";
function parseLocalRecord(raw) {
    if (!raw)
        return null;
    try {
        const v = JSON.parse(raw);
        if (typeof v.lastDate !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(v.lastDate) ||
            typeof v.streak !== "number" ||
            typeof v.best !== "number" ||
            typeof v.total !== "number" ||
            typeof v.lastSelected !== "number" ||
            typeof v.lastCorrect !== "boolean") {
            return null;
        }
        return v;
    }
    catch {
        return null;
    }
}
function statusFromLocal(record, today) {
    if (!record) {
        return { quizDate: today, answeredToday: false, correctToday: null, currentStreak: 0, bestStreak: 0, totalDays: 0 };
    }
    const answeredToday = record.lastDate === today;
    const alive = answeredToday || record.lastDate === previousDayKey(today);
    return {
        quizDate: today,
        answeredToday,
        correctToday: answeredToday ? record.lastCorrect : null,
        currentStreak: alive ? record.streak : 0,
        bestStreak: record.best,
        totalDays: record.total,
    };
}
function recordLocalAnswer(record, today, selected, correct) {
    if (record?.lastDate === today)
        return record;
    const continues = record?.lastDate === previousDayKey(today);
    const streak = continues ? record.streak + 1 : 1;
    return {
        lastDate: today,
        streak,
        best: Math.max(record?.best ?? 0, streak),
        total: (record?.total ?? 0) + 1,
        lastSelected: selected,
        lastCorrect: correct,
    };
}
function statusFromRpcRow(row) {
    return {
        quizDate: row.quiz_date,
        answeredToday: row.completed_at !== null,
        correctToday: row.completed_at !== null ? row.correct : null,
        currentStreak: row.current_streak,
        bestStreak: row.best_streak,
        totalDays: row.total_days,
    };
}
return { kstDayKey, hashCode, seededRng, dailyPivot, previousDayKey, LOCAL_STREAK_KEY, parseLocalRecord, statusFromLocal, recordLocalAnswer, statusFromRpcRow };
})();
const { mountHomeScrollBinding } = lib.homeScrollBinding;
const { LOCAL_STREAK_KEY, kstDayKey, parseLocalRecord, recordLocalAnswer, statusFromLocal, statusFromRpcRow, } = lib.dailyQuiz;
const { track } = lib.analytics;
const data = JSON.parse(document.getElementById("home-data")?.textContent ?? "null");
function h(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        if (value === null || value === undefined || value === false)
            continue;
        element.setAttribute(name, value === true ? "" : String(value));
    }
    element.append(...children.flat().filter((child) => child !== null && child !== undefined && child !== false));
    return element;
}
function shouldUseStaticFallback() {
    return navigator.connection?.saveData === true
        || (navigator.deviceMemory !== undefined && navigator.deviceMemory <= 2);
}
function supportsWebGl() {
    try {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("webgl2", { powerPreference: "low-power" })
            ?? canvas.getContext("webgl", { powerPreference: "low-power" });
        context?.getExtension?.("WEBGL_lose_context")?.loseContext();
        return context !== null;
    }
    catch {
        return false;
    }
}
const TOKEN = { true: ["1", "#ff8356", "6"], false: ["0.72", "#777d82", "2.5"] };
const PLAY_PATH = '<path d="m5 3 9 6-9 6V3Z" fill="currentColor"></path>';
const PAUSE_PATH = '<path d="M5.5 3v12M12.5 3v12" stroke="currentColor" stroke-linecap="round" stroke-width="2.5"></path>';
const HIDDEN = "home-story-scene-view-hidden";
function scene() {
    const figure = document.querySelector("[data-story-scene]");
    if (!figure || !data?.scene)
        return;
    const copy = data.scene;
    const fallback = figure.querySelector("[data-home-scene-fallback]");
    const host = figure.querySelector(".home-story-scene-view-canvas");
    const panel = figure.querySelector("[data-scene-control-dock]");
    const disclosure = figure.querySelector("details[data-story-controls]");
    const cue = figure.querySelector("[data-scene-scroll-cue]");
    const cueText = cue.querySelector(".home-story-scene-view-progress-text");
    const explanation = panel.querySelector("[aria-live]");
    const signalSet = panel.querySelector("fieldset:not([data-scene-layout-controls])");
    const ready = figure.querySelector("template[data-scene-ready]").content;
    let rendererState = "fallback";
    let selected = "green";
    let layoutMode = "scroll";
    let reduced = false;
    let userPaused = false;
    let mode = "scroll";
    let systemReduced = false;
    let inViewport = false;
    let pageVisible = document.visibilityState !== "hidden";
    let importStarted = false;
    let controller = null;
    let scrollBinding = null;
    let scrollRefresh = null;
    let scrollProgress = 0;
    let playback = null;
    const isPaused = () => userPaused || systemReduced || !inViewport || !pageVisible;
    const disconnectScroll = () => {
        scrollBinding?.dispose();
        scrollBinding = null;
        scrollRefresh = null;
    };
    function render() {
        const isReady = rendererState === "ready";
        const unavailable = rendererState === "failed" || rendererState === "static";
        const showLayout = !copy.korean || isReady;
        figure.dataset.renderer = rendererState;
        figure.dataset.layoutMode = layoutMode;
        fallback.classList.toggle(HIDDEN, isReady);
        host.classList.toggle(HIDDEN, !isReady);
        let layout = panel.querySelector("[data-scene-layout-controls]");
        let reset = panel.querySelector("[data-scene-reset]");
        if (showLayout && !layout) {
            layout = ready.querySelector("[data-scene-layout-controls]").cloneNode(true);
            panel.prepend(layout);
            reset = ready.querySelector("[data-scene-reset]").cloneNode(true);
            panel.append(reset);
        }
        for (const radio of layout?.querySelectorAll("input") ?? []) {
            radio.checked = radio.value === layoutMode;
            radio.disabled = !isReady;
        }
        if (reset)
            reset.disabled = !isReady;
        let status = panel.querySelector(":scope > p[role=status]:not([aria-live])");
        if (showLayout && !isReady) {
            if (!status) {
                status = h("p", { role: "status" });
                layout.after(status);
            }
            status.textContent = unavailable ? copy.unavailable : copy.loading;
        }
        else {
            status?.remove();
        }
        for (const button of signalSet.querySelectorAll("[data-scene-signal]")) {
            button.setAttribute("aria-pressed", String(button.dataset.sceneSignal === selected));
        }
        const signal = copy.signals[selected];
        explanation.replaceChildren(h("strong", {}, signal.label), ` · ${signal.summary}`);
        fallback.dataset.selectedSignal = selected;
        for (const token of fallback.querySelectorAll("[data-signal-level]")) {
            const chosen = token.dataset.signalLevel === selected;
            const [opacity, stroke, width] = TOKEN[chosen];
            token.dataset.selected = String(chosen);
            token.setAttribute("opacity", opacity);
            const ring = token.querySelector('circle[r="33"]');
            ring.setAttribute("stroke", stroke);
            ring.setAttribute("stroke-width", width);
        }
        cue.hidden = layoutMode !== "scroll";
        const paused = userPaused || reduced;
        cueText.textContent = unavailable ? copy.unavailable : reduced ? copy.reduced : paused ? copy.paused : copy.hint;
        if (isReady && !playback) {
            playback = ready.querySelector("[data-scene-playback]").cloneNode(true);
            cue.after(playback);
        }
        if (playback && !isReady) {
            playback.remove();
            playback = null;
        }
        if (playback) {
            playback.setAttribute("aria-label", paused ? copy.play : copy.pause);
            playback.disabled = reduced;
            playback.querySelector("svg").innerHTML = paused ? PLAY_PATH : PAUSE_PATH;
        }
    }
    const syncPause = () => {
        controller?.setPaused(isPaused());
        if (!isPaused())
            scrollRefresh?.();
    };
    async function loadRenderer() {
        if (importStarted || !inViewport)
            return;
        importStarted = true;
        rendererState = "loading";
        render();
        try {
            const { mountHomeScene } = await import(copy.module);
            const stage = figure.querySelector("[data-home-scene-stage]");
            const track = figure.closest("[data-home-scroll-track]");
            const pin = track?.querySelector("[data-home-scroll-pin]");
            if (stage && track && pin) {
                scrollBinding = mountHomeScrollBinding({
                    stage,
                    track,
                    pin,
                    range: track.querySelector("[data-home-scroll-range]") ?? track,
                    onProgress(progress) {
                        scrollProgress = progress;
                        if (mode !== "scroll" || isPaused())
                            return;
                        controller?.setScrollProgress(progress);
                        cue.style.setProperty("--scene-scroll-progress", String(progress));
                        cue.dataset.phase = String(Math.min(2, Math.floor(progress * 3)));
                    },
                });
                scrollRefresh = scrollBinding.refresh;
            }
            controller = mountHomeScene(host, {
                maxPixelRatio: 1.5,
                scrollProgress: mode === "scroll" && !systemReduced ? scrollProgress : null,
                selectedSignal: selected,
                onSignalSelect: (level) => {
                    selected = level;
                    render();
                },
                paused: isPaused(),
                onContextLost: () => {
                    track?.setAttribute("data-home-scroll-retained", "true");
                    disconnectScroll();
                    controller?.dispose();
                    controller = null;
                    mode = "stacked";
                    layoutMode = "stacked";
                    rendererState = "failed";
                    render();
                },
            });
            scrollBinding?.refresh();
            rendererState = "ready";
            render();
        }
        catch {
            disconnectScroll();
            rendererState = "failed";
            render();
        }
    }
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    if (motion.matches) {
        systemReduced = true;
        queueMicrotask(() => {
            reduced = true;
            render();
        });
    }
    document.addEventListener("visibilitychange", () => {
        pageVisible = document.visibilityState !== "hidden";
        syncPause();
    });
    motion.addEventListener("change", (event) => {
        systemReduced = event.matches;
        reduced = event.matches;
        render();
        syncPause();
    });
    figure.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const signal = target?.closest("[data-scene-signal]");
        if (signal) {
            selected = signal.dataset.sceneSignal;
            render();
            controller?.setSelectedSignal(selected);
            return;
        }
        if (target?.closest("[data-scene-reset]")) {
            controller?.resetView();
            return;
        }
        if (target?.closest("[data-scene-playback]")) {
            if (systemReduced)
                return;
            userPaused = !userPaused;
            render();
            controller?.setPaused(userPaused || !inViewport || !pageVisible);
            if (!userPaused)
                scrollRefresh?.();
        }
    });
    figure.addEventListener("change", (event) => {
        const radio = event.target instanceof HTMLInputElement ? event.target.closest("[data-scene-layout]") : null;
        if (!radio || !controller)
            return;
        mode = radio.value;
        layoutMode = mode;
        render();
        if (mode === "scroll") {
            scrollRefresh?.();
            if (!userPaused && !systemReduced)
                controller.setScrollProgress(scrollProgress);
        }
        else {
            controller.setScrollProgress(null);
            controller.setLayoutMode(mode);
        }
    });
    figure.addEventListener("keydown", (event) => {
        if (event.key !== "Escape" || !disclosure.open)
            return;
        disclosure.open = false;
        disclosure.querySelector("summary")?.focus();
    });
    if (shouldUseStaticFallback() || !supportsWebGl()) {
        queueMicrotask(() => {
            rendererState = "static";
            render();
        });
    }
    else if (typeof IntersectionObserver === "undefined") {
        inViewport = true;
        void loadRenderer();
    }
    else {
        new IntersectionObserver(([entry]) => {
            inViewport = entry?.isIntersecting ?? false;
            if (inViewport)
                void loadRenderer();
            syncPause();
        }, { rootMargin: "0px", threshold: 0.05 }).observe(host);
    }
}
function discovery() {
    const root = document.querySelector("[data-home-discovery]");
    const copy = data?.discovery;
    if (!root || !copy?.entries.length)
        return;
    const entries = copy.entries;
    const form = root.querySelector("form");
    const input = form.querySelector("input");
    const scope = form.querySelector("p");
    const archiveTemplate = form.querySelector("template[data-discovery-archive]");
    const chips = [...root.querySelectorAll("[role=group] button")];
    const status = root.querySelector("p[role=status]");
    const grid = root.querySelector(".home-discovery-content-grid");
    const list = grid.querySelector(".home-discovery-deck");
    const items = [...list.children];
    const imageOnly = list.hasAttribute("data-image-only");
    const failedArt = '[data-meme-card-art="fallback"]';
    const preview = grid.querySelector(".home-discovery-preview");
    const emptyTemplate = root.querySelector("template[data-discovery-empty]");
    const searchPath = form.getAttribute("action");
    let query = "";
    let category = null;
    let previewIndex = 0;
    let shown = entries.length;
    let archive = null;
    const archiveLabel = document.createTextNode("");
    let empty = null;
    const normalize = (value) => value.normalize("NFKC").toLocaleLowerCase().trim();
    function render() {
        const needle = normalize(query);
        const available = entries
            .map((entry, position) => ({ entry, position }))
            .filter(({ position }) => !imageOnly || !items[position].querySelector(failedArt));
        const visible = available.filter(({ entry }) => (category === null || entry.category === category)
            && (needle === "" || normalize(entry.text).includes(needle)));
        shown = visible.length;
        for (const [position, item] of items.entries())
            item.hidden = !visible.some((match) => match.position === position);
        for (const chip of chips)
            chip.setAttribute("aria-pressed", String((chip.dataset.category ?? null) === category));
        status.textContent = copy.status.replace("{visible}", visible.length).replace("{total}", available.length);
        const archiveQuery = query.normalize("NFKC").trim();
        if (archiveQuery) {
            if (!archive) {
                archive = archiveTemplate.content.firstElementChild.cloneNode(true);
                archive.prepend(archiveLabel);
            }
            if (!archive.isConnected)
                scope.after(archive);
            archiveLabel.textContent = copy.archive.replace("{query}", archiveQuery);
            archive.setAttribute("href", `${searchPath}?${new URLSearchParams({ q: archiveQuery })}`);
        }
        else {
            archive?.remove();
        }
        grid.hidden = visible.length === 0;
        if (visible.length === 0) {
            if (!empty) {
                empty = emptyTemplate.content.firstElementChild.cloneNode(true);
                empty.querySelector("button").addEventListener("click", () => {
                    query = "";
                    input.value = "";
                    category = null;
                    previewIndex = 0;
                    render();
                });
            }
            grid.after(empty);
            return;
        }
        empty?.remove();
        const current = visible[previewIndex % visible.length].entry;
        preview.querySelector(".home-discovery-preview-header span").textContent = String((previewIndex % visible.length) + 1).padStart(2, "0");
        preview.querySelector(".home-discovery-preview-record").replaceChildren(h("span", {}, current.category), h("strong", {}, current.title), current.original ? h("span", {}, `${copy.originalLabel} `, h("span", { lang: "ko" }, current.original)) : null);
        const link = preview.querySelector(".home-discovery-preview-link");
        link.setAttribute("href", current.href);
        link.setAttribute("aria-label", `${copy.previewAction}: ${current.title}`);
        preview.querySelector(".home-discovery-next-button").disabled = visible.length < 2;
    }
    input.addEventListener("input", () => {
        query = input.value;
        previewIndex = 0;
        render();
    });
    for (const chip of chips) {
        chip.addEventListener("click", () => {
            category = chip.dataset.category ?? null;
            previewIndex = 0;
            render();
        });
    }
    if (imageOnly) {
        list.addEventListener("meme-card:art-unavailable", render);
        if (list.querySelector(failedArt))
            render();
    }
    preview.querySelector(".home-discovery-next-button").addEventListener("click", () => {
        previewIndex = (previewIndex + 1) % shown;
        render();
    });
}
const SHOWCASE_TAB = "min-h-[44px] rounded-xl px-3.5 py-2 transition-all active:scale-[0.98]";
const SHOWCASE_ON = "bg-accent-strong text-white shadow-sm";
const SHOWCASE_OFF = "text-muted hover:text-foreground";
function showcase() {
    const root = document.querySelector("[data-showcase]");
    if (!root)
        return;
    const grid = root.querySelector("[data-showcase-grid]");
    const tabs = [...root.querySelectorAll("[data-showcase-tab]")];
    for (const tab of tabs) {
        tab.addEventListener("click", () => {
            for (const other of tabs)
                other.className = `${SHOWCASE_TAB} ${other === tab ? SHOWCASE_ON : SHOWCASE_OFF}`;
            const panel = root.querySelector(`template[data-showcase-panel="${tab.dataset.showcaseTab}"]`);
            grid.replaceChildren(panel.content.cloneNode(true));
        });
    }
}
const OPTION = "flex min-h-[50px] w-full items-center justify-between rounded-xl border p-4 text-left text-sm transition-all sm:text-base active:scale-[0.99]";
const COPY_BUTTON = "inline-flex items-center justify-center font-medium transition-all active:scale-95 select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent h-7 px-2 text-[11px] rounded-md border border-border/80 bg-surface text-muted hover:text-foreground hover:border-accent/50 self-start sm:self-auto shrink-0";
const COPIED_MS = 2000;
const RESULTS = [
    [5, "🎉 ", "완벽한 밈 센스 & TPO 안전 마스터!", "직장과 일상 소통의 경계를 완벽히 짚어내며, 밈을 위트 있게 활용할 줄 아는 최상위 소통 능력자입니다."],
    [3, "👍 ", "안정적인 밈 센스를 갖추셨습니다!", "대체로 밈의 안전성을 잘 판별하고 계시며, 조금 애매한 밈은 밈캐치 사전에서 맥락과 대체어를 확인하면 더욱 완벽해집니다."],
    [0, "💡 ", "위험한 밈 사용에 주의가 필요해요!", "악의 없는 유행어라도 상대방에게는 상처나 갈등이 될 수 있습니다. 밈캐치의 TPO별 신호등 가이드를 적극 참고해 보세요!"],
];
function diagnostic() {
    const root = document.querySelector("[data-diagnostic]");
    const questions = data?.diagnostic;
    if (!root || !questions?.length)
        return;
    const [checkMark, crossMark, rightIcon, wrongIcon, copyIcon, copiedIcon, linkArrow, nextArrow, sparkles, again] = [...root.querySelector("template[data-diagnostic-icons]").content.children];
    const icon = (node) => node.cloneNode(true);
    const counter = root.querySelector("[data-diagnostic-counter]");
    const progress = root.querySelector("[data-diagnostic-progress]");
    let body = root.querySelector("[data-diagnostic-body]");
    let index = 0;
    let answered = false;
    let score = 0;
    function update() {
        counter.querySelector(".text-accent").textContent = String(index + 1);
        progress.firstElementChild.style.width = `${Math.round(((index + (answered ? 1 : 0)) / questions.length) * 100)}%`;
    }
    function questionView(question) {
        return h("div", { class: "relative mt-6 space-y-6", "data-diagnostic-body": true }, h("div", { class: "space-y-2" }, h("div", { class: "inline-block rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-foreground" }, question.situation), h("h4", { class: "text-lg font-bold leading-snug text-foreground sm:text-xl" }, question.scenario), h("div", { class: "flex items-center gap-2 pt-1 text-sm text-muted" }, h("span", {}, "판별 대상 밈:"), h("span", { class: "font-semibold text-foreground underline decoration-accent/50 underline-offset-4" }, question.targetMeme))), h("div", { class: "grid gap-3" }, question.options.map((option) => h("button", { type: "button", class: `${OPTION} border-border bg-surface-2 hover:border-accent/40 text-foreground` }, h("span", { class: "flex-1 pr-3 leading-relaxed" }, option.label)))));
    }
    function copyButton(text) {
        const idle = () => [icon(copyIcon), h("span", { class: "ml-1" }, "대체어 복사")];
        const button = h("button", { type: "button", "aria-label": "안전 대체어 복사", title: "안전 대체어 복사", class: COPY_BUTTON }, idle());
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            try {
                await navigator.clipboard.writeText(text);
                navigator.vibrate?.(15);
                button.replaceChildren(icon(copiedIcon), h("span", { class: "ml-1 font-semibold text-safety-green" }, "복사됨!"));
                setTimeout(() => button.replaceChildren(...idle()), COPIED_MS);
            }
            catch {
            }
        });
        return button;
    }
    function answer(choice) {
        if (answered)
            return;
        const question = questions[index];
        answered = true;
        const right = question.options[choice].isCorrect;
        if (right)
            score += 1;
        for (const [position, button] of [...body.querySelectorAll(".grid button")].entries()) {
            const option = question.options[position];
            const state = option.isCorrect
                ? "border-safety-green/60 bg-safety-green/10 text-foreground font-semibold ring-2 ring-safety-green/50"
                : position === choice
                    ? "border-safety-red/60 bg-safety-red/10 text-foreground font-semibold ring-2 ring-safety-red/50"
                    : "opacity-40 border-border bg-surface-2 text-muted";
            button.className = `${OPTION} ${state}`;
            button.disabled = true;
            button.append(h("span", { class: "shrink-0" }, option.isCorrect ? icon(checkMark) : position === choice ? icon(crossMark) : null));
        }
        const last = index + 1 >= questions.length;
        const next = h("button", { type: "button", class: "inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all hover:opacity-95 active:scale-95" }, h("span", {}, last ? "결과 확인하기" : "다음 문항 풀기"), icon(nextArrow));
        next.addEventListener("click", advance);
        body.append(h("div", { class: "rounded-2xl border border-border bg-surface-2 p-5 space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300" }, h("div", { class: "flex items-center gap-2" }, right
            ? h("div", { class: "flex items-center gap-2 font-bold text-safety-green" }, icon(rightIcon), h("span", {}, "정답입니다! 정확한 밈 판별 감각을 지니셨네요."))
            : h("div", { class: "flex items-center gap-2 font-bold text-safety-red" }, icon(wrongIcon), h("span", {}, "주의가 필요해요! 상황별 파급력을 꼭 확인하세요."))), h("p", { class: "text-sm leading-relaxed text-foreground/90" }, question.explanation), h("div", { class: "flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-surface p-3.5" }, h("div", { class: "text-xs sm:text-sm" }, h("span", { class: "font-bold text-accent" }, "안전 대체 표현: "), h("span", { class: "text-foreground font-medium" }, `“${question.safeAlternative}”`)), copyButton(question.safeAlternative)), h("div", { class: "flex items-center justify-between pt-2 border-t border-border/60" }, question.linked
            ? h("a", { href: question.memeHref, class: "text-xs font-semibold text-muted hover:text-accent flex items-center gap-1" }, `‘${question.targetMeme.split(" ")[0]}’ 상세 사전 보기`, icon(linkArrow))
            : h("span"), next)));
        update();
    }
    function show(view) {
        if (view !== body)
            body.replaceWith(view);
        body = view;
        for (const [position, button] of [...body.querySelectorAll(".grid button")].entries()) {
            button.addEventListener("click", () => answer(position));
        }
    }
    function advance() {
        if (index + 1 < questions.length) {
            index += 1;
            answered = false;
            update();
            show(questionView(questions[index]));
            return;
        }
        const [, emoji, headline, detail] = RESULTS.find(([from]) => (from === 5 ? score === 5 : score >= from));
        counter.hidden = true;
        progress.hidden = true;
        const reset = h("button", { type: "button", class: "inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-bold text-foreground hover:border-accent hover:text-accent shadow-xs active:scale-95" }, icon(again), h("span", {}, "진단 다시 풀기"));
        reset.addEventListener("click", () => {
            index = 0;
            answered = false;
            score = 0;
            counter.hidden = false;
            progress.hidden = false;
            update();
            show(questionView(questions[0]));
        });
        show(h("div", { class: "relative mt-8 space-y-6 text-center" }, h("div", { class: "inline-flex size-16 items-center justify-center rounded-3xl bg-accent/15 text-accent shadow-inner" }, icon(sparkles)), h("div", { class: "space-y-2" }, h("h4", { class: "text-2xl font-black text-foreground sm:text-3xl" }, "자가진단 완료!"), h("p", { class: "text-base text-muted" }, `총 ${questions.length}문항 중 `, h("strong", { class: "text-accent text-lg" }, `${score}문항`), "을 맞히셨습니다.")), h("div", { class: "mx-auto max-w-md rounded-2xl border border-border bg-surface-2 p-5 text-sm leading-relaxed text-foreground" }, h("p", {}, emoji, h("strong", {}, headline), h("br"), detail)), h("div", { class: "flex flex-wrap items-center justify-center gap-3 pt-2" }, reset, h("a", { href: "/explore", class: "inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-accent-strong px-5 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-95 active:scale-95" }, h("span", {}, "트렌드 밈 탐색하기"), icon(nextArrow)))));
    }
    show(body);
}
const OPTION_BASE = "flex w-full min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
async function rpcSingle(fn, args) {
    const plan = {
        op: "rpc",
        fn,
        fields: [{ kind: "star" }],
        filters: [],
        orGroups: [],
        orders: [],
        limit: null,
        offset: null,
        single: true,
        maybeSingle: false,
        count: null,
        head: false,
        onConflict: null,
        ignoreDuplicates: false,
        returning: true,
        args,
    };
    const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ plan }),
    });
    return response.json();
}
function readLocal() {
    try {
        return parseLocalRecord(window.localStorage.getItem(LOCAL_STREAK_KEY));
    }
    catch {
        return null;
    }
}
function writeLocal(record) {
    try {
        window.localStorage.setItem(LOCAL_STREAK_KEY, JSON.stringify(record));
    }
    catch {
    }
}
async function loadServerStatus() {
    const response = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" });
    const body = response.ok ? await response.json() : null;
    if (!body?.user)
        return null;
    const { data: row, error } = await rpcSingle("get_daily_meme_quiz_status", {});
    return error || !row ? null : statusFromRpcRow(row);
}
async function completeOnServer(shortId, correct) {
    const { data: row, error } = await rpcSingle("complete_daily_meme_quiz", { p_meme_short_id: shortId, p_correct: correct });
    return !error && row ? statusFromRpcRow(row) : null;
}
function dailyQuiz() {
    const section = document.querySelector("[data-daily-quiz]");
    if (!section)
        return;
    const compact = section.dataset.dailyQuiz === "compact";
    const card = section.firstElementChild;
    const heading = card.querySelector("h2");
    const top = heading.parentElement;
    const loading = card.querySelector("p[role=status]");
    let question = null;
    let day = null;
    let status = null;
    let signedIn = false;
    let selected = null;
    let options = null;
    let footer = null;
    let verdict = null;
    const answered = () => selected !== null || status?.answeredToday === true;
    function renderBadge() {
        top.querySelector("[data-streak]")?.remove();
        if (!status)
            return;
        const streak = status.currentStreak;
        top.append(h("p", {
            class: "stat-mono inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm font-bold",
            "aria-label": `연속 출석 ${streak}일, 최고 ${status.bestStreak}일`,
            "data-streak": true,
        }, h("span", { "aria-hidden": "true" }, "🔥"), `${streak}일 연속`, status.bestStreak > streak ? h("span", { class: "font-normal text-muted" }, `· 최고 ${status.bestStreak}일`) : null));
    }
    function renderQuestion() {
        if (!question)
            return;
        if (!options) {
            options = h("ol", { class: "mt-3 space-y-2" }, question.options.map((option, position) => {
                const button = h("button", { type: "button" }, h("span", { "aria-hidden": "true", class: "grid size-6 shrink-0 place-items-center rounded-md border border-current/30 text-xs font-bold" }, String(position + 1)), h("span", { class: "min-w-0 flex-1" }, option));
                button.addEventListener("click", () => void choose(position));
                return h("li", {}, button);
            }));
            loading.replaceWith(h("p", { class: "mt-3 font-semibold leading-snug sm:text-lg" }, question.question), options);
        }
        const isAnswered = answered();
        for (const [position, button] of [...options.querySelectorAll("button")].entries()) {
            let state = "border-border bg-surface hover:border-accent";
            if (isAnswered) {
                if (position === question.answerIndex)
                    state = "border-safety-green bg-safety-green-bg text-safety-green";
                else if (position === selected)
                    state = "border-safety-red bg-safety-red-bg text-safety-red";
                else
                    state = "border-border bg-surface text-muted opacity-70";
            }
            button.className = `${OPTION_BASE} ${state}`;
            button.disabled = isAnswered;
            button.setAttribute("aria-pressed", String(position === selected));
        }
        verdict?.remove();
        verdict = null;
        if (isAnswered && selected !== null) {
            verdict = h("p", { class: "mt-3 text-sm font-semibold" }, selected === question.answerIndex
                ? h("span", { class: "text-safety-green" }, "정답! 밈력이 느껴져요.")
                : h("span", { class: "text-safety-red" }, `아쉬워요, 정답은 ${question.answerIndex + 1}번이에요.`));
            options.after(verdict);
        }
        footer?.remove();
        footer = null;
        if (!isAnswered)
            return;
        const streak = status?.currentStreak ?? 0;
        footer = h("div", { class: "mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4" }, h("p", { role: "status", class: "text-sm font-semibold" }, streak > 1 ? `${streak}일 연속 출석! 내일도 이어가요.` : "출석 완료! 내일 새 문제가 열려요.", signedIn ? null : h("span", { class: "mt-1 block text-xs font-normal text-muted" }, "지금은 이 기기에만 기록돼요. ", h("a", { href: "/login?next=/my", class: "font-semibold text-accent-text underline-offset-4 hover:underline" }, "로그인"), "하면 MY에서 연속 출석을 이어갈 수 있어요.")), h("div", { class: "flex flex-wrap items-center gap-2" }, h("a", { href: `/memes/${question.meme.shortId}-${question.meme.slug}`, class: "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent" }, "이 밈 보러가기"), compact ? null : h("a", { href: "/quiz", class: "inline-flex min-h-11 items-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.97]" }, "10문제 더 풀기")));
        card.append(footer);
    }
    function render() {
        renderBadge();
        renderQuestion();
    }
    async function choose(position) {
        if (!question || answered())
            return;
        const today = day ?? kstDayKey();
        const correct = position === question.answerIndex;
        selected = position;
        track("quiz_complete", { mode: "daily", score: correct ? 1 : 0 });
        const next = recordLocalAnswer(readLocal(), today, position, correct);
        writeLocal(next);
        status = statusFromLocal(next, today);
        render();
        if (!signedIn)
            return;
        const saved = await completeOnServer(question.meme.shortId, correct).catch(() => null);
        if (saved) {
            status = saved;
            render();
        }
    }
    let unsynced = null;
    let settled = 0;
    async function sync() {
        settled += 1;
        if (settled < 2 || unsynced === null || !question)
            return;
        const choice = unsynced;
        unsynced = null;
        const saved = await completeOnServer(question.meme.shortId, choice === question.answerIndex).catch(() => null);
        if (saved) {
            status = saved;
            render();
        }
    }
    (async () => {
        try {
            const response = await fetch(`/api/daily-quiz?d=${kstDayKey()}`);
            if (!response.ok) {
                response.body?.cancel().catch(() => { });
                throw new Error(String(response.status));
            }
            const result = await response.json();
            question = result.question;
            day = result.date;
            heading.append(h("span", { "aria-hidden": "true", class: "stat-mono text-xs font-normal text-muted" }, day.slice(5).replace("-", ".")));
            render();
            void sync();
        }
        catch {
            section.remove();
        }
    })();
    (async () => {
        const today = kstDayKey();
        const local = readLocal();
        const server = await loadServerStatus().catch(() => null);
        signedIn = server !== null;
        status = server ?? statusFromLocal(local, today);
        if (local?.lastDate === today) {
            selected = local.lastSelected;
            if (server && !server.answeredToday)
                unsynced = local.lastSelected;
        }
        if (section.isConnected)
            render();
        void sync();
    })();
}
const BATTLE_TAB = "min-h-11 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
function battle() {
    const root = document.querySelector("[data-battle]");
    if (!root)
        return;
    const tabs = [...root.querySelectorAll("[data-battle-tab]")];
    const panel = root.querySelector("[role=tabpanel]");
    for (const tab of tabs) {
        tab.addEventListener("click", () => {
            for (const other of tabs) {
                const chosen = other === tab;
                other.setAttribute("aria-selected", String(chosen));
                other.className = `${BATTLE_TAB} ${chosen ? "bg-background text-foreground shadow-sm" : "text-muted hover:text-foreground"}`;
            }
            panel.setAttribute("aria-labelledby", tab.id);
            panel.replaceChildren(root.querySelector(`template[data-battle-panel="${tab.dataset.battleTab}"]`).content.cloneNode(true));
        });
    }
}
const SEO_CONTENT_LOCALES = ["en", "ja", "zh", "zh-tw"];
function localeFromLanguageTag(value) {
    if (!value)
        return null;
    const parts = value.trim().toLowerCase().split(/[-_]/);
    if (parts[0] === "zh") {
        return parts.slice(1).some((part) => ["tw", "hk", "mo", "hant"].includes(part)) ? "zh-tw" : "zh";
    }
    return data.locales.includes(parts[0]) ? parts[0] : null;
}
function preferredEditionLocale(cookie, languages) {
    const entry = cookie.split("; ").find((item) => item.startsWith("memecatch_locale="));
    const saved = entry ? entry.slice("memecatch_locale=".length) : null;
    if (saved && data.locales.includes(saved))
        return SEO_CONTENT_LOCALES.includes(saved) ? saved : null;
    for (const tag of languages) {
        const detected = localeFromLanguageTag(tag);
        if (!detected)
            continue;
        if (detected === "ko")
            return null;
        if (SEO_CONTENT_LOCALES.includes(detected))
            return detected;
    }
    return null;
}
function editionHint() {
    const templates = [...document.querySelectorAll("template[data-edition-hint]")];
    if (!templates.length)
        return;
    let code = null;
    try {
        code = preferredEditionLocale(document.cookie, [...(navigator.languages ?? []), navigator.language]);
    }
    catch {
        return;
    }
    const template = templates.find((item) => item.dataset.editionHint === code);
    if (template)
        templates[0].before(template.content.cloneNode(true));
}
if (data) {
    editionHint();
    scene();
    dailyQuiz();
    discovery();
    showcase();
    diagnostic();
    battle();
}
})();
