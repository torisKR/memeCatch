import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CARD_COUNT = 1000;
export const ART_MOTIFS = ['pen-pineapple', 'dance', 'gaming', 'reaction', 'office', 'food', 'animal', 'sport', 'music', 'chat', 'choice', 'technology', 'celebration', 'fashion', 'travel', 'study'];
export const ART_COMPOSITIONS = ['orbit', 'rise', 'split', 'burst', 'rhythm', 'stack', 'frame', 'exchange'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const FILLER = /(?:placeholder|lorem ipsum|sample meme|test meme|fake meme|밈\s*(?:카드\s*)?\d{2,}|generated[-_ ]?meme|대체\s*밈)/i;

export function normalizeConceptTitle(value) {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

export function isSafeReferenceUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (/^(?:localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host) || host.includes(':') || host.endsWith('.local') || !host.includes('.')) return false;
    if (/(?:^|\.)(?:google|bing|duckduckgo|search\.yahoo)\./.test(host)) return false;
    if (/\/(?:search|results)(?:\/|$)/i.test(url.pathname) || ['q', 'query', 'search_query', 'search'].some(key => url.searchParams.has(key))) return false;
    return true;
  } catch {
    return false;
  }
}

export function validateCatalog(catalog) {
  assert.equal(catalog.schemaVersion, 1, 'Unsupported catalog schema');
  assert.equal(catalog.edition, 1, 'Edition must stay 1');
  assert.equal(catalog.projectRef, 'onjipuldngbdptldkpoe', 'Unexpected source project');
  assert.equal(catalog.cards.length, CARD_COUNT, 'Catalog must contain exactly 1000 cards');
  const seen = Object.fromEntries(['id', 'memeId', 'artSeed', 'title', 'concept', 'alias'].map(key => [key, new Set()]));
  const addUnique = (key, value) => {
    assert(!seen[key].has(value), `Duplicate ${key}: ${value}`);
    seen[key].add(value);
  };
  for (const [index, card] of catalog.cards.entries()) {
    assert.equal(card.cardNo, index + 1, 'Card numbers must remain sequential');
    assert.equal(card.id, `mc-${String(index + 1).padStart(4, '0')}`, 'Stable card ID mismatch');
    assert.equal(card.edition, 1);
    assert(UUID.test(card.memeId), `Invalid existing meme UUID: ${card.id}`);
    assert(Number.isInteger(card.artSeed) && card.artSeed > 0 && card.artSeed <= 2147483647, `Invalid art seed: ${card.id}`);
    assert(typeof card.catalogTitle === 'string' && card.catalogTitle.trim().length > 0 && !FILLER.test(card.catalogTitle), `Invalid title: ${card.id}`);
    assert(typeof card.cardCaption === 'string' && card.cardCaption.trim().length > 0 && !FILLER.test(card.cardCaption), `Invalid caption: ${card.id}`);
    assert(typeof card.conceptKey === 'string' && card.conceptKey.length > 0, `Missing concept key: ${card.id}`);
    assert(Array.isArray(card.aliasKeys) && card.aliasKeys.length > 0, `Missing alias review: ${card.id}`);
    assert(ART_MOTIFS.includes(card.art.motif), `Invalid semantic motif: ${card.id}`);
    assert(ART_COMPOSITIONS.includes(card.art.composition), `Invalid composition: ${card.id}`);
    assert(typeof card.art.subject === 'string' && card.art.subject.length > 0, `Missing art subject: ${card.id}`);
    assert(Array.isArray(card.art.symbols) && card.art.symbols.length >= 2 && card.art.symbols.every(symbol => /^[a-z][a-z-]{1,30}$/.test(symbol)), `Missing semantic symbols: ${card.id}`);
    assert(Array.isArray(card.referenceUrls) && card.referenceUrls.length > 0 && card.referenceUrls.every(isSafeReferenceUrl), `Unsafe or absent reference: ${card.id}`);
    assert(['historical-media', 'catalog-reference', 'curation-reference'].includes(card.evidenceKind), `Unsupported evidence kind: ${card.id}`);
    for (const forbidden of ['originYear', 'origin_year', 'releaseYear', 'license', 'rarity', 'odds', 'popularity', 'fameScore', 'imageUrl', 'image_url']) assert(!(forbidden in card), `Unsubstantiated field ${forbidden}: ${card.id}`);
    addUnique('id', card.id);
    addUnique('memeId', card.memeId);
    addUnique('artSeed', card.artSeed);
    addUnique('title', normalizeConceptTitle(card.catalogTitle));
    addUnique('concept', card.conceptKey);
    for (const alias of new Set(card.aliasKeys)) {
      assert(typeof alias === 'string' && alias.length > 0);
      addUnique('alias', alias);
    }
  }
  return { cards: CARD_COUNT, uniqueMemeIds: seen.memeId.size, uniqueConcepts: seen.concept.size, uniqueArtSeeds: seen.artSeed.size, aliasKeys: seen.alias.size };
}

