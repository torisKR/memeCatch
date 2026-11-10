#!/usr/bin/env node
/**
 * Validate a meme content batch and print either a dry-run plan or idempotent
 * SQL. This CLI never connects to Supabase and never executes the SQL.
 *
 *   node scripts/ingest-meme-content.mjs <batch.json>
 *   node scripts/ingest-meme-content.mjs <batch.json> --sql
 *   node scripts/ingest-meme-content.mjs --audit-sql
 *
 * New rows are rejected when they repeat the 2026-11-10 integrity failures:
 * moderation/published_at mismatch, a public image/video/audio/embed with no
 * contents and no media, a public meme missing en/ja/zh/zh-tw, a normalized
 * slug or title/alias collision, a localized_slug collision, or a content row
 * with a null URL. Existing production rows are not updated. --audit-sql
 * prints a read-only listing the owner can run.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { memeTitleKey } from "./meme-title-key.mjs";
import { canonicalSourceUrl } from "./reviewed-meme-batch.mjs";

const MODERATION = ["pending", "fact_checking", "rights_checking", "approved", "limited", "rejected"];
const PUBLISHING = new Set(["approved", "limited"]);
const UNPUBLISHED = new Set(["pending", "fact_checking", "rights_checking", "rejected"]);
const CATEGORIES = ["phrase", "dance", "song", "image", "comment", "challenge"];
const MEDIA_TYPES = ["image", "video", "audio", "text", "embed"];
const ASSET_MEDIA = new Set(["image", "video", "audio", "embed"]);
const LIFECYCLES = ["rising", "active", "cooling", "archived"];
const SAFETY = ["green", "yellow", "gray", "red"];
const YEAR_PRECISIONS = ["exact", "year", "approximate", "decade", "unknown"];
const DIFFICULTIES = ["beginner", "normal", "deep"];
const SENTIMENTS = ["funny", "ironic", "controversial", "negative", "wholesome"];
const ORIGIN_KINDS = ["catalog", "house_original"];
const DOC_CLASSES = ["meme", "event"];
const COPYRIGHT = ["unknown", "embeddable", "permission_needed", "internal_only"];
const SOURCE_ROLES = ["original", "official_reupload", "earliest_known", "secondary_reference", "usage_example"];
const RIGHTS = ["official_embed", "creator_permission", "creative_commons", "public_data", "link_only", "unknown", "blocked"];
const MEDIA_PLATFORMS = ["youtube", "youtube_shorts", "tiktok", "instagram", "broadcast_archive", "public_archive", "web"];
const SUBMISSION = ["pending", "reviewing", "approved", "rejected"];
const AVAILABILITY = ["live", "dead", "region_blocked", "unchecked"];
const LOCALES = ["en", "ja", "zh", "zh-tw"];
const TRANSLATION_STATUS = ["machine", "reviewed", "stale"];
const TAG_TYPES = ["topic", "generation", "platform", "emotion", "risk"];
const PUBLIC_LOCALES = [...LOCALES];
const ROOT_KEYS = ["batch_id", "checked_at", "memes", "sources", "contents", "media", "tags", "tag_links", "translations", "catalog"];
const MEME_REQUIRED = [
  "slug", "title", "aliases", "summary", "description", "origin", "category", "media_type",
  "safety_level", "lifecycle_status", "moderation_status", "origin_year", "year_precision", "published_at",
];
const MEME_OPTIONAL = [
  "usage_note", "caution", "usage_context", "usage_examples", "difficulty", "sentiment",
  "origin_kind", "doc_class", "meme_first_seen_year",
];
const SOURCE_REQUIRED = ["meme_slug", "url", "title", "publisher"];
const SOURCE_OPTIONAL = ["platform", "copyright_status", "source_role", "rights_basis"];
const CONTENT_REQUIRED = ["meme_slug", "url", "type", "moderation_status"];
const CONTENT_OPTIONAL = ["title", "thumbnail_url", "is_representative", "availability", "platform", "caption"];
const MEDIA_REQUIRED = ["meme_slug", "canonical_url", "platform"];
const MEDIA_OPTIONAL = ["title", "external_id", "source_role", "rights_basis", "review_state"];
const TAG_KEYS = ["name", "type"];
const TAG_LINK_KEYS = ["meme_slug", "tag_name"];
const TRANSLATION_REQUIRED = ["meme_slug", "locale", "localized_slug", "title", "summary", "description", "origin", "status", "provider", "model"];
const TRANSLATION_OPTIONAL = ["reviewed_by", "aliases"];
const CATALOG_KEYS = ["memes", "sources", "contents", "media", "tags", "translations", "near_duplicates", "reviewers"];
const USAGE_CONTEXT_KEYS = ["work", "friends", "family", "sns"];
const LOCAL_THUMBNAIL = /^\/ai-memes\/[a-z0-9-]+\.jpg$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizedSlugKey(value) {
  return String(value ?? "").normalize("NFKC").toLocaleLowerCase("ko-KR").replace(/\s+/g, "");
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function ownKeys(value) {
  return isObject(value) ? Object.keys(value) : [];
}

function checkUnexpected(value, allowed, path, errors) {
  for (const key of ownKeys(value)) {
    if (!allowed.includes(key)) errors.push(`${path}: unexpected field ${JSON.stringify(key)}`);
  }
}

function requireKeys(value, keys, path, errors) {
  for (const key of keys) {
    if (!Object.hasOwn(value ?? {}, key)) errors.push(`${path}.${key}: required field is missing`);
  }
}

function boundedText(value, path, max, errors) {
  if (typeof value !== "string") {
    errors.push(`${path}: must be a string`);
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) errors.push(`${path}: must not be empty`);
  if (Array.from(trimmed).length > max) errors.push(`${path}: must be at most ${max} characters`);
  return trimmed;
}

function oneOf(value, allowed, path, errors) {
  if (!allowed.includes(value)) errors.push(`${path}: must be one of ${allowed.join(", ")}`);
}

function validCalendarDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
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

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlJson(value) {
  return `${sqlString(JSON.stringify(value))}::jsonb`;
}

function sqlTextArray(values) {
  if (!values.length) return `'{}'::text[]`;
  return `array[${values.map(sqlString).join(", ")}]::text[]`;
}

function titleKeyExpression(column) {
  return `regexp_replace(lower(normalize(${column}, NFKC)), '[[:space:][:punct:]_]+', '', 'g')`;
}

function slugKeyExpression(column) {
  return `regexp_replace(lower(normalize(${column}, NFKC)), '[[:space:]]+', '', 'g')`;
}

function emptyCatalog() {
  return { memes: [], sources: [], contents: [], media: [], tags: [], translations: [], near_duplicates: [], reviewers: [] };
}

function indexCatalog(catalog) {
  const memesBySlug = new Map();
  const memesBySlugKey = new Map();
  const titleOwners = new Map();
  for (const meme of catalog.memes) {
    memesBySlug.set(meme.slug, meme);
    const slugKey = normalizedSlugKey(meme.slug);
    if (!memesBySlugKey.has(slugKey)) memesBySlugKey.set(slugKey, []);
    memesBySlugKey.get(slugKey).push(meme);
    for (const name of [meme.title, ...(meme.aliases ?? [])]) {
      const key = memeTitleKey(name);
      if (!key) continue;
      if (!titleOwners.has(key)) titleOwners.set(key, []);
      titleOwners.get(key).push(meme);
    }
  }
  const sourceKeys = new Set(catalog.sources.map((source) => `${source.meme_slug}\n${canonicalSourceUrl(source.url) ?? source.url}`));
  const contentUrls = new Set(catalog.contents.map((content) => `${content.meme_slug}\n${canonicalSourceUrl(content.url) ?? ""}`));
  const mediaByUrl = new Map();
  const mediaByMeme = new Set();
  for (const item of catalog.media) {
    const url = canonicalSourceUrl(item.canonical_url) ?? item.canonical_url;
    mediaByUrl.set(url, item);
    if (item.meme_slug) mediaByMeme.add(item.meme_slug);
  }
  const contentsByMeme = new Set(catalog.contents.filter((content) => content.url).map((content) => content.meme_slug));
  for (const meme of catalog.memes) {
    if (meme.has_contents) contentsByMeme.add(meme.slug);
    if (meme.has_media) mediaByMeme.add(meme.slug);
  }
  const tags = new Map(catalog.tags.map((tag) => [tag.name, tag]));
  const translationsByLocaleSlug = new Map();
  const translationsByMemeLocale = new Set();
  for (const row of catalog.translations) {
    const key = `${row.locale}\n${normalizedSlugKey(row.localized_slug)}`;
    if (!translationsByLocaleSlug.has(key)) translationsByLocaleSlug.set(key, []);
    translationsByLocaleSlug.get(key).push(row);
    translationsByMemeLocale.add(`${row.meme_slug}\n${row.locale}`);
  }
  const near = new Map();
  for (const row of catalog.near_duplicates) {
    if (!near.has(row.meme_slug)) near.set(row.meme_slug, []);
    near.get(row.meme_slug).push(row);
  }
  return {
    memesBySlug,
    memesBySlugKey,
    titleOwners,
    sourceKeys,
    contentUrls,
    mediaByUrl,
    mediaByMeme,
    contentsByMeme,
    tags,
    translationsByLocaleSlug,
    translationsByMemeLocale,
    near,
    reviewers: new Set(catalog.reviewers),
  };
}

function validateCatalog(catalog, path, errors) {
  if (catalog === undefined) return emptyCatalog();
  if (!isObject(catalog)) {
    errors.push(`${path}: must be an object`);
    return emptyCatalog();
  }
  checkUnexpected(catalog, CATALOG_KEYS, path, errors);
  const lists = {
    memes: ["slug", "title"],
    sources: ["meme_slug", "url"],
    contents: ["meme_slug", "url"],
    media: ["canonical_url"],
    tags: ["name", "type"],
    translations: ["meme_slug", "locale", "localized_slug"],
    near_duplicates: ["meme_slug", "existing_slug", "reason"],
  };
  const value = emptyCatalog();
  for (const [key, required] of Object.entries(lists)) {
    const rows = catalog[key] ?? [];
    if (!Array.isArray(rows)) {
      errors.push(`${path}.${key}: must be an array`);
      continue;
    }
    rows.forEach((row, index) => {
      const rowPath = `${path}.${key}[${index}]`;
      if (!isObject(row)) {
        errors.push(`${rowPath}: must be an object`);
        return;
      }
      for (const field of required) {
        if (typeof row[field] !== "string" || !row[field].trim()) errors.push(`${rowPath}.${field}: must be a non-empty string`);
      }
    });
    value[key] = rows.filter(isObject);
  }
  const reviewers = catalog.reviewers ?? [];
  if (!Array.isArray(reviewers) || reviewers.some((id) => typeof id !== "string" || !UUID_RE.test(id))) {
    errors.push(`${path}.reviewers: must be an array of uuid strings`);
  } else {
    value.reviewers = reviewers;
  }
  return value;
}

function validateMeme(meme, index, checkedYear, errors) {
  const path = `memes[${index}]`;
  if (!isObject(meme)) {
    errors.push(`${path}: must be an object`);
    return null;
  }
  checkUnexpected(meme, [...MEME_REQUIRED, ...MEME_OPTIONAL], path, errors);
  requireKeys(meme, MEME_REQUIRED, path, errors);
  const slug = boundedText(meme.slug, `${path}.slug`, 200, errors);
  if (slug && !/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(slug)) {
    errors.push(`${path}.slug: use letters or digits separated by single hyphens, without whitespace`);
  }
  if (slug && slug !== normalizedSlugKey(slug)) {
    errors.push(`${path}.slug: must already be the normalized slug (${normalizedSlugKey(slug)})`);
  }
  const title = boundedText(meme.title, `${path}.title`, 200, errors);
  const aliases = [];
  if (!Array.isArray(meme.aliases)) errors.push(`${path}.aliases: must be an array of strings`);
  else {
    if (meme.aliases.length > 30) errors.push(`${path}.aliases: must contain at most 30 items`);
    meme.aliases.forEach((alias, aliasIndex) => aliases.push(boundedText(alias, `${path}.aliases[${aliasIndex}]`, 200, errors)));
  }
  const summary = boundedText(meme.summary, `${path}.summary`, 500, errors);
  const description = boundedText(meme.description, `${path}.description`, 6000, errors);
  const origin = boundedText(meme.origin, `${path}.origin`, 2000, errors);
  oneOf(meme.category, CATEGORIES, `${path}.category`, errors);
  oneOf(meme.media_type, MEDIA_TYPES, `${path}.media_type`, errors);
  oneOf(meme.safety_level, SAFETY, `${path}.safety_level`, errors);
  oneOf(meme.lifecycle_status, LIFECYCLES, `${path}.lifecycle_status`, errors);
  oneOf(meme.moderation_status, MODERATION, `${path}.moderation_status`, errors);
  oneOf(meme.year_precision, YEAR_PRECISIONS, `${path}.year_precision`, errors);
  if (meme.origin_year !== null && (!Number.isInteger(meme.origin_year) || meme.origin_year < 1980 || meme.origin_year > checkedYear)) {
    errors.push(`${path}.origin_year: must be null or an integer from 1980 through ${checkedYear}`);
  }
  let publishedAt = null;
  if (meme.published_at !== null) {
    const parsed = parseIsoTimestamp(meme.published_at);
    if (!parsed) errors.push(`${path}.published_at: must be null or an ISO timestamp with timezone`);
    else publishedAt = meme.published_at;
  }
  if (PUBLISHING.has(meme.moderation_status) && meme.published_at === null) {
    errors.push(`${path}.published_at: approved/limited requires published_at`);
  }
  if (UNPUBLISHED.has(meme.moderation_status) && meme.published_at !== null && meme.published_at !== undefined) {
    errors.push(`${path}.published_at: unpublished moderation_status cannot carry published_at`);
  }
  const originKind = meme.origin_kind ?? "catalog";
  if (meme.origin_kind !== undefined) oneOf(meme.origin_kind, ORIGIN_KINDS, `${path}.origin_kind`, errors);
  if (originKind === "house_original" && meme.moderation_status !== "pending") {
    errors.push(`${path}.origin_kind: house_original can only be inserted as pending`);
  }
  if (meme.doc_class !== undefined) oneOf(meme.doc_class, DOC_CLASSES, `${path}.doc_class`, errors);
  if (meme.difficulty !== undefined) oneOf(meme.difficulty, DIFFICULTIES, `${path}.difficulty`, errors);
  if (meme.sentiment !== undefined) oneOf(meme.sentiment, SENTIMENTS, `${path}.sentiment`, errors);
  let usageContext = { work: "yellow", friends: "yellow", family: "yellow", sns: "yellow" };
  if (meme.usage_context !== undefined) {
    if (!isObject(meme.usage_context)) errors.push(`${path}.usage_context: must be an object`);
    else {
      checkUnexpected(meme.usage_context, USAGE_CONTEXT_KEYS, `${path}.usage_context`, errors);
      requireKeys(meme.usage_context, USAGE_CONTEXT_KEYS, `${path}.usage_context`, errors);
      usageContext = {};
      for (const key of USAGE_CONTEXT_KEYS) {
        oneOf(meme.usage_context[key], SAFETY, `${path}.usage_context.${key}`, errors);
        usageContext[key] = meme.usage_context[key];
      }
    }
  }
  if (meme.usage_examples !== undefined && !Array.isArray(meme.usage_examples)) {
    errors.push(`${path}.usage_examples: must be an array`);
  }
  if (errors.some((error) => error.startsWith(path))) return null;
  return {
    ...meme,
    slug,
    title,
    aliases,
    summary,
    description,
    origin,
    publishedAt,
    originKind,
    docClass: meme.doc_class ?? "meme",
    usageContext,
    usageNote: typeof meme.usage_note === "string" ? meme.usage_note.trim() : null,
    caution: typeof meme.caution === "string" ? meme.caution.trim() : null,
    index,
  };
}

function parentDecision(decisions, slug) {
  return decisions.get(slug) ?? null;
}

function planMemes(memes, checkedYear, index) {
  const actions = [];
  const decisions = new Map();
  const batchSlugKeys = new Map();
  const batchTitleKeys = new Map();
  const parsed = [];
  for (let i = 0; i < memes.length; i += 1) {
    const errors = [];
    const meme = validateMeme(memes[i], i, checkedYear, errors);
    if (!meme || errors.length) {
      const slug = isObject(memes[i]) && typeof memes[i].slug === "string" ? memes[i].slug : `#${i}`;
      actions.push({ table: "memes", key: slug, action: "reject", reasons: errors });
      decisions.set(slug, "reject");
      continue;
    }
    parsed.push(meme);
  }
  for (const meme of parsed) {
    const reasons = [];
    const exact = index.memesBySlug.get(meme.slug);
    const slugOwners = (index.memesBySlugKey.get(normalizedSlugKey(meme.slug)) ?? []).filter((owner) => owner.slug !== meme.slug);
    if (slugOwners.length) {
      reasons.push(`normalized slug duplicates catalog slug ${slugOwners.map((owner) => JSON.stringify(owner.slug)).join(", ")}`);
    }
    const priorSlug = batchSlugKeys.get(normalizedSlugKey(meme.slug));
    if (priorSlug) reasons.push(`normalized slug duplicates memes[${priorSlug.index}]`);
    else batchSlugKeys.set(normalizedSlugKey(meme.slug), meme);
    const names = [meme.title, ...meme.aliases];
    const seenInRow = new Set();
    const titleHits = new Map();
    for (const name of names) {
      const key = memeTitleKey(name);
      if (!key) {
        reasons.push(`title/alias ${JSON.stringify(name)} must contain a letter or number`);
        continue;
      }
      if (seenInRow.has(key)) continue;
      seenInRow.add(key);
      for (const owner of index.titleOwners.get(key) ?? []) {
        if (owner.slug === meme.slug) continue;
        if (!titleHits.has(owner.slug)) titleHits.set(owner.slug, []);
        titleHits.get(owner.slug).push(name);
      }
      const prior = batchTitleKeys.get(key);
      if (prior && prior.slug !== meme.slug) reasons.push(`normalized title/alias duplicates memes[${prior.index}] (${JSON.stringify(name)})`);
      else if (!prior) batchTitleKeys.set(key, meme);
    }
    for (const [slug, matched] of titleHits) {
      reasons.push(`normalized title/alias duplicates catalog slug ${JSON.stringify(slug)} via ${matched.map((name) => JSON.stringify(name)).join(", ")}`);
    }
    for (const near of index.near.get(meme.slug) ?? []) {
      reasons.push(`near-duplicate of ${JSON.stringify(near.existing_slug)}: ${near.reason}`);
    }
    if (reasons.length) {
      actions.push({ table: "memes", key: meme.slug, action: "reject", reasons });
      decisions.set(meme.slug, "reject");
      continue;
    }
    if (exact) {
      actions.push({ table: "memes", key: meme.slug, action: "skip_existing", reasons: ["slug already in catalog"], meme });
      decisions.set(meme.slug, "skip_existing");
      continue;
    }
    actions.push({ table: "memes", key: meme.slug, action: "insert", reasons: [], meme });
    decisions.set(meme.slug, "insert");
  }
  return { actions, decisions, parsed };
}

function markParentRejected(actions, slug, reason) {
  for (const action of actions) {
    if (action.table === "memes" && action.key === slug && action.action === "insert") {
      action.action = "reject";
      action.reasons.push(reason);
    }
  }
}

function validateSource(source, indexPath, errors) {
  if (!isObject(source)) {
    errors.push(`${indexPath}: must be an object`);
    return null;
  }
  checkUnexpected(source, [...SOURCE_REQUIRED, ...SOURCE_OPTIONAL], indexPath, errors);
  requireKeys(source, SOURCE_REQUIRED, indexPath, errors);
  const url = canonicalSourceUrl(source.url);
  if (!url) errors.push(`${indexPath}.url: must be a public HTTPS URL without credentials or a private/local host`);
  boundedText(source.title, `${indexPath}.title`, 300, errors);
  boundedText(source.publisher, `${indexPath}.publisher`, 200, errors);
  const platform = source.platform === undefined ? "Web" : source.platform === "web" ? "Web" : source.platform;
  if (typeof platform !== "string" || !platform.trim()) errors.push(`${indexPath}.platform: must be a non-empty string`);
  if (source.copyright_status !== undefined) oneOf(source.copyright_status, COPYRIGHT, `${indexPath}.copyright_status`, errors);
  if (source.source_role !== undefined) oneOf(source.source_role, SOURCE_ROLES, `${indexPath}.source_role`, errors);
  if (source.rights_basis !== undefined) oneOf(source.rights_basis, RIGHTS, `${indexPath}.rights_basis`, errors);
  if (errors.some((error) => error.startsWith(indexPath))) return null;
  return {
    meme_slug: source.meme_slug,
    url,
    title: source.title.trim(),
    publisher: source.publisher.trim(),
    platform: platform.trim(),
    copyright_status: source.copyright_status ?? "unknown",
    source_role: source.source_role ?? "secondary_reference",
    rights_basis: source.rights_basis ?? "link_only",
  };
}

function thumbnailOk(value) {
  return value === undefined || value === null || LOCAL_THUMBNAIL.test(value) || Boolean(canonicalSourceUrl(value));
}

function validateContent(content, indexPath, errors) {
  if (!isObject(content)) {
    errors.push(`${indexPath}: must be an object`);
    return null;
  }
  checkUnexpected(content, [...CONTENT_REQUIRED, ...CONTENT_OPTIONAL], indexPath, errors);
  requireKeys(content, CONTENT_REQUIRED, indexPath, errors);
  if (content.url === null || content.url === undefined || content.url === "") {
    errors.push(`${indexPath}.url: content url is required`);
  }
  const url = content.url ? canonicalSourceUrl(content.url) : null;
  if (content.url && !url) errors.push(`${indexPath}.url: must be a public HTTPS URL without credentials or a private/local host`);
  oneOf(content.type, MEDIA_TYPES, `${indexPath}.type`, errors);
  oneOf(content.moderation_status, SUBMISSION, `${indexPath}.moderation_status`, errors);
  if (!thumbnailOk(content.thumbnail_url)) errors.push(`${indexPath}.thumbnail_url: must be a public HTTPS URL or /ai-memes/{slug}.jpg`);
  if (content.availability !== undefined) oneOf(content.availability, AVAILABILITY, `${indexPath}.availability`, errors);
  if (content.is_representative !== undefined && typeof content.is_representative !== "boolean") {
    errors.push(`${indexPath}.is_representative: must be a boolean`);
  }
  if (errors.some((error) => error.startsWith(indexPath))) return null;
  return {
    meme_slug: content.meme_slug,
    url,
    type: content.type,
    moderation_status: content.moderation_status,
    title: typeof content.title === "string" ? content.title.trim() : null,
    thumbnail_url: content.thumbnail_url ?? null,
    is_representative: content.is_representative ?? false,
    availability: content.availability ?? "unchecked",
    platform: typeof content.platform === "string" ? content.platform.trim() : null,
    caption: typeof content.caption === "string" ? content.caption.trim() : null,
  };
}

function validateMedia(item, indexPath, errors) {
  if (!isObject(item)) {
    errors.push(`${indexPath}: must be an object`);
    return null;
  }
  checkUnexpected(item, [...MEDIA_REQUIRED, ...MEDIA_OPTIONAL], indexPath, errors);
  requireKeys(item, MEDIA_REQUIRED, indexPath, errors);
  const url = canonicalSourceUrl(item.canonical_url);
  if (!url) errors.push(`${indexPath}.canonical_url: must be a public HTTPS URL without credentials or a private/local host`);
  oneOf(item.platform, MEDIA_PLATFORMS, `${indexPath}.platform`, errors);
  if (item.source_role !== undefined) oneOf(item.source_role, SOURCE_ROLES, `${indexPath}.source_role`, errors);
  if (item.rights_basis !== undefined) oneOf(item.rights_basis, RIGHTS, `${indexPath}.rights_basis`, errors);
  if (item.review_state !== undefined) oneOf(item.review_state, ["pending", "approved", "rejected", "removed"], `${indexPath}.review_state`, errors);
  if (errors.some((error) => error.startsWith(indexPath))) return null;
  return {
    meme_slug: item.meme_slug,
    canonical_url: url,
    platform: item.platform,
    title: typeof item.title === "string" ? item.title.trim() : null,
    external_id: typeof item.external_id === "string" ? item.external_id.trim() : null,
    source_role: item.source_role ?? "usage_example",
    rights_basis: item.rights_basis ?? "unknown",
    review_state: item.review_state ?? "pending",
  };
}

function validateTranslation(row, indexPath, reviewers, errors) {
  if (!isObject(row)) {
    errors.push(`${indexPath}: must be an object`);
    return null;
  }
  checkUnexpected(row, [...TRANSLATION_REQUIRED, ...TRANSLATION_OPTIONAL], indexPath, errors);
  requireKeys(row, TRANSLATION_REQUIRED, indexPath, errors);
  oneOf(row.locale, LOCALES, `${indexPath}.locale`, errors);
  oneOf(row.status, TRANSLATION_STATUS, `${indexPath}.status`, errors);
  const localized = boundedText(row.localized_slug, `${indexPath}.localized_slug`, 200, errors);
  if (localized && localized !== normalizedSlugKey(localized)) {
    errors.push(`${indexPath}.localized_slug: must already be the normalized slug (${normalizedSlugKey(localized)})`);
  }
  const title = boundedText(row.title, `${indexPath}.title`, 200, errors);
  const summary = boundedText(row.summary, `${indexPath}.summary`, 500, errors);
  const description = boundedText(row.description, `${indexPath}.description`, 6000, errors);
  const origin = boundedText(row.origin, `${indexPath}.origin`, 2000, errors);
  boundedText(row.provider, `${indexPath}.provider`, 80, errors);
  boundedText(row.model, `${indexPath}.model`, 80, errors);
  if (row.status === "reviewed" && (typeof row.reviewed_by !== "string" || !reviewers.has(row.reviewed_by))) {
    errors.push(`${indexPath}.reviewed_by: reviewed translations require a catalog reviewer uuid`);
  }
  if (row.status !== "reviewed" && row.reviewed_by != null) {
    errors.push(`${indexPath}.reviewed_by: only reviewed translations can set reviewed_by`);
  }
  if (errors.some((error) => error.startsWith(indexPath))) return null;
  return {
    meme_slug: row.meme_slug,
    locale: row.locale,
    localized_slug: localized,
    title,
    summary,
    description,
    origin,
    status: row.status,
    provider: row.provider.trim(),
    model: row.model.trim(),
    reviewed_by: row.status === "reviewed" ? row.reviewed_by : null,
    aliases: Array.isArray(row.aliases) ? row.aliases.filter((alias) => typeof alias === "string") : [],
  };
}

function considerParent(decisions, slug, path, errors) {
  const decision = parentDecision(decisions, slug);
  if (decision === "reject") {
    errors.push(`${path}: parent meme was not inserted`);
    return "reject";
  }
  if (decision !== "insert" && decision !== "skip_existing") {
    errors.push(`${path}: meme slug is not in this batch or the catalog`);
    return "reject";
  }
  return decision;
}

function applyPublicRules(memeActions, decisions, accepted) {
  const warnings = [];
  for (const action of memeActions) {
    if (action.table !== "memes" || action.action !== "insert") continue;
    const meme = action.meme;
    const sources = accepted.sources.filter((row) => row.meme_slug === meme.slug);
    const distinctUrls = new Set(sources.map((row) => row.url));
    const needed = PUBLISHING.has(meme.moderation_status) ? 2 : 1;
    if (distinctUrls.size < needed) {
      action.action = "reject";
      decisions.set(meme.slug, "reject");
      action.reasons.push(PUBLISHING.has(meme.moderation_status)
        ? "approved/limited meme requires at least 2 distinct sources"
        : "pending meme requires at least 1 source");
    }
    const hasContents = accepted.contents.some((row) => row.meme_slug === meme.slug);
    const hasMedia = accepted.media.some((row) => row.meme_slug === meme.slug);
    if (PUBLISHING.has(meme.moderation_status) && ASSET_MEDIA.has(meme.media_type) && !hasContents && !hasMedia) {
      action.action = "reject";
      decisions.set(meme.slug, "reject");
      action.reasons.push("approved/limited image, video, audio, or embed requires contents or media");
    }
    const locales = new Set(accepted.translations.filter((row) => row.meme_slug === meme.slug).map((row) => row.locale));
    const missing = PUBLIC_LOCALES.filter((locale) => !locales.has(locale));
    if (PUBLISHING.has(meme.moderation_status) && missing.length) {
      action.action = "reject";
      decisions.set(meme.slug, "reject");
      action.reasons.push(`approved/limited meme is missing translations: ${missing.join(", ")}`);
    }
    if (action.action !== "insert") continue;
    if (!PUBLISHING.has(meme.moderation_status) && ASSET_MEDIA.has(meme.media_type) && !hasContents && !hasMedia) {
      const warning = `${meme.slug}: pending ${meme.media_type} has no contents and no media`;
      warnings.push(warning);
      action.warnings = [...(action.warnings ?? []), warning];
    }
    if (!PUBLISHING.has(meme.moderation_status) && missing.length) {
      const warning = `${meme.slug}: pending meme is missing translations: ${missing.join(", ")}`;
      warnings.push(warning);
      action.warnings = [...(action.warnings ?? []), warning];
    }
  }
  return warnings;
}

function rejectOrphanedChildren(actions, decisions) {
  for (const action of actions) {
    if (action.action !== "insert" && action.action !== "skip_existing") continue;
    if (action.table === "memes" || action.table === "tags") continue;
    const slug = action.row?.meme_slug ?? action.key?.split("\n")[0];
    if (slug && decisions.get(slug) === "reject") {
      action.action = "reject";
      action.reasons = ["parent meme was not inserted"];
    }
  }
}

export function planContentBatch(batch, { now = new Date() } = {}) {
  const fatal = [];
  if (!isObject(batch)) {
    return { ok: false, mode: "dry-run", database_connected: false, errors: ["batch: must be an object"], warnings: [], actions: [], summary: {} };
  }
  checkUnexpected(batch, ROOT_KEYS, "batch", fatal);
  requireKeys(batch, ["batch_id", "checked_at", "memes"], "batch", fatal);
  boundedText(batch.batch_id, "batch.batch_id", 120, fatal);
  const checked = parseIsoTimestamp(batch.checked_at);
  if (!checked) fatal.push("batch.checked_at: must be a valid ISO timestamp with timezone");
  else if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fatal.push("now: must be a valid Date");
  else if (checked.time > now.getTime()) fatal.push("batch.checked_at: future timestamp is not allowed");
  if (!Array.isArray(batch.memes)) fatal.push("batch.memes: must be an array");
  for (const key of ["sources", "contents", "media", "tags", "tag_links", "translations"]) {
    if (batch[key] !== undefined && !Array.isArray(batch[key])) fatal.push(`batch.${key}: must be an array`);
  }
  const catalog = validateCatalog(batch.catalog, "batch.catalog", fatal);
  if (fatal.length || !Array.isArray(batch.memes)) {
    return { ok: false, mode: "dry-run", database_connected: false, errors: fatal, warnings: [], actions: [], summary: {} };
  }
  const index = indexCatalog(catalog);
  const checkedYear = Number(checked.date.slice(0, 4));
  const memePlan = planMemes(batch.memes, checkedYear, index);
  const actions = [...memePlan.actions];
  const accepted = { sources: [], contents: [], media: [], translations: [] };
  const seenSources = new Set();
  (batch.sources ?? []).forEach((source, i) => {
    const errors = [];
    const path = `sources[${i}]`;
    const row = validateSource(source, path, errors);
    const slug = isObject(source) ? source.meme_slug : "";
    considerParent(memePlan.decisions, slug, path, errors);
    if (!row || errors.length) {
      actions.push({ table: "meme_sources", key: `${slug}\n${i}`, action: "reject", reasons: errors });
      return;
    }
    if (seenSources.has(`${row.meme_slug}\n${row.url}`) || index.sourceKeys.has(`${row.meme_slug}\n${row.url}`)) {
      actions.push({ table: "meme_sources", key: `${row.meme_slug}\n${row.url}`, action: "skip_existing", reasons: ["source already on catalog meme"], row });
      return;
    }
    seenSources.add(`${row.meme_slug}\n${row.url}`);
    accepted.sources.push(row);
    actions.push({ table: "meme_sources", key: `${row.meme_slug}\n${row.url}`, action: "insert", reasons: [], row });
  });
  const seenContents = new Set();
  (batch.contents ?? []).forEach((content, i) => {
    const errors = [];
    const path = `contents[${i}]`;
    const row = validateContent(content, path, errors);
    const slug = isObject(content) ? content.meme_slug : "";
    considerParent(memePlan.decisions, slug, path, errors);
    if (!row || errors.length) {
      actions.push({ table: "meme_contents", key: `${slug}\n${i}`, action: "reject", reasons: errors });
      return;
    }
    if (seenContents.has(`${row.meme_slug}\n${row.url}`) || index.contentUrls.has(`${row.meme_slug}\n${row.url}`)) {
      actions.push({ table: "meme_contents", key: `${row.meme_slug}\n${row.url}`, action: "skip_existing", reasons: ["content url already on catalog meme"], row });
      return;
    }
    seenContents.add(`${row.meme_slug}\n${row.url}`);
    accepted.contents.push(row);
    actions.push({ table: "meme_contents", key: `${row.meme_slug}\n${row.url}`, action: "insert", reasons: [], row });
  });
  const seenMedia = new Set();
  (batch.media ?? []).forEach((item, i) => {
    const errors = [];
    const path = `media[${i}]`;
    const row = validateMedia(item, path, errors);
    const slug = isObject(item) ? item.meme_slug : "";
    considerParent(memePlan.decisions, slug, path, errors);
    if (!row || errors.length) {
      actions.push({ table: "media_sources", key: `${slug}\n${i}`, action: "reject", reasons: errors });
      return;
    }
    const existing = index.mediaByUrl.get(row.canonical_url);
    if (seenMedia.has(row.canonical_url) || existing) {
      actions.push({ table: "media_sources", key: row.canonical_url, action: "skip_existing", reasons: ["canonical_url already in catalog"], row });
    } else {
      seenMedia.add(row.canonical_url);
      actions.push({ table: "media_sources", key: row.canonical_url, action: "insert", reasons: [], row });
    }
    const linkKey = `${row.meme_slug}\n${row.canonical_url}`;
    if (existing?.meme_slug === row.meme_slug) {
      actions.push({ table: "meme_media", key: linkKey, action: "skip_existing", reasons: ["meme already linked to this media"], row });
    } else {
      accepted.media.push(row);
      actions.push({ table: "meme_media", key: linkKey, action: "insert", reasons: [], row });
    }
  });
  const batchTagNames = new Set();
  (batch.tags ?? []).forEach((tag, i) => {
    const errors = [];
    const path = `tags[${i}]`;
    if (!isObject(tag)) errors.push(`${path}: must be an object`);
    else {
      checkUnexpected(tag, TAG_KEYS, path, errors);
      requireKeys(tag, TAG_KEYS, path, errors);
      boundedText(tag.name, `${path}.name`, 80, errors);
      oneOf(tag.type, TAG_TYPES, `${path}.type`, errors);
    }
    if (errors.length || !isObject(tag)) {
      actions.push({ table: "tags", key: `#${i}`, action: "reject", reasons: errors });
      return;
    }
    if (index.tags.has(tag.name) || batchTagNames.has(tag.name)) {
      actions.push({ table: "tags", key: tag.name, action: "skip_existing", reasons: ["tag name already known"], row: tag });
    } else {
      batchTagNames.add(tag.name);
      actions.push({ table: "tags", key: tag.name, action: "insert", reasons: [], row: { name: tag.name.trim(), type: tag.type } });
    }
  });
  (batch.tag_links ?? []).forEach((link, i) => {
    const errors = [];
    const path = `tag_links[${i}]`;
    if (!isObject(link)) errors.push(`${path}: must be an object`);
    else {
      checkUnexpected(link, TAG_LINK_KEYS, path, errors);
      requireKeys(link, TAG_LINK_KEYS, path, errors);
      considerParent(memePlan.decisions, link.meme_slug, path, errors);
      if (!index.tags.has(link.tag_name) && !batchTagNames.has(link.tag_name)) errors.push(`${path}.tag_name: unknown tag`);
    }
    if (errors.length || !isObject(link)) {
      actions.push({ table: "meme_tags_map", key: `#${i}`, action: "reject", reasons: errors });
      return;
    }
    actions.push({ table: "meme_tags_map", key: `${link.meme_slug}\n${link.tag_name}`, action: "insert", reasons: [], row: link });
  });
  const seenLocalized = new Map();
  const seenMemeLocale = new Set();
  (batch.translations ?? []).forEach((translation, i) => {
    const errors = [];
    const path = `translations[${i}]`;
    const row = validateTranslation(translation, path, index.reviewers, errors);
    const slug = isObject(translation) ? translation.meme_slug : "";
    considerParent(memePlan.decisions, slug, path, errors);
    if (!row || errors.length) {
      actions.push({ table: "meme_translations", key: `${slug}\n${i}`, action: "reject", reasons: errors });
      return;
    }
    const localeKey = `${row.locale}\n${normalizedSlugKey(row.localized_slug)}`;
    const catalogOwners = (index.translationsByLocaleSlug.get(localeKey) ?? []).filter((owner) => owner.meme_slug !== row.meme_slug);
    if (catalogOwners.length) {
      errors.push(`localized_slug collides with catalog meme ${catalogOwners.map((owner) => JSON.stringify(owner.meme_slug)).join(", ")} in locale ${row.locale}`);
    }
    const prior = seenLocalized.get(localeKey);
    if (prior && prior !== row.meme_slug) errors.push(`localized_slug collides with ${JSON.stringify(prior)} in locale ${row.locale}`);
    if (seenMemeLocale.has(`${row.meme_slug}\n${row.locale}`) || index.translationsByMemeLocale.has(`${row.meme_slug}\n${row.locale}`)) {
      actions.push({ table: "meme_translations", key: `${row.meme_slug}\n${row.locale}`, action: "skip_existing", reasons: ["translation locale already on meme"], row });
      return;
    }
    if (errors.length) {
      actions.push({ table: "meme_translations", key: `${row.meme_slug}\n${row.locale}`, action: "reject", reasons: errors });
      return;
    }
    seenLocalized.set(localeKey, row.meme_slug);
    seenMemeLocale.add(`${row.meme_slug}\n${row.locale}`);
    accepted.translations.push(row);
    actions.push({ table: "meme_translations", key: `${row.meme_slug}\n${row.locale}`, action: "insert", reasons: [], row });
  });
  const warnings = applyPublicRules(actions, memePlan.decisions, accepted);
  rejectOrphanedChildren(actions, memePlan.decisions);
  return {
    ok: true,
    mode: "dry-run",
    database_connected: false,
    batch_id: batch.batch_id,
    errors: [],
    warnings,
    actions: actions.map(({ meme, row, ...rest }) => rest),
    summary: summarize(actions),
    _actions: actions,
  };
}

function summarize(actions) {
  const summary = {};
  for (const action of actions) {
    if (!summary[action.table]) summary[action.table] = { insert: 0, skip_existing: 0, reject: 0 };
    switch (action.action) {
      case "insert":
        summary[action.table].insert += 1;
        break;
      case "skip_existing":
        summary[action.table].skip_existing += 1;
        break;
      case "reject":
        summary[action.table].reject += 1;
        break;
      default: {
        const unexpected = action.action;
        throw new Error(`Unhandled action ${String(unexpected)}`);
      }
    }
  }
  return summary;
}

function commentLine(value) {
  return String(value).replaceAll("\n", " ").replaceAll("*/", "");
}

