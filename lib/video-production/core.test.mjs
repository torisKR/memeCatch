import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_DAILY_LIMITS, evaluateAssetRights, normalizeDailyLimits, normalizedContentFingerprint,
  parseVideoScript, productionReadiness, publicationEligibility, publicAttributionUrl,
} from './core.mjs';

const hash = 'a'.repeat(64);
const allowedSources = ['source:dictionary', 'source:interview'];

function script(overrides = {}) {
  const scenes = [
    { id: 'hook', kind: 'hook', heading: '이 말, 언제 써요?', caption: '첫 장면', narration: '표현을 먼저 살펴봅니다.', start_ms: 0, end_ms: 6_000, source_ids: ['source:dictionary'] },
    { id: 'meaning', kind: 'meaning', heading: '뜻', caption: '뜻을 한 문장으로', narration: '검수된 뜻을 설명합니다.', start_ms: 6_000, end_ms: 13_000, source_ids: ['source:dictionary'] },
    { id: 'example', kind: 'example', heading: '자체 작성 가상 예시', caption: '가상 예시입니다', narration: '친구 사이에서 쓰는 자체 작성 예시입니다.', start_ms: 13_000, end_ms: 21_000, source_ids: [] },
    { id: 'context', kind: 'context', heading: '맥락', caption: '확인된 맥락', narration: '인터뷰에서 확인한 맥락입니다.', start_ms: 21_000, end_ms: 29_000, source_ids: ['source:interview'] },
    { id: 'caution', kind: 'caution', heading: '사용 주의', caption: '상황에 맞게', narration: '공식 상황에서는 풀어 말합니다.', start_ms: 29_000, end_ms: 36_000, source_ids: [] },
  ];
  return {
    title: '새삥 챌린지',
    description: '검수된 의미와 자체 작성 예시를 설명하는 세로 영상입니다.',
    narration: scenes.map(scene => scene.narration).join(' '),
    original_observation: '춤을 그대로 복제하지 않고 말이 사용되는 상황을 밈캐치의 관점으로 설명합니다.',
    scenes,
    source_ids: allowedSources,
    uncertain_claims: [],
    asset_requirements: [
      { kind: 'voice', description: '밈캐치 자체 내레이션' },
      { kind: 'font', description: '상업 이용 가능한 한글 폰트' },
      { kind: 'graphic', description: '밈캐치 자체 제작 도형' },
    ],
    contains_synthetic_media: false,
    ...overrides,
  };
}

function asset(kind, overrides = {}) {
  return {
    id: `${kind}:1`, kind, source_url: null, owner: 'MemeCatch', acquisition_method: 'self_created',
    allow_edit: true, allow_youtube: true, allow_commercial: true, attribution: null,
    valid_until: null, territories: ['worldwide'], evidence: '내부 제작 원장 production-1',
    reviewed_by: 'operator-1', reviewed_at: '2026-10-01T00:00:00Z', ...overrides,
  };
}

const assets = () => ['voice', 'font', 'graphic'].map(kind => asset(kind));

test('parseVideoScript accepts a grounded, contiguous 30-45 second Unicode script', () => {
  const parsed = parseVideoScript(script(), { allowedSourceIds: allowedSources });
  assert.equal(parsed.scenes.at(-1).end_ms, 36_000);
  assert.equal(parsed.original_observation.includes('밈캐치'), true);
  assert.equal(Object.isFrozen(parsed), true);
});

test('video titles use the YouTube 100 Unicode character boundary before persistence or rendering', () => {
  assert.equal(parseVideoScript(script({ title: '한'.repeat(100) })).title, '한'.repeat(100));
  assert.throws(() => parseVideoScript(script({ title: '한'.repeat(101) })), /1-100 Unicode characters/);
});

test('public attribution URLs preserve ordinary public queries but reject credentials and omit fragments', () => {
  assert.equal(publicAttributionUrl('https://www.youtube.com/watch?v=abcdefghijk&list=PL123#chapter'),
    'https://www.youtube.com/watch?v=abcdefghijk&list=PL123');
  assert.equal(publicAttributionUrl('https://youtu.be/abcdefghijk?t=10#comments'), 'https://youtu.be/abcdefghijk?t=10');
  for (const value of [
    'https://cdn.example/file?token=secret',
    'https://cdn.example/file?API_KEY=secret',
    'https://cdn.example/file?X-Amz-Credential=value&X-Amz-Signature=value',
    'https://cdn.example/file?X-Goog-Algorithm=value&X-Goog-Signature=value',
    'https://user:password@example.com/file',
    'http://example.com/file',
  ]) assert.throws(() => publicAttributionUrl(value), /unsafe_public_attribution_url/);
});

