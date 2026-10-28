import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  importSourceCandidates,
  parseArgs,
  parseCandidateText,
  readBoundedInput,
} from "./import-source-candidates.mjs";

const MEME_ID = "11111111-1111-4111-8111-111111111111";
const TIKTOK_ID = "1234567890123456789";
const seed = {
  meme_id: MEME_ID,
  source_url: `https://www.tiktok.com/@creator/video/${TIKTOK_ID}`,
  note: "운영자 URL 제보",
  oembed_title: "must not persist",
  oembed_author_name: "must not persist",
};

function harness({ memeRows, identityRows = [], canonicalRows = [], insertedSource, linked = true } = {}) {
  const reads = [];
  const writes = [];
  const queues = [
    memeRows ?? [{
      id: MEME_ID,
      doc_class: "meme",
      moderation_status: "approved",
      category: "challenge",
      media_type: "video",
    }],
    identityRows,
    canonicalRows,
  ];
  const restAll = async (_rest, path) => {
    reads.push(path);
    return queues.shift() ?? [];
  };
  const rest = async (path, options = {}) => {
    const body = JSON.parse(options.body);
    writes.push({ path, options, body });
    if (path.startsWith("media_sources")) {
      return insertedSource === undefined
        ? [{
            id: "source-1",
            platform: "tiktok",
            external_id: TIKTOK_ID,
            canonical_url: seed.source_url,
          }]
        : insertedSource;
    }
    return linked ? [{ meme_id: MEME_ID, source_id: "source-1" }] : [];
  };
  return { rest, restAll, reads, writes };
}

test("CLI defaults to plan and execution requires one UUID-scoped candidate", () => {
  assert.deepEqual(parseArgs(["input.jsonl"]), {
    inputPath: "input.jsonl", execute: false, limit: 2, memeId: null,
  });
  assert.deepEqual(parseArgs(["input.jsonl", `--meme-id=${MEME_ID}`, "--limit=1"]), {
    inputPath: "input.jsonl", execute: false, limit: 1, memeId: MEME_ID,
  });
  assert.deepEqual(parseArgs(["input.jsonl", "--execute", "--limit=1", `--meme-id=${MEME_ID}`]), {
    inputPath: "input.jsonl", execute: true, limit: 1, memeId: MEME_ID,
  });
  for (const args of [
    [],
    ["a.jsonl", "b.jsonl"],
    ["input.jsonl", "--execute"],
    ["input.jsonl", "--execute", "--limit=2", `--meme-id=${MEME_ID}`],
    ["input.jsonl", "--limit=3"],
    ["input.jsonl", "--meme-id=terms"],
    ["input.jsonl", "--unknown"],
  ]) assert.throws(() => parseArgs(args));
});

test("JSONL parser bounds input and records malformed rows", () => {
  const parsed = parseCandidateText(`${JSON.stringify(seed)}\nnot-json\n[]\n`);
  assert.deepEqual(parsed, { rows: [seed], malformed: 2 });
  assert.throws(() => parseCandidateText("x".repeat(256 * 1024 + 1)));
  assert.throws(() => parseCandidateText("\n".repeat(1_001)));
});

