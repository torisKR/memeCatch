#!/usr/bin/env node
/**
 * TikTok·Instagram 콘텐츠 카드 썸네일 백필 — R2 재호스팅.
 *
 * 배경: 두 플랫폼 모두 썸네일 핫링크가 불가능하다(TikTok oEmbed는 만료 서명
 * URL, Instagram은 oEmbed에 썸네일 자체가 없음). 대신 수집 시점에는 받을 수
 * 있으므로(TikTok=oEmbed, IG=공개 embed 페이지의 게시물 이미지) 즉시 내려받아
 * R2 `meme-thumbs/`로 영구화하고 thumbnail_url을 자사 프록시 경로로 갱신한다.
 *
 * 사용: node scripts/backfill-social-thumbs.mjs
 *   - 읽기: .env.production.local(NEXT_PUBLIC_SUPABASE_*, anon)
 *   - 쓰기: R2(.env.local의 R2_*), DB 갱신 SQL은 파일로 출력(적용은 별도)
 * 출력: /tmp가 아닌 스크립트 인자 --out 디렉터리(기본 ./data/media/thumbs-out)
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { AwsClient } from "aws4fetch";

const OUT = process.argv.includes("--out")
  ? process.argv[process.argv.indexOf("--out") + 1]
  : "data/media/thumbs-out";
mkdirSync(OUT, { recursive: true });

function envFrom(file) {
  const map = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
  }
  return map;
}
const prod = envFrom(".env.production.local");
const local = envFrom(".env.local");
const SUPA = prod.NEXT_PUBLIC_SUPABASE_URL;
const KEY = prod.NEXT_PUBLIC_SUPABASE_ANON_KEY;
for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"]) {
  if (!local[k]) { console.error(`missing ${k} in .env.local`); process.exit(1); }
}
const r2 = new AwsClient({
  accessKeyId: local.R2_ACCESS_KEY_ID,
  secretAccessKey: local.R2_SECRET_ACCESS_KEY,
  service: "s3",
  region: "auto",
});
const r2Endpoint = (key) =>
  `https://${local.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${local.R2_BUCKET}/` +
  key.split("/").map(encodeURIComponent).join("/");

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

async function rows() {
  const out = [];
  for (let off = 0; ; off += 500) {
    const r = await fetch(
      `${SUPA}/rest/v1/meme_contents?select=id,platform,url,thumbnail_url&platform=in.(%22TikTok%22,%22Instagram%22)&offset=${off}&limit=500`,
      { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } },
    );
    const b = await r.json();
    if (!Array.isArray(b) || b.length === 0) break;
    out.push(...b);
  }
  return out.filter((r) => !r.thumbnail_url); // 이미 있는 건 스킵(재실행 안전)
}

async function tiktokThumb(url) {
  const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.thumbnail_url || null;
}

async function igThumb(url) {
  const page = url.endsWith("/") ? `${url}embed/captioned/` : `${url}/embed/captioned/`;
  const r = await fetch(page, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) return null;
  let html = await r.text();
  // HTML 엔티티·JSON 이스케이프 해제 — 서명 파라미터가 깨지면 403
  html = html
    .replaceAll("&amp;", "&")
    .replaceAll("\\u0026", "&")
    .replaceAll("\\/", "/");
  const urls = [...html.matchAll(/https:\/\/scontent[^"\s\\']+/g)].map((m) => m[0]);
  // t51.82787 = 프로필 사진 — 게시물 미디어만
  return urls.find((u) => !u.includes("t51.82787") && (u.includes(".jpg") || u.includes(".webp"))) ?? null;
}

/** JPEG SOF 마커에서 (w,h)를 읽는다. 프레임 헤더를 못 찾으면 null. */
function jpegDimensions(buf) {
  const b = new Uint8Array(buf);
  if (b[0] !== 0xff || b[1] !== 0xd8) return null; // SOI 아님
  let i = 2;
  while (i + 8 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    let marker = b[i + 1];
    while (marker === 0xff) marker = b[++i + 1]; // 채움 바이트 스킵
    // SOF0..SOF15(0xC0~0xCF) 중 DHT(C4)/JPG(C8)/DAC(CC) 제외 = 프레임 헤더
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return null;
    i += 2 + len;
  }
  return null;
}

async function download(u) {
  const r = await fetch(u, {
    headers: { "User-Agent": UA, Referer: "https://www.instagram.com/" },
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) return null;
  const ct = r.headers.get("content-type") || "";
  if (!ct.startsWith("image/")) return null;
  const buf = await r.arrayBuffer();
  // 하한 8KB — Instagram 로그인월/차단 시 embed 페이지가 흘리는 100×100 회색
  // 플레이스홀더(2~4.6KB)가 옛 2000 하한을 통과해 빈 썸네일로 R2에 재호스팅된 사고
  // 방지. 정상 게시물 썸네일은 최소 ~35KB(720×1280)라 8KB에서 명확히 갈린다.
  if (buf.byteLength < 8000 || buf.byteLength > 5 * 1024 * 1024) return null;
  // JPEG면 차원까지 검증 — 어느 한 변이 200px 미만이면 플레이스홀더로 보고 거부.
  const dims = ct.includes("jpeg") ? jpegDimensions(buf) : null;
  if (dims && (dims.w < 200 || dims.h < 200)) return null;
  return { buf, ct: ct.split(";")[0] };
}

const targets = await rows();
console.log(`대상(썸네일 없음): ${targets.length}건`);
const updates = [];
const failed = [];
const CONC = 3;
for (let i = 0; i < targets.length; i += CONC) {
  const chunk = targets.slice(i, i + CONC);
  await Promise.all(
    chunk.map(async (row) => {
      try {
        const src =
          row.platform === "TikTok" ? await tiktokThumb(row.url) : await igThumb(row.url);
        if (!src) return failed.push({ id: row.id, why: "no-src", platform: row.platform });
        const img = await download(src);
        if (!img) return failed.push({ id: row.id, why: "download", platform: row.platform });
        const ext = img.ct === "image/webp" ? "webp" : "jpg";
        const key = `meme-thumbs/${row.platform.toLowerCase()}/${row.id}.${ext}`;
        const put = await r2.fetch(r2Endpoint(key), {
          method: "PUT",
          headers: { "Content-Type": img.ct },
          body: img.buf,
        });
        if (!put.ok) return failed.push({ id: row.id, why: `r2 ${put.status}`, platform: row.platform });
        updates.push({ id: row.id, path: `/api/media/${key}` });
      } catch (e) {
        failed.push({ id: row.id, why: e.name, platform: row.platform });
      }
    }),
  );
  await new Promise((r) => setTimeout(r, 500));
  if (i % 30 === 0) console.error(`...${Math.min(i + CONC, targets.length)}/${targets.length} (ok ${updates.length})`);
}

const sql =
  "begin;\n" +
  updates
    .map((u) => `update meme_contents set thumbnail_url = '${u.path}' where id = '${u.id}'::uuid;`)
    .join("\n") +
  "\ncommit;\n";
writeFileSync(`${OUT}/update-thumbs.sql`, sql);
writeFileSync(`${OUT}/failed.json`, JSON.stringify(failed, null, 1));
console.log(
  JSON.stringify(
    {
      total: targets.length,
      uploaded: updates.length,
      failed: failed.length,
      failWhy: failed.reduce((a, f) => ((a[f.why] = (a[f.why] || 0) + 1), a), {}),
      sqlFile: `${OUT}/update-thumbs.sql`,
    },
    null,
    1,
  ),
);
