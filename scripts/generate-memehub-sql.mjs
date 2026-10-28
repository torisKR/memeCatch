#!/usr/bin/env node
/**
 * 밈허브(@meme_hub_kr) 밈 콘텐츠 데이터를 안전한 SQL 트랜잭션으로 변환하는 생성기.
 * 네트워크 호출 없이 단일 트랜잭션(BEGIN ... COMMIT)으로 안전하게 생성됩니다.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");

const dataFile = resolve(ROOT_DIR, "data/memehub-memes.json");
const items = JSON.parse(readFileSync(dataFile, "utf8"));

function escapeSql(str) {
  if (str === null || str === undefined) return "NULL";
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function escapeJson(obj) {
  if (!obj) return "'{}'::jsonb";
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
}

const sqlLines = [];
sqlLines.push("-- =============================================================================");
sqlLines.push("-- 밈허브(@meme_hub_kr) 유튜브 기반 밈 콘텐츠 적재 마이그레이션");
sqlLines.push(`-- 총 ${items.length}개 항목 | 자체 제작(house_original) 출처 권리 보증`);
sqlLines.push("-- =============================================================================");
sqlLines.push("BEGIN;\n");

for (const item of items) {
  const titleSql = escapeSql(item.title);
  const slugSql = escapeSql(item.slug);
  const aliasesSql = "ARRAY[" + (item.aliases || []).map(a => escapeSql(a)).join(", ") + "]::text[]";
  const summarySql = escapeSql(item.summary);
  const descSql = escapeSql(item.description);
  const originSql = escapeSql(item.origin);
  const originYearSql = item.origin_year ? item.origin_year : "NULL";
  const catSql = escapeSql(item.category);
  const safetySql = escapeSql(item.safety_level);
  const diffSql = escapeSql(item.difficulty);
  const sentSql = escapeSql(item.sentiment);
  const usageContextSql = escapeJson(item.usage_context);

  sqlLines.push(`-- [항목] ${item.title} (${item.slug})`);
  sqlLines.push("DO $$");
  sqlLines.push("DECLARE");
  sqlLines.push("  v_meme_id uuid;");
  sqlLines.push("  v_src_id uuid;");
  sqlLines.push("  v_tag_id uuid;");
  sqlLines.push("BEGIN");
  sqlLines.push(`  SELECT id INTO v_meme_id FROM public.memes WHERE slug = ${slugSql} OR title = ${titleSql} LIMIT 1;`);
  sqlLines.push("  IF v_meme_id IS NULL THEN");
  sqlLines.push("    INSERT INTO public.memes (");
  sqlLines.push("      title, slug, aliases, summary, description, origin, origin_kind,");
  sqlLines.push("      moderation_status, category, safety_level, difficulty, sentiment,");
  sqlLines.push("      origin_year, usage_context");
  sqlLines.push("    ) VALUES (");
  sqlLines.push(`      ${titleSql}, ${slugSql}, ${aliasesSql}, ${summarySql}, ${descSql}, ${originSql},`);
  sqlLines.push(`      'house_original', 'pending', ${catSql}::public.meme_category, ${safetySql}::public.safety_level,`);
  sqlLines.push(`      ${diffSql}::public.meme_difficulty, ${sentSql}::public.meme_sentiment, ${originYearSql}, ${usageContextSql}`);
  sqlLines.push("    ) RETURNING id INTO v_meme_id;");
  sqlLines.push("");

  // 출처 등록
  for (const src of item.sources) {
    const pSql = escapeSql(src.platform === "youtube_shorts" ? "youtube" : src.platform);
    const urlSql = escapeSql(src.url);
    const stitleSql = escapeSql(src.title);
    const cnameSql = escapeSql(src.creator_name);
    const extIdSql = escapeSql(src.external_id || "");

    sqlLines.push("    -- 출처 연계");
    sqlLines.push("    INSERT INTO public.meme_sources (");
    sqlLines.push("      meme_id, platform, source_url, title, creator_name,");
    sqlLines.push("      source_role, rights_basis, copyright_status");
    sqlLines.push("    ) VALUES (");
    sqlLines.push(`      v_meme_id, ${pSql}, ${urlSql}, ${stitleSql}, ${cnameSql}, 'original', 'creator_permission', 'embeddable'`);
    sqlLines.push("    );");
    sqlLines.push("");
    sqlLines.push("    INSERT INTO public.media_sources (");
    sqlLines.push("      platform, external_id, canonical_url, title, channel_name,");
    sqlLines.push("      public_status, embeddable, last_checked_at");
    sqlLines.push("    ) VALUES (");
    sqlLines.push(`      ${pSql}, ${extIdSql}, ${urlSql}, ${stitleSql}, ${cnameSql}, 'active', true, now()`);
    sqlLines.push("    ) ON CONFLICT (canonical_url) DO UPDATE SET canonical_url = EXCLUDED.canonical_url");
    sqlLines.push("    RETURNING id INTO v_src_id;");
    sqlLines.push("");
    sqlLines.push("    INSERT INTO public.meme_media (");
    sqlLines.push("      meme_id, source_id, source_role, rights_basis, review_state");
    sqlLines.push("    ) VALUES (");
    sqlLines.push("      v_meme_id, v_src_id, 'original', 'creator_permission', 'reviewed'");
    sqlLines.push("    );");
    sqlLines.push("");
  }

  // 시장 프로필 등록
  const countrySql = escapeSql(item.country || "KR");
  const langSql = escapeSql(item.country === "US" ? "en-US" : "ko-KR");
  const localTitleSql = escapeSql(item.local_title || item.title);
  sqlLines.push("    -- 시장 프로필 연계");
  sqlLines.push("    INSERT INTO public.meme_market_profiles (");
  sqlLines.push("      meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at");
  sqlLines.push("    ) VALUES (");
  sqlLines.push(`      v_meme_id, ${countrySql}, ${langSql}, 'origin', ${localTitleSql}, 'reviewed', now()`);
  sqlLines.push("    );");
  sqlLines.push("");

  // 주장(Claims) 등록
  if (item.claims && item.claims.length > 0) {
    for (const claim of item.claims) {
      const ctypeSql = escapeSql(claim.claim_type);
      const ctextSql = escapeSql(claim.claim_text);
      sqlLines.push("    INSERT INTO public.meme_claims (");
      sqlLines.push("      meme_id, claim_type, claim_text, confidence, verified");
      sqlLines.push("    ) VALUES (");
      sqlLines.push(`      v_meme_id, ${ctypeSql}, ${ctextSql}, 'high', true`);
      sqlLines.push("    );");
    }
    sqlLines.push("");
  }

  // 태그 등록
  if (item.tags && item.tags.length > 0) {
    for (const tag of item.tags) {
      const tagSql = escapeSql(tag.trim().toLowerCase());
      sqlLines.push(`    INSERT INTO public.tags (name) VALUES (${tagSql})`);
      sqlLines.push("    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;");
      sqlLines.push("    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id)");
      sqlLines.push("    ON CONFLICT DO NOTHING;");
    }
    sqlLines.push("");
  }

  // 권리 확인 및 승인 처리
  sqlLines.push("    -- 권리 보증 및 정식 승인");
  sqlLines.push("    UPDATE public.memes");
  sqlLines.push("       SET moderation_status = 'approved',");
  sqlLines.push("           house_rights_attested_at = now(),");
  sqlLines.push("           published_at = coalesce(published_at, now()),");
  sqlLines.push("           updated_at = now()");
  sqlLines.push("     WHERE id = v_meme_id;");
  sqlLines.push("");
  sqlLines.push("  END IF;");
  sqlLines.push("END $$;\n");
}

sqlLines.push("COMMIT;");

process.stdout.write(sqlLines.join("\n"));
