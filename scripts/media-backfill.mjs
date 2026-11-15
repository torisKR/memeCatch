#!/usr/bin/env node
/**
 * 미디어 백필 스크립트 (재실행 가능 / idempotent)
 *
 * 1) meme_contents: platform=YouTube & thumbnail_url null & content_id가 11자 유튜브 ID
 *    → thumbnail_url = https://i.ytimg.com/vi/{content_id}/hqdefault.jpg 로 PATCH
 * 2) meme_sources: YouTube watch URL(v= 추출 가능 / youtu.be 단축 포함)
 *    → 해당 meme_id에 임베드(meme_contents type=embed)가 없으면
 *      대표 임베드(type=embed, platform=YouTube, is_representative=true, approved) 삽입
 * 3) (선택) --research <file.json>: [{ "meme_id": "...", "video_id": "..." }, ...]
 *    → 실존 확인된 영상만 담긴 파일 기준으로 2와 동일한 형식으로 삽입
 *      (이미 임베드가 있는 meme_id는 스킵)
 *
 * 사용: node scripts/media-backfill.mjs [--dry-run] [--research file.json]
 * 키는 .env.local 의 NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 에서 읽음.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function loadEnv() {
  const raw = readFileSync(resolve(ROOT, ".env.local"), "utf8");
  const env = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!BASE || !KEY) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 누락 (.env.local)");
  process.exit(1);
}

const DRY = process.argv.includes("--dry-run");
const researchIdx = process.argv.indexOf("--research");
const researchFile = researchIdx > -1 ? process.argv[researchIdx + 1] : null;

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init.method ?? "GET"} ${path} → ${res.status}: ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function extractYouTubeId(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, "");
  let id = null;
  if (host === "youtube.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") id = u.searchParams.get("v");
    else if (u.pathname.startsWith("/shorts/")) id = u.pathname.split("/")[2];
    else if (u.pathname.startsWith("/embed/")) id = u.pathname.split("/")[2];
  } else if (host === "youtu.be") {
    id = u.pathname.slice(1).split("/")[0];
  }
  return id && YT_ID.test(id) ? id : null;
}

const thumbOf = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

async function countWithThumb() {
  const rows = await rest("meme_contents?select=id&thumbnail_url=not.is.null");
  return rows.length;
}

async function main() {
  console.log(`썸네일 보유 임베드 (before): ${await countWithThumb()}`);

  // ── 1) 썸네일 백필 ──
  const nullThumbs = await rest(
    "meme_contents?select=id,content_id&platform=eq.YouTube&thumbnail_url=is.null"
  );
  let patched = 0;
  for (const row of nullThumbs) {
    if (!row.content_id || !YT_ID.test(row.content_id)) {
      console.log(`  스킵(비정상 content_id): ${row.id} → ${row.content_id}`);
      continue;
    }
    if (!DRY) {
      await rest(`meme_contents?id=eq.${row.id}`, {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ thumbnail_url: thumbOf(row.content_id) }),
      });
    }
    patched++;
  }
  console.log(`1) 썸네일 백필: ${patched}건 PATCH${DRY ? " (dry-run)" : ""}`);

  // ── 임베드 보유 meme_id 집합 (2·3 공용, 삽입 시 갱신) ──
  const embeds = await rest("meme_contents?select=meme_id&type=eq.embed");
  const hasEmbed = new Set(embeds.map((r) => r.meme_id));

  async function insertEmbed(memeId, videoId, label) {
    if (hasEmbed.has(memeId)) return false;
    if (!DRY) {
      await rest("meme_contents", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({
          meme_id: memeId,
          type: "embed",
          platform: "YouTube",
          content_id: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          thumbnail_url: thumbOf(videoId),
          is_representative: true,
          moderation_status: "approved",
        }),
      });
    }
    hasEmbed.add(memeId);
    console.log(`  +임베드 ${label}: meme ${memeId} ← ${videoId}`);
    return true;
  }

  // ── 2) 소스 승격 ──
  const sources = await rest(
    "meme_sources?select=id,meme_id,source_url&or=(source_url.ilike.*youtube.com*,source_url.ilike.*youtu.be*)"
  );
  let promoted = 0;
  for (const s of sources) {
    const vid = extractYouTubeId(s.source_url);
    if (!vid) continue;
    if (await insertEmbed(s.meme_id, vid, "소스승격")) promoted++;
  }
  console.log(`2) 소스 승격: ${promoted}건 삽입${DRY ? " (dry-run)" : ""}`);

  // ── 3) 리서치 파일 삽입 (실존 확인된 video ID만 담을 것) ──
  if (researchFile) {
    const items = JSON.parse(readFileSync(resolve(ROOT, researchFile), "utf8"));
    let inserted = 0;
    for (const it of items) {
      if (!it.meme_id || !it.video_id || !YT_ID.test(it.video_id)) {
        console.log(`  스킵(형식 오류): ${JSON.stringify(it)}`);
        continue;
      }
      if (await insertEmbed(it.meme_id, it.video_id, "리서치")) inserted++;
    }
    console.log(`3) 리서치 삽입: ${inserted}건${DRY ? " (dry-run)" : ""}`);
  }

  console.log(`썸네일 보유 임베드 (after): ${await countWithThumb()}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
