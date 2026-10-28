#!/usr/bin/env node
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

function loadEnv() {
  const envFiles = [".env.local", ".env.development", ".env.production", ".env"];
  const candidates = [];
  for (const file of envFiles) {
    const fullPath = resolve(ROOT_DIR, file);
    if (!existsSync(fullPath)) continue;
    const content = readFileSync(fullPath, "utf8");
    const fileEnv = {};
    for (const rawLine of content.split("\n")) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      let val = line.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      fileEnv[key] = val;
    }
    candidates.push({ file, env: fileEnv });
  }

  function decodeJwt(token) {
    if (!token) return null;
    try {
      const parts = token.split(".");
      if (parts.length >= 2) {
        return JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
      }
    } catch {}
    return null;
  }

  let targetUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!targetUrl) {
    for (const { env } of candidates) {
      const u = env.NEXT_PUBLIC_SUPABASE_URL;
      if (u && u.includes("supabase.co")) {
        targetUrl = u;
        break;
      }
    }
    if (!targetUrl && candidates[0]?.env.NEXT_PUBLIC_SUPABASE_URL) {
      targetUrl = candidates[0].env.NEXT_PUBLIC_SUPABASE_URL;
    }
  }

  const targetRef = targetUrl?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
  let targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!targetKey) {
    for (const { env } of candidates) {
      const key = env.SUPABASE_SERVICE_ROLE_KEY;
      const jwt = decodeJwt(key);
      if (jwt && jwt.iss !== "supabase-demo") {
        if (!targetRef || jwt.ref === targetRef) {
          targetKey = key;
          break;
        }
      }
    }
  }

  const finalEnv = {};
  for (const { env } of candidates.slice().reverse()) {
    Object.assign(finalEnv, env);
  }
  if (targetUrl) finalEnv.NEXT_PUBLIC_SUPABASE_URL = targetUrl;
  if (targetKey) finalEnv.SUPABASE_SERVICE_ROLE_KEY = targetKey;
  return finalEnv;
}

const env = loadEnv();
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

const args = process.argv.slice(2);
const isDryRun = args.includes("--dry-run");
const autoApprove = !args.includes("--keep-pending");

function getRef(token) {
  try {
    const p = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString("utf8"));
    return p.ref || p.iss;
  } catch { return "unknown"; }
}
console.log(`[설정] Supabase URL: ${SUPABASE_URL}`);
console.log(`[설정] Service Role Key: ${SERVICE_ROLE_KEY ? "OK (ref: " + getRef(SERVICE_ROLE_KEY) + ")" : "MISSING"}`);
console.log(`[설정] Dry Run: ${isDryRun}`);
console.log(`[설정] Auto Approve: ${autoApprove}`);

if (!isDryRun && (!SUPABASE_URL || !SERVICE_ROLE_KEY)) {
  console.error("에러: Supabase URL 또는 Service Role Key가 없습니다.");
  process.exit(1);
}

