#!/usr/bin/env node
// The radar after a signal is collected (PLAN.md D3), Axum against the
// TypeScript it ports. The TypeScript never stored a signal (R8-1: no
// connector set `rawExpiresAt`), so the reference is its own functions with
// that one value supplied: `createConfiguredRadarConnectors()` with each
// signal's `rawExpiresAt` set to `attemptedAt` + 30 days, then
// `runRadarPulse` with `createRadarRepository(createAdminClient())`, after
// `compute_trend_scores` as `runTrendPulse` runs it. Axum runs
// `GET /api/cron/trend-pulse`. Both reach the same recording stub for X,
// Threads and Instagram (radar-intercept.mjs, AXUM_TEST_RADAR_ORIGIN): no
// provider is called. For each side the database is put in the same state,
// two rounds run (the second with new posts, so a meme changes state), and
// after each round the radar's answer and the rows it left are compared.
//
//   (cd server && cargo build)
//   DATABASE_URL=<scripts/test-db.sh up> TEST_DB_CONTAINER=<its container> \
//     node --no-warnings --import ./scripts/register-ts-paths.mjs \
//       server/parity/radar-pipeline.mjs [--axum-bin=server/target/debug/memecatch-server] [--show]
//
// Throwaway database only: it empties connector_health and rewrites the
// memes whose slug starts with `d3-radar-`. Needs the migration
// 20261124100000 (X's key, R8-2) on that database.
import { execFileSync, spawn } from "node:child_process";
import http from "node:http";
import { once } from "node:events";

const container = process.env.TEST_DB_CONTAINER ?? "memecatch-axum-test-pg";
const axumBin =
  process.argv.find((arg) => arg.startsWith("--axum-bin="))?.slice("--axum-bin=".length) ??
  "server/target/debug/memecatch-server";
if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (server/scripts/test-db.sh up)");
  process.exit(2);
}

const RADAR_ENV = {
  RADAR_X_TERMS: "d3",
  X_API_BEARER_TOKEN: "x-token",
  RADAR_THREADS_TERMS: "d3밈",
  THREADS_ACCESS_TOKEN: "threads-token",
  RADAR_INSTAGRAM_HASHTAGS: "d3냥이춤",
  META_INSTAGRAM_ACCESS_TOKEN: "ig-token",
  META_INSTAGRAM_USER_ID: "ig-user",
};
Object.assign(process.env, RADAR_ENV, { BETTER_AUTH_SECRET: "parity-only-auth-secret" });

let failures = 0;
function check(label, axum, typescript) {
  const [a, t] = [JSON.stringify(axum, null, 2), JSON.stringify(typescript, null, 2)];
  if (a === t) {
    console.log(`ok    ${label}`);
    return;
  }
  failures += 1;
  console.log(`DIFF  ${label}\n--- axum\n${a}\n--- typescript\n${t}`);
}

function psql(sql) {
  return execFileSync(
    "docker",
    ["exec", "-i", container, "psql", "-U", "postgres", "-d", "memecatch", "-v", "ON_ERROR_STOP=1", "-X", "-q", "-At"],
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  ).trim();
}

// Times: tomorrow (age 0, so the heat does not depend on when a side runs)
// and four days ago (past the 48-hour window: no heat).
const base = Math.floor(Date.now() / 1000) * 1000 + 86_400_000;
const at = (minutes) => new Date(base + minutes * 60_000).toISOString();
const ago = new Date(base - 4 * 86_400_000).toISOString();
const graphTime = (minutes) => at(minutes).replace(/\.000Z$/u, "+0000");

const ROUNDS = [
  {
    x: {
      data: [
        { id: "d3x1", text: "an older copy", created_at: at(0), lang: "ko" },
        { id: "d3x2", text: "zz d3멍멍 zz", created_at: at(0), lang: "ko" },
        { id: "d3x3", text: "d3숨은밈", created_at: at(0), lang: "ko" },
        { id: "d3x4", text: "#d3냥냥 최고", created_at: at(0) },
        { id: "d3x5", text: "d3야옹", created_at: ago, lang: "ko" },
        { id: "d3x1", text: "d3냥이춤", created_at: at(0), lang: "ko" },
        { id: "d3x6", text: "nothing to see", created_at: at(0), lang: "en" },
      ],
      meta: { newest_id: "d3x6" },
    },
    threads: {
      data: [
        { id: "d3t1", text: "오늘 d3 야옹이 봤다", media_type: "TEXT_POST", permalink: "https://www.threads.com/@a/post/d3t1", timestamp: graphTime(0) },
        { id: "d3t2", text: "d3냥이춤", media_type: "TEXT", permalink: "https://www.threads.com/@a/post/d3t2", timestamp: graphTime(0) },
        { id: "d3t9", text: "an image", media_type: "IMAGE", permalink: "https://www.threads.com/@a/post/d3t9", timestamp: graphTime(0) },
      ],
    },
    instagram: {
      data: [
        { id: "d3i1", caption: "보세요 #d3냥이춤", media_type: "IMAGE", permalink: "https://www.instagram.com/p/d3i1/", timestamp: graphTime(1), like_count: 10, comments_count: 2 },
        { id: "d3i2", media_type: "VIDEO", permalink: "https://www.instagram.com/p/d3i2/", timestamp: graphTime(1), like_count: 5000 },
      ],
    },
  },
  {
    x: {
      data: [{ id: "d3x7", text: "d3냥이춤!!", created_at: at(2), lang: "ko" }],
      meta: { newest_id: "d3x7" },
    },
    threads: {
      data: [
        { id: "d3t2", text: "d3냥이춤", media_type: "TEXT", permalink: "https://www.threads.com/@a/post/d3t2", timestamp: graphTime(0) },
        { id: "d3t3", text: "#d3냥이춤 again", media_type: "TEXT", permalink: "https://www.threads.com/@a/post/d3t3", timestamp: graphTime(3) },
      ],
    },
    instagram: { data: [] },
  },
];

