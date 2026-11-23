#!/usr/bin/env node
// POST /api/memes/chat on Next and on Axum, on the R1 seed plus chat-seed.sql.
// See README.md in this directory, "Meme chat".
//
//   production  both servers as production runs them: generation on
//               (MEME_CHAT_GENERATION_ENABLED=true) and no OPENROUTER_API_KEY,
//               so every answer is the retrieved summary.
//   generation  both with a made-up key: Next with its fetch to openrouter.ai
//               caught by openrouter-intercept.mjs, Axum with
//               AXUM_TEST_OPENROUTER_ORIGIN, both sent to the stub this script
//               runs on 127.0.0.1:3530. The stub
//               records every request; the two servers' requests are compared
//               byte for byte.
//
//   TEST_DB_CONTAINER=<c> node server/parity/chat.mjs <next> <axum> production
//   TEST_DB_CONTAINER=<c> node server/parity/chat.mjs <next-key> <axum-key> generation
//
// Both servers allow 20 chat requests a minute in all, so the script waits
// between cases; a run takes several minutes.
import http from "node:http";
import { axumBase, compareOnce, expectEqual, fail, nextBase, pass, psql, run, send } from "./harness.mjs";

const SITE = "http://127.0.0.1:3511";
const block = Math.floor(Math.random() * 250);
let address = 0;
const fresh = () => `10.${block}.${Math.floor((address += 1) / 250)}.${address % 250}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ask = (body, headers = {}) => ({
  method: "POST",
  path: "/api/memes/chat",
  headers: { origin: SITE, "content-type": "application/json", "x-forwarded-for": fresh(), ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const STREAM = { accept: "application/x-ndjson" };
const mask = (text) => text.replace(/^header retry-after: \d+$/m, "header retry-after: <n>");

// Twenty a minute per server: at most 18 cases in any minute.
const started = [];
async function pace(count = 1) {
  for (let index = 0; index < count; index += 1) {
    while (started.length >= 18 && Date.now() - started[0] < 61_000) await sleep(61_000 - (Date.now() - started[0]));
    while (started.length && Date.now() - started[0] >= 61_000) started.shift();
    started.push(Date.now());
  }
}
async function check(label, request, options = {}) {
  await pace();
  return compareOnce(`chat: ${label}`, request, { mask, ...options });
}

// ---- the OpenRouter stub -------------------------------------------------
const stubPort = 3530;
const scripts = new Map(); // question -> how to answer
const seen = new Map(); // question -> [{ head, body, closedAt }]
let stub;
function startStub() {
  stub = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", async () => {
      const body = Buffer.concat(chunks).toString("utf8");
      let question = "";
      let ids = [];
      try {
        const parsed = JSON.parse(body);
        question = JSON.parse(parsed.messages[1].content).question;
        ids = parsed.response_format.json_schema.schema.properties.citationIds.items.enum;
      } catch { /* recorded as is */ }
      const headers = Object.fromEntries(Object.entries(request.headers)
        .filter(([name]) => !["host", "connection", "accept-encoding"].includes(name)));
      const record = { head: `${request.method} ${request.url} ${JSON.stringify(headers, Object.keys(headers).sort())}`, body, closedAt: null };
      request.socket.on("close", () => { record.closedAt = Date.now(); });
      if (!seen.has(question)) seen.set(question, []);
      seen.get(question).push(record);
      const script = scripts.get(question) ?? { status: 500, raw: "{}" };
      if (script.hang) return;
      if (script.delayMs) await sleep(script.delayMs);
      const text = script.raw ?? JSON.stringify(script.envelope ?? {
        choices: [{ finish_reason: script.finish ?? "stop", message: { content: script.content ?? JSON.stringify({
          answer: script.answer ?? "답변입니다",
          citationIds: script.cite ? script.cite(ids) : ids.slice(0, 1),
        }) } }],
      });
      response.writeHead(script.status ?? 200, { "content-type": "application/json", ...(script.headers ?? {}) }).end(text);
    });
  });
  return new Promise((resolve) => stub.listen(stubPort, "127.0.0.1", resolve));
}

const used = new Set(); // question|locale pairs asked so far: their answers may be cached

/** One question to both servers, with the stub answering `script`; compares the provider requests too. */
async function generated(label, question, script, { locale, expectRequests = 1, stream = false } = {}) {
  used.add(`${question.trim()}|${locale ?? "ko"}`);
  scripts.set(question, script);
  seen.delete(question);
  const body = locale ? { question, locale } : { question };
  const { next } = await check(label, ask(body, stream ? STREAM : {}), { status: 200 });
  const records = seen.get(question) ?? [];
  if (records.length !== 2 * expectRequests) {
    return fail(`chat: ${label}: provider requests`, `expected ${expectRequests} from each server, saw ${records.length} in all`);
  }
  for (let index = 0; index < expectRequests; index += 1) {
    const [fromNext, fromAxum] = [records[index], records[expectRequests + index]];
    expectEqual(`chat: ${label}: provider request ${index + 1} head`, fromAxum?.head, fromNext?.head);
    expectEqual(`chat: ${label}: provider request ${index + 1} body`, fromAxum?.body, fromNext?.body, `${Buffer.byteLength(fromNext?.body ?? "")} bytes`);
  }
  return next;
}

// ---- production: generation on, no key -----------------------------------
async function production() {
  for (const locale of [undefined, "ko", "en", "ja", "zh", "zh-tw"]) {
    await check(`챗봇, locale ${locale ?? "absent"}`, ask(locale ? { question: "챗봇", locale } : { question: "챗봇" }), { status: 200 });
  }
  const cases = [
    ["an exact title keeps that meme only", { question: "  챗봇 기본 밈 ", locale: "en" }, 200],
    ["a title key with punctuation", { question: "챗봇·기본!밈", locale: "en" }, 200],
    ["a ja translation with a blank origin", { question: "챗봇 기본 밈", locale: "ja" }, 200],
    ["a translation the lower bound refuses", { question: "챗봇 태그 밈", locale: "en" }, 200],
    ["text cut inside an emoji", { question: "챗봇 긴 제목" }, 200],
    ["a limited meme and its twin", { question: "제한 밈 요약" }, 200],
    ["a pending meme is never found", { question: "챗봇 대기 밈" }, 200],
    ["nothing found", { question: "없는질문입니다" }, 200],
    ["a curated meme only (no UUID)", { question: "중꺾마" }, 200],
    ["R1 memes", { question: "밈 요약", locale: "en" }, 200],
    ["four memes with quoted text", { question: "챗봇 따옴표" }, 200],
    ["a localized slug cut inside an emoji", { question: "챗봇 깨진 슬러그", locale: "en" }, 503],
    ["the broken slug in Korean", { question: "챗봇 깨진 슬러그" }, 200],
    ["121 characters", { question: "가".repeat(121) }, 400],
    ["one character after trimming", { question: " 가 " }, 400],
    ["a number", { question: 12 }, 400],
    ["an unknown locale", { question: "챗봇", locale: "fr" }, 400],
    ["locale null", { question: "챗봇", locale: null }, 400],
    ["an extra key", { question: "챗봇", x: 1 }, 400],
    ["malformed JSON", "{", 400],
    ["an empty body", "", 400],
    ["an array", "[]", 400],
    ["a byte-order mark", "﻿{\"question\":\"챗봇\"}", 200],
    ["a body over 2 KiB", { question: "챗봇", pad: "x".repeat(3000) }, 413],
  ];
  for (const [label, body, status] of cases) await check(label, ask(body), { status });
  await check("a chunked body over 2 KiB", { ...ask({ question: "챗봇", pad: "x".repeat(3000) }), chunked: true }, { status: 413 });
  for (const [label, accept] of [
    ["stream", "application/x-ndjson"],
    ["stream among others", "text/html, Application/X-NDJSON;q=0.5"],
    ["q=0 is no stream", "application/x-ndjson; q=0.0"],
    ["another type", "application/json"],
  ]) await check(`accept: ${label}`, ask({ question: "챗봇", locale: "en" }, { accept }), { status: 200 });
  await check("stream: nothing found", ask({ question: "없는질문입니다" }, STREAM), { status: 200 });
  await check("stream: the broken slug", ask({ question: "챗봇 깨진 슬러그", locale: "en" }, STREAM), { status: 200 });
  await check("stream: a bad question is not streamed", ask({ question: "가" }, STREAM), { status: 400 });
  await check("no origin", { ...ask({ question: "챗봇" }), headers: { "content-type": "application/json", "x-forwarded-for": fresh() } }, { status: 403 });
  await check("an origin only Next judges", ask({ question: "챗봇" }, { origin: "http://localhost:3000" }), { status: 403 });
  await check("same-origin fetch", { ...ask({ question: "챗봇" }), headers: { "sec-fetch-site": "same-origin", "x-forwarded-for": fresh() } }, { status: 200 });
  await check("GET", { method: "GET", path: "/api/memes/chat" }, { status: 405 });
}

async function failures() {
  psql("revoke execute on function public.search_memes(text, int) from anon");
  try {
    await check("search_memes refused", ask({ question: "챗봇" }), { status: 503 });
    await check("search_memes refused, streamed", ask({ question: "챗봇" }, STREAM), { status: 200 });
  } finally {
    psql("grant execute on function public.search_memes(text, int) to anon");
  }
}

async function limits() {
  // Five in ten minutes per address, counted before the body is read.
  const [forNext, forAxum] = [fresh(), fresh()];
  for (let index = 1; index <= 6; index += 1) {
    await check(`request ${index} of an address`, ask("{", { "x-forwarded-for": forNext }), {
      requestForAxum: ask("{", { "x-forwarded-for": forAxum }),
      status: index <= 5 ? 400 : 429,
    });
  }
  // Twenty a minute on each server: wait for a quiet minute, then 21.
  await sleep(Math.max(0, 61_000 - (Date.now() - (started.at(-1) ?? 0))));
  started.length = 0;
  for (let index = 1; index <= 21; index += 1) {
    await compareOnce(`chat: request ${index} of the minute`, ask("{"), { mask, status: index <= 20 ? 400 : 429 });
  }
  started.push(Date.now());
}

async function slowBody() {
  // The 25-second deadline covers reading the body: 504.
  const slow = (base) => new Promise((resolve, reject) => {
    const { hostname, port } = new URL(base);
    const request = http.request({ hostname, port, path: "/api/memes/chat", method: "POST", headers: {
      host: new URL(nextBase).host, origin: SITE, "content-type": "application/json", "x-forwarded-for": fresh(), "content-length": "40",
    } }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve(`${response.statusCode} ${response.headers["content-type"]} ${Buffer.concat(chunks)}`));
    });
    request.on("error", reject);
    request.write("{\"question\":");
  });
  await pace();
  const [fromNext, fromAxum] = await Promise.all([slow(nextBase), slow(axumBase)]);
  expectEqual("chat: a body still arriving after 25 s", fromAxum, fromNext);
}

// ---- generation: a made-up key, the stub as OpenRouter --------------------
async function generation() {
  await startStub();
  try {
    await answers();
    await sharing();
    await streaming();
  } finally {
    stub.close();
  }
}

async function answers() {
  const cite2 = (ids) => ids.slice(0, 2);
  await generated("an answer citing the first record", "챗봇 기본 밈", {});
  await generated("the same question again comes from the cache", "챗봇 기본 밈", {}, { expectRequests: 0 });
  await generated("in English", "챗봇 기본 밈", {}, { locale: "en" });
  await generated("in Japanese", "챗봇 기본 밈", { answer: "答え" }, { locale: "ja" });
  await generated("in Chinese", "챗봇 기본", { answer: "答案" }, { locale: "zh" });
  await generated("in Taiwanese Chinese", "챗봇 기본", { answer: "答案" }, { locale: "zh-tw" });
  await generated("the notice already in the answer", "봇 기본 밈", { answer: "답. 미상·추정으로 기록된 연도와 자료보다 세밀한 발생·유행 날짜는 확정된 정보가 아니에요." });
  await generated("two records cited", "제한 밈 요약", { cite: cite2 });
  await generated("records without sources and an exact year", "챗봇 제한 밈", {});
  await generated("spaces around the answer", "챗봇 동점 밈", { answer: "   공백 답   " });
  await generated("text cut inside an emoji", "챗봇 긴 제목", { cite: cite2 });
  await generated("a context over 6,000 units", "챗봇 따옴표", { cite: (ids) => ids.slice(0, 4) });
  await generated("the broken slug in Korean", "챗봇 깨진 슬러그", {});
  const refusals = [
    ["finish_reason length", { finish: "length" }],
    ["HTTP 500", { status: 500 }],
    ["HTTP 429", { status: 429 }],
    ["a redirect", { status: 302, headers: { location: "https://openrouter.ai/x" } }],
    ["a body that is not JSON", { raw: "not json" }],
    ["no choices", { envelope: { choices: [] } }],
    ["a second choice without content", { envelope: { choices: [
      { finish_reason: "stop", message: { content: "{}" } }, { finish_reason: "stop" }] } }],
    ["content that is not JSON", { content: "plain text" }],
    ["an extra key in the content", { content: "{\"answer\":\"a\",\"citationIds\":[],\"x\":1}" }],
    ["no citation", { cite: () => [] }],
    ["a citation of no record", { cite: () => ["a1000000-0000-4000-8000-000000000099"] }],
    ["the same citation twice", { cite: (ids) => [ids[0], ids[0]] }],
    ["five citations", { cite: (ids) => [...ids, ...ids, ...ids, ...ids, ...ids].slice(0, 5) }],
    ["an answer with a URL", { answer: "자세한 건 https://example.com" }],
    ["an answer with a host name", { answer: "catchmeme.com 참고" }],
    ["an answer with markup", { answer: "<b>굵게</b>" }],
    ["an answer of 1,801 characters", { answer: "가".repeat(1801) }],
    ["a blank answer", { answer: "   " }],
  ];
  // A question and locale of its own each, so no answer comes from the cache.
  const pool = ["기본", "챗봇 기", "봇 기", "기본 밈", "챗봇 기본 밈?"].flatMap((question) =>
    ["ko", "en", "ja", "zh", "zh-tw"].map((locale) => [question, locale]))
    .filter(([question, locale]) => !used.has(`${question}|${locale}`));
  for (const [index, [label, script]] of refusals.entries()) {
    const [question, locale] = pool[index];
    await generated(`refused: ${label}`, question, script, { locale });
  }
  await generated("refused: the provider takes 13 s", "챗봇 동점", { delayMs: 13_000 });
  await generated("nothing found: no request", "없는질문입니다", {}, { expectRequests: 0 });
}

/** Two identical questions at once to one server: one provider request. */
async function sharing() {
  const question = "챗봇 제한";
  scripts.set(question, { delayMs: 1500 });
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    seen.delete(question);
    await pace(2);
    const [a, b] = await Promise.all([send(base, ask({ question })), send(base, ask({ question }))]);
    expectEqual(`chat: two at once on ${name}: one provider request`, seen.get(question)?.length, 1);
    expectEqual(`chat: two at once on ${name}: the same answer`, b.body.toString(), a.body.toString(), `${a.status}`);
  }
  // The records are read again after the wait: a change meanwhile gives the summary.
  const changed = "챗봇 동점 밈 ";
  scripts.set(changed.trim(), { delayMs: 1500 });
  const answersSeen = [];
  for (const base of [nextBase, axumBase]) {
    await pace();
    const pending = send(base, ask({ question: changed, locale: "zh" }));
    await sleep(500);
    psql("update public.memes set summary = '바뀐 요약' where id = 'e5c00000-0000-4000-8000-000000000007'");
    const answer = await pending;
    psql("update public.memes set summary = '제한 밈 요약' where id = 'e5c00000-0000-4000-8000-000000000007'");
    answersSeen.push(`${answer.status} ${answer.body}`);
  }
  expectEqual("chat: a record changed during generation gives the summary", answersSeen[1], answersSeen[0]);
}

/** Streams: progress before the provider answers, and a client leaving cancels its request. */
async function streaming() {
  await generated("streamed answer", "챗봇 기본 밈", { answer: "스트림 답" }, { locale: "zh-tw", stream: true });
  await generated("streamed refusal", "챗봇 기본", { status: 503 }, { locale: "ja", stream: true });
  const question = "봇 기본";
  scripts.set(question, { hang: true });
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    seen.delete(question);
    await pace();
    const { hostname, port } = new URL(base);
    const lines = await new Promise((resolve, reject) => {
      const request = http.request({ hostname, port, path: "/api/memes/chat", method: "POST", headers: {
        host: new URL(nextBase).host, origin: SITE, "content-type": "application/json", "x-forwarded-for": fresh(), ...STREAM,
      } }, (response) => {
        let text = "";
        response.on("data", (chunk) => {
          text += chunk;
          if (text.includes("\"answering\"")) {
            request.destroy();
            resolve(text);
          }
        });
        response.on("end", () => resolve(text));
      });
      request.on("error", () => {});
      setTimeout(() => reject(new Error("no answering line in 10 s")), 10_000).unref();
      request.end(JSON.stringify({ question }));
    });
    const left = Date.now();
    expectEqual(`chat: ${name}: progress before the provider answers`, lines.trim().split("\n").length, 4, lines.replace(/\n/g, " "));
    await sleep(2000);
    const record = seen.get(question)?.[0];
    if (record?.closedAt && record.closedAt - left < 2000) pass(`chat: ${name}: leaving cancels the provider request`, `${record.closedAt - left} ms`);
    else fail(`chat: ${name}: leaving cancels the provider request`, record ? "the provider request is still open" : "no provider request");
  }
}

await run({ production, failures, limits, slowBody, generation });
