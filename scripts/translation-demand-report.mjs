#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { SUPPORTED_LOCALES } from "./translation-batch-check.mjs";

const UUID_PATTERN = /^[0-9a-f-]{36}$/iu;
const ISO_TIMESTAMP_PATTERN = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})T(?<hour>\d{2}):(?<minute>\d{2}):(?<second>\d{2})(?:\.\d{1,9})?(?<zone>Z|[+-]\d{2}:\d{2})$/u;
const ACTIVE_STATUSES = new Set(["requested", "in_review"]);
const SUPPLY_STATE_ORDER = {
  missing: 0,
  stale: 1,
  review_needed: 2,
  unknown: 3,
  ready: 4,
};
const ACTIONABLE_STATES = new Set(["missing", "stale", "review_needed"]);
const STATE_COPY = {
  missing: { action: "translate", reason: "번역 행이 없어 사람 번역이 필요함" },
  stale: { action: "refresh", reason: "원문 revision과 번역이 일치하지 않음" },
  review_needed: { action: "review", reason: "현재 원문 revision의 machine 초안 검수가 필요함" },
  ready: { action: "recheck", reason: "현재 reviewed 번역이 있어 요청 상태를 재확인해야 함" },
  unknown: { action: "hold", reason: "공급 상태를 판정할 수 없어 보류함" },
};

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readField(row, snake, camel = snake) {
  return row[snake] ?? row[camel];
}

function requireString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function requireTimestamp(value, field) {
  const normalized = requireString(value, field);
  const match = normalized.match(ISO_TIMESTAMP_PATTERN);
  const parts = match?.groups;
  const year = Number(parts?.year);
  const month = Number(parts?.month);
  const day = Number(parts?.day);
  const hour = Number(parts?.hour);
  const minute = Number(parts?.minute);
  const second = Number(parts?.second);
  const zone = parts?.zone ?? "";
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const zoneMatch = zone.match(/^[+-](\d{2}):(\d{2})$/u);
  const validZone = zone === "Z" || (
    zoneMatch && Number(zoneMatch[1]) <= 23 && Number(zoneMatch[2]) <= 59
  );
  const validCalendar = Boolean(
    parts &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= daysInMonth[month - 1] &&
    hour >= 0 && hour <= 23 &&
    minute >= 0 && minute <= 59 &&
    second >= 0 && second <= 59 &&
    validZone,
  );
  if (!validCalendar || !Number.isFinite(Date.parse(normalized))) {
    throw new Error(`${field} must be an ISO timestamp`);
  }
  return normalized;
}

function requireNonNegativeInteger(value, field) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${field} must be a non-negative integer`);
  }
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${field} must be a positive integer`);
  }
  return value;
}

function sameInstant(left, right) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime;
}

