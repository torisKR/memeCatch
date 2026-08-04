#!/usr/bin/env node
/**
 * Validate offline meme_translations SQL batches before an operator applies them.
 *
 * The checker is intentionally read-only. It never connects to Supabase and it
 * never executes SQL. A loop may ship a partial batch as a resumable artifact;
 * --require-complete is reserved for the release gate when every worklist entry
 * has one row for every supported locale.
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const SUPPORTED_LOCALES = ["en", "ja", "zh", "zh-tw"];
const SQL_FILE_PATTERN = /^(en|ja|zh|zh-tw)-slice\d+\.sql$/;
const INSERT_PATTERN =
  /insert\s+into\s+public\.meme_translations\b[\s\S]*?values\s*\(\s*'([0-9a-f-]{36})'\s*(?:::uuid)?\s*,\s*'([^']+)'/i;
const FORBIDDEN_STATEMENT_PATTERN =
  /\b(?:drop\s+table|truncate\s+table|delete\s+from|alter\s+table|insert\s+into\s+public\.(?:memes|meme_sources|meme_media)|update\s+public\.memes)\b/i;

function usage() {
  return [
    "Validate offline meme translation SQL artifacts (read-only).",
    "",
    "Usage:",
    "  node scripts/translation-batch-check.mjs --artifact-dir artifacts/renewal/loop-050 --worklist artifacts/renewal/loop-050/worklist.json",
    "  node scripts/translation-batch-check.mjs --artifact-dir ... --worklist ... --require-complete",
    "  node scripts/translation-batch-check.mjs ... --json",
  ].join("\n");
}

export function parseArgs(argv) {
  const options = {
    artifactDir: null,
    worklist: null,
    requireComplete: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--require-complete") {
      options.requireComplete = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    const match = arg.match(/^--(artifact-dir|worklist)(?:=(.*))?$/);
    if (!match) throw new Error(`unknown option: ${arg}`);
    const value = match[2] ?? argv[++index];
    if (!value || value.startsWith("--")) {
      throw new Error(`${match[1]} requires a value`);
    }
    options[match[1] === "artifact-dir" ? "artifactDir" : "worklist"] = value;
  }

  if (!options.help && (!options.artifactDir || !options.worklist)) {
    throw new Error("--artifact-dir and --worklist are required");
  }
  return options;
}

/** Split SQL statements without treating semicolons inside SQL strings as ends. */
export function splitSqlStatements(source) {
  const statements = [];
  let start = 0;
  let inString = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (char === "'") {
      if (inString && source[index + 1] === "'") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (char === ";" && !inString) {
      statements.push(source.slice(start, index + 1));
      start = index + 1;
    }
  }
  if (source.slice(start).trim()) statements.push(source.slice(start));
  return statements;
}

function loadWorklist(path) {
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8"));
  if (!Number.isInteger(parsed.total) || !Array.isArray(parsed.docs)) {
    throw new Error("worklist must contain integer total and docs array");
  }
  if (parsed.total !== parsed.docs.length) {
    throw new Error(`worklist total=${parsed.total} but docs=${parsed.docs.length}`);
  }

  const byMemeId = new Map();
  const shortIds = new Set();
  for (const doc of parsed.docs) {
    if (!doc || typeof doc !== "object") throw new Error("worklist contains a non-object row");
    if (!/^[0-9a-f-]{36}$/i.test(String(doc.meme_id ?? ""))) {
      throw new Error(`worklist row ${doc.short_id ?? "?"} has no valid meme_id`);
    }
    if (!/^[a-z0-9]{8}$/i.test(String(doc.short_id ?? ""))) {
      throw new Error(`worklist row has invalid short_id: ${doc.short_id ?? "?"}`);
    }
    if (byMemeId.has(doc.meme_id) || shortIds.has(doc.short_id)) {
      throw new Error(`worklist contains duplicate meme: ${doc.short_id}`);
    }
    byMemeId.set(doc.meme_id.toLowerCase(), doc.short_id);
    shortIds.add(doc.short_id);
  }
  return { total: parsed.total, byMemeId };
}

