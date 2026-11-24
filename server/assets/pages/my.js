(() => {
"use strict";
const lib = {};
lib.analytics = { track: (...args) => window.memecatch.track(...args) };
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
lib.labels = (() => {
const SAFETY_LEVELS = {
    green: { user: "써도 됨", admin: "안전", token: "safety-green", icon: "●" },
    yellow: { user: "맥락 주의", admin: "주의", token: "safety-yellow", icon: "▲" },
    gray: { user: "이미 늦음", admin: "사어", token: "safety-gray", icon: "◌" },
    red: { user: "쓰면 위험", admin: "위험", token: "safety-red", icon: "✕" },
};
const LIFECYCLE_STATUS = {
    rising: { user: "급상승", token: "life-rising", flame: 4 },
    active: { user: "유행 중", token: "life-active", flame: 3 },
    cooling: { user: "식는 중", token: "life-cooling", flame: 2 },
    archived: { user: "추억 밈", token: "life-archived", flame: 1 },
};
const ORIGIN_KIND = {
    catalog: { user: null, admin: "카탈로그" },
    house_original: { user: "밈캐치 자체 제작", admin: "자체 제작" },
};
const MODERATION_STATUS = {
    pending: { admin: "대기", token: "mod-pending" },
    fact_checking: { admin: "사실 확인 중", token: "mod-checking" },
    rights_checking: { admin: "저작권 확인 중", token: "mod-checking" },
    approved: { admin: "게시됨", token: "mod-approved" },
    limited: { admin: "제한 공개", user: "출처 확인 중", token: "mod-limited" },
    rejected: { admin: "반려", token: "mod-rejected" },
};
const CATEGORIES = {
    phrase: { user: "밈 용어(유행어)", emojiFree: true, tone: "cat-phrase", icon: "speech" },
    dance: { user: "챌린지 댄스", tone: "cat-dance", icon: "dance" },
    song: { user: "노래", tone: "cat-song", icon: "note" },
    image: { user: "밈 영상", tone: "cat-image", icon: "frame" },
    comment: { user: "드라마 장면", tone: "cat-comment", icon: "comment" },
    challenge: { user: "챌린지 댄스", tone: "cat-dance", icon: "dance" },
};
const DISPLAY_CATEGORIES = {
    "ai-meme": {
        key: "ai-meme",
        user: "AI 밈",
        tone: "cat-image",
        icon: "frame",
        categories: ["phrase", "image"],
    },
    meme_term: {
        key: "meme_term",
        user: "밈 용어(유행어)",
        tone: "cat-phrase",
        icon: "speech",
        categories: ["phrase"],
    },
    challenge_dance: {
        key: "challenge_dance",
        user: "챌린지 댄스",
        tone: "cat-dance",
        icon: "dance",
        categories: ["dance", "challenge"],
    },
    song: {
        key: "song",
        user: "노래",
        tone: "cat-song",
        icon: "note",
        categories: ["song"],
    },
    drama_scene: {
        key: "drama_scene",
        user: "드라마 장면",
        tone: "cat-comment",
        icon: "comment",
        categories: ["comment"],
    },
    meme_video: {
        key: "meme_video",
        user: "밈 영상",
        tone: "cat-image",
        icon: "frame",
        categories: ["image"],
    },
};
const AI_MEME_DISPLAY_CATEGORY = "ai-meme";
const AI_MEME_TOPIC_TAG = "AI 밈";
const DISPLAY_BY_LEGACY_CATEGORY = {
    phrase: "meme_term",
    dance: "challenge_dance",
    song: "song",
    image: "meme_video",
    comment: "drama_scene",
    challenge: "challenge_dance",
};
const DISPLAY_CATEGORY_TOKENS = Object.values(DISPLAY_CATEGORIES).map((item) => item.key);
function normalizeDisplayCategory(token) {
    if (DISPLAY_CATEGORY_TOKENS.includes(token)) {
        return token;
    }
    if (Object.keys(CATEGORIES).includes(token)) {
        return DISPLAY_BY_LEGACY_CATEGORY[token];
    }
    return null;
}
const DISPLAY_CATEGORY_LIST = Object.values(DISPLAY_CATEGORIES);
function resolveDisplayCategory(category) {
    return DISPLAY_BY_LEGACY_CATEGORY[category];
}
function expandDisplayCategoryTokens(tokens) {
    const normalized = [...new Set(tokens.map((token) => normalizeDisplayCategory(token)).filter(Boolean))];
    return normalized;
}
function expandToLegacyCategories(tokens) {
    const categories = new Set();
    for (const token of tokens) {
        for (const category of DISPLAY_CATEGORIES[token].categories) {
            categories.add(category);
        }
    }
    return [...categories];
}
const DIFFICULTY = {
    beginner: { user: "입문", token: "diff-beginner" },
    normal: { user: "보통", token: "diff-normal" },
    deep: { user: "고인물", token: "diff-deep" },
};
const SENTIMENT = {
    funny: { user: null },
    ironic: { user: null },
    controversial: { user: "논쟁 중", token: "sent-controversial" },
    negative: { user: null },
    wholesome: { user: null },
};
const REACTIONS = {
    understood: { user: "이해됨", emoji: "💡" },
    funny: { user: "웃김", emoji: "😂" },
    just_learned: { user: "이제 알았다", emoji: "👀" },
    too_late: { user: "이미 늦었다", emoji: "🕰️" },
    still_alive: { user: "아직 살아있다", emoji: "🔥" },
    risky: { user: "쓰면 위험하다", emoji: "🚨" },
};
const SUBMISSION_STATUS = {
    pending: { user: "접수됨 — 24~48시간 내 검토돼요", token: "sub-pending" },
    reviewing: { user: "검수 중", token: "sub-reviewing" },
    approved: { user: "등록 완료!", token: "sub-approved" },
    rejected: { user: "반려됨", token: "sub-rejected" },
};
const USAGE_CONTEXTS = {
    work: "직장에서",
    friends: "친구끼리",
    family: "자녀·가족과",
    sns: "공개 SNS에서",
};
const SECTION_TITLES = {
    trending: "오늘의 급상승",
    forBeginners: "지금 알아도 충분한 밈",
    catchUp: "따라잡기 큐레이션",
    controversial: "지금 논쟁 중",
    fresh: "새로 등록된 밈",
};
const DEFINITE_YEAR_PRECISIONS = ["exact", "year"];
function formatOriginYear(year, precision) {
    if (typeof year !== "number" || !Number.isFinite(year))
        return null;
    const isDefinite = DEFINITE_YEAR_PRECISIONS.some((p) => p === precision);
    return isDefinite ? `${year}년생 밈` : `${year}년생 밈 (추정)`;
}
function memePathFrom(shortId, slug) {
    return `/memes/${shortId}-${encodeURIComponent(slug)}`;
}
function shortIdFromParam(param) {
    try {
        return decodeURIComponent(param).split("-")[0];
    }
    catch {
        return param.split("-")[0];
    }
}
return { SAFETY_LEVELS, LIFECYCLE_STATUS, ORIGIN_KIND, MODERATION_STATUS, CATEGORIES, DISPLAY_CATEGORIES, AI_MEME_DISPLAY_CATEGORY, AI_MEME_TOPIC_TAG, DISPLAY_CATEGORY_LIST, resolveDisplayCategory, expandDisplayCategoryTokens, expandToLegacyCategories, DIFFICULTY, SENTIMENT, REACTIONS, SUBMISSION_STATUS, USAGE_CONTEXTS, SECTION_TITLES, DEFINITE_YEAR_PRECISIONS, formatOriginYear, memePathFrom, shortIdFromParam };
})();
lib.dailyQuizWidget = (() => {
const { LOCAL_STREAK_KEY, kstDayKey, parseLocalRecord, recordLocalAnswer, statusFromLocal, statusFromRpcRow } = lib.dailyQuiz;
const { createPlanClient } = lib.plan;
const { memePathFrom } = lib.labels;
const { track } = lib.analytics;
const postPlan = async (plan) => {
    const response = await fetch("/api/db/query", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ plan }),
    });
    return response.json();
};
const readLocal = () => {
    try {
        return parseLocalRecord(localStorage.getItem(LOCAL_STREAK_KEY));
    }
    catch {
        return null;
    }
};
const writeLocal = (record) => {
    try {
        localStorage.setItem(LOCAL_STREAK_KEY, JSON.stringify(record));
    }
    catch {
    }
};
async function loadServerStatus() {
    const response = await fetch("/api/auth/get-session", { credentials: "same-origin", cache: "no-store" });
    const user = response.ok ? (await response.json())?.user : null;
    if (!user)
        return null;
    const { data, error } = await createPlanClient(postPlan).rpc("get_daily_meme_quiz_status").single();
    if (error || !data)
        return null;
    return statusFromRpcRow(data);
}
async function completeOnServer(memeShortId, correct) {
    const { data, error } = await createPlanClient(postPlan)
        .rpc("complete_daily_meme_quiz", { p_meme_short_id: memeShortId, p_correct: correct })
        .single();
    return !error && data ? statusFromRpcRow(data) : null;
}
const element = (tag, attributes = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
        if (value !== undefined && value !== null && value !== false)
            node.setAttribute(name, value === true ? "" : value);
    }
    node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
    return node;
};
function startDailyQuiz(section, variant = "home") {
    const card = section.firstElementChild;
    const state = { question: null, day: null, status: null, signedIn: false, selected: null, unsynced: null };
    const answered = () => state.selected !== null || state.status?.answeredToday === true;
    const streakBadge = () => {
        const status = state.status;
        if (!status)
            return null;
        const streak = status.currentStreak;
        return element("p", { class: "stat-mono inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm font-bold", "aria-label": `연속 출석 ${streak}일, 최고 ${status.bestStreak}일` }, element("span", { "aria-hidden": "true" }, "🔥"), `${streak}일 연속`, status.bestStreak > streak ? element("span", { class: "font-normal text-muted" }, `· 최고 ${status.bestStreak}일`) : null);
    };
    const questionBody = () => {
        const { question, selected } = state;
        const done = answered();
        const items = question.options.map((option, index) => {
            const isAnswer = index === question.answerIndex;
            const isPicked = index === selected;
            let stateClass = "border-border bg-surface hover:border-accent";
            if (done) {
                if (isAnswer)
                    stateClass = "border-safety-green bg-safety-green-bg text-safety-green";
                else if (isPicked)
                    stateClass = "border-safety-red bg-safety-red-bg text-safety-red";
                else
                    stateClass = "border-border bg-surface text-muted opacity-70";
            }
            const button = element("button", { type: "button", disabled: done, "aria-pressed": String(isPicked), class: `flex w-full min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${stateClass}` }, element("span", { "aria-hidden": "true", class: "grid size-6 shrink-0 place-items-center rounded-md border border-current/30 text-xs font-bold" }, String(index + 1)), element("span", { class: "min-w-0 flex-1" }, option));
            button.addEventListener("click", () => select(index));
            return element("li", {}, button);
        });
        return [
            element("p", { class: "mt-3 font-semibold leading-snug sm:text-lg" }, question.question),
            element("ol", { class: "mt-3 space-y-2" }, ...items),
            done && selected !== null
                ? element("p", { class: "mt-3 text-sm font-semibold" }, selected === question.answerIndex
                    ? element("span", { class: "text-safety-green" }, "정답! 밈력이 느껴져요.")
                    : element("span", { class: "text-safety-red" }, `아쉬워요, 정답은 ${question.answerIndex + 1}번이에요.`))
                : null,
        ];
    };
    const footer = () => {
        const streak = state.status?.currentStreak ?? 0;
        const { question } = state;
        return element("div", { class: "mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4" }, element("p", { role: "status", class: "text-sm font-semibold" }, streak > 1 ? `${streak}일 연속 출석! 내일도 이어가요.` : "출석 완료! 내일 새 문제가 열려요.", state.signedIn ? null : element("span", { class: "mt-1 block text-xs font-normal text-muted" }, "지금은 이 기기에만 기록돼요. ", element("a", { href: "/login?next=/my", class: "font-semibold text-accent-text underline-offset-4 hover:underline" }, "로그인"), "하면 MY에서 연속 출석을 이어갈 수 있어요.")), element("div", { class: "flex flex-wrap items-center gap-2" }, element("a", { href: memePathFrom(question.meme.shortId, question.meme.slug), class: "inline-flex min-h-11 items-center rounded-full border border-border bg-surface px-4 text-sm font-medium text-muted transition-colors hover:border-accent hover:text-accent" }, "이 밈 보러가기"), variant === "compact" ? null : element("a", { href: "/quiz", class: "inline-flex min-h-11 items-center rounded-full bg-accent-strong px-4 text-sm font-bold text-white transition-transform active:scale-[0.97]" }, "10문제 더 풀기")));
    };
    const render = () => {
        const title = element("h2", { id: "daily-meme-quiz-title", class: "flex items-center gap-2 text-lg font-bold sm:text-xl" }, element("span", { "aria-hidden": "true", class: "inline-block rounded-md bg-accent-soft px-1.5 py-0.5 text-sm font-extrabold text-flame-800" }, "오늘"), "오늘의 밈 퀴즈", state.day ? element("span", { "aria-hidden": "true", class: "stat-mono text-xs font-normal text-muted" }, state.day.slice(5).replace("-", ".")) : null);
        const head = element("div", { class: "flex flex-wrap items-center justify-between gap-3" }, title, streakBadge());
        const body = state.question ? questionBody() : [element("p", { role: "status", class: "mt-4 text-sm text-muted" }, "오늘의 문제를 가져오고 있어요…")];
        card.replaceChildren(head, ...body, answered() && state.question ? footer() : null);
    };
    const syncUnsynced = async () => {
        if (state.unsynced === null || !state.question)
            return;
        const pick = state.unsynced;
        const saved = await completeOnServer(state.question.meme.shortId, pick === state.question.answerIndex);
        if (saved)
            state.status = saved;
        state.unsynced = null;
        render();
    };
    async function select(index) {
        const { question } = state;
        if (!question || answered())
            return;
        const today = state.day ?? kstDayKey();
        const correct = index === question.answerIndex;
        state.selected = index;
        track("quiz_complete", { mode: "daily", score: correct ? 1 : 0 });
        const next = recordLocalAnswer(readLocal(), today, index, correct);
        writeLocal(next);
        state.status = statusFromLocal(next, today);
        render();
        if (!state.signedIn)
            return;
        const saved = await completeOnServer(question.meme.shortId, correct);
        if (saved) {
            state.status = saved;
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
            const body = await response.json();
            state.question = body.question;
            state.day = body.date;
            render();
            syncUnsynced();
        }
        catch {
            section.remove();
        }
    })();
    (async () => {
        const today = kstDayKey();
        const local = readLocal();
        const server = await loadServerStatus().catch(() => null);
        state.signedIn = server !== null;
        state.status = server ?? statusFromLocal(local, today);
        if (local?.lastDate === today) {
            state.selected = local.lastSelected;
            if (server && !server.answeredToday)
                state.unsynced = local.lastSelected;
        }
        if (section.isConnected)
            render();
        syncUnsynced();
    })();
}
return { startDailyQuiz };
})();
const { ownedMemeCardArtPath } = lib.memeCardArt;
const { memeCardReturnHref } = lib.memeCollectibleUi;
const { startDailyQuiz } = lib.dailyQuizWidget;
{
    const quiz = document.querySelector("section[data-daily-quiz]");
    if (quiz)
        startDailyQuiz(quiz, quiz.dataset.dailyQuiz);
}
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
