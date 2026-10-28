import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VIDEO_DRAFT_INSTRUCTIONS, VIDEO_SCRIPT_SCHEMA, buildVideoDraftInput, generateLocalVideoDraft,
  loopbackOpenCodexEndpoint, requestOpenCodexDraft,
} from './draft.mjs';

const sourceId = '20000000-0000-4000-8000-000000000002';
const candidate = {
  id: '10000000-0000-4000-8000-000000000001', title: '테스트 밈', summary: '검수된 요약', description: '검수된 설명', origin: '검수된 기원',
  usage_note: null, caution: null, usage_examples: [],
  sources: [{ id: sourceId, title: '검수 출처', url: 'https://example.com/source', approved: true }],
  claims: [{ id: 'claim:one', type: 'meaning', text: '확인된 뜻', source_id: sourceId }],
};
const scenes = [
  { id: 'hook', kind: 'hook', heading: '도입', caption: '표현을 살펴봅니다', narration: '표현을 먼저 살펴봅니다.', start_ms: 0, end_ms: 6_000, source_ids: [sourceId] },
  { id: 'meaning', kind: 'meaning', heading: '뜻', caption: '검수된 뜻', narration: '검수된 뜻을 설명합니다.', start_ms: 6_000, end_ms: 13_000, source_ids: [sourceId] },
  { id: 'example', kind: 'example', heading: '가상 상황', caption: '자체 작성 대화', narration: '자체 작성한 가상 상황입니다.', start_ms: 13_000, end_ms: 21_000, source_ids: [] },
  { id: 'context', kind: 'context', heading: '맥락', caption: '확인된 맥락', narration: '검수된 맥락을 설명합니다.', start_ms: 21_000, end_ms: 29_000, source_ids: [sourceId] },
  { id: 'caution', kind: 'caution', heading: '주의', caption: '상황에 맞게 사용', narration: '상황에 맞게 풀어 말합니다.', start_ms: 29_000, end_ms: 36_000, source_ids: [] },
];
const draft = {
  title: '테스트 밈', description: '검수된 근거와 자체 작성 가상 상황으로 사용 맥락을 설명합니다.',
  narration: scenes.map(scene => scene.narration).join(' '),
  original_observation: '이 표현은 친근한 대화에서 상황을 짧게 압축하는 특징이 있습니다.',
  scenes, source_ids: [sourceId], uncertain_claims: [],
  asset_requirements: [{ kind: 'voice', description: '자체 음성' }, { kind: 'font', description: '허가된 폰트' }, { kind: 'graphic', description: '자체 그래픽' }],
  contains_synthetic_media: false,
};

function responseFor(value = draft) {
  return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(value) } }] });
}

test('shared draft input keeps reviewed facts bounded and treats external values only as data', () => {
  const input = buildVideoDraftInput(candidate);
  assert.equal(input.untrusted_source_text, true);
  assert.deepEqual(input.sources.map(source => source.id), [sourceId]);
  assert.match(VIDEO_DRAFT_INSTRUCTIONS, /untrusted DATA/);
  assert.match(VIDEO_DRAFT_INSTRUCTIONS, /Never output an approval/);
  assert.throws(() => buildVideoDraftInput({ ...candidate, claims: [{ ...candidate.claims[0], source_id: 'source:unknown' }] }), /reviewed_evidence_required/);
  assert.equal(VIDEO_SCRIPT_SCHEMA.properties.title.maxLength, 100);
  assert.throws(() => buildVideoDraftInput({ ...candidate, title: '한'.repeat(101) }), /video_draft_input_too_large/);
});

test('draft evidence exposes only public attribution URLs and removes fragments', () => {
  const input = buildVideoDraftInput({ ...candidate, sources: [{ ...candidate.sources[0], url: 'https://www.youtube.com/watch?v=abcdefghijk#chapter' }] });
  assert.equal(input.sources[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
  for (const url of ['https://example.com/file?access_token=secret', 'https://example.com/file?X-Amz-Signature=secret']) {
    assert.throws(() => buildVideoDraftInput({ ...candidate, sources: [{ ...candidate.sources[0], url }] }), /reviewed_evidence_required/);
  }
});

test('OpenCodex endpoint is strictly loopback HTTP /v1', () => {
  assert.equal(loopbackOpenCodexEndpoint(), 'http://localhost:10100/v1');
  assert.equal(loopbackOpenCodexEndpoint('http://127.0.0.1:10100/v1/'), 'http://127.0.0.1:10100/v1');
  for (const value of ['https://localhost:10100/v1', 'http://remote.example/v1', 'http://key@localhost:10100/v1', 'http://localhost:10100/other', 'http://localhost:10100/v1?key=x']) {
    assert.throws(() => loopbackOpenCodexEndpoint(value), /invalid_opencodex_endpoint/);
  }
});

test('local request requires an explicit model and sends a bounded schema-only request without publication authority', async () => {
  let request;
  const fetcher = async (url, init) => { request = { url, init }; return responseFor(); };
  const input = buildVideoDraftInput(candidate);
  await assert.rejects(requestOpenCodexDraft(input, { allowedSourceIds: [sourceId], endpoint: 'http://localhost:10100/v1', model: '', fetcher }), /not_configured/);
  const result = await requestOpenCodexDraft(input, { allowedSourceIds: [sourceId], endpoint: 'http://localhost:10100/v1', model: 'gpt-local', fetcher });
  assert.equal(result.title, draft.title);
  assert.equal(request.url, 'http://localhost:10100/v1/chat/completions');
  const body = JSON.parse(request.init.body);
  assert.equal(body.model, 'gpt-local');
  assert.equal(body.store, false);
  assert.equal(body.response_format.type, 'json_schema');
  assert.equal(JSON.parse(body.messages[1].content).untrusted_source_text, true);
  assert.equal('approval' in result, false);
});

test('local generation validates returned source IDs against the actual approved candidate', async () => {
  const accepted = await generateLocalVideoDraft(candidate, { model: 'gpt-local', fetcher: async () => responseFor() });
  assert.equal(accepted.source_ids[0], sourceId);
  const forged = { ...draft, source_ids: ['source:forged'], scenes: draft.scenes.map(scene => ({ ...scene,
    source_ids: scene.source_ids.length ? ['source:forged'] : [] })) };
  await assert.rejects(generateLocalVideoDraft(candidate, { model: 'gpt-local', fetcher: async () => responseFor(forged) }), /unknown source ID/);
});

test('provider errors and incomplete or oversized responses fail with stable codes only', async () => {
  const input = buildVideoDraftInput(candidate);
  await assert.rejects(requestOpenCodexDraft(input, { allowedSourceIds: [sourceId], model: 'gpt-local', fetcher: async () => new Response('private provider detail', { status: 500 }) }), /^Error: video_draft_provider_failed$/);
  await assert.rejects(requestOpenCodexDraft(input, { allowedSourceIds: [sourceId], model: 'gpt-local', fetcher: async () => Response.json({ choices: [{ finish_reason: 'length', message: { content: '{}' } }] }) }), /incomplete_video_draft_response/);
  await assert.rejects(requestOpenCodexDraft(input, { allowedSourceIds: [sourceId], model: 'gpt-local', fetcher: async () => new Response('x'.repeat(512 * 1024 + 1)) }), /opencodex_response_too_large/);
});
