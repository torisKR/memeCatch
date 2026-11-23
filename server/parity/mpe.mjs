#!/usr/bin/env node
// The routes that need a session, on Next and on Axum: GET /api/mpe/jobs/{id},
// POST /api/mpe/renders, GET /api/admin/mpe-candidates and
// GET /api/media/{...path}. They need sessions and
// rows of their own, so they have this script. See README.md in this
// directory.
//
//   node server/parity/mpe.mjs seed <state.json>            # prints SQL: psql it as the superuser
//   node server/parity/mpe.mjs <next-base-url> <axum-base-url> <state.json> [<object-dir>]
//
// <object-dir> is the LOCAL_OBJECT_STORAGE_DIR both servers were started with
// (no R2_* value set). With it the script writes a few objects there and
// compares GET /api/media/{...path}.
//
// state.json holds three sessions minted by the real better-auth
// (server/tests/better_auth_cookie.mjs prints one):
//   { "user": { "cookie", "userId" }, "other": { ... }, "operator": { ... } }
// The operator's profile must have role `operator`.
//
// Both servers count requests per user and minute in memory (5 for renders)
// and the database counts them again, for both servers together. The cases
// below stay inside those limits when the script runs once in a minute on
// freshly started servers; run it again after a minute, not sooner.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import http from "node:http";

const args = process.argv.slice(2);
const seeding = args[0] === "seed";
const [nextBase, axumBase, statePath, objectDir] = seeding ? [null, null, args[1]] : args;
if (!statePath) {
  console.error("usage: mpe.mjs seed <state.json> | mpe.mjs <next-base-url> <axum-base-url> <state.json>");
  process.exit(2);
}
const { user, other, operator } = JSON.parse(readFileSync(statePath, "utf8"));
const ingestion = (n) => `c1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const job = (n) => `d1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const candidate = (n) => `f1000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const meme = (n) => `f2000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Uploads for GET /api/media: the user's own, and two of the other user's
// that a submission attaches (one approved, one still pending).
const uploads = {
  own: `meme-uploads/${user.userId}/e1000000-0000-4000-8000-000000000001.png`,
  approved: `meme-uploads/${other.userId}/e1000000-0000-4000-8000-000000000002.jpg`,
  pending: `meme-uploads/${other.userId}/e1000000-0000-4000-8000-000000000003.webp`,
};