function memeInsertSql(meme) {
  const keys = [...new Set([meme.title, ...meme.aliases].map(memeTitleKey).filter(Boolean))];
  const published = meme.publishedAt === null ? "null" : `${sqlString(meme.publishedAt)}::timestamptz`;
  const originYear = meme.origin_year === null ? "null::integer" : `${meme.origin_year}::integer`;
  return `insert into public.memes (
  slug, title, aliases, summary, description, origin, usage_note, caution,
  category, media_type, safety_level, lifecycle_status, moderation_status,
  origin_year, year_precision, published_at, usage_context, usage_examples,
  origin_kind, doc_class, trend_score
)
select
  ${sqlString(meme.slug)}, ${sqlString(meme.title)}, ${sqlTextArray(meme.aliases)},
  ${sqlString(meme.summary)}, ${sqlString(meme.description)}, ${sqlString(meme.origin)},
  ${meme.usageNote === null ? "null" : sqlString(meme.usageNote)},
  ${meme.caution === null ? "null" : sqlString(meme.caution)},
  ${sqlString(meme.category)}::public.meme_category,
  ${sqlString(meme.media_type)}::public.media_type,
  ${sqlString(meme.safety_level)}::public.safety_level,
  ${sqlString(meme.lifecycle_status)}::public.lifecycle_status,
  ${sqlString(meme.moderation_status)}::public.moderation_status,
  ${originYear}, ${sqlString(meme.year_precision)}, ${published},
  ${sqlJson(meme.usageContext)},
  ${meme.usage_examples === undefined ? "null" : sqlJson(meme.usage_examples)},
  ${sqlString(meme.originKind)}, ${sqlString(meme.docClass)}, 0
where not exists (
  select 1
  from public.memes as existing
  where existing.slug = ${sqlString(meme.slug)}
     or ${slugKeyExpression("existing.slug")} = ${sqlString(normalizedSlugKey(meme.slug))}
     or exists (
       select 1
       from unnest(array[existing.title]::text[] || coalesce(existing.aliases, '{}'::text[])) as prior(name)
       where ${titleKeyExpression("prior.name")} = any(${sqlTextArray(keys)})
     )
)
on conflict (slug) do nothing;`;
}

