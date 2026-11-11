import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  auditSqlWrites,
  buildContentSql,
  existingViolationSql,
  planContentBatch,
} from "./ingest-meme-content.mjs";

const NOW = new Date("2026-11-10T12:00:00.000Z");
const REVIEWER = "00000000-0000-4000-8000-0000000000e1";

function meme(overrides = {}) {
  return {
    slug: "pending-example",
    title: "대기 예시",
    aliases: ["예시 별칭"],
    summary: "검수 전 초안의 짧은 설명입니다.",
    description: "이 문장은 초안 밈의 뜻과 맥락을 설명합니다.",
    origin: "2026년 공개 페이지에서 확인한 초안입니다.",
    category: "phrase",
    media_type: "text",
    safety_level: "yellow",
    lifecycle_status: "rising",
    moderation_status: "pending",
    origin_year: 2026,
    year_precision: "year",
    published_at: null,
    usage_context: { work: "yellow", friends: "yellow", family: "yellow", sns: "yellow" },
    ...overrides,
  };
}

function source(memeSlug, url, overrides = {}) {
  return {
    meme_slug: memeSlug,
    url,
    title: "확인 자료",
    publisher: "Example Archive",
    ...overrides,
  };
}

function translation(memeSlug, locale, overrides = {}) {
  return {
    meme_slug: memeSlug,
    locale,
    localized_slug: `${memeSlug}-${locale}`,
    title: `Title ${locale}`,
    summary: "Translated summary.",
    description: "Translated description.",
    origin: "Translated origin.",
    status: "machine",
    provider: "editorial",
    model: "human",
    ...overrides,
  };
}

function batch(overrides = {}) {
  return {
    batch_id: "content-test",
    checked_at: "2026-11-10T03:00:00.000Z",
    memes: [meme()],
    sources: [source("pending-example", "https://archive.org/details/pending-example")],
    ...overrides,
  };
}

function publicBatch(overrides = {}) {
  const slug = "public-example";
  return batch({
    memes: [meme({
      slug,
      title: "Public example",
      aliases: [],
      media_type: "text",
      moderation_status: "approved",
      lifecycle_status: "active",
      published_at: "2026-01-01T00:00:00.000Z",
    })],
    sources: [
      source(slug, "https://archive.org/details/public-example-a"),
      source(slug, "https://www.nytimes.com/2026/01/02/style/public-example.html"),
    ],
    translations: ["en", "ja", "zh", "zh-tw"].map((locale) => translation(slug, locale)),
    ...overrides,
  });
}

function reasons(plan, table, key) {
  return plan.actions.find((action) => action.table === table && action.key === key)?.reasons ?? [];
}

test("plans a pending meme with one public source and emits idempotent SQL", () => {
  const plan = planContentBatch(batch(), { now: NOW });
  assert.equal(plan.ok, true);
  assert.equal(plan.database_connected, false);
  assert.equal(plan.summary.memes.insert, 1);
  assert.equal(plan.summary.meme_sources.insert, 1);
  const sql = buildContentSql(batch(), { now: NOW });
  assert.match(sql, /^-- Idempotent meme content batch/);
  assert.match(sql, /begin;\n/);
  assert.match(sql, /commit;\n$/);
  assert.match(sql, /'pending'::public.moderation_status/);
  assert.match(sql, /'year', null/);
  assert.match(sql, /on conflict \(slug\) do nothing/);
  assert.match(sql, /'Web'/);
  assert.equal(auditSqlWrites(sql).every((word) => word === "insert"), true);
  assert.doesNotMatch(sql, /moderation_status = 'limited'/);
  assert.doesNotMatch(sql, /admin_audit_log/);
  assert.doesNotMatch(sql, /auth\.users/);
});

test("quotes apostrophes and does not walk a pending row to limited", () => {
  const input = batch({
    memes: [meme({ title: "don't stop", summary: "it's a quote" })],
  });
  const sql = buildContentSql(input, { now: NOW });
  assert.match(sql, /'don''t stop'/);
  assert.match(sql, /'it''s a quote'/);
  assert.doesNotMatch(sql, /\bupdate\b/i);
});

