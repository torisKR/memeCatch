#!/usr/bin/env node
/**
 * Rank review-only social source candidates. A score is triage assistance, not
 * publication approval: this script never writes to Supabase and every result
 * remains `needs_human_source_match`.
 *
 * Usage:
 *   node scripts/rank-social-source-candidates.mjs data/memes/collected output.jsonl
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { memeTitleKey } from "./meme-title-key.mjs";

const [inputDir, outputPath] = process.argv.slice(2);
if (!inputDir || !outputPath) {
  console.error("usage: node scripts/rank-social-source-candidates.mjs input-dir output.jsonl");
  process.exit(2);
}

const SOCIAL_FILE = /^(?:youtube-source|youtube-shorts|tiktok-oembed|instagram-oembed).*\.jsonl$/;
const OFFICIAL_CHANNEL = /\b(?:official|records|entertainment|broadcast|network|studios?)\b|공식|kbs|mbc|sbs|jtbc|tvn|netflix|hybe|sm entertainment|jyp entertainment|yg entertainment/i;
const DERIVATIVE_HINT = /teaser|reaction|리액션|패러디|모음|편집|fanmade|fan made|compilation/i;

function compact(value) {
  return memeTitleKey(value);
}

function tokens(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .match(/[\p{L}\p{N}]{2,}/gu) ?? [];
}

function titleFor(row) {
  return row.video_title ?? row.oembed_title ?? "";
}

function rank(row) {
  const candidateTitle = titleFor(row);
  const candidateKey = compact(candidateTitle);
  const names = [row.meme_title, ...(Array.isArray(row.aliases) ? row.aliases : [])]
    .map((name) => String(name ?? "").trim())
    .filter(Boolean);
  const nameKeys = names.map(compact).filter(Boolean);
  const phraseMatch = nameKeys.some((key) => key.length >= 4 && candidateKey.includes(key));
  const nameTokens = [...new Set(names.flatMap(tokens))];
  const candidateTokens = new Set(tokens(candidateTitle));
  const matchedTokens = nameTokens.filter((token) => candidateTokens.has(token));
  const tokenCoverage = nameTokens.length > 0 ? matchedTokens.length / nameTokens.length : 0;
  const officialChannel = OFFICIAL_CHANNEL.test(String(row.channel ?? row.oembed_author_name ?? ""));
  const oembedVerified = Boolean(row.oembed_verified_at);
  const derivative = DERIVATIVE_HINT.test(candidateTitle);
  const genericShortTitle = nameTokens.length <= 1 && Math.max(0, ...nameKeys.map((key) => key.length)) < 5;

  let score = 0;
  const reasons = [];
  if (phraseMatch) {
    score += 55;
    reasons.push("meme title or alias appears in content title");
  }
  score += Math.round(tokenCoverage * 30);
  if (matchedTokens.length > 0) reasons.push(`matched tokens: ${matchedTokens.join(", ")}`);
  if (officialChannel) {
    score += 15;
    reasons.push("official/broadcaster channel hint");
  }
  if (oembedVerified) {
    score += 10;
    reasons.push("public oEmbed verified");
  }
  if (derivative) {
    score -= 25;
    reasons.push("derivative-content hint");
  }
  if (genericShortTitle) {
    score -= 40;
    reasons.push("short generic title needs manual context review");
  }
  score = Math.max(0, Math.min(100, score));
  const priority = score >= 75 && !genericShortTitle ? "high" : score >= 45 ? "medium" : "low";
  return { score, priority, reasons, candidateTitle };
}

const rows = [];
for (const file of readdirSync(inputDir).filter((name) => SOCIAL_FILE.test(name)).sort()) {
  for (const line of readFileSync(join(inputDir, file), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    const ranked = rank(row);
    rows.push({
      ...row,
      source_match_score: ranked.score,
      review_priority: ranked.priority,
      match_reasons: ranked.reasons,
      review_status: "needs_human_source_match",
    });
  }
}

rows.sort(
  (a, b) =>
    b.source_match_score - a.source_match_score ||
    String(a.meme_title).localeCompare(String(b.meme_title), "ko") ||
    String(a.source_url).localeCompare(String(b.source_url))
);

mkdirSync(dirname(resolve(outputPath)), { recursive: true });
writeFileSync(resolve(outputPath), `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`);
const summary = rows.reduce(
  (counts, row) => {
    counts.total++;
    counts[row.review_priority]++;
    counts.platforms[row.source_platform] = (counts.platforms[row.source_platform] ?? 0) + 1;
    return counts;
  },
  { total: 0, high: 0, medium: 0, low: 0, platforms: {} }
);
console.log(JSON.stringify(summary));