function sourceInsertSql(row) {
  return `insert into public.meme_sources (
  meme_id, platform, source_url, title, creator_name, copyright_status, source_role, rights_basis
)
select meme.id, ${sqlString(row.platform)}, ${sqlString(row.url)}, ${sqlString(row.title)}, ${sqlString(row.publisher)},
  ${sqlString(row.copyright_status)}::public.copyright_status, ${sqlString(row.source_role)}, ${sqlString(row.rights_basis)}
from public.memes as meme
where meme.slug = ${sqlString(row.meme_slug)}
  and not exists (
    select 1 from public.meme_sources as existing
    where existing.meme_id = meme.id and existing.source_url = ${sqlString(row.url)}
  );`;
}

function contentInsertSql(row) {
  return `insert into public.meme_contents (
  meme_id, type, url, thumbnail_url, moderation_status, is_representative, availability, platform, caption
)
select meme.id, ${sqlString(row.type)}::public.media_type, ${sqlString(row.url)},
  ${row.thumbnail_url === null ? "null" : sqlString(row.thumbnail_url)},
  ${sqlString(row.moderation_status)}::public.submission_status, ${row.is_representative ? "true" : "false"},
  ${sqlString(row.availability)}::public.availability_status,
  ${row.platform === null ? "null" : sqlString(row.platform)},
  ${row.caption === null ? "null" : sqlString(row.caption)}
from public.memes as meme
where meme.slug = ${sqlString(row.meme_slug)}
  and not exists (
    select 1 from public.meme_contents as existing
    where existing.meme_id = meme.id and existing.url = ${sqlString(row.url)}
  );`;
}

