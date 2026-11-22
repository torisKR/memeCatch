#!/usr/bin/env node
/**
 * Validate an enrichment batch for memes that are already public, and print
 * idempotent UPDATE SQL. Never connects to a database and never runs the SQL.
 *
 *   node scripts/enrich-public-memes.mjs <batch.json>                 # validate
 *   node scripts/enrich-public-memes.mjs <batch.json> --sql --reviewed-at 2026-11-20T18:00:00+09:00
 *
 * Batch: { batch_id, checked_at, memes: [{ short_id, slug, title, description,
 *   origin, usage_note, caution, usage_examples: [{situation, text}],
 *   sources: [{url, title, publisher}], origin_year? }], dropped: [{short_id, slug, title, reason}] }
 * origin_year is optional: a year (1980-2026, the memes_origin_year_check range) replaces a stored
 * year the sources show is wrong; null clears a stored year that is wrong but has no in-range fix.
 *
 * The SQL follows data/memes/sql/20261111-loop028-priority-enrichment.sql:
 * it updates only the public row matching short_id + slug, never changes
 * moderation_status or published_at, keeps safety_reviewed_at (a trigger would
 * otherwise stamp now() when usage_note or caution changes), records
 * content_reviewed_at, and inserts a source only when the meme does not have
 * that URL yet. It has no BEGIN/COMMIT: apply with psql -v ON_ERROR_STOP=1 -1.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalSourceUrl } from "./reviewed-meme-batch.mjs";

/** lib/content-depth.ts: MIN_PROSE_CHARS_INDEX, SUPPORTING_PROSE, boilerplate origin. */
const MIN_PROSE = 250;
const SUPPORTING_PROSE = 40;
const BOILERPLATE_ORIGIN = /공개\s*Wikimedia\s*기록을\s*바탕으로/;
const SHORT_ID = /^[a-z0-9]{8}$/;
const MAX_FIELD = 3000;
const EARLIEST_YEAR = 1980; // memes_origin_year_check
const LATEST_YEAR = 2026;
/** A title that describes a failed fetch instead of naming the page. */
const NOTE_TITLE = /표시되지 않|헤드라인이 (?:없|안)|본문 첫 줄|제목 없음|^\s*untitled\s*$|^\s*unknown\s*$/i;
/** Self links and hosts that block crawlers or were unreliable in loop-028. */
const BLOCKED_HOSTS = ["catchmeme.com", "namu.wiki", "merriam-webster.com", "vop.co.kr", "etnews.com"];

const trimmed = (value) => (typeof value === "string" ? value.trim() : "");

function validExamples(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((e) => e && typeof e === "object" && trimmed(e.situation) && trimmed(e.text));
}

/** Unique prose as lib/content-depth.ts counts it (contentDepth().proseChars). */
export function proseChars(meme) {
  const origin = BOILERPLATE_ORIGIN.test(trimmed(meme.origin)) ? 0 : trimmed(meme.origin).length;
  const usage = trimmed(meme.usage_note).length;
  const caution = trimmed(meme.caution).length;
  const examples = validExamples(meme.usage_examples)
    .reduce((sum, e) => sum + trimmed(e.situation).length + trimmed(e.text).length, 0);
  return trimmed(meme.description).length + origin
    + (usage >= SUPPORTING_PROSE ? usage : 0)
    + (caution >= SUPPORTING_PROSE ? caution : 0)
    + examples;
}

function blockedHost(url) {
  const host = new URL(url).hostname;
  return BLOCKED_HOSTS.some((blocked) => host === blocked || host.endsWith(`.${blocked}`));
}

