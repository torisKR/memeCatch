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
const ATOMIC_PAYLOAD_PATTERN =
  /convert_from\(\s*decode\(\s*'([A-Za-z0-9+/=]+)'\s*,\s*'base64'\s*\)\s*,\s*'utf8'\s*\)::jsonb/gi;
const FORBIDDEN_STATEMENT_PATTERN =
  /\b(?:drop\s+table|truncate\s+table|delete\s+from|alter\s+table|merge\s+into|insert\s+into\s+public\.(?!meme_translations\b)|update\s+public\.(?:memes|meme_translations))\b/i;
const FORBIDDEN_CALL_PATTERN = /^\s*(?:call\b|select\s+(?:public\.)?rpc\s*\()/i;
const REVIEW_PROMOTION_PATTERN =
  /\b(?:status\s*=\s*['"]reviewed['"]|reviewed_at\s*=\s*(?!null\b)|reviewed_by\s*=\s*(?!null\b))\b|['"]reviewed['"]/i;

function stripSqlLiterals(statement) {
  return statement.replace(/'(?:''|[^'])*'/gu, "''");
}

function stripSqlComments(statement) {
  return statement
    .replace(/--[^\n]*/gu, "")
    .replace(/\/\*[\s\S]*?\*\//gu, "")
    .trim();
}

function splitSqlList(source) {
  const parts = [];
  let start = 0;
  let parenDepth = 0;
  let bracketDepth = 0;
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
    if (inString) continue;
    if (char === "(") parenDepth += 1;
    if (char === ")") parenDepth -= 1;
    if (char === "[") bracketDepth += 1;
    if (char === "]") bracketDepth -= 1;
    if (char === "," && parenDepth === 0 && bracketDepth === 0) {
      parts.push(source.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(source.slice(start).trim());
  return parts;
}

function inspectLegacyInsertSafety(statement) {
  const match = statement.match(
    /insert\s+into\s+public\.meme_translations\s*\(([^)]*)\)\s*values\s*\(/i,
  );
  if (!match) {
    return {
      hasMachineStatus: /['"]machine['"]/i.test(statement),
      hasReviewPromotion: REVIEW_PROMOTION_PATTERN.test(statement),
    };
  }
  const valuesOpen = match.index + match[0].length - 1;
  let depth = 0;
  let inString = false;
  let valuesClose = -1;
  for (let index = valuesOpen; index < statement.length; index += 1) {
    const char = statement[index];
    if (char === "'") {
      if (inString && statement[index + 1] === "'") {
        index += 1;
        continue;
      }
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        valuesClose = index;
        break;
      }
    }
  }
  if (valuesClose === -1) {
    return {
      hasMachineStatus: false,
      hasReviewPromotion: true,
    };
  }
  const columns = splitSqlList(match[1]).map((column) => column.replaceAll('"', "").trim().toLowerCase());
  const values = splitSqlList(statement.slice(valuesOpen + 1, valuesClose));
  if (columns.length !== values.length) {
    return {
      hasMachineStatus: false,
      hasReviewPromotion: true,
    };
  }
  const byColumn = new Map(columns.map((column, index) => [column, values[index].trim()]));
  const status = byColumn.get("status") ?? "";
  const reviewedAt = byColumn.get("reviewed_at") ?? "null";
  const reviewedBy = byColumn.get("reviewed_by") ?? "null";
  const isNull = (value) => /^null\b/iu.test(value);
  return {
    hasMachineStatus: /^'machine'(?:\s*::[a-z_]+)?$/iu.test(status),
    hasReviewPromotion:
      /^'reviewed'(?:\s*::[a-z_]+)?$/iu.test(status) || !isNull(reviewedAt) || !isNull(reviewedBy),
  };
}

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
  const forbiddenMutations = [];

  for (const name of files) {
    const fileLocale = name.split("-slice", 1)[0];
    const source = readFileSync(resolve(root, name), "utf8");
    for (const [statementIndex, rawStatement] of splitSqlStatements(source).entries()) {
      const statement = stripSqlComments(stripSqlLiterals(rawStatement));
      if (!statement) continue;
      if (FORBIDDEN_STATEMENT_PATTERN.test(statement) || FORBIDDEN_CALL_PATTERN.test(statement)) {
        const finding = { file: name, statementIndex: statementIndex + 1 };
        forbiddenMutations.push(finding);
        errors.push(`${name}: forbidden translation-table mutation detected in statement ${statementIndex + 1}`);
      }
    }
    // Keep the legacy scanner intentionally permissive: historical artifacts
    // include a few hand-authored strings whose quoting makes them unsuitable
    // for the lightweight statement splitter below. The checker still reads
    // every INSERT boundary exactly as it did before this atomic format.
    const insertStarts = [...source.matchAll(/\binsert\s+into\s+public\.meme_translations\b/gi)].map(
      (match) => match.index ?? 0,
    );
    for (const [index, start] of insertStarts.entries()) {
      const end = insertStarts[index + 1] ?? source.length;
      const statement = source.slice(start, end);
      const match = statement.match(INSERT_PATTERN);
      if (match) {
        const [, memeId, locale] = match;
        const safety = inspectLegacyInsertSafety(statement);
        records.push({
          file: name,
          memeId: memeId.toLowerCase(),
          locale,
          fileLocale,
          hasConflictGuard: /\bon\s+conflict\s*\(\s*meme_id\s*,\s*locale\s*\)/i.test(statement),
          hasMachineStatus: safety.hasMachineStatus,
          hasReviewPromotion: safety.hasReviewPromotion,
          hasSourceSnapshotGuard: false,
          statement,
        });
        continue;
      }

      // Atomic statements begin before INSERT, so their payload is decoded in
      // the dedicated pass below rather than from this legacy insert boundary.
      if (!/\bwith\s+input\s+as\s*\(/i.test(source.slice(Math.max(0, start - 20_000), start))) {
        errors.push(`${name}: could not parse meme_id and locale from insert ${index + 1}`);
      }
    }

    // The current offline generator writes a single SQL statement that
    // encodes its source snapshot in a base64 JSON payload, then locks the
    // current meme row before inserting. Decode only the local artifact so it
    // receives the same worklist/locale/duplicate validation as older plain
    // `VALUES` batches. It is not an external call and never executes SQL.
    for (const [index, payloadMatch] of [...source.matchAll(ATOMIC_PAYLOAD_PATTERN)].entries()) {
      const payloadOffset = payloadMatch.index ?? 0;
      const startMarker = "\nwith input as";
      const atomicStart = Math.max(0, source.lastIndexOf(startMarker, payloadOffset));
      const nextAtomic = source.indexOf(startMarker, payloadOffset + payloadMatch[0].length);
      const atomicStatement = source.slice(atomicStart, nextAtomic === -1 ? source.length : nextAtomic);
      try {
        if (!/\binsert\s+into\s+public\.meme_translations\b/i.test(atomicStatement)) {
          throw new Error("payload is not paired with a meme_translations insert");
        }
        const payload = JSON.parse(Buffer.from(payloadMatch[1], "base64").toString("utf8"));
        const memeId = String(payload?.meme_id ?? "");
        const locale = String(payload?.locale ?? "");
        if (!/^[0-9a-f-]{36}$/i.test(memeId) || !locale) {
          throw new Error("payload lacks a valid meme_id or locale");
        }
        records.push({
          file: name,
          memeId: memeId.toLowerCase(),
          locale,
          fileLocale,
          hasConflictGuard: /\bon\s+conflict\s*\(\s*meme_id\s*,\s*locale\s*\)/i.test(atomicStatement),
          hasMachineStatus: /['"]machine['"]/i.test(atomicStatement),
          hasReviewPromotion: REVIEW_PROMOTION_PATTERN.test(atomicStatement),
          hasSourceSnapshotGuard:
            /\bwhere\s+m\.updated_at\s*=\s*i\.source_updated_at/i.test(atomicStatement) &&
            /\bm\.title\s+is\s+not\s+distinct\s+from\s+i\.source_title/i.test(atomicStatement),
          statement: atomicStatement,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "unknown payload error";
        errors.push(`${name}: could not decode atomic translation payload ${index + 1}: ${message}`);
      }
    }
  }
  return { files, records, errors, forbiddenMutations };
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
    if (!record.hasMachineStatus) errors.push(`${record.file}: ${key} is not a machine draft`);
    if (record.hasReviewPromotion) errors.push(`${record.file}: ${key} attempts reviewed publication`);
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
    forbiddenMutationCount: artifacts.forbiddenMutations?.length ?? 0,
    forbiddenMutations: artifacts.forbiddenMutations ?? [],
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
