#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertSourceFidelity,
  assertTargetLanguage,
  buildAtomicInsertSql,
  parseStrictTranslation,
  sourceSnapshot,
  sourceSnapshotHash,
  SUPPORTED_LOCALES,
} from "./translate-memes-mlx-linked.mjs";
import { parseTranslationArtifacts } from "./translation-batch-check.mjs";

const UUID_PATTERN = /^[0-9a-f-]{36}$/iu;
const MAX_USAGE_EXAMPLES = 10;

function readOption(argv, index) {
  const arg = argv[index];
  const equals = arg.indexOf("=");
  if (equals !== -1) return { value: arg.slice(equals + 1), consumed: 0 };
  const value = argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
  return { value, consumed: 1 };
}

export function parseArgs(argv) {
  const options = {
    input: null,
    worklist: null,
    artifactDir: null,
    existingArtifactDirs: [],
    slice: null,
    emitArtifact: false,
    requireComplete: false,
    json: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--emit-artifact") {
      options.emitArtifact = true;
      continue;
    }
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
    if (!arg.startsWith("--")) throw new Error(`unknown argument: ${arg}`);
    const name = arg.split("=", 1)[0];
    if (!["--input", "--worklist", "--artifact-dir", "--existing-artifact-dir", "--slice"].includes(name)) {
      throw new Error(`unknown option: ${arg}`);
    }
    const { value, consumed } = readOption(argv, index);
    index += consumed;
    if (name === "--input") options.input = value;
    if (name === "--worklist") options.worklist = value;
    if (name === "--artifact-dir") options.artifactDir = value;
    if (name === "--existing-artifact-dir") options.existingArtifactDirs.push(value);
    if (name === "--slice") options.slice = Number(value);
  }

  if (options.help) return options;
  if (!options.input || !options.worklist) throw new Error("--input and --worklist are required");
  if (options.emitArtifact && !options.artifactDir) {
    throw new Error("--emit-artifact requires --artifact-dir");
  }
  if (options.emitArtifact && !options.requireComplete) {
    throw new Error("--emit-artifact requires --require-complete");
  }
  if (options.emitArtifact && (!Number.isInteger(options.slice) || options.slice < 0)) {
    throw new Error("--emit-artifact requires a non-negative integer --slice");
  }
  return options;
}

export function usage() {
  return [
    "Validate a human-supplied translation pack without publishing it.",
    "",
    "Report only:",
    "  pnpm translation:intake -- --input pack.json --worklist artifacts/renewal/loop-050/worklist.json --require-complete --json",
    "",
    "Compare against historical artifacts without treating unsafe rows as current supply:",
    "  pnpm translation:intake -- --input pack.json --worklist artifacts/renewal/loop-050/worklist.json --existing-artifact-dir artifacts/renewal/loop-050 --require-complete --json",
    "",
    "Write reviewable SQL artifacts:",
    "  pnpm translation:intake -- --input pack.json --worklist artifacts/renewal/loop-050/worklist.json --existing-artifact-dir artifacts/renewal/loop-050 --artifact-dir artifacts/renewal/loop-095 --slice=95 --require-complete --emit-artifact",
  ].join("\n");
}

