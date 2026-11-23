#!/usr/bin/env node
// POST /api/memes/semantic-search on Next and on Axum, on the R1 seed
// (tests/fixtures/r1_reviewer.sql and r1_seed.sql). Both servers run as
// production does: MEME_SEMANTIC_SEARCH_ENABLED=true and no
// MEME_EMBEDDING_URL, so every answer is the keyword search with reason
// "model_unavailable". See README.md in this directory.
//
//   TEST_DB_CONTAINER=<container> node server/parity/semantic-search.mjs <next> <axum>
import { compareOnce, nextBase, psql, run } from "./harness.mjs";

const SITE = new URL(nextBase).origin;
// Each run its own addresses: both servers remember a minute of requests.
const block = Math.floor(Math.random() * 250);
let address = 0;
const fresh = () => `10.${block}.${Math.floor((address += 1) / 250)}.${address % 250}`;
const ask = (body, headers = {}) => ({
  method: "POST",
  path: "/api/memes/semantic-search",
  headers: { origin: SITE, "content-type": "application/json", "x-forwarded-for": fresh(), ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});
const mask = (text) => text.replace(/^header retry-after: \d+$/m, "header retry-after: <1-60>");

async function answers() {
  const cases = [
    // Catalogue rows, curated cards, both, thin rows left out.
    ["a catalogue title", { query: "댄스 밈" }, 200],
    ["a curated meme", { query: "중꺾마" }, 200],
    ["curated and catalogue together", { query: "꺾이지" }, 200],
    ["a thin meme only", { query: "얇은 밈" }, 200],
    ["special characters", { query: "[대괄호] \\백슬래시" }, 200],
    ["nothing found", { query: "없는검색어입니다" }, 200],
    ["limit 1", { query: "밈 챌린지", limit: 1 }, 200],
    ["limit 20", { query: "밈 챌린지", limit: 20 }, 200],
    ["limit 2.0", { query: "댄스 밈", limit: 2.0 }, 200],
    ["spaces around the query", { query: "  댄스 밈  " }, 200],
    ["an extra key", { query: "댄스 밈", x: 1 }, 200],
    ["a query of one character", { query: " 밈 " }, 400],
    ["a query of 121 characters", { query: "가".repeat(121) }, 400],
    ["a query that is a number", { query: 12 }, 400],
    ["limit 0", { query: "댄스 밈", limit: 0 }, 400],
    ["limit 21", { query: "댄스 밈", limit: 21 }, 400],
    ["limit 1.5", { query: "댄스 밈", limit: 1.5 }, 400],
    ["limit as text", { query: "댄스 밈", limit: "2" }, 400],
    ["limit null", { query: "댄스 밈", limit: null }, 400],
    ["malformed JSON", "{", 400],
    ["an array", "[]", 400],
    ["a body over 2 KiB", { query: "댄스 밈", pad: "x".repeat(3000) }, 400],
  ];
  for (const [label, body, status] of cases) await compareOnce(`search: ${label}`, ask(body), { mask, status });
  await compareOnce("search: no origin", { ...ask({ query: "댄스 밈" }), headers: { "content-type": "application/json" } }, { status: 403 });
  await compareOnce("search: an origin only Next judges", ask({ query: "댄스 밈" }, { origin: "http://localhost:3000" }), { status: 403 });
  await compareOnce("search: same-origin fetch", { ...ask({ query: "댄스 밈" }), headers: { "sec-fetch-site": "same-origin", "x-forwarded-for": fresh() } }, { status: 200 });
  await compareOnce("search: GET", { method: "GET", path: "/api/memes/semantic-search" }, { status: 405 });
}

async function limits() {
  // Twenty a minute per address, counted before the body is read.
  const [forNext, forAxum] = [fresh(), fresh()];
  for (let index = 1; index <= 20; index += 1) {
    await compareOnce(`search: request ${index} of an address`, ask("{", { "x-forwarded-for": forNext }), { mask, requestForAxum: ask("{", { "x-forwarded-for": forAxum }) });
  }
  await compareOnce("search: the 21st in a minute", ask({ query: "댄스 밈" }, { "x-forwarded-for": forNext }), { mask, status: 429, requestForAxum: ask({ query: "댄스 밈" }, { "x-forwarded-for": forAxum }) });
}

async function failures() {
  // The database refuses the search: 503 on both.
  psql("revoke execute on function public.search_memes(text, int) from anon");
  try {
    await compareOnce("search: search_memes refused", ask({ query: "댄스 밈" }), { status: 503 });
  } finally {
    psql("grant execute on function public.search_memes(text, int) to anon");
  }
}

await run({ answers, limits, failures });