function mediaSourceInsertSql(row) {
  const external = row.external_id === null ? "null" : sqlString(row.external_id);
  const title = row.title === null ? "null" : sqlString(row.title);
  return `insert into public.media_sources (canonical_url, platform, external_id, title)
values (${sqlString(row.canonical_url)}, ${sqlString(row.platform)}, ${external}, ${title})
on conflict (canonical_url) do nothing;`;
}

function mediaLinkInsertSql(row) {
  return `insert into public.meme_media (meme_id, source_id, review_state, source_role, rights_basis)
select meme.id, media.id, ${sqlString(row.review_state)}, ${sqlString(row.source_role)}, ${sqlString(row.rights_basis)}
from public.memes as meme
join public.media_sources as media on media.canonical_url = ${sqlString(row.canonical_url)}
where meme.slug = ${sqlString(row.meme_slug)}
on conflict (meme_id, source_id) do nothing;`;
}

function tagInsertSql(row) {
  return `insert into public.tags (name, type)
values (${sqlString(row.name)}, ${sqlString(row.type)})
on conflict (name) do nothing;`;
}

function tagLinkSql(row) {
  return `insert into public.meme_tags_map (meme_id, tag_id)
select meme.id, tag.id
from public.memes as meme
join public.tags as tag on tag.name = ${sqlString(row.tag_name)}
where meme.slug = ${sqlString(row.meme_slug)}
on conflict (meme_id, tag_id) do nothing;`;
}