test("rejects missing fields, bad enums, and private URLs on that row only", () => {
  const input = batch({
    memes: [
      meme(),
      meme({ slug: "bad-row", category: "nope", moderation_status: "published", published_at: null }),
    ],
    sources: [
      source("pending-example", "https://archive.org/details/pending-example"),
      source("bad-row", "http://127.0.0.1/secret"),
      source("missing-meme", "https://archive.org/details/missing-meme"),
    ],
  });
  const plan = planContentBatch(input, { now: NOW });
  assert.equal(plan.summary.memes.insert, 1);
  assert.equal(plan.summary.memes.reject, 1);
  assert.match(reasons(plan, "memes", "bad-row").join("\n"), /category/);
  assert.match(plan.actions.filter((action) => action.table === "meme_sources" && action.action === "reject").map((action) => action.reasons.join(" ")).join("\n"), /not in this batch or the catalog/);
  const sql = buildContentSql(input, { now: NOW });
  assert.doesNotMatch(sql, /'bad-row'/);
  assert.match(sql, /'pending-example'/);
});

test("rejects in-batch normalized slug and title duplicates", () => {
  const input = batch({
    memes: [
      meme(),
      meme({ slug: "Pending-Example", title: "다른 제목", aliases: [] }),
      meme({ slug: "other-example", title: "대기 예시", aliases: [] }),
    ],
    sources: [
      source("pending-example", "https://archive.org/details/pending-example"),
      source("other-example", "https://archive.org/details/other-example"),
    ],
  });
  const plan = planContentBatch(input, { now: NOW });
  assert.match(reasons(plan, "memes", "Pending-Example").join("\n"), /must already be the normalized slug/);
  assert.match(reasons(plan, "memes", "other-example").join("\n"), /normalized title\/alias duplicates/);
  assert.equal(plan.summary.memes.insert, 1);
});

test("rejects catalog slug, title, and near-duplicate collisions", () => {
  const input = batch({
    memes: [
      meme({ slug: "italian-brainrot", title: "새 브레인롯", aliases: [] }),
      meme({ slug: "fresh-title", title: "Italian Brainrot", aliases: [] }),
      meme({ slug: "curated-dup", title: "따로 쓴 제목", aliases: [] }),
    ],
    sources: [
      source("italian-brainrot", "https://archive.org/details/italian-a"),
      source("fresh-title", "https://archive.org/details/italian-b"),
      source("curated-dup", "https://archive.org/details/curated-dup"),
    ],
    catalog: {
      memes: [
        { slug: "Italian-Brainrot", title: "Italian Brainrot", aliases: [] },
        { slug: "already-there", title: "이미 있는 밈", aliases: ["따로 쓴 제목"] },
      ],
      near_duplicates: [{ meme_slug: "curated-dup", existing_slug: "already-there", reason: "same joke" }],
    },
  });
  const plan = planContentBatch(input, { now: NOW });
  assert.match(reasons(plan, "memes", "italian-brainrot").join("\n"), /normalized slug duplicates/);
  assert.match(reasons(plan, "memes", "fresh-title").join("\n"), /normalized title\/alias duplicates/);
  assert.match(reasons(plan, "memes", "curated-dup").join("\n"), /near-duplicate of "already-there"/);
  assert.equal(plan.summary.memes.insert, 0);
});

test("keeps an existing slug as a skip and still rejects a null content url", () => {
  const input = batch({
    catalog: {
      memes: [{ slug: "pending-example", title: "대기 예시", aliases: ["예시 별칭"] }],
      sources: [{ meme_slug: "pending-example", url: "https://archive.org/details/pending-example" }],
    },
    contents: [{ meme_slug: "pending-example", url: null, type: "image", moderation_status: "pending", thumbnail_url: "/ai-memes/pending-example.jpg" }],
  });
  const plan = planContentBatch(input, { now: NOW });
  assert.equal(plan.summary.memes.skip_existing, 1);
  assert.equal(plan.summary.meme_sources.skip_existing, 1);
  assert.match(reasons(plan, "meme_contents", "pending-example\n0").join("\n"), /content url is required/);
  assert.doesNotMatch(buildContentSql(input, { now: NOW }), /insert into public\.memes/);
});

test("rejects status and published_at mismatches", () => {
  const approved = planContentBatch(batch({
    memes: [meme({ moderation_status: "approved", published_at: null, media_type: "text" })],
    sources: [
      source("pending-example", "https://archive.org/details/pending-example"),
      source("pending-example", "https://www.nytimes.com/2026/01/02/style/pending.html"),
    ],
    translations: ["en", "ja", "zh", "zh-tw"].map((locale) => translation("pending-example", locale)),
  }), { now: NOW });
  assert.match(reasons(approved, "memes", "pending-example").join("\n"), /approved\/limited requires published_at/);

  const rejected = planContentBatch(batch({
    memes: [meme({ moderation_status: "rejected", published_at: "2026-01-01T00:00:00.000Z" })],
  }), { now: NOW });
  assert.match(reasons(rejected, "memes", "pending-example").join("\n"), /cannot carry published_at/);

  const limited = planContentBatch(publicBatch({
    memes: [meme({
      slug: "public-example",
      title: "Public example",
      aliases: [],
      moderation_status: "limited",
      published_at: "2026-01-01T00:00:00.000Z",
      media_type: "text",
    })],
  }), { now: NOW });
  assert.equal(limited.summary.memes.insert, 1);
});

