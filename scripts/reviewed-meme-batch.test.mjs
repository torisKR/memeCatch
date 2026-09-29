import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildReviewedBatchSql, validateReviewedBatch } from "./reviewed-meme-batch.mjs";

const NOW = new Date("2026-09-28T12:00:00.000Z");

function record(overrides = {}) {
  return {
    slug: "latest-example-meme",
    title: "예시 밈",
    aliases: ["예시 별칭"],
    summary: "이 밈이 쓰이는 맥락을 짧게 설명합니다.",
    description: "이 문장은 편집자가 확인한 밈의 뜻과 최근 확산 맥락을 설명합니다.",
    origin: "2026년 공개 게시물 두 건에서 사용 사례와 확산 시기를 확인했습니다.",
    usage_note: "친구 사이의 가벼운 대화에서 쓰이는 표현입니다.",
    caution: "특정 개인을 겨냥하거나 비하하는 맥락에서는 사용하지 않습니다.",
    category: "phrase",
    origin_year: 2026,
    meme_first_seen_year: 2026,
    revival_years: [],
    year_precision: "year",
    usage_examples: [{ situation: "친구 대화", text: "그 상황에 맞게 짧게 사용합니다." }],
    sources: [
      {
        url: "https://www.nytimes.com/2026/09/20/style/meme-story.html",
        title: "첫 번째 확인 자료",
        publisher: "Example News",
        published_on: "2026-09-20",
      },
      {
        url: "https://archive.org/details/example-post-123",
        title: "두 번째 확인 자료",
        publisher: "Example Archive",
        published_on: "2026-09-21",
      },
    ],
    review_note: "두 공개 자료에서 표현과 확산 맥락을 각각 확인했습니다.",
    ...overrides,
  };
}

function batch(records = [record()], overrides = {}) {
  return {
    batch_id: "community-market-2026-09-28",
    checked_at: "2026-09-28T11:00:00.000Z",
    records,
    ...overrides,
  };
}

test("accepts a reviewed text-only batch with two distinct public sources", () => {
  assert.deepEqual(validateReviewedBatch(batch(), { now: NOW }), []);
});

test("rejects malformed, future, or missing checked/source dates", () => {
  assert.ok(validateReviewedBatch(batch([], { checked_at: "yesterday" }), { now: NOW }).some((e) => e.includes("checked_at")));
  assert.ok(validateReviewedBatch(batch([], { checked_at: "2026-09-28T13:00:00Z" }), { now: NOW }).some((e) => e.includes("future")));
  const futureSources = [
    { ...record().sources[0], published_on: "2026-09-29" },
    record().sources[1],
  ];
  assert.ok(validateReviewedBatch(batch([record({ sources: futureSources })]), { now: NOW }).some((e) => e.includes("published_on")));
  const invalidSources = [
    { ...record().sources[0], published_on: "2026-02-30" },
    record().sources[1],
  ];
  assert.ok(validateReviewedBatch(batch([record({ sources: invalidSources })]), { now: NOW }).some((e) => e.includes("published_on")));
});

test("rejects source URLs that are not public HTTPS URLs", () => {
  for (const url of [
    "http://news.example.com/story",
    "https://user:pass@news.example.com/story",
    "https://localhost/story",
    "https://127.0.0.1/story",
    "https://news.example.com.evil.test/story",
  ]) {
    const sources = [...record().sources];
    sources[0] = { ...sources[0], url };
    assert.ok(validateReviewedBatch(batch([record({ sources })]), { now: NOW }).some((e) => e.includes("sources[0].url")), url);
  }
});

test("rejects repeated canonical source URLs, duplicate slugs, and normalized title/alias collisions", () => {
  const first = record();
  const second = record({
    slug: "different-slug",
    title: "별도 표제어",
    aliases: ["예시-밈!"],
  });
  assert.ok(validateReviewedBatch(batch([first, second]), { now: NOW }).some((e) => e.includes("normalized title/alias")));

  const duplicateUrlSources = [...record().sources];
  duplicateUrlSources[1] = { ...duplicateUrlSources[1], url: "https://www.nytimes.com/2026/09/20/style/meme-story.html/?utm_source=mail#top" };
  assert.ok(validateReviewedBatch(batch([record({ sources: duplicateUrlSources })]), { now: NOW }).some((e) => e.includes("canonical URL")));

  assert.ok(validateReviewedBatch(batch([first, record({ title: "다른 밈", slug: first.slug })]), { now: NOW }).some((e) => e.includes("duplicate slug")));
});

test("allows a shared multi-topic source across records while requiring two distinct sources per record", () => {
  const first = record();
  const secondSources = [
    first.sources[0],
    { ...first.sources[1], url: "https://www.bbc.com/culture/article/20260921-another-meme" },
  ];
  const second = record({
    slug: "second-topic-from-same-digest",
    title: "다른 주제 밈",
    aliases: ["두 번째 표현"],
    sources: secondSources,
  });
  assert.deepEqual(validateReviewedBatch(batch([first, second]), { now: NOW }), []);
});

