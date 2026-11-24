// R12: POST /v1/embeddings and /api/cron/meme-embeddings, Next against Axum
// on one database (README.md, "Embeddings").
//
//   CRON_SECRET=... MEMECATCH_SIGNING_SECRET=... TEST_DB_CONTAINER=... \
//   REINDEX_VIA=post|get node server/parity/embeddings.mjs <next> <axum> [section...]
//
// Both servers run with the same CRON_SECRET, MEMECATCH_SIGNING_SECRET,
// MEME_EMBEDDING_RUNTIME and MEME_EMBEDDING_REINDEX_ENABLED, and either both
// with the model (Next: .local/embedding-models; Axum: an embedder at
// MEME_EMBEDDER_URL) or both without. REINDEX_VIA=get needs
// MEME_EMBEDDING_REINDEX_ENABLED=true on both; with `post` the GET cases
// expect it off. The reindex sections reset the vectors and the run state,
// run through each server from that same state, and compare the answers and
// every row.
import { createHmac } from "node:crypto";
import { compare, compareOnce, expectEqual, psql, run, send, nextBase, axumBase } from "./harness.mjs";

const cronSecret = process.env.CRON_SECRET ?? "";
const signingSecret = process.env.MEMECATCH_SIGNING_SECRET ?? "";
const via = process.env.REINDEX_VIA ?? "post";
const PROFILE = "multilingual-e5-small-v1";
const V1 = "/v1/embeddings";
const CRON = "/api/cron/meme-embeddings";
const json = { "content-type": "application/json" };

/** createEmbeddingAuthHeaders of lib/meme-embedding-auth.server.ts. */
function signed(input, now = Date.now(), secret = cronSecret) {
  const signature = createHmac("sha256", secret)
    .update(JSON.stringify([now, PROFILE, input]), "utf8").digest("hex");
  return { "x-memecatch-embedding-time": String(now), "x-memecatch-embedding-signature": signature };
}

function v1(input, { headers = signed(input), body, ip = "198.51.100.7" } = {}) {
  return {
    method: "POST", path: V1,
    headers: { ...json, "x-forwarded-for": ip, ...headers },
    body: body ?? JSON.stringify({ model: PROFILE, input }),
  };
}

const bearer = (secret) => ({ authorization: `Bearer ${secret}` });
// The probe reports time and memory: the numbers differ, the shape must not.
const maskProbe = (text) => text.replace(/"(elapsed_ms|rss_bytes|peak_rss_bytes|heap_used_bytes)":\d+/g, '"$1":N');

const v1Cases = async () => {
  await compare("valid signed query", v1("query: 무야호"));
  await compare("valid signed query, cached the second time", v1("query: 무야호"));
  await compare("another query", v1("query: 할머니 고추장 광고"));
  await compare("astral query", v1("query: 🤣 웃긴 밈"));
  await compare("no signature", v1("query: 무야호", { headers: {} }));
  await compare("signature of another input", v1("query: 무야호", { headers: signed("query: 무야호!") }));
  await compare("signature with another secret", v1("query: 무야호", { headers: signed("query: 무야호", Date.now(), "other") }));
  await compare("timestamp 31 s old", v1("query: 무야호", { headers: signed("query: 무야호", Date.now() - 31_000) }));
  await compare("timestamp with a leading zero", v1("query: 무야호", {
    headers: { ...signed("query: 무야호"), "x-memecatch-embedding-time": `0${Date.now()}` } }));
  await compare("uppercase signature", v1("query: 무야호", {
    headers: { ...signed("query: 무야호"), "x-memecatch-embedding-signature": signed("query: 무야호")["x-memecatch-embedding-signature"].toUpperCase() } }));
  for (const [label, body] of [
    ["no body", ""],
    ["not JSON", "{"],
    ["array", "[]"],
    ["wrong model", JSON.stringify({ model: "other", input: "query: 무야호" })],
    ["extra key", JSON.stringify({ model: PROFILE, input: "query: 무야호", user: "x" })],
    ["missing prefix", JSON.stringify({ model: PROFILE, input: "무야호" })],
    ["one-character query", JSON.stringify({ model: PROFILE, input: "query: a" })],
    ["untrimmed query", JSON.stringify({ model: PROFILE, input: "query:  무야호" })],
    ["not NFKC", JSON.stringify({ model: PROFILE, input: "query: ＡＢ" })],
    ["121 characters", JSON.stringify({ model: PROFILE, input: `query: ${"가".repeat(121)}` })],
    ["input array", JSON.stringify({ model: PROFILE, input: ["query: 무야호"] })],
    ["over 2048 bytes", JSON.stringify({ model: PROFILE, input: "query: 무야호", pad: "x".repeat(2100) })],
  ]) {
    await compare(`400: ${label}`, v1("query: 무야호", { body }));
  }
  await compare("over 2048 bytes, chunked", { ...v1("query: 무야호", { body: " ".repeat(2100) }), chunked: true });
  await compare("repeated key, last wins", v1("query: ab", {
    body: `{"model":"x","model":"${PROFILE}","input":"query: ab"}` }));
  await compare("GET is not a route method", { method: "GET", path: V1 });
};

const v1Limit = async () => {
  // 30 per address per minute, counted after the signature check.
  const ip = `203.0.113.${Math.floor(Math.random() * 200) + 20}`;
  const input = "query: 한도 확인";
  for (const base of [nextBase, axumBase]) {
    for (let index = 0; index < 30; index += 1) await send(base, v1(input, { ip }));
  }
  await compareOnce("31st request from one address", v1(input, { ip }), {
    mask: (text) => text.replace(/(header retry-after: )\d+/, "$1N"),
  });
};

