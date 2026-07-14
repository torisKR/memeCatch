#!/usr/bin/env node
/**
 * Validate a JSONL meme import before it is allowed to reach production.
 *
 * The strict mode protects the source promise shown on meme detail pages:
 * every record must link to a directly reviewable YouTube, TikTok, or
 * Instagram public post. Wiki/context URLs and short redirects are reported,
 * never promoted to `meme_contents`.
 *
 * Usage:
 *   node scripts/validate-meme-import.mjs data/memes/new --min-records=1000 --min-per-platform=250 --strict-social
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { nativeSocialValidationMessage, parseNativeSocialContent } from "./social-content.mjs";
import { memeTitleKey } from "./meme-title-key.mjs";

const [inputPath, ...args] = process.argv.slice(2);
const strictSocial = args.includes("--strict-social");
const minArg = args.find((arg) => arg.startsWith("--min-records="));
const minRecords = minArg ? Number(minArg.split("=")[1]) : 0;
const minPlatformArg = args.find((arg) => arg.startsWith("--min-per-platform="));
const minPerPlatform = minPlatformArg ? Number(minPlatformArg.split("=")[1]) : 0;

if (!inputPath || !existsSync(inputPath)) {
  console.error("usage: node scripts/validate-meme-import.mjs <jsonl-file-or-directory> [--min-records=N] [--min-per-platform=N] [--strict-social]");
  process.exit(2);
}

const target = resolve(inputPath);
const inputFiles = statSync(target).isDirectory()
  ? readdirSync(target, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".jsonl"))
      .map((entry) => join(target, entry.name))
      .sort()
  : [target];
if (inputFiles.length === 0) {
  console.error("입력 디렉터리에 JSONL 파일이 없습니다.");
  process.exit(2);
}
const seenTitles = new Set();
const errors = [];
const distribution = { youtube: 0, youtubeShorts: 0, tiktok: 0, instagram: 0, nonNative: 0 };
let recordCount = 0;

for (const file of inputFiles) {
  for (const [index, raw] of readFileSync(file, "utf8").split("\n").entries()) {
    const line = raw.trim();
    if (!line) continue;
    recordCount++;
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      errors.push(`${file}:${index + 1} JSON 형식 오류`);
      continue;
    }
    const label = `${file}:${index + 1}`;
    const titleKey = memeTitleKey(row.title);
    if (!titleKey || !row.summary) errors.push(`${label} title과 summary가 모두 필요합니다.`);
    else if (seenTitles.has(titleKey)) errors.push(`${label} 중복 title: ${row.title}`);
    else seenTitles.add(titleKey);

    const year = Number(row.year);
    if (!Number.isInteger(year) || year < 2000 || year > 2020) {
      errors.push(`${label} year는 2000~2020 정수여야 합니다.`);
    }

    const social = parseNativeSocialContent(row.source_url);
    if (!social) {
      distribution.nonNative++;
      if (strictSocial) errors.push(`${label} ${nativeSocialValidationMessage(row.source_url)}`);
      continue;
    }
    if (social.platform === "YouTube") {
      if (social.isShort) distribution.youtubeShorts++;
      else distribution.youtube++;
    } else if (social.platform === "TikTok") distribution.tiktok++;
    else distribution.instagram++;
  }
}

if (recordCount < minRecords) errors.push(`최소 ${minRecords}건이 필요하지만 ${recordCount}건입니다.`);
if (minPerPlatform > 0) {
  for (const [platform, count] of Object.entries(distribution)) {
    if (platform === "nonNative") continue;
    if (count < minPerPlatform) {
      errors.push(`${platform} 최소 ${minPerPlatform}건이 필요하지만 ${count}건입니다.`);
    }
  }
}
console.log(JSON.stringify({ records: recordCount, distribution, errors }, null, 2));
process.exitCode = errors.length > 0 ? 1 : 0;
