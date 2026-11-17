#!/usr/bin/env node
/**
 * Validate and stage one Google Sheet snapshot directory.
 *
 * Snapshot files are JSON objects shaped as { tab, start, rows }. Every JSON
 * file in the directory is imported; non-JSON files (for example JSONL audit
 * artifacts) are ignored. The command is a dry run unless --apply is present.
 *
 *   node --experimental-strip-types --import ./scripts/register-ts-paths.mjs \
 *     scripts/import-sheet-snapshot.mjs \
 *     --input-dir /private/tmp/memecatch-concept-snapshot-20261117 \
 *     --sheet-id "$CONCEPT_SHEET_ID" --kind concept
 *
 * Add --apply with DATABASE_URL set to import all chunks in one transaction.
 * The script never reads sheet status as review state and never publishes.
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const KIND = {
  concept: { idPrefix: "MEME-", conceptUrlColumn: 12 },
  video: { idPrefix: "VID-", conceptUrlColumn: 13 },
};
const ROW_ID = /^(MEME|VID)-\S+$/u;
const BATCH_SIZE = 500;

function usage() {
  return "usage: import-sheet-snapshot.mjs --input-dir <dir> --sheet-id <id> --kind <concept|video> [--apply]";
}

export function parseArgs(argv) {
  const options = { apply: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--apply") options.apply = true;
    else if (["--input-dir", "--sheet-id", "--kind"].includes(arg)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
      options[arg.slice(2).replace("-", "_")] = value;
      index += 1;
    } else throw new Error(`unknown argument: ${arg}`);
  }
  if (!options.input_dir || !options.sheet_id || !KIND[options.kind]) throw new Error(usage());
  if (options.sheet_id.trim().length > 256) throw new Error("sheet ID is too long");
  return options;
}

export function normalizeConceptUrl(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    let host = url.hostname.toLowerCase().replace(/^www\./u, "");
    const defaultPort = (url.protocol === "http:" && url.port === "80")
      || (url.protocol === "https:" && url.port === "443");
    if (url.port && !defaultPort) host += `:${url.port}`;
    const pathname = url.pathname.replace(/\/+$/u, "") || "/";
    return `${host}${pathname}`;
  } catch {
    return null;
  }
}

function requireSnapshot(value, filename) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${filename}: snapshot must be an object`);
  }
  if (typeof value.tab !== "string" || !value.tab.trim()) {
    throw new Error(`${filename}: tab must be a non-empty string`);
  }
  if (!Number.isSafeInteger(value.start) || value.start < 1) {
    throw new Error(`${filename}: start must be a positive integer`);
  }
  if (!Array.isArray(value.rows) || value.rows.some((row) => !Array.isArray(row))) {
    throw new Error(`${filename}: rows must be an array of row arrays`);
  }
  return value;
}

export async function loadSnapshotRows(inputDir, kind) {
  const config = KIND[kind];
  if (!config) throw new Error(`unsupported kind: ${kind}`);
  const directory = resolve(inputDir);
  const files = (await readdir(directory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  if (files.length === 0) throw new Error(`${directory}: no JSON snapshot files found`);

  const rows = [];
  const seen = new Map();
  for (const filename of files) {
    const raw = await readFile(resolve(directory, filename), "utf8");
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(`${filename}: invalid JSON`, { cause: error });
    }
    const snapshot = requireSnapshot(parsed, filename);
    for (let offset = 0; offset < snapshot.rows.length; offset += 1) {
      const rawData = snapshot.rows[offset];
      const rowId = typeof rawData[0] === "string" ? rawData[0].trim() : "";
      const sourceRow = snapshot.start + offset;
      if (!ROW_ID.test(rowId) || !rowId.startsWith(config.idPrefix)) {
        throw new Error(`${filename}:${sourceRow}: expected ${config.idPrefix} row ID in column A`);
      }
      const prior = seen.get(rowId);
      if (prior) {
        throw new Error(`${filename}:${sourceRow}: duplicate row ID ${rowId}; first seen at ${prior}`);
      }
      seen.set(rowId, `${prior ?? filename}:${sourceRow}`);
      const conceptUrlValue = rawData[config.conceptUrlColumn];
      const conceptUrl = typeof conceptUrlValue === "string" && conceptUrlValue.trim()
        ? conceptUrlValue.trim()
        : null;
      rows.push({
        row_id: rowId,
        record_kind: kind,
        source_tab: snapshot.tab.trim(),
        source_row: sourceRow,
        raw_data: rawData,
        concept_url: conceptUrl,
        concept_url_key: normalizeConceptUrl(conceptUrl),
      });
    }
  }
  return { directory, files, rows };
}

export function summarizeConceptLinks(conceptRows, videoRows) {
  const conceptsByKey = new Map();
  for (const row of conceptRows) {
    if (!row.concept_url_key) continue;
    const entries = conceptsByKey.get(row.concept_url_key) ?? [];
    entries.push(row.row_id);
    conceptsByKey.set(row.concept_url_key, entries);
  }
  const stats = { matched: 0, unmatched: 0, ambiguous: 0, matchedConcepts: new Set() };
  for (const row of videoRows) {
    const matches = row.concept_url_key ? conceptsByKey.get(row.concept_url_key) ?? [] : [];
    if (matches.length === 1) {
      stats.matched += 1;
      stats.matchedConcepts.add(matches[0]);
    } else if (matches.length > 1) stats.ambiguous += 1;
    else stats.unmatched += 1;
  }
  return {
    matched: stats.matched,
    unmatched: stats.unmatched,
    ambiguous: stats.ambiguous,
    matchedConcepts: stats.matchedConcepts.size,
  };
}

async function defaultTransaction(run) {
  const { default: pg } = await import("pg");
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "memecatch-sheet-snapshot-import",
  });
  let transactionStarted = false;
  try {
    await client.connect();
    await client.query("begin");
    transactionStarted = true;
    await client.query("select set_config('app.user_id', '', true)");
    await client.query("select set_config('app.db_role', 'service_role', true)");
    await client.query("select set_config('app.is_anonymous', 'false', true)");
    await client.query(
      "select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ role: "service_role", sub: null, is_anonymous: "false" })],
    );
    await client.query("set local role service_role");
    await client.query("set local search_path to public, extensions");
    const result = await run((sheetId, rows) => client.query(
      "select public.import_sheet_snapshot_rows($1, $2::jsonb) as result",
      [sheetId, JSON.stringify(rows)],
    ));
    await client.query("commit");
    return result;
  } catch (error) {
    if (transactionStarted) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function importRows(sheetId, rows, { transaction = defaultTransaction } = {}) {
  return transaction(async (executeBatch) => {
    const totals = { received: 0, changed: 0, unchanged: 0, conflicts: 0, batches: 0 };
    for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
      const batch = rows.slice(offset, offset + BATCH_SIZE);
      const result = await executeBatch(sheetId, batch);
      const value = result?.rows?.[0]?.result;
      if (!value || typeof value !== "object") throw new Error("invalid import RPC response");
      totals.received += Number(value.received ?? 0);
      totals.changed += Number(value.changed ?? 0);
      totals.unchanged += Number(value.unchanged ?? 0);
      totals.conflicts += Number(value.conflicts ?? 0);
      totals.batches += 1;
    }
    return totals;
  });
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const loaded = await loadSnapshotRows(options.input_dir, options.kind);
  const summary = {
    mode: options.apply ? "apply" : "dry-run",
    kind: options.kind,
    files: loaded.files.length,
    rows: loaded.rows.length,
    rowsWithConceptUrl: loaded.rows.filter((row) => row.concept_url !== null).length,
    rowsWithNormalizedConceptUrl: loaded.rows.filter((row) => row.concept_url_key !== null).length,
    publication: "none",
    reviewStateWrites: 0,
  };
  if (!options.apply) {
    process.stdout.write(`${JSON.stringify(summary)}\n`);
    return summary;
  }
  if (!process.env.DATABASE_URL?.trim()) throw new Error("DATABASE_URL is required with --apply");
  const imported = await importRows(options.sheet_id.trim(), loaded.rows);
  const result = { ...summary, ...imported };
  process.stdout.write(`${JSON.stringify(result)}\n`);
  return result;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "sheet snapshot import failed");
    process.exitCode = 1;
  });
}
