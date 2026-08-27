#!/usr/bin/env node
/**
 * 출처 후보 자동 승인 (보수적 규칙 — 운영자 검수의 기계적 부분만 대행).
 *
 * 승인 조건(전부 충족):
 *  1) media_sources.embeddable = true (YouTube API·oEmbed로 확인된 것)
 *  2) 삭제되지 않은 출처 (removed_at IS NULL)
 *  3) 아래 중 하나 이상의 근거 일치:
 *     - 정규화한 밈 제목/별칭이 정규화한 영상 제목에 포함
 *     - 정규화한 밈 제목/별칭과 채널명이 일치(공식 채널 휴리스틱)
 *  4) 제목이 2글자 미만이면 채널 일치만 인정(오탐 방지)
 *
 * 승인 시 source_role='usage_example', rights_basis='official_embed'로만 게시한다.
 * 'original' 표시는 절대 자동으로 붙이지 않는다.
 * 애매한 후보는 pending으로 남긴다.
 *
 * 사용: node scripts/auto-approve-source-candidates.mjs --operator-confirm-auto-approve [--dry-run] [--limit=500]
 */
import { createRestClient, restAll } from "./source-pipeline-rest.mjs";

const args = process.argv.slice(2);
const OPERATOR_CONFIRM_FLAG = "--operator-confirm-auto-approve";
if (!args.includes(OPERATOR_CONFIRM_FLAG)) {
  console.error(`거부: 이 스크립트는 운영자가 ${OPERATOR_CONFIRM_FLAG} 플래그로 직접 확인한 경우에만 실행합니다.`);
  process.exit(2);
}
const DRY = args.includes("--dry-run");
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = Math.max(1, Number(limitArg?.slice(8) ?? 2000));
const rest = createRestClient();

const DISPLAY_PLATFORM = {
  youtube: "YouTube",
  youtube_shorts: "YouTube Shorts",
  tiktok: "TikTok",
  instagram: "Instagram",
};

/** 공백·구두점 제거 + 소문자 — 제목 포함 여부 비교용 */
function norm(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[\s\-_.,!?~'""''“”‘’()（）\[\]{}|｜:;·…^*#@/\\]+/g, "");
}

function titleMatches(meme, source) {
  const videoTitle = norm(source.title);
  const channel = norm(source.channel_name);
  if (!videoTitle && !channel) return false;

  const names = [meme.title, ...(meme.aliases ?? [])]
    .map(norm)
    .filter((n) => n.length >= 2);
  const longNames = names.filter((n) => n.length >= 3);

  // 채널명 일치는 공식 채널 신호 — 3글자 이상만 인정
  for (const name of longNames) {
    if (channel && (channel === name || channel.includes(name))) return "channel";
  }
  // 영상 제목 포함 — 2글자 이상
  for (const name of names) {
    if (videoTitle && videoTitle.includes(name)) return "title";
  }
  return false;
}

const pending = await restAll(
  rest,
  "meme_media?select=meme_id,source_id,media_sources(id,platform,external_id,canonical_url,title,channel_name,embeddable,removed_at,thumbnail_url),memes(title,aliases)&review_state=eq.pending"
);
const targets = pending.slice(0, LIMIT);
console.error(`대기 후보 ${pending.length}건 중 ${targets.length}건 검사`);

const stats = { approved: 0, skipped: 0, failed: 0, byPlatform: {}, byMatch: {} };
const now = new Date().toISOString();

for (const row of targets) {
  const source = row.media_sources;
  const meme = row.memes;
  try {
    if (!source || !meme || source.removed_at || source.embeddable !== true) {
      stats.skipped += 1;
      continue;
    }
    const match = titleMatches(meme, source);
    if (!match) {
      stats.skipped += 1;
      continue;
    }
    const displayPlatform = DISPLAY_PLATFORM[source.platform];
    if (!displayPlatform) {
      stats.skipped += 1;
      continue;
    }

    if (!DRY) {
      // 1) 원장 갱신
      await rest(`meme_media?meme_id=eq.${row.meme_id}&source_id=eq.${row.source_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          review_state: "approved",
          source_role: "usage_example",
          rights_basis: "official_embed",
          reviewer_note: `auto: ${match === "channel" ? "공식 채널명 일치" : "제목 일치"}`,
          reviewed_at: now,
        }),
      });

      // 2) 출처 링크 게시 (중복 방지)
      const existingSource = await rest(
        `meme_sources?select=id&meme_id=eq.${row.meme_id}&source_url=eq.${encodeURIComponent(source.canonical_url)}`
      );
      if (!existingSource?.length) {
        await rest("meme_sources", {
          method: "POST",
          headers: { Prefer: "resolution=ignore-duplicates" },
          body: JSON.stringify({
            meme_id: row.meme_id,
            platform: displayPlatform,
            source_url: source.canonical_url,
            title: source.title,
            creator_name: source.channel_name,
            copyright_status: "embeddable",
          }),
        });
      }

      // 3) 공식 임베드 게시 (중복 방지)
      const existingContent = await rest(
        `meme_contents?select=id&meme_id=eq.${row.meme_id}&type=eq.embed&platform=eq.${encodeURIComponent(displayPlatform)}&content_id=eq.${source.external_id}`
      );
      if (!existingContent?.length) {
        await rest("meme_contents", {
          method: "POST",
          body: JSON.stringify({
            meme_id: row.meme_id,
            type: "embed",
            platform: displayPlatform,
            content_id: source.external_id,
            url: source.canonical_url,
            thumbnail_url: source.thumbnail_url,
            caption: source.title,
            is_representative: false,
            availability: "live",
            moderation_status: "approved",
          }),
        });
      }

      // 4) 감사 로그
      await rest("admin_audit_log", {
        method: "POST",
        body: JSON.stringify({
          action: "source.approve_auto",
          entity_type: "meme_media",
          entity_id: `${row.meme_id}:${row.source_id}`,
          detail: { match, platform: source.platform },
        }),
      });
    }

    stats.approved += 1;
    stats.byPlatform[source.platform] = (stats.byPlatform[source.platform] ?? 0) + 1;
    stats.byMatch[match] = (stats.byMatch[match] ?? 0) + 1;
  } catch (error) {
    stats.failed += 1;
    console.error(`실패 ${row.meme_id}:${row.source_id} — ${error instanceof Error ? error.message : error}`);
  }
}

console.log(JSON.stringify({ dryRun: DRY, ...stats }));
