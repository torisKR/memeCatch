#!/usr/bin/env node
// R11: the getOEmbed family, Next against Axum on one database. The providers
// are a recording stub on port 3640, reached through oembed-intercept.mjs in
// Next (under Next's own fetch cache) and AXUM_TEST_OEMBED_ORIGIN in Axum.
// For each case the database is put in the same state, the request runs on
// one server, and the answer, what the providers received and the rows left
// are read; then the same through the other server. See README.md here.
//
//   CRON_SECRET=<the servers'> PARITY_OPERATOR=<json> PARITY_USER=<json> \
//     node server/parity/oembed.mjs <next> <axum> [section...]
//
// PARITY_OPERATOR and PARITY_USER are lines printed by
// server/tests/better_auth_cookie.mjs; the script makes the first an
// operator. Sections: oembed, ingest, refresh, cache, view, methods.
// Throwaway database only: it empties the source tables and replaces
// database functions for a moment.
import http from "node:http";
import { compare, expectEqual, fail, nextBase, axumBase, psql, run, send, sqlText } from "./harness.mjs";

const cronSecret = process.env.CRON_SECRET;
const operator = JSON.parse(process.env.PARITY_OPERATOR ?? "null");
const user = JSON.parse(process.env.PARITY_USER ?? "null");
if (!cronSecret || !operator?.cookie || !user?.cookie) {
  console.error("CRON_SECRET, PARITY_OPERATOR and PARITY_USER are required");
  process.exit(2);
}
// The profile trigger lets only service_role change a role; the superuser skips it.
psql(`begin; set local session_replication_role = replica;
      update public.profiles set role = 'operator' where id = ${sqlText(operator.userId)}::uuid; commit;`);
const site = new URL(nextBase).origin.replace(/:\d+$/, ":3460");
const nextOwn = `http://localhost:${new URL(nextBase).port}`;
const bearer = { authorization: `Bearer ${cronSecret}` };

// Fresh provider URLs for each run: Next keeps its fetch cache on disk.
const nonce = Date.now().toString(36).slice(-6);
let serial = 0;
const fresh = () => `${nonce}${(serial++).toString(36).padStart(3, "0")}`;
const youtubeId = () => `Y${fresh()}`.padEnd(11, "x").slice(0, 11);
const tiktokId = () => `7${parseInt(fresh(), 36).toString().padStart(14, "0")}`;
const instagramCode = () => `C${fresh()}`;

// The stub: `script(host, path, params)` answers each request
// ({ status, body } or { hang: true } or { destroy: true }); every request is recorded.
let script = () => ({ status: 500, body: "" });
let records = [];
const sockets = new Set();
const stub = http.createServer((request, response) => {
  const headers = Object.fromEntries(Object.entries(request.headers)
    .filter(([name]) => !["host", "connection", "accept-encoding"].includes(name)));
  records.push(`${request.method} ${request.url} ${JSON.stringify(headers, Object.keys(headers).sort())}`);
  const url = new URL(request.url, "http://stub");
  const [, host, ...rest] = url.pathname.split("/");
  const answer = script(host, `/${rest.join("/")}`, url.searchParams);
  if (answer.hang) return;
  if (answer.destroy) return request.socket.destroy();
  response.writeHead(answer.status ?? 200, { "content-type": "application/json" }).end(answer.body ?? "");
});
stub.on("connection", (socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
});
await new Promise((resolve) => stub.listen(3640, "127.0.0.1", resolve));

const TIME = /\d{4}-\d\d-\d\dT\d\d:\d\d(:\d\d)?(\.\d+)?(Z|[+-]\d\d:\d\d)/g;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
const mask = (text) => text.replace(TIME, (time) => time.replace(/\d/g, "d"));
const maskIds = (text) => mask(text).replace(UUID, "<uuid>");
const json = (value) => JSON.stringify(value);
const ip = (n) => ({ "x-forwarded-for": `203.0.113.${n}` });
let ips = 10;

