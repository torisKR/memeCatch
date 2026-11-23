#!/usr/bin/env node
// Rewrites tests/fixtures/meme_chat.json from the real lib/meme-chat.server.ts,
// for src/routes/chat to be compared with:
//
//   - answers: for rows as `row_to_json` writes them, a question, a locale and
//     what the provider answers, the request answerMemeQuestion sends (null
//     when it sends none) and the result it gives;
//   - title_keys: memeTitleKey (scripts/meme-title-key.mjs) of tricky text;
//   - unsafe: the answer check of `generate`, its regex taken from the source.
//
// The search and the database are stubbed (chat-fixture-stubs.mjs) and fetch
// is caught in this process; nothing leaves it. Run it after a change to the
// chat, with the Node of the Next image:
//
//   node --experimental-transform-types --import ./scripts/register-ts-paths.mjs \
//     --import ./server/parity/chat-fixture-hooks.mjs \
//     server/parity/chat-fixture.mjs > server/tests/fixtures/meme_chat.json
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (!process.version.startsWith("v22.")) {
  console.error(`run this with Node 22, the Next image's (this is ${process.version})`);
  process.exit(2);
}
const ROOT = fileURLToPath(new URL("../..", import.meta.url));
Object.assign(process.env, { OPENROUTER_API_KEY: "fixture-key", MEME_CHAT_GENERATION_ENABLED: "true" });
delete process.env.OPENROUTER_BASE_URL;
delete process.env.MEME_CHAT_PROVIDER;
let reply = null;
let sent = null;
globalThis.fetch = async (url, init) => {
  if (String(url) !== "https://openrouter.ai/api/v1/chat/completions") throw new TypeError(`unexpected fetch ${url}`);
  sent = init.body;
  return new Response(reply.body, { status: reply.status, headers: { "content-type": "application/json" } });
};
const { answerMemeQuestion } = await import(path.join(ROOT, "lib/meme-chat.server.ts"));
const { memeTitleKey } = await import(path.join(ROOT, "scripts/meme-title-key.mjs"));

const id = (n) => `e5c00000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;
const at = "2026-04-01T01:02:03.456789+00:00";
const source = (url, title, extra = {}) => ({ source_url: url, title, platform: "web", hidden_from_public: null, ...extra });
const translation = (locale, extra = {}) => ({
  locale, status: "reviewed", localized_slug: `slug ${locale}?#`, title: `Title ${locale}`, summary: `Summary ${locale}`,
  description: `Meaning ${locale}`, origin: `Origin ${locale}`, usage_note: null, caution: null,
  source_updated_at: "2026-04-01T01:02:03.456+00:00", updated_at: "2026-05-01T00:00:00+00:00", ...extra,
});
const row = (n, extra = {}) => ({
  id: id(n), short_id: `r5chat${String(n).padStart(2, "0")}`, slug: `r5c-${n} 밈?`, title: `챗봇 밈 ${n}`,
  summary: `요약 ${n}`, description: "가".repeat(400), origin: "나".repeat(60), usage_note: null, caution: null,
  origin_year: null, year_precision: "unknown", moderation_status: "approved", updated_at: at,
  meme_sources: [], meme_translations: [], ...extra,
});
const ok = (content, finish = "stop") => ({ status: 200, body: JSON.stringify({ choices: [{ finish_reason: finish, message: { content } }] }) });
const answer = (text, ids) => ok(JSON.stringify({ answer: text, citationIds: ids }));

