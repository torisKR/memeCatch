import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  auditCatalog, sourceHash, buildEvidence, openCodexConfig, requestStructured,
  reviewSchema, validateCatalogDraft, validateOriginalDraft, renderDraftCard, parseEvidencePacket,
} from './meme-content-pipeline-core.mjs';
import { parseArgs, readOnlyRest, originalAdminDraft, knownOriginalTitles, safeError } from './meme-content-pipeline.mjs';
import { parseContentPipelineImport } from '../lib/content-pipeline-import.ts';
import { restAll } from './source-pipeline-rest.mjs';
import { ART_COMPOSITIONS, ART_MOTIFS } from './build-meme-card-catalog.mjs';

const id = '48653a33-c3d5-4ee4-9670-330c1a145118';
const meme = { id, short_id: '89b37mrx', title: '커피 충전', aliases: ['커피 배터리'], origin_kind: 'catalog', summary: '커피를 마시면 배터리를 충전하는 느낌이라는 표현이다.', description: '커피를 마시면 배터리를 충전하는 느낌이라는 표현이다. '.repeat(2), origin: '기원은 아직 확인되지 않았다.', usage_note: '가볍게 피곤함을 표현한다.', caution: '건강 효과를 사실처럼 주장하지 않는다.', meme_sources: [], meme_contents: [] };
const original = {
  title: '내 배터리도 점심시간', summary: '점심을 먹고 싶은 마음을 배터리 충전 알림에 빗대어 표현한 자체 제작 문구.',
  description: '배터리 충전 알림에 점심시간을 빗댄 문구다. '.repeat(15),
  origin: '밈캐치가 점심을 기다리는 상황과 충전 표시를 결합해 자체 기획한 문구다.',
  usageNote: '친구에게 점심을 먹으러 가자고 가볍게 제안할 때 쓸 수 있는 자체 작성 문구다.',
  caution: '직장의 공식 보고나 긴급 연락에서는 평범한 문장을 사용한다.',
  examples: [{ context: 'friends', text: '내 배터리도 점심시간이야, 밥 먹자.' }, { context: 'sns', text: '배터리 충전하러 점심 먹으러 갑니다.' }],
  card: { caption: '점심이 필요한 마음을 충전 알림에 빗댄다.', visualBrief: '밈캐치 자체 도형으로 낮은 배터리와 밥그릇을 그려 점심 충전이라는 비유를 표현한다.', motif: 'office', symbols: ['clock', 'cup'], composition: 'exchange' },
};
function catalogDraft() {
  return { title: meme.title, memeId: id, summary: meme.summary,
    description: '커피를 마시면 배터리를 충전하는 느낌이라는 표현이다. '.repeat(15),
    usageNote: '커피를 마시면 배터리를 충전하는 느낌을 일상 대화에서 가볍게 표현할 때 사용할 수 있다.',
    caution: '배터리를 충전한다는 것은 비유이며 건강 효과를 사실처럼 주장해서는 안 된다.',
    examples: original.examples,
    card: { ...original.card, caption: '커피로 배터리를 충전하는 느낌', visualBrief: '커피 잔과 배터리를 충전하는 상황을 자체 도형으로 표현한다.' },
    uncertainties: ['기원을 별도로 확인해야 한다.'],
    grounding: ['summary', 'description', 'usageNote', 'caution', 'cardCaption', 'visualBrief'].map(field => ({ field, evidenceId: 'source:checked', quote: '배터리를 충전' })),
  };
}
const checkedEvidence = () => [...buildEvidence(meme), { id: 'source:checked', text: meme.summary, kind: 'operator_checked_source_note', url: 'https://example.com/article' }];