function translationInsertSql(row) {
  const reviewedBy = row.reviewed_by === null ? "null" : `${sqlString(row.reviewed_by)}::uuid`;
  const reviewedAt = row.reviewed_by === null ? "null" : "now()";
  return `insert into public.meme_translations (
  meme_id, locale, localized_slug, title, summary, description, origin, aliases,
  status, provider, model, source_updated_at, reviewed_by, reviewed_at
)
select meme.id, ${sqlString(row.locale)}, ${sqlString(row.localized_slug)}, ${sqlString(row.title)},
  ${sqlString(row.summary)}, ${sqlString(row.description)}, ${sqlString(row.origin)}, ${sqlTextArray(row.aliases)},
  ${sqlString(row.status)}, ${sqlString(row.provider)}, ${sqlString(row.model)}, meme.updated_at,
  ${reviewedBy}, ${reviewedAt}
from public.memes as meme
where meme.slug = ${sqlString(row.meme_slug)}
  and not exists (
    select 1 from public.meme_translations as existing
    where existing.meme_id = meme.id and existing.locale = ${sqlString(row.locale)}
  )
  and not exists (
    select 1 from public.meme_translations as existing
    where existing.locale = ${sqlString(row.locale)}
      and ${slugKeyExpression("existing.localized_slug")} = ${sqlString(normalizedSlugKey(row.localized_slug))}
      and existing.meme_id <> meme.id
  )
on conflict (meme_id, locale) do nothing;`;
}