test("rejects a public image or video with neither contents nor media", () => {
  const input = publicBatch({
    memes: [meme({
      slug: "public-example",
      title: "Public example",
      aliases: [],
      media_type: "video",
      moderation_status: "approved",
      published_at: "2026-01-01T00:00:00.000Z",
    })],
  });
  const plan = planContentBatch(input, { now: NOW });
  assert.match(reasons(plan, "memes", "public-example").join("\n"), /requires contents or media/);
  assert.equal(plan.summary.meme_translations.insert, 0);
});

test("accepts a public video when either contents or media is present", () => {
  const slug = "public-example";
  const base = {
    slug,
    title: "Public example",
    aliases: [],
    media_type: "video",
    moderation_status: "approved",
    published_at: "2026-01-01T00:00:00.000Z",
  };
  const withContent = planContentBatch(publicBatch({
    memes: [meme(base)],
    contents: [{ meme_slug: slug, url: "https://www.youtube.com/watch?v=abcdefghijk", type: "video", moderation_status: "approved" }],
  }), { now: NOW });
  assert.equal(withContent.summary.memes.insert, 1);
  assert.equal(withContent.summary.meme_contents.insert, 1);

  const withMedia = planContentBatch(publicBatch({
    memes: [meme(base)],
    media: [{ meme_slug: slug, canonical_url: "https://www.youtube.com/watch?v=abcdefghijk", platform: "youtube" }],
  }), { now: NOW });
  assert.equal(withMedia.summary.memes.insert, 1);
  assert.equal(withMedia.summary.media_sources.insert, 1);
  assert.equal(withMedia.summary.meme_media.insert, 1);
});

test("warns when a pending video has no asset and no translations", () => {
  const plan = planContentBatch(batch({
    memes: [meme({ media_type: "video", category: "challenge" })],
  }), { now: NOW });
  assert.equal(plan.summary.memes.insert, 1);
  assert.match(plan.warnings.join("\n"), /no contents and no media/);
  assert.match(plan.warnings.join("\n"), /missing translations: en, ja, zh, zh-tw/);
});

test("rejects a public meme that is missing a locale and a localized_slug collision", () => {
  const missing = planContentBatch(publicBatch({
    translations: ["en", "ja", "zh"].map((locale) => translation("public-example", locale)),
  }), { now: NOW });
  assert.match(reasons(missing, "memes", "public-example").join("\n"), /missing translations: zh-tw/);

  const collision = planContentBatch(publicBatch({
    catalog: {
      translations: [{ meme_slug: "other-meme", locale: "en", localized_slug: "public-example-en" }],
      reviewers: [REVIEWER],
    },
  }), { now: NOW });
  assert.match(reasons(collision, "meme_translations", "public-example\nen").join("\n"), /localized_slug collides/);
  assert.match(reasons(collision, "memes", "public-example").join("\n"), /missing translations: en/);
});

test("rejects reviewed translations without a catalog reviewer and unknown tags", () => {
  const input = batch({
    translations: [translation("pending-example", "en", { status: "reviewed" })],
    tag_links: [{ meme_slug: "pending-example", tag_name: "없는태그" }],
  });
  const plan = planContentBatch(input, { now: NOW });
  assert.match(reasons(plan, "meme_translations", "pending-example\n0").join("\n"), /catalog reviewer uuid/);
  assert.match(plan.actions.filter((action) => action.table === "meme_tags_map").map((action) => action.reasons.join(" ")).join("\n"), /unknown tag/);

  const reviewed = planContentBatch(batch({
    translations: [translation("pending-example", "en", { status: "reviewed", reviewed_by: REVIEWER })],
    tags: [{ name: "챌린지", type: "topic" }],
    tag_links: [{ meme_slug: "pending-example", tag_name: "챌린지" }],
    catalog: { reviewers: [REVIEWER] },
  }), { now: NOW });
  assert.equal(reviewed.summary.meme_translations.insert, 1);
  assert.equal(reviewed.summary.tags.insert, 1);
  assert.equal(reviewed.summary.meme_tags_map.insert, 1);
  const sql = buildContentSql(batch({
    translations: [translation("pending-example", "en", { status: "reviewed", reviewed_by: REVIEWER })],
    catalog: { reviewers: [REVIEWER] },
  }), { now: NOW });
  assert.match(sql, new RegExp(REVIEWER));
  assert.doesNotMatch(sql, /00000000-0000-0000-0000-00000000e0e0/);
});