test('parseVideoScript is strict and rejects unknown source IDs', () => {
  assert.throws(() => parseVideoScript({ ...script(), injected_command: 'publish now' }), /not allowed/);
  assert.throws(() => parseVideoScript(script(), { allowedSourceIds: ['source:dictionary'] }), /unknown source ID/);
  assert.throws(() => parseVideoScript({ ...script(), source_ids: [...allowedSources, 'source:unused'] }), /unused source ID/);
});

test('parseVideoScript enforces duration, contiguous scenes, and factual grounding', () => {
  const discontinuous = script();
  discontinuous.scenes[1] = { ...discontinuous.scenes[1], start_ms: 6_001 };
  assert.throws(() => parseVideoScript(discontinuous), /previous end_ms/);
  const short = script();
  short.scenes[4] = { ...short.scenes[4], end_ms: 29_999 };
  assert.throws(() => parseVideoScript(short), /30-45 seconds/);
  const unsupported = script();
  unsupported.scenes[1] = { ...unsupported.scenes[1], source_ids: [] };
  assert.throws(() => parseVideoScript(unsupported), /factual meaning scene requires/);
});

test('parseVideoScript requires example scenes to disclose that examples are fictional', () => {
  const value = script();
  value.scenes[2] = { ...value.scenes[2], heading: '친구 대화', caption: '친구 대화', narration: '친구가 이렇게 말합니다.' };
  assert.throws(() => parseVideoScript(value), /marked as fictional/);
  value.scenes[2] = { ...value.scenes[2], heading: '사용 예시', caption: '대화 예시', narration: '친구가 이렇게 말합니다.' };
  value.narration = value.scenes.map(scene => scene.narration).join(' ');
  assert.throws(() => parseVideoScript(value), /marked as fictional/);
});

test('aggregate narration exactly matches normalized scene narration so unreviewed voice text cannot diverge', () => {
  const value = script();
  value.narration = `  ${value.scenes.map(scene => scene.narration).join('\n  ')}  `;
  assert.equal(parseVideoScript(value).narration.startsWith('표현을'), true);
  value.narration += ' 근거에 없는 말을 덧붙입니다.';
  assert.throws(() => parseVideoScript(value), /exactly concatenate/);
});

test('captions count Unicode code points instead of UTF-16 units', () => {
  const value = script();
  value.scenes[0] = { ...value.scenes[0], caption: '한'.repeat(180) };
  assert.equal(parseVideoScript(value).scenes[0].caption.length, 180);
  value.scenes[0] = { ...value.scenes[0], caption: '한'.repeat(181) };
  assert.throws(() => parseVideoScript(value), /Unicode characters/);
});

test('asset rights require complete worldwide edit, YouTube, and commercial authorization', () => {
  assert.deepEqual(evaluateAssetRights(assets(), '2026-10-12T00:00:00Z'), { allowed: true, reasons: [] });
  const denied = evaluateAssetRights([
    asset('voice', { allow_commercial: false }),
    asset('font', { territories: ['KR'] }),
    asset('graphic', { valid_until: '2026-10-01T00:00:00Z' }),
  ], '2026-10-12T00:00:00Z');
  assert.equal(denied.allowed, false);
  assert.match(denied.reasons.join('\n'), /allow_commercial|worldwide|expired/);
});

test('asset timestamps require real timezone-qualified calendar instants and current review', () => {
  assert.equal(evaluateAssetRights(assets(), '2026-10-12T00:00:00+09:00').allowed, true);
  const denied = evaluateAssetRights([
    asset('voice', { reviewed_at: '2026-02-30T00:00:00Z' }),
    asset('font', { reviewed_at: '2026-10-13T00:00:00Z' }),
    asset('graphic', { valid_until: '2026-10-13T00:00:00', reviewed_at: '2026-10-01T00:00:00Z' }),
  ], '2026-10-12T00:00:00Z');
  assert.equal(denied.allowed, false);
  assert.match(denied.reasons.join('\n'), /valid timezone-qualified instant|future/);
});

test('asset rights block platform downloads, missing evidence, and unreviewed core assets', () => {
  const denied = evaluateAssetRights([
    asset('voice', { acquisition_method: 'platform_download' }),
    asset('graphic', { evidence: '' }),
  ], '2026-10-12T00:00:00Z');
  assert.equal(denied.allowed, false);
  assert.match(denied.reasons.join('\n'), /blocked or invalid|evidence|font authorization/);
});