export function buildContentSql(batch, options = {}) {
  const plan = planContentBatch(batch, options);
  if (!plan.ok) throw new Error(`Invalid meme content batch:\n${plan.errors.map((error) => `- ${error}`).join("\n")}`);
  const inserts = plan._actions.filter((action) => action.action === "insert");
  const rejected = plan._actions.filter((action) => action.action === "reject");
  const lines = [
    "-- Idempotent meme content batch. The generator does not connect or write.",
    `-- batch_id: ${commentLine(batch.batch_id)}`,
    "-- Apply only after review:",
    `--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f <this-file>`,
    "-- or paste the transaction into the Supabase SQL editor.",
    "-- Inserts are skipped when the slug, normalized title/alias, source URL,",
    "-- content URL, canonical media URL, tag, or translation locale already exists.",
    "-- This file does not change moderation_status of rows that already exist",
    "-- and does not walk pending rows to limited or approved.",
  ];
  if (!inserts.length) lines.push("-- No rows passed validation. Running this transaction writes nothing.");
  for (const action of rejected) {
    lines.push(`-- rejected ${action.table} ${commentLine(action.key)}: ${commentLine(action.reasons.join("; "))}`);
  }
  for (const warning of plan.warnings) lines.push(`-- warning: ${commentLine(warning)}`);
  const insertedSlugs = inserts.filter((action) => action.table === "memes").map((action) => action.key);
  if (insertedSlugs.length) {
    lines.push("-- Rollback for memes inserted by this file while they are still pending:");
    for (const slug of insertedSlugs) {
      lines.push(`--   delete from public.memes where slug = ${sqlString(slug)} and moderation_status = 'pending';`);
    }
  }
  lines.push("begin;");
  const chunks = [];
  for (const action of inserts) {
    switch (action.table) {
      case "tags":
        chunks.push(tagInsertSql(action.row));
        break;
      case "memes":
        chunks.push(memeInsertSql(action.meme));
        break;
      case "meme_sources":
        chunks.push(sourceInsertSql(action.row));
        break;
      case "meme_contents":
        chunks.push(contentInsertSql(action.row));
        break;
      case "media_sources":
        chunks.push(mediaSourceInsertSql(action.row));
        break;
      case "meme_media":
        chunks.push(mediaLinkInsertSql(action.row));
        break;
      case "meme_tags_map":
        chunks.push(tagLinkSql(action.row));
        break;
      case "meme_translations":
        chunks.push(translationInsertSql(action.row));
        break;
      default: {
        const unexpected = action.table;
        throw new Error(`Unhandled table ${String(unexpected)}`);
      }
    }
  }
  lines.push(chunks.join("\n\n"));
  lines.push("commit;");
  return `${lines.filter((line) => line !== "").join("\n")}\n`;
}

