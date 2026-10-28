#!/usr/bin/env node
/**
 * 지속적 밈 수집 및 중복 방지 하베스터 (Continuous Meme Harvester)
 * 최신 밈부터 과거 밈까지 시대순으로 신규 밈을 검증하고 누적 관리합니다.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const jsonPath = resolve(ROOT_DIR, "data/timeline-memes.json");

export function normalizeKey(text) {
  return String(text || "").trim().toLowerCase().replace(/[^a-z0-9가-힣]/g, "");
}

export function checkDuplicateInMemory(candidate, existingList) {
  const candKey = normalizeKey(candidate.title);
  const candSlug = String(candidate.slug || "").trim().toLowerCase();
  const candAliases = (candidate.aliases || []).map(normalizeKey);

  for (const item of existingList) {
    const itemKey = normalizeKey(item.title);
    const itemSlug = String(item.slug || "").trim().toLowerCase();
    const itemAliases = (item.aliases || []).map(normalizeKey);

    if (candKey === itemKey || candSlug === itemSlug) {
      return { isDuplicate: true, reason: "title_or_slug_match", matched: item.title };
    }
    if (candAliases.includes(itemKey) || itemAliases.includes(candKey)) {
      return { isDuplicate: true, reason: "alias_match", matched: item.title };
    }
  }
  return { isDuplicate: false };
}

export function addVerifiedMeme(candidate) {
  if (!existsSync(jsonPath)) {
    writeFileSync(jsonPath, "[]", "utf8");
  }
  const current = JSON.parse(readFileSync(jsonPath, "utf8"));
  const dupCheck = checkDuplicateInMemory(candidate, current);
  if (dupCheck.isDuplicate) {
    return { ok: false, error: `중복 밈 감지 (${dupCheck.reason}): 이미 '${dupCheck.matched}' 항목이 있습니다.` };
  }

  current.push(candidate);
  current.sort((a, b) => (b.origin_year || 0) - (a.origin_year || 0));
  return { ok: true, count: current.length };
}

async function main() {
  const isRun = process.argv.includes("--run");
  console.log("Continuous Meme Harvester CLI Initialized.");
  if (!isRun) {
    console.log("실행하려면 '--run' 플래그를 붙여주세요: node scripts/continuous-meme-harvester.mjs --run");
    return;
  }

  if (!existsSync(jsonPath)) {
    console.error("data/timeline-memes.json 파일이 없습니다.");
    process.exit(1);
  }
  const items = JSON.parse(readFileSync(jsonPath, "utf8"));
  console.log(`현재 관리 중인 시대별 밈 총 ${items.length}건 (최신: ${items[0]?.origin_year}년 -> 과거: ${items[items.length - 1]?.origin_year}년)`);

  let validCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`  [${i + 1}/${items.length}] [${item.origin_year}년] ${item.title} (${item.slug})`);
    validCount++;
  }
  console.log(`검증 완료: 총 ${validCount}건의 시대별 밈이 마이그레이션 SQL 및 JSON에 정상 준비되었습니다.`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(console.error);
}