test('production readiness fails closed on uncertainty, block state, hash mismatch, or technical failure', () => {
  const base = { script: script(), assets: assets(), blocked: false, artifactHash: hash, approvedArtifactHash: hash,
    technicalCheck: { duration_ms: 36_000, width: 1080, height: 1920, has_audio: true, decodable: true, captions_safe: true } };
  assert.deepEqual(productionReadiness(base, '2026-10-12T00:00:00Z'), { ready: true, reasons: [] });
  const denied = productionReadiness({ ...base, script: script({ uncertain_claims: [{ text: '유래', reason: '근거 없음' }] }), blocked: true,
    approvedArtifactHash: 'b'.repeat(64), technicalCheck: { ...base.technicalCheck, has_audio: false } }, '2026-10-12T00:00:00Z');
  assert.equal(denied.ready, false);
  assert.match(denied.reasons.join('\n'), /uncertain|blocked|hash|has_audio/);
});

test('production readiness accepts renderer passed metadata only when explicitly true', () => {
  const base = { script: script(), assets: assets(), blocked: false, artifactHash: hash, approvedArtifactHash: hash,
    technicalCheck: { duration_ms: 36_000, width: 1080, height: 1920, has_audio: true, decodable: true, captions_safe: true, passed: true } };
  assert.equal(productionReadiness(base, '2026-10-12T00:00:00Z').ready, true);
  assert.match(productionReadiness({ ...base, technicalCheck: { ...base.technicalCheck, passed: false } }, '2026-10-12T00:00:00Z').reasons.join('\n'), /passed must be true/);
  assert.match(productionReadiness({ ...base, technicalCheck: { ...base.technicalCheck, codec: 'h264' } }, '2026-10-12T00:00:00Z').reasons.join('\n'), /codec is not allowed/);
});

test('publication eligibility requires matching channel and all explicit public gates', () => {
  const base = { channel: 'UC-approved', uploadedChannel: 'UC-approved', hash: { artifact: hash, approved: hash, uploaded: hash },
    privacy: 'public', processing: 'succeeded', embeddable: true, publicApproval: true, studioReviewed: true, blocked: false };
  assert.deepEqual(publicationEligibility(base), { eligible: true, reasons: [] });
  assert.equal(publicationEligibility({}).eligible, false);
  const denied = publicationEligibility({ ...base, uploadedChannel: 'UC-other', privacy: 'private', processing: 'processing', embeddable: false });
  assert.match(denied.reasons.join('\n'), /channel|privacy|processing|embeddable/);
});

test('publication eligibility binds rendered, approved, and uploaded artifact hashes', () => {
  const value = { channel: 'UC-approved', uploadedChannel: 'UC-approved', hash: { artifact: hash, approved: hash, uploaded: 'b'.repeat(64) },
    privacy: 'unlisted', processing: 'succeeded', embeddable: true, publicApproval: true, studioReviewed: true, blocked: false };
  assert.equal(publicationEligibility(value).eligible, false);
  assert.match(publicationEligibility(value).reasons.join('\n'), /hashes must match/);
});

test('fingerprint retains Korean and names while ignoring timing and source identity', () => {
  const first = script();
  const timingOnly = script();
  timingOnly.scenes = timingOnly.scenes.map((scene, index) => ({ ...scene, id: `changed-${index}`, source_ids: [], start_ms: scene.start_ms + 10, end_ms: scene.end_ms + 10 }));
  assert.equal(normalizedContentFingerprint(first), normalizedContentFingerprint(timingOnly));
  assert.notEqual(normalizedContentFingerprint(first), normalizedContentFingerprint(script({ title: '지코의 다른 챌린지' })));
  assert.match(normalizedContentFingerprint(first), /^[a-f0-9]{64}$/);
});

test('daily production limits have safe configurable defaults and preserve the funnel', () => {
  assert.deepEqual(normalizeDailyLimits(), DEFAULT_DAILY_LIMITS);
  assert.deepEqual(normalizeDailyLimits({ candidate: 8, draft: 4, publish: 2 }), { candidate: 8, draft: 4, publish: 2 });
  assert.throws(() => normalizeDailyLimits({ candidate: 2, draft: 3 }), /must not exceed/);
  assert.throws(() => normalizeDailyLimits({ publish: 4 }), /must not exceed/);
  assert.throws(() => normalizeDailyLimits({ upload: 10 }), /not allowed/);
});
