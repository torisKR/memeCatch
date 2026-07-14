#!/usr/bin/env node
/** Generate an exact-count, transition-safe SQL transaction for limited rows. */
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const [inputPath, ...args] = process.argv.slice(2);
const expectedArg = Number(args.find((arg) => arg.startsWith("--expected="))?.slice(11) ?? 1000);
const expected = Number.isFinite(expectedArg) ? Math.max(1, Math.floor(expectedArg)) : 1000;
if (!inputPath || !existsSync(resolve(inputPath))) {
  console.error("usage: node scripts/limited-promotions-to-sql.mjs <limited.jsonl> [--expected=1000]");
  process.exit(2);
}

function quote(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

const rows = readFileSync(resolve(inputPath), "utf8")
  .split("\n")
  .filter(Boolean)
  .map(JSON.parse);
if (rows.length !== expected) throw new Error(`expected ${expected} promotion rows; got ${rows.length}`);

const seen = new Set();
for (const row of rows) {
  if (
    row.target_status !== "limited" ||
    !["yellow", "red"].includes(row.safety_level) ||
    !["funny", "ironic", "controversial", "negative", "wholesome"].includes(row.sentiment) ||
    !/^https:\/\/[a-z-]+\.wikipedia\.org\/wiki\//i.test(row.source_url) ||
    !String(row.caution ?? "").includes("추가 검수 중") ||
    seen.has(row.source_url)
  ) throw new Error(`invalid limited promotion row: ${row.source_url ?? "unknown"}`);
  seen.add(row.source_url);
}

const values = rows
  .map((row) => `(${quote(row.source_url)}, ${quote(row.safety_level)}, ${quote(row.sentiment)}, ${quote(row.caution)})`)
  .join(",\n");

process.stdout.write(`begin;
create temporary table limited_promotion_batch (
  source_url text primary key,
  safety_level text not null,
  sentiment text not null,
  caution text not null
) on commit drop;

insert into limited_promotion_batch (source_url, safety_level, sentiment, caution) values
${values};

do $$
declare matched integer;
begin
  select count(distinct m.id) into matched
  from memes m
  join meme_sources s on s.meme_id = m.id
  join limited_promotion_batch p on p.source_url = s.source_url
  where m.moderation_status = 'pending';
  if matched <> ${expected} then
    raise exception 'limited promotion preflight expected ${expected} pending rows, matched %', matched;
  end if;
end $$;

do $$
declare affected integer;
begin
  update memes m
  set safety_level = p.safety_level::safety_level,
      sentiment = p.sentiment::meme_sentiment,
      caution = p.caution,
      moderation_status = 'fact_checking',
      updated_at = now()
  from meme_sources s, limited_promotion_batch p
  where s.meme_id = m.id
    and p.source_url = s.source_url
    and m.moderation_status = 'pending';
  get diagnostics affected = row_count;
  if affected <> ${expected} then raise exception 'pending transition affected % rows', affected; end if;
end $$;

do $$
declare affected integer;
begin
  update memes m
  set moderation_status = 'rights_checking', updated_at = now()
  from meme_sources s, limited_promotion_batch p
  where s.meme_id = m.id
    and p.source_url = s.source_url
    and m.moderation_status = 'fact_checking';
  get diagnostics affected = row_count;
  if affected <> ${expected} then raise exception 'fact-check transition affected % rows', affected; end if;
end $$;

do $$
declare affected integer;
begin
  update memes m
  set moderation_status = 'limited', updated_at = now()
  from meme_sources s, limited_promotion_batch p
  where s.meme_id = m.id
    and p.source_url = s.source_url
    and m.moderation_status = 'rights_checking';
  get diagnostics affected = row_count;
  if affected <> ${expected} then raise exception 'limited transition affected % rows', affected; end if;
end $$;
commit;
`);