const quotes = (n) => row(n, {
  title: `챗봇 따옴표 ${n}`, summary: "\"".repeat(240), description: "\"".repeat(400), origin: "\"".repeat(260),
  usage_note: "\"".repeat(180), caution: "\\".repeat(180), origin_year: 2000 + n, year_precision: "decade",
});
const rich = row(1, {
  summary: "기본\t요약 \"따옴표\" \u0001", origin_year: 2021, year_precision: "approximate", usage_note: "사용법\n줄바꿈",
  meme_sources: [
    source("https://news.example.org/a#one", "  첫 출처  "), source("https://news.example.org/a#two", "같은 문서"),
    source("https://untitled.example.org/x", null), source("https://hidden.example.org/x", "숨김", { hidden_from_public: true }),
    source("http://localhost/x", "로컬"), source("https://Namu.Wiki./w/x", "위키\n제목", { hidden_from_public: false }),
    source("https://third.example.org/", "셋째"),
  ],
  meme_translations: [translation("en"), translation("ja", { origin: " " })],
});
const cases = [
  ["챗봇 밈 1", "ko", [rich], answer("답변입니다", [id(1)])],
  ["챗봇 밈 1", "en", [rich], answer("Answer", [id(1)])],
  ["챗봇 밈 1", "ja", [rich], answer("答え", [id(1)])],
  ["두 개", "zh", [row(2), row(3, { moderation_status: "limited", year_precision: "exact", origin_year: 2019 })], answer("答案", [id(3), id(2)])],
  ["두 개", "zh-tw", [row(2), row(3)], answer("  spaced  ", [id(2)])],
  ["순서", "ko", [row(5), row(4)], answer("순서 답", [id(4)])],
  ["챗봇·밈!4", "ko", [row(4), row(5)], answer("정확한 제목", [id(4)])],
  ["긴 제목", "ko", [row(6, {
    title: `챗봇 긴 제목 밈 ${"가".repeat(149)}😀😀😀`, summary: `${"사".repeat(239)}😀 끝`,
    meme_sources: [source("https://long.example.org/", `${"하".repeat(99)}😀 끝`)],
  })], answer("긴 답", [id(6)])],
  ["따옴표", "ko", [quotes(11), quotes(12), quotes(13), quotes(14)], answer("따옴표 답", [id(11), id(12), id(13), id(14)])],
  ["공지", "ko", [rich], answer("답. 미상·추정으로 기록된 연도와 자료보다 세밀한 발생·유행 날짜는 확정된 정보가 아니에요.", [id(1)])],
  ["멈춤", "ko", [row(7)], ok(JSON.stringify({ answer: "a", citationIds: [id(7)] }), "length")],
  ["실패", "en", [row(7)], { status: 500, body: "{}" }],
  ["비 JSON", "ko", [row(7)], { status: 200, body: "not json" }],
  ["내용 비 JSON", "ko", [row(7)], ok("plain")],
  ["추가 키", "ko", [row(7)], ok(JSON.stringify({ answer: "a", citationIds: [id(7)], x: 1 }))],
  ["없는 인용", "ko", [row(7)], answer("a", [id(99)])],
  ["중복 인용", "ko", [row(7)], answer("a", [id(7), id(7)])],
  ["주소", "ko", [row(7)], answer("example.com 참고", [id(7)])],
  ["거부된 행", "ko", [row(8, { short_id: "x" }), row(9, { moderation_status: "pending" }), row(10)], answer("행", [id(10)])],
  ["없음", "ko", [], answer("none", [])],
];

const answers = [];
for (const [question, locale, rows, provider] of cases) {
  globalThis.chatFixture = { ids: rows.map((item) => item.id), rows: rows.map((item) => JSON.stringify(item)) };
  reply = provider;
  sent = null;
  const result = await answerMemeQuestion({ question, locale });
  answers.push({ question, locale, rows: globalThis.chatFixture.rows, status: provider.status, provider: provider.body, request: sent, result: JSON.stringify(result) });
}

const keys = ["  “중꺾마” — 중요한 건_꺾이지 않는 마음!! ", "ＡＢＣ　ｄｅｆ", "😀 + ★", "ΟΔΟΣ ΣΑ", "İstanbul", "ﬁ ß Ǆ", "Ⅻ ①", "a\u00adb\u200bc", "\u3164한글", "x\u0085y"];
const source_text = readFileSync(path.join(ROOT, "lib/meme-chat.server.ts"), "utf8");
const literal = /if \(\/(.+)\/i\.test\(result\.data\.answer\)\)/.exec(source_text);
if (!literal) throw new Error("the answer check moved; update chat-fixture.mjs");
const check = new RegExp(literal[1], "i");
const samples = [
  "see https://example.com", "x+y.z://a", "no:// scheme", "1:// x", "go to WWW.example", "JavaScript:alert(1)",
  "a data: uri", "write mailto:x", "<b>bold</b>", "a < b > c", "a < b", "[click] (here)", "[x](y)", "[] (x)",
  "visit example.com", "visit example.com/path", "visit EXAMPLE.co.kr", "a-b.c", "a.b\nnext", "x_.y.z ", "_a.b c",
  "a.b-", "a..b c", "version 1.2.", "e.g, a word", "...", "이 밈은 2020년에 유행했어요.", "밈.밈 c", "ex.com\u3000끝",
  "ex.com\u0085", "-a.b", "a.-", "1.2", "file.txt!", "a.b\ufeff",
];
process.stdout.write(`${JSON.stringify({
  answers,
  title_keys: keys.map((text) => [text, memeTitleKey(text)]),
  unsafe: samples.map((text) => [text, check.test(text)]),
}, null, 1)}\n`);