function intakeSnapshot(intakeReport) {
  if (!isRecord(intakeReport)) throw new Error("intake report must be an object");
  const source = isRecord(intakeReport.canonical)
    ? intakeReport
    : isRecord(intakeReport.report)
      ? intakeReport.report
      : null;
  const canonical = source?.canonical ?? source;
  if (!isRecord(canonical)) throw new Error("intake report must contain canonical data");
  if (!Array.isArray(source.errors)) throw new Error("intake report errors must be an array");
  if (typeof source.ok !== "boolean") throw new Error("intake report ok must be a boolean");
  const intakeErrors = source.errors.map((error) => String(error));
  const gateFields = [
    "existingArtifactErrors",
    "existingSafeRows",
    "existingUnsafeRows",
    "newRows",
    "duplicateRows",
    "duplicateExistingRows",
    "duplicateInputRows",
    "sourceMismatchRows",
    "outOfWorklistRows",
  ];
  const gates = Object.fromEntries(
    gateFields.map((field) => [field, requireNonNegativeInteger(canonical[field], `canonical.${field}`)]),
  );
  if (typeof canonical.existingArtifactOk !== "boolean") {
    throw new Error("canonical.existingArtifactOk must be a boolean");
  }
  gates.existingArtifactOk = canonical.existingArtifactOk;
  const locales = {};

  for (const locale of SUPPORTED_LOCALES) {
    const before = requireNonNegativeInteger(
      canonical.missingBefore?.[locale],
      `canonical.missingBefore.${locale}`,
    );
    const after = requireNonNegativeInteger(
      canonical.missingAfter?.[locale],
      `canonical.missingAfter.${locale}`,
    );
    const delta = requireNonNegativeInteger(
      canonical.localeDelta?.[locale]?.delta,
      `canonical.localeDelta.${locale}.delta`,
    );
    const deltaBefore = requireNonNegativeInteger(
      canonical.localeDelta?.[locale]?.before,
      `canonical.localeDelta.${locale}.before`,
    );
    const deltaAfter = requireNonNegativeInteger(
      canonical.localeDelta?.[locale]?.after,
      `canonical.localeDelta.${locale}.after`,
    );
    const expectedDelta = before - after;
    if (deltaBefore !== before || deltaAfter !== after || delta !== expectedDelta) {
      throw new Error(
        `canonical.localeDelta.${locale} must match missingBefore/missingAfter`,
      );
    }
    locales[locale] = { missingBefore: before, missingAfter: after, missingDelta: delta };
  }

  const gateErrors = [
    [!gates.existingArtifactOk, "existing artifact gate is not passing"],
    [gates.existingArtifactErrors > 0, "existing artifact errors are present"],
    [gates.existingUnsafeRows > 0, "unsafe existing rows are present"],
    [gates.duplicateRows > 0, "duplicate translation rows are present"],
    [gates.duplicateExistingRows > 0, "duplicate existing translation rows are present"],
    [gates.duplicateInputRows > 0, "duplicate input translation rows are present"],
    [gates.sourceMismatchRows > 0, "source snapshot mismatch rows are present"],
    [gates.outOfWorklistRows > 0, "out-of-worklist rows are present"],
  ]
    .filter(([failed]) => failed)
    .map(([, message]) => message);
  const errors = [...intakeErrors, ...gateErrors.filter((message) => !intakeErrors.includes(message))];
  const intakeOk = source.ok && errors.length === 0;
  return { ok: intakeOk, errors, gates, locales };
}

function supplyState(row) {
  if (row.translationStatus === null) return "missing";
  if (row.translationStatus === "stale" || !sameInstant(row.sourceUpdatedAt, row.memeUpdatedAt)) {
    return "stale";
  }
  if (row.translationStatus === "machine") return "review_needed";
  if (row.translationStatus === "reviewed") return "ready";
  return "unknown";
}

function normalizeDemandRows(input) {
  const sourceRows = Array.isArray(input) ? input : input?.rows;
  if (!Array.isArray(sourceRows)) throw new Error("demand input must contain a rows array");

  const seen = new Set();
  return sourceRows.map((raw, index) => {
    if (!isRecord(raw)) throw new Error(`rows[${index}] must be an object`);
    const memeId = requireString(readField(raw, "meme_id", "memeId"), `rows[${index}].meme_id`);
    if (!UUID_PATTERN.test(memeId)) throw new Error(`rows[${index}].meme_id must be a UUID`);
    const locale = requireString(readField(raw, "locale"), `rows[${index}].locale`).toLowerCase();
    if (!SUPPORTED_LOCALES.includes(locale)) {
      throw new Error(`rows[${index}].locale is unsupported: ${locale}`);
    }
    const key = `${memeId.toLowerCase()}:${locale}`;
    if (seen.has(key)) throw new Error(`duplicate demand row ${key}`);
    seen.add(key);

    const requestCount = requirePositiveInteger(
      readField(raw, "request_count", "requestCount"),
      `rows[${index}].request_count`,
    );
    const latestRequestedAt = requireTimestamp(
      readField(raw, "latest_requested_at", "latestRequestedAt"),
      `rows[${index}].latest_requested_at`,
    );
    const status = requireString(readField(raw, "status"), `rows[${index}].status`);
    if (!ACTIVE_STATUSES.has(status)) throw new Error(`rows[${index}].status is not active`);

    const translationStatusValue = readField(raw, "translation_status", "translationStatus");
    const translationStatus = translationStatusValue == null
      ? null
      : requireString(translationStatusValue, `rows[${index}].translation_status`).toLowerCase();
    const memeUpdatedAt = requireTimestamp(
      readField(raw, "meme_updated_at", "memeUpdatedAt"),
      `rows[${index}].meme_updated_at`,
    );
    const sourceUpdatedAtValue = readField(raw, "source_updated_at", "sourceUpdatedAt");
    const sourceUpdatedAt = translationStatus === null && sourceUpdatedAtValue == null
      ? null
      : requireTimestamp(sourceUpdatedAtValue, `rows[${index}].source_updated_at`);
    const row = {
      memeId: memeId.toLowerCase(),
      locale,
      requestCount,
      latestRequestedAt,
      status,
      translationStatus,
      memeUpdatedAt,
      sourceUpdatedAt,
    };
    const state = supplyState(row);
    const copy = STATE_COPY[state];
    return { ...row, supplyState: state, action: copy.action, reason: copy.reason };
  });
}