test("file reader stops at the byte ceiling even if the file is larger", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memecatch-source-input-"));
  const input = join(directory, "candidates.jsonl");
  try {
    await writeFile(input, Buffer.alloc(256 * 1024 + 1, 120));
    assert.throws(() => readBoundedInput(input), /at most 262144 bytes/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("plan mode performs exact eligibility and duplicate reads without writes", async () => {
  const h = harness();
  const stats = await importSourceCandidates({
    ...h, seeds: [seed], execute: false, limit: 1, memeId: MEME_ID,
  });
  assert.equal(stats.mode, "plan");
  assert.equal(stats.wouldInsert, 1);
  assert.equal(stats.dbWrites, 0);
  assert.equal(stats.providerCalls, 0);
  assert.deepEqual(h.writes, []);
  assert.match(h.reads[0], new RegExp(`id=eq\\.${MEME_ID}`));
  assert.match(h.reads[0], /select=id,doc_class,moderation_status,category,media_type/);
});

test("missing, duplicate, event, phrase-term, non-video, and unreviewed documents fail closed", async () => {
  const eligible = {
    id: MEME_ID,
    doc_class: "meme",
    moderation_status: "approved",
    category: "challenge",
    media_type: "video",
  };
  for (const memeRows of [
    [],
    [eligible, eligible],
    [{ ...eligible, doc_class: "event" }],
    [{ ...eligible, category: "phrase" }],
    [{ ...eligible, media_type: "image" }],
    [{ ...eligible, moderation_status: "pending" }],
    [{ ...eligible, id: "22222222-2222-4222-8222-222222222222" }],
  ]) {
    const h = harness({ memeRows });
    const stats = await importSourceCandidates({
      ...h, seeds: [seed], execute: true, limit: 1, memeId: MEME_ID,
    });
    assert.equal(stats.ineligibleMeme, 1);
    assert.equal(stats.dbWrites, 0);
    assert.deepEqual(h.writes, []);
  }
});

test("reviewed challenge and dance video/embed documents pass the established media classification", async () => {
  for (const memeRows of [
    [{
      id: MEME_ID, doc_class: "meme", moderation_status: "approved",
      category: "challenge", media_type: "video",
    }],
    [{
      id: MEME_ID, doc_class: "meme", moderation_status: "limited",
      category: "dance", media_type: "embed",
    }],
  ]) {
    const h = harness({ memeRows });
    const stats = await importSourceCandidates({
      ...h, seeds: [seed], execute: false, limit: 1, memeId: MEME_ID,
    });
    assert.equal(stats.ineligibleMeme, 0);
    assert.equal(stats.wouldInsert, 1);
    assert.equal(stats.dbWrites, 0);
  }
});

test("mismatched meme IDs, unsupported platforms, and malformed URLs never write", async () => {
  const cases = [
    { ...seed, meme_id: "22222222-2222-4222-8222-222222222222" },
    { ...seed, source_url: "https://www.youtube.com/watch?v=abcdefghijk" },
    { ...seed, source_url: "https://evil.example/video/123" },
  ];
  for (const candidate of cases) {
    const h = harness();
    const stats = await importSourceCandidates({
      ...h, seeds: [candidate], execute: true, limit: 1, memeId: MEME_ID,
    });
    assert.equal(stats.invalid, 1);
    assert.equal(stats.dbWrites, 0);
    assert.deepEqual(h.writes, []);
  }
});

test("input and stored canonical identities are deduplicated without updates or links", async () => {
  const duplicateInput = harness();
  const inputStats = await importSourceCandidates({
    ...duplicateInput, seeds: [seed, { ...seed, source_url: `${seed.source_url}?utm_source=x` }],
    execute: false, limit: 2, memeId: MEME_ID,
  });
  assert.equal(inputStats.duplicateInput, 1);
  assert.equal(inputStats.wouldInsert, 1);
  assert.deepEqual(duplicateInput.writes, []);

  for (const stored of [
    { identityRows: [{ id: "existing", platform: "tiktok", external_id: TIKTOK_ID, canonical_url: seed.source_url }] },
    { canonicalRows: [{ id: "existing", platform: "tiktok", external_id: TIKTOK_ID, canonical_url: seed.source_url }] },
  ]) {
    const h = harness(stored);
    const stats = await importSourceCandidates({
      ...h, seeds: [seed], execute: true, limit: 1, memeId: MEME_ID,
    });
    assert.equal(stats.duplicateStored, 1);
    assert.equal(stats.dbWrites, 0);
    assert.deepEqual(h.writes, []);
  }
});

test("execute inserts raw identity then one pending unknown-rights usage link", async () => {
  const h = harness();
  const stats = await importSourceCandidates({
    ...h, seeds: [seed], execute: true, limit: 1, memeId: MEME_ID,
  });
  assert.equal(stats.inserted, 1);
  assert.equal(stats.linked, 1);
  assert.equal(stats.dbWrites, 2);
  assert.equal(stats.providerCalls, 0);
  assert.deepEqual(h.writes[0].body, {
    platform: "tiktok",
    external_id: TIKTOK_ID,
    canonical_url: seed.source_url,
  });
  assert.equal(h.writes[0].options.method, "POST");
  assert.deepEqual(h.writes[1].body, {
    meme_id: MEME_ID,
    source_id: "source-1",
    source_role: "usage_example",
    rights_basis: "unknown",
    review_state: "pending",
    reviewer_note: "운영자 URL 제보",
  });
  assert.equal(h.writes.some((write) => write.options.method === "PATCH"), false);
});

test("insert conflict does not reuse or update an existing source/link", async () => {
  const h = harness({ insertedSource: [] });
  const stats = await importSourceCandidates({
    ...h, seeds: [seed], execute: true, limit: 1, memeId: MEME_ID,
  });
  assert.equal(stats.inserted, 0);
  assert.equal(stats.linked, 0);
  assert.equal(stats.duplicateStored, 1);
  assert.equal(stats.dbWrites, 1);
  assert.equal(h.writes.length, 1);
});

test("direct execute gate rejects broad or unscoped calls before reads", async () => {
  const h = harness();
  await assert.rejects(() => importSourceCandidates({ ...h, seeds: [seed], execute: true, limit: 2, memeId: MEME_ID }));
  await assert.rejects(() => importSourceCandidates({ ...h, seeds: [seed], execute: true, limit: 1, memeId: null }));
  assert.deepEqual(h.reads, []);
  assert.deepEqual(h.writes, []);
});
