#!/usr/bin/env node
// POST /api/admin/mpe-candidates on Next and on Axum. See README.md in this
// directory, "MPE candidates". Each case reseeds (mpe-candidates-seed.mjs),
// asks Next, records the rows the route leaves, reseeds, asks Axum, and
// compares the answers and the rows.
//
//   production  both servers without OPENROUTER_API_KEY (as production):
//               every status the route gives there.
//   generation  both with a made-up key, OpenRouter replaced by the stub this
//               script runs on 127.0.0.1:3530, Next
//               through openrouter-intercept.mjs, Axum through
//               AXUM_TEST_OPENROUTER_ORIGIN: the draft's requests, retries
//               and budget rows, request by request.
//   matching    the matches Axum logs when the store fails, against what the
//               real generateCandidateMatches computes on the same rows
//               (mpe-candidates-flow.mjs), which needs DATABASE_URL.
//
//   TEST_DB_CONTAINER=<c> node server/parity/mpe-candidates.mjs --state=<state.json> \
//     [--axum-log=<Axum's log file>] <next> <axum> [production|generation|matching]
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, "../..");
// `--name=value` options first; harness.mjs reads the rest of the arguments.
const options = Object.fromEntries(process.argv.filter((arg) => arg.startsWith("--")).map((arg) => arg.slice(2).split(/=(.*)/s, 2)));
process.argv = process.argv.filter((arg) => !arg.startsWith("--"));
const { describe, expectEqual, fail, nextBase, axumBase, pass, psql, run, send } = await import("./harness.mjs");
const STATE = options.state;
const { operator, user } = JSON.parse(readFileSync(STATE, "utf8"));
const SITE = "http://127.0.0.1:3511";
const PATH = "/api/admin/mpe-candidates";
const id = {
  ingestion: (n) => `c5c00000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  candidate: (n) => `f5c10000-0000-4000-8000-${String(n).padStart(12, "0")}`,
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function seed() {
  const sql = execFileSync(process.execPath, [path.join(HERE, "mpe-candidates-seed.mjs"), STATE], { encoding: "utf8" });
  psql(`begin;\n${sql}\ncommit;`);
}

/** What a request leaves behind, apart from generated ids and times. */
function rows() {
  return psql(`
    select 'fingerprint', ingestion_id, fingerprint_type, hash_value, embedding::text, frame_ms, processor_version
      from media_fingerprints where ingestion_id::text like 'c5c0%' order by 2, 3, 4;
    select 'candidate', ingestion_id, target_meme_id, title, meme_type, review_status, overall_confidence, draft_json::text,
           created_by, model_version, prompt_version
      from meme_candidates where ingestion_id::text like 'c5c0%' order by 2, 4;
    select 'match', count(*) from candidate_matches where candidate_id in (select id from meme_candidates where ingestion_id::text like 'c5c0%');
    select 'evidence', count(*) from claim_evidence where candidate_id in (select id from meme_candidates where ingestion_id::text like 'c5c0%');
    select 'budget', provider, model, request_count from openrouter_daily_request_budget;`);
}

const ask = (body, { cookie = operator.cookie, origin = SITE, headers = {} } = {}) => ({
  method: "POST",
  path: PATH,
  headers: { ...(origin ? { origin } : {}), ...(cookie ? { cookie } : {}), "content-type": "application/json", ...headers },
  body: typeof body === "string" ? body : JSON.stringify(body),
});

/** Reseed, Next, rows, reseed, Axum, rows; `before` runs after each reseed. */
async function both(label, request, { status, before, stub } = {}) {
  const outcome = [];
  for (const base of [nextBase, axumBase]) {
    seed();
    before?.();
    stub?.reset();
    const answer = await send(base, request);
    outcome.push({ answer: describe(answer), rows: rows(), provider: stub?.take() });
  }
  const [next, axum] = outcome;
  if (next.answer !== axum.answer) return fail(`mpe: ${label}`, `next:\n${next.answer}\naxum:\n${axum.answer}`);
  if (status !== undefined && !next.answer.includes(`status: ${status}`)) return fail(`mpe: ${label}`, `both: ${next.answer.split("\n").find((line) => line.startsWith("status"))}, expected ${status}`);
  expectEqual(`mpe: ${label}: rows`, axum.rows, next.rows);
  if (stub) expectEqual(`mpe: ${label}: provider requests`, axum.provider, next.provider, `${next.provider.split("\n").filter(Boolean).length} lines`);
  pass(`mpe: ${label}`, next.answer.split("\n").find((line) => line.startsWith("body")).slice(0, 120));
}

async function production() {
  const C = id.candidate;
  const I = id.ingestion;
  const create = (n, extra = {}) => ({ action: "create", ingestionId: I(n), title: "  새 후보  ", memeType: "OTHER", ...extra });
  await both("no origin", ask({ candidateId: C(1) }, { origin: null }), { status: 403 });
  await both("an origin only Next judges", ask({ candidateId: C(1) }, { origin: "http://localhost:3000" }), { status: 403 });
  await both("signed out", ask({ candidateId: C(1) }, { cookie: null }), { status: 401 });
  await both("not an operator", ask({ candidateId: C(1) }, { cookie: user.cookie }), { status: 403 });
  for (const [label, body] of [
    ["malformed JSON", "{"], ["an empty body", ""], ["an array", "[]"], ["no candidate", {}],
    ["a candidate id that is not a UUID", { candidateId: "f5c1" }], ["an unknown action", { candidateId: C(1), action: "rank" }], ["action null", { candidateId: C(1), action: null }],
    ["create without a title", create(6, { title: "   " })], ["create with a title of 201", create(6, { title: "가".repeat(201) })],
    ["create with an unknown type", create(6, { memeType: "other" })], ["create with a candidate id only", { action: "create", candidateId: C(1) }],
  ]) await both(`invalid: ${label}`, ask(body), { status: 400 });
  await both("same-origin fetch", { ...ask({ candidateId: C(9) }, { origin: null }), headers: { cookie: operator.cookie, "sec-fetch-site": "same-origin", "content-type": "application/json" } }, { status: 500 });
  await both("matches: hashes, earlier evidence, embedding replaced", ask({ candidateId: C(1) }), { status: 500 });
  await both("matches: the default action", ask({ candidateId: C(2), action: "matches" }), { status: 500 });
  await both("matches: memes the search finds", ask({ candidateId: C(9) }), { status: 500 });
  await both("matches: no such candidate", ask({ candidateId: C(99) }), { status: 404 });
  await both("matches: the nil UUID is a UUID to zod", ask({ candidateId: "00000000-0000-0000-0000-000000000000" }), { status: 404 });
  await both("matches: search_memes refused", ask({ candidateId: C(9) }), {
    status: 500, before: () => psql("revoke execute on function public.search_memes(text, int) from authenticated"),
  });
  psql("grant execute on function public.search_memes(text, int) to authenticated");
  await both("draft: no provider", ask({ candidateId: C(1), action: "evidence_draft" }), { status: 503 });
  await both("draft: no provider, no candidate", ask({ candidateId: C(99), action: "evidence_draft" }), { status: 503 });
  await both("create: a failed job", ask(create(3)), { status: 409 });
  await both("create: a provider not configured", ask(create(4)), { status: 409 });
  await both("create: a missing job", ask(create(5)), { status: 409 });
  await both("create: an old scene processor", ask(create(8)), { status: 409 });
  await both("create: not_configured in an error code", ask(create(9)), { status: 409 });
  await both("create: no such ingestion", ask(create(99)), { status: 404 });
  await both("create: an existing candidate is kept", ask(create(7)), { status: 500 });
  await both("create: a new candidate is removed again", ask(create(6)), { status: 500 });
  await both("create: a video with audio STT off", ask(create(2)), { status: 500 });
  await both("create: the delete refused too", ask(create(6)), {
    status: 500, before: () => psql("revoke delete on public.meme_candidates from service_role"),
  });
  psql("grant delete on public.meme_candidates to service_role");
  seed();
  for (const method of ["PUT", "DELETE"]) {
    const [n, a] = [await send(nextBase, { method, path: PATH }), await send(axumBase, { method, path: PATH })];
    expectEqual(`mpe: ${method} goes to Next`, describe(a), describe(n));
  }
}

// ---- the OpenRouter stub --------------------------------------------------
function stubServer() {
  let queue = [];
  let lines = [];
  const server = http.createServer((request, response) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => {
      const headers = Object.fromEntries(Object.entries(request.headers).filter(([name]) => !["host", "connection", "accept-encoding"].includes(name)));
      lines.push(`${request.method} ${request.url} ${JSON.stringify(headers, Object.keys(headers).sort())} ${Buffer.concat(chunks).toString("utf8")}`);
      const reply = queue.shift() ?? { status: 500, body: "{}" };
      if (reply.drop) return request.socket.destroy();
      response.writeHead(reply.status, { "content-type": "application/json", ...(reply.headers ?? {}) }).end(reply.body);
    });
  });
  return {
    server,
    script: (replies) => { queue = [...replies]; },
    reset() { lines = []; queue = [...this.replies]; },
    take: () => lines.join("\n"),
    replies: [],
  };
}

async function generation() {
  const stub = stubServer();
  await new Promise((resolve) => stub.server.listen(3530, "127.0.0.1", resolve));
  const content = (text) => ({ status: 200, body: JSON.stringify({ choices: [{ message: { content: text } }] }) });
  const segment = (n) => `e5c10000-0000-4000-8000-${String(n).padStart(12, "0")}`;
  const source = "a5c00000-0000-4000-8000-000000000002";
  const claims = (list) => JSON.stringify({ claims: list });
  const good = claims([
    { field: "MEANING", text: " 뜻 ", evidenceIds: [segment(1), id.ingestion(1)], confidence: 0.75, needsReview: false, support: "direct" },
    { field: "TITLE", text: "제목", evidenceIds: [source], confidence: 0.5, needsReview: true },
    { field: "ORIGIN", text: "모름", evidenceIds: [], confidence: 0, needsReview: true, support: "abstained", abstentionReason: " 없음 " },
  ]);
  const zero = { "retry-after": "0" };
  const cases = [
    ["claims", [content(good)], 500],
    ["claims in prose", [content(`앞 ${good} 뒤`)], 500],
    ["two objects, then claims", [content("{\"a\":1} {\"b\":2}"), content(good)], 500],
    ["no object twice", [content("none"), content("still none")], 500],
    ["503 then claims", [{ status: 503, body: "{}", headers: zero }, content(good)], 500],
    ["429 shared pool then claims", [{ status: 429, body: JSON.stringify({ error: { message: "shared_pool busy" } }), headers: zero }, content(good)], 500],
    ["429 with Retry-After 1", [{ status: 429, body: JSON.stringify({ error: { metadata: { raw: "Temporarily rate-limited upstream" } } }), headers: { "retry-after": "1" } }, content(good)], 500],
    ["a plain 429", [{ status: 429, body: JSON.stringify({ error: { message: "slow down" } }) }], 500],
    ["500", [{ status: 500, body: "{}" }], 500],
    ["three 502s", [{ status: 502, body: "", headers: zero }, { status: 502, body: "", headers: zero }, { status: 502, body: "", headers: zero }], 500],
    ["dropped connections", [{ drop: true }, { drop: true }, { drop: true }], 500],
    ["a body that is not JSON", [{ status: 200, body: "nope" }], 500],
    ["an empty answer", [{ status: 200, body: "" }], 500],
    ["empty content", [content("  ")], 500],
    ["invalid claims", [content(claims([{ field: "x" }]))], 422],
    ["no supported claim", [content(claims([{ field: "ORIGIN", text: "t", evidenceIds: [], confidence: 0, needsReview: true, support: "unsupported" }]))], 422],
    ["metadata only", [content(claims([{ field: "TITLE", text: "t", evidenceIds: [id.ingestion(1)], confidence: 0.2, needsReview: true }]))], 422],
    ["an STT segment", [content(claims([{ field: "TITLE", text: "t", evidenceIds: [segment(3)], confidence: 0.2, needsReview: true }]))], 422],
  ];
  try {
    for (const [label, replies, status] of cases) {
      stub.replies = replies;
      await both(`draft: ${label}`, ask({ candidateId: id.candidate(1), action: "evidence_draft" }), { status, stub });
    }
    stub.replies = [content(good)];
    const budget = (count) => () => psql(`insert into openrouter_daily_request_budget values ('openrouter', 'stealth/ox-alpha', timezone('UTC', statement_timestamp())::date, ${count}, now())`);
    await both("draft: the last request of the day", ask({ candidateId: id.candidate(1), action: "evidence_draft" }), { status: 500, stub, before: budget(44) });
    await both("draft: the budget used up", ask({ candidateId: id.candidate(1), action: "evidence_draft" }), { status: 429, stub, before: budget(45) });
    stub.replies = [{ status: 503, body: "{}", headers: zero }, content(good)];
    await both("draft: the budget runs out on the retry", ask({ candidateId: id.candidate(1), action: "evidence_draft" }), { status: 429, stub, before: budget(44) });
    stub.replies = [content(good)];
    await both("draft: the reservation refused", ask({ candidateId: id.candidate(1), action: "evidence_draft" }), {
      status: 503, stub, before: () => psql("revoke execute on function public.reserve_openrouter_daily_request(text, text) from authenticated"),
    });
    psql("grant execute on function public.reserve_openrouter_daily_request(text, text) to authenticated");
    await both("draft: claims citing another ingestion's evidence", ask({ candidateId: id.candidate(2), action: "evidence_draft" }), { status: 422, stub });
    await both("draft: no such candidate", ask({ candidateId: id.candidate(99), action: "evidence_draft" }), { status: 404, stub });
    await both("create: matching fails before the draft", ask({ action: "create", ingestionId: id.ingestion(6), title: "새 후보", memeType: "OTHER" }), { status: 500, stub });
  } finally {
    stub.server.close();
  }
}

async function matching() {
  const log = options["axum-log"];
  for (const n of [1, 2, 9]) {
    seed();
    const candidate = id.candidate(n);
    const ts = execFileSync(process.execPath, ["--experimental-transform-types", "--import", "./scripts/register-ts-paths.mjs", path.join(HERE, "mpe-candidates-flow.mjs"), operator.userId, candidate], {
      cwd: ROOT, encoding: "utf8", env: { ...process.env, NODE_NO_WARNINGS: "1" }, stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    seed();
    await send(axumBase, ask({ candidateId: candidate }));
    await sleep(200);
    const line = readFileSync(log, "utf8").split("\n").filter((entry) => entry.includes(`replace_mpe_candidate_matches failed candidate="${candidate}"`)).at(-1) ?? "";
    const rust = line.replace(/^.* matches=/, "").replace(/ function public\..*$/, "");
    expectEqual(`mpe: candidate ${n}: the matches Axum computes are the TypeScript's`, rust, ts, `${JSON.parse(ts).length} matches`);
  }
}

await run({ production, generation, matching });
