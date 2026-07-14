#!/usr/bin/env node
/**
 * Create SQL batches for a remote Supabase moderation queue. This generator
 * never connects to Supabase; execute the output explicitly with
 * `supabase db query --linked --file <file>` after reviewing it.
 *
 * All records are inserted as pending and only get a Wikimedia context source.
 * No statement can publish a meme or create an embeddable content row.
 *
 * Usage:
 *   node scripts/pending-records-to-sql.mjs input.jsonl /private/tmp/pending-sql
 */
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { memeTitleKey } from "./meme-title-key.mjs";

const [inputPath, outputDir] = process.argv.slice(2);
if (!inputPath || !outputDir) {
  console.error("usage: node scripts/pending-records-to-sql.mjs input.jsonl output-dir");
  process.exit(2);
}

const q = (value) => {
  if (value === null || value === undefined) return "null";
  return `'${String(value).replaceAll("'", "''")}'`;
};
const json = (value) => `${q(JSON.stringify(value))}::jsonb`;
const textArray = (values) =>
  Array.isArray(values) && values.length > 0
    ? `array[${values.map(q).join(",")}]::text[]`
    : "'{}'::text[]";

const input = readFileSync(inputPath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const seen = new Set();
const rows = [];
for (const row of input) {
  const titleKey = memeTitleKey(row.title);
  if (!titleKey || seen.has(titleKey)) continue;
  if (
    row.review_status !== "pending" ||
    !Number.isInteger(row.year) ||
    row.year < 2000 ||
    row.year > 2020 ||
    !/^https:\/\/en\.wikipedia\.org\/wiki\//.test(row.source_url ?? "")
  ) {
    throw new Error(`invalid pending record: ${row.title}`);
  }
  seen.add(titleKey);
  const hash = createHash("sha256").update(`${row.year}:${titleKey}`).digest("hex").slice(0, 14);
  rows.push({ ...row, slug: `wm-${row.year}-${hash}` });
}

function valueTuple(row) {
  return `(${[
    q(row.title),
    q(row.slug),
    textArray(row.aliases),
    q(row.summary),
    q(row.description),
    q(row.origin),
    q(row.usage_note),
    q(row.caution),
    q(row.safety_level ?? "yellow"),
    q(row.category ?? "image"),
    q(row.media_type ?? "image"),
    q(row.difficulty ?? "normal"),
    q(row.sentiment ?? "funny"),
    Number(row.year),
    json({ work: "yellow", friends: "yellow", family: "yellow", sns: "yellow" }),
    q(row.source_url),
  ].join(", ")})`;
}

mkdirSync(outputDir, { recursive: true });
const batchSize = 50;
for (let offset = 0; offset < rows.length; offset += batchSize) {
  const batch = rows.slice(offset, offset + batchSize);
  const sql = `begin;
with input(title, slug, aliases, summary, description, origin, usage_note, caution,
  safety_level, category, media_type, difficulty, sentiment, origin_year, usage_context, source_url) as (
  values\n${batch.map(valueTuple).join(",\n")}
), ins as (
  insert into memes (title, slug, aliases, summary, description, origin, usage_note, caution,
    safety_level, lifecycle_status, moderation_status, category, media_type, difficulty, sentiment,
    origin_year, usage_context)
  select input.title, input.slug, input.aliases, input.summary, input.description, input.origin,
    input.usage_note, input.caution, input.safety_level::safety_level, 'archived'::lifecycle_status,
    'pending'::moderation_status, input.category::meme_category, input.media_type::media_type,
    input.difficulty::meme_difficulty, input.sentiment::meme_sentiment, input.origin_year,
    input.usage_context
  from input
  where not exists (
    select 1 from memes existing where lower(existing.title) = lower(input.title)
  )
  on conflict (slug) do nothing
  returning id, slug
)
insert into meme_sources (meme_id, platform, source_url, title, copyright_status)
select ins.id, 'Wikimedia reference', input.source_url,
  'Context reference — original upload still needs verification', 'unknown'::copyright_status
from ins join input using (slug);
commit;
`;
  const index = String(offset / batchSize + 1).padStart(3, "0");
  writeFileSync(join(outputDir, `pending-${index}.sql`), sql);
}

console.log(JSON.stringify({ rows: rows.length, files: Math.ceil(rows.length / batchSize), outputDir }));