function reset() {
  psql(`delete from public.source_acquisition_recovery; delete from public.source_ingestions;
        delete from public.meme_contents where meme_id in (select id from public.memes where slug like 'r11-%');
        delete from public.memes where slug like 'r11-%';
        delete from public.media_sources; delete from public.job_runs where job_name = 'refresh_media_sources';`);
}

function rows() {
  return maskIds(psql(`
    select 'source', platform, external_id, canonical_url, coalesce(title, '-'), coalesce(channel_name, '-'),
           coalesce(channel_id, '-'), coalesce(platform_published_at::text, '-'), coalesce(duration_seconds::text, '-'),
           coalesce(public_status, '-'), coalesce(embeddable::text, '-'), coalesce(license_code, '-'),
           coalesce(made_for_kids::text, '-'), coalesce(thumbnail_url, '-'), metadata_refreshed_at is not null,
           coalesce(date_trunc('second', metadata_expires_at - metadata_refreshed_at)::text, '-'), last_checked_at is not null, removed_at is not null
      from public.media_sources order by canonical_url;
    select 'ledger', source_key, coalesce(external_id, '-'), coalesce(canonical_url, '-'), attempt_count,
           next_retry_at is not null, last_error_code, last_error_retryable, last_attempt_idempotency_key,
           resolved_at is not null
      from public.source_acquisition_recovery order by source_key;
    select 'ingestion', s.canonical_url, i.status, coalesce(i.target_meme_id::text, '-')
      from public.source_ingestions i join public.media_sources s on s.id = i.source_id order by 2, 3;
    select 'content', c.platform, c.content_id, c.availability from public.meme_contents c
      join public.memes m on m.id = c.meme_id where m.slug like 'r11-%' order by 2, 3;
    select 'job', ok, detail::text from public.job_runs where job_name = 'refresh_media_sources';`));
}

/**
 * The same request through each server, from the same database state:
 * answer, provider requests and rows. `seed` runs before each.
 */
async function same(label, request, { answers, seed = "", expect } = {}) {
  if (answers) script = answers;
  const seen = {};
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    reset();
    if (seed) psql(seed);
    records = [];
    const response = await send(base, request);
    const headers = ["content-type", "cache-control", "retry-after"].map((h) => `${h}=${response.headers[h] ?? "-"}`).join(" ");
    seen[name] = {
      answer: `${response.status} ${headers}\n${maskIds(response.body.toString("utf8"))}`,
      requests: [...records].sort().join("\n"),
      rows: rows(),
    };
  }
  const brief = seen.next.answer.split("\n")[1].slice(0, 120);
  expectEqual(`${label}: answer`, seen.axum.answer, seen.next.answer, brief);
  expectEqual(`${label}: provider requests`, seen.axum.requests, seen.next.requests, `${seen.next.requests ? seen.next.requests.split("\n").length : 0} requests`);
  expectEqual(`${label}: rows`, seen.axum.rows, seen.next.rows);
  if (expect && !seen.next.answer.includes(expect)) fail(`${label}: expected ${expect}`, seen.next.answer);
  return seen.next;
}

const oembedPath = (url) => `/api/oembed?url=${encodeURIComponent(url)}`;
const signedIn = (extra = {}) => ({ cookie: operator.cookie, ...ip(ips++), ...extra });

const youtubeAnswer = (title = " 영상 제목 ", author = "채널") => ({ status: 200, body: json({ title, author_name: author, html: "<iframe>" }) });
const tiktokAnswer = (id, extra = {}) => ({ status: 200, body: json({ title: "틱톡", author_name: "작성자", html: `<blockquote data-video-id="${id}">`, ...extra }) });

