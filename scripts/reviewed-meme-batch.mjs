#!/usr/bin/env node
/**
 * Validate a reviewed text-only editorial batch and optionally print a SQL-only
 * transaction. This CLI never connects to Supabase or executes generated SQL.
 *
 * Usage:
 *   node scripts/reviewed-meme-batch.mjs [batch.json]       # validate / dry run
 *   node scripts/reviewed-meme-batch.mjs [batch.json] --sql # print SQL only
 *
 * validateReviewedBatch returns an array of human-readable errors (empty means
 * valid). buildReviewedBatchSql throws an Error containing those errors when
 * given an invalid batch.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { memeTitleKey } from "./meme-title-key.mjs";

const CATEGORIES = new Set(["phrase", "dance", "song", "image", "comment", "challenge"]);
const YEAR_PRECISIONS = new Set(["exact", "year", "approximate", "decade", "unknown"]);
const ROOT_KEYS = ["batch_id", "checked_at", "records"];
const RECORD_KEYS = [
  "slug", "title", "aliases", "summary", "description", "origin", "usage_note", "caution",
  "category", "origin_year", "meme_first_seen_year", "revival_years", "year_precision",
  "usage_examples", "sources", "review_note",
];
const SOURCE_KEYS = ["url", "title", "publisher", "published_on"];
const USAGE_EXAMPLE_KEYS = ["situation", "text"];
const PRIVATE_HOST_SUFFIXES = [
  ".localhost", ".local", ".internal", ".test", ".invalid", ".onion", ".example",
  ".example.com", ".example.net", ".example.org",
];
const TRACKING_PARAM = /^(utm_.+|fbclid|gclid|mc_cid|mc_eid)$/i;

function ownKeys(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? Object.keys(value) : [];
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function checkKeys(value, allowed, path, errors) {
  for (const key of ownKeys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}: unexpected field ${JSON.stringify(key)}`);
  }
  for (const key of allowed) {
    if (!Object.hasOwn(value ?? {}, key)) errors.push(`${path}.${key}: required field is missing`);
  }
}

function boundedText(value, path, max, errors) {
  if (typeof value !== "string") {
    errors.push(`${path}: must be a string`);
    return "";
  }
  const trimmed = value.trim();
  const length = Array.from(trimmed).length;
  if (!trimmed) errors.push(`${path}: must not be empty`);
  if (length > max) errors.push(`${path}: must be at most ${max} characters`);
  return trimmed;
}

function validCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseIsoTimestamp(value) {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/.exec(value);
  if (!match || !validCalendarDate(match[1])) return null;
  if (Number(match[2]) > 23 || Number(match[3]) > 59 || Number(match[4]) > 59) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? { time, date: match[1] } : null;
}

/** Canonicalize public HTTPS links without fetching or rewriting their content. */
export function canonicalSourceUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2048) return null;
  let url;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  const ipHost = host.replace(/^\[|\]$/g, "");
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !host.includes(".") ||
    isIP(ipHost) ||
    ["example.com", "example.net", "example.org"].includes(host) ||
    PRIVATE_HOST_SUFFIXES.some((suffix) => host === suffix.slice(1) || host.endsWith(suffix))
  ) return null;

  url.hostname = host;
  url.hash = "";
  url.pathname = url.pathname.replace(/\/{2,}/g, "/");
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

function validateYear(value, path, latestYear, errors, { nullable = false } = {}) {
  if (nullable && value === null) return;
  if (!Number.isInteger(value) || value < 1980 || value > 2100) {
    errors.push(`${path}: must be an integer from 1980 through 2100${nullable ? " or null" : ""}`);
  } else if (value > latestYear) {
    errors.push(`${path}: future year ${value} is not allowed`);
  }
}