if (seeding) {
  const artifact = (n) => `${user.userId}/${ingestion(n)}/renders/${"e".repeat(64)}.mp4`;
  const ingestions = [
    [1, user.userId, "video/mp4", "video", "now() + interval '1 day'", "null"],
    [2, user.userId, "video/mp4", "video", "now() - interval '1 minute'", "null"],
    [3, user.userId, "video/mp4", "video", "now() + interval '1 day'", "now()"],
    [4, other.userId, "image/png", "image", "now() + interval '1 day'", "null"],
  ];
  const done = "'2026-11-01T00:00:01+00', '2026-11-01T00:00:02.5+00'";
  const jobs = [
    [1, 1, "inspect", "queued", 0, "{}", "null", "null, null"],
    [2, 1, "render", "completed", 1, JSON.stringify({ artifactKey: artifact(1), durationMs: 1500.5, width: 1080, 10: "ten", 2: { b: 1e21, a: 0.5 }, note: '따옴표 " 와 \\ 역슬래시' }), "null", done],
    [3, 1, "render", "completed", 1, JSON.stringify({ artifactKey: "not/a/key.mp4" }), "null", done],
    [4, 1, "render", "failed", 3, JSON.stringify({ artifactKey: "x", reason: "ffmpeg" }), "'render_failed'", done],
    [5, 2, "render", "completed", 1, JSON.stringify({ artifactKey: artifact(2) }), "null", done],
    [6, 3, "render", "completed", 1, JSON.stringify({ artifactKey: artifact(3) }), "null", done],
    [7, 4, "inspect", "completed", 1, "[1,2]", "null", done],
    [8, 1, "render", "completed", 1, JSON.stringify({ width: 1 }), "null", done],
  ];
  const quote = (text) => `'${text.replaceAll("'", "''")}'`;
  console.log(`-- Rows for server/parity/mpe.mjs. Throwaway database only.
delete from public.media_ingestions where id::text like 'c1000000-%';
insert into public.media_ingestions
  (id, user_id, ingest_mode, mime_type, media_kind, byte_size, sha256, temporary_storage_key, expires_at, rights_attested_at, deleted_at)
values
${ingestions.map(([n, owner, mime, kind, expires, deleted]) => `  ('${ingestion(n)}', '${owner}', 'USER_UPLOADED', '${mime}', '${kind}', 1000, repeat('${n}', 64), '${owner}/${ingestion(100 + n)}', ${expires}, now() - interval '2 days', ${deleted})`).join(",\n")};
insert into public.processing_jobs
  (id, ingestion_id, job_type, status, attempts, processor_name, processor_version, input_hash, output_json, error_code, started_at, completed_at, created_at)
values
${jobs.map(([n, of, type, status, attempts, output, error, times]) => `  ('${job(n)}', '${ingestion(of)}', '${type}', '${status}', ${attempts}, 'p', '1', repeat('${n}', 64), ${quote(output)}::jsonb, ${error}, ${times}, '2026-11-01T00:00:00.123456+00')`).join(",\n")};
-- Submissions that attach two of the other user's uploads.
delete from public.meme_submissions where name like 'axum-r3-%';
insert into public.meme_submissions (submitter_id, name, attachment_path, status) values
  ('${other.userId}', 'axum-r3-approved', '${uploads.approved}', 'approved'),
  ('${other.userId}', 'axum-r3-pending', '${uploads.pending}', 'pending');
-- The operator has used up this minute's (and the next ten minutes') renders.
delete from public.api_rate_limits where user_id = '${operator.userId}';
insert into public.api_rate_limits (user_id, action, window_start, request_count)
select '${operator.userId}', 'mpe_render', date_trunc('minute', now()) + n * interval '1 minute', 100
from generate_series(0, 10) as n;
-- Two candidates of ingestion 1 and two memes; the first candidate has two matches.
delete from public.meme_candidates where id::text like 'f1000000-%';
delete from public.memes where slug like 'axum-r3-candidate-%';
insert into public.memes (id, title, slug) values
  ('${meme(1)}', 'axum r3 meme one', 'axum-r3-candidate-1'),
  ('${meme(2)}', 'axum r3 meme two', 'axum-r3-candidate-2');
insert into public.meme_candidates (id, ingestion_id, title, meme_type, model_version, prompt_version) values
  ('${candidate(1)}', '${ingestion(1)}', 'with matches', 'PHRASE', 'mpe-candidate-v1', 'mpe-evidence-v1'),
  ('${candidate(2)}', '${ingestion(1)}', 'without matches', 'PHRASE', 'mpe-candidate-v1', 'mpe-evidence-v1');
insert into public.candidate_matches
  (id, candidate_id, meme_id, rank, overall_score, text_score, visual_score, audio_score, classification, evidence_json, created_at)
values
  ('f3000000-0000-4000-8000-000000000002', '${candidate(1)}', '${meme(2)}', 2, 0.5000, null, 0.1230, 1, 'RELATED', ${quote(JSON.stringify({ 10: "ten", 2: { b: 1e21, a: 0.5 }, note: '따옴표 " 와 \\', list: [1.5, 0, true, null] }))}::jsonb, '2026-11-01T00:00:00.123456+00'),
  ('f3000000-0000-4000-8000-000000000001', '${candidate(1)}', '${meme(1)}', 1, 0.9876, 0.0001, null, null, 'DUPLICATE', '{}'::jsonb, '2026-11-01T00:00:01+00');`);
  process.exit(0);
}

const IGNORED_HEADERS = new Set(["date", "connection", "keep-alive", "transfer-encoding", "x-nextjs-cache"]);
const next = new URL(nextBase);

