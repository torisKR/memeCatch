#!/usr/bin/env node
/**
 * Convert fully reviewed, non-representative TikTok/Instagram embeds into an
 * exact-target, idempotent SQL transaction. These rows are contextual examples,
 * never an assertion that the social post is the original meme source.
 */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseNativeSocialContent } from "./social-content.mjs";

function quote(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

export function validateContextualPromotion(row) {
  const source = parseNativeSocialContent(row?.source_url);
  const sourceUrl = source?.url ? new URL(source.url) : null;
  const verifiedAt = Date.parse(String(row?.oembed_verified_at ?? ""));
  const valid =
    source &&
    ["TikTok", "Instagram"].includes(source.platform) &&
    source.platform === row?.source_platform &&
    source.contentId === row?.content_id &&
    sourceUrl?.search === "" &&
    row?.catalog_match_status === "exact" &&
    row?.source_role === "contextual_derivative" &&
    row?.rights_basis === "platform_public_embed" &&
    row?.is_representative === false &&
    row?.promotion_status === "approved" &&
    Number.isFinite(verifiedAt) &&
    String(row?.meme_title ?? "").trim() &&
    String(row?.title ?? "").trim() &&
    String(row?.creator_name ?? "").trim();

  if (!valid) throw new Error(`invalid contextual social promotion: ${row?.source_url ?? "unknown"}`);
  return { ...row, source_url: source.url, source_platform: source.platform };
}

export function contextualSocialPromotionsSql(inputRows) {
  if (!Array.isArray(inputRows) || inputRows.length === 0) {
    throw new Error("at least one contextual social promotion is required");
  }
  const seen = new Set();
  const rows = inputRows.map(validateContextualPromotion);
  for (const row of rows) {
    if (seen.has(row.source_url)) throw new Error(`duplicate contextual social promotion: ${row.source_url}`);
    seen.add(row.source_url);
  }

  const values = rows.map((row) => `(
    ${quote(row.meme_title)}, ${quote(row.source_platform)}, ${quote(row.source_url)},
    ${quote(row.content_id)}, ${quote(row.title)}, ${quote(row.creator_name)}
  )`).join(",\n");

  return `begin;
create temporary table contextual_social_promotion_batch (
  meme_title text not null,
  source_platform text not null,
  source_url text primary key,
  content_id text not null,
  title text not null,
  creator_name text not null
) on commit drop;

insert into contextual_social_promotion_batch (
  meme_title, source_platform, source_url, content_id, title, creator_name
) values
${values};

do $$
declare matched integer;
begin
  select count(*) into matched
  from contextual_social_promotion_batch batch
  join memes meme on meme.title = batch.meme_title
  where meme.moderation_status in ('approved', 'limited');
  if matched <> ${rows.length} then
    raise exception 'limited promotion target count expected ${rows.length}, matched %', matched;
  end if;
end $$;

insert into meme_contents (
  meme_id, type, platform, content_id, url, caption,
  is_representative, availability, moderation_status
)
select
  meme.id, 'embed', batch.source_platform, batch.content_id, batch.source_url,
  batch.title, false, 'live', 'approved'
from contextual_social_promotion_batch batch
join memes meme on meme.title = batch.meme_title
  and meme.moderation_status in ('approved', 'limited')
where not exists (
  select 1 from meme_contents existing where existing.url = batch.source_url
);

insert into meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status
)
select
  meme.id, batch.source_platform, batch.source_url, batch.title,
  batch.creator_name, 'embeddable'
from contextual_social_promotion_batch batch
join memes meme on meme.title = batch.meme_title
  and meme.moderation_status in ('approved', 'limited')
where not exists (
  select 1 from meme_sources existing where existing.source_url = batch.source_url
);
commit;
`;
}

function rowsFromJsonl(path) {
  return readFileSync(resolve(path), "utf8")
    .split("\n")
    .filter(Boolean)
    .map(JSON.parse);
}

function main() {
  const [inputPath] = process.argv.slice(2);
  if (!inputPath || !existsSync(resolve(inputPath))) {
    console.error("usage: node scripts/contextual-social-promotions-to-sql.mjs <approved.jsonl>");
    process.exitCode = 2;
    return;
  }
  process.stdout.write(contextualSocialPromotionsSql(rowsFromJsonl(inputPath)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
