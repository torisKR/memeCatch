#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeSourceUrl } from "./source-url.mjs";

const COLUMN = Object.freeze({
  id: 0,
  title: 2,
  platform: 6,
  associatedMeme: 7,
  platformId: 8,
  url: 10,
  source: 12,
  role: 24,
  inclusion: 30,
});

const INCLUDED = "수집 후보";
const HTTP_YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);
const HTTP_YOUTUBE_URL = /^http:\/\/(?:youtube\.com|www\.youtube\.com|m\.youtube\.com|youtu\.be)(?:[/?#]|$)/iu;
const PLATFORM_LABELS = new Map([
  ["유튜브 형식 미확인", new Set(["youtube"])],
  ["유튜브 롱폼", new Set(["youtube"])],
  ["유튜브 쇼츠", new Set(["youtube", "youtube_shorts"])],
  ["틱톡", new Set(["tiktok"])],
  ["인스타", new Set(["instagram"])],
]);

function usage() {
  return "usage: node scripts/prepare-sheet-source-candidates.mjs --input-dir <sheet-snapshot-dir> --sheet-id <google-spreadsheet-id> --approved-memes <memes.jsonl> --output <candidates.jsonl> [--dry-run]";
}

function parseArgs(argv) {
  const options = { dryRun: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    const key = {
      "--input-dir": "inputDir",
      "--sheet-id": "sheetId",
      "--approved-memes": "approvedMemes",
      "--output": "output",
    }[argument];
    if (!key || !argv[index + 1] || argv[index + 1].startsWith("--")) {
      throw new Error(usage());
    }
    if (options[key]) throw new Error(`${argument} may only be supplied once`);
    options[key] = argv[index + 1];
    index += 1;
  }
  if (!options.inputDir || !options.sheetId || !options.approvedMemes || !options.output) {
    throw new Error(usage());
  }
  return options;
}

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizedName(value) {
  return text(value).normalize("NFKC").replace(/\s+/gu, " ").toLowerCase();
}

function isWebUrl(value) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

function normalizeCandidateSourceUrl(value) {
  let sourceUrl = value;
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:") {
      if (
        !HTTP_YOUTUBE_URL.test(value) ||
        parsed.username ||
        parsed.password ||
        parsed.port ||
        !HTTP_YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())
      ) return null;
      parsed.protocol = "https:";
      sourceUrl = parsed.toString();
    }
  } catch {
    return null;
  }
  return normalizeSourceUrl(sourceUrl);
}

async function approvedNameIndex(path) {
  const index = new Map();
  const lines = (await readFile(path, "utf8")).split("\n");
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    if (!lines[lineIndex].trim()) continue;
    let meme;
    try {
      meme = JSON.parse(lines[lineIndex]);
    } catch {
      throw new Error(`invalid approved memes JSONL at line ${lineIndex + 1}`);
    }
    if (
      !meme ||
      typeof meme !== "object" ||
      !text(meme.id) ||
      !text(meme.title) ||
      (meme.aliases !== null && !Array.isArray(meme.aliases)) ||
      (Array.isArray(meme.aliases) && meme.aliases.some((alias) => typeof alias !== "string")) ||
      meme.moderation_status !== "approved"
    ) {
      throw new Error(`invalid approved meme at line ${lineIndex + 1}`);
    }
    for (const name of [meme.title, ...(meme.aliases ?? [])]) {
      const key = normalizedName(name);
      if (!key) continue;
      const ids = index.get(key) ?? new Set();
      ids.add(meme.id.trim());
      index.set(key, ids);
    }
  }
  return index;
}