function send(base, { method = "GET", path, cookie, headers = {}, body }) {
  const { hostname, port } = new URL(base);
  const payload = body === undefined ? null : Buffer.from(body, "utf8");
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname,
        port,
        path,
        method,
        headers: {
          host: next.host,
          "user-agent": "memecatch-parity",
          ...(cookie ? { cookie } : {}),
          ...(payload ? { "content-type": "application/json", "content-length": payload.length } : {}),
          ...headers,
        },
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const headerLines = [];
          for (const [name, values] of Object.entries(response.headersDistinct)) {
            if (!IGNORED_HEADERS.has(name)) headerLines.push(`${name}: ${values.join("\n")}`);
          }
          resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString("utf8"), headers: headerLines.sort().join("\n") });
        });
        response.on("error", reject);
      },
    );
    request.on("error", reject);
    request.end(payload ?? undefined);
  });
}

// A signed download URL carries the time it was signed at. Compare the rest
// here; that each server accepts the other's URL is checked separately.
const SIGNED = /exp=\d+&sig=[0-9a-f]{64}/g;
const comparable = (answer) => `status: ${answer.status}\n${answer.headers}\nbody: ${answer.body.replace(SIGNED, "exp=<ms>&sig=<hmac>")}`;

let failed = 0;
async function compare(label, request, { retryAfter = false } = {}) {
  const fromNext = await send(nextBase, request);
  const fromAxum = await send(axumBase, request);
  // Two servers a few milliseconds apart can round the wait differently.
  const strip = (text) => (retryAfter ? text.replace(/^retry-after: \d+$/m, "retry-after: <seconds>") : text);
  if (strip(comparable(fromNext)) === strip(comparable(fromAxum))) {
    console.log(`ok    ${label}  ${fromNext.status}`);
  } else {
    failed += 1;
    // Only the lines that differ: the shared headers are long.
    const [a, b] = [comparable(fromNext).split("\n"), comparable(fromAxum).split("\n")];
    const only = (lines, others) => lines.filter((line) => !others.includes(line)).map((line) => `    ${line.slice(0, 300)}`).join("\n");
    console.log(`DIFF  ${label}\n  next:\n${only(a, b)}\n  axum:\n${only(b, a)}`);
  }
  return [fromNext, fromAxum];
}

// --- GET /api/mpe/jobs/{id}
const jobPath = (n) => `/api/mpe/jobs/${job(n)}`;
await compare("job, signed out", { path: jobPath(1) });
await compare("job, a cookie nobody signed", { path: jobPath(1), cookie: user.cookie.replace(/.$/, "x") });
await compare("job, queued", { path: jobPath(1), cookie: user.cookie });
const [nextDone, axumDone] = await compare("job, finished render with a download url", { path: jobPath(2), cookie: user.cookie });
await compare("job, finished render whose artifact key is not one", { path: jobPath(3), cookie: user.cookie });
await compare("job, failed render", { path: jobPath(4), cookie: user.cookie });
await compare("job, finished render of an expired ingestion", { path: jobPath(5), cookie: user.cookie });
await compare("job, finished render of a deleted ingestion", { path: jobPath(6), cookie: user.cookie });
await compare("job, finished render without an artifact key", { path: jobPath(8), cookie: user.cookie });
await compare("job, another user's", { path: jobPath(7), cookie: user.cookie });
await compare("job, its owner (output that is not an object)", { path: jobPath(7), cookie: other.cookie });
await compare("job, not the owner", { path: jobPath(1), cookie: other.cookie });
await compare("job, an operator", { path: jobPath(2), cookie: operator.cookie });
await compare("job, no such id", { path: "/api/mpe/jobs/00000000-0000-4000-8000-000000000000", cookie: user.cookie });
await compare("job, an id that is not a uuid", { path: "/api/mpe/jobs/not-a-uuid", cookie: user.cookie });
await compare("job, the id in upper case", { path: `/api/mpe/jobs/${job(1).toUpperCase()}`, cookie: user.cookie });
await compare("job, a percent-encoded id", { path: `/api/mpe/jobs/${job(1).replace("d1", "%641")}`, cookie: user.cookie });
await compare("job, HEAD", { method: "HEAD", path: jobPath(1), cookie: user.cookie });
await compare("job, POST", { method: "POST", path: jobPath(1), cookie: user.cookie });
await compare("job, a query string", { path: `${jobPath(1)}?x=1`, cookie: user.cookie });

