#!/usr/bin/env node
// POST /api/meme-studio and POST /api/admin/meme-studio on Next and on Axum,
// with Bedrock replaced by local stubs that record every request and answer
// what each case sets. See README.md in this directory.
//
//   TEST_DB_CONTAINER=<container> node server/parity/studio.mjs <next> <axum> [section...]
//
// Both servers run with BEDROCK_MEME_STUDIO_ENABLED=true, made-up AWS keys,
// AWS_REGION=ap-northeast-2 and AWS_ENDPOINT_URL_BEDROCK_RUNTIME set to a stub:
// Next to http://127.0.0.1:3421 (the AWS SDK speaks HTTP/2), Axum to
// http://127.0.0.1:3422 (HTTP/1.1). This script runs both stubs.
import { createHash, createHmac } from "node:crypto";
import http from "node:http";
import http2 from "node:http2";

import { axumBase, compareOnce, describe, expectEqual, fail, nextBase, psql, run as runSections, send } from "./harness.mjs";

const SECRET = process.env.BETTER_AUTH_SECRET ?? "test-only-auth-secret-0123456789abcdef";
const SITE = new URL(nextBase).origin;
const LIMIT = 100_000_000_000n;
const RESERVATION = 43_008_000n;
const mask = (text) => text.replace(/^header retry-after: \d+$/m, "header retry-after: <1-3600>");

// ---- stubs ----
const recorded = [];
let reply = { status: 500, body: { message: "no reply set" } };
function answer(server, request, response) {
  const chunks = [];
  request.on("data", (chunk) => chunks.push(chunk));
  request.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    recorded.push({ server, path: request.headers[":path"] ?? request.url, headers: request.headers, body });
    const text = typeof reply.body === "string" ? reply.body : JSON.stringify(reply.body);
    response.writeHead(reply.status, { "content-type": "application/json" });
    response.end(text);
  });
}
const listen = (server, port) => new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
await listen(http2.createServer((q, s) => answer("next", q, s)), 3421);
await listen(http.createServer((q, s) => answer("axum", q, s)), 3422);

// ---- users ----
function signIn({ operator = false } = {}) {
  const [userId, token] = psql(`
    with u as (insert into public."user" (name, email, "emailVerified") values ('axum parity', 'axum-parity-' || gen_random_uuid() || '@example.com', true) returning id, email),
    a as (insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data) select id, email, now(), jsonb_build_object('nickname', 'ap' || substr(replace(id::text, '-', ''), 1, 12)) from u returning id),
    s as (insert into public.session (token, "expiresAt", "updatedAt", "userId") select replace(gen_random_uuid()::text, '-', ''), now() + interval '7 days', now(), id from a returning token, "userId")
    select "userId" || ' ' || token from s;`).split(" ");
  // protect_profile_columns lets only service_role change a role; as the
  // superuser this skips the trigger for the one statement.
  if (operator) psql(`begin; set local session_replication_role = replica; update public.profiles set role = 'operator' where id = '${userId}'; commit;`);
  const signature = createHmac("sha256", SECRET).update(token).digest("base64");
  return { userId, cookie: `__Secure-better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}` };
}