export function parseTranslationArtifacts(artifactDir) {
  const root = resolve(artifactDir);
  const files = readdirSync(root)
    .filter((name) => SQL_FILE_PATTERN.test(name))
    .sort();
  const records = [];
  const errors = [];

  for (const name of files) {
    const fileLocale = name.split("-slice", 1)[0];
    const source = readFileSync(resolve(root, name), "utf8");
    const insertStarts = [...source.matchAll(/\binsert\s+into\s+public\.meme_translations\b/gi)].map(
      (match) => match.index ?? 0,
    );
    for (const [index, start] of insertStarts.entries()) {
      const end = insertStarts[index + 1] ?? source.length;
      const statement = source.slice(start, end);
      const match = statement.match(INSERT_PATTERN);
      if (!match) {
        errors.push(`${name}: could not parse meme_id and locale from insert at byte ${start}`);
        continue;
      }
      const [, memeId, locale] = match;
      records.push({
        file: name,
        memeId: memeId.toLowerCase(),
        locale,
        fileLocale,
        hasConflictGuard: /\bon\s+conflict\s*\(\s*meme_id\s*,\s*locale\s*\)/i.test(statement),
        statement,
      });
    }
    if (FORBIDDEN_STATEMENT_PATTERN.test(source)) {
      errors.push(`${name}: forbidden non-translation write detected`);
    }
  }
  return { files, records, errors };
}

export function validateTranslationBatch({ worklist, artifacts, requireComplete = false }) {
  const errors = [...artifacts.errors];
  const seen = new Set();
  const counts = Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, 0]));

  for (const record of artifacts.records) {
    const key = `${record.memeId}:${record.locale}`;
    if (!Object.hasOwn(counts, record.locale)) errors.push(`${record.file}: unsupported locale ${record.locale}`);
    if (record.fileLocale !== record.locale) {
      errors.push(`${record.file}: filename locale ${record.fileLocale} does not match row locale ${record.locale}`);
    }
    if (!worklist.byMemeId.has(record.memeId)) {
      errors.push(`${record.file}: meme_id ${record.memeId} is not in the worklist`);
    }
    if (seen.has(key)) errors.push(`${record.file}: duplicate translation ${key}`);
    seen.add(key);
    if (!record.hasConflictGuard) errors.push(`${record.file}: ${key} has no conflict guard`);
    if (Object.hasOwn(counts, record.locale)) counts[record.locale] += 1;
  }

  const expectedPerLocale = worklist.total;
  const missing = {};
  for (const locale of SUPPORTED_LOCALES) {
    const present = new Set(
      artifacts.records.filter((record) => record.locale === locale).map((record) => record.memeId),
    );
    missing[locale] = [...worklist.byMemeId.keys()].filter((memeId) => !present.has(memeId));
    if (requireComplete && missing[locale].length > 0) {
      errors.push(`${locale}: ${missing[locale].length} worklist memes are missing`);
    }
  }

  return {
    ok: errors.length === 0,
    files: artifacts.files,
    worklistTotal: worklist.total,
    expectedRows: expectedPerLocale * SUPPORTED_LOCALES.length,
    actualRows: artifacts.records.length,
    counts,
    missingCounts: Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [locale, missing[locale].length]),
    ),
    missingSamples: Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [locale, missing[locale].slice(0, 10)]),
    ),
    errors,
  };
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(usage());
    return { ok: true };
  }
  const worklist = loadWorklist(options.worklist);
  const artifacts = parseTranslationArtifacts(options.artifactDir);
  const report = validateTranslationBatch({
    worklist,
    artifacts,
    requireComplete: options.requireComplete,
  });
  if (options.json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } else {
    console.log(
      `translation artifacts: ${report.actualRows}/${report.expectedRows} rows across ${report.files.length} SQL files`,
    );
    console.log(`locale counts: ${SUPPORTED_LOCALES.map((locale) => `${locale}=${report.counts[locale]}`).join(" ")}`);
    console.log(
      `missing: ${SUPPORTED_LOCALES.map((locale) => `${locale}=${report.missingCounts[locale]}`).join(" ")}`,
    );
    for (const error of report.errors) console.error(`ERROR ${error}`);
  }
  if (!report.ok) process.exitCode = 1;
  return report;
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  try {
    run();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