export function existingViolationSql() {
  const titleKey = titleKeyExpression("title");
  const slugKey = slugKeyExpression("slug");
  const localizedKey = slugKeyExpression("localized_slug");
  return `-- READ ONLY listing of rows that already violate the ingest rules.
-- Do not edit this file into UPDATE, DELETE, or INSERT.
-- Re-run:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f data/memes/sql/20261110-existing-integrity-listing.sql
-- Counts captured read-only on 2026-11-10 are in
-- data/memes/reports/20261110-existing-integrity.dry-run.json.
--
-- limited + published_at is schema-consistent: check_moderation_transition
-- sets published_at when moderation becomes approved or limited. Those rows
-- are not listed.
-- public_text_missing_contents_and_media is a warning. Phrase rows may have
-- no media. The loader hard-rejects that gap only for image, video, audio,
-- and embed.
-- A meme missing several locales appears once per missing locale.
-- Live meme detail 404s are a separate render fix and are not queried here.

with title_keys as (
  select id, short_id, slug, ${titleKey} as title_key
  from public.memes
), title_dups as (
  select title_key from title_keys where title_key <> '' group by title_key having count(*) > 1
), slug_keys as (
  select id, short_id, slug, ${slugKey} as slug_key
  from public.memes
), slug_dups as (
  select slug_key from slug_keys where slug_key <> '' group by slug_key having count(*) > 1
), localized_keys as (
  select t.meme_id, t.locale, t.localized_slug, ${localizedKey} as slug_key
  from public.meme_translations as t
), localized_dups as (
  select locale, slug_key from localized_keys group by locale, slug_key having count(*) > 1
), violations as (
  select 'approved_missing_published_at'::text as rule, 'fail'::text as severity,
    'memes'::text as entity, m.id::text as entity_id, m.id::text as meme_id, m.short_id, m.slug,
    m.moderation_status::text as detail
  from public.memes as m
  where m.moderation_status = 'approved' and m.published_at is null

  union all
  select 'unpublished_status_has_published_at', 'fail', 'memes', m.id::text, m.id::text, m.short_id, m.slug,
    m.moderation_status::text
  from public.memes as m
  where m.moderation_status in ('pending', 'fact_checking', 'rights_checking', 'rejected')
    and m.published_at is not null

  union all
  select 'public_media_missing_contents_and_media', 'fail', 'memes', m.id::text, m.id::text, m.short_id, m.slug,
    m.media_type::text
  from public.memes as m
  where m.moderation_status = 'approved' and m.published_at is not null
    and m.media_type in ('image', 'video', 'audio', 'embed')
    and not exists (select 1 from public.meme_contents as c where c.meme_id = m.id)
    and not exists (select 1 from public.meme_media as mm where mm.meme_id = m.id)

  union all
  select 'public_text_missing_contents_and_media', 'warn', 'memes', m.id::text, m.id::text, m.short_id, m.slug,
    m.media_type::text
  from public.memes as m
  where m.moderation_status = 'approved' and m.published_at is not null
    and m.media_type = 'text'
    and not exists (select 1 from public.meme_contents as c where c.meme_id = m.id)
    and not exists (select 1 from public.meme_media as mm where mm.meme_id = m.id)

  union all
  select 'null_content_url', 'fail', 'meme_contents', c.id::text, c.meme_id::text, m.short_id, m.slug,
    coalesce(c.thumbnail_url, '')
  from public.meme_contents as c
  join public.memes as m on m.id = c.meme_id
  where c.url is null

  union all
  select 'normalized_slug_duplicate', 'fail', 'memes', k.id::text, k.id::text, k.short_id, k.slug, k.slug_key
  from slug_keys as k
  join slug_dups as d on d.slug_key = k.slug_key

  union all
  select 'normalized_title_duplicate', 'fail', 'memes', k.id::text, k.id::text, k.short_id, k.slug, k.title_key
  from title_keys as k
  join title_dups as d on d.title_key = k.title_key

  union all
  select 'localized_slug_collision', 'fail', 'meme_translations', k.meme_id::text, k.meme_id::text, m.short_id, m.slug,
    k.locale || ' ' || k.localized_slug
  from localized_keys as k
  join localized_dups as d on d.locale = k.locale and d.slug_key = k.slug_key
  join public.memes as m on m.id = k.meme_id

  union all
  select 'missing_translation', 'fail', 'memes', m.id::text, m.id::text, m.short_id, m.slug, l.locale
  from public.memes as m
  cross join (values ('en'), ('ja'), ('zh'), ('zh-tw')) as l(locale)
  where m.moderation_status = 'approved' and m.published_at is not null
    and not exists (
      select 1 from public.meme_translations as t
      where t.meme_id = m.id and t.locale = l.locale
    )
)
select rule, severity, entity, entity_id, meme_id, short_id, slug, detail
from violations
order by rule, slug, detail, entity_id;
`;
}

