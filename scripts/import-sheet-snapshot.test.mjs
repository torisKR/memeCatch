import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  importRows,
  loadSnapshotRows,
  normalizeConceptUrl,
  summarizeConceptLinks,
} from "./import-sheet-snapshot.mjs";

const MIGRATION = new URL("../db/migrations/20261117120000_sheet_snapshot_staging.sql", import.meta.url);

test("normalizes concept URLs without inferring identities", () => {
  assert.equal(normalizeConceptUrl("HTTP://WWW.Example.com/meme/one/?ref=sheet#part"), "example.com/meme/one");
  assert.equal(normalizeConceptUrl("https://example.com/meme/one"), "example.com/meme/one");
  assert.equal(normalizeConceptUrl("not a URL"), null);
});

test("preserves raw arrays and exact source tab/row identity for each record kind", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memecatch-sheet-import-"));
  const concept = ["MEME-00001", "2026", "name", ...Array(9).fill(""), "https://example.com/meme/one/"];
  await writeFile(join(directory, "year-2026.json"), JSON.stringify({
    tab: "2026",
    start: 42,
    rows: [concept],
  }));
  const loaded = await loadSnapshotRows(directory, "concept");
  assert.deepEqual(loaded.rows[0], {
    row_id: "MEME-00001",
    record_kind: "concept",
    source_tab: "2026",
    source_row: 42,
    raw_data: concept,
    concept_url: "https://example.com/meme/one/",
    concept_url_key: "example.com/meme/one",
  });
});

test("uses VID identity and ignores a different CONCEPT reference ID", async () => {
  const directory = await mkdtemp(join(tmpdir(), "memecatch-sheet-video-import-"));
  const video = Array(31).fill("");
  video[0] = "VID-00001";
  video[13] = "https://example.com/meme/one";
  video[21] = "CONCEPT-99999";
  video[30] = "수집 후보";
  await writeFile(join(directory, "unknown-2.json"), JSON.stringify({
    tab: "연도 미확인",
    start: 2,
    rows: [video],
  }));
  const loaded = await loadSnapshotRows(directory, "video");
  assert.equal(loaded.rows[0].row_id, "VID-00001");
  assert.equal(loaded.rows[0].source_tab, "연도 미확인");
  assert.equal(loaded.rows[0].source_row, 2);
  assert.equal(loaded.rows[0].raw_data[21], "CONCEPT-99999");
  assert.equal(Object.hasOwn(loaded.rows[0], "review_state"), false);
});

test("reports one-to-one, unmatched, and ambiguous URL keys without linking rows", () => {
  const concepts = [
    { row_id: "MEME-1", concept_url_key: "example.com/a" },
    { row_id: "MEME-2", concept_url_key: "example.com/b" },
    { row_id: "MEME-3", concept_url_key: "example.com/b" },
  ];
  const videos = [
    { row_id: "VID-1", concept_url_key: "example.com/a" },
    { row_id: "VID-2", concept_url_key: "example.com/b" },
    { row_id: "VID-3", concept_url_key: "example.com/c" },
  ];
  assert.deepEqual(summarizeConceptLinks(concepts, videos), {
    matched: 1,
    unmatched: 1,
    ambiguous: 1,
    matchedConcepts: 1,
  });
});

test("imports chunks inside one transaction and never sends review fields", async () => {
  const rows = Array.from({ length: 1001 }, (_, index) => ({
    row_id: `VID-${index}`,
    record_kind: "video",
    source_tab: "연도 미확인",
    source_row: index + 2,
    raw_data: [`VID-${index}`],
    concept_url: null,
    concept_url_key: null,
  }));
  let transactions = 0;
  const batches = [];
  const result = await importRows("sheet-id", rows, {
    transaction: async (run) => {
      transactions += 1;
      return run(async (sheetId, batch) => {
        assert.equal(sheetId, "sheet-id");
        assert.equal(batch.some((row) => Object.hasOwn(row, "review_state")), false);
        batches.push(batch.length);
        return { rows: [{ result: { received: batch.length, changed: batch.length, unchanged: 0, conflicts: 0 } }] };
      });
    },
  });
  assert.equal(transactions, 1);
  assert.deepEqual(batches, [500, 500, 1]);
  assert.deepEqual(result, { received: 1001, changed: 1001, unchanged: 0, conflicts: 0, batches: 3 });
});

test("migration is private, transactional, service-only, and leaves review columns out of re-import", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /^--[\s\S]*\nbegin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /create table private\.sheet_snapshot_rows/i);
  assert.match(sql, /alter table private\.sheet_snapshot_rows enable row level security/i);
  assert.match(sql, /revoke all on table private\.sheet_snapshot_rows[\s\S]*public, anon, authenticated, service_role/i);
  assert.match(sql, /grant execute on function public\.import_sheet_snapshot_rows\(text, jsonb\)[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /grant[^;]+(?:anon|authenticated)/i);
  const updateAssignments = sql.match(/on conflict \(sheet_id, row_id\) do update\s+set ([\s\S]*?)\s+where staged\.review_state/i)?.[1] ?? "";
  assert.ok(updateAssignments);
  assert.doesNotMatch(updateAssignments, /review_state|reviewed_by|reviewed_at|review_note/i);
  assert.match(sql, /for update of staged/i);
  assert.match(sql, /staged\.review_state = 'pending'[\s\S]*staged\.reviewed_by is null[\s\S]*staged\.reviewed_at is null[\s\S]*staged\.review_note is null/i);
  assert.match(sql, /'conflicts', v_conflicts/i);
});

test("standalone apply uses pg with one atomic service-role transaction", async () => {
  const source = await readFile(new URL("./import-sheet-snapshot.mjs", import.meta.url), "utf8");
  assert.match(source, /await import\("pg"\)/);
  assert.doesNotMatch(source, /kysely|lib\/db\/pool/i);
  assert.match(source, /await client\.query\("begin"\)/);
  assert.match(source, /await client\.query\("set local role service_role"\)/);
  assert.match(source, /select public\.import_sheet_snapshot_rows\(\$1, \$2::jsonb\)/);
  assert.match(source, /await client\.query\("commit"\)/);
  assert.match(source, /client\.query\("rollback"\)/);
  assert.match(source, /finally \{[\s\S]*await client\.end\(\)/);
});
