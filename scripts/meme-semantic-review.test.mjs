import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import {
  enforceFailClosedReview,
  extractYouTubeVideoId,
  fetchYouTubeMetadata,
  parseArgs,
  runSemanticReview,
} from './meme-semantic-review.mjs';

const memeId = 'dbe93730-0dbd-4ef0-a318-92c7e775caf3';

test('CLI requires an audit snapshot and bounds offset, limit, and short ID', () => {
  assert.equal(parseArgs(['--snapshot', 'snapshot.json']).limit, 5);
  assert.equal(parseArgs(['--snapshot', 'snapshot.json', '--offset', '20', '--limit', '20']).offset, 20);
  assert.throws(() => parseArgs([]), /--snapshot/);
  assert.throws(() => parseArgs(['--snapshot', 'x', '--limit', '21']), /1\.\.20/);
  assert.throws(() => parseArgs(['--snapshot', 'x', '--offset', '-1']), /non-negative/);
  assert.throws(() => parseArgs(['--snapshot', 'x', '--short-id', 'bad&select=*']), /short ID/);
});

test('YouTube metadata lookup accepts only known 11-character IDs and cannot become an SSRF target', async () => {
  assert.equal(extractYouTubeVideoId('https://www.youtube.com/watch?v=9bZkp7q19f0'), '9bZkp7q19f0');
  assert.equal(extractYouTubeVideoId('https://youtu.be/9bZkp7q19f0'), '9bZkp7q19f0');
  for (const url of [
    'https://evil.example/watch?v=9bZkp7q19f0',
    'http://www.youtube.com/watch?v=9bZkp7q19f0',
    'https://user@www.youtube.com/watch?v=9bZkp7q19f0',
    'https://www.youtube.com/watch?v=too-short',
  ]) assert.equal(extractYouTubeVideoId(url), null, url);
  let requested;
  const result = await fetchYouTubeMetadata('https://www.youtube.com/watch?v=9bZkp7q19f0&next=https://evil.example', async (url, init) => {
    requested = { url: String(url), init };
    return Response.json({ title: 'PSY - GANGNAM STYLE', author_name: 'officialpsy' });
  });
  const endpoint = new URL(requested.url);
  assert.equal(endpoint.origin, 'https://www.youtube.com');
  assert.equal(endpoint.pathname, '/oembed');
  assert.equal(endpoint.searchParams.get('url'), 'https://www.youtube.com/watch?v=9bZkp7q19f0');
  assert.equal(requested.init.redirect, 'error');
  assert.equal(result.status, 'verified');
});

test('media with missing or failed metadata is forced to unknown even if the model says aligned', () => {
  const review = enforceFailClosedReview({ card: 'aligned', media: 'aligned', issues: [] }, {
    card: { id: 'mc-0012' },
    contents: [{ id: 'video' }],
    mediaMetadata: [{ status: 'unknown', reason: 'request_failed' }],
  });
  assert.equal(review.card, 'aligned');
  assert.equal(review.media, 'unknown');
  assert.match(review.issues[0], /메타데이터/);
});

test('an invalid representative YouTube ID stays unknown even when a snapshot caption exists', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'meme-semantic-invalid-video-'));
  const snapshotPath = resolve(dir, 'snapshot.json');
  const manifestPath = resolve(dir, 'manifest.json');
  await writeFile(snapshotPath, JSON.stringify({ cards: [], memes: [{
    id: memeId, short_id: '89b37mrx', title: '새삥 챌린지 (지코)', summary: '요약', description: '설명', moderation_status: 'approved', safety_level: 'green', published_at: '2026-01-01T00:00:00Z', meme_sources: [],
    meme_contents: [{ id: 'content-a', url: 'https://www.youtube.com/watch?v=invalid', caption: '검증되지 않은 캡션', is_representative: true, moderation_status: 'approved' }],
  }] }));
  await writeFile(manifestPath, JSON.stringify({ cards: [] }));
  const report = await runSemanticReview({ snapshot: snapshotPath, manifest: manifestPath, out: dir, offset: 0, limit: 1 }, {
    env: {}, reviewer: async () => ({ card: 'absent', media: 'aligned', issues: [] }),
    fetcher: async () => { throw new Error('must not request an invalid ID'); },
  });
  assert.equal(report.candidates[0].mediaMetadata[0].reason, 'unsupported_or_invalid_youtube_url');
  assert.equal(report.candidates[0].result.media, 'unknown');
});