test('audit detects live card binding drift and exact reused media, without declaring semantic certainty', () => {
  const url = 'https://www.youtube.com/watch?v=abcdefghijk';
  const rows = [meme, { ...meme, id: 'c91ddd65-5ef0-473d-b01c-7d1c3512c4c9', title: '다른 밈' }].map(row => ({ ...row, meme_contents: [{ id: row.id, meme_id: row.id, url, moderation_status: 'approved', is_representative: true, availability: 'alive' }] }));
  const report = auditCatalog(rows, [{ id: 'mc-0001', meme_id: id, card_no: 1, art_seed: 9, edition: 1 }], { cards: [{ id: 'mc-0001', memeId: id, artSeed: 8, cardNo: 1, edition: 1, catalogTitle: meme.title }] });
  assert.equal(report.memes, 2);
  assert.equal(report.counts.card_binding_mismatch, 1);
  assert.equal(report.counts.shared_media_review, 2);
  assert.equal(report.counts.duplicate_description, 2);
  assert.match(report.issues.find(issue => issue.code === 'shared_media_review').detail, /단정하지/);
});
test('audit accepts alias identity but flags changed semantic title', () => {
  const cards = [{ id: 'mc-0001', meme_id: id, card_no: 1, art_seed: 8, edition: 1 }];
  const expected = { id: 'mc-0001', memeId: id, artSeed: 8, cardNo: 1, edition: 1, catalogTitle: '커피 배터리' };
  assert.equal(auditCatalog([meme], cards, { cards: [expected] }).counts.card_title_drift, undefined);
  assert.equal(auditCatalog([meme], cards, { cards: [{ ...expected, catalogTitle: '강남스타일' }] }).counts.card_title_drift, 1);
});
test('audit rejects search pages as evidence of original rights and detects generator template', () => {
  const row = { ...meme, origin_kind: 'house_original', summary: '분야에서 화제가 된', meme_sources: [{ source_role: 'original', source_url: 'https://www.youtube.com/results?search_query=test' }] };
  const report = auditCatalog([row], [], { cards: [] });
  assert.equal(report.counts.unsubstantiated_original_rights, 1);
  assert.equal(report.counts.synthetic_template, 1);
  assert.equal(report.counts.search_or_unsafe_source, 1);
});
test('catalog draft preserves identity and binds every field to exact supplied quotes', () => {
  const evidence = checkedEvidence();
  assert.equal(validateCatalogDraft(catalogDraft(), meme, evidence).memeId, id);
  assert.throws(() => validateCatalogDraft({ ...catalogDraft(), title: '다른 밈' }, meme, evidence), /identity/);
  assert.throws(() => validateCatalogDraft({ ...catalogDraft(), grounding: catalogDraft().grounding.map(item => ({ ...item, quote: '없는 근거 문장' })) }, meme, evidence), /quotation/);
  assert.throws(() => validateCatalogDraft({ ...catalogDraft(), grounding: catalogDraft().grounding.slice(1).concat(catalogDraft().grounding.slice(1, 2)) }, meme, evidence), /Missing grounding/);
  assert.throws(() => validateCatalogDraft({ ...catalogDraft(), description: `${catalogDraft().description}2020년 처음 유행했다.` }, meme, evidence), /year/);
});
test('catalog repair requires direct sources and rejects unrelated grounding or invented permission', () => {
  assert.throws(() => validateCatalogDraft(catalogDraft(), meme, buildEvidence(meme)), /direct source/);
  const evidence = [...checkedEvidence(), { id: 'source:other', text: '충분한 근거 문장이지만 강남스타일을 설명한다.', kind: 'operator_checked_source_note', url: 'https://example.com/article' }];
  assert.throws(() => validateCatalogDraft({ ...catalogDraft(), grounding: catalogDraft().grounding.map(claim => ({ ...claim, evidenceId: 'source:other', quote: '강남스타일을 설명' })) }, meme, evidence), /unrelated/);
  assert.throws(() => validateCatalogDraft({ ...catalogDraft(), caution: '공식 승인된 콘텐츠이므로 어떠한 용도에도 사용할 수 있다.' }, meme, evidence), /rights/);
});
test('evidence packet binds checked source notes to one meme and rejects search URLs', () => {
  const packet = { schemaVersion: 1, memeId: id, items: [{ id: 'source:checked', url: 'https://example.com/article', title: '출처 제목', text: meme.summary, excerpt: '배터리를 충전하는 느낌', checkedAt: '2026-10-07T17:53:20Z' }] };
  assert.equal(parseEvidencePacket(packet, id)[0].kind, 'operator_checked_source_note');
  assert.throws(() => parseEvidencePacket(packet, 'c91ddd65-5ef0-473d-b01c-7d1c3512c4c9'));
  assert.throws(() => parseEvidencePacket({ ...packet, items: [{ ...packet.items[0], url: 'https://www.youtube.com/results?search_query=coffee' }] }, id));
});
test('missing active cards are recorded without silently certifying a complete catalog', () => {
  const report = auditCatalog([meme], [], { cards: [{ id: 'mc-0001', memeId: id }] });
  assert.equal(report.counts.missing_live_card, 1);
});
test('original draft never claims pre-existing folk origin or duplicates known aliases', () => {
  assert.equal(validateOriginalDraft(original, [meme]).title, original.title);
  assert.throws(() => validateOriginalDraft({ ...original, title: '커피 배터리' }, [meme]), /duplicates/);
  assert.throws(() => validateOriginalDraft({ ...original, origin: '밈캐치가 2020년 유행한 밈을 정리했다.' }, []), /folk history/);
  assert.throws(() => validateOriginalDraft({ ...original, description: `${original.description}2020년 최초로 유행했다.` }, []), /folk history/);
  assert.throws(() => validateOriginalDraft({ ...original, description: `${original.description}유명 가수가 공식 허가했다.` }, []), /rights/);
});
test('local provider cannot redirect credentials or use a production endpoint', () => {
  assert.equal(openCodexConfig({}).endpoint, 'http://localhost:10100/v1/chat/completions');
  for (const base of ['https://remote.example/v1', 'http://localhost:10100/other', 'http://key@localhost:10100/v1', 'http://localhost:10100/v1?token=a']) {
    assert.throws(() => openCodexConfig({ MEME_CONTENT_BASE_URL: base }));
  }
});
test('CLI keeps bounded resolver diagnostics actionable without echoing untrusted credential details', () => {
  for (const message of [
    'Supabase target URL is missing',
    'Supabase public read credential is missing',
    'Supabase target URL is invalid',
    'Supabase target URL must identify one project',
    'Environment root is required',
    'Opaque service key cannot be project-verified; use a project-bound JWT service_role key or an authenticated read preflight',
    'No valid anon credential matches the selected target project',
    'No valid service_role credential matches the selected local target',
    'process NEXT_PUBLIC_SUPABASE_ANON_KEY must have anon role',
    'process NEXT_PUBLIC_SUPABASE_ANON_KEY uses an opaque public key that cannot be project-verified',
    'process SUPABASE_SERVICE_ROLE_KEY must have service_role role',
    'process SUPABASE_SERVICE_ROLE_KEY is expired or has no expiry',
  ]) assert.equal(safeError(new Error(message)), message);
  assert.equal(
    safeError(new Error('process SUPABASE_SERVICE_ROLE_KEY has an issuer that does not match the target project')),
    'process SUPABASE_SERVICE_ROLE_KEY has an issuer that does not match the target project',
  );
  assert.equal(
    safeError(new Error('process SUPABASE_SERVICE_ROLE_KEY does not match the target project')),
    'process SUPABASE_SERVICE_ROLE_KEY does not match the target project',
  );
  assert.equal(
    safeError(new Error('process SUPABASE_SERVICE_ROLE_KEY has an invalid issuer; credential=secret-value')),
    'Generation or validation failed',
  );
  assert.equal(
    safeError(new Error('No valid service_role credential matches the selected local target: secret-value')),
    'Generation or validation failed',
  );
});
test('provider requires complete schema output and transports bounded structured data only', async () => {
  let request;
  const fetcher = async (url, init) => { request = { url, init }; return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ decision: 'pass', issues: [] }) } }] }); };
  assert.equal((await requestStructured(openCodexConfig({}), reviewSchema, 'rules', { topic: 'data' }, fetcher)).decision, 'pass');
  assert.equal(request.init.redirect, 'error');
  assert.equal(JSON.parse(request.init.body).response_format.type, 'json_schema');
  assert.equal(JSON.parse(request.init.body).store, false);
  await assert.rejects(requestStructured(openCodexConfig({}), reviewSchema, '', {}, async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] })), /Incomplete/);
  await assert.rejects(requestStructured(openCodexConfig({}), reviewSchema, '', {}, async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"decision":"pass","issues":["bad"]}' } }] })));
});
test('read-only audit uses anon by default and paginates beyond one page', async () => {
  const requests = [];
  const rest = readOnlyRest({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'private' }, false, async (url, init) => {
    requests.push({ url, init }); return Response.json(url.includes('offset=0') ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }]);
  });
  const rows = await restAll(rest, 'memes?order=id.asc', { pageSize: 2 });
  assert.equal(rows.length, 3);
  assert.equal(requests.length, 2);
  for (const request of requests) { assert.equal(request.init.method, 'GET'); assert.equal(request.init.headers.apikey, 'anon'); }
});
test('original duplicate lookup uses service-role access and includes pending or rejected titles and aliases', async () => {
  const requests = [];
  const rows = [
    { title: '검토 중 원본', aliases: ['검토 중 별칭'], moderation_status: 'pending' },
    { title: '반려된 원본', aliases: ['반려 별칭'], moderation_status: 'rejected' },
  ];
  const found = await knownOriginalTitles({
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
  }, async (url, init) => {
    requests.push({ url, init });
    return Response.json(rows);
  });
  assert.deepEqual(found.slice(0, 2), rows);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].init.method, 'GET');
  assert.equal(requests[0].init.headers.apikey, 'service');
  assert(!requests[0].url.includes('moderation_status='));
  assert.throws(() => validateOriginalDraft({ ...original, title: '검토 중 별칭' }, found), /duplicates/);
  assert.throws(() => validateOriginalDraft({ ...original, title: '반려된 원본' }, found), /duplicates/);
});
test('CLI bounds batches and requires explicit original topic', () => {
  assert.equal(parseArgs(['original', '--topic', '점심시간', '--limit', '3']).limit, 3);
  assert.throws(() => parseArgs(['original']));
  assert.throws(() => parseArgs(['generate', '--limit', '1000']));
  assert.throws(() => parseArgs(['generate', '--all-statuses']));
  assert.throws(() => parseArgs(['generate', '--short-id', 'bad&select=*']));
});
test('source drift changes fingerprint and original SVG escapes text', () => {
  assert.notEqual(sourceHash(meme), sourceHash({ ...meme, title: '다른 제목' }));
  const svg = renderDraftCard({ ...original, title: '<script>alert("x")</script>' }, true);
  assert(!svg.includes('<script>'));
  assert(svg.includes('&lt;script&gt;'));
  assert(svg.includes('자체 작성 활용 예시'));
  assert(svg.includes('data-symbol="clock"'));
  assert(svg.includes('data-composition="exchange"'));
  assert.notEqual(svg, renderDraftCard({ ...original, card: { ...original.card, symbols: ['pen', 'apple'], composition: 'stack' } }, true));
  assert.equal(sourceHash({ title: 'same', sources: [{ id: 2 }, { id: 1 }] }), sourceHash({ sources: [{ id: 1 }, { id: 2 }], title: 'same' }));
});