export function auditSqlWrites(sql) {
  const stripped = sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--.*$/gm, "");
  return [...stripped.matchAll(/\b(insert|update|delete|drop|alter|truncate|grant|revoke)\b/gi)].map((match) => match[1].toLowerCase());
}

function publicPlan(plan) {
  return {
    ok: plan.ok,
    mode: plan.mode,
    database_connected: plan.database_connected,
    batch_id: plan.batch_id,
    errors: plan.errors,
    warnings: plan.warnings,
    summary: plan.summary,
    actions: plan.actions,
  };
}

function runCli() {
  const args = process.argv.slice(2);
  if (args.includes("--audit-sql") && args.length === 1) {
    process.stdout.write(existingViolationSql());
    return;
  }
  const sqlOnly = args.includes("--sql");
  const inputPaths = args.filter((arg) => arg !== "--sql");
  if (inputPaths.length !== 1 || args.some((arg) => arg.startsWith("-") && arg !== "--sql")) {
    console.error("usage: node scripts/ingest-meme-content.mjs <batch.json> [--sql]");
    console.error("       node scripts/ingest-meme-content.mjs --audit-sql");
    process.exitCode = 2;
    return;
  }
  let batch;
  try {
    batch = JSON.parse(readFileSync(inputPaths[0], "utf8"));
  } catch (error) {
    console.error(`Could not read/parse ${inputPaths[0]}: ${error.message}`);
    process.exitCode = 2;
    return;
  }
  const plan = planContentBatch(batch);
  if (!plan.ok) {
    console.error(plan.errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
    return;
  }
  if (sqlOnly) {
    process.stdout.write(buildContentSql(batch));
    return;
  }
  process.stdout.write(`${JSON.stringify(publicPlan(plan), null, 2)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) runCli();