test('a database caption cannot independently verify non-YouTube media', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'meme-semantic-caption-only-'));
  const snapshotPath = resolve(dir, 'snapshot.json');
  const manifestPath = resolve(dir, 'manifest.json');
  await writeFile(snapshotPath, JSON.stringify({ cards: [], memes: [{
    id: memeId, short_id: '89b37mrx', title: '새삥 챌린지 (지코)', summary: '요약', description: '설명', moderation_status: 'approved', safety_level: 'green', published_at: '2026-01-01T00:00:00Z', meme_sources: [],
    meme_contents: [{ id: 'content-a', url: 'https://cdn.example/wrong-image.jpg', caption: '새삥 안무를 보여 주는 이미지', is_representative: true, moderation_status: 'approved' }],
  }] }));
  await writeFile(manifestPath, JSON.stringify({ cards: [] }));
  const report = await runSemanticReview({ snapshot: snapshotPath, manifest: manifestPath, out: dir, offset: 0, limit: 1 }, {
    env: {}, reviewer: async () => ({ card: 'absent', media: 'aligned', issues: [] }),
    fetcher: async () => { throw new Error('non-YouTube media must not be fetched'); },
  });
  assert.equal(report.candidates[0].mediaMetadata[0].status, 'unknown');
  assert.equal(report.candidates[0].mediaMetadata[0].reason, 'unverified_caption');
  assert.equal(report.candidates[0].result.media, 'unknown');
});

test('snapshot review includes full matched card semantics and fails closed after oEmbed failure', async () => {
  const dir = await mkdtemp(resolve(tmpdir(), 'meme-semantic-review-'));
  const snapshotPath = resolve(dir, 'snapshot.json');
  const manifestPath = resolve(dir, 'manifest.json');
  await writeFile(snapshotPath, JSON.stringify({ capturedAt: '2026-10-08T00:00:00Z', scope: 'public_catalog', cards: [], memes: [{
    id: memeId, short_id: '89b37mrx', title: '새삥 챌린지 (지코)', summary: '새삥 후렴 안무 챌린지', description: '지코의 새삥 후렴 안무를 따라 추는 챌린지다.',
    moderation_status: 'approved', safety_level: 'green', published_at: '2026-01-01T00:00:00Z', meme_sources: [{ title: '공식 영상', source_url: 'https://www.youtube.com/watch?v=9bZkp7q19f0', source_role: 'reference' }],
    meme_contents: [{ id: 'content-a', url: 'https://www.youtube.com/watch?v=9bZkp7q19f0', caption: '새삥 안무', is_representative: true, moderation_status: 'approved', type: 'video', platform: 'youtube' }],
  }] }));
  await writeFile(manifestPath, JSON.stringify({ cards: [{ id: 'mc-0012', memeId, catalogTitle: '새삥 챌린지 (지코)', cardCaption: '지코의 새삥 후렴 안무를 따라 춘다.', conceptKey: '새삥지코', art: { subject: '새삥: footsteps + music-note + wave', motif: 'dance', symbols: ['footsteps', 'music-note', 'wave'], composition: 'rhythm' } }] }));
  let received;
  const report = await runSemanticReview({ snapshot: snapshotPath, manifest: manifestPath, out: dir, offset: 0, limit: 5, shortId: '89b37mrx' }, {
    env: {}, now: () => new Date('2026-10-08T01:00:00Z'),
    fetcher: async () => { throw new Error('offline'); },
    reviewer: async (_config, _schema, _prompt, input) => { received = input; return { card: 'aligned', media: 'aligned', issues: [] }; },
  });
  assert.deepEqual(received.card, {
    id: 'mc-0012', memeId, catalogTitle: '새삥 챌린지 (지코)', cardCaption: '지코의 새삥 후렴 안무를 따라 춘다.', conceptKey: '새삥지코',
    art: { subject: '새삥: footsteps + music-note + wave', motif: 'dance', symbols: ['footsteps', 'music-note', 'wave'], composition: 'rhythm' },
  });
  assert.equal(report.candidates[0].result.card, 'aligned');
  assert.equal(report.candidates[0].result.media, 'unknown');
  assert.equal(report.candidates[0].mediaMetadata[0].reason, 'request_failed');
  assert.equal(report.nextOffset, null);
  assert.equal(report.databaseWrites, 0);
});
