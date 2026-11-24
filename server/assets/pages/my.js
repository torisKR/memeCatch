(() => {
"use strict";
const lib = {};
lib.memeCollectible = (() => {
const MEME_CARD_TARGET_COUNT = 1000;
const MEME_CARD_PAGE_SIZE = 24;
const MEME_CARD_MAX_PAGE = Math.ceil(MEME_CARD_TARGET_COUNT / MEME_CARD_PAGE_SIZE);
function isMemeCardId(value) {
    return typeof value === "string"
        && /^mc-(?:000[1-9]|00[1-9]\d|0[1-9]\d{2}|1000)$/.test(value);
}
function parseMemeCardPage(value) {
    if (value === null)
        return 1;
    if (!/^[1-9]\d?$/.test(value))
        return null;
    const page = Number(value);
    return page <= MEME_CARD_MAX_PAGE ? page : null;
}
function parseMemeCardIds(value) {
    const ids = value.split(",");
    if (ids.length < 1 || ids.length > MEME_CARD_PAGE_SIZE || !ids.every(isMemeCardId))
        return null;
    return [...new Set(ids)];
}
const categories = new Set(["phrase", "dance", "song", "image", "comment", "challenge"]);
function parseMemeCardPageOptions(params) {
    const page = parseMemeCardPage(params.get("page"));
    const query = params.get("query")?.trim() || undefined;
    const category = params.get("category") || undefined;
    if (page === null || (query && query.length > 80) || (category && !categories.has(category)))
        return null;
    if ([...params.keys()].some((key) => !["page", "query", "category"].includes(key)))
        return null;
    if (["page", "query", "category"].some((key) => params.getAll(key).length > 1))
        return null;
    return { page, query, category };
}
return { MEME_CARD_TARGET_COUNT, MEME_CARD_PAGE_SIZE, MEME_CARD_MAX_PAGE, isMemeCardId, parseMemeCardPage, parseMemeCardIds, parseMemeCardPageOptions };
})();
lib.memeCollectibleUi = (() => {
const { isMemeCardId } = lib.memeCollectible;
function isMemeCardHref(value) {
    if (typeof value !== "string" || !/^\/memes\/[^/?#\\\s]+$/.test(value))
        return false;
    try {
        const url = new URL(value, "https://memecatch.invalid");
        return url.origin === "https://memecatch.invalid" && url.pathname.startsWith("/memes/") && url.pathname !== "/memes/";
    }
    catch {
        return false;
    }
}
function readRevealedMemeCard(value, expectedId) {
    if (!value || typeof value !== "object" || !("card" in value))
        return null;
    const card = value.card;
    if (!card || typeof card !== "object")
        return null;
    const c = card;
    if (c.id !== expectedId || !isMemeCardId(c.id) || c.cardNo !== Number(expectedId.slice(3)) ||
        !Number.isInteger(c.edition) || c.edition < 1 || !Number.isInteger(c.artSeed) ||
        !["memeId", "title", "slug", "summary", "category"].every(key => typeof c[key] === "string" && Boolean(c[key])) ||
        !isMemeCardHref(c.href) ||
        !["pen-pineapple", "dance", "gaming", "reaction", "office", "food", "animal", "sport", "music", "chat", "choice", "technology", "celebration", "fashion", "travel", "study"].includes(c.artMotif) ||
        !["orbit", "rise", "split", "burst", "rhythm", "stack", "frame", "exchange"].includes(c.artComposition) ||
        !Array.isArray(c.artSymbols) || !c.artSymbols.length || c.artSymbols.length > 3 || !c.artSymbols.every(symbol => typeof symbol === "string" && /^[a-z-]+$/.test(symbol)))
        return null;
    return card;
}
const SCRATCH_REVEAL_RATIO = 0.35;
function createScratchCoverage(columns = 64, rows = 96) {
    const cells = new Uint8Array(columns * rows);
    let cleared = 0;
    return {
        mark(from, to = from) {
            const distance = Math.hypot((to.x - from.x) / to.radiusX, (to.y - from.y) / to.radiusY);
            const steps = Math.max(1, Math.ceil(distance * 3));
            for (let step = 0; step <= steps; step++) {
                const x = from.x + (to.x - from.x) * step / steps;
                const y = from.y + (to.y - from.y) * step / steps;
                const minCol = Math.max(0, Math.floor((x - to.radiusX) * columns));
                const maxCol = Math.min(columns - 1, Math.ceil((x + to.radiusX) * columns));
                const minRow = Math.max(0, Math.floor((y - to.radiusY) * rows));
                const maxRow = Math.min(rows - 1, Math.ceil((y + to.radiusY) * rows));
                for (let row = minRow; row <= maxRow; row++) {
                    for (let col = minCol; col <= maxCol; col++) {
                        const dx = ((col + 0.5) / columns - x) / to.radiusX;
                        const dy = ((row + 0.5) / rows - y) / to.radiusY;
                        const index = row * columns + col;
                        if (dx * dx + dy * dy <= 1 && !cells[index]) {
                            cells[index] = 1;
                            cleared++;
                        }
                    }
                }
            }
            return cleared / cells.length;
        },
        get ratio() { return cleared / cells.length; },
    };
}
function scratchPoint(clientX, clientY, rect) {
    if (rect.width <= 0 || rect.height <= 0)
        return null;
    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;
    if (x < 0 || x > 1 || y < 0 || y > 1)
        return null;
    return { x, y, radiusX: 0.075, radiusY: 0.075 * rect.width / rect.height };
}
function memeCardReturnHref(cardId, page, revealed = true, query = "", category = "") {
    if (!isMemeCardId(cardId))
        return "/meme-cards";
    const params = new URLSearchParams();
    if (page > 1)
        params.set("page", String(page));
    if (query)
        params.set("query", query);
    if (category)
        params.set("category", category);
    params.set("card", cardId);
    if (revealed)
        params.set("revealed", "1");
    return `/meme-cards?${params}#reveal`;
}
function memeCardCatalogHref(page = 1, query = "", category = "") {
    const params = new URLSearchParams();
    if (page > 1)
        params.set("page", String(page));
    if (query)
        params.set("query", query);
    if (category)
        params.set("category", category);
    return `/meme-cards${params.size ? `?${params}` : ""}`;
}
return { readRevealedMemeCard, SCRATCH_REVEAL_RATIO, createScratchCoverage, scratchPoint, memeCardReturnHref, memeCardCatalogHref };
})();
lib.memeCardArt = (() => {
const MEME_CARD_ART_WIDTHS = [600, 900, 1200];
const MEME_CARD_ART_WIDTH = 1200;
const MEME_CARD_ART_HEIGHT = 900;
const OWNED_ART_HOSTS = new Set(["catchmeme.com", "www.catchmeme.com"]);
const OWNED_ART_PATH = /^\/api\/media\/meme-card-art\/[A-Za-z0-9._~-]+$/;
function ownedMemeCardArtPath(value) {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.startsWith("data:"))
        return null;
    let pathname = "";
    if (trimmed.startsWith("/")) {
        pathname = trimmed.split(/[?#]/)[0] ?? "";
    }
    else {
        let url;
        try {
            url = new URL(trimmed);
        }
        catch {
            return null;
        }
        if (url.protocol !== "https:" || url.username || url.password || url.port)
            return null;
        if (!OWNED_ART_HOSTS.has(url.hostname.toLowerCase()))
            return null;
        pathname = url.pathname;
    }
    if (!pathname || pathname.includes("..") || !OWNED_ART_PATH.test(pathname))
        return null;
    return pathname;
}
function memeCardArtSources(pathname) {
    const srcSet = MEME_CARD_ART_WIDTHS.map((width) => `${pathname}?w=${width} ${width}w`).join(", ");
    return {
        src: `${pathname}?w=${MEME_CARD_ART_WIDTH}`,
        srcSet,
        width: MEME_CARD_ART_WIDTH,
        height: MEME_CARD_ART_HEIGHT,
    };
}
function memeCardArtFromMeme(meme) {
    const explicit = ownedMemeCardArtPath(meme.card_art_url);
    if (explicit)
        return memeCardArtSources(explicit);
    const contents = meme.meme_contents ?? [];
    const ordered = [
        ...contents.filter((content) => content.is_representative && content.thumbnail_url),
        ...contents.filter((content) => content.thumbnail_url && !content.is_representative),
    ];
    for (const content of ordered) {
        const path = ownedMemeCardArtPath(content.thumbnail_url);
        if (path)
            return memeCardArtSources(path);
    }
    return null;
}
function memeCardArtAlt(title, locale) {
    switch (locale) {
        case "ko":
            return `${title} 상징 일러스트`;
        case "ja":
            return `${title}の象徴イラスト`;
        case "zh":
            return `${title}象征插画`;
        case "zh-tw":
            return `${title}象徵插畫`;
        case "en":
        case "th":
        case "vi":
        case "mn":
        case "id":
        case "ar":
        case "ru":
        case "es":
        case "de":
        case "fr":
        case "it":
        case "pt":
        case "tr":
        case "ms":
        case "hi":
            return `${title} symbol illustration`;
        default: {
            const unreachable = locale;
            return unreachable;
        }
    }
}
return { MEME_CARD_ART_WIDTHS, MEME_CARD_ART_WIDTH, MEME_CARD_ART_HEIGHT, ownedMemeCardArtPath, memeCardArtSources, memeCardArtFromMeme, memeCardArtAlt };
})();
const { ownedMemeCardArtPath } = lib.memeCardArt;
const { memeCardReturnHref } = lib.memeCollectibleUi;
{
    const postJson = (path, body) => fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(body),
    });
    const nickname = document.querySelector("form[data-my-nickname]");
    nickname?.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (!nickname.reportValidity())
            return;
        const button = nickname.querySelector('button[type="submit"]');
        button.disabled = true;
        try {
            const response = await postJson("/api/account/nickname", { nickname: nickname.elements.nickname.value });
            const answer = await response.json();
            if (answer?.redirect) {
                location.assign(answer.redirect);
                return;
            }
        }
        catch {
        }
        location.assign(`/my?nickname_error=${encodeURIComponent("닉네임 저장에 실패했어요. 잠시 후 다시 시도해 주세요")}`);
    });
    const signOut = document.querySelector("form[data-my-sign-out]");
    signOut?.addEventListener("submit", async (event) => {
        event.preventDefault();
        signOut.querySelector('button[type="submit"]').disabled = true;
        await postJson("/api/auth/sign-out", {}).catch(() => undefined);
        location.assign("/");
    });
}
{
    const section = document.querySelector("section[data-my-cards]");
    if (section) {
        const COPY = {
            checking: "로그인 확인 중…",
            accountChanged: "계정이 바뀌었어요. 새 계정의 컬렉션을 다시 열어 주세요.",
            authFailure: "로그인 상태를 확인하지 못했어요. 다시 확인해 주세요.",
            loadFailure: "컬렉션을 불러오지 못했어요. 다시 시도해 주세요.",
            loginClaim: "로그인하고 보유하기",
            retry: "다시 시도",
            noResults: "조건에 맞는 카드가 없어요",
            empty: "아직 모은 밈카드가 없어요",
            noResultsBody: "필터를 바꾸거나 전체 카드를 둘러보세요.",
            emptyBody: "좋아하는 밈을 골라 첫 카드를 공개해 보세요.",
            start: "첫 카드 찾기",
            owned: "소장 중",
            hidden: "내용 확인 중",
            hiddenBody: "보유 기록은 유지돼요. 다시 공개 가능한지 확인하고 있어요.",
            previous: "이전",
            next: "다음",
            my: "내 밈카드",
            target: (total) => `${total} / 1,000`,
            count: (total) => `${total}종 보유`,
            page: (page, pages) => `${page} / ${pages} 페이지`,
        };
        const owner = section.dataset.myCards;
        let initial = null;
        try {
            initial = section.dataset.myCardsPage ? JSON.parse(section.dataset.myCardsPage) : null;
        }
        catch {
            initial = null;
        }
        let page = initial;
        let total = initial?.total ?? null;
        let error = !initial;
        let loginRequired = false;
        let busy = false;
        let status = "verifying";
        let filters = { query: "", category: "" };
        let epoch = 0;
        let request = null;
        let retained = { page: initial, total, error };
        const element = (tag, attributes = {}, ...children) => {
            const node = document.createElement(tag);
            for (const [name, value] of Object.entries(attributes))
                node.setAttribute(name, value);
            node.append(...children);
            return node;
        };
        const cls = (name) => `meme-collectible-${name}`;
        const heading = section.querySelector(`.${cls("section-heading")}`).lastElementChild;
        const form = section.querySelector("form");
        const apply = form.querySelector('button[type="submit"]');
        const catalog = section.querySelector(`.${cls("text-button")}`);
        const face = (card) => {
            const path = ownedMemeCardArtPath(card.thumbnailUrl);
            const template = document.querySelector(path ? "template[data-my-card-art]" : "template[data-my-card-face]");
            const node = template.content.firstElementChild.cloneNode(true);
            if (path) {
                const image = node.querySelector("img");
                image.setAttribute("src", image.getAttribute("src").replace("/__art__", path));
                image.setAttribute("srcset", image.getAttribute("srcset").replaceAll("/__art__", path));
                image.setAttribute("alt", `${card.title} 상징 일러스트`);
                image.addEventListener("error", () => node.replaceWith(face({ ...card, thumbnailUrl: null })), { once: true });
            }
            const title = node.querySelector("[data-meme-card-title]");
            title.textContent = card.title;
            title.title = card.title;
            const summary = node.querySelector("[data-meme-card-summary]");
            if (card.summary.trim()) {
                summary.textContent = card.summary;
                summary.title = card.summary;
            }
            else {
                summary.remove();
            }
            const badges = node.querySelector(".meme-card-badges");
            if (card.originYear == null)
                badges.replaceChildren();
            else
                badges.querySelector(".meme-card-year").textContent = String(card.originYear);
            return node;
        };
        const item = (card) => {
            if (!card.available) {
                return element("li", {}, element("div", { class: cls("hidden-card") }, element("span", { "aria-hidden": "true" }, "▧"), element("strong", {}, COPY.hidden), element("p", {}, COPY.hiddenBody), element("span", { class: cls("small") }, card.id)));
            }
            const link = element("a", { class: cls("catalog-button"), href: memeCardReturnHref(card.id, Math.ceil(card.cardNo / 24), true), "aria-label": `${card.title} · ${COPY.owned}` }, face(card));
            const date = new Intl.DateTimeFormat("ko", { dateStyle: "medium" }).format(new Date(card.claimedAt));
            return element("li", {}, link, element("p", { class: cls("claimed-date") }, date));
        };
        const render = () => {
            section.setAttribute("aria-busy", String(busy));
            heading.replaceChildren(...(status === "ready" && total !== null
                ? [element("span", { class: cls("free-badge") }, COPY.target(total)), element("p", {}, COPY.count(total))]
                : []));
            apply.disabled = busy || status !== "ready";
            for (const node of section.querySelectorAll("[data-my-cards-part]"))
                node.remove();
            const parts = [];
            if (status === "verifying" && !error)
                parts.push(element("p", { role: "status", class: cls("notice") }, COPY.checking));
            if (error) {
                const message = status === "changed" ? COPY.accountChanged : status === "failed" ? COPY.authFailure : status === "verifying" ? COPY.checking : COPY.loadFailure;
                const action = loginRequired
                    ? element("a", { href: "/login?next=%2Fmy%23meme-cards", class: cls("primary-button") }, COPY.loginClaim)
                    : element("button", { type: "button", class: cls("secondary-button") }, COPY.retry);
                if (!loginRequired) {
                    action.disabled = busy || status === "verifying";
                    action.addEventListener("click", () => (status === "changed" ? location.reload() : load(page?.page ?? 1)));
                }
                parts.push(element("div", { class: cls("empty") }, element("p", { role: status === "verifying" ? "status" : "alert" }, message), action));
            }
            if (status === "ready" && !error && page?.cards.length === 0) {
                const filtered = Boolean(filters.query || filters.category);
                parts.push(element("div", { class: cls("empty") }, element("h3", {}, filtered ? COPY.noResults : COPY.empty), element("p", {}, filtered ? COPY.noResultsBody : COPY.emptyBody), element("a", { href: "/meme-cards", class: cls("primary-button") }, COPY.start)));
            }
            if (status === "ready" && page && page.cards.length > 0) {
                parts.push(element("ul", { class: cls("grid") }, ...page.cards.map(item)));
            }
            const pages = page ? Math.max(1, Math.ceil(page.total / page.pageSize)) : 1;
            if (status === "ready" && !error && page && pages > 1) {
                const nav = element("nav", { class: cls("pagination"), "aria-label": COPY.my });
                if (page.page > 1) {
                    const previous = element("button", { type: "button", class: cls("secondary-button") }, COPY.previous);
                    previous.disabled = busy;
                    previous.addEventListener("click", () => load(page.page - 1));
                    nav.append(previous);
                }
                nav.append(element("span", {}, COPY.page(page.page, pages)));
                if (page.hasMore) {
                    const next = element("button", { type: "button", class: cls("secondary-button") }, COPY.next);
                    next.disabled = busy;
                    next.addEventListener("click", () => load(page.page + 1));
                    nav.append(next);
                }
                parts.push(nav);
            }
            for (const part of parts)
                part.dataset.myCardsPart = "";
            catalog.before(...parts);
        };
        const invalidate = (next) => {
            epoch += 1;
            request?.abort();
            status = next;
            if (next !== "verifying")
                retained = { page: null, total: null, error: true };
            page = null;
            total = null;
            error = true;
            busy = false;
            loginRequired = next === "signed-out";
            render();
        };
        const verify = async (at, restore = false) => {
            try {
                const response = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" });
                if (at !== epoch)
                    return false;
                if (!response.ok && ![400, 401, 403].includes(response.status))
                    throw new Error(String(response.status));
                const user = response.ok ? (await response.json())?.user : null;
                if (at !== epoch)
                    return false;
                if (!user) {
                    invalidate("signed-out");
                    return false;
                }
                if (user.id !== owner) {
                    invalidate("changed");
                    return false;
                }
                status = "ready";
                loginRequired = false;
                if (restore)
                    ({ page, total, error } = retained);
                render();
                return true;
            }
            catch {
                if (at === epoch)
                    invalidate("failed");
                return false;
            }
        };
        const load = async (target, next = filters) => {
            if (["signed-out", "changed", "verifying"].includes(status))
                return;
            request?.abort();
            const controller = new AbortController();
            request = controller;
            const at = epoch;
            busy = true;
            error = false;
            loginRequired = false;
            render();
            const params = new URLSearchParams({ page: String(target) });
            if (next.query)
                params.set("query", next.query);
            if (next.category)
                params.set("category", next.category);
            const fetchPage = async (search) => {
                const response = await fetch(`/api/meme-cards/collection?${search}`, { signal: controller.signal, cache: "no-store" });
                if (controller.signal.aborted || epoch !== at)
                    throw new Error("stale_collection");
                if (response.status === 401) {
                    invalidate("signed-out");
                    throw new Error("signed_out");
                }
                if (!response.ok)
                    throw new Error("collection_failed");
                const result = await response.json();
                if (!Array.isArray(result.cards) || typeof result.total !== "number")
                    throw new Error("invalid_collection");
                return result;
            };
            try {
                if (!(await verify(at)) || controller.signal.aborted)
                    return;
                const filtered = Boolean(next.query || next.category);
                const [result, complete] = await Promise.all([
                    fetchPage(params),
                    total === null && filtered ? fetchPage(new URLSearchParams({ page: "1" })) : Promise.resolve(null),
                ]);
                if (controller.signal.aborted || epoch !== at || !(await verify(at)) || controller.signal.aborted)
                    return;
                const full = complete?.total ?? (!filtered ? result.total : total);
                retained = { page: result, total: full, error: false };
                page = result;
                filters = next;
                if (complete)
                    total = complete.total;
                else if (!filtered)
                    total = result.total;
            }
            catch {
                if (!controller.signal.aborted && epoch === at) {
                    retained.error = true;
                    error = true;
                }
            }
            finally {
                if (!controller.signal.aborted && epoch === at)
                    busy = false;
                render();
            }
        };
        form.addEventListener("submit", (event) => {
            event.preventDefault();
            const data = new FormData(form);
            load(1, { query: String(data.get("query") ?? "").trim(), category: String(data.get("category") ?? "") });
        });
        const revalidate = () => {
            invalidate("verifying");
            verify(epoch, true);
        };
        window.addEventListener("focus", revalidate);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible")
                revalidate();
        });
        epoch += 1;
        verify(epoch);
    }
}
{
    const section = document.querySelector("section[data-my-recent]");
    if (section) {
        const RECENT_KEY = "mc_recent_memes";
        const hide = () => section.remove();
        let ids = [];
        try {
            const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
            ids = Array.isArray(parsed) ? parsed : [];
        }
        catch {
            ids = [];
        }
        if (ids.length === 0)
            hide();
        else {
            fetch(`/_axum/my/recent?ids=${encodeURIComponent(ids.slice(0, 6).join(","))}`, { credentials: "same-origin" })
                .then((response) => (response.status === 200 ? response.text() : ""))
                .then((html) => {
                if (!html)
                    return hide();
                const template = document.createElement("template");
                template.innerHTML = html;
                const filled = template.content.firstElementChild;
                section.replaceWith(filled);
                filled.querySelector("[data-my-recent-clear]")?.addEventListener("click", () => {
                    try {
                        localStorage.removeItem(RECENT_KEY);
                    }
                    catch {
                    }
                    filled.remove();
                });
            })
                .catch(hide);
        }
    }
}
})();
