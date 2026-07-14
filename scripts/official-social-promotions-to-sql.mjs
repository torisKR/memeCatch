#!/usr/bin/env node
/** Convert fully reviewed official social rows into idempotent SQL. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseNativeSocialContent } from "./social-content.mjs";

const [inputPath] = process.argv.slice(2);
if (!inputPath || !existsSync(resolve(inputPath))) {
  console.error("usage: node scripts/official-social-promotions-to-sql.mjs <approved.jsonl>");
  process.exit(2);
}

function quote(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function rows(path) {
  const result = [];
  const seen = new Set();
  for (const line of readFileSync(resolve(path), "utf8").split("\n")) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    const source = parseNativeSocialContent(row.source_url);
    if (
      !source ||
      source.platform !== "YouTube" ||
      !source.isShort ||
      row.source_platform !== "YouTube Shorts" ||
      row.content_id !== source.contentId ||
      row.promotion_status !== "approved" ||
      row.rights_holder_confirmed !== true ||
      !String(row.meme_title ?? "").trim() ||
      !String(row.creator_name ?? "").trim() ||
      seen.has(source.url)
    ) {
      throw new Error(`invalid approved promotion row: ${row.source_url ?? "unknown"}`);
    }
    seen.add(source.url);
    result.push({ ...row, source_url: source.url });
  }
  return result;
}

const statements = rows(inputPath).map((row) => `
with target as (
  select id from memes
  where title = ${quote(row.meme_title)}
    and moderation_status in ('approved', 'limited')
  limit 1
), content_insert as (
  insert into meme_contents (
    meme_id, type, platform, content_id, url, thumbnail_url, caption,
    is_representative, availability, moderation_status
  )
  select
    id, 'embed', 'YouTube', ${quote(row.content_id)}, ${quote(row.source_url)},
    ${quote(`https://i.ytimg.com/vi/${row.content_id}/hqdefault.jpg`)}, ${quote(row.title)},
    false, 'live', 'approved'
  from target
  where not exists (
    select 1 from meme_contents existing where existing.url = ${quote(row.source_url)}
  )
  returning meme_id
)
insert into meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status
)
select
  id, 'YouTube Shorts', ${quote(row.source_url)}, ${quote(row.title)},
  ${quote(row.creator_name)}, 'embeddable'
from target
where not exists (
  select 1 from meme_sources existing where existing.source_url = ${quote(row.source_url)}
);`);

process.stdout.write(`begin;\n${statements.join("\n")}\ncommit;\n`);