let round = ROUNDS[0];
const received = [];
const stub = http.createServer((request, response) => {
  const url = new URL(request.url, "http://stub");
  received.push(`${request.method} ${url.pathname}${url.search}`);
  const answers = {
    "/api.x.com/2/tweets/search/recent": round.x,
    "/graph.threads.com/v1.0/keyword_search": round.threads,
    "/graph.facebook.com/v26.0/ig_hashtag_search": { data: [{ id: "d3tag" }] },
    "/graph.facebook.com/v26.0/d3tag/recent_media": round.instagram,
  };
  const answer = answers[url.pathname];
  response.writeHead(answer ? 200 : 404, { "content-type": "application/json" });
  response.end(answer ? JSON.stringify(answer) : "");
});
stub.listen(0, "127.0.0.1");
await once(stub, "listening");
const stubOrigin = `http://127.0.0.1:${stub.address().port}`;
await import(`./radar-intercept.mjs?origin=${encodeURIComponent(stubOrigin)}`);

function reset() {
  psql(`
    delete from public.radar_meme_state where meme_id in (select id from public.memes where slug like 'd3-radar-%');
    delete from public.memes where slug like 'd3-radar-%';
    delete from public.external_signals where platform_content_id like 'd3%';
    delete from public.connector_health;
    insert into public.memes (title, slug, aliases, moderation_status, lifecycle_status) values
      ('d3냥이춤', 'd3-radar-a', '{d3냥냥}', 'approved', 'active'),
      ('d3멍멍', 'd3-radar-b', '{}', 'approved', 'active'),
      ('d3숨은밈', 'd3-radar-c', '{}', 'pending', 'active'),
      ('d3야옹', 'd3-radar-d', '{"d3 야옹이"}', 'limited', 'rising');
    -- A radar state from an earlier observation, so the run reads it.
    select public.record_radar_trend_observation(
      (select id from public.memes where slug = 'd3-radar-d'), null,
      '${new Date(base - 5 * 86_400_000).toISOString()}', 50, 0.5, 'rising', 'seed', '{}', 2);
  `);
}

/** The radar's rows, with ids as slugs and platform:content ids, and the
 * times the run takes from its own clock as their relation to it. */
function rows() {
  const signal = (column) =>
    `(select s.platform || ':' || s.platform_content_id from public.external_signals s where s.id = ${column})`;
  const query = (sql) => JSON.parse(psql(`select coalesce(json_agg(r), '[]') from (${sql}) r`));
  return {
    signals: query(`select platform, connector_key, platform_content_id, signal_kind, canonical_url, query_seed,
        text, hashtags, published_at, observed_at, first_seen_at = observed_at as first_seen,
        last_seen_at = observed_at as last_seen, metrics_json, language, language_confidence,
        korean_relevance, normalized_text_hash, ingestion_version, rights_mode, payload,
        (raw_expires_at - collected_at)::text as raw_retention,
        collected_at = (select h.last_checked_at from public.connector_health h where h.connector_key = s.platform) as collected_at_run,
        availability_status
      from public.external_signals s where platform_content_id like 'd3%' order by platform, platform_content_id`),
    links: query(`select m.slug, ${signal("l.signal_id")} as signal, l.match_method, l.match_confidence,
        l.review_state, l.reviewed_by, l.reviewed_at is not null as reviewed
      from public.meme_signal_links l join public.memes m on m.id = l.meme_id
      where m.slug like 'd3-radar-%' order by 1, 2`),
    observations: query(`select m.slug, ${signal("o.signal_id")} as signal, o.observed_at, o.heat_score,
        o.confidence, o.recommended_state, o.model_version, o.factors
      from public.radar_trend_observations o join public.memes m on m.id = o.meme_id
      where m.slug like 'd3-radar-%' and o.model_version = 'radar_v1' order by 1, 3`),
    states: query(`select m.slug, m.lifecycle_status, r.current_state, r.candidate_state, r.candidate_observations,
        r.required_observations, r.heat_score, r.confidence, ${signal("o.signal_id")} as last_signal,
        r.state_changed_at = r.observed_at as changed_now, r.observed_at
      from public.radar_meme_state r join public.memes m on m.id = r.meme_id
      join public.radar_trend_observations o on o.id = r.last_observation_id
      where m.slug like 'd3-radar-%' order by 1`),
    history: query(`select m.slug, h.old_state, h.new_state, h.heat_score, h.confidence, h.reason, h.changed_at,
        ${signal("o.signal_id")} as signal
      from public.meme_state_history h join public.memes m on m.id = h.meme_id
      left join public.radar_trend_observations o on o.id = h.observation_id
      where m.slug like 'd3-radar-%' order by 1, h.changed_at`),
    outbox: query(`select m.slug, n.topic, n.channel, n.status, n.payload - 'history_id' - 'meme_id' as payload
      from public.notification_outbox n join public.memes m on m.id = n.meme_id
      where m.slug like 'd3-radar-%' order by 1, n.created_at`),
    safety: query(`select m.slug, q.proposed_level, q.reason, q.evidence, q.status
      from public.safety_review_queue q join public.memes m on m.id = q.meme_id
      where m.slug like 'd3-radar-%' order by 1`),
    health: query(`select connector_key, status, consecutive_failures, latency_ms, last_error,
        cursor_state - 'attempted_at' - 'succeeded_at' - 'failed_at' as cursor_state,
        last_success_at = last_checked_at as succeeded_now
      from public.connector_health order by 1`),
  };
}

