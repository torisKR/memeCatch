#!/usr/bin/env node
/**
 * 검증된 밈 JSONL → 시드 SQL 변환기
 * 사용: node scripts/jsonl-to-sql.mjs <입력 glob 디렉터리> <출력 디렉터리> [배치크기]
 * 출력: seed-001.sql, seed-002.sql ... (INSERT ... ON CONFLICT DO NOTHING)
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { parseNativeSocialContent } from "./social-content.mjs";
import { memeTitleKey } from "./meme-title-key.mjs";
import { normalizeMemeCategory } from "./normalize-meme-category.mjs";

const [inDir, outDir, batchSizeArg] = process.argv.slice(2);
if (!inDir || !outDir) {
  console.error("usage: node scripts/jsonl-to-sql.mjs <inDir> <outDir> [batchSize]");
  process.exit(1);
}
const BATCH = Number(batchSizeArg ?? 150);

const MEDIA = new Set(["image", "video", "audio", "text", "embed"]);
const SAFETY = new Set(["green", "yellow", "gray", "red"]);
const DIFF = new Set(["beginner", "normal", "deep"]);
const SENT = new Set(["funny", "ironic", "controversial", "negative", "wholesome"]);

const q = (s) => (s == null || s === "" ? "null" : `'${String(s).replaceAll("'", "''")}'`);
const arr = (a) =>
  !a || a.length === 0
    ? "'{}'"
    : `array[${a.map((x) => q(x)).join(",")}]::text[]`;

function detectPlatform(url, fallback) {
  if (!url) return fallback ?? null;
  if (/youtube\.com|youtu\.be/i.test(url)) return "YouTube";
  if (/tiktok\.com/i.test(url)) return "TikTok";
  if (/instagram\.com/i.test(url)) return "Instagram";
  if (/x\.com|twitter\.com/i.test(url)) return "X";
  return fallback ?? "Community";
}
const seen = new Set();
const rows = [];
for (const f of readdirSync(inDir).filter((f) => f.endsWith(".jsonl")).sort()) {
  for (const line of readFileSync(join(inDir, f), "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    let m;
    try {
      m = JSON.parse(t);
    } catch {
      continue;
    }
    const title = String(m.title ?? "").trim();
    const summary = String(m.summary ?? m.content ?? m.description ?? "").trim();
    const description = String(m.description ?? summary).trim();
    const aliases = Array.isArray(m.aliases) ? m.aliases : [];
    if (!title || !summary) continue;
    const key = memeTitleKey(m.title);
    if (seen.has(key)) continue;
    seen.add(key);

    const yearFromDate = Number(String(m.date ?? "").match(/(20\d{2})/)?.[1] || 0);
    const year = Math.min(2026, Math.max(1980, Number(m.year) || yearFromDate || 2020));
    const category = normalizeMemeCategory(m.category, m.media_type);
    const media = MEDIA.has(m.media_type) ? m.media_type : "image";
    const safety = SAFETY.has(m.safety_level) ? m.safety_level : "yellow";
    const difficulty = DIFF.has(m.difficulty) ? m.difficulty : "normal";
    const sentiment = SENT.has(m.sentiment) ? m.sentiment : "funny";
    const url = m.source_url && /^https?:\/\//i.test(m.source_url) ? m.source_url : null;
    // 오래된 밈은 생애주기 archived/cooling으로 초기화
    const lifecycle = year >= 2025 ? "active" : year >= 2023 ? "cooling" : "archived";
    const slug = title.replace(/\s+/g, "-").replaceAll("'", "").slice(0, 60);

    rows.push({ m: { ...m, title, summary, description, aliases }, year, category, media, safety, difficulty, sentiment, url, lifecycle, slug });
  }
}

mkdirSync(outDir, { recursive: true });
let fileIdx = 0;
for (let i = 0; i < rows.length; i += BATCH) {
  const chunk = rows.slice(i, i + BATCH);
  const stmts = chunk.map(({ m, year, category, media, safety, difficulty, sentiment, url, lifecycle, slug }) => {
    const social = parseNativeSocialContent(url);
    const platform = social?.platform ?? detectPlatform(url, m.platform);
    const usage = m.usage_note
      ? `jsonb_build_object('work',${q(safety)},'friends','green','family',${q(safety)},'sns',${q(safety)})`
      : `'{}'::jsonb`;
  return `
with ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context, published_at)
  values (${q(m.title)}, ${q(slug)}, ${arr(m.aliases)}, ${q(m.summary)}, ${q(m.description)},
    ${q(m.origin ?? "")}, ${q(m.usage_note ?? null)}, ${q(m.caution ?? null)},
    ${q(safety)}::safety_level, ${q(lifecycle)}::lifecycle_status, 'approved'::moderation_status,
    ${q(category)}::meme_category, ${q(media)}::media_type, ${q(difficulty)}::meme_difficulty,
    ${q(sentiment)}::meme_sentiment, ${year}, ${usage}, now())
  on conflict (slug) do nothing
  returning id
)
insert into meme_sources (meme_id, platform, source_url, copyright_status)
select id, ${q(platform ?? "Community")}, ${q(url)}, ${social ? "'embeddable'" : "'unknown'"}::copyright_status from ins where ${url ? "true" : "false"};
${social ? `with ins as (
  select id from memes where slug = ${q(slug)}
)
insert into meme_contents (meme_id, type, platform, content_id, url, thumbnail_url, is_representative)
select id, 'embed'::media_type, ${q(social.platform)}, ${q(social.contentId)}, ${q(social.url)}, ${q(social.thumbnailUrl)}, true from ins
where not exists (
  select 1 from meme_contents existing where existing.meme_id = ins.id and existing.url = ${q(social.url)}
);` : ""}`;
  });
  fileIdx++;
  writeFileSync(
    join(outDir, `seed-${String(fileIdx).padStart(3, "0")}.sql`),
    `-- 밈캐치 시드 배치 ${fileIdx} (${chunk.length} rows)\nbegin;\n${stmts.join("\n")}\ncommit;\n`
  );
}
console.log(`rows=${rows.length} files=${fileIdx} out=${outDir}`);
