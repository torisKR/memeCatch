import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCatalog, renderSeedMigration, isSafeReferenceUrl, normalizeConceptTitle } from './build-meme-card-catalog.mjs';

const load = async () => JSON.parse(await readFile(new URL('../data/meme-cards/catalog-1000.json', import.meta.url), 'utf8'));

test('frozen catalog has 1000 distinct real references, concepts, art seeds and stable numbers', async () => {
  const result = validateCatalog(await load());
  assert.equal(result.cards, 1000);
  assert.equal(result.uniqueMemeIds, 1000);
  assert.equal(result.uniqueConcepts, 1000);
  assert.equal(result.uniqueArtSeeds, 1000);
});

test('validation rejects insufficient, duplicated, placeholder or unsubstantiated cards', async () => {
  const catalog = await load();
  for (const mutate of [
    data => data.cards.pop(),
    data => { data.cards[1].memeId = data.cards[0].memeId; },
    data => { data.cards[1].aliasKeys.push(data.cards[0].aliasKeys[0]); },
    data => { data.cards[1].artSeed = data.cards[0].artSeed; },
    data => { data.cards[0].catalogTitle = 'Generated Meme 123'; },
    data => { data.cards[0].originYear = 2000; },
    data => { data.cards[0].referenceUrls = ['http://example.com/unsafe']; },
  ]) {
    const changed = structuredClone(catalog);
    mutate(changed);
    assert.throws(() => validateCatalog(changed));
  }
});

test('reviewed equivalent families and known mixed identities cannot reappear as separate cards', async () => {
  const catalog = await load();
  const qa = JSON.parse(await readFile(new URL('../data/meme-cards/curation-qa.json', import.meta.url), 'utf8'));
  const selected = new Set(catalog.cards.map(card => card.memeId));
  for (const family of qa.reviewedEquivalenceFamilies) {
    assert(family.memeIds.filter(id => selected.has(id)).length <= 1, `Reviewed duplicate family returned: ${family.reviewedTitles.join(' / ')}`);
  }
  for (const id of qa.invalidIdentityMemeIds) assert(!selected.has(id), `Known mixed identity returned: ${id}`);
  assert.equal(catalog.cards[0].catalogTitle, 'PPAP (펜-파인애플-애플-펜)');
  assert.equal(catalog.cards[6].catalogTitle, '도지(Doge)');
  const saebbing = catalog.cards.find(card => card.memeId === 'dbe93730-0dbd-4ef0-a318-92c7e775caf3');
  assert(saebbing && saebbing.cardCaption.includes('지코'));
  assert(!saebbing.cardCaption.includes("BE'O"));
  const byMemeId = new Map(catalog.cards.map(card => [card.memeId, card]));
  const soda = byMemeId.get('b4fd5a58-eb08-4f8a-aa53-cdfab6a4c41e');
  assert(soda && !soda.aliasKeys.includes('고구마'));
  const tellMe = byMemeId.get('be3bf6d1-ec0c-4784-9b5f-ec8b10dd2ac8');
  assert(tellMe && tellMe.aliasKeys.every(key => !key.includes('꼭지점춤')));
  const chaser = byMemeId.get('10439134-67ec-4ebb-92f8-125b50103aab');
  assert(chaser && chaser.cardCaption.includes('영화 추격자'));
  assert(chaser.referenceUrls.every(url => !url.includes('THE%20CHASER')));
  const internalStrength = byMemeId.get('986563be-6cf5-4b37-83f5-8d444af773c3');
  assert(internalStrength && internalStrength.cardCaption.includes('박동훈'));
  assert(!internalStrength.cardCaption.includes('이지안'));
});

test('canonical reference checks reject search links, credentials and local network URLs', () => {
  for (const url of ['http://example.com/meme', 'javascript:alert(1)', 'https://user:pass@example.com/meme', 'https://127.0.0.1/meme', 'https://169.254.169.254/latest', 'https://[::1]/meme', 'https://www.google.com/search?q=meme', 'https://www.youtube.com/results?search_query=meme']) assert.equal(isSafeReferenceUrl(url), false, url);
  assert.equal(isSafeReferenceUrl('https://www.youtube.com/watch?v=9bZkp7q19f0'), true);
  assert.equal(isSafeReferenceUrl('https://knowyourmeme.com/memes/doge'), true);
  assert.equal(normalizeConceptTitle('  무야호!  '), normalizeConceptTitle('무야호'));
});

test('seed is deterministic, transactional, idempotent and guarded by current eligibility', async () => {
  const catalog = await load();
  const sql = renderSeedMigration(catalog);
  assert.equal(sql, renderSeedMigration(catalog));
  assert.match(sql, /begin;[\s\S]*commit;/);
  assert.match(sql, /on conflict \(id\) do nothing/);
  assert.match(sql, /meme\.moderation_status <> 'approved'/);
  assert.match(sql, /meme\.safety_level <> 'green'/);
  assert.match(sql, /meme\.published_at is null/);
  assert.match(sql, /raise exception 'Collectible seed/);
  assert.doesNotMatch(sql, /(?:insert into|update|delete from) public\.memes\b/i);
  assert.doesNotMatch(sql, /copyright|set moderation_status|house_rights_attested_at/i);
});