function nonEmptyString(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty string`);
  return value.trim();
}

function nullableString(value, field) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new Error(`${field} must be a string or null`);
  return value.trim() || null;
}

function isTimestamp(value) {
  if (Number.isFinite(Date.parse(value))) return true;
  return /[+-]\d{2}$/u.test(value) && Number.isFinite(Date.parse(value.replace(/[+-]\d{2}$/u, "$&:00")));
}

function normalizeSourceMeme(raw, index) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`rows[${index}].meme must be an object`);
  }
  const meme = {
    id: nonEmptyString(raw.id, `rows[${index}].meme.id`).toLowerCase(),
    short_id: nonEmptyString(raw.short_id, `rows[${index}].meme.short_id`),
    slug: nonEmptyString(raw.slug, `rows[${index}].meme.slug`),
    title: nonEmptyString(raw.title, `rows[${index}].meme.title`),
    summary: nonEmptyString(raw.summary, `rows[${index}].meme.summary`),
    description: nonEmptyString(raw.description, `rows[${index}].meme.description`),
    origin: nonEmptyString(raw.origin, `rows[${index}].meme.origin`),
    usage_note: nullableString(raw.usage_note, `rows[${index}].meme.usage_note`),
    caution: nullableString(raw.caution, `rows[${index}].meme.caution`),
    aliases: raw.aliases,
    usage_examples: raw.usage_examples,
    updated_at: nonEmptyString(raw.updated_at, `rows[${index}].meme.updated_at`),
  };
  if (!UUID_PATTERN.test(meme.id)) throw new Error(`rows[${index}].meme.id is not a UUID`);
  if (!isTimestamp(meme.updated_at)) {
    throw new Error(`rows[${index}].meme.updated_at is not an ISO timestamp`);
  }
  if (!Array.isArray(meme.aliases)) throw new Error(`rows[${index}].meme.aliases must be an array`);
  if (!meme.aliases.every((alias) => typeof alias === "string")) {
    throw new Error(`rows[${index}].meme.aliases must contain strings`);
  }
  if (!Array.isArray(meme.usage_examples) || meme.usage_examples.length > MAX_USAGE_EXAMPLES) {
    throw new Error(`rows[${index}].meme.usage_examples must contain 0-${MAX_USAGE_EXAMPLES} items`);
  }
  meme.usage_examples.forEach((example, exampleIndex) => {
    if (!example || typeof example !== "object" || Array.isArray(example)) {
      throw new Error(`rows[${index}].meme.usage_examples[${exampleIndex}] must be an object`);
    }
    nonEmptyString(example.situation, `rows[${index}].meme.usage_examples[${exampleIndex}].situation`);
    nonEmptyString(example.text, `rows[${index}].meme.usage_examples[${exampleIndex}].text`);
  });
  return meme;
}

function normalizeRow(raw, index, defaults = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`rows[${index}] must be an object`);
  }
  const locale = nonEmptyString(raw.locale, `rows[${index}].locale`).toLowerCase();
  if (!SUPPORTED_LOCALES.includes(locale)) throw new Error(`rows[${index}] has unsupported locale ${locale}`);
  const meme = normalizeSourceMeme(raw.meme ?? raw.source, index);
  const expectedSnapshotHash = sourceSnapshotHash(sourceSnapshot(meme));
  const providedSnapshotHash = raw.snapshot_hash ?? raw.source_snapshot_hash;
  if (providedSnapshotHash !== undefined && providedSnapshotHash !== expectedSnapshotHash) {
    throw new Error(`rows[${index}].source_snapshot_hash does not match source`);
  }
  const translationInput = {
    ...raw.translation,
    usage_note: raw.translation?.usage_note ?? "",
    caution: raw.translation?.caution ?? "",
  };
  const translation = parseStrictTranslation(JSON.stringify(translationInput));
  assertTargetLanguage(translation, locale, meme);
  assertSourceFidelity(translation, locale, meme);
  const provider = nullableString(raw.provider, `rows[${index}].provider`) ?? defaults.provider ?? "human-editor";
  const model = nullableString(raw.model, `rows[${index}].model`) ?? defaults.model ?? "external-editor";
  const promptVersion = raw.prompt_version ?? defaults.promptVersion ?? 1;
  if (!Number.isInteger(promptVersion) || promptVersion < 1) {
    throw new Error(`rows[${index}].prompt_version must be a positive integer`);
  }
  return { meme, locale, translation, provider, model, promptVersion };
}

function packDefaults(pack) {
  const provenance = pack && typeof pack === "object" && !Array.isArray(pack)
    ? pack.provenance
    : null;
  const authoring = provenance && typeof provenance === "object"
    ? String(provenance.authoring ?? "")
    : "";
  const modelMatch = authoring.match(/\b(gpt-[0-9]+(?:\.[0-9]+)?-[a-z0-9.-]+)\b/i);
  return {
    provider: nullableString(pack?.provider, "pack.provider") ?? (modelMatch ? "openai" : undefined),
    model: nullableString(pack?.model, "pack.model") ?? modelMatch?.[1],
    promptVersion: pack?.prompt_version,
  };
}

export function loadWorklist(path) {
  const parsed = JSON.parse(readFileSync(resolve(path), "utf8"));
  if (!Number.isInteger(parsed.total) || !Array.isArray(parsed.docs) || parsed.total !== parsed.docs.length) {
    throw new Error("worklist must contain matching integer total and docs array");
  }
  const byMemeId = new Map();
  for (const doc of parsed.docs) {
    if (!doc || !UUID_PATTERN.test(String(doc.meme_id ?? "")) || typeof doc.short_id !== "string") {
      throw new Error("worklist contains an invalid meme row");
    }
    const memeId = String(doc.meme_id).toLowerCase();
    if (byMemeId.has(memeId)) throw new Error(`worklist contains duplicate meme_id ${memeId}`);
    byMemeId.set(memeId, doc.short_id);
  }
  return { total: parsed.total, byMemeId };
}

function localeCounts() {
  return Object.fromEntries(SUPPORTED_LOCALES.map((locale) => [locale, 0]));
}

function emptyCanonicalReport(existingArtifactDirs = []) {
  return {
    existingArtifactDirs,
    existingArtifactErrors: 0,
    existingArtifactOk: true,
    existingSafeRows: 0,
    existingUnsafeRows: 0,
    newRows: 0,
    duplicateRows: 0,
    duplicateExistingRows: 0,
    duplicateInputRows: 0,
    sourceMismatchRows: 0,
    outOfWorklistRows: 0,
    missingBefore: localeCounts(),
    missingAfter: localeCounts(),
    localeDelta: Object.fromEntries(
      SUPPORTED_LOCALES.map((locale) => [locale, { before: 0, after: 0, delta: 0 }]),
    ),
  };
}

function recordKey(record) {
  return `${String(record.memeId).toLowerCase()}:${String(record.locale).toLowerCase()}`;
}

function recordFileKey(record) {
  return `${record.artifactDir ?? ""}:${record.file ?? ""}`;
}

function missingCounts(worklist, keys) {
  const presentByLocale = new Map(SUPPORTED_LOCALES.map((locale) => [locale, new Set()]));
  for (const key of keys) {
    const separator = key.lastIndexOf(":");
    if (separator === -1) continue;
    const memeId = key.slice(0, separator);
    const locale = key.slice(separator + 1);
    if (worklist.byMemeId.has(memeId) && presentByLocale.has(locale)) {
      presentByLocale.get(locale).add(memeId);
    }
  }
  return Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [locale, worklist.total - presentByLocale.get(locale).size]),
  );
}

function summarizeExistingArtifacts({
  artifactDirs = [],
  records = [],
  errors = [],
  forbiddenMutations = [],
  errorDirectories = [],
}) {
  const forbiddenFiles = new Set(forbiddenMutations.map(recordFileKey));
  const errorFiles = new Set(
    errors
      .map((error) => {
        const message = typeof error === "string" ? error : error.message;
        const artifactDir = typeof error === "string" ? null : error.artifactDir;
        const file = message?.match(/^([^:]+):/u)?.[1];
        return file && artifactDir ? `${artifactDir}:${file}` : null;
      })
      .filter(Boolean),
  );
  const directoriesWithErrors = new Set(errorDirectories);
  const safeRecords = [];
  const unsafeRecords = [];
  for (const record of records) {
    const safe = Boolean(
      record.hasConflictGuard &&
      record.hasMachineStatus &&
      !record.hasReviewPromotion &&
      !forbiddenFiles.has(recordFileKey(record)) &&
      !errorFiles.has(recordFileKey(record)) &&
      !(record.artifactDir && directoriesWithErrors.has(record.artifactDir)),
    );
    (safe ? safeRecords : unsafeRecords).push(record);
  }
  return {
    safeRecords,
    unsafeRecords,
    safeKeys: new Set(safeRecords.map(recordKey)),
    canonical: {
      ...emptyCanonicalReport(artifactDirs),
      existingArtifactErrors: errors.length,
      existingArtifactOk: errors.length === 0 && unsafeRecords.length === 0,
      existingSafeRows: safeRecords.length,
      existingUnsafeRows: unsafeRecords.length,
    },
  };
}

export function loadExistingArtifacts(artifactDirs) {
  const merged = {
    artifactDirs: [],
    records: [],
    errors: [],
    forbiddenMutations: [],
    errorDirectories: [],
  };
  for (const artifactDir of artifactDirs) {
    const root = resolve(artifactDir);
    if (!existsSync(root)) continue;
    const parsed = parseTranslationArtifacts(root);
    merged.artifactDirs.push(root);
    merged.records.push(...parsed.records.map((record) => ({ ...record, artifactDir: root })));
    merged.forbiddenMutations.push(
      ...parsed.forbiddenMutations.map((finding) => ({ ...finding, artifactDir: root })),
    );
    if (parsed.errors.length > 0) {
      const scopedErrors = parsed.errors.map((message) => ({
        artifactDir: root,
        file: message.match(/^([^:]+):/u)?.[1] ?? null,
        message,
      }));
      if (scopedErrors.some((error) => !error.file)) merged.errorDirectories.push(root);
      merged.errors.push(...scopedErrors);
    }
  }
  return merged;
}

function emptyReport() {
  return {
    ok: false,
    inputRows: 0,
    validRows: 0,
    memeCount: 0,
    localeCounts: localeCounts(),
    missingLocalesByMeme: {},
    canonical: emptyCanonicalReport(),
    errors: [],
    filesWritten: [],
  };
}

export function validateIntakePack({
  pack,
  worklist,
  existingRecords = [],
  existingPreflight = null,
  requireComplete = false,
}) {
  const report = emptyReport();
  const existingSummary = existingPreflight ?? summarizeExistingArtifacts({ records: existingRecords });
  report.canonical = { ...existingSummary.canonical };
  report.canonical.missingBefore = missingCounts(worklist, existingSummary.safeKeys);
  const sourceRows = Array.isArray(pack) ? pack : pack?.rows;
  if (!Array.isArray(sourceRows)) {
    report.errors.push("input pack must contain a rows array");
    return report;
  }
  report.inputRows = sourceRows.length;
  const rows = [];
  const defaults = packDefaults(pack);
  const existingKeys = new Set(existingRecords.map(recordKey));
  const inputKeys = new Set();
  const sourceHashes = new Map();
  const grouped = new Map();

  for (const [index, raw] of sourceRows.entries()) {
    try {
      const row = normalizeRow(raw, index, defaults);
      const key = `${row.meme.id}:${row.locale}`;
      if (!worklist.byMemeId.has(row.meme.id)) {
        report.canonical.outOfWorklistRows += 1;
        throw new Error(`rows[${index}] meme_id ${row.meme.id} is not in the worklist`);
      }
      if (worklist.byMemeId.get(row.meme.id) !== row.meme.short_id) {
        report.canonical.outOfWorklistRows += 1;
        throw new Error(`rows[${index}] short_id does not match the worklist`);
      }
      if (existingKeys.has(key)) {
        report.canonical.duplicateRows += 1;
        report.canonical.duplicateExistingRows += 1;
        throw new Error(`duplicate translation ${key}`);
      }
      if (inputKeys.has(key)) {
        report.canonical.duplicateRows += 1;
        report.canonical.duplicateInputRows += 1;
        throw new Error(`duplicate translation ${key}`);
      }
      inputKeys.add(key);

      const hash = sourceSnapshotHash(sourceSnapshot(row.meme));
      const previousHash = sourceHashes.get(row.meme.id);
      if (previousHash && previousHash !== hash) {
        report.canonical.sourceMismatchRows += 1;
        throw new Error(`rows[${index}] source snapshot differs for meme_id ${row.meme.id}`);
      }
      sourceHashes.set(row.meme.id, hash);
      rows.push(row);
      const group = grouped.get(row.meme.id) ?? new Set();
      group.add(row.locale);
      grouped.set(row.meme.id, group);
      report.localeCounts[row.locale] += 1;
      report.canonical.newRows += 1;
    } catch (error) {
      report.errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  report.validRows = rows.length;
  report.memeCount = grouped.size;
  for (const [memeId, locales] of grouped.entries()) {
    const missing = SUPPORTED_LOCALES.filter((locale) => !locales.has(locale));
    if (missing.length > 0) report.missingLocalesByMeme[memeId] = missing;
    if (requireComplete && missing.length > 0) {
      report.errors.push(`${memeId}: missing locales ${missing.join(", ")}`);
    }
  }
  if (requireComplete && grouped.size === 0) report.errors.push("complete intake pack must contain at least one meme");
  const afterKeys = new Set(existingSummary.safeKeys);
  rows.forEach((row) => afterKeys.add(`${row.meme.id}:${row.locale}`));
  report.canonical.missingAfter = missingCounts(worklist, afterKeys);
  report.canonical.localeDelta = Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => [
      locale,
      {
        before: report.canonical.missingBefore[locale],
        after: report.canonical.missingAfter[locale],
        delta: report.canonical.missingBefore[locale] - report.canonical.missingAfter[locale],
      },
    ]),
  );
  report.ok = report.errors.length === 0;
  report.rows = rows;
  return report;
}

function artifactFilename(locale, slice) {
  return `${locale}-slice${slice}.sql`;
}

function artifactHeader({ locale, slice }) {
  return [
    "-- MemeCatch reviewable translation pack; not executed by this command.",
    "-- Apply only after human review through the existing operator process.",
    `-- locale=${locale}; slice=${slice}; generated_at=${new Date().toISOString()}`,
    "",
  ].join("\n");
}

export function emitArtifacts({ rows, artifactDir, slice }) {
  const root = resolve(artifactDir);
  mkdirSync(root, { recursive: true });
  const paths = SUPPORTED_LOCALES.map((locale) => resolve(root, artifactFilename(locale, slice)));
  for (const path of paths) {
    if (existsSync(path)) throw new Error(`artifact already exists: ${path}`);
  }
  const filesWritten = [];
  for (const [locale, path] of SUPPORTED_LOCALES.map((locale, index) => [locale, paths[index]])) {
    const content = [
      artifactHeader({ locale, slice }),
      ...rows
        .filter((row) => row.locale === locale)
        .map((row) => `${buildAtomicInsertSql({
          meme: row.meme,
          locale: row.locale,
          translation: row.translation,
          provider: row.provider,
          model: row.model,
          promptVersion: row.promptVersion,
        })};\n`),
    ].join("\n");
    writeFileSync(path, content, { encoding: "utf8", flag: "wx" });
    filesWritten.push(path);
  }
  return filesWritten;
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) return { help: true, usage: usage() };
  const pack = JSON.parse(readFileSync(resolve(options.input), "utf8"));
  const worklist = loadWorklist(options.worklist);
  const artifactDirs = [...new Set([
    ...options.existingArtifactDirs,
    ...(options.artifactDir ? [options.artifactDir] : []),
  ].map((path) => resolve(path)))].filter((path) => existsSync(path));
  const existing = loadExistingArtifacts(artifactDirs);
  const existingPreflight = summarizeExistingArtifacts({
    artifactDirs: existing.artifactDirs,
    records: existing.records,
    errors: existing.errors,
    forbiddenMutations: existing.forbiddenMutations,
    errorDirectories: existing.errorDirectories,
  });
  const report = validateIntakePack({
    pack,
    worklist,
    existingRecords: existing.records,
    existingPreflight,
    requireComplete: options.requireComplete,
  });
  const outputArtifactDir = options.artifactDir ? resolve(options.artifactDir) : null;
  const blockingExistingErrors = existing.errors
    .filter(({ artifactDir }) => artifactDir === outputArtifactDir)
    .map(({ artifactDir, message }) => `${artifactDir}: ${message}`);
  report.errors.push(...blockingExistingErrors);
  if (outputArtifactDir && existingPreflight.unsafeRecords.some((record) => record.artifactDir === outputArtifactDir)) {
    report.errors.push(`${outputArtifactDir}: unsafe existing rows must be isolated before emitting artifacts`);
  }
  report.ok = report.errors.length === 0;
  if (report.ok && options.emitArtifact) {
    report.filesWritten = emitArtifacts({
      rows: report.rows,
      artifactDir: options.artifactDir,
      slice: options.slice,
    });
  }
  delete report.rows;
  return report;
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else {
      const report = run(process.argv.slice(2));
      if (options.json) console.log(JSON.stringify(report, null, 2));
      else {
        console.log(`translation intake: ${report.validRows}/${report.inputRows} valid rows across ${report.memeCount} memes`);
        for (const error of report.errors) console.error(`ERROR ${error}`);
        for (const file of report.filesWritten) console.log(`artifact=${file}`);
      }
      if (!report.ok) process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
