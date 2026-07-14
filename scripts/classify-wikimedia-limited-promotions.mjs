#!/usr/bin/env node
/**
 * Build an exact, reviewable limited-publication ledger from the 2000–2020
 * Wikimedia pending batch. Context links remain context links; this does not
 * claim an original upload or complete editorial approval.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const [inputPath, outputPath, ...args] = process.argv.slice(2);
const expectedArg = Number(args.find((arg) => arg.startsWith("--expected="))?.slice(11) ?? 1000);
const expected = Number.isFinite(expectedArg) ? Math.max(1, Math.floor(expectedArg)) : 1000;
const EXCLUDED_DUPLICATE_TITLE = "Mundial Ronaldinho Soccer 64";

if (!inputPath || !outputPath || !existsSync(resolve(inputPath))) {
  console.error("usage: node scripts/classify-wikimedia-limited-promotions.mjs <pending.jsonl> <output.jsonl> [--expected=1000]");
  process.exit(2);
}

const MEME_SIGNAL = /\b(?:internet meme|online meme|became (?:an? )?(?:internet )?meme|viral|went viral|internet challenge|online challenge|social media challenge|catchphrase)\b/i;
const NON_MEME_WORK = /\b(?:is a song|is an? (?:film|album|episode|video game|single|television series|novel)|was released as (?:a )?single)\b/i;
const DANGEROUS = /\b(?:injur(?:y|ies|ed)|fatal|death|dangerous|unconscious|self-harm|suicide|choking|fire challenge|poison|hospitali[sz]ed)\b/i;
const ADULT = /\b(?:sexual|sex|porn|pussy|fuck|nude|nudity|genital|rape)\b/i;
const HATE = /\b(?:racist|racial slur|antisemit|homophobic|hate speech|xenophob)\w*\b/i;
const CONTROVERSIAL = /\b(?:war|annexation|politic|president|election|propaganda|protest|nationalist)\w*\b/i;

function classify(row) {
  const text = `${row.title ?? ""} ${row.summary ?? ""} ${row.description ?? ""}`;
  const signals = [];
  let qualityScore = 0;
  if (MEME_SIGNAL.test(text)) {
    qualityScore += 60;
    signals.push("explicit meme/viral wording");
  }
  if (text.includes(String(row.year))) {
    qualityScore += 20;
    signals.push("assigned year appears in context");
  }
  if (String(row.description ?? "").length >= 180) {
    qualityScore += 10;
    signals.push("substantive public context");
  }
  if (NON_MEME_WORK.test(text) && !MEME_SIGNAL.test(text)) {
    qualityScore -= 40;
    signals.push("work-title context needs meme review");
  }

  const dangerous = DANGEROUS.test(text);
  const adult = ADULT.test(text);
  const hate = HATE.test(text);
  const controversial = CONTROVERSIAL.test(text) || adult || hate;
  const safetyLevel = dangerous || adult || hate ? "red" : "yellow";
  const sentiment = dangerous ? "negative" : controversial ? "controversial" : row.sentiment;
  const caution = dangerous
    ? "위험하거나 부상을 유발할 수 있는 행동이 포함돼요. 따라 하지 마세요. 원본과 발생 연도는 추가 검수 중이에요."
    : adult || hate
      ? "성적·혐오·공격적 표현이 포함될 수 있어요. 공개된 Wikimedia 맥락을 바탕으로 추가 검수 중이에요."
      : "Wikimedia 맥락 기록을 바탕으로 제한 공개 중이며, 원본과 발생 연도는 추가 검수 중이에요.";

  return {
    title: row.title,
    source_url: row.source_url,
    year: row.year,
    target_status: "limited",
    quality_score: qualityScore,
    quality_level: qualityScore >= 80 ? "high" : qualityScore >= 40 ? "medium" : "low",
    quality_signals: signals,
    safety_level: safetyLevel,
    sentiment,
    caution,
    review_note: "Context-only limited publication; original source and precise year still require editorial review.",
  };
}

const input = readFileSync(resolve(inputPath), "utf8")
  .split("\n")
  .filter(Boolean)
  .map(JSON.parse);
const excluded = input.filter((row) => row.title === EXCLUDED_DUPLICATE_TITLE);
const selected = input
  .filter((row) => row.title !== EXCLUDED_DUPLICATE_TITLE)
  .map(classify)
  .sort((a, b) => b.quality_score - a.quality_score || a.title.localeCompare(b.title, "en"));

if (excluded.length !== 1 || selected.length !== expected) {
  throw new Error(`expected one duplicate exclusion and ${expected} promotions; got ${excluded.length} and ${selected.length}`);
}
if (selected.some((row) => !/^https:\/\/[a-z-]+\.wikipedia\.org\/wiki\//i.test(row.source_url))) {
  throw new Error("all limited promotions must retain a direct Wikimedia context URL");
}

writeFileSync(resolve(outputPath), `${selected.map((row) => JSON.stringify(row)).join("\n")}\n`);
writeFileSync(
  resolve(`${outputPath}.excluded.json`),
  `${JSON.stringify(excluded.map((row) => ({ title: row.title, source_url: row.source_url, reason: "duplicate Ronaldinho Soccer 64 variant" })), null, 2)}\n`,
);
process.stderr.write(`${JSON.stringify({ input: input.length, selected: selected.length, excluded: excluded.length })}\n`);