// Each server serves (or reports missing) the object the other signed for.
for (const [signer, answer] of [["next", nextDone], ["axum", axumDone]]) {
  const url = JSON.parse(answer.body).data?.downloadUrl;
  if (!url) {
    failed += 1;
    console.log(`DIFF  ${signer} signed no download url`);
    continue;
  }
  const path = new URL(url).pathname + new URL(url).search;
  const [viaNext, viaAxum] = [await send(nextBase, { path }), await send(axumBase, { path })];
  const same = viaNext.status === viaAxum.status && viaNext.body === viaAxum.body && viaNext.status !== 401;
  console.log(`${same ? "ok   " : "DIFF "} url signed by ${signer}: next ${viaNext.status}, axum ${viaAxum.status} ${viaNext.body}`);
  if (!same) failed += 1;
}

// --- POST /api/mpe/renders
const origin = { origin: next.origin };
const render = (id, segments, extra = {}) => JSON.stringify({ ingestionId: id, preset: "vertical", attribution: "  출처: 밈캐치  ", segments, ...extra });
const one = [{ startMs: 0, endMs: 1000, text: " 첫 자막 " }];
const two = [{ text: "둘", endMs: 2e3, startMs: 0.0 }, { startMs: 0, endMs: 3000, text: "셋" }];
const post = (who, body, headers = origin) => ({ method: "POST", path: "/api/mpe/renders", cookie: who?.cookie, headers, body });

await compare("render, no origin", post(user, render(ingestion(1), one), {}));
await compare("render, a foreign origin", post(user, render(ingestion(1), one), { origin: "https://evil.example" }));
await compare("render, sec-fetch-site: same-origin", post(null, render(ingestion(1), one), { "sec-fetch-site": "same-origin" }));
await compare("render, signed out", post(null, render(ingestion(1), one)));
// user: two requests that reach the database, three that do not, then the limit.
await compare("render, a valid request (the call fails in the planner: 400 on both)", post(user, render(ingestion(1), one)));
await compare("render, other segments in another key order", post(user, render(ingestion(1), two)));
await compare("render, an unknown key", post(user, render(ingestion(1), one, { extra: 1 })));
await compare("render, malformed json", post(user, '{"ingestionId":'));
await compare("render, a body over 64 KiB", post(user, render(ingestion(1), [{ startMs: 0, endMs: 1, text: "x".repeat(70_000) }])));
await compare("render, the sixth request of a user in a minute", post(user, render(ingestion(1), one)), { retryAfter: true });
// other: an image ingestion, an unknown one, three refused bodies, then the limit.
await compare("render, an image ingestion", post(other, render(ingestion(4), one)));
await compare("render, no such ingestion", post(other, render("00000000-0000-4000-8000-000000000000", one)));
await compare("render, segments out of order", post(other, render(ingestion(4), [{ startMs: 500, endMs: 600, text: "a" }, { startMs: 0, endMs: 100, text: "b" }])));
await compare("render, an end that is not after its start", post(other, render(ingestion(4), [{ startMs: 5, endMs: 5, text: "x" }])));
await compare("render, an empty body", post(other, ""));
await compare("render, the sixth request of another user", post(other, "{}"), { retryAfter: true });
// operator: the database's own count for this minute is used up.
await compare("render, the database's limit reached", post(operator, render(ingestion(1), one)));
await compare("render, GET", { path: "/api/mpe/renders", cookie: user.cookie });
await compare("render, OPTIONS", { method: "OPTIONS", path: "/api/mpe/renders" });