test('dance-follow card recipes remain schema-valid and render original follow choreography symbols', () => {
  const draft = validateOriginalDraft({
    ...original,
    card: {
      ...original.card,
      symbols: ['dance-follow', 'repeat', 'hands'],
      composition: 'exchange',
    },
  }, []);
  const svg = renderDraftCard(draft, true);
  assert(svg.includes('data-symbol="dance-follow"'));
  assert(svg.includes('data-symbol="repeat"'));
  assert(!svg.includes('>undefined</g>'));
});

test('every card composition changes the actual symbol layout and motifs remain visible', () => {
  const layouts = ART_COMPOSITIONS.map(composition => {
    const svg = renderDraftCard({ ...original, card: { ...original.card, composition } }, true);
    return [...svg.matchAll(/data-symbol="[^"]+" transform="([^"]+)"/g)].map(match => match[1]).join('|');
  });
  assert.equal(new Set(layouts).size, ART_COMPOSITIONS.length);
  const scenes = ART_MOTIFS.map(motif => renderDraftCard({ ...original, card: { ...original.card, motif } }, true).replace(/data-motif="[^"]+"/, ''));
  assert.equal(new Set(scenes).size, ART_MOTIFS.length);
});

test('CLI original output matches the strict admin importer and preserves its full card recipe', () => {
  const generatedAt = '2026-01-01T00:00:00.000Z';
  const canonical = validateOriginalDraft(original, []);
  const artifact = { schemaVersion: 1, kind: 'house_original', status: 'draft', generatedAt, provider: 'opencodex', topic: '점심시간', draft: canonical, review: { decision: 'pass', issues: [] }, adminDraft: originalAdminDraft(canonical, generatedAt) };
  const imported = parseContentPipelineImport(JSON.stringify(artifact));
  assert.equal(imported.originYear, 2026);
  assert.equal(imported.category, 'image');
  assert(imported.description.includes(`카드 제작 설정: ${JSON.stringify({ motif: original.card.motif, symbols: original.card.symbols, composition: original.card.composition })}`));
  assert.deepEqual(imported.card, original.card);
});
