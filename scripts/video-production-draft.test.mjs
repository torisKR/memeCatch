import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs, runVideoProductionDraft, safeCliError } from './video-production-draft.mjs';

const sourceId = '20000000-0000-4000-8000-000000000002';
const candidate = { id: '10000000-0000-4000-8000-000000000001', title: '테스트 밈', summary: '요약', description: '설명', origin: '기원', usage_note: null, caution: null,
  usage_examples: [], sources: [{ id: sourceId, title: '출처', url: 'https://example.com/source', approved: true }],
  claims: [{ id: 'claim:one', type: 'meaning', text: '확인된 뜻', source_id: sourceId }] };
const scenes = [
  { id: 'hook', kind: 'hook', heading: '도입', caption: '표현을 살펴봅니다', narration: '표현을 먼저 살펴봅니다.', start_ms: 0, end_ms: 6_000, source_ids: [sourceId] },
  { id: 'meaning', kind: 'meaning', heading: '뜻', caption: '검수된 뜻', narration: '검수된 뜻을 설명합니다.', start_ms: 6_000, end_ms: 13_000, source_ids: [sourceId] },
  { id: 'example', kind: 'example', heading: '가상 상황', caption: '자체 작성 대화', narration: '자체 작성한 가상 상황입니다.', start_ms: 13_000, end_ms: 21_000, source_ids: [] },
  { id: 'context', kind: 'context', heading: '맥락', caption: '확인된 맥락', narration: '검수된 맥락을 설명합니다.', start_ms: 21_000, end_ms: 29_000, source_ids: [sourceId] },
  { id: 'caution', kind: 'caution', heading: '주의', caption: '상황에 맞게 사용', narration: '상황에 맞게 풀어 말합니다.', start_ms: 29_000, end_ms: 36_000, source_ids: [] },
];
const draft = { title: '테스트 밈', description: '검수된 근거와 자체 작성 가상 상황으로 사용 맥락을 설명합니다.', narration: scenes.map(scene => scene.narration).join(' '),
  original_observation: '이 표현은 친근한 대화에서 상황을 짧게 압축하는 특징이 있습니다.', scenes, source_ids: [sourceId], uncertain_claims: [],
  asset_requirements: [{ kind: 'voice', description: '자체 음성' }, { kind: 'font', description: '허가된 폰트' }, { kind: 'graphic', description: '자체 그래픽' }], contains_synthetic_media: false };

test('CLI requires explicit input/output and rejects unknown or duplicate arguments', () => {
  assert.deepEqual(parseArgs(['--input', 'candidate.json', '--output=draft.json', '--model', 'gpt-local']), { input: 'candidate.json', output: 'draft.json', model: 'gpt-local' });
  assert.throws(() => parseArgs([]), /input_required/);
  assert.throws(() => parseArgs(['--input', 'x']), /output_required/);
  assert.throws(() => parseArgs(['--input', 'x', '--input', 'y', '--output', 'z']), /duplicate_argument/);
  assert.throws(() => parseArgs(['--input', 'x', '--output', 'y', '--publish']), /unknown_argument/);
});

test('CLI writes one validated draft exclusively and never mutates DB, auth, or uploads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memecatch-video-draft-'));
  const input = join(directory, 'candidate.json');
  const output = join(directory, 'draft.json');
  await writeFile(input, JSON.stringify(candidate));
  let request;
  const result = await runVideoProductionDraft({ input, output }, { env: { OPENCODEX_CONTENT_MODEL: 'gpt-env' }, fetcher: async (url, init) => {
    request = { url, init }; return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(draft) } }] });
  } });
  assert.equal(result.output, output);
  assert.equal(JSON.parse(await readFile(output, 'utf8')).title, '테스트 밈');
  assert.equal(request.url, 'http://localhost:10100/v1/chat/completions');
  assert.equal(request.init.method, 'POST');
  assert.equal(JSON.parse(request.init.body).model, 'gpt-env');
});

test('CLI refuses overwrite before a provider call and requires an explicit model', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memecatch-video-draft-'));
  const input = join(directory, 'candidate.json');
  const output = join(directory, 'existing.json');
  await writeFile(input, JSON.stringify(candidate));
  await writeFile(output, 'keep');
  let calls = 0;
  await assert.rejects(runVideoProductionDraft({ input, output, model: 'gpt-local' }, { env: {}, fetcher: async () => { calls += 1; return new Response(); } }), /output_exists/);
  assert.equal(calls, 0);
  assert.equal(await readFile(output, 'utf8'), 'keep');
  await assert.rejects(runVideoProductionDraft({ input, output: join(directory, 'new.json') }, { env: {} }), /model_required/);
});

test('CLI removes only its newly reserved output after validation failure', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'memecatch-video-draft-'));
  const input = join(directory, 'candidate.json');
  const output = join(directory, 'draft.json');
  await writeFile(input, JSON.stringify(candidate));
  await assert.rejects(runVideoProductionDraft({ input, output, model: 'gpt-local' }, { env: {}, fetcher: async () => Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{}' } }] }) }), /Video script is invalid/);
  await assert.rejects(readFile(output), /ENOENT/);
});

test('CLI error output maps unknown private details to stable safe codes', () => {
  assert.equal(safeCliError(new Error('video_draft_provider_failed')), 'video_draft_provider_failed');
  assert.equal(safeCliError(new Error('provider says secret body token=abc')), 'video_draft_failed');
  assert.equal(safeCliError(Object.assign(new Error('exists'), { code: 'EEXIST' })), 'output_exists');
});