// --- GET /api/admin/mpe-candidates (POST stays with Next)
const candidates = (query, who, method = "GET", headers = {}) => ({ method, path: `/api/admin/mpe-candidates${query}`, cookie: who?.cookie, headers });
await compare("candidates, signed out", candidates(`?candidateId=${candidate(1)}`));
await compare("candidates, not an operator", candidates(`?candidateId=${candidate(1)}`, user));
await compare("candidates, not an operator, no id", candidates("", user));
await compare("candidates, an operator, no id", candidates("", operator));
await compare("candidates, an operator, an id that is not a uuid", candidates("?candidateId=f1000000", operator));
await compare("candidates, an operator, two matches", candidates(`?candidateId=${candidate(1)}`, operator));
await compare("candidates, an operator, the id in upper case", candidates(`?candidateId=${candidate(1).toUpperCase()}`, operator));
await compare("candidates, an operator, the id given twice", candidates(`?candidateId=${candidate(2)}&candidateId=${candidate(1)}`, operator));
await compare("candidates, an operator, no matches", candidates(`?candidateId=${candidate(2)}`, operator));
await compare("candidates, an operator, no such candidate", candidates("?candidateId=00000000-0000-4000-8000-000000000000", operator));
await compare("candidates, HEAD", candidates(`?candidateId=${candidate(1)}`, operator, "HEAD"));
await compare("candidates, POST (Next's)", candidates("", operator, "POST", origin));

// --- GET /api/media/{...path}
if (objectDir) {
  const objects = {
    ...Object.fromEntries(Object.values(uploads).map((key) => [key, `upload ${key}`])),
    "meme-thumbs/tiktok/axum-r3.jpg": "thumbnail bytes",
    "meme-thumbs/tiktok/AXUM-R3.PNG": "upper case extension",
    "meme-card-art/axum-r3.webp": "card art bytes",
    "meme-thumbs/tiktok/axum-r3.html": "<script>alert(1)</script>",
    "other-bucket/axum-r3.png": "not an allowed prefix",
  };
  for (const [key, bytes] of Object.entries(objects)) {
    mkdirSync(path.join(objectDir, path.dirname(key)), { recursive: true });
    writeFileSync(path.join(objectDir, key), bytes);
  }
  const media = (key, who, method = "GET") => ({ method, path: `/api/media/${key}`, cookie: who?.cookie });
  await compare("media, a thumbnail", media("meme-thumbs/tiktok/axum-r3.jpg"));
  await compare("media, a thumbnail, HEAD", media("meme-thumbs/tiktok/axum-r3.jpg", null, "HEAD"));
  await compare("media, an extension in upper case", media("meme-thumbs/tiktok/AXUM-R3.PNG"));
  await compare("media, card art", media("meme-card-art/axum-r3.webp", user));
  await compare("media, a thumbnail that is not stored", media("meme-thumbs/tiktok/missing.jpg"));
  await compare("media, an extension that is not media", media("meme-thumbs/tiktok/axum-r3.html"));
  await compare("media, no extension", media("meme-thumbs/tiktok/axum-r3"));
  await compare("media, a prefix that is not served", media("other-bucket/axum-r3.png"));
  await compare("media, two dots in the key", media("meme-thumbs/tiktok/axum..r3.jpg"));
  await compare("media, an encoded segment", media("meme-thumbs/tiktok/axum%2Dr3.jpg"));
  await compare("media, POST", media("meme-thumbs/tiktok/axum-r3.jpg", null, "POST"));
  await compare("media, own upload", media(uploads.own, user));
  await compare("media, own upload, signed out", media(uploads.own));
  await compare("media, own upload, another user", media(uploads.own, other));
  await compare("media, own upload, an operator", media(uploads.own, operator));
  await compare("media, approved attachment, signed out", media(uploads.approved));
  await compare("media, approved attachment, another user", media(uploads.approved, user));
  await compare("media, pending attachment, its owner", media(uploads.pending, other));
  await compare("media, pending attachment, another user", media(uploads.pending, user));
  await compare("media, pending attachment, an operator", media(uploads.pending, operator));
  await compare("media, an upload nobody stored, its owner", media(`meme-uploads/${user.userId}/missing.png`, user));
  await compare("media, an upload path without a file", media(`meme-uploads/${user.userId}.png`, user));
}

console.log(failed ? `\n${failed} differences` : "\nall requests answered identically");
process.exit(failed ? 1 : 0);