function validateRow(row) {
  if (!Array.isArray(row)) return null;
  const id = text(row[COLUMN.id]);
  const videoTitle = text(row[COLUMN.title]);
  const platform = text(row[COLUMN.platform]);
  const associatedMeme = text(row[COLUMN.associatedMeme]);
  const platformId = text(row[COLUMN.platformId]);
  const sourceUrl = text(row[COLUMN.url]);
  const provenanceUrl = text(row[COLUMN.source]);
  const role = text(row[COLUMN.role]);
  const inclusion = text(row[COLUMN.inclusion]);

  if (
    !/^VID-\d+$/u.test(id) ||
    !videoTitle ||
    !platform ||
    !platformId ||
    !sourceUrl ||
    !provenanceUrl ||
    !isWebUrl(provenanceUrl) ||
    !role ||
    inclusion !== INCLUDED
  ) {
    return null;
  }

  const normalizedSource = normalizeCandidateSourceUrl(sourceUrl);
  const allowedPlatforms = PLATFORM_LABELS.get(platform.normalize("NFKC"));
  if (
    !normalizedSource ||
    normalizedSource.externalId !== platformId ||
    !allowedPlatforms?.has(normalizedSource.platform)
  ) return null;

  return { id, videoTitle, associatedMeme, provenanceUrl, role, normalizedSource };
}

export async function prepareSheetSourceCandidates({ inputDir, sheetId, approvedMemes, output, dryRun = false }) {
  const resolvedInputDir = resolve(inputDir);
  const resolvedApprovedMemes = resolve(approvedMemes);
  const resolvedOutput = resolve(output);
  if (resolvedApprovedMemes === resolvedOutput) {
    throw new Error("output must not overwrite the approved memes JSONL");
  }

  const spreadsheetId = text(sheetId);
  if (!/^[A-Za-z0-9_-]+$/u.test(spreadsheetId)) {
    throw new Error("sheet ID must be an explicit Google spreadsheet ID");
  }
  const names = await approvedNameIndex(resolvedApprovedMemes);
  const entries = (await readdir(resolvedInputDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .sort();
  if (entries.length === 0) throw new Error("input directory contains no sheet snapshot JSON files");

  const counts = {
    files: entries.length,
    rows: 0,
    candidates: 0,
    written: 0,
    duplicates: 0,
    invalidRows: 0,
    missingNames: 0,
    unmatchedNames: 0,
    ambiguousNames: 0,
  };
  const seen = new Set();
  const candidates = [];

  for (const entry of entries) {
    const snapshot = JSON.parse(await readFile(resolve(resolvedInputDir, entry), "utf8"));
    if (!snapshot || typeof snapshot !== "object" || !Array.isArray(snapshot.rows)) {
      throw new Error(`invalid sheet snapshot: ${entry}`);
    }
    for (const rawRow of snapshot.rows) {
      counts.rows += 1;
      const row = validateRow(rawRow);
      if (!row) {
        counts.invalidRows += 1;
        continue;
      }
      const name = normalizedName(row.associatedMeme);
      if (!name) {
        counts.missingNames += 1;
        continue;
      }
      const memeIds = names.get(name);
      if (!memeIds) {
        counts.unmatchedNames += 1;
        continue;
      }
      if (memeIds.size !== 1) {
        counts.ambiguousNames += 1;
        continue;
      }

      const memeId = memeIds.values().next().value;
      const { platform, externalId, canonicalUrl } = row.normalizedSource;
      const dedupKey = JSON.stringify([memeId, platform, externalId]);
      if (seen.has(dedupKey)) {
        counts.duplicates += 1;
        continue;
      }
      seen.add(dedupKey);
      candidates.push({
        meme_id: memeId,
        source_url: canonicalUrl,
        video_title: row.videoTitle,
        note: `spreadsheet_id=${spreadsheetId}; row=${row.id}; source=${row.provenanceUrl}; sheet_role=${row.role}; intent=usage_example; origin_verified=false`,
      });
      counts.candidates += 1;
    }
  }

  if (!dryRun) {
    const body = candidates.length > 0 ? `${candidates.map((candidate) => JSON.stringify(candidate)).join("\n")}\n` : "";
    await writeFile(resolvedOutput, body, "utf8");
    counts.written = candidates.length;
  }

  return counts;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const counts = await prepareSheetSourceCandidates(options);
    console.log(JSON.stringify(counts));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