async function oembed() {
  const url = `https://www.youtube.com/watch?v=${youtubeId()}`;
  await compare("signed out", { path: oembedPath(url), headers: ip(1) }, { status: 401 });
  await compare("signed out, HEAD", { method: "HEAD", path: oembedPath(url), headers: ip(1) }, { status: 401 });
  psql("drop function if exists public.reserve_oembed_request()");
  await same("signed in, reserve_oembed_request missing (production)", { path: oembedPath(url), headers: signedIn() }, { expect: '"RATE_LIMITED"' });
  psql(`create function public.reserve_oembed_request() returns void language plpgsql as $$ begin raise exception 'quota'; end $$;
        grant execute on function public.reserve_oembed_request() to authenticated;`);
  await same("signed in, the reservation refuses", { path: oembedPath(url), headers: signedIn() }, { expect: '"RATE_LIMITED"' });
  psql(RESERVE_OK);

  const cases = [
    ["YouTube watch URL", `https://www.youtube.com/watch?v=${youtubeId()}#t=1`, () => youtubeAnswer(), '"provider":"youtube"'],
    ["YouTube Shorts with a long title", `https://m.youtube.com/shorts/${youtubeId()}`, () => youtubeAnswer(`${"가".repeat(499)}😀끝`, "   "), '"authorName":null'],
    ["youtu.be", `https://youtu.be/${youtubeId()}?si=x`, () => youtubeAnswer(), '"embedUrl":"https://www.youtube-nocookie.com'],
    ["YouTube without an ID", "https://www.youtube.com/shorts/abc", () => youtubeAnswer(), '"INVALID_URL"'],
    ["TikTok", `https://www.tiktok.com/@a.b/video/${tiktokId()}`, (host, path, params) => tiktokAnswer(params.get("url").split("/video/")[1]), '"provider":"tiktok"'],
    ["TikTok short link, ID from the HTML", `https://vt.tiktok.com/${fresh()}/`, () => tiktokAnswer("7123456789012345678"), '"contentId":"7123456789012345678"'],
    ["TikTok without any ID", `https://vt.tiktok.com/${fresh()}/`, () => ({ status: 200, body: json({ title: "x", html: "<b>" }) }), "TikTok 게시물 ID"],
    ["Instagram reel", `https://www.instagram.com/reel/${instagramCode()}/?igsh=1`, () => ({ status: 200, body: json({ title: "릴스", author_name: "ig" }) }), "embed/captioned"],
    ["Instagram missing post (400, 24/2207045)", `https://www.instagram.com/p/${instagramCode()}/`, () => ({ status: 400, body: json({ error: { message: "Media not found", code: 24, error_subcode: 2207045 } }) }), '"Media not found"'],
    ["Instagram other 400", `https://www.instagram.com/p/${instagramCode()}/`, () => ({ status: 400, body: json({ error: { message: "Invalid token", code: 190 } }) }), '"Invalid token"'],
    ["Instagram story", `https://www.instagram.com/stories/${instagramCode()}/`, () => ({ status: 200, body: "{}" }), '"INVALID_URL"'],
    ["Facebook video", `https://www.facebook.com/page/videos/${fresh()}`, () => ({ status: 200, body: json({ title: "fb", author_name: "page" }) }), "plugins/video.php"],
    ["Facebook post", `https://www.facebook.com/page/posts/${fresh()}`, () => ({ status: 200, body: json({ author_name: "page" }) }), "plugins/post.php"],
    ["fb.watch", `https://fb.watch/${fresh()}/`, () => ({ status: 200, body: "{}" }), "plugins/video.php"],
    ["Threads post", `https://www.threads.net/@a/post/${fresh()}`, () => ({ status: 200, body: json({ html: "<blockquote>\n</blockquote>", title: " t " }) }), '"embedHtml":"<blockquote>\\n</blockquote>"'],
    ["Threads without HTML", `https://www.threads.com/t/${fresh()}`, () => ({ status: 200, body: json({ html: "  " }) }), "Threads 임베드 HTML"],
    ["provider 404 without a body", `https://www.youtube.com/watch?v=${youtubeId()}`, () => ({ status: 404, body: "" }), '"UPSTREAM_ERROR"'],
    ["provider 500 with HTML", `https://www.youtube.com/watch?v=${youtubeId()}`, () => ({ status: 500, body: "<html>" }), "콘텐츠 정보를 불러오는"],
    ["provider 200 with 0", `https://www.youtube.com/watch?v=${youtubeId()}`, () => ({ status: 200, body: "0" }), "가져오지 못했습니다"],
    ["provider 503 with a string", `https://www.youtube.com/watch?v=${youtubeId()}`, () => ({ status: 503, body: '"busy"' }), "콘텐츠 정보를 불러오는"],
    ["provider closes the connection", `https://www.youtube.com/watch?v=${youtubeId()}`, () => ({ destroy: true }), "콘텐츠 정보를 불러오는"],
    ["unsupported host", "https://example.com/watch?v=1", () => ({}), '"UNSUPPORTED_PROVIDER"'],
    ["plain HTTP", `http://youtu.be/${youtubeId()}`, () => ({}), "HTTPS"],
    ["URL too long", `https://youtu.be/${"a".repeat(2_040)}`, () => ({}), '"INVALID_URL"'],
  ];
  for (const [label, url, answers, expect] of cases) {
    await same(label, { path: oembedPath(url), headers: signedIn() }, { answers, expect });
  }
  await same("no url parameter", { path: "/api/oembed", headers: signedIn() }, { expect: '"INVALID_URL"' });
  if (process.env.PARITY_SLOW !== "0") {
    await same("provider never answers (8 s)", { path: oembedPath(`https://www.youtube.com/watch?v=${youtubeId()}`), headers: signedIn() },
      { answers: () => ({ hang: true }), expect: "시간이 초과" });
  }
  // The 21st request of a minute from one address.
  const limitedIp = ip(250);
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    const statuses = [];
    for (let i = 0; i < 21; i += 1) {
      const response = await send(base, { path: oembedPath("https://example.com/"), headers: { cookie: operator.cookie, ...limitedIp } });
      statuses.push(response.status);
      if (i === 20) expectEqual(`${name}: 21st request`, `${response.status} ${response.headers["retry-after"] ? "retry-after" : "-"} ${response.body}`,
        '429 retry-after {"error":"요청이 너무 많아요. 잠시 후 다시 시도해 주세요.","code":"RATE_LIMITED"}');
    }
    expectEqual(`${name}: the first 20`, statuses.slice(0, 20).join(","), Array(20).fill(400).join(","));
  }
}

