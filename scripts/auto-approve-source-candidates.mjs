#!/usr/bin/env node
/**
 * Legacy source candidate heuristic, retained for read-only preview only.
 * Title/channel matches and technical embeddability do not establish content
 * accuracy, official channel ownership, or rights. Operators review each
 * candidate through /admin/sources before it can be published.
 *
 * Usage: node scripts/auto-approve-source-candidates.mjs --operator-confirm-auto-approve --dry-run [--limit=2000]
 * The old non-dry-run invocation is disabled, even with confirmation.
 */
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createRestClient, restAll } from "./source-pipeline-rest.mjs";

const PLATFORMS = new Set(["youtube", "youtube_shorts", "tiktok", "instagram"]);

function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s\-_.,!?~'""''“”‘’()（）\[\]{}|｜:;·…^*#@/\\]+/g, "");
}

function titleMatches(meme, source) {
  const videoTitle = norm(source.title);
  const channel = norm(source.channel_name);
  if (!videoTitle && !channel) return false;
  const names = [meme.title, ...(meme.aliases ?? [])].map(norm).filter((n) => n.length >= 2);
  for (const name of names.filter((n) => n.length >= 3)) {
    if (channel && (channel === name || channel.includes(name))) return "channel";
  }
  for (const name of names) {
    if (videoTitle && videoTitle.includes(name)) return "title";
  }
  return false;
}

export async function previewSourceCandidates(rest, limit) {
  const pending = await restAll(
    rest,
    "meme_media?select=meme_id,source_id,media_sources(id,platform,external_id,canonical_url,title,channel_name,embeddable,removed_at,thumbnail_url),memes(title,aliases)&review_state=eq.pending",
  );
  const targets = pending.slice(0, limit);
  console.error(`대기 후보 ${pending.length}건 중 ${targets.length}건 검사 (읽기 전용)`);
  // `approved` is the legacy dry-run field: the number of heuristic matches,
  // never the number of approvals. Kept for existing dry-run consumers.
  const stats = { approved: 0, skipped: 0, failed: 0, byPlatform: {}, byMatch: {} };
  for (const row of targets) {
    try {
      const source = row.media_sources;
      const meme = row.memes;
      if (!source || !meme || source.removed_at || source.embeddable !== true || !PLATFORMS.has(source.platform)) {
        stats.skipped += 1;
        continue;
      }
      const match = titleMatches(meme, source);
      if (!match) {
        stats.skipped += 1;
        continue;
      }
      stats.approved += 1;
      stats.byPlatform[source.platform] = (stats.byPlatform[source.platform] ?? 0) + 1;
      stats.byMatch[match] = (stats.byMatch[match] ?? 0) + 1;
    } catch (error) {
      stats.failed += 1;
      console.error(`실패 ${row.meme_id}:${row.source_id} — ${error instanceof Error ? error.message : error}`);
    }
  }
  return { dryRun: true, ...stats };
}

export async function main(args, { restFactory = createRestClient, stdout = console.log, stderr = console.error } = {}) {
  if (!args.includes("--operator-confirm-auto-approve")) {
    stderr("거부: --operator-confirm-auto-approve 플래그가 필요합니다.");
    process.exitCode = 2;
    return;
  }
  if (!args.includes("--dry-run")) {
    stderr("거부: 자동 승인·게시 쓰기 기능은 비활성화되었습니다. --dry-run으로 후보를 확인하고 /admin/sources에서 개별 검수하세요.");
    process.exitCode = 2;
    return;
  }
  const limitArg = args.find((a) => a.startsWith("--limit="));
  const limit = Math.max(1, Number(limitArg?.slice(8) ?? 2000));
  stderr("읽기 전용: 결과의 approved는 승인 건수가 아닌 휴리스틱 일치 건수입니다.");
  stdout(JSON.stringify(await previewSourceCandidates(restFactory(), limit)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main(process.argv.slice(2));
}