function validateRecord(record, index, checkedAt, errors, identities, slugs) {
  const path = `records[${index}]`;
  if (!isObject(record)) {
    errors.push(`${path}: must be an object`);
    return;
  }
  checkKeys(record, RECORD_KEYS, path, errors);

  const slug = boundedText(record.slug, `${path}.slug`, 100, errors);
  if (slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    errors.push(`${path}.slug: use lowercase ASCII words separated by single hyphens`);
  }
  if (slug) {
    if (slugs.has(slug)) errors.push(`${path}.slug: duplicate slug ${JSON.stringify(slug)}`);
    slugs.add(slug);
  }

  const title = boundedText(record.title, `${path}.title`, 160, errors);
  const aliases = record.aliases;
  const names = [title];
  if (!Array.isArray(aliases)) {
    errors.push(`${path}.aliases: must be an array of strings`);
  } else {
    if (aliases.length > 30) errors.push(`${path}.aliases: must contain at most 30 items`);
    aliases.forEach((alias, aliasIndex) => {
      names.push(boundedText(alias, `${path}.aliases[${aliasIndex}]`, 160, errors));
    });
  }
  for (const name of names) {
    const key = memeTitleKey(name);
    if (!key) {
      if (name) errors.push(`${path}: title/alias must contain a letter or number`);
      continue;
    }
    const prior = identities.get(key);
    if (prior) errors.push(`${path}: normalized title/alias duplicates ${prior}`);
    else identities.set(key, `${path} (${JSON.stringify(name)})`);
  }

  boundedText(record.summary, `${path}.summary`, 500, errors);
  boundedText(record.description, `${path}.description`, 6000, errors);
  boundedText(record.origin, `${path}.origin`, 2000, errors);
  boundedText(record.usage_note, `${path}.usage_note`, 1000, errors);
  boundedText(record.caution, `${path}.caution`, 1000, errors);
  boundedText(record.review_note, `${path}.review_note`, 1000, errors);

  if (!CATEGORIES.has(record.category)) errors.push(`${path}.category: must be one of ${[...CATEGORIES].join(", ")}`);
  validateYear(record.origin_year, `${path}.origin_year`, Number(checkedAt?.date?.slice(0, 4)), errors, { nullable: true });
  validateYear(record.meme_first_seen_year, `${path}.meme_first_seen_year`, Number(checkedAt?.date?.slice(0, 4)), errors, { nullable: true });

  if (!Array.isArray(record.revival_years)) {
    errors.push(`${path}.revival_years: must be an array of years`);
  } else {
    if (record.revival_years.length > 20) errors.push(`${path}.revival_years: must contain at most 20 years`);
    const years = new Set();
    record.revival_years.forEach((year, yearIndex) => {
      validateYear(year, `${path}.revival_years[${yearIndex}]`, Number(checkedAt?.date?.slice(0, 4)), errors);
      if (years.has(year)) errors.push(`${path}.revival_years[${yearIndex}]: duplicate year ${year}`);
      years.add(year);
    });
  }
  if (!YEAR_PRECISIONS.has(record.year_precision)) {
    errors.push(`${path}.year_precision: must be one of ${[...YEAR_PRECISIONS].join(", ")}`);
  }

  if (!Array.isArray(record.usage_examples)) {
    errors.push(`${path}.usage_examples: must be an array`);
  } else {
    if (record.usage_examples.length > 20) errors.push(`${path}.usage_examples: must contain at most 20 items`);
    record.usage_examples.forEach((example, exampleIndex) => {
      const examplePath = `${path}.usage_examples[${exampleIndex}]`;
      if (!isObject(example)) {
        errors.push(`${examplePath}: must be an object`);
        return;
      }
      checkKeys(example, USAGE_EXAMPLE_KEYS, examplePath, errors);
      boundedText(example.situation, `${examplePath}.situation`, 200, errors);
      boundedText(example.text, `${examplePath}.text`, 1000, errors);
    });
  }

  if (!Array.isArray(record.sources)) {
    errors.push(`${path}.sources: must be an array`);
    return;
  }
  if (record.sources.length < 2) errors.push(`${path}.sources: requires at least 2 distinct sources`);
  if (record.sources.length > 10) errors.push(`${path}.sources: must contain at most 10 sources`);
  const localUrls = new Set();
  record.sources.forEach((source, sourceIndex) => {
    const sourcePath = `${path}.sources[${sourceIndex}]`;
    if (!isObject(source)) {
      errors.push(`${sourcePath}: must be an object`);
      return;
    }
    checkKeys(source, SOURCE_KEYS, sourcePath, errors);
    const canonical = canonicalSourceUrl(source.url);
    if (!canonical) {
      errors.push(`${sourcePath}.url: must be a public HTTPS URL without credentials or a private/local host`);
    } else {
      if (localUrls.has(canonical)) errors.push(`${sourcePath}.url: duplicate canonical URL in this record`);
      localUrls.add(canonical);
    }
    boundedText(source.title, `${sourcePath}.title`, 300, errors);
    boundedText(source.publisher, `${sourcePath}.publisher`, 200, errors);
    const publishedOn = source.published_on;
    if (typeof publishedOn !== "string" || !validCalendarDate(publishedOn)) {
      errors.push(`${sourcePath}.published_on: must be a valid YYYY-MM-DD date`);
    } else if (checkedAt && publishedOn > checkedAt.date) {
      errors.push(`${sourcePath}.published_on: date is after checked_at`);
    }
  });
  if (localUrls.size < 2) errors.push(`${path}.sources: requires at least 2 distinct valid canonical URLs`);
}