async function ingest() {
  const post = (body, headers = {}) => ({ method: "POST", path: "/api/admin/source-ingestions", body,
    headers: Object.fromEntries(Object.entries({ cookie: operator.cookie, origin: site, "content-type": "application/json", ...headers })
      .filter(([, value]) => value !== undefined)) });
  const reel = json({ url: `https://www.instagram.com/reel/${instagramCode()}/` });
  await same("no origin", post(reel, { origin: undefined }), { expect: "invalid_origin" });
  await same("another origin", post(reel, { origin: "https://evil.example" }), { expect: "invalid_origin" });
  await same("Next's own origin", post("{}", { origin: nextOwn }), { expect: "invalid_input" });
  await same("same-origin fetch without an origin", post("{}", { origin: undefined, "sec-fetch-site": "same-origin" }), { expect: "invalid_input" });
  await same("signed out", post(reel, { cookie: "" }), { expect: "signed_out" });
  await same("not an operator", post(reel, { cookie: user.cookie }), { expect: "operator_required" });
  for (const body of ["", "nope", "null", "[]", "{}", json({ url: " " }), json({ url: 5 }), json({ url: "x".repeat(2_049) }),
    json({ url: "x", targetMemeId: null }), json({ url: "x", targetMemeId: "11111111-1111-1111-1111-111111111111" }),
    json({ url: "x", targetMemeId: "11111111-1111-4111-c111-111111111111" }), json({ url: "x", retry: "true" }), json({ url: "x", retry: null })]) {
    await same(`invalid input ${body.slice(0, 40)}`, post(body), { expect: "invalid_input" });
  }
  await same("retry false", post(json({ url: "x", retry: false })), { expect: "invalid_retry" });
  await same("short link", post(json({ url: "https://vt.tiktok.com/ZS1/", retry: true })), { expect: "invalid_url" });
  await same("unknown target meme", post(json({ url: `https://youtu.be/${youtubeId()}`, targetMemeId: "00000000-0000-0000-0000-000000000000" })), { expect: "missing_meme" });

  const memeSeed = "insert into public.memes (id, title, slug) values ('11111111-1111-4111-8111-111111111111', 'R11', 'r11-meme');";
  const youtube = `https://youtu.be/${youtubeId()}`;
  await same("YouTube source, new", post(json({ url: ` ${youtube} ` })), { answers: () => youtubeAnswer(), expect: "metadata_ready" });
  const existing = (url) => `insert into public.media_sources (platform, external_id, canonical_url)
    values ('youtube', ${sqlText(url.split("/").pop())}, ${sqlText(`https://www.youtube.com/watch?v=${url.split("/").pop()}`)});`;
  await same("YouTube source, already there", post(json({ url: youtube })), { seed: existing(youtube), expect: '"duplicate"' });
  await same("YouTube source, linked to a meme", post(json({ url: youtube, targetMemeId: "11111111-1111-4111-8111-111111111111", retry: true })),
    { seed: memeSeed, expect: '"linked"' });
  const tiktok = `https://www.tiktok.com/@a/video/${tiktokId()}/`;
  await same("TikTok source", post(json({ url: tiktok })), { answers: (h, p, params) => tiktokAnswer(params.get("url").split("/video/")[1]), expect: '"platform":"tiktok"' });
  await same("provider 404: not retried", post(json({ url: `https://www.instagram.com/p/${instagramCode()}/` })),
    { answers: () => ({ status: 404, body: json({ error: { message: "nope" } }) }), expect: "provider_uncertain" });
  await same("provider 500: retried later", post(json({ url: `https://www.youtube.com/shorts/${youtubeId()}` })),
    { answers: () => ({ status: 500, body: "" }), expect: "nextRetryAt" });
  await same("provider sends HTML", post(json({ url: `https://youtu.be/${youtubeId()}` })),
    { answers: () => ({ status: 502, body: "<html>bad gateway</html>" }), expect: "provider_transient" });
  await same("provider closes the connection", post(json({ url: `https://youtu.be/${youtubeId()}` })),
    { answers: () => ({ destroy: true }), expect: "fetch failed" });
  await withRenamed("record_source_acquisition_failure", "(text, uuid, text, text, text, text, text, boolean, timestamptz, timestamptz)", () =>
    same("ledger missing after a provider failure", post(json({ url: `https://youtu.be/${youtubeId()}` })),
      { answers: () => ({ status: 500, body: "" }), expect: '"db_failure"' }));
  await withRenamed("record_source_ingestion", "(text, text, text, text, text, uuid, uuid, text, timestamptz, timestamptz)", () =>
    same("record_source_ingestion missing", post(json({ url: `https://youtu.be/${youtubeId()}` })),
      { answers: () => youtubeAnswer(), expect: "function not found" }));
}

