(() => {
"use strict";
const lib = {};
lib.attribution = (() => {
const DIRECT_SOURCE = "(direct)";
const NONE_MEDIUM = "(none)";
const MAX_PARAM_LENGTH = 100;
const IN_APP_SIGNATURES = [
    { token: "barcelona", app: "threads", source: "threads" },
    { token: "instagram", app: "instagram", source: "instagram" },
    { token: "kakaotalk", app: "kakaotalk", source: "kakaotalk" },
    { token: "kakaostory", app: "kakaostory", source: "kakaostory" },
    { token: "naver(inapp", app: "naver_app", source: "naver" },
    { token: "naversearchapp", app: "naver_app", source: "naver" },
    { token: "daumapps", app: "daum_app", source: "daum" },
    { token: "band/", app: "band", source: "band" },
    { token: "line/", app: "line", source: "line" },
    { token: "everytimeapp", app: "everytime", source: "everytime" },
    { token: "bytedancewebview", app: "tiktok", source: "tiktok" },
    { token: "musical_ly", app: "tiktok", source: "tiktok" },
    { token: "twitter for", app: "twitter", source: "x" },
    { token: "twitterandroid", app: "twitter", source: "x" },
    { token: "fban", app: "facebook", source: "facebook" },
    { token: "fb_iab", app: "facebook", source: "facebook" },
    { token: "fbav", app: "facebook", source: "facebook" },
];
function detectInAppBrowser(userAgent) {
    if (!userAgent)
        return null;
    const ua = userAgent.toLowerCase();
    for (const sig of IN_APP_SIGNATURES) {
        if (ua.includes(sig.token))
            return { app: sig.app, source: sig.source };
    }
    return null;
}
const SEARCH_ENGINES = [
    ["google.", "google"],
    ["naver.", "naver"],
    ["daum.", "daum"],
    ["bing.", "bing"],
    ["yahoo.", "yahoo"],
    ["duckduckgo.", "duckduckgo"],
    ["yandex.", "yandex"],
    ["baidu.", "baidu"],
    ["ecosia.", "ecosia"],
    ["kagi.", "kagi"],
    ["zum.com", "zum"],
    ["nate.com", "nate"],
    ["search.brave.com", "brave"],
    ["chatgpt.com", "chatgpt"],
    ["chat.openai.com", "chatgpt"],
    ["perplexity.ai", "perplexity"],
    ["claude.ai", "claude"],
    ["gemini.google.com", "gemini"],
    ["copilot.microsoft.com", "copilot"],
];
const SOCIAL_DOMAINS = [
    ["threads.com", "threads"],
    ["threads.net", "threads"],
    ["instagram.com", "instagram"],
    ["facebook.com", "facebook"],
    ["fb.com", "facebook"],
    ["twitter.com", "x"],
    ["x.com", "x"],
    ["t.co", "x"],
    ["tiktok.com", "tiktok"],
    ["youtube.com", "youtube"],
    ["youtu.be", "youtube"],
    ["reddit.com", "reddit"],
    ["linkedin.com", "linkedin"],
    ["pinterest.", "pinterest"],
    ["kakao.com", "kakaotalk"],
    ["kakaocdn.net", "kakaotalk"],
    ["band.us", "band"],
    ["line.me", "line"],
    ["discord.com", "discord"],
    ["t.me", "telegram"],
    ["telegram.org", "telegram"],
    ["dcinside.com", "dcinside"],
    ["fmkorea.com", "fmkorea"],
    ["theqoo.net", "theqoo"],
    ["ppomppu.co.kr", "ppomppu"],
    ["ruliweb.com", "ruliweb"],
    ["everytime.kr", "everytime"],
    ["clien.net", "clien"],
    ["inven.co.kr", "inven"],
];
function hostOf(url) {
    if (!url)
        return null;
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host.replace(/^www\./, "") || null;
    }
    catch {
        return null;
    }
}
function classifyReferrerHost(referrerHost, selfHost) {
    if (!referrerHost)
        return null;
    if (selfHost &&
        (referrerHost === selfHost || referrerHost.endsWith(`.${selfHost}`))) {
        return null;
    }
    for (const [fragment, source] of SEARCH_ENGINES) {
        if (referrerHost.includes(fragment))
            return { source, medium: "organic" };
    }
    for (const [fragment, source] of SOCIAL_DOMAINS) {
        if (referrerHost.includes(fragment))
            return { source, medium: "social" };
    }
    return { source: referrerHost, medium: "referral" };
}
const CLICK_IDS = [
    ["gclid", "google", "cpc"],
    ["gbraid", "google", "cpc"],
    ["wbraid", "google", "cpc"],
    ["fbclid", "facebook", "social"],
    ["igshid", "instagram", "social"],
    ["ttclid", "tiktok", "cpc"],
    ["msclkid", "bing", "cpc"],
    ["twclid", "x", "social"],
];
function clean(value) {
    if (!value)
        return undefined;
    const trimmed = value.trim().slice(0, MAX_PARAM_LENGTH);
    return trimmed ? trimmed.toLowerCase() : undefined;
}
function parseUtm(search) {
    const params = typeof search === "string" ? new URLSearchParams(search) : search;
    const source = clean(params.get("utm_source")) ??
        clean(params.get("ref")) ??
        clean(params.get("source"));
    return {
        source,
        medium: clean(params.get("utm_medium")),
        campaign: clean(params.get("utm_campaign")),
        content: clean(params.get("utm_content")),
        term: clean(params.get("utm_term")),
    };
}
function parseClickId(search) {
    const params = typeof search === "string" ? new URLSearchParams(search) : search;
    for (const [param, source, medium] of CLICK_IDS) {
        if (params.get(param))
            return { source, medium };
    }
    return null;
}
function resolveAttribution(input) {
    const { search, referrer, userAgent, selfHost } = input;
    const inApp = detectInAppBrowser(userAgent);
    const referrerHost = hostOf(referrer);
    const utm = parseUtm(search);
    const base = {
        campaign: utm.campaign,
        content: utm.content,
        term: utm.term,
        referrerHost: referrerHost ?? undefined,
        inAppBrowser: inApp?.app,
    };
    if (utm.source) {
        return {
            ...base,
            source: utm.source,
            medium: utm.medium ?? (inApp ? "social" : "referral"),
            resolvedBy: "utm",
        };
    }
    const clickId = parseClickId(search);
    if (clickId) {
        return {
            ...base,
            source: clickId.source,
            medium: utm.medium ?? clickId.medium,
            resolvedBy: "click_id",
        };
    }
    if (inApp) {
        return {
            ...base,
            source: inApp.source,
            medium: utm.medium ?? "social",
            resolvedBy: "inapp",
        };
    }
    const normalizedSelf = selfHost
        ? selfHost.toLowerCase().replace(/^www\./, "")
        : null;
    const classified = classifyReferrerHost(referrerHost, normalizedSelf);
    if (classified) {
        return {
            ...base,
            source: classified.source,
            medium: utm.medium ?? classified.medium,
            resolvedBy: "referrer",
        };
    }
    return {
        ...base,
        source: DIRECT_SOURCE,
        medium: utm.medium ?? NONE_MEDIUM,
        resolvedBy: "direct",
    };
}
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;
function decideTouches(input) {
    const { current, storedFirst, storedSession, now } = input;
    const isNewUser = !storedFirst;
    const firstTouch = storedFirst ?? { ...current, ts: now };
    const sessionExpired = !storedSession || now - storedSession.ts > SESSION_TIMEOUT_MS;
    const hasFreshSignal = current.resolvedBy !== "direct";
    const sessionTouch = sessionExpired || hasFreshSignal
        ? { ...current, ts: now }
        : { ...storedSession, ts: now };
    return { firstTouch, sessionTouch, sessionExpired, isNewUser };
}
function toGtagParams(attribution, prefix = "") {
    const raw = {
        [`${prefix}source`]: attribution.source,
        [`${prefix}medium`]: attribution.medium,
        [`${prefix}campaign`]: attribution.campaign,
        [`${prefix}content`]: attribution.content,
        [`${prefix}term`]: attribution.term,
        [`${prefix}referrer_host`]: attribution.referrerHost,
        [`${prefix}in_app_browser`]: attribution.inAppBrowser,
        [`${prefix}resolved_by`]: attribution.resolvedBy,
    };
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        if (value)
            out[key] = value.slice(0, MAX_PARAM_LENGTH);
    }
    return out;
}
return { DIRECT_SOURCE, NONE_MEDIUM, detectInAppBrowser, hostOf, classifyReferrerHost, parseUtm, resolveAttribution, SESSION_TIMEOUT_MS, decideTouches, toGtagParams };
})();
lib.scrollChrome = (() => {
const TOP_ALWAYS_SHOWN = 8;
const DELTA = 6;
function reduceScrollChrome(previousY, previous, nextY) {
    if (nextY <= TOP_ALWAYS_SHOWN)
        return "shown";
    const delta = nextY - previousY;
    if (delta > DELTA)
        return "hidden";
    if (delta < -DELTA)
        return "shown";
    return previous;
}
function attachScrollChrome(target, root, enabled = () => true) {
    let y = target.scrollY;
    let visibility = "shown";
    const publish = (next) => {
        visibility = next;
        y = target.scrollY;
        root.dataset.chrome = next;
        if (typeof document === "undefined")
            return;
        const inert = next === "hidden";
        for (const element of document.querySelectorAll("[data-site-header], [data-site-bottom-nav]")) {
            element.toggleAttribute("inert", inert);
        }
    };
    const apply = () => {
        if (!enabled()) {
            publish("shown");
            return;
        }
        publish(reduceScrollChrome(y, visibility, target.scrollY));
    };
    target.addEventListener("scroll", apply, { passive: true });
    target.addEventListener("resize", apply);
    apply();
    return () => {
        target.removeEventListener("scroll", apply);
        target.removeEventListener("resize", apply);
    };
}
return { reduceScrollChrome, attachScrollChrome };
})();
lib.chatStream = (() => {
const MAX_RESPONSE_BYTES = 64 * 1024;
class MemeChatStreamError extends Error {
    constructor(error) {
        super("Meme chat response unavailable.");
        this.error = error;
        this.name = "MemeChatStreamError";
    }
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasKeys(value, keys) {
    return Object.keys(value).length === keys.length
        && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}
function isProgress(value) {
    if (!isRecord(value))
        return false;
    if (value.stage === "found") {
        return hasKeys(value, ["stage", "count"])
            && typeof value.count === "number"
            && Number.isInteger(value.count)
            && value.count >= 0
            && value.count <= 4;
    }
    return hasKeys(value, ["stage"])
        && (value.stage === "reading" || value.stage === "searching" || value.stage === "answering");
}
function isChatError(value) {
    return value === "request_cancelled" || value === "request_timed_out" || value === "search_unavailable";
}
function checkCancellation(signal) {
    if (signal.aborted)
        throw new MemeChatStreamError("request_cancelled");
}
async function readBody(response, signal, onText) {
    if (!response.body)
        throw new MemeChatStreamError("search_unavailable");
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let completed = false;
    let cancellationRequested = false;
    const cancel = () => {
        if (cancellationRequested)
            return;
        cancellationRequested = true;
        void reader.cancel().catch(() => { });
    };
    let rejectAbort;
    const aborted = new Promise((_, reject) => { rejectAbort = reject; });
    const onAbort = () => {
        cancel();
        rejectAbort(new MemeChatStreamError("request_cancelled"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    const consume = async () => {
        let bytes = 0;
        for (;;) {
            checkCancellation(signal);
            const chunk = await reader.read();
            checkCancellation(signal);
            if (chunk.done) {
                onText(decoder.decode());
                completed = true;
                return;
            }
            bytes += chunk.value.byteLength;
            if (bytes > MAX_RESPONSE_BYTES)
                throw new MemeChatStreamError("search_unavailable");
            onText(decoder.decode(chunk.value, { stream: true }));
        }
    };
    try {
        checkCancellation(signal);
        await Promise.race([consume(), aborted]);
    }
    finally {
        signal.removeEventListener("abort", onAbort);
        if (!completed)
            cancel();
        reader.releaseLock();
    }
}
async function readMemeChatResponse(response, { signal, onProgress }) {
    try {
        const contentType = response.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase();
        if (contentType !== "application/x-ndjson") {
            let json = "";
            await readBody(response, signal, (text) => { json += text; });
            checkCancellation(signal);
            return JSON.parse(json);
        }
        let pending = "";
        let terminal;
        const readLine = (line) => {
            checkCancellation(signal);
            if (terminal)
                throw new MemeChatStreamError("search_unavailable");
            const event = JSON.parse(line);
            if (!isRecord(event))
                throw new MemeChatStreamError("search_unavailable");
            if (event.type === "progress" && hasKeys(event, ["type", "progress"]) && isProgress(event.progress)) {
                try {
                    void Promise.resolve(onProgress(event.progress)).catch(() => { });
                }
                catch { }
            }
            else if (event.type === "result" && hasKeys(event, ["type", "result"])) {
                terminal = { type: "result", result: event.result };
            }
            else if (event.type === "error" && hasKeys(event, ["type", "error"]) && isChatError(event.error)) {
                terminal = { type: "error", error: event.error };
            }
            else {
                throw new MemeChatStreamError("search_unavailable");
            }
        };
        await readBody(response, signal, (text) => {
            pending += text;
            let newline = pending.indexOf("\n");
            while (newline >= 0) {
                readLine(pending.slice(0, newline));
                pending = pending.slice(newline + 1);
                newline = pending.indexOf("\n");
            }
        });
        if (pending.length)
            readLine(pending);
        checkCancellation(signal);
        if (!terminal)
            throw new MemeChatStreamError("search_unavailable");
        if (terminal.type === "error")
            throw new MemeChatStreamError(terminal.error);
        return terminal.result;
    }
    catch (error) {
        checkCancellation(signal);
        if (error instanceof MemeChatStreamError)
            throw error;
        throw new MemeChatStreamError("search_unavailable");
    }
}
return { MemeChatStreamError, readMemeChatResponse };
})();
lib.sourceLinks = (() => {
function cleanText(value) {
    return typeof value === "string" ? value.trim() : "";
}
function isPublicDisplaySource(source) {
    return source.hidden_from_public !== true;
}
function publicDisplaySources(sources) {
    return Array.isArray(sources) ? sources.filter(isPublicDisplaySource) : [];
}
function publicSourceUrl(value) {
    if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u001f\u007f\\]/.test(value))
        return null;
    try {
        const url = new URL(value.trim());
        const host = url.hostname.toLowerCase().replace(/\.$/, "");
        if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port)
            return null;
        if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || host.startsWith('['))
            return null;
        if (['localhost', 'local', 'internal', 'invalid', 'test', 'example', 'onion', 'home.arpa'].some((suffix) => host === suffix || host.endsWith(`.${suffix}`)))
            return null;
        if (!host.split('.').every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))
            return null;
        url.hostname = host;
        return url.href;
    }
    catch {
        return null;
    }
}
function sourceDocumentKey(url) {
    return url.split('#')[0];
}
function evidenceTimestamp(value, now = Date.now()) {
    const text = cleanText(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,6})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d))?$/.exec(text);
    if (!match)
        return null;
    const [year, month, day] = match.slice(1).map(Number);
    const calendar = new Date(Date.UTC(year, month - 1, day));
    if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== day)
        return null;
    const time = Date.parse(text);
    return Number.isFinite(time) && time <= now ? text : null;
}
function citableSources(sources) {
    const seen = new Set();
    const out = [];
    for (const source of sources) {
        if (!isPublicDisplaySource(source))
            continue;
        const url = publicSourceUrl(source.source_url);
        const title = cleanText(source.title);
        if (!url || !title)
            continue;
        const key = sourceDocumentKey(url);
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push({
            url,
            title,
            publisher: cleanText(source.creator_name) || cleanText(source.platform) || null,
            capturedAt: evidenceTimestamp(source.captured_at),
            isContext: isContextSourceUrl(url),
        });
    }
    return out;
}
function isContextSourceUrl(rawUrl) {
    try {
        const host = new URL(rawUrl ?? "").hostname.toLowerCase();
        return host === "namu.wiki" || host.endsWith(".wikipedia.org");
    }
    catch {
        return false;
    }
}
function summarizeEvidence(sources) {
    const seen = new Set();
    let primary = 0;
    let context = 0;
    let identifiedPrimary = 0;
    for (const source of sources) {
        if (!isPublicDisplaySource(source))
            continue;
        const url = publicSourceUrl(source.source_url);
        if (!url)
            continue;
        const key = sourceDocumentKey(url);
        if (seen.has(key))
            continue;
        seen.add(key);
        if (isContextSourceUrl(url)) {
            context += 1;
        }
        else {
            primary += 1;
            if (cleanText(source.title) || cleanText(source.creator_name)) {
                identifiedPrimary += 1;
            }
        }
    }
    return { total: seen.size, primary, context, identifiedPrimary };
}
function preferredSourceUrl(sources) {
    const urls = sources
        .filter(isPublicDisplaySource)
        .map((source) => publicSourceUrl(source.source_url))
        .filter((url) => Boolean(url));
    return urls.find((url) => !isContextSourceUrl(url)) ?? urls[0] ?? null;
}
function sourceLinksWithContent(sources, contents) {
    const seen = new Set();
    return [...contents.map((content) => ({ source_url: content.url, platform: content.platform })), ...sources]
        .flatMap((source) => {
        if (!isPublicDisplaySource(source))
            return [];
        const url = publicSourceUrl(source.source_url);
        if (!url)
            return [];
        const key = sourceDocumentKey(url);
        if (seen.has(key))
            return [];
        seen.add(key);
        return [{ ...source, source_url: url }];
    });
}
return { isPublicDisplaySource, publicDisplaySources, publicSourceUrl, evidenceTimestamp, citableSources, isContextSourceUrl, summarizeEvidence, preferredSourceUrl, sourceLinksWithContent };
})();
const root = document.documentElement;
const main = document.querySelector("main");
const storage = {
    get(area, key) {
        try {
            return window[area].getItem(key);
        }
        catch {
            return null;
        }
    },
    set(area, key, value) {
        try {
            window[area].setItem(key, value);
        }
        catch {
        }
    },
    remove(area, key) {
        try {
            window[area].removeItem(key);
        }
        catch {
        }
    },
};
if (root.dataset.ga) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag() {
        window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", root.dataset.ga);
}
const DURABLE_EVENTS = new Set([
    "meme_view", "follow_click", "copy", "paywall_view", "share_click", "quiz_start",
    "quiz_complete", "traffic_source", "plus_weekly_brief_opened", "plus_weekly_brief_clicked",
]);
function sendDurable(event, params) {
    if (!DURABLE_EVENTS.has(event))
        return;
    try {
        const payload = JSON.stringify({ eventName: event, path: location.pathname, params });
        if (navigator.sendBeacon?.("/api/analytics/events", new Blob([payload], { type: "application/json" })))
            return;
        fetch("/api/analytics/events", {
            method: "POST",
            body: payload,
            keepalive: true,
            headers: { "content-type": "application/json" },
        }).catch(() => undefined);
    }
    catch {
    }
}
function track(event, params, destination = "both") {
    const eventParams = { ...(params ?? {}) };
    delete eventParams.query;
    try {
        if (destination !== "durable")
            window.gtag?.("event", event, eventParams);
    }
    catch {
    }
    if (destination !== "ga")
        sendDurable(event, eventParams);
}
function whenGtagReady(callback) {
    if (window.gtag) {
        callback();
        return;
    }
    let attempts = 0;
    const timer = setInterval(() => {
        attempts += 1;
        if (window.gtag) {
            clearInterval(timer);
            callback();
        }
        else if (attempts >= 40) {
            clearInterval(timer);
        }
    }, 150);
}
let sessionRequest = null;
function currentUser() {
    sessionRequest ?? (sessionRequest = fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((body) => body?.user ?? null)
        .catch(() => null));
    return sessionRequest;
}
function queryPlan(op, name, { fields = [{ kind: "star" }], filters = [], single = false, maybeSingle = false, args } = {}) {
    return {
        op,
        ...(op === "rpc" ? { fn: name } : { table: name }),
        fields,
        filters,
        orGroups: [],
        orders: [],
        limit: null,
        offset: null,
        single,
        maybeSingle,
        count: null,
        head: false,
        onConflict: null,
        ignoreDuplicates: false,
        returning: op === "select" || op === "rpc",
        ...(op === "rpc" ? { args } : {}),
    };
}
const BUSY_RETRY_MAX_SECONDS = 5;
async function runPlan(plan, retried = false) {
    try {
        const response = await fetch("/api/db/query", {
            method: "POST",
            headers: { "content-type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ plan }),
        });
        const body = await response.json();
        if (response.status === 503 && body?.error?.message === "database busy" && !retried) {
            const wait = Math.min(Number(response.headers.get("retry-after")) || 1, BUSY_RETRY_MAX_SECONDS);
            await new Promise((resolve) => setTimeout(resolve, wait * 1000));
            return runPlan(plan, true);
        }
        return body;
    }
    catch {
        return { data: null, error: { message: "network" } };
    }
}
const selectOne = (table, columns, column, value, single) => runPlan(queryPlan("select", table, {
    fields: columns.map((name) => ({ kind: "column", name })),
    filters: [{ column, op: "eq", value }],
    single,
    maybeSingle: !single,
}));
const rpc = (fn, args) => runPlan(queryPlan("rpc", fn, { args }));
const FOCUSABLE = 'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';
function openModal(template, { lockScroll = false, onClose } = {}) {
    const dialog = template.content.firstElementChild.cloneNode(true);
    const panel = dialog.querySelector("[data-panel]");
    const returnTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const bodyStyle = { overflow: document.body.style.overflow, paddingRight: document.body.style.paddingRight };
    const onKey = (event) => {
        if (event.key === "Escape") {
            close();
            return;
        }
        if (event.key !== "Tab")
            return;
        const focusable = panel.querySelectorAll(FOCUSABLE);
        if (!focusable.length)
            return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
            event.preventDefault();
            last.focus();
        }
        else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    };
    function close() {
        if (!dialog.isConnected)
            return;
        document.removeEventListener("keydown", onKey);
        dialog.remove();
        if (lockScroll)
            Object.assign(document.body.style, bodyStyle);
        returnTo?.focus({ preventScroll: true });
        onClose?.();
    }
    dialog.addEventListener("click", (event) => {
        if (event.target.closest?.("[data-close]"))
            close();
    });
    document.addEventListener("keydown", onKey);
    if (lockScroll) {
        const scrollbar = innerWidth - root.clientWidth;
        if (scrollbar > 0)
            document.body.style.paddingRight = `${scrollbar}px`;
        document.body.style.overflow = "hidden";
    }
    document.body.append(dialog);
    panel.focus();
    return { dialog, close };
}
let openDisclosure = null;
const disclosurePanels = new WeakMap();
function disclosurePanel(button) {
    if (!disclosurePanels.has(button)) {
        const template = button.parentElement.querySelector(":scope > template[data-panel]");
        disclosurePanels.set(button, template.content.firstElementChild.cloneNode(true));
    }
    return disclosurePanels.get(button);
}
function setDisclosure(button, panel, open) {
    button.setAttribute("aria-expanded", String(open));
    if (open)
        button.after(panel);
    else
        panel.remove();
    if (open) {
        if (openDisclosure && openDisclosure.button !== button) {
            setDisclosure(openDisclosure.button, openDisclosure.panel, false);
        }
        openDisclosure = { button, panel };
    }
    else if (openDisclosure?.button === button) {
        openDisclosure = null;
    }
    button.dispatchEvent(new CustomEvent("disclosure", { detail: open }));
}
document.addEventListener("pointerdown", (event) => {
    if (openDisclosure && !openDisclosure.button.parentElement.contains(event.target)) {
        setDisclosure(openDisclosure.button, openDisclosure.panel, false);
    }
});
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape" || !openDisclosure)
        return;
    const { button, panel } = openDisclosure;
    setDisclosure(button, panel, false);
    button.focus();
});
const frameTasks = [];
function onFrame(task) {
    frameTasks.push(task);
    task();
}
function frameChanged() {
    openDisclosure = null;
    for (const task of frameTasks)
        task();
}
const COPIED_MS = 2000;
const adsClient = main?.dataset.ads;
const liveHost = location.protocol === "https:" && !location.port
    && (location.hostname === "catchmeme.com" || location.hostname === "www.catchmeme.com");
