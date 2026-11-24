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
const { MAX_UPLOAD_BYTES, uploadMemeImage, validateUploadFile } = lib.upload;
const { createPlanClient } = lib.plan;
const { memePathFrom } = lib.labels;
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
        if (value !== undefined && value !== null && value !== false)
            node.setAttribute(name, value === true ? "" : value);
    }
    node.append(...children.filter((child) => child !== null && child !== undefined && child !== false));
    return node;
};
function detectProvider(rawUrl) {
    try {
        const hostname = new URL(rawUrl).hostname.toLowerCase();
        const isHost = (domain) => hostname === domain || hostname.endsWith(`.${domain}`);
        if (isHost("youtube.com") || isHost("youtu.be"))
            return "youtube";
        if (isHost("tiktok.com"))
            return "tiktok";
        if (isHost("instagram.com"))
            return "instagram";
        if (isHost("facebook.com") || hostname === "fb.watch")
            return "facebook";
        if (isHost("threads.net") || isHost("threads.com"))
            return "threads";
        return null;
    }
    catch {
        return null;
    }
}
function isTrustedEmbedUrl(provider, rawUrl) {
    if (!rawUrl)
        return false;
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== "https:")
            return false;
        if (provider === "youtube")
            return url.hostname === "www.youtube-nocookie.com" && url.pathname.startsWith("/embed/");
        if (provider === "tiktok")
            return url.hostname === "www.tiktok.com" && url.pathname.startsWith("/player/v1/");
        if (provider === "instagram")
            return url.hostname === "www.instagram.com" && url.pathname.endsWith("/embed/captioned/");
        if (provider === "facebook")
            return url.hostname === "www.facebook.com" && url.pathname.startsWith("/plugins/");
        return false;
    }
    catch {
        return false;
    }
}
const threadsDocument = (html) => `<!doctype html><html><head><meta name="referrer" content="strict-origin-when-cross-origin"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:transparent}body{display:flex;justify-content:center}</style></head><body>${html}</body></html>`;
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
    let uploaded = null;
    let dupSeq = 0;
    let dupTimer = 0;
    let draftTimer = 0;
    const values = () => Object.fromEntries(FIELDS.map((key) => [key, input(key).value]));
    function previewElement() {
        const p = copy.preview;
        const url = input("sourceUrl").value.trim();
        if (!url)
            return element("p", { class: "mt-2 text-sm text-muted", "data-submit-preview": "" }, p.idle);
        const provider = detectProvider(url);
        if (!provider)
            return element("p", { class: "mt-2 text-sm text-muted", "data-submit-preview": "" }, p.unsupported);
        const name = PROVIDER_NAMES[provider];
        const current = state.preview.url === url ? state.preview : { status: "idle" };
        const head = element("div", { class: "flex items-center justify-between border-b border-border bg-surface-2 px-4 py-2.5" }, element("p", { class: "flex items-center gap-2 text-sm font-bold" }, element("span", { class: "h-2 w-2 rounded-full bg-accent", "aria-hidden": "true" }), p.checking), element("span", { class: "rounded-full bg-background px-2.5 py-1 text-xs font-semibold text-muted" }, name));
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
            if (data.provider === "threads" && data.embedHtml)
                frame.srcdoc = threadsDocument(data.embedHtml);
            body = element("div", {}, element("div", { class: "flex items-start gap-2 border-b border-border px-4 py-3" }, element("span", { "aria-hidden": "true", class: "mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-safety-green-bg text-xs font-bold text-safety-green" }, "✓"), element("div", { class: "min-w-0" }, element("p", { class: "text-sm font-bold text-safety-green" }, p.ready), element("p", { class: "truncate text-sm text-muted" }, data.title || p.providerContent.replace("{provider}", name), data.authorName ? ` · ${data.authorName}` : ""))), element("div", { class: "bg-surface-2 p-2 sm:p-3" }, frame));
        }
        else {
            const loading = current.status === "loading";
            const verify = element("button", { type: "button", disabled: loading, class: "mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent-soft px-4 text-sm font-bold text-accent transition-colors hover:bg-accent-strong hover:text-white disabled:cursor-wait disabled:opacity-60" }, loading ? element("span", { "aria-hidden": "true", class: "h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" }) : null, loading ? p.verifying : p.verify);
            verify.addEventListener("click", () => checkPreview(url, provider));
            body = element("div", { class: "p-4" }, element("p", { class: "text-sm text-muted" }, p.verifyBody), verify, current.status === "error" ? element("p", { role: "alert", class: "mt-3 text-sm text-safety-red" }, `${current.message} ${p.errorSuffix}`) : null);
        }
        return element("section", { "aria-label": p.label, class: "mt-3 overflow-hidden rounded-2xl border border-border bg-surface", "data-submit-preview": "" }, head, body);
    }
    async function checkPreview(url, provider) {
        state.preview = { status: "loading", url };
        render();
        try {
            const response = await fetch(`/api/oembed?url=${encodeURIComponent(url)}`);
            const result = await response.json();
            if (!response.ok || !("provider" in result))
                throw new Error(copy.preview.genericError);
            const trusted = result.provider === "threads"
                ? typeof result.embedHtml === "string" && result.embedHtml.length > 0
                : isTrustedEmbedUrl(result.provider, result.embedUrl);
            if (result.provider !== provider || !trusted)
                throw new Error(copy.preview.unsafeError);
            state.preview = { status: "ready", url, data: result };
        }
        catch (error) {
            state.preview = { status: "error", url, message: error instanceof Error && error.message === copy.preview.unsafeError ? copy.preview.unsafeError : copy.preview.genericError };
        }
        render();
    }
    const errorLine = (id, message) => element("p", { id: `${id}-error`, role: "alert", class: "mt-1.5 text-sm text-safety-red", "data-submit-error": "" }, message);
    function render() {
        if (state.result.status === "success") {
            const f = copy.form;
            form.replaceWith(element("section", { "aria-live": "polite", class: "rounded-2xl border border-border bg-surface p-6" }, element("span", { class: "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-sm font-semibold bg-safety-gray-bg text-safety-gray shadow-[0_0_0_1px_color-mix(in_srgb,var(--safety-gray)_30%,transparent),0_0_10px_-4px_color-mix(in_srgb,var(--safety-gray)_50%,transparent)] " }, f.successBadge), element("h2", { class: "mt-3 text-xl font-bold" }, f.successTitle), element("p", { class: "mt-2 text-muted" }, f.successBody), element("div", { class: "mt-6 flex flex-col gap-3" }, element("a", { href: "/my", class: "flex h-12 items-center justify-center rounded-xl bg-accent-strong text-base font-bold text-white" }, f.viewMy), element("a", { href: "/submit", class: "flex h-12 items-center justify-center rounded-xl border border-border bg-surface text-base font-semibold" }, f.submitAnother))));
            return;
        }
        const f = copy.form;
        for (const node of form.querySelectorAll("[data-submit-text]")) {
            const value = node.dataset.submitText.split(".").reduce((at, key) => at?.[key], copy);
            if (typeof value === "string")
                node.textContent = value;
        }
        const lead = form.querySelector("[data-submit-lead]");
        const first = [...lead.childNodes].find((node) => node.nodeType === 3);
        if (first)
            first.data = f.nameLabel;
        form.querySelector("[data-submit-required]").textContent = `(${f.required})`;
        for (const [key, placeholder] of Object.entries(PLACEHOLDERS))
            input(key).placeholder = f[placeholder];
        form.querySelector("[data-submit-restored]")?.remove();
        form.querySelector("[data-submit-form-error]")?.remove();
        const formError = state.result.status === "error" ? state.result.formError : undefined;
        if (formError)
            form.prepend(element("p", { role: "alert", class: "rounded-xl bg-safety-red-bg px-4 py-3 text-safety-red", "data-submit-form-error": "" }, formError));
        if (state.restored)
            form.prepend(element("p", { class: "rounded-xl bg-surface-2 px-4 py-3 text-muted", role: "status", "data-submit-restored": "" }, f.restored));
        const fieldErrors = state.result.status === "error" ? state.result.fieldErrors ?? {} : {};
        for (const key of FIELDS) {
            const box = fieldBox(key);
            const control = input(key);
            box.querySelector("[data-submit-error]")?.remove();
            control.setAttribute("aria-invalid", String(Boolean(fieldErrors[key])));
            if (fieldErrors[key]) {
                control.setAttribute("aria-describedby", `${control.id}-error`);
                control.after(errorLine(control.id, fieldErrors[key]));
            }
            else {
                control.removeAttribute("aria-describedby");
            }
        }
        const nameBox = fieldBox("name");
        nameBox.querySelector("[data-submit-dups]")?.remove();
        if (state.dupLoading) {
            nameBox.append(element("p", { class: "mt-2 flex items-center gap-1.5 text-sm text-muted", role: "status", "data-submit-dups": "" }, element("span", { "aria-hidden": "true", class: "signal-live size-1.5 shrink-0 rounded-full bg-(--signal-cyan)" }), f.duplicateLoading));
        }
        else if (state.dups.length > 0) {
            nameBox.append(element("div", { class: "mt-2 rounded-xl bg-safety-yellow-bg px-4 py-3", role: "status", "data-submit-dups": "" }, element("p", { class: "font-medium text-safety-yellow" }, f.duplicateTitle), element("ul", { class: "mt-2 flex flex-col gap-1" }, ...state.dups.map((meme) => element("li", {}, element("a", { href: memePathFrom(meme.short_id, meme.slug), class: "inline-flex min-h-11 items-center text-foreground underline underline-offset-4" }, meme.title)))), element("p", { class: "mt-1 text-sm text-muted" }, f.duplicateBody)));
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
            attachBox.append(element("div", { class: "mt-3 flex items-start gap-3", "data-submit-image": "" }, element("img", { src: state.previewUrl, alt: f.attachmentPreview, class: "max-h-48 w-auto max-w-full rounded-xl border border-border object-contain" }), remove));
        }
        const busy = state.pending || state.uploading;
        submit.disabled = busy;
        submit.replaceChildren(busy ? element("span", { "aria-hidden": "true", class: state.uploading ? "signal-live size-2.5 rounded-full bg-(--signal-cyan)" : "h-4 w-4 animate-spin rounded-full border-2 border-flame-200/40 border-t-white" }) : "", state.uploading ? f.uploading : state.pending ? f.submitting : f.submit);
    }
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
            }
            catch (caught) {
                error = caught;
            }
            if (seq !== dupSeq)
                return;
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
                if (Object.values(fields).some((value) => value.trim() !== ""))
                    localStorage.setItem(DRAFT_KEY, JSON.stringify(fields));
            }
            catch {
            }
        }, DRAFT_DELAY_MS);
    }
    function removeFile() {
        if (state.previewUrl)
            URL.revokeObjectURL(state.previewUrl);
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
        if (state.previewUrl)
            URL.revokeObjectURL(state.previewUrl);
        state.attachFile = picked;
        state.previewUrl = URL.createObjectURL(picked);
        render();
    });
    const showError = () => {
        const page = document.querySelector("main");
        if (!page)
            return;
        const retry = element("button", { type: "button", class: "mt-6 h-12 rounded-xl bg-accent-strong px-6 text-base font-bold text-white" }, copy.page.retry);
        retry.addEventListener("click", () => location.reload());
        page.replaceWith(element("main", { class: "mx-auto w-full max-w-site px-4 py-16 text-center" }, element("div", { class: "mx-auto w-full max-w-md" }, element("h1", { class: "text-xl font-bold" }, copy.page.loadErrorTitle), element("p", { class: "mt-2 text-muted" }, copy.page.loadErrorBody), retry)));
    };
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        if (state.pending || state.uploading)
            return;
        state.uploadError = null;
        let attachmentPath = "";
        if (state.attachFile) {
            if (uploaded?.file === state.attachFile) {
                attachmentPath = uploaded.path;
            }
            else {
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
                }
                finally {
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
        }
        catch {
            showError();
            return;
        }
        state.pending = false;
        if (state.result.status === "success") {
            try {
                localStorage.removeItem(DRAFT_KEY);
            }
            catch {
            }
        }
        render();
    });
    for (const key of FIELDS) {
        input(key).addEventListener("input", () => {
            if (key === "name")
                searchDuplicates();
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
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
            const draft = JSON.parse(raw);
            for (const key of FIELDS) {
                const value = key === "name" ? defaultName || draft.name || "" : draft[key] ?? "";
                input(key).value = value;
            }
            if (Object.values(draft).some((value) => typeof value === "string" && value.trim()))
                state.restored = true;
        }
    }
    catch {
    }
    searchDuplicates();
    render();
}
})();