/** Renames a function for the length of `body`. */
async function withRenamed(name, args, body) {
  psql(`alter function public.${name}${args} rename to ${name}_r11_off`);
  try {
    return await body();
  } finally {
    psql(`alter function public.${name}_r11_off${args} rename to ${name}`);
  }
}

const refreshRequest = { path: "/api/cron/source-refresh", headers: bearer };

function videos(params, byId) {
  const items = (params.get("id") ?? "").split(",").filter((id) => byId[id]).map((id) => ({ id, ...byId[id] }));
  return { status: 200, body: json({ items }) };
}

async function refresh() {
  for (const value of [undefined, "Bearer wrong", `bearer ${cronSecret}`, cronSecret]) {
    await compare(`authorization ${json(value ?? null)}`, { path: "/api/cron/source-refresh", headers: value ? { authorization: value } : {} }, { status: 401 });
  }
  await same("empty database", refreshRequest, { expect: '"status":"ok"' });

  const [a, b, c, d, e, f, g] = Array.from({ length: 7 }, youtubeId);
  const [t1, t2, t3, t4] = Array.from({ length: 4 }, tiktokId);
  const [i1, i2, i3] = Array.from({ length: 3 }, instagramCode);
  const source = (id, platform, external, url, checked = "null") =>
    `('0000000${id}-0000-4000-8000-000000000000', '${platform}', ${sqlText(external)}, ${sqlText(url)}, ${checked})`;
  const seed = `insert into public.media_sources (id, platform, external_id, canonical_url, last_checked_at) values
    ${[
      source(1, "youtube", a, `https://www.youtube.com/watch?v=${a}`),
      source(2, "youtube", b, `https://www.youtube.com/watch?v=${b}`),
      source(3, "youtube_shorts", c, `https://www.youtube.com/shorts/${c}`),
      source(4, "youtube", d, `https://www.youtube.com/watch?v=${d}`, "now() - interval '2 days'"),
      source(5, "youtube", e, `https://www.youtube.com/watch?v=${e}`),
      source(6, "youtube", f, `https://youtu.be/${f}`),
      source(7, "youtube", g, `https://www.youtube.com/watch?v=${g}`, "now()"),
      source(8, "tiktok", t1, `https://www.tiktok.com/@a/video/${t1}`),
      source(9, "tiktok", t2, `https://www.tiktok.com/@a/video/${t2}`),
    ].join(",\n")},
    ('0000000a-0000-4000-8000-000000000000', 'tiktok', ${sqlText(t3)}, ${sqlText(`https://www.tiktok.com/@a/video/${t3}`)}, null),
    ('0000000b-0000-4000-8000-000000000000', 'tiktok', ${sqlText(t4)}, ${sqlText(`https://www.tiktok.com/@a/video/${t4}`)}, null),
    ('0000000c-0000-4000-8000-000000000000', 'instagram', ${sqlText(i1)}, ${sqlText(`https://www.instagram.com/reel/${i1}/`)}, null),
    ('0000000d-0000-4000-8000-000000000000', 'instagram', ${sqlText(i2)}, ${sqlText(`https://www.instagram.com/p/${i2}/`)}, null),
    ('0000000e-0000-4000-8000-000000000000', 'instagram', ${sqlText(i3)}, ${sqlText(`https://www.instagram.com/p/${i3}/`)}, null);
    insert into public.memes (id, title, slug) values ('11111111-1111-4111-8111-111111111111', 'R11', 'r11-meme');
    insert into public.meme_contents (meme_id, type, platform, content_id, url, availability) values
      ('11111111-1111-4111-8111-111111111111', 'embed', 'YouTube', ${sqlText(a)}, 'https://x.example/', 'dead'),
      ('11111111-1111-4111-8111-111111111111', 'embed', 'YouTube', ${sqlText(b)}, 'https://x.example/', 'live'),
      ('11111111-1111-4111-8111-111111111111', 'embed', 'YouTube', ${sqlText(c)}, ${sqlText(`https://www.youtube.com/shorts/${c}`)}, 'live'),
      ('11111111-1111-4111-8111-111111111111', 'embed', 'TikTok', ${sqlText(t1)}, 'https://x.example/', 'unchecked'),
      ('11111111-1111-4111-8111-111111111111', 'embed', 'Instagram', ${sqlText(i2)}, 'https://x.example/', 'live');`;
  const byId = {
    [a]: { snippet: { title: "공개", channelTitle: "ch", channelId: "UC1", publishedAt: "2024-01-02T03:04:05Z", thumbnails: { medium: { url: "https://i.ytimg.com/m.jpg" } } },
      contentDetails: { duration: "PT1H2M3S" }, status: { privacyStatus: "public", embeddable: true, license: "youtube", madeForKids: false } },
    [c]: { snippet: { title: "비공개" }, status: { privacyStatus: "private", embeddable: false } },
    [d]: { snippet: { title: "지역" }, contentDetails: { regionRestriction: { blocked: ["KR"] } }, status: { privacyStatus: "public", embeddable: true } },
    [e]: { snippet: { title: "임베드 꺼짐" }, status: { privacyStatus: "public", embeddable: false } },
  };
  const social = (host, path, params) => {
    if (host === "www.googleapis.com") return videos(params, byId);
    const url = params.get("url") ?? "";
    if (url.includes(t1)) return tiktokAnswer(t1);
    if (url.includes(t2)) return tiktokAnswer(t2, { title: undefined });
    if (url.includes(t3)) return tiktokAnswer("1234567890123");
    if (url.includes(t4)) return { status: 404, body: "" };
    if (url.includes(i1)) return { status: 200, body: json({ title: "릴스", author_name: "ig" }) };
    if (url.includes(i2)) return { status: 400, body: json({ error: { message: "gone", code: 24, error_subcode: 2207045 } }) };
    return { status: 500, body: "" };
  };
  await same("every platform and outcome", refreshRequest, { seed, answers: social, expect: '"status":"partial"' });
  await same("YouTube API fails", refreshRequest, { seed, answers: (host, path, params) => host === "www.googleapis.com" ? { status: 503, body: "" } : social(host, path, params), expect: "YouTube API HTTP 503" });
  await same("YouTube answer not for the batch", refreshRequest, { seed, answers: (host, path, params) => host === "www.googleapis.com" ? { status: 200, body: json({ items: [{ id: "zzzzzzzzzzz" }] }) } : social(host, path, params), expect: "youtube_video_list_inconclusive" });

  const ledger = `insert into public.source_acquisition_recovery (source_key, source_id, platform, external_id, canonical_url, attempt_count,
      next_retry_at, last_error_code, last_error_retryable, last_attempted_at, last_attempt_idempotency_key) values
    ('tiktok:${t1}', '00000008-0000-4000-8000-000000000000', 'tiktok', '${t1}', null, 2, now() - interval '1 minute', 'provider_transient', true, now(), 'k1'),
    ('tiktok:${t2}', '00000009-0000-4000-8000-000000000000', 'tiktok', '${t2}', null, 1, now() + interval '1 hour', 'provider_transient', true, now(), 'k2'),
    ('youtube:${a}', null, 'youtube', '${a}', null, 1, now() - interval '1 minute', 'provider_transient', true, now(), 'k3'),
    ('youtube:${b}', '00000002-0000-4000-8000-000000000000', 'youtube', 'other', null, 1, now() - interval '1 minute', 'db_failure', true, now(), 'k4'),
    ('invalid_identity:00000006-0000-4000-8000-000000000000', '00000006-0000-4000-8000-000000000000', 'youtube', null, null, 1, null, 'metadata_mismatch', false, now(), 'k5'),
    ('provider_identity:0000000a-0000-4000-8000-000000000000', '0000000a-0000-4000-8000-000000000000', 'tiktok', '${t3}', null, 1, now() - interval '2 minutes', 'provider_transient', true, now(), 'k6'),
    ('provider_identity:0000000b-0000-4000-8000-000000000000', '0000000b-0000-4000-8000-000000000000', 'instagram', '${t4}', null, 1, now() - interval '3 minutes', 'provider_transient', true, now(), 'k7');`;
  await same("due, deferred, unowned and quarantined recovery keys", refreshRequest, { seed: `${seed}\n${ledger}`, answers: social, expect: '"recovery_unowned_keys":' });
  const repaired = `${seed}\n${ledger}\nupdate public.media_sources set canonical_url = 'https://www.youtube.com/watch?v=${f}' where id = '00000006-0000-4000-8000-000000000000';`;
  await same("a repaired identity leaves quarantine", refreshRequest, { seed: repaired, answers: social });

  await withRenamed("list_due_source_acquisition_recovery", "(timestamptz, integer)", () =>
    same("the due ledger cannot be read (500)", refreshRequest, { seed }));
  psql("alter table public.job_runs add constraint r11_off check (job_name <> 'refresh_media_sources') not valid");
  try {
    await same("the run cannot be recorded", refreshRequest, { seed, answers: social, expect: "r11_off" });
  } finally {
    psql("alter table public.job_runs drop constraint r11_off");
  }
}

/** The callers share one cache within a server: provider requests per server. */
const RESERVE_OK = `create or replace function public.reserve_oembed_request() returns void language sql as $$ select $$;
  grant execute on function public.reserve_oembed_request() to authenticated;`;

async function cache() {
  psql(RESERVE_OK);
  const id = tiktokId();
  const url = `https://www.tiktok.com/@cat/video/${id}`;
  script = () => tiktokAnswer(id);
  const counts = {};
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    reset();
    records = [];
    const steps = [];
    steps.push((await send(base, { path: oembedPath(url), headers: signedIn() })).status);
    steps.push((await send(base, { method: "POST", path: "/api/admin/source-ingestions",
      headers: { cookie: operator.cookie, origin: site }, body: json({ url }) })).status);
    psql("update public.media_sources set last_checked_at = null");
    steps.push((await send(base, refreshRequest)).status);
    steps.push((await send(base, { path: oembedPath(`${url}?a=1`), headers: signedIn() })).status);
    counts[name] = `${steps.join(",")} provider requests: ${records.length}`;
  }
  expectEqual("oembed, ingestion, refresh, then another URL", counts.axum, counts.next, counts.next);
  script = () => ({ status: 404, body: "" });
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    records = [];
    const target = oembedPath(`https://youtu.be/${youtubeId()}`);
    for (let i = 0; i < 2; i += 1) await send(base, { path: target, headers: signedIn() });
    counts[name] = records.length;
  }
  expectEqual("a 404 is asked again", `${counts.axum}`, `${counts.next}`, `${counts.next} requests`);
}