// ---- POST /api/meme-studio ----
// Each run uses addresses of its own: the servers remember an hour of requests.
const run = Math.floor(Math.random() * 250);
let address = 0;
const fromNewAddress = () => `10.${run}.${Math.floor((address += 1) / 250)}.${address % 250}`;
const studio = (body, headers = {}) => ({
  method: "POST", path: "/api/meme-studio",
  headers: { "content-type": "application/json", "x-forwarded-for": fromNewAddress(), ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

async function publicStudio() {
  const valid = { topic: "  출근길 지하철  ", tone: "sarcastic", format: "caption" };
  const cases = [
    ["malformed JSON", studio("{"), 400],
    ["an array", studio([valid]), 400],
    ["null", studio("null"), 400],
    ["no topic", studio({ tone: "hype", format: "reaction" }), 400],
    ["a topic of one character after trimming", studio({ ...valid, topic: " 밈 " }), 400],
    ["a topic of 121 characters", studio({ ...valid, topic: "가".repeat(121) }), 400],
    ["a topic that is a number", studio({ ...valid, topic: 12 }), 400],
    ["an unknown tone", studio({ ...valid, tone: "angry" }), 400],
    ["an unknown format", studio({ ...valid, format: "gif" }), 400],
    ["a body over 4 KiB", studio({ ...valid, pad: "x".repeat(5000) }), 400],
    ["a caption", studio(valid), 200],
    ["an image macro with an extra key", studio({ ...valid, format: "image-macro", country: "JP" }), 200],
    ["a reaction, emoji and a dash", studio({ topic: "😀 AI—대체", tone: "hype", format: "reaction" }), 200],
    ["120 characters", studio({ topic: "a".repeat(120), tone: "absurd", format: "caption" }), 200],
    ["GET", { method: "GET", path: "/api/meme-studio" }, 405],
  ];
  for (const [label, request, status] of cases) await compareOnce(`studio: ${label}`, request, { mask, status });
  // Ten an hour per client address, counted only for valid requests.
  const [forNext, forAxum] = [fromNewAddress(), fromNewAddress()];
  const send = (ip) => studio(valid, { "x-forwarded-for": ip });
  for (let index = 1; index <= 10; index += 1) {
    await compareOnce(`studio: request ${index} of an address`, send(forNext), { mask, status: 200, requestForAxum: send(forAxum) });
  }
  await compareOnce("studio: the 11th in an hour", send(forNext), { mask, status: 429, requestForAxum: send(forAxum) });
}

// ---- POST /api/admin/meme-studio ----
const concept = (n, overrides = {}) => ({
  country_code: "JP", headline: `  제목 ${n} `, caption: `캡션 ${n} — 반전`, local_caption: `キャプション${n}`,
  cultural_anchor: `앵커 ${n}`, visual_brief: `그림 ${n}`, why_it_works: `이유 ${n}`, usage_context: `상황 ${n}`, ...overrides,
});
const converse = (input, extraBlocks = []) => ({
  output: { message: { role: "assistant", content: [...extraBlocks, { toolUse: { toolUseId: "tooluse_1", name: "submit_meme_concepts", input } }] } },
  stopReason: "tool_use", usage: { inputTokens: 1200, outputTokens: 800, totalTokens: 2000 }, metrics: { latencyMs: 10 },
});
const three = () => [concept(1), concept(2), concept(3)];
const admin = (who, body, headers = { origin: SITE }) => ({
  method: "POST", path: "/api/admin/meme-studio",
  headers: { "content-type": "application/json", ...(who ? { cookie: who.cookie } : {}), ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const japan = { topic: "  회의   예약  ", tone: "absurd", format: "caption", country: "JP" };

function budget() {
  return psql("select coalesce((select reserved_nano_usd || ' ' || request_count from public.bedrock_meme_studio_lifetime_budget where model_profile = 'global.anthropic.claude-sonnet-5'), 'none')");
}
function setBudget(reserved) {
  if (reserved === 0n) return psql("DELETE FROM public.bedrock_meme_studio_lifetime_budget WHERE model_profile = 'global.anthropic.claude-sonnet-5'");
  psql(`insert into public.bedrock_meme_studio_lifetime_budget (model_profile, reserved_nano_usd, request_count) values ('global.anthropic.claude-sonnet-5', ${reserved}, 1)
    on conflict (model_profile) do update set reserved_nano_usd = excluded.reserved_nano_usd, request_count = 1`);
}

async function adminStudio() {
  setBudget(0n);
  const user = signIn();
  const operator = signIn({ operator: true });
  for (const [label, request, status] of [
    ["no origin", admin(operator, japan, {}), 403],
    ["an origin only Next judges", admin(operator, japan, { origin: "http://localhost:3000" }), 403],
    ["signed out", admin(null, japan), 401],
    ["not an operator", admin(user, japan), 403],
    ["malformed JSON", admin(operator, "{"), 400],
    ["no country", admin(operator, { ...japan, country: undefined }), 400],
    ["an unknown country", admin(operator, { ...japan, country: "XX" }), 400],
    ["a topic of one character", admin(operator, { ...japan, topic: " 밈 " }), 400],
    ["GET", { method: "GET", path: "/api/admin/meme-studio" }, 405],
  ]) await compareOnce(`admin: ${label}`, request, { status });
  await bedrockRequests(operator);
  await bedrockAnswers(operator);
  await budgets(operator);
}

/** The request each server sent for the same input, compared as data. */
async function bedrockRequests(operator) {
  reply = { status: 200, body: converse({ concepts: three() }) };
  const before = recorded.length;
  await compareOnce("admin: a valid answer", admin(operator, japan), { status: 200 });
  const [next, rust] = ["next", "axum"].map((server) => recorded.slice(before).find((entry) => entry.server === server));
  if (!next || !rust) return fail("admin: Bedrock requests", `next ${Boolean(next)}, axum ${Boolean(rust)}`);
  const shape = (entry) => {
    const auth = entry.headers.authorization ?? "";
    return [
      `POST ${entry.path}`,
      `content-type ${entry.headers["content-type"]}`,
      `algorithm ${auth.split(" ")[0]}; scope <date>/${auth.match(/Credential=[^/]+\/\d{8}\/([^,]+)/)?.[1]}`,
      `x-amz-content-sha256 is the body's: ${entry.headers["x-amz-content-sha256"] === createHash("sha256").update(entry.body).digest("hex")}`,
    ].join("\n");
  };
  expectEqual("admin: Bedrock request line, type, scope and body hash", shape(rust), shape(next));
  expectEqual("admin: Bedrock request body as data", JSON.stringify(sorted(JSON.parse(rust.body))), JSON.stringify(sorted(JSON.parse(next.body))));
  const signed = (entry) => (entry.headers.authorization ?? "").match(/SignedHeaders=([^,]+)/)?.[1];
  console.log(`      signed headers: next ${signed(next)}\n                      axum ${signed(rust)}`);
}

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
  return value;
}

async function bedrockAnswers(operator) {
  const korea = { topic: "출근길", tone: "hype", format: "reaction", country: "KR" };
  const kr = (n) => concept(n, { country_code: "KR", local_caption: `캡션 ${n} — 반전` });
  const cases = [
    ["Bedrock answers 500", { status: 500, body: { message: "boom" } }, japan, 503],
    ["Bedrock answers 429", { status: 429, body: { message: "slow down" } }, japan, 503],
    ["an answer that is not JSON", { status: 200, body: "not json" }, japan, 503],
    ["two concepts", { status: 200, body: converse({ concepts: three().slice(0, 2) }) }, japan, 503],
    ["duplicate captions after normalizing", { status: 200, body: converse({ concepts: [concept(1), concept(2, { caption: " 캡션 1 — 반전 " }), concept(3)] }) }, japan, 503],
    ["an extra key in a concept", { status: 200, body: converse({ concepts: [concept(1, { extra: "x" }), concept(2), concept(3)] }) }, japan, 503],
    ["an extra key beside concepts", { status: 200, body: converse({ concepts: three(), note: 1 }) }, japan, 503],
    ["a headline without Hangul", { status: 200, body: converse({ concepts: [concept(1, { headline: "Title" }), concept(2), concept(3)] }) }, japan, 503],
    ["caption equals local caption outside Korea", { status: 200, body: converse({ concepts: [concept(1, { local_caption: "캡션 1 — 반전" }), concept(2), concept(3)] }) }, japan, 503],
    ["caption equals local caption in Korea", { status: 200, body: converse({ concepts: [kr(1), kr(2), kr(3)] }) }, korea, 200],
    ["another country's concepts", { status: 200, body: converse({ concepts: three() }) }, korea, 503],
    ["a text block before the tool", { status: 200, body: converse({ concepts: three() }, [{ text: "Here you go" }]) }, japan, 200],
    ["two tool blocks", { status: 200, body: converse({ concepts: three() }, [{ toolUse: { toolUseId: "t0", name: "submit_meme_concepts", input: { concepts: three() } } }]) }, japan, 503],
    ["another tool's name", { status: 200, body: { output: { message: { content: [{ toolUse: { toolUseId: "t", name: "other", input: { concepts: three() } } }] } } } }, japan, 503],
    ["a caption over 220 characters", { status: 200, body: converse({ concepts: [concept(1, { caption: "가".repeat(221) }), concept(2), concept(3)] }) }, japan, 503],
  ];
  for (const [label, answerToSend, input, status] of cases) {
    reply = answerToSend;
    const before = recorded.length;
    await compareOnce(`admin: ${label}`, admin(operator, input), { status });
    const calls = recorded.slice(before).map((entry) => entry.server).sort().join(" ");
    expectEqual(`admin: ${label}: one call each`, calls, "axum next");
  }
}

/** The lifetime budget: each server, from the same row, answers alike and leaves the same row. */
async function budgets(operator) {
  reply = { status: 200, body: converse({ concepts: three() }) };
  for (const [label, start, status] of [
    ["the last reservation that fits", LIMIT - RESERVATION, 200],
    ["one nano-dollar too many", LIMIT - RESERVATION + 1n, 503],
    ["an exhausted budget", LIMIT, 503],
  ]) {
    const seen = [];
    for (const base of [nextBase, axumBase]) {
      setBudget(start);
      const before = recorded.length;
      const response = await send(base, admin(operator, japan));
      seen.push(`${describe(response)}\nrow ${budget()}\nBedrock calls ${recorded.length - before}`);
    }
    expectEqual(`admin: ${label}`, seen[1], seen[0], `status ${status}, row ${seen[0].split("row ")[1].split("\n")[0]}`);
  }
  setBudget(0n);
}

await runSections({ publicStudio, adminStudio });