export function catalogDigest(catalog) {
  return createHash('sha256').update(JSON.stringify(catalog)).digest('hex');
}

export function renderSeedMigration(catalog) {
  validateCatalog(catalog);
  const payload = catalog.cards.map(card => ({ id: card.id, card_no: card.cardNo, meme_id: card.memeId, edition: 1, art_seed: card.artSeed, active: true }));
  // Only a JSON-serialized, SQL-quoted value crosses into SQL; no shell interpolation.
  const literal = JSON.stringify(payload).replaceAll("'", "''");
  return `-- Generated by scripts/build-meme-card-catalog.mjs. Do not hand-edit card assignments.
-- Catalog SHA-256: ${catalogDigest(catalog)}
-- Adds collectible references only. Existing memes, rights and moderation remain untouched.
begin;

create temporary table meme_collectible_card_seed (
  id text primary key,
  card_no integer unique not null,
  meme_id uuid unique not null,
  edition integer not null,
  art_seed integer unique not null,
  active boolean not null
) on commit drop;

insert into meme_collectible_card_seed (id, card_no, meme_id, edition, art_seed, active)
select id, card_no, meme_id, edition, art_seed, active
from jsonb_to_recordset('${literal}'::jsonb)
  as payload(id text, card_no integer, meme_id uuid, edition integer, art_seed integer, active boolean);

do $catalog_guard$
begin
  if (select count(*) from meme_collectible_card_seed) <> 1000
     or (select min(card_no) from meme_collectible_card_seed) <> 1
     or (select max(card_no) from meme_collectible_card_seed) <> 1000 then
    raise exception 'Collectible seed must contain exactly 1000 distinct sequential cards';
  end if;
  if exists (
    select 1 from meme_collectible_card_seed seed
    left join public.memes meme on meme.id = seed.meme_id
    where meme.id is null or meme.moderation_status <> 'approved'
      or meme.safety_level <> 'green' or meme.published_at is null
  ) then
    raise exception 'Collectible seed contains missing or currently ineligible memes';
  end if;
  if exists (
    select 1 from meme_collectible_card_seed seed
    join public.meme_collectible_cards card on card.id = seed.id
    where card.card_no is distinct from seed.card_no
      or card.meme_id is distinct from seed.meme_id
      or card.edition is distinct from seed.edition
      or card.art_seed is distinct from seed.art_seed
      or card.active is distinct from seed.active
  ) then
    raise exception 'Collectible seed conflicts with a frozen existing card assignment';
  end if;
end;
$catalog_guard$;

insert into public.meme_collectible_cards (id, card_no, meme_id, edition, art_seed, active)
select id, card_no, meme_id, edition, art_seed, active from meme_collectible_card_seed
on conflict (id) do nothing;

do $catalog_verify$
begin
  if (
    select count(*) from meme_collectible_card_seed seed
    join public.meme_collectible_cards card
      on card.id = seed.id and card.card_no = seed.card_no
      and card.meme_id = seed.meme_id and card.edition = seed.edition
      and card.art_seed = seed.art_seed and card.active = seed.active
    join public.memes meme on meme.id = card.meme_id
    where meme.moderation_status = 'approved' and meme.safety_level = 'green'
      and meme.published_at is not null
  ) <> 1000 then
    raise exception 'Collectible seed did not produce exactly 1000 eligible matching cards';
  end if;
end;
$catalog_verify$;

commit;
`;
}

async function main() {
  const args = process.argv.slice(2);
  const manifestPath = resolve('data/meme-cards/catalog-1000.json');
  const catalog = JSON.parse(await readFile(manifestPath, 'utf8'));
  const result = validateCatalog(catalog);
  if (args.length === 2 && args[0] === '--seed') {
    const path = resolve(args[1]);
    assert(/\/supabase\/migrations\/\d{14}_meme_collectible_catalog_seed\.sql$/.test(path), 'Use a CLI-created catalog seed migration path');
    const existing = await readFile(path, 'utf8');
    assert(existing.trim() === '' || existing.startsWith('-- Generated by scripts/build-meme-card-catalog.mjs.'), 'Refusing to overwrite another migration');
    await writeFile(path, renderSeedMigration(catalog));
  } else {
    assert(args.length === 0 || (args.length === 1 && args[0] === '--check'), 'Usage: node scripts/build-meme-card-catalog.mjs [--check | --seed CLI_CREATED_PATH]');
  }
  console.log(JSON.stringify({ ...result, sha256: catalogDigest(catalog) }));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