async function view() {
  const path = (id) => `/api/memes/${id}/view`;
  const id = "11111111-1111-4111-8111-111111111111";
  const cases = [
    ["no origin", {}],
    ["the site's origin", { origin: site }],
    ["Next's own origin over https", { origin: nextOwn, "x-forwarded-proto": "https" }],
    ["https origin with https", { origin: nextOwn.replace("http:", "https:"), "x-forwarded-proto": "https" }],
    ["Next's own origin", { origin: nextOwn }],
  ];
  for (const [label, headers] of cases) {
    await compare(label, { method: "POST", path: path(id), headers: { ...headers, ...ip(ips++) } });
  }
  for (const bad of ["not-an-id", "11111111-1111-4111-8111-11111111111", "%31%31111111-1111-4111-8111-111111111111", "gggggggg-1111-4111-8111-111111111111"]) {
    await compare(`id ${bad}`, { method: "POST", path: path(bad), headers: { origin: nextOwn, ...ip(ips++) } });
  }
  // The 31st request of a minute, counted with /api/memes/view.
  const shared = ip(251);
  for (const [name, base] of [["next", nextBase], ["axum", axumBase]]) {
    for (let i = 0; i < 29; i += 1) await send(base, { method: "POST", path: "/api/memes/view", headers: shared, body: "{}" });
    const statuses = [];
    for (let i = 0; i < 2; i += 1) {
      const response = await send(base, { method: "POST", path: path(id), headers: { origin: nextOwn, ...shared } });
      statuses.push(`${response.status} ${response.headers["retry-after"] ? "retry-after" : "-"} ${response.body}`);
    }
    expectEqual(`${name}: 30th and 31st view of an address`, statuses.join("\n"),
      '400 - {"ok":false,"error":"view_not_recorded"}\n429 retry-after {"ok":false,"error":"rate_limited"}');
  }
}

async function methods() {
  for (const [method, target] of [["POST", "/api/oembed"], ["PUT", "/api/oembed"], ["GET", "/api/admin/source-ingestions"],
    ["DELETE", "/api/admin/source-ingestions"], ["GET", "/api/memes/11111111-1111-4111-8111-111111111111/view"],
    ["OPTIONS", "/api/memes/11111111-1111-4111-8111-111111111111/view"], ["PUT", "/api/cron/source-refresh"]]) {
    await compare(`${method} ${target}`, { method, path: target, headers: bearer });
  }
}

// `run` exits the process; leave the database as it was found.
process.on("exit", () => {
  psql("drop function if exists public.reserve_oembed_request()");
  reset();
});
await run({ oembed, ingest, refresh, cache, view, methods });