test("requires two sources before a public meme can be inserted", () => {
  const plan = planContentBatch(publicBatch({
    sources: [source("public-example", "https://archive.org/details/only-one")],
  }), { now: NOW });
  assert.match(reasons(plan, "memes", "public-example").join("\n"), /at least 2 distinct sources/);
});

test("rejects house originals that are inserted already published", () => {
  const plan = planContentBatch(batch({
    memes: [meme({ origin_kind: "house_original", moderation_status: "approved", published_at: "2026-01-01T00:00:00.000Z" })],
  }), { now: NOW });
  assert.match(reasons(plan, "memes", "pending-example").join("\n"), /house_original can only be inserted as pending/);
});

test("audit listing is a single read-only select covering each ingest rule", () => {
  const sql = existingViolationSql();
  assert.deepEqual(auditSqlWrites(sql), []);
  for (const rule of [
    "approved_missing_published_at",
    "unpublished_status_has_published_at",
    "public_media_missing_contents_and_media",
    "public_text_missing_contents_and_media",
    "null_content_url",
    "normalized_slug_duplicate",
    "normalized_title_duplicate",
    "localized_slug_collision",
    "missing_translation",
  ]) {
    assert.match(sql, new RegExp(rule));
  }
  assert.match(sql, /order by rule, slug, detail, entity_id/);
  assert.doesNotMatch(sql, /limited \+ published_at is schema-consistent[\s\S]*where m\.moderation_status = 'limited'/);
});

test("the loop-026 batch inserts only 무마가가이 and matches the committed SQL", () => {
  const file = new URL("../data/editorial/2026-11-10-loop026-pending.json", import.meta.url);
  const input = JSON.parse(readFileSync(file, "utf8"));
  const plan = planContentBatch(input, { now: NOW });
  assert.deepEqual(plan.summary.memes, { insert: 1, skip_existing: 1, reject: 5 });
  assert.deepEqual(plan.summary.meme_sources, { insert: 1, skip_existing: 1, reject: 5 });
  assert.equal(plan.actions.find((action) => action.table === "memes" && action.action === "insert")?.key, "무마가가이");
  assert.match(plan.warnings.join("\n"), /무마가가이: pending video has no contents and no media/);
  const sql = buildContentSql(input, { now: NOW });
  const committed = readFileSync(new URL("../data/memes/sql/20261110-moomagagai-pending.sql", import.meta.url), "utf8");
  assert.equal(committed, sql);
  const listing = readFileSync(new URL("../data/memes/sql/20261110-existing-integrity-listing.sql", import.meta.url), "utf8");
  assert.equal(listing, existingViolationSql());
});

test("the loop-027 batch inserts 15 pending memes and matches the committed SQL", () => {
  const file = new URL("../data/editorial/2026-11-11-loop027-pending.json", import.meta.url);
  const input = JSON.parse(readFileSync(file, "utf8"));
  const now = new Date("2026-11-11T12:00:00.000Z");
  const plan = planContentBatch(input, { now });
  assert.equal(plan.ok, true);
  assert.deepEqual(plan.summary.memes, { insert: 15, skip_existing: 0, reject: 0 });
  assert.deepEqual(plan.summary.meme_sources, { insert: 49, skip_existing: 0, reject: 0 });
  for (const meme of input.memes) {
    assert.equal(meme.moderation_status, "pending");
    assert.equal(meme.published_at, null);
    const urls = new Set(input.sources.filter((source) => source.meme_slug === meme.slug).map((source) => source.url));
    assert.ok(urls.size >= 2, `${meme.slug} needs at least 2 distinct sources`);
  }
  const sql = buildContentSql(input, { now });
  const committed = readFileSync(new URL("../data/memes/sql/20261111-loop027-trending-pending.sql", import.meta.url), "utf8");
  assert.equal(committed, sql);
  assert.doesNotMatch(sql, /moderation_status = 'approved'|'approved'::public\.moderation_status|'limited'::public\.moderation_status/);
});

test("CLI dry-run never connects and prints the plan", () => {
  const directory = mkdtempSync(join(tmpdir(), "ingest-"));
  const inputPath = join(directory, "batch.json");
  writeFileSync(inputPath, JSON.stringify(batch()));
  const result = spawnSync(process.execPath, ["scripts/ingest-meme-content.mjs", inputPath], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.database_connected, false);
  assert.equal(plan.summary.memes.insert, 1);
  assert.equal(plan._actions, undefined);
  rmSync(directory, { recursive: true, force: true });
});
