#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, "..");
const items = JSON.parse(readFileSync(resolve(ROOT_DIR, "data/timeline-memes.json"), "utf8"));

function escapeSql(str) {
  if (str === null || str === undefined) return "NULL";
  return "'" + String(str).replace(/'/g, "''") + "'";
}

const lines = [];
lines.push("-- =============================================================================");
lines.push("-- 최신부터 과거까지 시대별 밈 데이터 마이그레이션 (중복 필터링 적용)");
lines.push(`-- 총 ${items.length}개 항목 | 2026년 최신순 -> 2004년 고전순`);
lines.push("-- =============================================================================");
lines.push("DO $$");
lines.push("DECLARE");
lines.push("  v_meme_id uuid;");
lines.push("  v_tag_id uuid;");
lines.push("BEGIN");

for (const item of items) {
  const titleSql = escapeSql(item.title);
  const slugSql = escapeSql(item.slug);
  const aliasesSql = "ARRAY[" + (item.aliases || []).map(a => escapeSql(a)).join(", ") + "]::text[]";
  const summarySql = escapeSql(item.summary);
  const descSql = escapeSql(item.description);
  const originSql = escapeSql(item.origin);
  const catSql = escapeSql(item.category);
  const safetySql = escapeSql(item.safety_level);
  const diffSql = escapeSql(item.difficulty);
  const sentSql = escapeSql(item.sentiment);
  const usageContextSql = "'" + JSON.stringify(item.usage_context) + "'::jsonb";

  lines.push(`  -- [${item.origin_year}년] ${item.title}`);
  lines.push(`  IF NOT EXISTS (SELECT 1 FROM public.memes WHERE slug = ${slugSql} OR title = ${titleSql}) THEN`);
  lines.push("    INSERT INTO public.memes (");
  lines.push("      title, slug, aliases, summary, description, origin, origin_kind,");
  lines.push("      moderation_status, category, safety_level, difficulty, sentiment,");
  lines.push("      origin_year, meme_first_seen_year, usage_context, house_rights_attested_at, published_at");
  lines.push("    ) VALUES (");
  lines.push(`      ${titleSql}, ${slugSql}, ${aliasesSql}, ${summarySql}, ${descSql}, ${originSql},`);
  lines.push(`      'house_original', 'approved', ${catSql}::public.meme_category, ${safetySql}::public.safety_level,`);
  lines.push(`      ${diffSql}::public.meme_difficulty, ${sentSql}::public.meme_sentiment, ${item.origin_year}, ${item.origin_year},`);
  lines.push(`      ${usageContextSql}, now(), now()`);
  lines.push("    ) RETURNING id INTO v_meme_id;");
  lines.push("");

  for (const src of item.sources) {
    const urlSql = escapeSql(src.url);
    const stitleSql = escapeSql(src.title);
    const cnameSql = escapeSql(src.creator_name);
    lines.push("    INSERT INTO public.meme_sources (meme_id, platform, source_url, title, creator_name, source_role, rights_basis, copyright_status)");
    lines.push(`    VALUES (v_meme_id, 'youtube', ${urlSql}, ${stitleSql}, ${cnameSql}, 'original', 'creator_permission', 'embeddable');`);
  }
  lines.push("");
  const localTitleSql = escapeSql(item.title);
  lines.push("    INSERT INTO public.meme_market_profiles (meme_id, market_code, language_tag, role, local_title, review_state, reviewed_at)");
  lines.push(`    VALUES (v_meme_id, 'KR', 'ko-KR', 'origin', ${localTitleSql}, 'reviewed', now());`);
  lines.push("");
  lines.push("    INSERT INTO public.meme_claims (meme_id, claim_type, claim_text, confidence, verified)");
  lines.push(`    VALUES (v_meme_id, 'origin', ${escapeSql(item.summary)}, 'high', true);`);
  lines.push("");

  for (const tag of item.tags) {
    const tagSql = escapeSql(tag.trim().toLowerCase());
    lines.push(`    INSERT INTO public.tags (name) VALUES (${tagSql}) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id INTO v_tag_id;`);
    lines.push("    INSERT INTO public.meme_tags_map (meme_id, tag_id) VALUES (v_meme_id, v_tag_id) ON CONFLICT DO NOTHING;");
  }

  lines.push("  END IF;");
  lines.push("");
}
lines.push("END $$;");

process.stdout.write(lines.join("\n"));