export function validateEnrichmentBatch(batch) {
  const errors = [];
  if (!batch || typeof batch !== "object") return ["batch: must be an object"];
  if (!trimmed(batch.batch_id)) errors.push("batch_id: required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed(batch.checked_at))) errors.push("checked_at: YYYY-MM-DD required");
  if (!Array.isArray(batch.memes) || batch.memes.length === 0) return [...errors, "memes: non-empty array required"];

  const seen = new Set();
  for (const [index, meme] of batch.memes.entries()) {
    const at = `memes[${index}] ${trimmed(meme?.title) || "?"}`;
    if (!SHORT_ID.test(trimmed(meme?.short_id))) errors.push(`${at}: short_id must be 8 lowercase letters or digits`);
    else if (seen.has(meme.short_id)) errors.push(`${at}: duplicate short_id ${meme.short_id}`);
    else seen.add(meme.short_id);
    if (!trimmed(meme?.slug)) errors.push(`${at}: slug required`);
    for (const field of ["description", "origin", "usage_note", "caution"]) {
      if (typeof meme?.[field] !== "string") errors.push(`${at}: ${field} must be a string`);
      else if (meme[field].length > MAX_FIELD) errors.push(`${at}: ${field} over ${MAX_FIELD} characters`);
      else if (/TODO|TBD|\[출처|lorem ipsum/i.test(meme[field])) errors.push(`${at}: ${field} has placeholder text`);
    }
    if (!trimmed(meme?.description)) errors.push(`${at}: description required`);
    if (validExamples(meme?.usage_examples).length < 2) errors.push(`${at}: usage_examples needs two items with situation and text`);
    const prose = proseChars(meme ?? {});
    if (prose < MIN_PROSE) errors.push(`${at}: prose ${prose} is under the ${MIN_PROSE}-character listing floor`);

    const urls = new Set();
    for (const source of Array.isArray(meme?.sources) ? meme.sources : []) {
      const canonical = canonicalSourceUrl(source?.url);
      if (!canonical) { errors.push(`${at}: source ${source?.url} is not a public https URL`); continue; }
      if (blockedHost(canonical)) { errors.push(`${at}: source ${canonical} is a self link or blocked host`); continue; }
      if (!trimmed(source?.title) || !trimmed(source?.publisher)) errors.push(`${at}: source ${canonical} needs title and publisher`);
      else if (NOTE_TITLE.test(source.title)) errors.push(`${at}: source ${canonical} title is a note, not the page title`);
      urls.add(canonical);
    }
    if (urls.size < 2) errors.push(`${at}: sources needs two distinct public URLs that were opened`);
    if (meme?.origin_year !== undefined && meme.origin_year !== null
      && !(Number.isInteger(meme.origin_year) && meme.origin_year >= EARLIEST_YEAR && meme.origin_year <= LATEST_YEAR)) {
      errors.push(`${at}: origin_year must be null or a whole year from ${EARLIEST_YEAR} to ${LATEST_YEAR}`);
    }
  }
  return errors;
}

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const PUBLIC = "moderation_status in ('approved'::public.moderation_status, 'limited'::public.moderation_status)";

export function buildEnrichmentSql(batch, { reviewedAt }) {
  const errors = validateEnrichmentBatch(batch);
  if (errors.length) throw new Error(errors.join("\n"));
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/.test(reviewedAt ?? "")) {
    throw new Error("reviewedAt: ISO timestamp with offset required");
  }
  const ids = batch.memes.map((m) => q(m.short_id)).join(", ");
  const backup = "enrich_safety_reviewed_backup";
  const lines = [
    "-- Idempotent UPDATE batch for already-public memes. Generated by scripts/enrich-public-memes.mjs.",
    `-- batch_id: ${batch.batch_id}  checked_at: ${batch.checked_at}  memes: ${batch.memes.length}  dropped: ${(batch.dropped ?? []).length}`,
    "-- Apply only after the owner approves the batch:",
    "--   psql \"$DATABASE_URL\" -v ON_ERROR_STOP=1 -1 -f <this-file>",
    "-- No BEGIN/COMMIT here: -1 wraps the file in one transaction.",
    "-- Updates rows by short_id + slug + public status only. Does not change moderation_status or published_at.",
    "-- Trigger side effects (not suppressed): meme_public_change_events rows, meme_translations -> stale,",
    "--   semantic embeddings invalidated. Reindex after apply:",
    "--     python3 scripts/meme_embeddings.py index --allow-remote --limit 100 --batches 50",
    "",
    "set local lock_timeout = '15s';",
    "set local statement_timeout = '10min';",
    "",
    `create temporary table ${backup} as`,
    "select id, safety_reviewed_at",
    "  from public.memes",
    ` where short_id in (${ids});`,
    "",
  ];
  for (const meme of batch.memes) {
    const examples = validExamples(meme.usage_examples)
      .map((e) => ({ situation: trimmed(e.situation), text: trimmed(e.text) }));
    lines.push(
      `-- ${meme.title} (${meme.short_id} / ${meme.slug})`,
      "update public.memes set",
      `  description = ${q(trimmed(meme.description))},`,
      `  origin = ${q(trimmed(meme.origin))},`,
      `  usage_note = ${q(trimmed(meme.usage_note))},`,
      `  caution = ${q(trimmed(meme.caution))},`,
      `  usage_examples = ${q(JSON.stringify(examples))}::jsonb,`,
      ...(Number.isInteger(meme.origin_year) ? [`  origin_year = ${meme.origin_year},`] : []),
      ...(meme.origin_year === null ? ["  origin_year = null,"] : []),
      `  content_reviewed_at = ${q(reviewedAt)}::timestamptz,`,
      "  updated_at = now()",
      `where short_id = ${q(meme.short_id)}`,
      `  and slug = ${q(meme.slug)}`,
      `  and ${PUBLIC};`,
      "",
    );
    const added = new Set();
    for (const source of meme.sources) {
      const url = canonicalSourceUrl(source.url);
      if (added.has(url)) continue;
      added.add(url);
      lines.push(
        "insert into public.meme_sources (",
        "  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis",
        ")",
        `select meme.id, 'Web', ${q(url)}, ${q(trimmed(source.title))}, ${q(trimmed(source.publisher))},`,
        "  'unknown'::public.copyright_status, 'secondary_reference', 'link_only'",
        "from public.memes as meme",
        `where meme.short_id = ${q(meme.short_id)} and meme.slug = ${q(meme.slug)}`,
        `  and meme.${PUBLIC}`,
        "  and not exists (",
        "    select 1 from public.meme_sources as existing",
        `    where existing.meme_id = meme.id and existing.source_url = ${q(url)}`,
        "  );",
        "",
      );
    }
  }
  lines.push(
    "-- Restore safety_reviewed_at after the usage_note/caution trigger has fired.",
    "update public.memes as meme",
    "   set safety_reviewed_at = backup.safety_reviewed_at",
    `  from ${backup} as backup`,
    " where meme.id = backup.id;",
    "",
    `drop table ${backup};`,
    "",
  );
  return lines.join("\n");
}

function main(argv) {
  const [file, ...rest] = argv;
  if (!file) throw new Error("Usage: node scripts/enrich-public-memes.mjs <batch.json> [--sql --reviewed-at <iso>]");
  const batch = JSON.parse(readFileSync(resolve(file), "utf8"));
  if (rest.includes("--sql")) {
    const reviewedAt = rest[rest.indexOf("--reviewed-at") + 1];
    process.stdout.write(buildEnrichmentSql(batch, { reviewedAt }));
    return;
  }
  const errors = validateEnrichmentBatch(batch);
  const prose = (batch.memes ?? []).map((m) => proseChars(m)).sort((a, b) => a - b);
  console.log(JSON.stringify({
    ok: errors.length === 0,
    memes: batch.memes?.length ?? 0,
    dropped: batch.dropped?.length ?? 0,
    prose_min: prose.length ? prose[0] : null,
    prose_median: prose.length ? prose[Math.floor(prose.length / 2)] : null,
    errors,
  }, null, 2));
  if (errors.length) process.exitCode = 1;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
