import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { promisify } from "node:util";
import {
  importRows,
  loadSnapshotRows,
  normalizeConceptUrl,
  summarizeConceptLinks,
} from "./import-sheet-snapshot.mjs";

const MIGRATION = new URL("../db/migrations/20261117120000_sheet_snapshot_staging.sql", import.meta.url);
const execFileAsync = promisify(execFile);

async function availablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const { port } = address;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function hasCommand(command) {
  try {
    await execFileAsync(command, ["--version"]);
    return true;
  } catch {
    return false;
  }
}

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
        return { rows: [{ result: {
          received: batch.length,
          changed: batch.length,
          unchanged: 0,
          conflicts: 0,
          conflict_revisions_created: 0,
        } }] };
      });
    },
  });
  assert.equal(transactions, 1);
  assert.deepEqual(batches, [500, 500, 1]);
  assert.deepEqual(result, {
    received: 1001,
    changed: 1001,
    unchanged: 0,
    conflicts: 0,
    conflictRevisionsCreated: 0,
    batches: 3,
  });
});

test("migration is private, transactional, service-only, and leaves review columns out of re-import", async () => {
  const sql = await readFile(MIGRATION, "utf8");
  assert.match(sql, /^--[\s\S]*\nbegin;/i);
  assert.match(sql, /commit;\s*$/i);
  assert.match(sql, /create table private\.sheet_snapshot_rows/i);
  assert.match(sql, /create table private\.sheet_snapshot_row_revisions/i);
  assert.match(sql, /alter table private\.sheet_snapshot_rows enable row level security/i);
  assert.match(sql, /alter table private\.sheet_snapshot_row_revisions enable row level security/i);
  assert.match(sql, /revoke all on table private\.sheet_snapshot_rows[\s\S]*public, anon, authenticated, service_role/i);
  assert.match(sql, /grant execute on function public\.import_sheet_snapshot_rows\(text, jsonb\)[\s\S]*to service_role/i);
  assert.match(sql, /revoke all on table private\.sheet_snapshot_row_revisions[\s\S]*public, anon, authenticated, service_role/i);
  assert.match(sql, /grant select, insert, update on table private\.sheet_snapshot_row_revisions[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /grant[^;]+(?:anon|authenticated)/i);
  const updateAssignments = sql.match(/on conflict \(sheet_id, row_id\) do update\s+set ([\s\S]*?)\s+where staged\.review_state/i)?.[1] ?? "";
  assert.ok(updateAssignments);
  assert.doesNotMatch(updateAssignments, /review_state|reviewed_by|reviewed_at|review_note/i);
  assert.match(sql, /for update of staged/i);
  assert.match(sql, /staged\.review_state = 'pending'[\s\S]*staged\.reviewed_by is null[\s\S]*staged\.reviewed_at is null[\s\S]*staged\.review_note is null/i);
  assert.match(sql, /'conflicts', v_conflicts/i);
  assert.match(sql, /sha256\(convert_to\(jsonb_build_object\([\s\S]*'UTF8'\)\)/i);
  assert.doesNotMatch(sql, /extensions\.digest|create extension/i);
  assert.match(sql, /'sheet_id', v_sheet_id[\s\S]*'source_tab'[\s\S]*'source_row'[\s\S]*'raw_data'[\s\S]*'concept_url_key'/i);
  assert.match(sql, /insert into private\.sheet_snapshot_row_revisions[\s\S]*'pending'[\s\S]*on conflict \(sheet_id, row_id, revision_id\) do nothing/i);
  assert.match(sql, /'conflict_revisions_created', v_conflict_revisions_created/i);
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

test("isolated PostgreSQL preserves reviewed originals and stages deterministic pending conflict revisions", {
  skip: !(await hasCommand("initdb")) || !(await hasCommand("pg_ctl")),
  timeout: 30_000,
}, async (t) => {
  const root = await mkdtemp(join(tmpdir(), "memecatch-sheet-pg-test-"));
  const data = join(root, "data");
  const socket = join(root, "socket");
  const logfile = join(root, "postgres.log");
  const port = await availablePort();
  await execFileAsync("mkdir", [socket]);
  await execFileAsync("initdb", [
    "-D", data,
    "-U", "postgres",
    "-A", "trust",
    "--no-locale",
    "--encoding=UTF8",
  ]);
  await execFileAsync("pg_ctl", [
    "-D", data,
    "-o", `-F -p ${port} -k ${socket} -c listen_addresses=''`,
    "-l", logfile,
    "-w",
    "start",
  ]);
  let client;
  t.after(async () => {
    await client?.end().catch(() => undefined);
    await execFileAsync("pg_ctl", ["-D", data, "-m", "immediate", "-w", "stop"]).catch(() => undefined);
  });
  const { default: pg } = await import("pg");
  client = new pg.Client({ host: socket, port, user: "postgres", database: "postgres" });
  await client.connect();

  const version = await client.query("show server_version_num");
  assert.ok(Number(version.rows[0].server_version_num) >= 150000);

  await client.query(`
    create role anon noinherit;
    create role authenticated noinherit;
    create role service_role noinherit bypassrls;
    create schema private;
    grant usage on schema private to service_role;
  `);
  await client.query(await readFile(MIGRATION, "utf8"));

  const conceptOriginal = {
    row_id: "MEME-00001",
    record_kind: "concept",
    source_tab: "2026",
    source_row: 42,
    raw_data: ["MEME-00001", "original"],
    concept_url: "https://example.com/meme/original",
    concept_url_key: "example.com/meme/original",
  };
  const videoOriginal = {
    row_id: "VID-00001",
    record_kind: "video",
    source_tab: "연도 미확인",
    source_row: 2,
    raw_data: ["VID-00001", "video"],
    concept_url: "https://example.com/meme/original",
    concept_url_key: "example.com/meme/original",
  };

  await client.query("begin");
  await client.query("set local role service_role");
  const conceptInitial = await client.query(
    "select public.import_sheet_snapshot_rows($1, $2::jsonb) as result",
    ["concept-sheet", JSON.stringify([conceptOriginal])],
  );
  const videoInitial = await client.query(
    "select public.import_sheet_snapshot_rows($1, $2::jsonb) as result",
    ["video-sheet", JSON.stringify([videoOriginal])],
  );
  await client.query("commit");
  assert.deepEqual(conceptInitial.rows[0].result, {
    received: 1,
    changed: 1,
    unchanged: 0,
    conflicts: 0,
    conflict_revisions_created: 0,
  });
  assert.deepEqual(videoInitial.rows[0].result, conceptInitial.rows[0].result);

  await client.query(`
    set role service_role;
    update private.sheet_snapshot_rows
       set review_state = 'approved',
           review_note = 'manual decision'
     where sheet_id = 'concept-sheet' and row_id = 'MEME-00001';
    reset role;
  `);

  const changed = {
    ...conceptOriginal,
    source_tab: "2026 정정",
    source_row: 84,
    raw_data: ["MEME-00001", "corrected", { complete: true }],
    concept_url: "https://example.com/meme/corrected",
    concept_url_key: "example.com/meme/corrected",
  };
  const importChanged = async (row) => {
    await client.query("begin");
    await client.query("set local role service_role");
    const result = await client.query(
      "select public.import_sheet_snapshot_rows($1, $2::jsonb) as result",
      ["concept-sheet", JSON.stringify([row])],
    );
    await client.query("commit");
    return result.rows[0].result;
  };

  assert.deepEqual(await importChanged(changed), {
    received: 1,
    changed: 0,
    unchanged: 0,
    conflicts: 1,
    conflict_revisions_created: 1,
  });

  const original = await client.query(`
    select source_tab, source_row, raw_data, concept_url, review_state, review_note
      from private.sheet_snapshot_rows
     where sheet_id = 'concept-sheet' and row_id = 'MEME-00001'
  `);
  assert.deepEqual(original.rows[0], {
    source_tab: conceptOriginal.source_tab,
    source_row: conceptOriginal.source_row,
    raw_data: conceptOriginal.raw_data,
    concept_url: conceptOriginal.concept_url,
    review_state: "approved",
    review_note: "manual decision",
  });

  const revisions = await client.query(`
    select revision_id, source_tab, source_row, raw_data, concept_url,
           concept_url_key, review_state, reviewed_by, reviewed_at, review_note
      from private.sheet_snapshot_row_revisions
     where sheet_id = 'concept-sheet' and row_id = 'MEME-00001'
  `);
  assert.equal(revisions.rowCount, 1);
  assert.match(revisions.rows[0].revision_id, /^[0-9a-f]{64}$/u);
  assert.deepEqual({ ...revisions.rows[0], revision_id: undefined }, {
    revision_id: undefined,
    source_tab: changed.source_tab,
    source_row: changed.source_row,
    raw_data: changed.raw_data,
    concept_url: changed.concept_url,
    concept_url_key: changed.concept_url_key,
    review_state: "pending",
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
  });

  assert.deepEqual(await importChanged(changed), {
    received: 1,
    changed: 0,
    unchanged: 0,
    conflicts: 1,
    conflict_revisions_created: 0,
  });
  const repeatedCount = await client.query(
    "select count(*)::integer as count from private.sheet_snapshot_row_revisions",
  );
  assert.equal(repeatedCount.rows[0].count, 1);

  const relocated = { ...changed, source_row: 85 };
  const relocatedResult = await importChanged(relocated);
  assert.equal(relocatedResult.conflict_revisions_created, 1);
  const distinctCount = await client.query(
    "select count(*)::integer as count from private.sheet_snapshot_row_revisions",
  );
  assert.equal(distinctCount.rows[0].count, 2);

  const cliInput = await mkdtemp(join(tmpdir(), "memecatch-sheet-cli-conflict-"));
  const cliChanged = ["MEME-00001", "cli conflict marker"];
  await writeFile(join(cliInput, "changed.json"), JSON.stringify({
    tab: "2026 CLI 정정",
    start: 86,
    rows: [cliChanged],
  }));
  const databaseUrl = `postgresql:///postgres?host=${encodeURIComponent(socket)}&port=${port}&user=postgres`;
  await assert.rejects(
    execFileAsync(process.execPath, [
      new URL("./import-sheet-snapshot.mjs", import.meta.url).pathname,
      "--input-dir", cliInput,
      "--sheet-id", "concept-sheet",
      "--kind", "concept",
      "--apply",
    ], { env: { ...process.env, DATABASE_URL: databaseUrl } }),
    (error) => {
      assert.equal(error.code, 2);
      const output = JSON.parse(error.stdout.trim());
      assert.equal(output.conflicts, 1);
      assert.equal(output.conflictRevisionsCreated, 1);
      assert.equal(output.reviewStateWrites, 0);
      assert.match(error.stderr, /1 conflict\(s\).*manual review required/u);
      assert.doesNotMatch(`${error.stdout}\n${error.stderr}`, /cli conflict marker/u);
      return true;
    },
  );

  const privileges = await client.query(`
    select
      has_table_privilege('anon', 'private.sheet_snapshot_row_revisions', 'select') as anon_select,
      has_table_privilege('authenticated', 'private.sheet_snapshot_row_revisions', 'select') as authenticated_select,
      has_table_privilege('service_role', 'private.sheet_snapshot_row_revisions', 'select,insert,update') as service_review
  `);
  assert.deepEqual(privileges.rows[0], {
    anon_select: false,
    authenticated_select: false,
    service_review: true,
  });
});