test("rejects invalid enums, out-of-range years, unsafe shape, and fake media/score fields", () => {
  assert.ok(validateReviewedBatch(batch([record({ category: "meme_video" })]), { now: NOW }).some((e) => e.includes("category")));
  assert.ok(validateReviewedBatch(batch([record({ origin_year: 2200 })]), { now: NOW }).some((e) => e.includes("origin_year")));
  assert.ok(validateReviewedBatch(batch([record({ year_precision: "guess" })]), { now: NOW }).some((e) => e.includes("year_precision")));
  assert.ok(validateReviewedBatch(batch([record({ trend_score: 99 })]), { now: NOW }).some((e) => e.includes("unexpected field")));
  assert.ok(validateReviewedBatch(batch([record({ media_url: "https://cdn.example/image.jpg" })]), { now: NOW }).some((e) => e.includes("unexpected field")));
});

test("SQL is transactional, idempotent, and skips existing identities without modifying them", () => {
  const sql = buildReviewedBatchSql(batch(), { now: NOW });
  assert.match(sql, /^begin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /create temporary table[\s\S]*on commit drop/i);
  assert.match(sql, /on conflict\s*\(slug\)\s*do nothing/i);
  assert.match(sql, /where not exists\s*\([\s\S]*existing\.slug/i);
  assert.match(sql, /existing\.aliases/i);
  assert.match(sql, /normalize\(prior\.name, NFKC\)/i);
  assert.match(sql, /'pending'::public\.moderation_status/i);
  assert.match(sql, /'fact_checking'::public\.moderation_status/i);
  assert.match(sql, /'rights_checking'::public\.moderation_status/i);
  assert.match(sql, /'limited'::public\.moderation_status/i);
  assert.match(sql, /media_type,[\s\S]*'text'::public\.media_type/i);
  assert.match(sql, /input\.revival_years::smallint\[\]/i);
  assert.match(sql, /'pending'::public\.moderation_status, 'text'::public\.media_type, 0/i);
  assert.match(sql, /'active'::public\.lifecycle_status/i);
  assert.match(sql, /'yellow'::public\.safety_level/i);
  assert.match(sql, /editorial_review/i);
  assert.match(sql, /'unknown'::public\.copyright_status/i);
  assert.match(sql, /'secondary_reference'/i);
  assert.match(sql, /'link_only'/i);
  assert.match(sql, /now\(\)/i);
  assert.match(sql, /inserted_ids/i);
  assert.doesNotMatch(sql, /insert into public\.meme_contents/i);
  assert.doesNotMatch(sql, /insert into public\.meme_media/i);
  assert.doesNotMatch(sql, /delete from public\.memes/i);
});

test("SQL safely quotes apostrophes and dollar-delimiter payloads", () => {
  const payload = "Meme'); DROP TABLE public.memes; -- $batch$";
  const sql = buildReviewedBatchSql(batch([record({ title: payload })]), { now: NOW });
  assert.ok(sql.includes("'Meme''); DROP TABLE public.memes; -- $batch$'"));
  assert.equal((sql.match(/DROP TABLE/g) ?? []).length, 1);
  assert.doesNotMatch(sql, /^\$batch\$$/m);
});

test("SQL duplicate guard applies NFKC before comparing existing titles and aliases", () => {
  const sql = buildReviewedBatchSql(batch([record({ title: "Ａ Ｂ Ｃ", aliases: [] })]), { now: NOW });
  assert.match(sql, /array\['abc'\]::text\[\]/i);
  assert.match(sql, /lower\(normalize\(prior\.name, NFKC\)\)/i);
});

test("SQL builder rejects invalid batches with a clear validation error", () => {
  assert.throws(
    () => buildReviewedBatchSql(batch([record({ sources: [] })]), { now: NOW }),
    /Invalid reviewed meme batch:[\s\S]*at least 2 distinct sources/,
  );
});

test("CLI defaults to validation-only and --sql emits SQL without status text", () => {
  const directory = mkdtempSync(join(tmpdir(), "reviewed-meme-batch-"));
  try {
    const path = join(directory, "batch.json");
    writeFileSync(path, JSON.stringify(batch([record()], {
      checked_at: new Date(Date.now() - 60_000).toISOString(),
    })));
    const script = new URL("./reviewed-meme-batch.mjs", import.meta.url).pathname;
    const dryRun = spawnSync(process.execPath, [script, path], { encoding: "utf8" });
    assert.equal(dryRun.status, 0, dryRun.stderr);
    assert.deepEqual(JSON.parse(dryRun.stdout), {
      valid: true,
      mode: "dry-run",
      batch_id: "community-market-2026-09-28",
      records: 1,
      sources: 2,
      sql_emitted: false,
      database_connected: false,
    });

    const sqlRun = spawnSync(process.execPath, [script, path, "--sql"], { encoding: "utf8" });
    assert.equal(sqlRun.status, 0, sqlRun.stderr);
    assert.match(sqlRun.stdout, /^begin;/i);
    assert.match(sqlRun.stdout, /commit;\s*$/i);
    assert.doesNotMatch(sqlRun.stdout, /"valid"\s*:/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