/** Return validation error strings; an empty array means the batch is valid. */
export function validateReviewedBatch(batch, { now = new Date() } = {}) {
  const errors = [];
  if (!isObject(batch)) return ["batch: must be an object"];
  checkKeys(batch, ROOT_KEYS, "batch", errors);
  boundedText(batch.batch_id, "batch.batch_id", 120, errors);
  const checkedAt = parseIsoTimestamp(batch.checked_at);
  if (!checkedAt) {
    errors.push("batch.checked_at: must be a valid ISO timestamp with timezone");
  } else if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    errors.push("now: must be a valid Date");
  } else if (checkedAt.time > now.getTime()) {
    errors.push("batch.checked_at: future timestamp is not allowed");
  }

  if (!Array.isArray(batch.records)) {
    errors.push("batch.records: must be an array");
  } else {
    if (batch.records.length < 1) errors.push("batch.records: must contain at least one record");
    if (batch.records.length > 200) errors.push("batch.records: must contain at most 200 records");
    const identities = new Map();
    const slugs = new Set();
    batch.records.forEach((record, index) => validateRecord(record, index, checkedAt, errors, identities, slugs));
  }
  return errors;
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values) {
  return `array[${values.map(sqlString).join(", ")}]::text[]`;
}

function inputRowSql(record, batch) {
  const identityKeys = [...new Set([record.title, ...record.aliases].map(memeTitleKey))];
  const usageContext = {
    work: "yellow",
    friends: "yellow",
    family: "yellow",
    sns: "yellow",
    editorial_review: {
      batch_id: batch.batch_id,
      checked_at: batch.checked_at,
      review_note: record.review_note,
      sources: record.sources.map((source) => ({
        url: canonicalSourceUrl(source.url),
        published_on: source.published_on,
      })),
    },
  };
  return `(${[
    sqlString(record.slug),
    sqlString(record.title.trim()),
    sqlTextArray(record.aliases.map((alias) => alias.trim())),
    sqlString(record.summary.trim()),
    sqlString(record.description.trim()),
    sqlString(record.origin.trim()),
    sqlString(record.usage_note.trim()),
    sqlString(record.caution.trim()),
    sqlString(record.category),
    record.origin_year === null ? "null::integer" : `${record.origin_year}::integer`,
    record.meme_first_seen_year === null ? "null::smallint" : `${record.meme_first_seen_year}::smallint`,
    sqlTextArray(record.revival_years),
    sqlString(record.year_precision),
    sqlJson(record.usage_examples),
    sqlJson(usageContext),
    sqlJson(record.sources.map((source) => ({
      url: canonicalSourceUrl(source.url),
      title: source.title.trim(),
      publisher: source.publisher.trim(),
      published_on: source.published_on,
    }))),
    sqlTextArray(identityKeys),
  ].join(", ")})`;
}