function sortDemandRows(left, right) {
  return (
    SUPPLY_STATE_ORDER[left.supplyState] - SUPPLY_STATE_ORDER[right.supplyState] ||
    right.requestCount - left.requestCount ||
    (Date.parse(right.latestRequestedAt) || 0) - (Date.parse(left.latestRequestedAt) || 0) ||
    left.memeId.localeCompare(right.memeId) ||
    left.locale.localeCompare(right.locale)
  );
}

function summarizeDemandRows(rows, intakeLocales) {
  return Object.fromEntries(
    SUPPORTED_LOCALES.map((locale) => {
      const localeRows = rows.filter((row) => row.locale === locale);
      const actionableRows = localeRows.filter((row) => ACTIONABLE_STATES.has(row.supplyState));
      return [locale, {
        ...intakeLocales[locale],
        activeRequestCount: localeRows.reduce((total, row) => total + row.requestCount, 0),
        activeMemeCount: new Set(localeRows.map((row) => row.memeId)).size,
        actionableRequestCount: actionableRows.reduce((total, row) => total + row.requestCount, 0),
      }];
    }),
  );
}

export function buildTranslationDemandReport({ intakeReport, demand, limit = 50 }) {
  const intake = intakeSnapshot(intakeReport);
  const safeLimit = requirePositiveInteger(limit, "limit");
  const rows = normalizeDemandRows(demand);
  const sortedRows = [...rows].sort(sortDemandRows);
  const reportErrors = intake.ok ? [] : ["intake gate is not passing"];

  return {
    version: 1,
    ok: reportErrors.length === 0,
    intake,
    demand: {
      activeRowCount: rows.length,
      activeRequestCount: rows.reduce((total, row) => total + row.requestCount, 0),
    },
    locales: summarizeDemandRows(rows, intake.locales),
    priorities: sortedRows.slice(0, safeLimit),
    errors: reportErrors,
  };
}

export function parseArgs(argv) {
  const options = { intakeReport: null, demand: null, limit: 50, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--") continue;
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }
    const match = arg.match(/^--(intake-report|demand|limit)(?:=(.*))?$/u);
    if (!match) throw new Error(`unknown option: ${arg}`);
    const value = match[2] ?? argv[++index];
    if (!value || value.startsWith("--")) throw new Error(`${match[1]} requires a value`);
    if (match[1] === "intake-report") options.intakeReport = value;
    if (match[1] === "demand") options.demand = value;
    if (match[1] === "limit") options.limit = Number(value);
  }
  if (!options.help && (!options.intakeReport || !options.demand)) {
    throw new Error("--intake-report and --demand are required");
  }
  return options;
}

export function usage() {
  return [
    "Align an existing human translation intake report with an operator-safe Plus demand export.",
    "",
    "Report only:",
    "  node scripts/translation-demand-report.mjs --intake-report intake.json --demand demand.json --json",
    "",
    "The command never connects to Supabase, calls OpenAI, writes SQL, or publishes translations.",
  ].join("\n");
}

export function run(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) return { help: true, usage: usage() };
  const intakeReport = JSON.parse(readFileSync(resolve(options.intakeReport), "utf8"));
  const demand = JSON.parse(readFileSync(resolve(options.demand), "utf8"));
  const report = buildTranslationDemandReport({
    intakeReport,
    demand,
    limit: options.limit,
  });
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`translation demand: ${report.demand.activeRequestCount} active requests across ${report.demand.activeRowCount} rows`);
    for (const locale of SUPPORTED_LOCALES) {
      const row = report.locales[locale];
      console.log(`${locale}: missing ${row.missingBefore} -> ${row.missingAfter} (-${row.missingDelta}), actionable requests=${row.actionableRequestCount}`);
    }
    for (const error of report.errors) console.error(`ERROR ${error}`);
  }
  if (!report.ok) process.exitCode = 1;
  return report;
}

const isDirectExecution = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectExecution) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      console.log(usage());
    } else {
      run(process.argv.slice(2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
