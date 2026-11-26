(() => {
"use strict";
const lib = {};
lib.analytics = { track: (...args) => window.memecatch.track(...args) };
lib.site = { SITE_URL: (document.querySelector("[data-site-url]")?.dataset.siteUrl ?? location.origin).replace(/\/+$/, "") };
lib.quiz = (() => {
const QUIZ_SIZE = 10;
const OPTION_COUNT = 4;
const MIN_SUMMARY_LENGTH = 20;
function normalizeSummary(value) {
    return value.trim().replace(/\s+/g, " ");
}
const GENERIC_TITLE_WORDS = new Set([
    "챌린지", "챌린지송", "댄스챌린지", "밈", "댄스", "짤", "유행어", "신조어",
    "커버", "커버챌린지", "열풍", "시리즈", "안무", "챌", "송", "패러디",
    "브이로그", "예능", "영상", "노래",
]);
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function titleNameTokens(title) {
    const tokens = [];
    for (const paren of title.match(/[(（][^)）]*[)）]/g) ?? []) {
        tokens.push(paren.replace(/[(（)）]/g, "").trim());
    }
    const base = title.replace(/[(（][^)）]*[)）]/g, " ").trim();
    tokens.push(base);
    for (const token of base.split(/[\s·,/’'"“”!?]+/))
        tokens.push(token);
    return [...new Set(tokens)]
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !GENERIC_TITLE_WORDS.has(t));
}
function maskTitleWords(text, tokens) {
    let out = text;
    for (const token of [...tokens].sort((a, b) => b.length - a.length)) {
        out = out.replace(new RegExp(escapeRegExp(token), "gi"), "○○");
    }
    return out
        .replace(/[’'"“”]?○○[’'"“”]?/g, "○○")
        .replace(/(?:○○[\s]*){2,}/g, "○○ ")
        .replace(/\s+/g, " ")
        .trim();
}
function shuffle(items, rng = Math.random) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}
function pickDistractors(answerSummary, sameCategory, others, rng) {
    const picked = [];
    const NEAR_WINDOW = 9;
    for (const source of [sameCategory, others]) {
        if (picked.length >= OPTION_COUNT - 1)
            break;
        const candidates = [
            ...new Set(source.map((m) => normalizeSummary(m.summary))),
        ]
            .filter((s) => s !== answerSummary && !picked.includes(s))
            .sort((a, b) => Math.abs(a.length - answerSummary.length) -
            Math.abs(b.length - answerSummary.length));
        for (const s of shuffle(candidates.slice(0, NEAR_WINDOW), rng)) {
            if (picked.length >= OPTION_COUNT - 1)
                break;
            picked.push(s);
        }
        for (const s of candidates.slice(NEAR_WINDOW)) {
            if (picked.length >= OPTION_COUNT - 1)
                break;
            picked.push(s);
        }
    }
    return picked;
}
function buildQuestions(pool, count = QUIZ_SIZE, rng = Math.random) {
    const eligible = eligiblePool(pool);
    const questions = [];
    for (const answer of shuffle(eligible, rng)) {
        if (questions.length >= count)
            break;
        const question = buildQuestionFor(answer, eligible, rng);
        if (question)
            questions.push(question);
    }
    return questions;
}
function buildQuestionsForSet(targets, pool, rng = Math.random) {
    const seen = new Set();
    const merged = [...targets, ...pool].filter((m) => {
        if (seen.has(m.short_id))
            return false;
        seen.add(m.short_id);
        return true;
    });
    const eligible = eligiblePool(merged);
    const questions = [];
    for (const target of targets) {
        const answer = eligible.find((m) => m.short_id === target.short_id);
        if (!answer)
            continue;
        const question = buildQuestionFor(answer, eligible, rng);
        if (question)
            questions.push(question);
    }
    return questions;
}
function seededRng(seed) {
    let h = 0x811c9dc5;
    for (let i = 0; i < seed.length; i += 1) {
        h ^= seed.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    let a = h >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function eligiblePool(pool) {
    return pool.filter((m) => m.short_id &&
        m.slug &&
        m.title &&
        normalizeSummary(m.summary).length >= MIN_SUMMARY_LENGTH);
}
function buildQuestionFor(answer, eligible, rng) {
    const answerSummary = normalizeSummary(answer.summary);
    const sameCategory = [];
    const others = [];
    for (const candidate of eligible) {
        if (candidate.short_id === answer.short_id)
            continue;
        if (normalizeSummary(candidate.summary) === answerSummary)
            continue;
        (candidate.category === answer.category ? sameCategory : others).push(candidate);
    }
    const distractors = pickDistractors(answerSummary, sameCategory, others, rng);
    if (distractors.length < OPTION_COUNT - 1)
        return null;
    const nameTokens = titleNameTokens(answer.title);
    const raw = [answerSummary, ...distractors];
    const options = shuffle(raw.map((s) => maskTitleWords(s, nameTokens)), rng);
    const maskedAnswer = maskTitleWords(answerSummary, nameTokens);
    if (maskedAnswer.replace(/○/g, "").trim().length < 10)
        return null;
    if (new Set(options).size < OPTION_COUNT)
        return null;
    return {
        question: `「${answer.title}」, 무슨 뜻일까요?`,
        options,
        answerIndex: options.indexOf(maskedAnswer),
        meme: {
            id: answer.id,
            shortId: answer.short_id,
            slug: answer.slug,
            title: answer.title,
            originYear: answer.origin_year,
            safetyLevel: answer.safety_level,
        },
    };
}
function gradeForScore(correct, total) {
    const pct = total > 0 ? (correct / total) * 100 : 0;
    if (pct >= 90)
        return {
            label: "밈장인",
            comment: "지금 이 순간 뜨는 밈도 이미 알고 계시죠? 존경합니다.",
        };
    if (pct >= 70)
        return {
            label: "밈잘알",
            comment: "대화방 밈 해설 담당은 당신이었군요.",
        };
    if (pct >= 50)
        return {
            label: "밈러",
            comment: "감은 확실히 있어요. 급상승 탭이 마지막 퍼즐이에요.",
        };
    if (pct >= 30)
        return {
            label: "밈뉴비",
            comment: "출발이 좋아요. 오늘의 밈부터 하나씩 캐치!",
        };
    return {
        label: "밈세계 입문 환영",
        comment: "지금부터 알아가면 딱 좋은 타이밍이에요.",
    };
}
function eraDecadeLabel(years) {
    const valid = years.filter((y) => Number.isFinite(y) && y > 1900);
    if (valid.length === 0)
        return null;
    const avg = valid.reduce((sum, y) => sum + y, 0) / valid.length;
    return `${Math.floor(avg / 10) * 10}년대`;
}
return { QUIZ_SIZE, OPTION_COUNT, MIN_SUMMARY_LENGTH, maskTitleWords, shuffle, buildQuestions, buildQuestionsForSet, seededRng, gradeForScore, eraDecadeLabel };
})();
lib.quizShare = (() => {
const { gradeForScore, QUIZ_SIZE } = lib.quiz;
const QUIZ_SHORT_ID_PATTERN = /^[a-z0-9]{8}$/;
const SHORT_ID_LENGTH = 8;
const HEADER_LENGTH = 4;
const MODE_TO_CHAR = { all: "a", now: "n", retro: "r" };
const CHAR_TO_MODE = { a: "all", n: "now", r: "retro" };
function encodeQuizShareToken(input) {
    const { mode, shortIds, correct } = input;
    if (shortIds.length === 0 || shortIds.length > QUIZ_SIZE)
        return null;
    if (!shortIds.every((id) => QUIZ_SHORT_ID_PATTERN.test(id)))
        return null;
    let mask = 0;
    shortIds.forEach((_, i) => {
        if (correct[i])
            mask |= 1 << i;
    });
    return `${MODE_TO_CHAR[mode]}${mask.toString(16).padStart(3, "0")}${shortIds.join("")}`;
}
function decodeQuizShareToken(raw) {
    const token = raw.trim();
    if (token.length < HEADER_LENGTH + SHORT_ID_LENGTH)
        return null;
    const mode = CHAR_TO_MODE[token[0]];
    if (!mode)
        return null;
    const maskHex = token.slice(1, HEADER_LENGTH);
    if (!/^[0-9a-f]{3}$/.test(maskHex))
        return null;
    const body = token.slice(HEADER_LENGTH);
    if (body.length % SHORT_ID_LENGTH !== 0)
        return null;
    const total = body.length / SHORT_ID_LENGTH;
    if (total < 1 || total > QUIZ_SIZE)
        return null;
    const shortIds = [];
    for (let i = 0; i < total; i += 1) {
        const id = body.slice(i * SHORT_ID_LENGTH, (i + 1) * SHORT_ID_LENGTH);
        if (!QUIZ_SHORT_ID_PATTERN.test(id))
            return null;
        shortIds.push(id);
    }
    if (new Set(shortIds).size !== shortIds.length)
        return null;
    const mask = parseInt(maskHex, 16);
    if (mask >= 1 << total)
        return null;
    const correct = shortIds.map((_, i) => (mask & (1 << i)) !== 0);
    const score = correct.filter(Boolean).length;
    return { token, mode, shortIds, correct, score, total, grade: gradeForScore(score, total) };
}
function quizShareTokenFor(mode, questions, answers) {
    return encodeQuizShareToken({
        mode,
        shortIds: questions.map((q) => q.meme.shortId),
        correct: questions.map((q, i) => answers[i] === q.answerIndex),
    });
}
function quizResultPath(token) {
    return `/quiz/r/${token}`;
}
const QUIZ_OG_SIZE = { width: 1200, height: 630 };
function quizResultOgPath(token) {
    return `/og/quiz/${token}`;
}
const QUIZ_MODE_LABEL = {
    all: "전체",
    now: "요즘 밈",
    retro: "추억 밈",
};
return { QUIZ_SHORT_ID_PATTERN, encodeQuizShareToken, decodeQuizShareToken, quizShareTokenFor, quizResultPath, QUIZ_OG_SIZE, quizResultOgPath, QUIZ_MODE_LABEL };
})();
lib.quizCard = (() => {
"use client";
const { track } = lib.analytics;
const { SITE_URL } = lib.site;
function drawRoundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}
async function renderQuizCardCanvas(data) {
    if (typeof document !== "undefined" && document.fonts) {
        try {
            await document.fonts.ready;
        }
        catch {
        }
    }
    const width = 1080;
    const height = 1920;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx)
        throw new Error("Canvas 2D context not available");
    ctx.fillStyle = "#0f0f13";
    ctx.fillRect(0, 0, width, height);
    const orangeGlow = ctx.createRadialGradient(900, 320, 10, 900, 320, 650);
    orangeGlow.addColorStop(0, "rgba(255, 92, 56, 0.28)");
    orangeGlow.addColorStop(0.5, "rgba(255, 92, 56, 0.08)");
    orangeGlow.addColorStop(1, "rgba(255, 92, 56, 0)");
    ctx.fillStyle = orangeGlow;
    ctx.fillRect(0, 0, width, height);
    const cyanGlow = ctx.createRadialGradient(180, 1600, 10, 180, 1600, 580);
    cyanGlow.addColorStop(0, "rgba(34, 211, 238, 0.22)");
    cyanGlow.addColorStop(0.5, "rgba(34, 211, 238, 0.06)");
    cyanGlow.addColorStop(1, "rgba(34, 211, 238, 0)");
    ctx.fillStyle = cyanGlow;
    ctx.fillRect(0, 0, width, height);
    drawRoundedRect(ctx, 80, 100, 280, 60, 30);
    ctx.fillStyle = "#1c1c24";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ff5c38";
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(112, 130, 8, 0, Math.PI * 2);
    ctx.fillStyle = "#ff5c38";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 24px Pretendard, -apple-system, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText("MEMECATCH 밈캐치", 132, 130);
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 50px Pretendard, -apple-system, sans-serif';
    ctx.textBaseline = "alphabetic";
    ctx.fillText("2026 밈력 모의고사 성적표", 80, 225);
    const modeText = data.mode === "now"
        ? "모드: 요즘 밈 (2020년 이후 최신)"
        : data.mode === "retro"
            ? "모드: 추억 밈 (2009년 이전 그 시절)"
            : "모드: 전체 (1990년대 ~ 2026년)";
    ctx.fillStyle = "#ff6b47";
    ctx.font = '600 26px Pretendard, -apple-system, sans-serif';
    ctx.fillText(`공식 인증서 · ${modeText}`, 80, 275);
    const cardX = 80;
    const cardY = 320;
    const cardW = 920;
    const cardH = 1200;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 44);
    ctx.fillStyle = "#181820";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#2d2d38";
    ctx.stroke();
    const stampX = cardX + cardW - 120;
    const stampY = cardY + 110;
    ctx.save();
    ctx.translate(stampX, stampY);
    ctx.rotate(-0.08);
    ctx.beginPath();
    ctx.arc(0, 0, 54, 0, Math.PI * 2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ff5c38";
    ctx.stroke();
    ctx.fillStyle = "#ff5c38";
    ctx.font = 'bold 18px Pretendard, sans-serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("밈력고사", 0, -10);
    ctx.fillText(data.practice ? "연습" : "성적표", 0, 14);
    ctx.restore();
    drawRoundedRect(ctx, cardX + 50, cardY + 60, 320, 68, 34);
    ctx.fillStyle = "#331c17";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#ff5c38";
    ctx.stroke();
    ctx.fillStyle = "#ff6b47";
    ctx.font = 'bold 30px Pretendard, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(`🔥 ${data.grade.label}`, cardX + 75, cardY + 95);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#22d3ee";
    ctx.font = '800 130px Pretendard, sans-serif';
    ctx.fillText(String(data.score), cardX + 50, cardY + 280);
    const scoreNumWidth = ctx.measureText(String(data.score)).width;
    ctx.fillStyle = "#71717a";
    ctx.font = 'bold 50px Pretendard, sans-serif';
    ctx.fillText(` / ${data.total}`, cardX + 50 + scoreNumWidth + 15, cardY + 280);
    const barY = cardY + 330;
    const barWidth = 72;
    const barGap = 12;
    const barHeight = 14;
    for (let i = 0; i < data.total; i++) {
        const isCorrect = i < data.answers.length && data.answers[i] === data.questions[i]?.answerIndex;
        const bx = cardX + 50 + i * (barWidth + barGap);
        drawRoundedRect(ctx, bx, barY, barWidth, barHeight, 7);
        ctx.fillStyle = isCorrect ? "#22d3ee" : "#343442";
        ctx.fill();
    }
    const commentY = cardY + 380;
    const commentH = 130;
    drawRoundedRect(ctx, cardX + 50, commentY, cardW - 100, commentH, 24);
    ctx.fillStyle = "#22222c";
    ctx.fill();
    ctx.fillStyle = "#f4f4f5";
    ctx.font = 'bold 28px Pretendard, sans-serif';
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const comment = `"${data.grade.comment}"`;
    ctx.fillText(comment, cardX + 80, commentY + commentH / 2);
    const eraY = cardY + 560;
    ctx.fillStyle = "#a1a1aa";
    ctx.font = '600 28px Pretendard, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText("당신의 밈 감성 연대:", cardX + 50, eraY);
    const eraText = data.era ? `${data.era} 🕶️` : "전 연대 통달 ⚡";
    drawRoundedRect(ctx, cardX + 320, eraY - 26, 260, 52, 16);
    ctx.fillStyle = "#2c2214";
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#ff9d2e";
    ctx.stroke();
    ctx.fillStyle = "#ff9d2e";
    ctx.font = 'bold 26px Pretendard, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText(eraText, cardX + 450, eraY);
    ctx.beginPath();
    ctx.moveTo(cardX + 50, cardY + 640);
    ctx.lineTo(cardX + cardW - 50, cardY + 640);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "#2d2d38";
    ctx.stroke();
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 28px Pretendard, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText("맞힌 대표 밈 리스트", cardX + 50, cardY + 685);
    const correctMemes = data.questions
        .filter((q, i) => data.answers[i] === q.answerIndex)
        .slice(0, 6);
    const listStartY = cardY + 725;
    const colWidth = (cardW - 100 - 20) / 2;
    for (let idx = 0; idx < Math.min(correctMemes.length, 6); idx++) {
        const q = correctMemes[idx];
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        const mx = cardX + 50 + col * (colWidth + 20);
        const my = listStartY + row * 74;
        drawRoundedRect(ctx, mx, my, colWidth, 58, 16);
        ctx.fillStyle = "#1f1f28";
        ctx.fill();
        const titleText = q.meme.title.length > 10 ? q.meme.title.slice(0, 9) + "…" : q.meme.title;
        const yearText = q.meme.originYear ? ` (${q.meme.originYear})` : "";
        ctx.fillStyle = "#e4e4e7";
        ctx.font = '600 24px Pretendard, sans-serif';
        ctx.textBaseline = "middle";
        ctx.fillText(`✔ ${titleText}${yearText}`, mx + 20, my + 29);
    }
    const pct = data.total > 0 ? (data.score / data.total) * 100 : 0;
    let summaryTag = "💡 평가: 숏폼과 온라인 커뮤니티의 트렌드를 꿰뚫고 있는 얼리어답터!";
    if (pct >= 90) {
        summaryTag = "💡 평가: 디시 초창기부터 최신 숏폼까지 통달한 대한민국 1세대 인터넷 망령!";
    }
    else if (pct < 40) {
        summaryTag = "💡 평가: 인터넷 청정 구역 거주자! 밈캐치에서 1일 1밈 캐치해 보세요.";
    }
    ctx.fillStyle = "#ff9d2e";
    ctx.font = '600 24px Pretendard, sans-serif';
    ctx.textBaseline = "middle";
    ctx.fillText(summaryTag, cardX + 50, cardY + 1040);
    const ctaY = 1560;
    drawRoundedRect(ctx, 80, ctaY, 920, 180, 36);
    ctx.fillStyle = "#ff5c38";
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = 'bold 36px Pretendard, sans-serif';
    ctx.textBaseline = "alphabetic";
    ctx.fillText("나도 밈력 테스트하기 👉 catchmeme.com/quiz", 130, ctaY + 70);
    ctx.fillStyle = "#ffe8e1";
    ctx.font = '500 26px Pretendard, sans-serif';
    ctx.fillText("인스타 스토리에 공유하고 친구들의 밈력을 확인해보세요!", 130, ctaY + 125);
    ctx.fillStyle = "#71717a";
    ctx.font = '500 24px Pretendard, sans-serif';
    ctx.fillText("밈캐치 · MemeCatch", 80, 1810);
    return canvas;
}
async function downloadOrShareQuizCard(data) {
    track("quiz_share", { score: data.score, mode: data.mode });
    const canvas = await renderQuizCardCanvas(data);
    const blob = await new Promise((resolve) => {
        canvas.toBlob(resolve, "image/png");
    });
    if (!blob) {
        throw new Error("Failed to create image blob");
    }
    const filename = `밈력고사_성적표_${data.grade.label}_${data.score}점.png`;
    const file = new File([blob], filename, { type: "image/png" });
    if (typeof navigator !== "undefined" &&
        typeof navigator.share === "function") {
        try {
            if (!navigator.canShare || navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `나의 밈력 성적표 (${data.score}점 / ${data.grade.label})`,
                    text: data.practice
                        ? `나의 밈력 연습 결과 ${data.score}/${data.total}점 · ${data.shareUrl ?? `${SITE_URL}/quiz`}`
                        : `나의 밈력 ${data.score}/${data.total}점! 같은 문제로 내 점수 이겨보기 👉 ${data.shareUrl ?? `${SITE_URL}/quiz`}`,
                });
                return { shared: true, downloaded: false };
            }
        }
        catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") {
                return { shared: false, downloaded: false };
            }
        }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    return { shared: false, downloaded: true };
}
return { renderQuizCardCanvas, downloadOrShareQuizCard };
})();
const { eraDecadeLabel, gradeForScore } = lib.quiz;
const { quizResultPath, quizShareTokenFor } = lib.quizShare;
const { downloadOrShareQuizCard } = lib.quizCard;
const { SITE_URL } = lib.site;
const { track } = lib.analytics;
{
    const main = document.querySelector("main[data-quiz]");
    if (main) {
        const template = (name) => main.querySelector(`template[data-quiz-template="${name}"]`).content.firstElementChild.cloneNode(true);
        const slot = (root, name) => root.querySelector(`[data-slot="${name}"]`);
        const memePath = (meme) => `/memes/${meme.shortId}-${encodeURIComponent(meme.slug)}`;
        let challenge = JSON.parse(main.dataset.quiz).challenge;
        let phase = "start";
        let mode = challenge?.mode ?? "all";
        let questions = [];
        let replay = "general";
        let index = 0;
        let selected = null;
        let answers = [];
        let screen = main.querySelector("section[data-quiz-screen]");
        const stages = ["opened", "loaded", "completed"];
        let earned = challenge ? 1 : 0;
        let sent = 0;
        const flushStages = () => {
            if (document.visibilityState !== "visible" || !window.gtag)
                return;
            while (sent < earned)
                track(`quiz_challenge_${stages[sent++]}`, undefined, "ga");
            if (sent === stages.length)
                document.removeEventListener("visibilitychange", flushStages);
        };
        const recordStage = (stage) => {
            earned = Math.max(earned, stage);
            flushStages();
        };
        if (challenge && window.gtag) {
            document.addEventListener("visibilitychange", flushStages);
            flushStages();
        }
        function replayKind(loaded, requested) {
            if (loaded.length < Math.ceil(requested.length / 2) || loaded.length > requested.length) {
                throw new Error("invalid set size");
            }
            let cursor = 0;
            for (const { meme, question, options, answerIndex } of loaded) {
                if (typeof meme?.shortId !== "string" || typeof meme.slug !== "string" ||
                    typeof meme.title !== "string" || (meme.originYear !== null && !Number.isFinite(meme.originYear)) ||
                    typeof question !== "string" || !Array.isArray(options) || options.length !== 4 ||
                    !options.every((option) => typeof option === "string") ||
                    !Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) {
                    throw new Error("invalid question");
                }
                const i = requested.indexOf(meme.shortId, cursor);
                if (i < 0)
                    throw new Error("invalid set order");
                cursor = i + 1;
            }
            return loaded.length === requested.length ? "challenge" : "practice";
        }
        const show = (next) => {
            screen.replaceWith(next);
            screen = next;
        };
        async function start(nextMode, set) {
            mode = nextMode;
            phase = "loading";
            questions = [];
            replay = "general";
            index = 0;
            selected = null;
            answers = [];
            show(template("loading"));
            track("quiz_start", set ? { mode: nextMode, challenge: 1 } : { mode: nextMode });
            const query = new URLSearchParams({ mode: nextMode });
            if (set)
                query.set("set", set.join(","));
            try {
                const response = await fetch(`/api/quiz?${query.toString()}`, { cache: "no-store" });
                if (!response.ok)
                    throw new Error(String(response.status));
                const body = await response.json();
                if (!Array.isArray(body.questions) || body.questions.length === 0)
                    throw new Error("empty");
                if (set)
                    replay = replayKind(body.questions, set);
                questions = body.questions;
                phase = "playing";
                renderQuestion();
                if (replay === "challenge")
                    recordStage(2);
            }
            catch {
                phase = "error";
                const error = template("error");
                if (!challenge)
                    error.querySelector('[data-quiz-action="skip"]').remove();
                show(error);
            }
        }
        const retry = () => (challenge ? start(challenge.mode, challenge.shortIds) : start(mode));
        function startScreen() {
            phase = "start";
            show(template("start"));
        }
        function renderQuestion() {
            const question = questions[index];
            const total = questions.length;
            const answered = selected !== null;
            const section = phase === "playing" && screen.dataset.quizQuestion === String(index) ? screen : template("question");
            section.dataset.quizQuestion = String(index);
            slot(section, "practice").hidden = replay !== "practice";
            section.setAttribute("aria-label", `문항 ${index + 1} / ${total}`);
            const bar = slot(section, "bar").parentElement;
            bar.setAttribute("aria-valuemax", String(total));
            bar.setAttribute("aria-valuenow", String(index + 1));
            slot(section, "bar").style.width = `${((index + (answered ? 1 : 0)) / total) * 100}%`;
            slot(section, "count").textContent = `${index + 1}/${total}`;
            slot(section, "question").textContent = question.question;
            const options = slot(section, "options");
            if (!options.children.length) {
                question.options.forEach((option, i) => {
                    const item = template("option");
                    const button = item.querySelector("button");
                    button.querySelector("span[aria-hidden]").textContent = String(i + 1);
                    button.querySelector("span.min-w-0").textContent = option;
                    button.addEventListener("click", () => select(i));
                    options.append(item);
                });
            }
            [...options.querySelectorAll("button")].forEach((button, i) => {
                const isAnswer = i === question.answerIndex;
                const isPicked = i === selected;
                let state = "border-border bg-surface hover:border-accent focus-visible:outline-accent";
                if (answered) {
                    if (isAnswer)
                        state = "border-safety-green bg-safety-green-bg text-safety-green";
                    else if (isPicked)
                        state = "border-safety-red bg-safety-red-bg text-safety-red";
                    else
                        state = "border-border bg-surface text-muted opacity-70";
                }
                button.className = `flex w-full min-h-11 items-center gap-3 rounded-2xl border px-4 py-3 text-left text-sm leading-relaxed transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-base ${state} ${answered ? "" : "hover-glow-flame active:scale-[0.99]"}`;
                button.disabled = answered;
                button.querySelector("svg")?.remove();
                if (answered && isAnswer)
                    button.append(template("check"));
                else if (answered && isPicked)
                    button.append(template("cross"));
            });
            const feedback = slot(section, "feedback");
            if (answered) {
                const correct = selected === question.answerIndex;
                const span = document.createElement("span");
                span.className = correct ? "text-safety-green" : "text-safety-red";
                span.textContent = correct ? "정답! 밈력이 느껴져요." : `아쉬워요 — 정답은 ${question.answerIndex + 1}번.`;
                feedback.replaceChildren(span);
                if (!feedback.nextElementSibling) {
                    const actions = template("answered");
                    slot(actions, "meme").href = memePath(question.meme);
                    const next = actions.querySelector('[data-quiz-action="next"]');
                    next.textContent = index + 1 >= total ? "결과 보기" : "다음";
                    next.addEventListener("click", goNext);
                    feedback.after(actions);
                }
            }
            if (section !== screen)
                show(section);
        }
        function select(optionIndex) {
            if (phase !== "playing" || selected !== null)
                return;
            selected = optionIndex;
            answers = [...answers, optionIndex];
            renderQuestion();
        }
        function goNext() {
            if (phase !== "playing" || selected === null)
                return;
            if (index + 1 >= questions.length) {
                const score = answers.reduce((sum, picked, i) => sum + (picked === questions[i].answerIndex ? 1 : 0), 0);
                track("quiz_complete", { score, mode, item_count: questions.length, state: replay });
                if (replay === "challenge")
                    recordStage(3);
                phase = "result";
                renderResult();
                return;
            }
            index += 1;
            selected = null;
            renderQuestion();
        }
        const versus = (mine, theirs) => {
            if (mine > theirs)
                return "친구를 이겼어요! 결과 링크로 자랑해 보세요.";
            if (mine === theirs)
                return "무승부! 다시 붙어 볼까요?";
            return "아쉽게 졌어요. 한 번 더 도전해 보세요.";
        };
        function renderResult() {
            const section = template("result");
            const total = questions.length;
            const score = answers.reduce((sum, picked, i) => sum + (picked === questions[i].answerIndex ? 1 : 0), 0);
            const grade = gradeForScore(score, total);
            const era = eraDecadeLabel(questions.filter((q, i) => answers[i] === q.answerIndex && q.meme.originYear !== null).map((q) => q.meme.originYear));
            const practice = replay === "practice";
            const token = practice ? null : quizShareTokenFor(mode, questions, answers);
            const site = main.dataset.siteUrl || SITE_URL;
            const shareUrl = token ? `${site}${quizResultPath(token)}` : `${site}/quiz`;
            slot(section, "score").textContent = String(score);
            slot(section, "total").textContent = `/${total}`;
            slot(section, "grade").textContent = grade.label;
            slot(section, "comment").textContent = grade.comment;
            if (era)
                slot(section, "era").textContent = `당신의 밈 감성은 ${era}`;
            else
                slot(section, "era").remove();
            if (replay === "challenge")
                slot(section, "versus").textContent = `친구 ${challenge.score}/${challenge.total} vs 나 ${score}/${total} — ${versus(score, challenge.score)}`;
            else
                slot(section, "versus").remove();
            slot(section, "practice").hidden = !practice;
            slot(section, "retry").textContent = challenge ? "같은 문제 다시 풀기" : "다시 풀기";
            const notice = slot(section, "notice");
            const wrong = questions.map((q, i) => ({ q, picked: answers[i] })).filter(({ q, picked }) => picked !== q.answerIndex);
            if (wrong.length) {
                const list = slot(section, "wrong-list");
                for (const { q } of wrong) {
                    const item = template("wrong");
                    item.querySelector("a").href = memePath(q.meme);
                    slot(item, "title").textContent = q.meme.title;
                    slot(item, "answer").textContent = q.options[q.answerIndex];
                    list.append(item);
                }
            }
            else {
                slot(section, "wrong").remove();
            }
            const setNotice = (text) => {
                notice.textContent = text;
                notice.hidden = !text;
            };
            let operation = false;
            const imageButton = section.querySelector('[data-quiz-action="image"]');
            imageButton.addEventListener("click", async () => {
                if (operation)
                    return;
                operation = true;
                imageButton.disabled = true;
                slot(section, "image-label").textContent = "성적표 생성 중...";
                setNotice("");
                try {
                    const result = await downloadOrShareQuizCard({ score, total, grade, era, mode, questions, answers, shareUrl, practice });
                    if (result.downloaded)
                        setNotice("성적표 이미지가 다운로드되었습니다!");
                }
                catch {
                    setNotice("이미지 저장 중 오류가 발생했습니다.");
                }
                finally {
                    operation = false;
                    imageButton.disabled = false;
                    slot(section, "image-label").textContent = "성적표 이미지 저장 (인스타/카톡)";
                }
            });
            const share = section.querySelector('[data-quiz-action="share"]');
            const copy = slot(section, "copy");
            const manual = slot(section, "manual");
            if (!token) {
                share.remove();
            }
            else {
                share.addEventListener("click", async () => {
                    if (operation)
                        return;
                    setNotice("");
                    copy.hidden = true;
                    manual.hidden = true;
                    track("quiz_share", { score, mode });
                    if (typeof navigator.share !== "function") {
                        copy.hidden = false;
                        copy.focus();
                        return;
                    }
                    operation = true;
                    share.disabled = true;
                    try {
                        await navigator.share({ title: "밈력고사 결과", text: `나의 밈력 ${score}/${total}점 (${grade.label})`, url: shareUrl });
                    }
                    catch (error) {
                        if (error?.name !== "AbortError") {
                            setNotice("공유하지 못했어요. 링크를 복사해 보세요.");
                            copy.hidden = false;
                        }
                    }
                    finally {
                        operation = false;
                        share.disabled = false;
                        if (!copy.hidden)
                            copy.focus();
                    }
                });
                copy.addEventListener("click", async () => {
                    if (operation)
                        return;
                    operation = true;
                    copy.disabled = true;
                    try {
                        await navigator.clipboard.writeText(shareUrl);
                        setNotice("링크를 복사했어요.");
                        manual.hidden = true;
                    }
                    catch {
                        const field = manual.querySelector("input");
                        field.value = shareUrl;
                        manual.hidden = false;
                        setNotice("자동으로 복사하지 못했어요. 주소를 직접 선택해 복사해 주세요.");
                        field.focus();
                        field.select();
                    }
                    finally {
                        operation = false;
                        copy.disabled = false;
                    }
                });
            }
            section.querySelector('[data-quiz-action="retry"]').addEventListener("click", () => void retry());
            const change = section.querySelector('[data-quiz-action="change"]');
            if (practice)
                change.textContent = "새 문제로 풀기";
            change.addEventListener("click", () => {
                challenge = null;
                startScreen();
            });
            show(section);
        }
        main.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const modeButton = target?.closest("[data-quiz-mode]");
            if (modeButton && screen.contains(modeButton)) {
                void start(modeButton.dataset.quizMode);
                return;
            }
            const action = target?.closest("[data-quiz-action]")?.dataset.quizAction;
            if (phase === "start" && action === "challenge" && challenge)
                void start(challenge.mode, challenge.shortIds);
            else if (phase === "error" && action === "retry")
                void retry();
            else if (action === "skip" && (phase === "start" || phase === "error" || (phase === "playing" && replay === "practice"))) {
                challenge = null;
                startScreen();
            }
        });
        addEventListener("keydown", (event) => {
            if (phase !== "playing" || event.metaKey || event.ctrlKey || event.altKey)
                return;
            const target = event.target;
            if (target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
                return;
            if (["1", "2", "3", "4"].includes(event.key)) {
                event.preventDefault();
                select(Number(event.key) - 1);
            }
            else if (event.key === "Enter" && selected !== null) {
                event.preventDefault();
                goNext();
            }
        });
    }
}
})();