/** Build a reviewed, idempotent transaction. Invalid input throws with all errors. */
export function buildReviewedBatchSql(batch, options = {}) {
  const errors = validateReviewedBatch(batch, options);
  if (errors.length) throw new Error(`Invalid reviewed meme batch:\n${errors.map((error) => `- ${error}`).join("\n")}`);

  const tableSuffix = createHash("sha256").update(batch.batch_id).digest("hex").slice(0, 12);
  const tempTable = `reviewed_meme_batch_${tableSuffix}`;
  const columns = [
    "slug", "title", "aliases", "summary", "description", "origin", "usage_note", "caution",
    "category", "origin_year", "meme_first_seen_year", "revival_years", "year_precision",
    "usage_examples", "usage_context", "sources", "identity_keys",
  ];
  const values = batch.records.map((record) => inputRowSql(record, batch)).join(",\n  ");

  return `begin;
create temporary table ${tempTable} (
  id uuid primary key,
  slug text not null,
  sources jsonb not null
) on commit drop;

with input(${columns.join(", ")}) as (
  values
  ${values}
), inserted as (
  insert into public.memes (
    slug, title, aliases, summary, description, origin, usage_note, caution,
    category, origin_year, meme_first_seen_year, revival_years, year_precision,
    usage_examples, usage_context, safety_level, lifecycle_status,
    moderation_status, media_type, trend_score
  )
  select
    input.slug, input.title, input.aliases, input.summary, input.description,
    input.origin, input.usage_note, input.caution,
    input.category::public.meme_category, input.origin_year, input.meme_first_seen_year,
    input.revival_years::smallint[], input.year_precision, input.usage_examples, input.usage_context,
    'yellow'::public.safety_level, 'active'::public.lifecycle_status,
    'pending'::public.moderation_status, 'text'::public.media_type, 0
  from input
  where not exists (
    select 1
    from public.memes as existing
    where existing.slug = input.slug
       or exists (
         select 1
         from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
         where regexp_replace(lower(normalize(prior.name, NFKC)), '[[:space:][:punct:]_]+', '', 'g') = any(input.identity_keys)
       )
  )
  on conflict (slug) do nothing
  returning id, slug
)
insert into pg_temp.${tempTable} (id, slug, sources)
select inserted.id, inserted.slug, input.sources
from inserted
join input using (slug);

insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status,
  source_role, rights_basis
)
select
  new_rows.id,
  'Web',
  source.item ->> 'url',
  source.item ->> 'title',
  source.item ->> 'publisher',
  'unknown'::public.copyright_status,
  'secondary_reference',
  'link_only'
from pg_temp.${tempTable} as new_rows
cross join lateral jsonb_array_elements(new_rows.sources) as source(item);

update public.memes as meme
set moderation_status = 'fact_checking'::public.moderation_status,
    updated_at = now()
from pg_temp.${tempTable} as new_rows
where meme.id = new_rows.id;

update public.memes as meme
set moderation_status = 'rights_checking'::public.moderation_status,
    updated_at = now()
from pg_temp.${tempTable} as new_rows
where meme.id = new_rows.id;

update public.memes as meme
set moderation_status = 'limited'::public.moderation_status,
    updated_at = now()
from pg_temp.${tempTable} as new_rows
where meme.id = new_rows.id;

select
  ${sqlString(batch.batch_id)} as batch_id,
  (select count(*) from pg_temp.${tempTable})::integer as inserted_count,
  ${batch.records.length} - (select count(*) from pg_temp.${tempTable})::integer as skipped_count,
  coalesce(
    (select jsonb_agg(jsonb_build_object('id', id, 'slug', slug) order by slug)
     from pg_temp.${tempTable}),
    '[]'::jsonb
  ) as inserted_ids;
commit;
`;
}

function runCli() {
  const args = process.argv.slice(2);
  const sqlOnly = args.includes("--sql");
  const inputPaths = args.filter((arg) => arg !== "--sql");
  if (inputPaths.length > 1 || args.some((arg) => arg.startsWith("-") && arg !== "--sql")) {
    console.error("usage: node scripts/reviewed-meme-batch.mjs [batch.json] [--sql]");
    process.exitCode = 2;
    return;
  }
  const inputPath = inputPaths[0] ?? "data/editorial/2026-09-28-latest-memes.json";
  let batch;
  try {
    batch = JSON.parse(readFileSync(inputPath, "utf8"));
  } catch (error) {
    console.error(`Could not read/parse ${inputPath}: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const errors = validateReviewedBatch(batch);
  if (errors.length) {
    console.error(`Invalid reviewed meme batch (${errors.length} errors):\n${errors.map((error) => `- ${error}`).join("\n")}`);
    process.exitCode = 1;
    return;
  }
  if (sqlOnly) {
    process.stdout.write(buildReviewedBatchSql(batch));
    return;
  }
  const sourceCount = batch.records.reduce((total, record) => total + record.sources.length, 0);
  console.log(JSON.stringify({
    valid: true,
    mode: "dry-run",
    batch_id: batch.batch_id,
    records: batch.records.length,
    sources: sourceCount,
    sql_emitted: false,
    database_connected: false,
  }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runCli();