const cronCases = async () => {
  const get = (headers = bearer(cronSecret), path = CRON) => ({ method: "GET", path, headers });
  const post = (body, headers = bearer(signingSecret), extra = {}) => ({
    method: "POST", path: CRON, headers: { ...headers, ...extra }, body,
  });
  await compare("GET without a bearer", { method: "GET", path: CRON });
  await compare("GET with the signing secret", get(bearer(signingSecret)));
  await compare("GET with a lowercase scheme", get({ authorization: `bearer ${cronSecret}` }));
  await compare("GET with a query", get(bearer(cronSecret), `${CRON}?run=1`));
  if (via === "post") {
    await compare("GET, reindex disabled", get(), { status: 202 });
    await compare("GET with a bare ?, reindex disabled", get(bearer(cronSecret), `${CRON}?`), { status: 202 });
    await compare("GET with a body, reindex disabled", { ...get(), body: "x" }, { status: 202 });
    await compare("HEAD, reindex disabled", { ...get(), method: "HEAD" });
  }
  await compare("POST with the cron secret", post("", bearer(cronSecret)));
  await compare("POST with a query", { ...post('{"validate_model":true}'), path: `${CRON}?x` });
  for (const [label, body] of [
    ["validate_model false", '{"validate_model":false}'],
    ["validate_model 1", '{"validate_model":1}'],
    ["extra key", '{"validate_model":true,"x":1}'],
    ["array", "[true]"],
    ["not JSON", "{"],
    ["whitespace only", "  "],
    ["129 bytes", `{"validate_model":true}${" ".repeat(106)}`],
  ]) {
    await compare(`POST 400: ${label}`, post(body));
  }
  await compare("POST over 128 bytes, chunked", { ...post(" ".repeat(200)), chunked: true });
  await compare("probe", post('{"validate_model":true}'), { mask: maskProbe });
  await compare("probe, BOM and spaces", post('﻿ {"validate_model" : true} '), { mask: maskProbe });
  await compare("PUT is not a route method", { method: "PUT", path: CRON, headers: bearer(cronSecret) });
};

const RESET = `
delete from private.meme_semantic_embeddings;
update private.meme_embedding_reindex_state set lease_owner = null, lease_until = null,
  last_status = 'idle', last_started_at = null, last_finished_at = null, last_indexed = 0,
  last_stale = 0, last_remaining = 0, consecutive_failures = 0, failed_runs = 0,
  retry_after = null, last_error_code = null;`;

/** Every row a run can leave, with the times reduced to what is fixed. */
function rows() {
  return psql(`
select meme_id, source_hash, model_profile, embedding::text from private.meme_semantic_embeddings order by meme_id;
select last_status, last_indexed, last_stale, last_remaining, consecutive_failures, failed_runs,
  last_error_code, lease_owner is null, lease_until is null, last_started_at is null,
  last_finished_at is null, (retry_after - last_finished_at)::text
  from private.meme_embedding_reindex_state;`);
}

const runRequest = () => (via === "get"
  ? { method: "GET", path: CRON, headers: bearer(cronSecret) }
  : { method: "POST", path: CRON, headers: bearer(signingSecret) });

/** From the same state, `runs` runs through Next, then through Axum. */
async function compareRuns(label, { setup = "", runs = 1 } = {}) {
  const results = {};
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    psql(RESET + setup);
    const answers = [];
    for (let index = 0; index < runs; index += 1) {
      const response = await send(base, runRequest());
      answers.push(`${response.status} ${response.headers["content-type"]} ${response.headers["cache-control"]} ${response.body}`);
    }
    results[name] = { answers: answers.join("\n"), rows: rows() };
  }
  expectEqual(`${label}: answers`, results.axum.answers, results.next.answers, results.next.answers.split("\n").at(-1).slice(0, 110));
  const count = results.next.rows.split("\n").length - 1;
  expectEqual(`${label}: rows`, results.axum.rows, results.next.rows, `${count} vector rows and the run state`);
}

const reindexCases = async () => {
  await compareRuns("one run");
  await compareRuns("two runs", { runs: 2 });
  await compareRuns("lease held by another run", {
    setup: "update private.meme_embedding_reindex_state set lease_owner = gen_random_uuid(), lease_until = now() + interval '60 seconds';",
  });
  await compareRuns("retry_after in the future", {
    setup: "update private.meme_embedding_reindex_state set retry_after = now() + interval '60 seconds';",
  });
  await compareRuns("one meme left to index", {
    setup: `insert into private.meme_semantic_embeddings(meme_id, embedding, source_hash)
      select id, array_fill(0.05103103630798827::real, array[384])::extensions.vector, md5(public.meme_embedding_document(m))
      from public.memes m where moderation_status in ('approved','limited') order by id offset 1;`,
  });
};

const emptyCatalog = async () => {
  const statuses = psql("select string_agg(id::text || ':' || moderation_status, ',') from public.memes where moderation_status in ('approved', 'limited');");
  // Triggers off for this session: the moderation workflow forbids the move.
  const quiet = "set session_replication_role = replica;";
  psql(`${quiet} update public.memes set moderation_status = 'rejected' where moderation_status in ('approved', 'limited');`);
  try {
    await compareRuns("no public meme");
  } finally {
    for (const entry of statuses.split(",").filter(Boolean)) {
      const [id, status] = entry.split(":");
      psql(`${quiet} update public.memes set moderation_status = '${status}' where id = '${id}';`);
    }
  }
};

await run({ v1: v1Cases, "v1-limit": v1Limit, cron: cronCases, reindex: reindexCases, "reindex-empty": emptyCatalog });
