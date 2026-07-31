#!/usr/bin/env node
/**
 * KoCulture-Descriptions 원본(JSONL) → 프로젝트 raw JSONL 정규화 스크립트
 *
 * 기본 동작:
 * - 원격 URL이 주어지면 먼저 받아보고,
 *   실패하면 로컬 fallback 파일을 사용해 변환/정리한 뒤 저장.
 * - title/summary 비어있는 행은 제외하고 title 기준 중복 제거.
 * - 카테고리는 기존 DB enum(phrase/dance/song/image/comment/challenge)으로 정규화.
 *
 * 사용법:
 *   node scripts/import-koculture-memes.mjs
 *   node scripts/import-koculture-memes.mjs --input <url_or_path> --output <path>
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describeDisplayCategorySummary, normalizeMemeCategory, resolveDisplayCategory } from "./normalize-meme-category.mjs";
import { memeTitleKey } from "./meme-title-key.mjs";

const DEFAULT_REMOTE = "https://huggingface.co/datasets/huggingface-KREW/KoCulture-Descriptions/resolve/main/data.jsonl";
const DEFAULT_FALLBACK_LOCAL = "data/memes/raw/imported-koculture-memes.jsonl";
const DEFAULT_OUTPUT = "data/memes/raw/imported-koculture-memes.jsonl";

const args = process.argv.slice(2);
const input = getArg("--input") ?? DEFAULT_REMOTE;
const output = getArg("--output") ?? DEFAULT_OUTPUT;
const dryRun = hasArg("--dry-run");
const forceRemote = hasArg("--force-remote");

main().catch((error) => {
  console.error(`[실패] ${error.message}`);
  process.exit(1);
});

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx === -1) return null;
  return args[idx + 1];
}

function hasArg(name) {
  return args.includes(name);
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(value);
}

async function readSource(spec) {
  if (isHttpUrl(spec)) {
    try {
      const response = await fetch(spec);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return { text: await response.text(), fromRemote: true };
    } catch (error) {
      if (forceRemote) throw error;
      console.warn(`[경고] 원격 불러오기 실패: ${error.message}`);
      console.warn(`[안내] 로컬 fallback(${DEFAULT_FALLBACK_LOCAL})로 진행합니다.`);
      spec = DEFAULT_FALLBACK_LOCAL;
    }
  }

  if (!existsSync(spec)) {
    throw new Error(`입력 파일이 없습니다: ${spec}`);
  }
  return { text: readFileSync(spec, "utf8"), fromRemote: false };
}

function normalizeRow(raw) {
  const title = String(raw.title ?? "").trim();
  const summary = String(
    raw.summary ??
      raw.content ??
      raw.description ??
      ""
  ).trim();
  if (!title || !summary) return null;

  const description = String(raw.description ?? summary).trim();
  const aliases = Array.isArray(raw.aliases) ? raw.aliases : [];
  const category = normalizeMemeCategory(raw.category, raw.media_type);
  const dateYear = Number(String(raw.date ?? "").match(/(19\d{2}|20\d{2})/)?.[1] ?? "0");
  const originYear = Math.min(2026, Math.max(1980, Number(raw.year) || dateYear || 2020));
  const dateText = raw.date ? String(raw.date).trim() : "";
  const mediaType = ["image", "video", "audio", "text", "embed"].includes(String(raw.media_type ?? "")) ? raw.media_type : null;
  const item = {
    title,
    summary,
    description,
    date: dateText,
    year: originYear,
    origin_year: originYear,
    category,
    source: raw.source ?? raw.origin ?? "KoCulture-Descriptions",
    source_url: raw.source_url ?? null,
    usage_note: raw.usage_note ?? raw.usage ?? null,
    caution: raw.caution ?? null,
    safety_level: ["green", "yellow", "gray", "red"].includes(raw.safety_level)
      ? raw.safety_level
      : "yellow",
    origin: raw.origin ?? raw.origin_description ?? "",
    aliases,
    media_type: mediaType ?? "image",
    display_category: resolveDisplayCategory({ ...raw, category }, mediaType),
  };
  return item;
}

async function main() {
  const inputSource = input;
  const resolved = await readSource(inputSource);
  const lines = resolved.text.split(/\r?\n/);

  const seen = new Set();
  const rows = [];
  let invalid = 0;
  let duplicates = 0;

  for (const line of lines) {
    if (!line.trim()) continue;
    let raw;
    try {
      raw = JSON.parse(line);
    } catch {
      invalid += 1;
      continue;
    }
    const normalized = normalizeRow(raw);
    if (!normalized) {
      invalid += 1;
      continue;
    }
    const key = memeTitleKey(normalized.title);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    rows.push(normalized);
  }

  const categorySummary = rows.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] ?? 0) + 1;
    return acc;
  }, {});
  const displaySummary = describeDisplayCategorySummary(rows);

  console.log(`입력: ${inputSource}`);
  console.log(`원본 행: ${lines.length} / 파싱 불가: ${invalid} / 중복제거: ${duplicates}`);
  console.log(`정규화 결과: ${rows.length}`);
  console.log(`카테고리 분포: ${JSON.stringify(categorySummary, null, 2)}`);
  console.log(`표시 카테고리 분포: ${JSON.stringify(displaySummary, null, 2)}`);
  console.log(`출처: ${resolved.fromRemote ? "원격" : "로컬 fallback"}`);

  if (dryRun) return;
  const outPath = resolve(output);
  mkdirSync(dirname(outPath), { recursive: true });
  const payload = rows.map((row) => JSON.stringify(row)).join("\n");
  writeFileSync(outPath, `${payload}\n`);
  console.log(`저장: ${outPath}`);
}
