#!/usr/bin/env node
/**
 * Collect review-only TikTok candidates from an official TikTok Newsroom
 * article and verify each canonical post URL through public oEmbed metadata.
 * No app key, login, private endpoint, challenge bypass, or video download is
 * used, and the output is never published to Supabase automatically.
 *
 * Usage:
 *   node scripts/collect-tiktok-newsroom-candidates.mjs <newsroom-url> <output.jsonl> [--max=100]
 */
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { collectTikTokNewsroomCandidates } from "./tiktok-newsroom.mjs";

async function main() {
  const [articleUrl, outputPath, ...args] = process.argv.slice(2);
  if (!articleUrl || !outputPath) {
    console.error("usage: node scripts/collect-tiktok-newsroom-candidates.mjs <newsroom-url> <output.jsonl> [--max=100]");
    process.exitCode = 2;
    return;
  }

  const maxArg = args.find((arg) => arg.startsWith("--max="));
  const requestedMax = Number(maxArg?.slice(6) ?? 100);
  const max = Number.isFinite(requestedMax) ? requestedMax : 100;
  const result = await collectTikTokNewsroomCandidates(articleUrl, { max });
  const absoluteOutput = resolve(outputPath);
  mkdirSync(dirname(absoluteOutput), { recursive: true });
  writeFileSync(
    absoluteOutput,
    `${result.candidates.map((candidate) => JSON.stringify(candidate)).join("\n")}${result.candidates.length ? "\n" : ""}`,
  );

  const errorPath = `${absoluteOutput}.errors.json`;
  if (result.errors.length) writeFileSync(errorPath, `${JSON.stringify(result.errors, null, 2)}\n`);
  else if (existsSync(errorPath)) unlinkSync(errorPath);
  process.stderr.write(`${JSON.stringify({ discovered: result.discovered, candidates: result.candidates.length, errors: result.errors.length })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
