(() => {
"use strict";
const lib = {};
{
    const root = document.querySelector("main[data-meme-cards]");
    if (root) {
        const start = JSON.parse(root.dataset.memeCards);
        const copy = start.copy;
        const page = start.page;
        const parts = root.querySelector("template[data-meme-cards-parts]").content;
        const part = (name) => parts.querySelector(`[data-part="${name}"]`).cloneNode(true);
        const REVEAL_RATIO = 0.35;
        const MOTIFS = ["pen-pineapple", "dance", "gaming", "reaction", "office", "food", "animal", "sport", "music", "chat", "choice", "technology", "celebration", "fashion", "travel", "study"];
        const COMPOSITIONS = ["orbit", "rise", "split", "burst", "rhythm", "stack", "frame", "exchange"];
        const isCardId = (value) => typeof value === "string" && /^mc-(?:000[1-9]|00[1-9]\d|0[1-9]\d{2}|1000)$/.test(value);
        const returnHref = (id, revealed) => {
            const params = new URLSearchParams();
            if (page > 1)
                params.set("page", String(page));
            params.set("card", id);
            if (revealed)
                params.set("revealed", "1");
            return `/meme-cards?${params}#reveal`;
        };
        const catalogHref = () => (page > 1 ? `/meme-cards?page=${page}` : "/meme-cards");
        function readCard(value, id) {
            const c = value && typeof value === "object" ? value.card : null;
            if (!c || typeof c !== "object")
                return null;
            const hrefOk = typeof c.href === "string" && /^\/memes\/[^/?#\\\s]+$/.test(c.href);
            if (c.id !== id || !isCardId(c.id) || c.cardNo !== Number(id.slice(3)) || !Number.isInteger(c.edition) || c.edition < 1 || !Number.isInteger(c.artSeed)
                || !["memeId", "title", "slug", "summary", "category"].every((key) => typeof c[key] === "string" && Boolean(c[key]))
                || !hrefOk || !MOTIFS.includes(c.artMotif) || !COMPOSITIONS.includes(c.artComposition)
                || !Array.isArray(c.artSymbols) || !c.artSymbols.length || c.artSymbols.length > 3 || !c.artSymbols.every((symbol) => typeof symbol === "string" && /^[a-z-]+$/.test(symbol)))
                return null;
            return c;
        }
        function coverage(columns = 64, rows = 96) {
            const cells = new Uint8Array(columns * rows);
            let cleared = 0;
            return (from, to = from) => {
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
            };
        }
        const scratchPoint = (clientX, clientY, rect) => {
            if (rect.width <= 0 || rect.height <= 0)
                return null;
            const x = (clientX - rect.left) / rect.width;
            const y = (clientY - rect.top) / rect.height;
            if (x < 0 || x > 1 || y < 0 || y > 1)
                return null;
            return { x, y, radiusX: 0.075, radiusY: 0.075 * rect.width / rect.height };
        };
        const place = (container, nodes) => {
            nodes.forEach((node, index) => {
                if (container.children[index] !== node)
                    container.insertBefore(node, container.children[index] ?? null);
            });
            while (container.children.length > nodes.length)
                container.lastElementChild.remove();
        };
        const catalog = root.querySelector('section[aria-labelledby="meme-card-catalog-title"]');
        const missingNotice = root.querySelector(':scope > p[role="status"]');
        let selected = start.selected;
        let card = start.card;
        let revealed = Boolean(selected && card);
        let seals = [...start.seals];
        let loading = false;
        let contentError = null;
        let contentRequest = null;
        let contentEpoch = 0;
        let revealWanted = false;
        let userId;
        let authFailed = false;
        let owned = new Set();
        let busy = false;
        let notice = null;
        let operation = 0;
        let claiming = false;
        let claimRequest = null;
        let ownershipRequest = null;
        let ownershipEpoch = 0;
        let ownershipKey = "";
        let verifiedUser;
        let authEpoch = 0;
        let view = null;
        function openView(section) {
            const actions = section.querySelector(`.meme-collectible-reveal-actions`);
            const details = section.querySelector(`.meme-collectible-reveal-details`);
            const area = section.querySelector(`.meme-collectible-scratch-area`);
            const stage = area.querySelector(`.meme-collectible-scratch-card`);
            const v = {
                section, actions, box: details, area, stage,
                eyebrow: details.querySelector(".meme-collectible-eyebrow"),
                title: details.querySelector("h2"),
                text: details.querySelector(":scope > p"),
                cancel: actions.querySelector("[data-meme-cards-cancel]"),
                small: actions.querySelector(":scope > p.meme-collectible-small:last-child"),
                loading: part("loading"),
                error: part("content-error"),
                errorRetry: null,
                owned: part("owned"),
                my: part("my"),
                login: part("login"),
                authFailure: part("auth-failure"),
                authRetry: part("auth-retry"),
                claim: actions.querySelector("[data-meme-cards-claim]") ?? part("claim"),
                loginHint: actions.querySelector(":scope > p.meme-collectible-small:not(:last-child)") ?? part("login-hint"),
                notice: part("notice"),
                details: actions.querySelector("a.meme-collectible-secondary-button") ?? part("details"),
                started: false,
                progress: 0,
                stop: null,
            };
            v.errorRetry = v.error.querySelector("button");
            v.errorRetry.addEventListener("click", () => void loadCard());
            v.authRetry.addEventListener("click", () => void checkUser());
            v.claim.addEventListener("click", () => void claim());
            v.cancel.addEventListener("click", () => changeSelection(null));
            area.querySelector("[data-meme-cards-reveal]")?.addEventListener("click", () => {
                void loadCard();
                reveal();
            });
            return v;
        }
        function face(c) {
            const node = root.querySelector("template[data-meme-cards-face]").content.firstElementChild.cloneNode(true);
            const title = node.querySelector("[data-meme-card-title]");
            title.textContent = c.title;
            title.title = c.title;
            const summary = node.querySelector("[data-meme-card-summary]");
            if (c.summary.trim()) {
                summary.textContent = c.summary;
                summary.title = c.summary;
            }
            else {
                summary?.remove();
            }
            const badges = node.querySelector(".meme-card-badges");
            if (c.originYear == null)
                badges.replaceChildren();
            else
                badges.querySelector(".meme-card-year").textContent = String(c.originYear);
            return node;
        }
        function renderArea() {
            const v = view;
            const unavailable = contentError === "unavailable";
            v.section.dataset.revealed = String(revealed);
            v.area.dataset.scratchProgress = String(v.progress);
            v.area.dataset.revealed = String(revealed);
            v.area.dataset.scratchState = revealed ? "revealed" : unavailable ? "error" : loading ? "loading" : v.started ? "scratching" : "sealed";
            v.stage.dataset.complete = String(revealed);
            const first = v.stage.firstElementChild;
            if ((revealed || v.started) && card && first && !first.matches("div[aria-hidden]:not(.meme-collectible-sealed-card)"))
                first.replaceWith(face(card));
            const shown = v.stage.firstElementChild;
            if (shown && !shown.classList.contains("meme-collectible-sealed-card"))
                shown.setAttribute("aria-hidden", String(!revealed));
            if (revealed) {
                for (const extra of v.stage.querySelectorAll("[data-scratch-shimmer], [data-scratch-brush], [data-scratch-dust]"))
                    extra.remove();
                const canvas = v.stage.querySelector("canvas");
                if (canvas) {
                    canvas.setAttribute("aria-hidden", "true");
                    canvas.dataset.complete = "true";
                    setTimeout(() => canvas.remove(), 360);
                }
                const controls = v.area.querySelector(".meme-collectible-scratch-controls");
                if (controls)
                    controls.replaceWith(part("revealed"));
            }
            else {
                const normalized = Math.min(100, Math.round(v.progress / REVEAL_RATIO));
                const bar = v.area.querySelector('[role="progressbar"]');
                bar.setAttribute("aria-valuenow", String(normalized));
                bar.querySelector("span").style.width = `${normalized}%`;
                v.area.querySelector(".meme-collectible-progress").textContent = `${copy.revealProgress} ${normalized}%`;
                v.area.querySelector("[data-meme-cards-reveal]").disabled = loading || unavailable;
            }
        }
        function render() {
            for (const li of catalog.querySelectorAll("li")) {
                const button = li.querySelector("button");
                button.setAttribute("aria-pressed", String(selected === button.dataset.cardId));
                const badge = button.querySelector(".meme-collectible-owned-badge");
                const show = Boolean(userId) && owned.has(button.dataset.cardId);
                if (show && !badge)
                    button.append(part("seal-owned"));
                if (!show)
                    badge?.remove();
            }
            const shuffle = root.querySelector("[data-meme-cards-shuffle]");
            if (shuffle)
                shuffle.disabled = seals.length < 2;
            if (missingNotice) {
                if (selected)
                    missingNotice.remove();
                else if (!missingNotice.isConnected)
                    root.querySelector(".meme-collectible-hero").after(missingNotice);
            }
            if (!view)
                return;
            const v = view;
            renderArea();
            const showCard = revealed && card;
            v.eyebrow.textContent = showCard ? `NO. ${String(card.cardNo).padStart(4, "0")} / 1000` : copy.sealed;
            v.title.textContent = showCard ? card.title : copy.revealTitle;
            v.text.textContent = showCard ? card.summary : copy.scratchHint;
            const detailNodes = [v.eyebrow, v.title, v.text];
            if (loading)
                detailNodes.push(v.loading);
            if (contentError) {
                v.error.querySelector("p").textContent = contentError === "failure" ? copy.revealLoadFailure : copy.unavailable;
                place(v.error, contentError === "failure" ? [v.error.querySelector("p"), v.errorRetry] : [v.error.querySelector("p")]);
                detailNodes.push(v.error);
            }
            detailNodes.push(v.actions);
            place(v.box, detailNodes);
            const selectedOwned = Boolean(userId && selected && owned.has(selected));
            const nodes = [];
            if (revealed) {
                if (selectedOwned)
                    nodes.push(v.owned, v.my);
                else if (userId === null) {
                    v.login.href = `/login?next=${encodeURIComponent(returnHref(selected, true))}`;
                    nodes.push(v.login);
                }
                else if (authFailed)
                    nodes.push(v.authFailure, v.authRetry);
                else {
                    v.claim.disabled = busy || userId === undefined || notice === "unavailable";
                    v.claim.textContent = busy ? copy.claiming : userId === undefined ? copy.checking : notice === "failure" ? copy.retry : copy.claim;
                    nodes.push(v.claim);
                }
            }
            if (revealed && !selectedOwned)
                nodes.push(v.loginHint);
            if (notice) {
                v.notice.textContent = copy[notice];
                nodes.push(v.notice);
            }
            if (revealed && card) {
                v.details.href = card.href;
                nodes.push(v.details);
            }
            nodes.push(v.cancel, v.small);
            place(v.actions, nodes);
        }
        function mountScratch() {
            const v = view;
            const canvas = v.stage.querySelector("canvas");
            if (!canvas || revealed || contentError === "unavailable")
                return;
            let ctx = null;
            try {
                ctx = canvas.getContext("2d");
            }
            catch { }
            if (!ctx) {
                canvas.dataset.canvasState = "unavailable";
                return;
            }
            const stage = v.stage;
            const mark = coverage();
            const strokes = [];
            const motion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
            const dustBox = stage.querySelector("[data-scratch-dust]");
            let activePointer = null;
            let previous = null;
            let completed = false;
            let began = false;
            let width = 0;
            let height = 0;
            let frame = 0;
            let lastDust = 0;
            const particles = new Set();
            const drawStroke = (from, to) => {
                ctx.globalCompositeOperation = "destination-out";
                ctx.globalAlpha = 1;
                ctx.strokeStyle = "#000";
                ctx.fillStyle = "#000";
                ctx.lineWidth = to.radiusX * width * 2;
                ctx.lineCap = "round";
                ctx.lineJoin = "round";
                ctx.beginPath();
                ctx.moveTo(from.x * width, from.y * height);
                ctx.lineTo(to.x * width, to.y * height);
                ctx.stroke();
                ctx.beginPath();
                ctx.ellipse(to.x * width, to.y * height, to.radiusX * width, to.radiusY * height, 0, 0, Math.PI * 2);
                ctx.fill();
            };
            const paint = () => {
                const rect = canvas.getBoundingClientRect();
                if (!rect.width || !rect.height)
                    return;
                width = rect.width;
                height = rect.height;
                const density = Math.min(window.devicePixelRatio || 1, 3);
                canvas.width = Math.round(width * density);
                canvas.height = Math.round(height * density);
                ctx.setTransform(density, 0, 0, density, 0, 0);
                ctx.globalCompositeOperation = "source-over";
                ctx.globalAlpha = 1;
                const gradient = ctx.createLinearGradient(0, 0, width, height);
                [[0, "#e0e7ec"], [0.22, "#b6c6d5"], [0.43, "#edeee6"], [0.62, "#d2c9e8"], [0.8, "#b9d9d6"], [1, "#e8eaf0"]].forEach(([stop, color]) => gradient.addColorStop(stop, color));
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, width, height);
                ctx.strokeStyle = "rgba(255,255,255,.27)";
                ctx.lineWidth = 1;
                for (let x = -height; x < width; x += 7) {
                    ctx.beginPath();
                    ctx.moveTo(x, 0);
                    ctx.lineTo(x + height, height);
                    ctx.stroke();
                }
                ctx.strokeStyle = "rgba(40,51,69,.2)";
                ctx.lineWidth = 1;
                for (const radius of [0.25, 0.33, 0.41]) {
                    ctx.beginPath();
                    ctx.ellipse(width / 2, height * 0.44, width * radius, width * radius, -0.5, 0, Math.PI * 2);
                    ctx.stroke();
                }
                ctx.fillStyle = "#263346";
                ctx.textAlign = "center";
                ctx.font = `700 ${Math.max(10, width * 0.032)}px sans-serif`;
                ctx.fillText("MEMECATCH / COLLECTION", width / 2, height * 0.1);
                ctx.font = `800 ${Math.max(55, width * 0.31)}px sans-serif`;
                ctx.fillText("m↗", width / 2, height * 0.51);
                ctx.font = `700 ${Math.max(16, width * 0.066)}px sans-serif`;
                ctx.fillText(copy.foilTitle, width / 2, height * 0.77);
                ctx.font = `500 ${Math.max(11, width * 0.038)}px sans-serif`;
                ctx.fillText(copy.foilHint, width / 2, height * 0.83);
                for (const [from, to] of strokes)
                    drawStroke(from, to);
                canvas.style.background = "transparent";
                canvas.dataset.canvasState = "ready";
            };
            const follow = (event) => {
                if (completed)
                    return;
                const point = scratchPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
                if (!point) {
                    stage.dataset.pointer = "false";
                    return;
                }
                cancelAnimationFrame(frame);
                frame = requestAnimationFrame(() => {
                    stage.style.setProperty("--scratch-x", `${point.x * 100}%`);
                    stage.style.setProperty("--scratch-y", `${point.y * 100}%`);
                    stage.style.setProperty("--tilt-x", `${motion?.matches ? 0 : (point.y - 0.5) * -6}deg`);
                    stage.style.setProperty("--tilt-y", `${motion?.matches ? 0 : (point.x - 0.5) * 6}deg`);
                    stage.dataset.pointer = "true";
                });
            };
            const dust = (point, event) => {
                if (motion?.matches || !dustBox || event.timeStamp - lastDust < 32)
                    return;
                lastDust = event.timeStamp;
                for (let i = 0; i < 3 && particles.size < 36; i++) {
                    const particle = document.createElement("span");
                    particle.style.left = `${point.x * 100}%`;
                    particle.style.top = `${point.y * 100}%`;
                    particle.style.setProperty("--dust-x", `${(Math.random() - 0.5) * 85}px`);
                    particle.style.setProperty("--dust-y", `${20 + Math.random() * 65}px`);
                    particle.style.setProperty("--dust-turn", `${Math.random() * 180}deg`);
                    particles.add(particle);
                    dustBox.appendChild(particle);
                    particle.addEventListener("animationend", () => { particles.delete(particle); particle.remove(); }, { once: true });
                }
            };
            const end = (event) => {
                if (event && activePointer !== event.pointerId)
                    return;
                if (activePointer !== null && canvas.hasPointerCapture?.(activePointer))
                    canvas.releasePointerCapture(activePointer);
                activePointer = null;
                previous = null;
                stage.dataset.dragging = "false";
            };
            const scratch = (event) => {
                follow(event);
                if (completed || activePointer !== event.pointerId)
                    return;
                const point = scratchPoint(event.clientX, event.clientY, canvas.getBoundingClientRect());
                if (!point) {
                    previous = null;
                    return;
                }
                if (!began) {
                    began = true;
                    v.started = true;
                    void loadCard();
                    render();
                }
                const from = previous ?? point;
                strokes.push([from, point]);
                drawStroke(from, point);
                dust(point, event);
                const ratio = mark(from, point);
                previous = point;
                v.progress = Math.floor(ratio * 100);
                renderArea();
                if (ratio >= REVEAL_RATIO) {
                    completed = true;
                    end();
                    stage.dataset.pointer = "false";
                    reveal();
                }
            };
            const begin = (event) => {
                if (completed || activePointer !== null || (event.pointerType === "mouse" && event.button !== 0) || !width)
                    return;
                activePointer = event.pointerId;
                canvas.setPointerCapture?.(event.pointerId);
                stage.dataset.dragging = "true";
                scratch(event);
            };
            const leave = () => {
                if (activePointer === null) {
                    stage.dataset.pointer = "false";
                    stage.style.setProperty("--tilt-x", "0deg");
                    stage.style.setProperty("--tilt-y", "0deg");
                }
            };
            paint();
            const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(paint) : null;
            observer?.observe(canvas);
            addEventListener("resize", paint);
            canvas.addEventListener("pointerdown", begin);
            canvas.addEventListener("pointermove", scratch);
            canvas.addEventListener("pointerleave", leave);
            canvas.addEventListener("pointerup", end);
            canvas.addEventListener("pointercancel", end);
            canvas.addEventListener("lostpointercapture", end);
            v.stop = () => {
                end();
                cancelAnimationFrame(frame);
                for (const particle of particles)
                    particle.remove();
                observer?.disconnect();
                removeEventListener("resize", paint);
            };
        }
        function changeSelection(id) {
            operation++;
            claimRequest?.abort();
            claiming = false;
            contentEpoch++;
            contentRequest?.abort();
            contentRequest = null;
            revealWanted = false;
            busy = false;
            notice = null;
            selected = id;
            card = null;
            revealed = false;
            loading = false;
            contentError = null;
            history.replaceState(null, "", id ? returnHref(id, false) : catalogHref());
            view?.stop?.();
            view?.section.remove();
            view = null;
            if (id) {
                const section = root.querySelector("template[data-meme-cards-sealed]").content.firstElementChild.cloneNode(true);
                section.dataset.cardId = id;
                section.querySelector(".meme-collectible-scratch-area").dataset.cardId = id;
                catalog.before(section);
                view = openView(section);
                mountScratch();
            }
            render();
            refreshOwnership();
            if (id) {
                requestAnimationFrame(() => {
                    document.getElementById("reveal")?.scrollIntoView?.({ block: "start", behavior: "instant" });
                    view?.title.focus({ preventScroll: true });
                });
            }
        }
        function completeReveal(id) {
            revealed = true;
            history.replaceState(null, "", returnHref(id, true));
            view?.stop?.();
            render();
            requestAnimationFrame(() => view?.title.focus({ preventScroll: true }));
        }
        async function loadCard() {
            if (!selected || card || contentRequest || contentError === "unavailable")
                return;
            const id = selected;
            const epoch = ++contentEpoch;
            const controller = new AbortController();
            contentRequest = controller;
            loading = true;
            contentError = null;
            render();
            try {
                const response = await fetch(`/api/meme-cards/${id}`, { cache: "no-store", signal: controller.signal });
                if (controller.signal.aborted || contentEpoch !== epoch)
                    return;
                if (response.status === 404) {
                    contentError = "unavailable";
                    return;
                }
                if (!response.ok)
                    throw new Error("reveal_failed");
                const result = readCard(await response.json(), id);
                if (controller.signal.aborted || contentEpoch !== epoch)
                    return;
                if (!result)
                    throw new Error("invalid_reveal_result");
                card = result;
                if (revealWanted)
                    completeReveal(id);
            }
            catch {
                if (!controller.signal.aborted && contentEpoch === epoch)
                    contentError = "failure";
            }
            finally {
                if (contentEpoch === epoch) {
                    loading = false;
                    contentRequest = null;
                    render();
                }
            }
        }
        function reveal() {
            if (!selected || revealed || contentError === "unavailable")
                return;
            revealWanted = true;
            if (card)
                completeReveal(selected);
            else if (!contentError)
                void loadCard();
        }
        async function claim() {
            if (!selected || !revealed || !userId || claiming || owned.has(selected) || notice === "unavailable")
                return;
            claiming = true;
            busy = true;
            notice = null;
            render();
            const epoch = ++operation;
            const controller = new AbortController();
            claimRequest = controller;
            const cardId = selected;
            try {
                const response = await fetch("/api/meme-cards/claim", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cardId }), signal: controller.signal, cache: "no-store" });
                if (controller.signal.aborted || operation !== epoch)
                    return;
                if (response.status === 401) {
                    ownershipEpoch++;
                    ownershipRequest?.abort();
                    verifiedUser = null;
                    userId = null;
                    owned = new Set();
                    notice = "expired";
                    return;
                }
                if (response.status === 404 || response.status === 409) {
                    notice = "unavailable";
                    return;
                }
                if (!response.ok)
                    throw new Error("claim_failed");
                const result = await response.json();
                if (controller.signal.aborted || operation !== epoch)
                    return;
                if (!result || typeof result !== "object" || result.cardId !== cardId || result.owned !== true)
                    throw new Error("invalid_claim_result");
                owned = new Set([...owned, cardId]);
            }
            catch {
                if (!controller.signal.aborted && operation === epoch)
                    notice = "failure";
            }
            finally {
                if (operation === epoch) {
                    claiming = false;
                    busy = false;
                    claimRequest = null;
                }
                render();
            }
        }
        async function readSession() {
            const response = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" });
            if (!response.ok)
                return null;
            const body = await response.json();
            return body?.user ? { user: body.user } : null;
        }
        async function checkUser() {
            const epoch = ++authEpoch;
            authFailed = false;
            const session = await readSession().catch(() => null);
            if (authEpoch !== epoch)
                return;
            const id = session?.user?.id ?? null;
            if (verifiedUser !== id) {
                operation++;
                claiming = false;
                claimRequest?.abort();
                ownershipEpoch++;
                ownershipRequest?.abort();
                owned = new Set();
                busy = false;
                verifiedUser = id;
            }
            userId = id;
            render();
            refreshOwnership();
        }
        function revalidate() {
            ownershipEpoch++;
            ownershipRequest?.abort();
            ownershipKey = "";
            operation++;
            claiming = false;
            claimRequest?.abort();
            busy = false;
            userId = undefined;
            owned = new Set();
            render();
            void checkUser();
        }
        function refreshOwnership() {
            const visibleIds = [selected, ...start.seals].filter((id, index, all) => Boolean(id) && all.indexOf(id) === index).slice(0, 24).join(",");
            const key = userId && visibleIds ? `${userId}|${visibleIds}` : "";
            if (key === ownershipKey)
                return;
            ownershipKey = key;
            ownershipRequest?.abort();
            if (!key)
                return;
            const controller = new AbortController();
            ownershipRequest = controller;
            const epoch = ownershipEpoch;
            const owner = userId;
            fetch(`/api/meme-cards/collection?cardIds=${encodeURIComponent(visibleIds)}`, { signal: controller.signal, cache: "no-store" }).then(async (response) => {
                if (controller.signal.aborted || ownershipEpoch !== epoch || verifiedUser !== owner)
                    return;
                if (response.status === 401) {
                    ownershipEpoch++;
                    verifiedUser = null;
                    operation++;
                    claimRequest?.abort();
                    claiming = false;
                    userId = null;
                    owned = new Set();
                    busy = false;
                    ownershipKey = "";
                    render();
                    return;
                }
                if (!response.ok)
                    return;
                const result = await response.json();
                if (controller.signal.aborted || ownershipEpoch !== epoch || verifiedUser !== owner || !result || !Array.isArray(result.ownedCardIds))
                    return;
                const ids = result.ownedCardIds.filter((id) => typeof id === "string" && visibleIds.split(",").includes(id));
                owned = new Set([...owned, ...ids]);
                render();
            }).catch(() => { });
        }
        root.querySelector("[data-meme-cards-shuffle]")?.addEventListener("click", () => {
            const next = [...seals];
            for (let i = next.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [next[i], next[j]] = [next[j], next[i]];
            }
            seals = next;
            const grid = root.querySelector("[data-meme-cards-grid]");
            const items = new Map([...grid.children].map((li) => [li.querySelector("button").dataset.cardId, li]));
            grid.replaceChildren(...seals.map((id) => items.get(id)));
            [...grid.querySelectorAll("button")].forEach((button, index) => button.setAttribute("aria-label", copy.sealedChoice.replace("{index}", String(index + 1))));
        });
        catalog.addEventListener("click", (event) => {
            const button = event.target instanceof Element && event.target.closest("button[data-card-id]");
            if (button)
                changeSelection(button.dataset.cardId);
        });
        const opened = root.querySelector("section#reveal");
        if (opened) {
            view = openView(opened);
            mountScratch();
        }
        void checkUser();
        readSession().then((session) => {
            if (session)
                revalidate();
            else {
                authEpoch++;
                verifiedUser = null;
                ownershipEpoch++;
                ownershipRequest?.abort();
                ownershipKey = "";
                operation++;
                claiming = false;
                claimRequest?.abort();
                userId = null;
                owned = new Set();
                busy = false;
                render();
            }
        }).catch(() => {
            authEpoch++;
            verifiedUser = null;
            userId = null;
            owned = new Set();
            busy = false;
            render();
        });
        addEventListener("focus", revalidate);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible")
                revalidate();
        });
    }
}
})();