async function typescriptSide() {
  const { createAdminClient } = await import("../../lib/db/admin.ts");
  const { createConfiguredRadarConnectors } = await import("../../lib/trend/radar-platform-connectors.server.ts");
  const { runRadarPulse } = await import("../../lib/trend/radar-pulse.server.ts");
  const { createRadarRepository } = await import("../../lib/trend/radar-repository.server.ts");
  const admin = createAdminClient();
  const results = [];
  for (const data of ROUNDS) {
    round = data;
    received.length = 0;
    const { error } = await admin.rpc("compute_trend_scores");
    if (error) throw new Error(`compute_trend_scores: ${error.message}`);
    // The one value the TypeScript left out (R8-1).
    const connectors = Object.fromEntries(
      Object.entries(createConfiguredRadarConnectors()).map(([platform, connector]) => [
        platform,
        {
          platform,
          async collect(context) {
            const collected = await connector.collect(context);
            const rawExpiresAt = new Date(Date.parse(context.attemptedAt) + 30 * 86_400_000).toISOString();
            return { ...collected, signals: collected.signals.map((signal) => ({ ...signal, rawExpiresAt })) };
          },
        },
      ]),
    );
    const radar = await runRadarPulse({ connectors, repository: createRadarRepository(admin) });
    results.push({ radar, requests: [...received].sort(), rows: rows() });
  }
  return results;
}

async function axumSide() {
  const port = 6000 + Math.floor(Math.random() * 1000);
  const child = spawn(axumBin, [], {
    env: {
      PATH: process.env.PATH,
      DATABASE_URL: process.env.DATABASE_URL,
      BETTER_AUTH_SECRET: "parity-only-auth-secret",
      CRON_SECRET: "parity-only-cron-secret",
      AXUM_NO_UPSTREAM: "true",
      NODE_ENV: "development",
      NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
      PORT: String(port),
      AXUM_TEST_RADAR_ORIGIN: stubOrigin,
      ...RADAR_ENV,
    },
    stdio: ["ignore", "ignore", "inherit"],
  });
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let tries = 0; ; tries += 1) {
      try {
        if ((await fetch(`${base}/api/health`)).ok) break;
      } catch {
        // not up yet
      }
      if (tries > 120) throw new Error("Axum did not start");
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const results = [];
    for (const data of ROUNDS) {
      round = data;
      received.length = 0;
      const response = await fetch(`${base}/api/cron/trend-pulse`, {
        headers: { authorization: "Bearer parity-only-cron-secret" },
      });
      const body = await response.json();
      results.push({ radar: body.radar, requests: [...received].sort(), rows: rows() });
    }
    return results;
  } finally {
    child.kill();
    await once(child, "exit");
  }
}

reset();
const typescript = await typescriptSide();
reset();
const axum = await axumSide();
for (const [index, ts] of typescript.entries()) {
  const label = `round ${index + 1}`;
  if (process.argv.includes("--show")) console.log(label, JSON.stringify(ts, null, 1));
  const rs = axum[index];
  check(`${label} radar result`, rs.radar, ts.radar);
  check(`${label} provider requests`, rs.requests, ts.requests);
  for (const table of Object.keys(ts.rows)) {
    check(`${label} ${table} (${ts.rows[table].length} rows)`, rs.rows[table], ts.rows[table]);
  }
}
reset();
psql("delete from public.memes where slug like 'd3-radar-%'; delete from public.connector_health;");
stub.close();
console.log(failures ? `${failures} differ` : "all equal");
process.exit(failures ? 1 : 0);