if (adsClient && liveHost) {
    const loader = document.createElement("script");
    loader.id = "adsense";
    loader.async = true;
    loader.crossOrigin = "anonymous";
    loader.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(adsClient)}`;
    document.head.append(loader);
}
const viewedMemeId = main?.dataset.memeId;
if (viewedMemeId) {
    track("meme_view", { meme_id: viewedMemeId });
    fetch("/api/memes/view", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memeId: viewedMemeId }),
        keepalive: true,
    }).catch(() => { });
    try {
        const recent = JSON.parse(storage.get("localStorage", "mc_recent_memes") || "[]");
        storage.set("localStorage", "mc_recent_memes", JSON.stringify([viewedMemeId, ...recent.filter((id) => id !== viewedMemeId)].slice(0, 6)));
    }
    catch {
    }
}
const flash = (element, attribute) => {
    element.setAttribute(attribute, "");
    setTimeout(() => element.removeAttribute(attribute), COPIED_MS);
};
document.addEventListener("click", async (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const copy = target?.closest("[data-copy]");
    if (copy) {
        event.preventDefault();
        try {
            await navigator.clipboard.writeText(copy.dataset.copy);
            navigator.vibrate?.(15);
            flash(copy, "data-copied");
        }
        catch {
        }
        return;
    }
    const share = target?.closest("[data-share]");
    if (share) {
        const path = share.dataset.share;
        const method = navigator.share ? "native" : "link";
        const url = `${location.origin}${path}?utm_source=share&utm_medium=${method}`;
        track("share_click", { method, to: path });
        try {
            if (navigator.share) {
                await navigator.share({ title: `${share.dataset.shareTitle} — 밈캐치`, url });
                return;
            }
            await navigator.clipboard.writeText(url);
            const status = share.nextElementSibling;
            if (status)
                status.textContent = "링크가 복사되었어요.";
            setTimeout(() => status && (status.textContent = ""), COPIED_MS);
        }
        catch {
        }
        return;
    }
    const link = target?.closest("a");
    const block = link?.closest("[data-track]");
    if (block) {
        track(block.dataset.track, {
            short_id: block.dataset.trackShortId,
            from: block.dataset.trackFrom,
            to: link.getAttribute("href") ?? "",
        });
    }
});
{
    const FIRST_TOUCH_KEY = "mc:attr:first";
    const SESSION_TOUCH_KEY = "mc:attr:session";
    const readTouch = (area, key) => {
        try {
            const parsed = JSON.parse(storage.get(area, key) ?? "null");
            return parsed && typeof parsed.source === "string" ? parsed : null;
        }
        catch {
            return null;
        }
    };
    const { resolveAttribution, decideTouches, toGtagParams, DIRECT_SOURCE } = lib.attribution;
    const current = resolveAttribution({
        search: location.search,
        referrer: document.referrer,
        userAgent: navigator.userAgent,
        selfHost: location.hostname,
    });
    const { firstTouch, sessionTouch, sessionExpired, isNewUser } = decideTouches({
        current,
        storedFirst: readTouch("localStorage", FIRST_TOUCH_KEY),
        storedSession: readTouch("sessionStorage", SESSION_TOUCH_KEY),
        now: Date.now(),
    });
    if (isNewUser)
        storage.set("localStorage", FIRST_TOUCH_KEY, JSON.stringify(firstTouch));
    storage.set("sessionStorage", SESSION_TOUCH_KEY, JSON.stringify(sessionTouch));
    const acquisition = {
        ...toGtagParams(sessionTouch),
        ...toGtagParams(firstTouch, "first_"),
        landing_page: location.pathname.slice(0, 100),
        is_returning: isNewUser ? "false" : "true",
    };
    if (sessionExpired)
        track("traffic_source", acquisition, "durable");
    whenGtagReady(() => {
        try {
            if (sessionTouch.source !== DIRECT_SOURCE) {
                window.gtag("set", {
                    campaign_source: sessionTouch.source,
                    campaign_medium: sessionTouch.medium,
                    ...(sessionTouch.campaign ? { campaign_name: sessionTouch.campaign } : {}),
                    ...(sessionTouch.content ? { campaign_content: sessionTouch.content } : {}),
                    ...(sessionTouch.term ? { campaign_term: sessionTouch.term } : {}),
                });
            }
            window.gtag("set", "user_properties", toGtagParams(firstTouch, "first_"));
        }
        catch {
        }
        if (sessionExpired)
            track("traffic_source", acquisition, "ga");
    });
}
document.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("[data-menu] > button");
    if (button) {
        setDisclosure(button, disclosurePanel(button), button.getAttribute("aria-expanded") !== "true");
        return;
    }
    if (target?.closest("[data-random-meme]"))
        track("random_meme");
});
document.addEventListener("disclosure", (event) => {
    const button = event.target;
    if (!button.closest?.("[data-menu]"))
        return;
    button.classList.toggle("bg-surface-2", event.detail);
    button.classList.toggle("hover:bg-surface-2", !event.detail);
}, true);
{
    const LOCALE_COOKIE = "memecatch_locale";
    const DESTINATION_KEY = "memecatch:locale-destination";
    const persist = (code, destination) => {
        document.cookie = `${LOCALE_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax`;
        storage.set("localStorage", LOCALE_COOKIE, code);
        if (destination && destination !== location.pathname) {
            storage.set("sessionStorage", DESTINATION_KEY, JSON.stringify({ locale: code, path: destination, at: Date.now() }));
        }
    };
    const swapFrame = async (code) => {
        const path = `${location.pathname}${location.search}`;
        const response = await fetch(`/_axum/frame/${encodeURIComponent(code)}?path=${encodeURIComponent(path)}`);
        if (!response.ok)
            throw new Error(`frame ${response.status}`);
        const frame = await response.json();
        root.lang = frame.lang;
        root.dir = frame.dir;
        for (const [name, html] of Object.entries(frame.parts)) {
            const part = document.querySelector(`[data-frame="${name}"]`);
            if (part)
                part.outerHTML = html;
        }
        for (const button of document.querySelectorAll("[data-save-meme]")) {
            button.dataset.saveCopy = JSON.stringify(frame.save);
        }
        for (const button of document.querySelectorAll("[data-export]")) {
            button.dataset.exportCopy = JSON.stringify(frame.export);
            button.dataset.exportLocale = frame.locale;
        }
        frameChanged();
        document.querySelector("[data-locale-select]")?.focus();
    };
    document.addEventListener("change", (event) => {
        const select = event.target instanceof Element ? event.target.closest("[data-locale-select]") : null;
        if (!select)
            return;
        const code = select.value;
        const destination = select.selectedOptions[0]?.dataset.dest;
        persist(code, destination && new URL(destination, location.href).pathname);
        if (destination) {
            location.assign(destination);
            return;
        }
        swapFrame(code).catch(() => location.reload());
    });
}
{
    const AUTH_HINT_KEY = "mc_auth_nick";
    let nickname = null;
    const render = (nick) => {
        const slot = document.querySelector("[data-account]");
        if (!slot)
            return;
        slot.querySelector("[data-account-root]")?.remove();
        const login = slot.querySelector("[data-account-login]");
        login.hidden = Boolean(nick);
        if (!nick)
            return;
        const template = slot.querySelector("template[data-account-menu]");
        const menu = template.content.firstElementChild.cloneNode(true);
        menu.dataset.accountRoot = "";
        const button = menu.querySelector("button");
        button.setAttribute("aria-label", `${nick} · ${template.dataset.label}`);
        menu.querySelector("[data-initial]").textContent = Array.from(nick.trim())[0]?.toUpperCase() ?? "?";
        disclosurePanel(button).querySelector("[data-nickname]").textContent = nick;
        slot.append(menu);
    };
    const load = async () => {
        const user = await currentUser();
        if (!user) {
            nickname = "";
            storage.remove("localStorage", AUTH_HINT_KEY);
        }
        else {
            const { data } = await selectOne("profiles", ["nickname"], "id", user.id, true);
            nickname = data?.nickname ?? "밈러";
            storage.set("localStorage", AUTH_HINT_KEY, nickname);
        }
        render(nickname);
    };
    onFrame(() => {
        if (nickname !== null) {
            render(nickname);
            return;
        }
        const hint = storage.get("localStorage", AUTH_HINT_KEY);
        if (hint)
            render(hint);
        load();
    });
    document.addEventListener("click", async (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest("[data-account-root] > button");
        if (button) {
            const panel = disclosurePanel(button);
            const open = button.getAttribute("aria-expanded") !== "true";
            setDisclosure(button, panel, open);
            if (open)
                panel.querySelector('[role="menuitem"]')?.focus();
            return;
        }
        if (!target?.closest("[data-sign-out]"))
            return;
        try {
            await fetch("/api/auth/sign-out", {
                method: "POST",
                headers: { "content-type": "application/json" },
                credentials: "same-origin",
                body: "{}",
            });
        }
        catch {
        }
        storage.remove("localStorage", AUTH_HINT_KEY);
        location.assign("/");
    });
}
{
    const SAVE_INTENT_KEY = "memecatch:save-intents:v1";
    const SAVE_INTENT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
    const SAVE_INTENT_LIMIT = 10;
    const NOTICE_MS = 2500;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const readIntents = (now = Date.now()) => {
        try {
            const value = JSON.parse(storage.get("localStorage", SAVE_INTENT_KEY) ?? "[]");
            if (!Array.isArray(value))
                return [];
            const kept = new Map();
            for (const item of value) {
                if (item && typeof item.memeId === "string" && UUID_RE.test(item.memeId)
                    && typeof item.createdAt === "number" && item.createdAt <= now && now - item.createdAt < SAVE_INTENT_TTL_MS) {
                    kept.delete(item.memeId);
                    kept.set(item.memeId, { memeId: item.memeId, createdAt: item.createdAt });
                }
            }
            return [...kept.values()].slice(-SAVE_INTENT_LIMIT);
        }
        catch {
            return [];
        }
    };
    const writeIntents = (intents) => {
        if (intents.length)
            storage.set("localStorage", SAVE_INTENT_KEY, JSON.stringify(intents));
        else
            storage.remove("localStorage", SAVE_INTENT_KEY);
    };
    const isTerminal = (error) => error.code === "22P02" || error.code === "23503" || error.message?.includes("premium_save_limit");
    for (const button of document.querySelectorAll("[data-save-meme]")) {
        const memeId = button.dataset.saveMeme;
        const status = button.parentElement.querySelector('[role="status"]');
        const copy = () => JSON.parse(button.dataset.saveCopy);
        let saved = false;
        let busy = false;
        let signedIn = null;
        let noticeTimer = 0;
        const show = () => {
            button.setAttribute("aria-pressed", String(saved));
            button.classList.remove(...(saved ? button.dataset.unsavedClass : button.dataset.savedClass).split(" "));
            button.classList.add(...(saved ? button.dataset.savedClass : button.dataset.unsavedClass).split(" "));
            button.querySelector("svg").setAttribute("fill", saved ? "currentColor" : "none");
            button.lastChild.textContent = saved ? copy().savedButton : copy().saveButton;
        };
        const notice = (message) => {
            clearTimeout(noticeTimer);
            status.textContent = message;
            noticeTimer = setTimeout(() => (status.textContent = ""), NOTICE_MS);
        };
        const openGate = () => {
            const template = document.querySelector("template[data-login-gate]");
            if (!template)
                return;
            const { dialog } = openModal(template, { lockScroll: true });
            dialog.querySelector("[data-title]").textContent = copy().loginGate;
            dialog.addEventListener("click", async (event) => {
                const provider = event.target.closest?.("[data-oauth]");
                if (!provider)
                    return;
                const buttons = dialog.querySelectorAll("[data-oauth]");
                buttons.forEach((item) => (item.disabled = true));
                const fail = () => {
                    buttons.forEach((item) => (item.disabled = false));
                    dialog.querySelector("[data-notice]").textContent = `${provider.dataset.label} 로그인은 곧 열려요. 이메일로 시작해 주세요.`;
                };
                try {
                    const next = new URL(dialog.querySelector('a[href^="/login"]').href).searchParams.get("next") ?? "/";
                    const response = await fetch("/api/auth/sign-in/social", {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        credentials: "same-origin",
                        body: JSON.stringify({
                            provider: provider.dataset.oauth,
                            callbackURL: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
                            disableRedirect: true,
                        }),
                    });
                    const body = await response.json().catch(() => null);
                    if (!response.ok || !body?.url)
                        fail();
                    else
                        location.assign(body.url);
                }
                catch {
                    fail();
                }
            });
        };
        const rememberGuestSave = () => {
            const intents = readIntents();
            if (!intents.some((intent) => intent.memeId === memeId) && intents.length >= SAVE_INTENT_LIMIT) {
                openGate();
                return;
            }
            const now = Date.now();
            writeIntents([...intents.filter((intent) => intent.memeId !== memeId), { memeId, createdAt: now }].slice(-SAVE_INTENT_LIMIT));
            saved = true;
            show();
            openGate();
        };
        (async () => {
            const user = await currentUser();
            signedIn = Boolean(user);
            if (!user)
                return;
            const remaining = [];
            for (const intent of readIntents()) {
                const { error } = await rpc("save_meme", { p_meme_id: intent.memeId });
                if (error && !isTerminal(error))
                    remaining.push(intent);
                if (!error && intent.memeId === memeId)
                    saved = true;
            }
            writeIntents(remaining);
            const { data } = await selectOne("saved_memes", ["meme_id"], "meme_id", memeId, false);
            if (data)
                saved = true;
            show();
        })();
        button.addEventListener("click", async () => {
            if (busy)
                return;
            if (!saved)
                track("follow_click", { meme_id: memeId });
            if (signedIn === false) {
                rememberGuestSave();
                return;
            }
            busy = true;
            const wasSaved = saved;
            saved = !wasSaved;
            show();
            const { data, error } = await rpc("toggle_save", { p_meme_id: memeId });
            busy = false;
            if (error) {
                saved = wasSaved;
                show();
                if (String(error.message).includes("login_required")) {
                    signedIn = false;
                    rememberGuestSave();
                }
                else {
                    notice(copy().retry);
                }
                return;
            }
            signedIn = true;
            saved = data === true;
            show();
            if (saved) {
                window.dispatchEvent(new Event("memecatch:save"));
                notice(copy().saved);
            }
            else {
                notice(copy().removed);
            }
        });
        onFrame(show);
    }
}
{
    const MAX_TURNS = 6;
    const STILL = "/images/meme-chat/mascot-idle.png";
    const LOOP = "/images/meme-chat/mascot-wave.gif";
    const ERRORS = { 429: "limited", 504: "timeout", 400: "invalid", 413: "invalid" };
    const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
    const isChatItem = (value) => isRecord(value)
        && ["id", "short_id", "slug", "title", "summary", "href"].every((key) => typeof value[key] === "string" && value[key].length <= 12000)
        && Array.isArray(value.sources) && value.sources.length <= 8
        && value.sources.every((source) => isRecord(source) && typeof source.url === "string" && source.url.length <= 2048
            && typeof source.label === "string" && source.label.length <= 300);
    const isChatResult = (value) => isRecord(value)
        && typeof value.answer === "string" && value.answer.length <= 12000
        && ["generated", "retrieved", "empty"].includes(value.mode)
        && ["hybrid", "keyword"].includes(value.retrievalMode)
        && Array.isArray(value.items) && value.items.length <= 12 && value.items.every(isChatItem);
    const safeMemeHref = (value) => {
        if (value.length > 2048 || /[\u0000-\u001f\u007f\\]/u.test(value))
            return null;
        return /^\/(?:ko\/|en\/|ja\/|zh\/|zh-tw\/)?memes\/[^/?#]+$/u.test(value) ? value : null;
    };
    let chat = null;
    const setCharacter = (face, state) => {
        const character = face.querySelector("[data-character-state]");
        if (!character || character.dataset.characterState === state)
            return;
        character.dataset.characterState = state;
        character.querySelector("img").src = state === "ready" || state === "found" ? STILL : LOOP;
        character.querySelector(".meme-chatbot-character-state")?.remove();
        const icon = chat.root.querySelector(`template[data-chat-icon="${state === "found" ? "ready" : state}"]`);
        if (icon)
            character.append(icon.content.firstElementChild.cloneNode(true));
    };
    const fill = (selector) => chat.root.querySelector(`template[${selector}]`).content.firstElementChild.cloneNode(true);
    function render() {
        const { root: box, copy, open, pending, progress, error } = chat;
        const launcher = box.querySelector("[data-chat-launcher]");
        const { panel } = chat;
        if (open && !panel.isConnected)
            launcher.before(panel);
        if (!open)
            panel.remove();
        launcher.dataset.chatOpen = String(open);
        launcher.setAttribute("aria-label", open ? copy.close : copy.open);
        launcher.setAttribute("aria-expanded", String(open));
        if (open)
            launcher.setAttribute("aria-controls", panel.id);
        else
            launcher.removeAttribute("aria-controls");
        launcher.querySelector("[data-chat-prompt]").textContent = open ? copy.close : copy.launcherHint;
        launcher.querySelector("[data-chat-x]").hidden = !open;
        setCharacter(launcher.querySelector("[data-chat-face]"), open ? (pending !== null ? "searching" : "ready") : "idle");
        const waiting = progress?.stage === "found" && progress.count === 0 ? "idle" : progress?.stage ?? "reading";
        setCharacter(panel.querySelector("header [data-chat-face]"), pending !== null ? waiting : chat.turns ? "ready" : "idle");
        const welcome = chat.turns === 0 && pending === null;
        if (welcome && !chat.welcome.isConnected)
            panel.querySelector("[data-chat-log]").prepend(chat.welcome);
        if (!welcome)
            chat.welcome.remove();
        const alert = panel.querySelector("[data-chat-error]");
        alert.hidden = !error;
        alert.textContent = error ? copy[error] : "";
        const input = panel.querySelector("textarea");
        const length = input.value.trim().length;
        input.disabled = pending !== null;
        panel.querySelector("[data-chat-count]").textContent = `${input.value.length}/120`;
        panel.querySelector('button[type="submit"]').disabled = pending !== null || length < 2 || length > 120;
        const slot = panel.querySelector("[data-chat-pending-slot]");
        slot.replaceChildren();
        if (pending !== null)
            slot.append(pendingCard());
        const scroller = panel.querySelector("[data-chat-scroll]");
        scroller.scrollTop = scroller.scrollHeight;
    }
    function pendingCard() {
        const { copy, pending, progress, foundCount } = chat;
        const card = fill("data-chat-pending");
        card.querySelector("[data-question]").textContent = pending;
        const stage = progress?.stage;
        card.querySelector("[data-chat-progress]").dataset.chatProgress = stage ?? "pending";
        setCharacter(card.querySelector("[data-chat-face]"), stage === "found" && progress.count === 0 ? "idle" : stage ?? "idle");
        const references = stage === "found" ? progress.count : foundCount;
        const foundLabel = references === 0 ? copy.noReferences : copy.found.replace("{count}", String(references));
        card.querySelector("[data-status]").textContent = stage === "found" ? foundLabel : stage ? copy[stage] : copy.pending;
        if (foundCount !== null && stage === "answering") {
            const badge = card.querySelector("[data-found]");
            badge.hidden = false;
            badge.className = foundCount > 0 ? "meme-chatbot-found-badge" : "meme-chatbot-empty-badge";
            if (foundCount === 0)
                badge.querySelector("[data-found-check]").remove();
            badge.querySelector("[data-found-label]").textContent = foundLabel;
        }
        card.querySelector("[data-skeleton]").hidden = stage !== "answering";
        return card;
    }
    function appendTurn(question, result) {
        const { copy } = chat;
        const turn = fill("data-chat-turn");
        turn.querySelector("[data-question]").textContent = question;
        turn.querySelector("[data-mode]").textContent = copy[result.mode];
        turn.querySelector("[data-answer]").textContent = result.answer;
        const references = turn.querySelector("[data-references]");
        if (!result.items.length)
            references.remove();
        references.querySelector("[data-references-title]").textContent = copy.references;
        for (const item of result.items) {
            const card = fill("data-chat-reference");
            const title = card.querySelector("[data-title]");
            const href = safeMemeHref(item.href);
            if (href)
                title.href = href;
            else
                title.replaceWith(Object.assign(document.createElement("span"), { className: "font-bold text-foreground", textContent: item.title }));
            title.textContent = item.title;
            card.querySelector("[data-summary]").textContent = item.summary;
            const sources = card.querySelector("[data-sources]");
            sources.querySelector("[data-sources-title]").textContent = copy.sources;
            const links = item.sources.flatMap((source) => {
                const url = lib.sourceLinks.publicSourceUrl(source.url);
                return url ? [{ url, label: source.label }] : [];
            });
            if (!links.length)
                sources.remove();
            for (const link of links) {
                const anchor = fill("data-chat-source");
                anchor.href = link.url;
                anchor.textContent = link.label || new URL(link.url).hostname;
                sources.append(anchor);
            }
            references.querySelector("ul").append(card);
        }
        const log = chat.panel.querySelector("[data-chat-log]");
        log.append(turn);
        const turns = log.querySelectorAll("article");
        if (turns.length > MAX_TURNS)
            turns[0].remove();
        chat.turns = Math.min(turns.length, MAX_TURNS);
    }
    const input = () => chat.panel.querySelector("textarea");
    function cancel() {
        chat.controller?.abort();
        Object.assign(chat, { controller: null, pending: null, progress: null, foundCount: null });
    }
    function setOpen(open) {
        if (!open)
            cancel();
        chat.open = open;
        render();
        if (open)
            input().focus();
        else
            chat.root.querySelector("[data-chat-launcher]").focus();
    }
    async function ask() {
        if (chat.controller)
            return;
        const question = input().value.trim();
        if (question.length < 2 || question.length > 120) {
            chat.error = "invalid";
            render();
            return;
        }
        const controller = new AbortController();
        Object.assign(chat, { controller, pending: question, progress: { stage: "reading" }, foundCount: null, error: null });
        render();
        const current = () => !controller.signal.aborted && chat?.controller === controller;
        try {
            const response = await fetch("/api/memes/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
                body: JSON.stringify({ question, locale: chat.locale }),
                cache: "no-store",
                signal: controller.signal,
            });
            if (!current())
                return;
            if (!response.ok) {
                chat.error = ERRORS[response.status] ?? "unavailable";
                return;
            }
            const result = await lib.chatStream.readMemeChatResponse(response, {
                signal: controller.signal,
                onProgress(progress) {
                    if (!current())
                        return;
                    chat.progress = progress;
                    if (progress.stage === "found")
                        chat.foundCount = progress.count;
                    render();
                },
            });
            if (!current())
                return;
            if (!isChatResult(result)) {
                chat.error = "unavailable";
                return;
            }
            appendTurn(question, result);
            input().value = "";
        }
        catch (caught) {
            if (current())
                chat.error = caught?.error === "request_timed_out" ? "timeout" : "unavailable";
        }
        finally {
            if (chat?.controller === controller) {
                cancel();
                render();
                if (chat.open)
                    input().focus();
            }
        }
    }
    onFrame(() => {
        chat?.controller?.abort();
        const box = document.querySelector("[data-chat]");
        const panel = box?.querySelector("template[data-chat-panel]").content.firstElementChild.cloneNode(true);
        chat = box && {
            root: box,
            panel,
            copy: JSON.parse(box.dataset.chatCopy),
            locale: box.dataset.chatLocale,
            welcome: panel.querySelector("[data-chat-welcome]"),
            open: false, turns: 0, pending: null, progress: null, foundCount: null, error: null, controller: null,
        };
    });
    document.addEventListener("click", (event) => {
        const target = event.target instanceof Element ? event.target : null;
        if (!chat || !target || !chat.root.contains(target))
            return;
        if (target.closest("[data-chat-launcher]"))
            setOpen(!chat.open);
        else if (target.closest("[data-chat-close]"))
            setOpen(false);
        else if (target.closest("[data-chat-clear]")) {
            cancel();
            chat.panel.querySelectorAll("[data-chat-log] article").forEach((turn) => turn.remove());
            Object.assign(chat, { turns: 0, error: null });
            input().value = "";
            render();
            input().focus();
        }
        else if (target.closest("[data-chat-suggestion]")) {
            input().value = target.closest("[data-chat-suggestion]").firstChild.textContent;
            chat.error = null;
            render();
            input().focus();
        }
    });
    document.addEventListener("input", (event) => {
        if (!chat || event.target !== input())
            return;
        chat.error = null;
        render();
    });
    document.addEventListener("submit", (event) => {
        if (!chat || !event.target.closest?.("[data-chat-form]"))
            return;
        event.preventDefault();
        ask();
    });
    document.addEventListener("keydown", (event) => {
        if (!chat?.open)
            return;
        if (event.target === input() && event.key === "Enter" && !event.shiftKey && !event.isComposing && event.keyCode !== 229) {
            event.preventDefault();
            if (chat.pending === null)
                input().form.requestSubmit();
            return;
        }
        if (event.key !== "Escape" || event.isComposing || event.defaultPrevented)
            return;
        if (document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]'))
            return;
        event.preventDefault();
        setOpen(false);
    });
}
{
    const KEY_VISITS = "mc:visits";
    const KEY_SAVES = "mc:saves";
    const KEY_DISMISSED_AT = "mc:install-dismissed-at";
    const KEY_INSTALLED = "mc:installed";
    const SESSION_COUNTED = "mc:visit-counted";
    const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;
    const count = (key) => Number.parseInt(storage.get("localStorage", key) ?? "0", 10) || 0;
    if (!storage.get("sessionStorage", SESSION_COUNTED)) {
        storage.set("sessionStorage", SESSION_COUNTED, "1");
        storage.set("localStorage", KEY_VISITS, String(count(KEY_VISITS) + 1));
    }
    window.addEventListener("memecatch:save", () => storage.set("localStorage", KEY_SAVES, String(count(KEY_SAVES) + 1)));
    const standalone = () => window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const eligible = () => {
        if (standalone())
            return false;
        const dismissedAt = count(KEY_DISMISSED_AT);
        if (dismissedAt && Date.now() - dismissedAt < DISMISS_MS)
            return false;
        if (storage.get("localStorage", KEY_INSTALLED) === "1")
            return false;
        return count(KEY_VISITS) >= 2 || count(KEY_SAVES) >= 2;
    };
    let banner = null;
    let sheet = null;
    let deferredPrompt = null;
    const setChatHidden = (hidden) => {
        const box = document.querySelector("[data-chat]");
        if (box)
            box.hidden = hidden;
    };
    const hide = () => {
        sheet?.close();
        banner?.remove();
        banner = null;
        setChatHidden(false);
    };
    const dismiss = () => {
        storage.set("localStorage", KEY_DISMISSED_AT, String(Date.now()));
        hide();
    };
    const show = () => {
        const template = document.querySelector("template[data-pwa-banner]");
        if (banner || !template)
            return;
        banner = template.content.firstElementChild.cloneNode(true);
        const install = banner.querySelector("[data-install]");
        if (ios)
            install.textContent = install.dataset.iosLabel;
        install.addEventListener("click", async () => {
            if (ios) {
                const sheetTemplate = document.querySelector("template[data-pwa-sheet]");
                sheet = openModal(sheetTemplate, { onClose: () => (sheet = null) });
                sheet.dialog.querySelector("[data-dismiss]").addEventListener("click", dismiss);
                return;
            }
            if (!deferredPrompt)
                return;
            try {
                await deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                if (outcome === "accepted")
                    storage.set("localStorage", KEY_INSTALLED, "1");
            }
            catch {
            }
            deferredPrompt = null;
            hide();
        });
        banner.querySelector("[data-dismiss]").addEventListener("click", dismiss);
        document.body.append(banner);
        setChatHidden(true);
    };
    window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        if (!eligible())
            return;
        deferredPrompt = event;
        show();
    });
    window.addEventListener("appinstalled", () => {
        storage.set("localStorage", KEY_INSTALLED, "1");
        deferredPrompt = null;
        hide();
    });
    setTimeout(() => ios && eligible() && show(), 0);
    onFrame(() => banner && setChatHidden(true));
}
{
    const APPEAR_DELAY = 120;
    const TRICKLE_INTERVAL = 300;
    let started = false;
    let timers = [];
    const bar = () => document.querySelector("[data-nav-progress]");
    const reset = () => {
        started = false;
        timers.forEach(clearTimeout);
        timers = [];
        const element = bar();
        if (!element)
            return;
        element.dataset.visible = "false";
        element.firstElementChild.style.width = "0%";
    };
    const start = () => {
        if (started)
            return;
        started = true;
        timers.push(setTimeout(() => {
            const element = bar();
            if (!element)
                return;
            let value = 8;
            element.dataset.visible = "true";
            element.firstElementChild.style.width = `${value}%`;
            const tick = () => {
                value = Math.min(value + (90 - value) * 0.12, 89.5);
                element.firstElementChild.style.width = `${value}%`;
                timers.push(setTimeout(tick, TRICKLE_INTERVAL));
            };
            timers.push(setTimeout(tick, TRICKLE_INTERVAL));
        }, APPEAR_DELAY));
    };
    document.addEventListener("click", (event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
            return;
        const anchor = event.target instanceof Element ? event.target.closest("a") : null;
        const href = anchor?.getAttribute("href");
        if (!href || href.startsWith("#"))
            return;
        if (anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.getAttribute("rel") === "external")
            return;
        try {
            const url = new URL(anchor.href, location.href);
            if (url.origin !== location.origin)
                return;
            if (url.pathname === location.pathname && url.search === location.search)
                return;
            start();
        }
        catch {
        }
    }, true);
    window.addEventListener("pageshow", (event) => event.persisted && reset());
}
{
    const phone = window.matchMedia?.("(max-width: 767px)");
    lib.scrollChrome.attachScrollChrome(window, root, () => phone?.matches ?? false);
}
document.addEventListener("keydown", (event) => {
    if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey || event.isComposing)
        return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)))
        return;
    const input = document.getElementById("header-search");
    if (!input || input.offsetParent === null)
        return;
    event.preventDefault();
    input.focus();
    input.select();
});
{
    const MAX_TILT_DEG = 4;
    const fine = window.matchMedia?.("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (fine?.matches && !still?.matches) {
        let frame = 0;
        let active = null;
        const reset = (element) => {
            element.style.removeProperty("--tilt-x");
            element.style.removeProperty("--tilt-y");
        };
        document.addEventListener("pointermove", (event) => {
            if (event.pointerType !== "mouse")
                return;
            const element = event.target instanceof Element ? event.target.closest("[data-pointer-light]") : null;
            if (active && active !== element)
                reset(active);
            active = element;
            if (!element)
                return;
            const { clientX, clientY } = event;
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => {
                const rect = element.getBoundingClientRect();
                if (rect.width === 0 || rect.height === 0)
                    return;
                const x = (clientX - rect.left) / rect.width;
                const y = (clientY - rect.top) / rect.height;
                element.style.setProperty("--px", `${(x * 100).toFixed(1)}%`);
                element.style.setProperty("--py", `${(y * 100).toFixed(1)}%`);
                element.style.setProperty("--tilt-x", `${((0.5 - y) * MAX_TILT_DEG * 2).toFixed(2)}deg`);
                element.style.setProperty("--tilt-y", `${((x - 0.5) * MAX_TILT_DEG * 2).toFixed(2)}deg`);
            });
        }, { passive: true });
    }
}
{
    const edition = document.querySelector("main[data-edition-slug]");
    if (edition) {
        const status = edition.querySelector("[data-edition-status]");
        const copyButton = edition.querySelector("[data-copy-link]");
        const saveButton = edition.querySelector("[data-save-card]");
        const STATUS = {
            idle: "한국어 원문 캡션과 출처가 포함된 PNG로 저장됩니다.",
            busy: "밈 카드를 만드는 중입니다…",
            success: "밈 카드 PNG를 저장했어요.",
            error: "밈 카드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
            copyError: "링크를 복사하지 못했어요. 다시 시도해 주세요.",
        };
        const FONT = 'Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
        let saveState = "idle";
        let copyState = "idle";
        const render = () => {
            const failed = saveState === "error" || copyState === "error";
            status.textContent = copyState === "error" ? STATUS.copyError : STATUS[saveState];
            status.classList.toggle("original-edition-error", failed);
            saveButton.disabled = saveState === "busy";
            saveButton.lastChild.textContent = saveState === "busy" ? "카드 만드는 중…" : "문구 포함 카드 저장";
            const icon = edition.querySelector(`template[data-icon="${copyState === "success" ? "check" : "copy"}"]`);
            copyButton.replaceChildren(icon.content.firstElementChild.cloneNode(true), copyState === "success" ? "링크 복사됨" : "작품 링크 복사");
        };
        const wrapCaption = (caption, maxWidth, context) => {
            const words = caption.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
            const lines = [];
            let current = "";
            context.font = `800 42px ${FONT}`;
            for (const word of words) {
                const next = current ? `${current} ${word}` : word;
                if (current && context.measureText(next).width > maxWidth) {
                    lines.push(current);
                    current = word;
                }
                else {
                    current = next;
                }
            }
            if (current)
                lines.push(current);
            return lines.slice(0, 3);
        };
        const renderCaptionCard = async (imagePath, caption) => {
            if (!/^\/images\/originals\/[a-z0-9-]+\.png$/.test(imagePath))
                throw new Error("editorial_image_path_invalid");
            await document.fonts?.ready;
            const image = await new Promise((resolve, reject) => {
                const element = document.createElement("img");
                element.decoding = "async";
                element.onload = () => resolve(element);
                element.onerror = () => reject(new Error("editorial_image_load_failed"));
                element.src = imagePath;
            });
            const canvas = document.createElement("canvas");
            canvas.width = 1080;
            canvas.height = 1350;
            const context = canvas.getContext("2d");
            if (!context)
                throw new Error("editorial_canvas_unavailable");
            context.fillStyle = "#f3f2ed";
            context.fillRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, 0, 0, 1080, 1080);
            const lines = wrapCaption(caption, 952, context);
            context.fillStyle = "#18181a";
            context.textAlign = "left";
            context.textBaseline = "top";
            context.font = `800 42px ${FONT}`;
            lines.forEach((line, index) => context.fillText(line, 64, 1110 + index * 54));
            context.fillStyle = "#a52b13";
            context.font = `800 24px ${FONT}`;
            context.fillText("MEMECATCH ORIGINAL", 64, 1290);
            const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
            if (!blob)
                throw new Error("editorial_card_encode_failed");
            return blob;
        };
        copyButton.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(edition.dataset.shareUrl);
                copyState = "success";
            }
            catch {
                copyState = "error";
            }
            render();
        });
        saveButton.addEventListener("click", async () => {
            if (saveState === "busy")
                return;
            saveState = "busy";
            render();
            try {
                const blob = await renderCaptionCard(edition.dataset.editionImage, edition.dataset.editionCaption);
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `memecatch-${edition.dataset.editionSlug}-meme-card.png`;
                link.hidden = true;
                document.body.append(link);
                try {
                    link.click();
                }
                finally {
                    link.remove();
                    URL.revokeObjectURL(url);
                }
                saveState = "success";
            }
            catch {
                saveState = "error";
            }
            render();
        });
    }
}
{
    const toPoster = (image) => {
        const card = image.closest("[data-card]");
        const fallback = card?.querySelector("template[data-card-fallback]");
        if (!fallback)
            return;
        const [poster, bubble] = fallback.content.cloneNode(true).children;
        image.replaceWith(poster);
        const face = card.querySelector(".meme-card-face");
        face.classList.add("meme-card-fallback");
        face.prepend(bubble);
        fallback.remove();
    };
    for (const image of document.querySelectorAll("[data-card] img[data-meme-card-art]")) {
        if (image.complete && image.naturalWidth === 0)
            toPoster(image);
        else
            image.addEventListener("error", () => toPoster(image), { once: true });
    }
    let previews = 0;
    const openPreview = (button) => {
        const dialog = button.nextElementSibling;
        const template = dialog.nextElementSibling;
        const content = template.content.firstElementChild.cloneNode(true);
        const unavailable = template.content.lastElementChild;
        const heading = content.querySelector("[data-card-dialog-title]");
        heading.id = `card-preview-${(previews += 1)}`;
        dialog.setAttribute("aria-labelledby", heading.id);
        dialog.replaceChildren(content);
        const player = content.querySelector("iframe");
        let onMessage = null;
        if (template.hasAttribute("data-tiktok")) {
            onMessage = (event) => {
                if (event.origin !== "https://www.tiktok.com" || event.source !== player.contentWindow)
                    return;
                const data = event.data;
                if (!data || typeof data !== "object" || Array.isArray(data))
                    return;
                const value = data.value;
                if (data["x-tiktok-player"] !== true || data.type !== "onPlayerError" || !value || typeof value !== "object" || Array.isArray(value))
                    return;
                if (value.errorCode === 1001 && value.errorType === "INVALID_VIDEO") {
                    player.replaceWith(unavailable.cloneNode(true));
                    window.removeEventListener("message", onMessage);
                }
            };
            window.addEventListener("message", onMessage);
            player.src = template.dataset.embed;
        }
        content.querySelector("[data-card-dialog-close]").addEventListener("click", () => dialog.close());
        dialog.addEventListener("close", () => {
            if (onMessage)
                window.removeEventListener("message", onMessage);
            dialog.replaceChildren();
            dialog.removeAttribute("aria-labelledby");
        }, { once: true });
        if (typeof dialog.showModal === "function")
            dialog.showModal();
        else
            dialog.setAttribute("open", "");
    };
    for (const button of document.querySelectorAll("[data-card-preview]")) {
        button.addEventListener("click", () => openPreview(button));
    }
}
{
    const view = document.querySelector("[data-timeline]");
    if (view) {
        const ROWS_PER_BATCH = 4;
        const total = Number(view.dataset.total);
        let visible = Number(view.dataset.initial);
        const sentinel = view.querySelector("[data-timeline-sentinel]");
        let observer = null;
        const mountRow = () => {
            let next = view.querySelector("template[data-row], template[data-section]");
            if (!next)
                return false;
            if (next.hasAttribute("data-section")) {
                const section = next.content.firstElementChild;
                next.replaceWith(section);
                next = section.querySelector("template[data-row]");
            }
            next.replaceWith(next.content.firstElementChild);
            visible += 1;
            return true;
        };
        const showRows = (count) => {
            while (visible < Math.min(count, total) && mountRow())
                ;
            if (visible >= total) {
                observer?.disconnect();
                sentinel?.remove();
            }
        };
        const observe = () => {
            observer?.disconnect();
            if (visible >= total || !sentinel)
                return;
            if (typeof IntersectionObserver === "undefined")
                return showRows(total);
            observer = new IntersectionObserver((entries) => {
                if (!entries.some((entry) => entry.isIntersecting))
                    return;
                showRows(visible + ROWS_PER_BATCH);
                observe();
            }, { rootMargin: "600px 0px" });
            observer.observe(sentinel);
        };
        const startOf = (key) => {
            const pending = view.querySelector(`template[data-section="${key}"]`);
            return pending ? Number(pending.dataset.start) : null;
        };
        const revealDecade = (key, scroll) => {
            const start = startOf(key);
            if (start !== null)
                showRows(start + 1);
            observe();
            if (!scroll)
                return;
            requestAnimationFrame(() => requestAnimationFrame(() => {
                const target = document.getElementById(`decade-${key}`);
                if (!target)
                    return;
                const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
                target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
            }));
        };
        view.addEventListener("click", (event) => {
            const tab = event.target.closest("[data-decade-tab]");
            if (tab) {
                event.preventDefault();
                history.replaceState(null, "", `#decade-${tab.dataset.decadeTab}`);
                revealDecade(tab.dataset.decadeTab, true);
                return;
            }
            const card = event.target.closest("[data-timeline-card]");
            if (card) {
                track("timeline_click", { meme_id: card.dataset.timelineCard, year: Number(card.dataset.year), decade: card.dataset.decade });
            }
        });
        const hash = location.hash.match(/^#decade-(.+)$/);
        const known = (key) => view.querySelector(`[data-decade-tab="${key}"], section[data-decade="${key}"], template[data-section="${key}"]`);
        if (hash && known(hash[1]))
            requestAnimationFrame(() => revealDecade(hash[1], true));
        observe();
    }
}
{
    const dictionary = document.querySelector("[data-slang]");
    if (dictionary) {
        const tabs = [...dictionary.querySelectorAll("[data-era-tab]")];
        const panels = [...dictionary.querySelectorAll("section[data-era]")];
        const current = dictionary.dataset.tabCurrent.split(" ");
        const idle = dictionary.dataset.tabIdle.split(" ");
        const KEYS = ["now", "2010s", "2000s", "1990s", "risky"];
        const fromAddress = () => {
            const era = new URLSearchParams(location.search).get("era");
            return KEYS.includes(era) && tabs.some((tab) => tab.dataset.eraTab === era) ? era : "now";
        };
        const show = (era) => {
            for (const panel of panels)
                panel.hidden = panel.dataset.era !== era;
            for (const tab of tabs) {
                const on = tab.dataset.eraTab === era;
                if (on)
                    tab.setAttribute("aria-current", "page");
                else
                    tab.removeAttribute("aria-current");
                tab.classList.remove(...(on ? idle : current));
                tab.classList.add(...(on ? current : idle));
                tab.querySelector("span")?.classList.toggle("text-white/90", on);
                if (on) {
                    try {
                        tab.scrollIntoView({ inline: "center", block: "nearest" });
                    }
                    catch {
                    }
                }
            }
        };
        dictionary.addEventListener("click", (event) => {
            const tab = event.target.closest("[data-era-tab]");
            if (!tab || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
                return;
            event.preventDefault();
            if (tab.href !== location.href)
                history.pushState(null, "", tab.href);
            show(fromAddress());
        });
        addEventListener("popstate", () => show(fromAddress()));
        if (fromAddress() !== "now")
            show(fromAddress());
    }
}
{
    const opener = document.querySelector("[data-export]");
    const template = opener?.nextElementSibling;
    if (opener && template?.matches("template[data-export-panel]")) {
        const SELECTED = ["border-accent", "bg-accent/10", "text-foreground"];
        const IDLE = ["border-border", "bg-surface", "text-text-muted"];
        const SEO_LOCALES = new Set(["en", "ja", "zh", "zh-tw"]);
        const shortId = opener.dataset.export;
        const state = { template: "classic", format: "card", busy: false, error: false };
        let panel = null;
        let failure = null;
        let objectUrl = null;
        const copy = () => JSON.parse(opener.dataset.exportCopy);
        const mark = (selector, key, value) => {
            for (const choice of panel.querySelectorAll(selector)) {
                const pressed = choice.dataset[key] === value;
                choice.setAttribute("aria-pressed", String(pressed));
                choice.classList.remove(...(pressed ? IDLE : SELECTED));
                choice.classList.add(...(pressed ? SELECTED : IDLE));
            }
        };
        const render = () => {
            const text = copy();
            opener.lastChild.textContent = text.open;
            if (!panel)
                return;
            panel.setAttribute("aria-label", text.title);
            panel.querySelector("[data-export-close]").setAttribute("aria-label", text.close);
            for (const element of panel.querySelectorAll("[data-copy-key]")) {
                element.textContent = text[element.dataset.copyKey];
            }
            mark("[data-export-template]", "exportTemplate", state.template);
            mark("[data-export-format]", "exportFormat", state.format);
            const download = panel.querySelector("[data-export-download]");
            failure.textContent = text.failed;
            if (state.error)
                download.before(failure);
            else
                failure.remove();
            download.disabled = state.busy;
            download.textContent = state.busy ? text.downloading : text.download;
        };
        const download = async () => {
            state.busy = true;
            state.error = false;
            render();
            try {
                const query = new URLSearchParams({ template: state.template, format: state.format });
                const locale = opener.dataset.exportLocale;
                if (SEO_LOCALES.has(locale))
                    query.set("locale", locale);
                const response = await fetch(`/memes/${shortId}/export?${query}`, { cache: "no-store" });
                if (!response.ok)
                    throw new Error(`export ${response.status}`);
                const blob = await response.blob();
                if (objectUrl)
                    URL.revokeObjectURL(objectUrl);
                objectUrl = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = objectUrl;
                link.download = `memecatch-${shortId}-${state.template}-${state.format}.png`;
                document.body.append(link);
                link.click();
                link.remove();
            }
            catch {
                state.error = true;
            }
            finally {
                state.busy = false;
                render();
            }
        };
        opener.addEventListener("click", () => {
            panel = template.content.firstElementChild.cloneNode(true);
            failure = panel.querySelector("[data-export-error]");
            panel.addEventListener("click", (event) => {
                const target = event.target instanceof Element ? event.target : null;
                const choice = target?.closest("[data-export-template], [data-export-format]");
                if (choice) {
                    state.error = false;
                    if (choice.dataset.exportTemplate)
                        state.template = choice.dataset.exportTemplate;
                    else
                        state.format = choice.dataset.exportFormat;
                    render();
                }
                else if (target?.closest("[data-export-close]")) {
                    panel.replaceWith(opener);
                    panel = null;
                }
                else if (target?.closest("[data-export-download]") && !state.busy) {
                    download();
                }
            });
            render();
            opener.replaceWith(panel);
        });
        onFrame(render);
    }
}
{
    const details = document.querySelector("details[data-contribute]");
    if (details) {
        const form = details.querySelector("form");
        const submit = form.querySelector('button[type="submit"]');
        const exampleTemplate = form.querySelector("template[data-contribute-example]");
        const fields = {
            source: [...form.querySelectorAll('[data-contribute-field="source"]')],
            example: [...exampleTemplate.content.children].map((field) => field.cloneNode(true)),
        };
        const input = (name) => [...fields.source, ...fields.example].map((field) => field.querySelector(`[data-contribute-input="${name}"]`)).find(Boolean);
        const credit = form.querySelector('[data-contribute-input="creditPublic"]');
        const selected = details.dataset.kindSelected.split(" ");
        const idle = details.dataset.kindIdle.split(" ");
        let kind = "source";
        let pending = false;
        let notice = null;
        const canSubmit = () => !pending && (kind === "source"
            ? input("sourceUrl").value.trim().length > 0
            : Boolean(input("situation").value.trim() && input("text").value.trim()));
        const render = () => {
            for (const radio of form.querySelectorAll('input[type="radio"]')) {
                const on = radio.value === kind;
                radio.checked = on;
                const label = radio.closest("label");
                label.classList.remove(...(on ? idle : selected));
                label.classList.add(...(on ? selected : idle));
            }
            const shown = fields[kind];
            const hidden = fields[kind === "source" ? "example" : "source"];
            if (!shown[0].isConnected) {
                const anchor = hidden[0].isConnected ? hidden[0] : exampleTemplate;
                anchor.before(...shown);
            }
            for (const field of hidden)
                field.remove();
            submit.disabled = !canSubmit();
            submit.textContent = pending ? "보내는 중…" : "검수 요청 보내기";
        };
        const showNotice = (next) => {
            notice?.remove();
            notice = null;
            if (!next)
                return;
            notice = document.createElement("p");
            notice.setAttribute("role", next.kind === "error" ? "alert" : "status");
            notice.className = "text-base";
            notice.style.color = next.kind === "error" ? "var(--safety-red)" : "var(--safety-green)";
            notice.append(next.message);
            if (next.loginLink) {
                const link = document.createElement("a");
                link.href = `/login?next=${encodeURIComponent(`${location.pathname}#contribute-${kind}`)}`;
                link.className = "font-semibold underline underline-offset-2";
                link.textContent = "로그인하고 이어서 쓰기";
                notice.append(" ", link);
            }
            submit.after(notice);
        };
        const sync = () => {
            const next = { "#contribute-source": "source", "#contribute-example": "example", "#contribute": null }[location.hash];
            if (next === undefined)
                return;
            details.open = true;
            if (next)
                kind = next;
            render();
            details.scrollIntoView?.({ block: "start" });
        };
        form.addEventListener("change", (event) => {
            if (event.target.matches('input[type="radio"]')) {
                kind = event.target.value;
                render();
            }
        });
        form.addEventListener("input", render);
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            if (!canSubmit())
                return;
            showNotice(null);
            pending = true;
            render();
            const creditPublic = credit.checked;
            const body = kind === "source"
                ? { memeId: details.dataset.contribute, kind, sourceUrl: input("sourceUrl").value, note: input("note").value, creditPublic }
                : { memeId: details.dataset.contribute, kind, situation: input("situation").value, text: input("text").value, creditPublic };
            let result;
            try {
                const response = await fetch("/api/memes/contribution", {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    credentials: "same-origin",
                    body: JSON.stringify(body),
                });
                result = await response.json();
            }
            catch {
                result = { ok: false, error: "failed", message: "제보를 보내지 못했어요. 잠시 뒤 다시 시도해 주세요." };
            }
            pending = false;
            if (result.ok) {
                track("meme_contribution_submitted", { short_id: details.dataset.contributeShortId, kind });
                for (const name of ["sourceUrl", "note", "situation", "text"])
                    input(name).value = "";
                showNotice({
                    kind: "success",
                    message: creditPublic
                        ? "고마워요! 검수를 거쳐 반영되면 「함께 채운 사람」에 닉네임이 올라가요."
                        : "고마워요! 검수를 거쳐 이 문서에 반영할게요.",
                });
            }
            else {
                showNotice({ kind: "error", message: result.message, loginLink: result.error === "login_required" });
            }
            render();
        });
        addEventListener("hashchange", sync);
        sync();
    }
}
{
    const pending = document.querySelector('[data-auth-invite="pending"]');
    if (pending) {
        currentUser().then((user) => {
            if (user) {
                pending.remove();
                return;
            }
            const card = pending.firstElementChild;
            card.removeAttribute("aria-hidden");
            for (const link of card.querySelectorAll("[tabindex]"))
                link.removeAttribute("tabindex");
            pending.replaceWith(card);
        });
    }
}
})();
