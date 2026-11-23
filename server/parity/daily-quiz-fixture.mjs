#!/usr/bin/env node
// Writes the expected values for server/tests/daily_quiz_parity.rs by running
// the real functions of lib/quiz.ts and lib/daily-quiz.ts under Node.
//
//   node server/parity/daily-quiz-fixture.mjs > server/tests/fixtures/daily_quiz.json
//
// Node 22.18 or later (it imports the .ts files directly). The output is
// deterministic: rerun it after either TypeScript file changes and the Rust
// test shows what moved.
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { buildQuestions, maskTitleWords } from "../../lib/quiz.ts";
import { dailyPivot, hashCode, kstDayKey, seededRng } from "../../lib/daily-quiz.ts";

// titleNameTokens is not exported. This loads the same source text with one
// export line appended, so the function that runs is still the real one.
const quizSource = readFileSync(new URL("../../lib/quiz.ts", import.meta.url), "utf8");
const { titleNameTokens } = await import(
  `data:text/javascript,${encodeURIComponent(`${stripTypeScriptTypes(quizSource)}\nexport { titleNameTokens };`)}`
);

const POOL_SIZE = 120; // app/api/daily-quiz/route.ts
const SHORT_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
const CATEGORIES = ["phrase", "dance", "song", "image", "comment", "challenge"];
const SAFETY_LEVELS = ["green", "yellow", "gray", "red"];

// This script's own generator for building rows. Not one of the functions
// under test.
let state = 20261123;
function next(bound) {
  state = (Math.imul(state, 1103515245) + 12345) >>> 0;
  return Math.floor((state / 4294967296) * bound);
}

// Titles and summaries that reach the branches of the masking and token
// code: brackets (ASCII, full width, unclosed, nested), quotes, separators,
// generic words, mixed-case Latin, astral characters, odd whitespace,
// characters JSON must escape, and case pairs the `i` flag treats specially.
const TITLES = [
  "중꺾마",
  "원앤온리 (One and Only) 챌린지",
  "그 잡채",
  "\"그 잡채\"!",
  "알잘딱깔센",
  "스불재（스스로 불러온 재앙）",
  "킹받네 · 킹받드라슈",
  "Hype Boy 챌린지",
  "HYPE BOY 댄스",
  "어쩔티비/저쩔티비",
  "갓생",
  "가나 (다라",
  "가나) 다라 (마바)",
  "((겹)괄호) 밈",
  "밈",
  "댄스 챌린지",
  "I'm fine, thank you — and you?",
  "‘MZ’세대 “플렉스”",
  "Straße 밈",
  "ISTANBUL ıi İ",
  "Kelvin K 밈",
  "😀 이모지 밈 😀😀",
  "탭\t과  　공백 밈",
  "﻿BOM 밈\u0085",
  "역슬래시\\와 \"따옴표\"",
  "줄\n바꿈 밈",
  "제로폭​공백",
  "점심 메뉴 추천!?",
  "A·B·C",
  "ab",
  "a b",
  "나",
  "무야호 (MBC 무한도전)",
  "오히려 좋아",
  "너 T야?",
  "꾸안꾸",
  "억텐",
  "분좋카",
  "완내스",
  "점메추 / 저메추",
];

const SUMMARY_TEMPLATES = [
  (t) => `${t}는 요즘 온라인에서 자주 쓰이는 표현으로, 상황을 재치 있게 설명할 때 써요.`,
  (t) => `'${t}'라는 말은 예능 자막에서 시작되어 커뮤니티 전체로 퍼진 유행어예요.`,
  (t) => `짧은 영상에서 반복되던 동작이 인기를 얻어 ${t} ${t} 하고 부르게 됐어요.`,
  (t) => `“${t}”는 친구끼리 가볍게 놀릴 때 쓰는 말이에요.   과하게 쓰면 실례가 될 수 있어요.`,
  () => "중요한 것은 꺾이지 않는 마음이라는 뜻으로, 포기하지 않는 태도를 응원할 때 써요.",
  () => "알아서 잘 딱 깔끔하고 센스 있게 처리해 달라는 부탁을 줄여 부르는 말이에요.",
  () => "스스로 불러온 재앙이라는 뜻으로, 자기가 만든 곤란한 상황을 자조할 때 써요.",
  (t) => `${t.toUpperCase()} 노래에 맞춰 같은 안무를 따라 추는 영상이 줄지어 올라왔어요.`,
  (t) => `${t.toLowerCase()}라는 곡의 후렴 안무를 따라 하는 댄스 챌린지예요.`,
  () => "짧아요",
  () => "열아홉 글자로 된 요약은 탈락이에요 ㅇ",
  () => "스무 글자로 꼭 맞춘 요약은 통과예요 ㅇㅇ",
  (t) => `\t${t}\n은(는) 탭과　줄바꿈이 섞인 요약으로, 공백 정리가 필요한 문장이에요.\r\n`,
  (t) => `😀😀 ${t} 😀 이모지가 들어가면 UTF-16 길이와 글자 수가 달라지는 요약이에요 😀`,
  (t) => `역슬래시\\ 와 "큰따옴표" 그리고 제어문자\u0001가 들어간 ${t} 설명이에요.   줄 구분자도요.`,
  (t) => `${t}\u0085는 NEL 문자 뒤에 오는 설명으로, 자바스크립트는 이것을 공백으로 보지 않아요.`,
  (t) => `﻿${t}는 BOM으로 시작하는 요약이에요. 자바스크립트 trim은 이것을 지워요.`,
  (t) => `${t}${t}${t} 처럼 제목이 연달아 세 번 나오면 가림 기호가 하나로 합쳐져요.`,
  (t) => `'${t}' "${t}" ‘${t}’ 따옴표로 감싼 제목이 여러 번 나오는 요약이에요.`,
  () => "직장인 사이에서 점심 메뉴를 고르기 어려울 때 서로 추천을 부탁하며 쓰는 줄임말이에요.",
  () => "꾸민 듯 안 꾸민 듯 자연스러운 스타일을 가리키는 패션 유행어예요.",
  () => "억지로 끌어올린 텐션이라는 뜻으로, 어색하게 밝은 척하는 모습을 놀릴 때 써요.",
  () => "분위기 좋은 카페를 줄여 부르는 말로, 사진 찍기 좋은 곳을 찾을 때 써요.",
  () => "오히려 잘됐다고 상황을 긍정적으로 뒤집어 받아들일 때 쓰는 표현이에요.",
];