const supabase = (!isDryRun && SUPABASE_URL && SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null;

const dataFile = resolve(ROOT_DIR, "data/memehub-memes.json");
if (!existsSync(dataFile)) {
  console.error("에러: data/memehub-memes.json 파일이 없습니다.");
  process.exit(1);
}

const items = JSON.parse(readFileSync(dataFile, "utf8"));
console.log(`[데이터] 총 ${items.length}개 밈 로드됨\n`);

async function run() {
  let createdCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    console.log(`[${i + 1}/${items.length}] ${item.title} (${item.slug})`);

    if (isDryRun) {
      console.log(`  -> [DRY RUN] 검증 통과: ${item.category}, ${item.sources.length}개 출처`);
      createdCount++;
      continue;
    }

    try {
      // 1. 중복 확인
      const { data: existing } = await supabase
        .from("memes")
        .select("id, short_id, title, moderation_status")
        .or(`slug.eq.${item.slug},title.eq.${item.title}`)
        .maybeSingle();

      if (existing) {
        console.log(`  -> 이미 존재함 (id: ${existing.id}, 상태: ${existing.moderation_status}), 건너뜁니다.`);
        skippedCount++;
        continue;
      }

      // 2. memes 테이블 삽입 (origin_kind: house_original, moderation_status: pending)
      const memeInsertData = {
        title: item.title,
        slug: item.slug,
        aliases: item.aliases || [],
        summary: item.summary,
        description: item.description,
        origin: item.origin,
        origin_kind: "house_original",
        moderation_status: "pending",
        category: item.category,
        safety_level: item.safety_level,
        difficulty: item.difficulty,
        sentiment: item.sentiment,
        origin_year: item.origin_year,
        usage_context: item.usage_context,
      };

      const { data: memeRow, error: memeErr } = await supabase
        .from("memes")
        .insert(memeInsertData)
        .select("id, short_id, slug")
        .single();

      if (memeErr || !memeRow) {
        throw new Error(`memes insert 실패: ${memeErr?.message}`);
      }
      const memeId = memeRow.id;

      // 3. meme_sources 등록
      for (const src of item.sources) {
        const { error: srcErr } = await supabase.from("meme_sources").insert({
          meme_id: memeId,
          platform: src.platform === "youtube_shorts" ? "youtube" : src.platform,
          source_url: src.url,
          title: src.title,
          creator_name: src.creator_name,
          source_role: src.source_role || "original",
          rights_basis: src.rights_basis || "creator_permission",
          copyright_status: "embeddable",
        });
        if (srcErr) {
          console.warn(`    주의: meme_sources insert 에러: ${srcErr.message}`);
        }

        // media_sources & meme_media
        const { data: mediaSrc } = await supabase
          .from("media_sources")
          .upsert({
            platform: src.platform,
            external_id: src.external_id || "",
            canonical_url: src.url,
            title: src.title,
            channel_name: src.creator_name,
            public_status: "active",
            embeddable: true,
            last_checked_at: new Date().toISOString(),
          }, { onConflict: "canonical_url" })
          .select("id")
          .single();

        if (mediaSrc?.id) {
          await supabase.from("meme_media").insert({
            meme_id: memeId,
            source_id: mediaSrc.id,
            source_role: src.source_role || "original",
            rights_basis: src.rights_basis || "creator_permission",
            review_state: "reviewed",
          });
        }
      }

      // 4. meme_market_profiles 등록
      const { error: mpErr } = await supabase.from("meme_market_profiles").insert({
        meme_id: memeId,
        market_code: item.country || "KR",
        language_tag: item.country === "US" ? "en-US" : "ko-KR",
        role: "origin",
        local_title: item.local_title || item.title,
        review_state: "reviewed",
        reviewed_at: new Date().toISOString(),
      });
      if (mpErr) {
        console.warn(`    주의: meme_market_profiles insert 에러: ${mpErr.message}`);
      }

      // 5. claims 등록
      if (item.claims && item.claims.length > 0) {
        for (const claim of item.claims) {
          await supabase.from("meme_claims").insert({
            meme_id: memeId,
            claim_type: claim.claim_type,
            claim_text: claim.claim_text,
            confidence: claim.confidence || "high",
            verified: true,
          });
        }
      }

      // 6. 태그 매핑
      if (item.tags && item.tags.length > 0) {
        for (const tagName of item.tags) {
          const cleanTag = tagName.trim().toLowerCase();
          const { data: tagRow } = await supabase
            .from("tags")
            .upsert({ name: cleanTag }, { onConflict: "name" })
            .select("id")
            .single();
          if (tagRow?.id) {
            await supabase
              .from("meme_tags_map")
              .upsert({ meme_id: memeId, tag_id: tagRow.id }, { onConflict: "meme_id,tag_id" });
          }
        }
      }

      // 7. publish_house_original RPC 호출 (공식 발행)
      if (autoApprove) {
        const { error: pubErr } = await supabase.rpc("publish_house_original", {
          p_meme_id: memeId,
          p_to: "approved",
          p_attested: true,
        });
        if (pubErr) {
          console.warn(`    주의: publish_house_original RPC 실패 (pending 유지): ${pubErr.message}`);
        } else {
          console.log(`  -> DB 적재 및 공식 발행(approved) 성공 (id: ${memeId})`);
        }
      } else {
        console.log(`  -> DB 적재 완료 (pending 상태 유지) (id: ${memeId})`);
      }

      createdCount++;
    } catch (err) {
      console.error(`  -> 에러 발생: ${err.message}`);
      errorCount++;
    }
  }

  console.log(`\n========================================`);
  console.log(`완료 요약: 생성됨=${createdCount}, 건너뜀=${skippedCount}, 실패=${errorCount}`);
  console.log(`========================================`);
}

run();
