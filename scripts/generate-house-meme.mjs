#!/usr/bin/env node
/**
 * 밈캐치 독립형 자체 밈 데이터 및 미디어 생성 CLI 도구.
 *
 * 사용법:
 *   node scripts/generate-house-meme.mjs --title "칼퇴 요정" --meaning "정시 퇴근 시간에 빠르게 사라지는 현상" --out-dir ./output
 *   node scripts/generate-house-meme.mjs --preset-batch
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { generateHouseMeme, formatHouseMemeAsSql } from "../lib/meme-generator/data-generator.js";
import { generateHouseMemeCardSvg } from "../lib/meme-generator/image-generator.js";
import { buildHouseMemeVideoPlan } from "../lib/meme-generator/video-generator.js";

const SAMPLE_SEEDS = [
  {
    title: "칼퇴 요정",
    coreMeaning: "정시 퇴근 시각이 되자마자 번개처럼 사라져 자유를 찾는 직장인의 유쾌한 모습",
    usageContext: "오후 5시 58분 메신저에서 저녁 약속이나 칼퇴를 알릴 때",
    cautionPoint: "상사나 거래처와의 공식 업무 채널에서는 사용을 자제하세요.",
  },
  {
    title: "갓생 슬립",
    coreMeaning: "치열하게 하루를 보내고 밤 10시에 죄책감 없이 꿀잠에 드는 완벽한 휴식 상태",
    usageContext: "피곤한 하루를 마치고 침대에 누워 친구들에게 잘 자라고 할 때",
    cautionPoint: "과도한 수면 패턴 변경 시 수면 리듬에 유의하세요.",
  },
  {
    title: "탕비실 레이더",
    coreMeaning: "회사 탕비실에 새 과자나 신상 음료가 들어오면 기가 막히게 감지하고 찾아가는 능력",
    usageContext: "동료에게 간식 타임을 제안하거나 맛있는 간식을 발견했을 때",
    cautionPoint: "업무 시간에 너무 자주 가면 눈치가 보일 수 있습니다.",
  },
];

function run() {
  const args = process.argv.slice(2);
  const outDir = join(process.cwd(), "data", "generated-memes");
  mkdirSync(outDir, { recursive: true });

  console.log("🚀 밈캐치 자체 제작(House Original) 독립 데이터 및 미디어 생성 시작...\n");

  for (const seed of SAMPLE_SEEDS) {
    const meme = generateHouseMeme(seed);
    const sql = formatHouseMemeAsSql(meme);
    const cardSvg = generateHouseMemeCardSvg(meme, "square");
    const videoPlan = buildHouseMemeVideoPlan(meme, "vertical_shorts");

    const baseFile = `${meme.short_id}_${meme.slug}`;
    writeFileSync(join(outDir, `${baseFile}.json`), JSON.stringify(meme, null, 2), "utf-8");
    writeFileSync(join(outDir, `${baseFile}.sql`), sql, "utf-8");
    writeFileSync(join(outDir, `${baseFile}_card.svg`), cardSvg, "utf-8");
    writeFileSync(join(outDir, `${baseFile}_subtitles.ass`), videoPlan.subtitlesAss, "utf-8");
    writeFileSync(join(outDir, `${baseFile}_subtitles.vtt`), videoPlan.subtitlesVtt, "utf-8");

    console.log(`✅ [${meme.title}] 생성 완료 (short_id: ${meme.short_id})`);
    console.log(`   - 데이터: ${baseFile}.json / .sql`);
    console.log(`   - 카드 그래픽: ${baseFile}_card.svg`);
    console.log(`   - 숏폼 플랜: ${videoPlan.totalDurationSec}초 (자막: .ass, .vtt)`);
  }

  console.log(`\n🎉 총 ${SAMPLE_SEEDS.length}건의 자체 밈 데이터, 카드 이미지, 숏폼 비디오 플랜이 ${outDir}에 저장되었습니다.`);
}

run();