function shortId(used) {
  for (;;) {
    let id = "";
    for (let i = 0; i < 8; i += 1) id += SHORT_ID_ALPHABET[next(SHORT_ID_ALPHABET.length)];
    if (!used.has(id)) {
      used.add(id);
      return id;
    }
  }
}

function makeRows(count) {
  const used = new Set();
  const rows = [];
  for (let i = 0; i < count; i += 1) {
    const title = TITLES[next(TITLES.length)];
    // About a tenth repeat an earlier summary exactly: duplicate summaries
    // are deduplicated when wrong options are chosen.
    const summary =
      i > 10 && next(10) === 0
        ? rows[next(rows.length)].summary
        : SUMMARY_TEMPLATES[next(SUMMARY_TEMPLATES.length)](title) + (next(3) === 0 ? ` (${i})` : "");
    rows.push({
      short_id: shortId(used),
      // An empty slug or title makes a row ineligible.
      slug: next(40) === 0 ? "" : `slug-${i}-${title.slice(0, 3)}`,
      title: next(40) === 0 ? "" : `${title}${next(4) === 0 ? ` ${i}` : ""}`,
      summary,
      category: CATEGORIES[next(i % 7 === 0 ? CATEGORIES.length : 2)],
      origin_year: next(4) === 0 ? null : 1990 + next(37),
      safety_level: SAFETY_LEVELS[next(SAFETY_LEVELS.length)],
    });
  }
  return rows;
}

function dayKeys(start, count) {
  const [y, m, d] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, i) =>
    new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10),
  );
}

/** The two queries of the route, on rows held in memory. */
function routePool(rows, pivot) {
  const sorted = [...rows].sort((a, b) => (a.short_id < b.short_id ? -1 : 1));
  const first = sorted.filter((row) => row.short_id >= pivot).slice(0, POOL_SIZE);
  if (first.length >= POOL_SIZE) return first;
  const wrapped = sorted.filter((row) => row.short_id < pivot).slice(0, POOL_SIZE - first.length);
  return [...first, ...wrapped];
}

/** What the route does after the queries. `null` is its 502. */
function routeBody(day, pool) {
  const [question] = buildQuestions(pool, 1, seededRng(hashCode(`daily-quiz:${day}`)));
  return question ? JSON.stringify({ date: day, question }) : null;
}

const rows = makeRows(300);
const indexOf = new Map(rows.map((row, index) => [row, index]));

// Pools of several sizes: none, too few for four options, small, below the
// 120 limit (wraps around the pivot), and above it.
const POOLS = [0, 3, 4, 12, 40, 119, 120, 121, 300];
const days = [...dayKeys("2026-11-20", 21), "2024-02-29", "2027-01-01", "1999-12-31", "2038-01-19"];
const cases = [];
for (const size of POOLS) {
  for (const day of days) {
    const pivot = dailyPivot(day);
    const pool = routePool(rows.slice(0, size), pivot);
    cases.push({ day, pivot, size, pool: pool.map((row) => indexOf.get(row)), body: routeBody(day, pool) });
  }
}

const HASH_INPUTS = ["", "a", "daily-quiz:2026-11-23", "밈캐치", "😀 astral", "z".repeat(64), ...TITLES];
const SEEDS = [0, 1, 0x7fffffff, 0x80000000, 0xffffffff, hashCode("daily-quiz:2026-11-23")];
// Instants (ms) around midnight in Korea, a leap day, year ends, and far dates.
const INSTANTS = [
  0, -1, 1795445999999, 1795446000000, 1709132399999, 1709132400000, 1709218800000,
  Date.UTC(2026, 11, 31, 14, 59, 59), Date.UTC(2026, 11, 31, 15, 0, 0), Date.UTC(2100, 1, 28, 15, 0, 0),
  Date.UTC(1999, 11, 31, 23, 59, 59), Date.UTC(2038, 0, 19, 3, 14, 8),
];

process.stdout.write(
  `${JSON.stringify({
    rows,
    cases,
    hashes: HASH_INPUTS.map((input) => ({ input, hash: hashCode(input) })),
    // rng() is n / 2^32 for a 32-bit n; n is stored so no float is compared.
    rng: SEEDS.map((seed) => {
      const rng = seededRng(seed);
      return { seed, draws: Array.from({ length: 32 }, () => rng() * 4294967296) };
    }),
    pivots: dayKeys("2026-01-01", 800).map((day) => ({ day, pivot: dailyPivot(day) })),
    kst: INSTANTS.map((ms) => ({ ms, day: kstDayKey(new Date(ms)) })),
    tokens: TITLES.map((title) => ({ title, tokens: titleNameTokens(title) })),
    // Each title's tokens applied to its own summary and to another row's.
    masks: rows.flatMap((row, index) => {
      const tokens = titleNameTokens(row.title);
      return [index, (index + 1) % rows.length].map((text) => ({
        title: index,
        text,
        masked: maskTitleWords(rows[text].summary, tokens),
      }));
    }),
  })}\n`,
);
