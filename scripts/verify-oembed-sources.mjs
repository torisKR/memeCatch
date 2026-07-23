#!/usr/bin/env node
/**
 * 검수 대기 TikTok/Instagram 출처 중 미검증(embeddable IS NULL)분을
 * 공개 oEmbed로 검증한다. 스크래핑·다운로드 없이 임베드 가능 여부만 확인.
 * - 성공 → 제목·작성자 채우고 embeddable=true
 * - 404 → removed_at
 * - 일시 오류 → 다음 실행으로 보류
 *
 * 사용: node scripts/verify-oembed-sources.mjs [--limit=400] [--dry-run]
 */
import { createRestClient, restAll } from "./source-pipeline-rest.mjs";

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith("--limit="));
const LIMIT = Math.max(1, Number(limitArg?.slice(8) ?? 400));
const DRY = args.includes("--dry-run");
const rest = createRestClient();

async function checkOEmbed(platform, canonicalUrl) {
  const endpoint =
    platform === "tiktok"
      ? `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`
      : `https://graph.facebook.com/v25.0/instagram_oembed?url=${encodeURIComponent(canonicalUrl)}&maxwidth=658&omitscript=true`;
  const res = await fetch(endpoint, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404 || res.status === 400) return { ok: false, gone: true };
  if (!res.ok) return { ok: false, gone: false, status: res.status };
  const data = await res.json().catch(() => null);
  return {
    ok: true,
    title: typeof data?.title === "string" ? data.title.slice(0, 500) : null,
    author: typeof data?.author_name === "string" ? data.author_name.slice(0, 200) : null,
  };
}

const pendingLinks = await restAll(rest, "meme_media?select=source_id&review_state=eq.pending");
const pendingIds = new Set(pendingLinks.map((r) => r.source_id));

const sources = (
  await restAll(
    rest,
    "media_sources?select=id,platform,canonical_url&platform=in.(tiktok,instagram)&embeddable=is.null&removed_at=is.null"
  )
).filter((s) => pendingIds.has(s.id));
const targets = sources.slice(0, LIMIT);
console.error(`미검증 TikTok/Instagram 후보 ${sources.length}건 중 ${targets.length}건 검사`);

const now = new Date().toISOString();
const expires = new Date(Date.now() + 30 * 86_400_000).toISOString();
const stats = { checked: 0, verified: 0, removed: 0, deferred: 0 };

for (const [index, source] of targets.entries()) {
  try {
    const result = await checkOEmbed(source.platform, source.canonical_url);
    stats.checked += 1;
    if (result.ok) {
      stats.verified += 1;
      if (!DRY) {
        await rest(`media_sources?id=eq.${source.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            title: result.title,
            channel_name: result.author,
            embeddable: true,
            last_checked_at: now,
            metadata_refreshed_at: now,
            metadata_expires_at: expires,
          }),
        });
      }
    } else if (result.gone) {
      stats.removed += 1;
      if (!DRY) {
        await rest(`media_sources?id=eq.${source.id}`, {
          method: "PATCH",
          body: JSON.stringify({ removed_at: now, last_checked_at: now }),
        });
      }
    } else {
      stats.deferred += 1;
    }
  } catch {
    stats.deferred += 1;
  }
  if ((index + 1) % 100 === 0) console.error(`진행 ${index + 1}/${targets.length}`);
  await new Promise((r) => setTimeout(r, 250));
}

console.log(JSON.stringify({ dryRun: DRY, ...stats }));
