import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { restAll } from './source-pipeline-rest.mjs';
import { loadMemeContentEnv } from './meme-content-env.mjs';
import { validateCatalog } from './build-meme-card-catalog.mjs';
import {
  auditCatalog, sourceHash, buildEvidence, openCodexConfig, requestStructured,
  catalogDraftSchema, originalDraftSchema, reviewSchema, validateCatalogDraft, validateOriginalDraft,
  CATALOG_PROMPT, ORIGINAL_PROMPT, REVIEW_PROMPT, renderDraftCard, parseEvidencePacket,
} from './meme-content-pipeline-core.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
async function pipelineEnv() {
  return loadMemeContentEnv({ root: ROOT });
}
export function parseArgs(args) {
  const command = args[0];
  if (!['audit', 'generate', 'original', 'verify'].includes(command)) throw new Error('Usage: meme-content-pipeline.mjs audit|generate|original|verify [--short-id ID --evidence FILE | --topic TOPIC | --artifact FILE] [--limit 1..5] [--out DIR] [--all-statuses]');
  const options = { command, limit: 1, allStatuses: false, out: resolve(ROOT, 'artifacts/content-pipeline', new Date().toISOString().replace(/[:.]/g, '-')) };
  for (let i = 1; i < args.length; i++) {
    const key = args[i];
    if (key === '--all-statuses' && command === 'audit') { options.allStatuses = true; continue; }
    if (!['--short-id', '--topic', '--limit', '--out', '--evidence', '--artifact'].includes(key) || !args[i + 1] || args[i + 1].startsWith('--')) throw new Error(`Unknown or missing argument: ${key}`);
    const value = args[++i];
    if (key === '--short-id') { if (!/^[a-z0-9]{6,12}$/.test(value)) throw new Error('Invalid short ID'); options.shortId = value; }
    if (key === '--topic') { if (value.trim().length < 2 || value.length > 120) throw new Error('Topic must be 2..120 characters'); options.topic = value.trim(); }
    if (key === '--out') options.out = resolve(value);
    if (key === '--evidence') options.evidenceFile = resolve(value);
    if (key === '--artifact') options.artifactFile = resolve(value);
    if (key === '--limit') { if (!/^[1-5]$/.test(value)) throw new Error('Limit must be 1..5'); options.limit = Number(value); }
  }
  if (command === 'original' && (!options.topic || options.shortId)) throw new Error('Original requires --topic and no --short-id');
  if (command !== 'original' && options.topic) throw new Error('--topic is for original only');
  if (command === 'generate' && (!options.shortId || !options.evidenceFile)) throw new Error('Generate requires --short-id and --evidence from checked sources');
  if (command === 'verify' && !options.artifactFile) throw new Error('Verify requires --artifact');
  if (options.evidenceFile && command !== 'generate') throw new Error('--evidence is for generate only');
  if (options.artifactFile && command !== 'verify') throw new Error('--artifact is for verify only');
  return options;
}

export async function knownOriginalTitles(env, fetcher = fetch) {
  // Only title/alias metadata is read from non-public drafts. No private user data.
  const rest = readOnlyRest(env, true, fetcher);
  const rows = await restAll(rest, 'memes?select=title,aliases&order=id.asc');
  const directory = resolve(ROOT, 'artifacts/content-pipeline');
  let runs = [];
  try { runs = await readdir(directory, { withFileTypes: true }); } catch { return rows; }
  for (const run of runs.filter(item => item.isDirectory() && !item.isSymbolicLink())) {
    const names = await readdir(resolve(directory, run.name));
    for (const name of names.filter(value => /^original-\d+\.json$/.test(value))) {
      try {
        const artifact = JSON.parse(await readFile(resolve(directory, run.name, name), 'utf8'));
        if (artifact.kind === 'house_original' && typeof artifact.draft?.title === 'string') rows.push({ title: artifact.draft.title, aliases: [] });
      } catch { /* A partial run does not hide database titles. */ }
    }
  }
  return rows;
}

export function readOnlyRest(env, allStatuses, fetcher = fetch) {
  const base = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = allStatuses ? env.SUPABASE_SERVICE_ROLE_KEY : env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) throw new Error('Supabase read credentials are missing');
  return async path => {
    const response = await fetcher(`${base}/rest/v1/${path}`, { method: 'GET', redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(30_000), headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (!response.ok) throw new Error(`Catalog read HTTP ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows)) throw new Error('Catalog response is not an array');
    return rows;
  };
}

async function snapshot(env, allStatuses) {
  const rest = readOnlyRest(env, allStatuses);
  const select = 'id,short_id,title,slug,aliases,summary,description,origin,origin_kind,usage_note,caution,usage_examples,origin_year,moderation_status,safety_level,published_at,updated_at,meme_sources(id,source_url,title,source_role,rights_basis,copyright_status),meme_contents(id,meme_id,url,caption,availability,moderation_status,is_representative,type,platform),meme_tags_map(tag_id)';
  const memes = await restAll(rest, `memes?select=${encodeURIComponent(select)}&order=id.asc${allStatuses ? '' : '&moderation_status=in.(approved,limited)'}`);
  const cards = await restAll(rest, 'meme_collectible_cards?select=id,card_no,meme_id,edition,art_seed,active&active=eq.true&order=card_no.asc');
  return { memes, cards, capturedAt: new Date().toISOString(), scope: allStatuses ? 'all_catalog_statuses_read_only' : 'public_catalog' };
}

async function saveJson(path, payload) { await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, { flag: 'wx' }); }
async function saveDraft(out, name, artifact) {
  await saveJson(resolve(out, `${name}.json`), artifact);
  await writeFile(resolve(out, `${name}.svg`), renderDraftCard(artifact.draft, artifact.kind === 'house_original'), { flag: 'wx' });
  const draft = artifact.draft;
  await writeFile(resolve(out, `${name}.md`), `# ${draft.title}\n\n${draft.summary}\n\n${draft.description}\n\n## 활용\n\n${draft.usageNote}\n\n${draft.examples.map(example => `- ${example.context}: ${example.text}`).join('\n')}\n\n## 주의\n\n${draft.caution}\n\n카드 설명: ${draft.card.caption}\n\n아트 방향: ${draft.card.visualBrief}\n\n모델 검토: ${artifact.review.decision}\n\n${artifact.review.issues.join('\n')}\n\n이 파일은 초안입니다. 운영 DB 수정·게시·카드 배정 변경은 하지 않았습니다.\n`, { flag: 'wx' });
}

export function originalAdminDraft(draft, generatedAt) {
  return {
    title: draft.title, summary: draft.summary,
    description: `${draft.description}\n\n활용: ${draft.usageNote}\n\n자체 작성 예문:\n${draft.examples.map(example => `${example.context}: ${example.text}`).join('\n')}\n\n주의: ${draft.caution}\n\n카드 문구: ${draft.card.caption}\n\n비주얼: ${draft.card.visualBrief}\n\n카드 제작 설정: ${JSON.stringify({ motif: draft.card.motif, symbols: draft.card.symbols, composition: draft.card.composition })}`,
    origin: draft.origin, safetyLevel: 'yellow', category: 'image', difficulty: 'normal',
    originYear: new Date(generatedAt).getUTCFullYear(), country: 'KR',
    usageContext: { work: 'yellow', friends: 'green', family: 'yellow', sns: 'yellow' },
  };
}

export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const env = await pipelineEnv();
  await mkdir(options.out, { recursive: true });
  const current = await snapshot(env, options.allStatuses);
  const manifest = JSON.parse(await readFile(resolve(ROOT, 'data/meme-cards/catalog-1000.json'), 'utf8'));
  validateCatalog(manifest);
  const audit = { ...auditCatalog(current.memes, current.cards, manifest), capturedAt: current.capturedAt, scope: current.scope };
  await saveJson(resolve(options.out, 'audit.json'), audit);
  await saveJson(resolve(options.out, 'snapshot.json'), current);
  if (options.command === 'audit') {
    console.log(JSON.stringify({ out: options.out, scope: audit.scope, memes: audit.memes, cards: audit.cards, affectedMemes: audit.affectedMemes, counts: audit.counts }));
    return;
  }
  if (options.command === 'verify') {
    const artifact = JSON.parse(await readFile(options.artifactFile, 'utf8'));
    if (artifact.schemaVersion !== 1 || artifact.kind !== 'catalog' || artifact.status !== 'draft' || reviewSchema.parse(artifact.review).decision !== 'pass') throw new Error('Only passing catalog drafts can be verified');
    const meme = current.memes.find(row => row.id === artifact.draft?.memeId);
    if (!meme || sourceHash(meme) !== artifact.sourceHash) throw new Error('Source changed; regenerate the catalog draft');
    validateCatalogDraft(artifact.draft, meme, artifact.evidence);
    console.log(JSON.stringify({ verified: true, memeId: meme.id, sourceHash: artifact.sourceHash, humanFactAndRightsReviewRequired: true, databaseWrites: 0 }));
    return;
  }
  const config = openCodexConfig(env);
  const results = [];
  if (options.command === 'generate') {
    const candidates = current.memes.filter(meme => meme.short_id === options.shortId).slice(0, options.limit);
    if (!candidates.length) throw new Error('No matching public memes to generate');
    for (const meme of candidates) {
      const rawEvidence = await readFile(options.evidenceFile, 'utf8');
      if (Buffer.byteLength(rawEvidence) > 100 * 1024) throw new Error('Evidence file is too large');
      const checkedSources = parseEvidencePacket(JSON.parse(rawEvidence), meme.id);
      const evidence = [...buildEvidence(meme), ...checkedSources];
      try {
        if (!evidence.length) throw new Error('No textual evidence: source research required');
        const context = { kind: 'catalog', memeId: meme.id, title: meme.title, evidence, references: checkedSources.map(source => ({ url: source.url, title: source.title })), card: current.cards.find(card => card.meme_id === meme.id) ?? null };
        const output = await requestStructured(config, catalogDraftSchema, CATALOG_PROMPT, context);
        const draft = validateCatalogDraft(output, meme, evidence);
        const review = await requestStructured(config, reviewSchema, REVIEW_PROMPT, { ...context, draft });
        const name = `catalog-${meme.short_id}`;
        const artifact = { schemaVersion: 1, kind: 'catalog', status: 'draft', generatedAt: new Date().toISOString(), provider: 'opencodex', model: config.model, sourceHash: sourceHash(meme), evidence, references: context.references, cardBinding: context.card, draft, review };
        await saveDraft(options.out, name, artifact);
        results.push({ name, status: 'draft', review: review.decision });
      } catch (error) { results.push({ memeId: meme.id, status: 'failed', error: safeError(error) }); }
    }
  } else {
    const allTitles = await knownOriginalTitles(env);
    for (let i = 0; i < options.limit; i++) {
      try {
        const context = { kind: 'house_original', topic: options.topic, variant: i + 1, existingTitles: [...allTitles.map(meme => meme.title), ...results.filter(result => result.title).map(result => result.title)] };
        const output = await requestStructured(config, originalDraftSchema, ORIGINAL_PROMPT, context);
        const draft = validateOriginalDraft(output, [...allTitles, ...results.filter(result => result.title).map(result => ({ title: result.title }))]);
        const review = await requestStructured(config, reviewSchema, REVIEW_PROMPT, { ...context, draft });
        const generatedAt = new Date().toISOString();
        const adminDraft = originalAdminDraft(draft, generatedAt);
        const name = `original-${i + 1}`;
        await saveDraft(options.out, name, { schemaVersion: 1, kind: 'house_original', status: 'draft', generatedAt, topic: options.topic, provider: 'opencodex', model: config.model, draft, review, adminDraft });
        results.push({ name, title: draft.title, status: 'draft', review: review.decision });
      } catch (error) { results.push({ variant: i + 1, status: 'failed', error: safeError(error) }); }
    }
  }
  await saveJson(resolve(options.out, 'run.json'), { generatedAt: new Date().toISOString(), provider: 'opencodex', model: config.model, results, published: 0, databaseWrites: 0 });
  console.log(JSON.stringify({ out: options.out, results, published: 0, databaseWrites: 0 }));
  if (results.some(result => result.status === 'failed' || result.review !== 'pass')) process.exitCode = 1;
}
export function safeError(error) {
  if (error instanceof Error && /^(?:Draft invented rights or certification|Catalog repair needs checked direct source evidence|Evidence quotation is unrelated to output field|Factual fields need direct source grounding|Source changed; regenerate the catalog draft|Only passing catalog drafts can be verified|Evidence belongs to another meme or duplicates IDs)$/.test(error.message)) return error.message;
  if (error instanceof Error && /^(?:OpenCodex HTTP \d{3}|Catalog read HTTP \d{3}|Supabase read credentials are missing|Incomplete OpenCodex response|No textual evidence: source research required|Draft changed meme identity|Unknown or invented evidence quotation|Missing grounding for \w+|Draft invented an origin year|Original draft duplicates a catalog title or alias|Original must describe its creation, not invent folk history)$/.test(error.message)) return error.message;
  if (error instanceof Error && /^(?:Supabase target URL is missing|Supabase public read credential is missing|Supabase target URL is invalid|Supabase target URL must identify one project|Environment root is required|Opaque service key cannot be project-verified; use a project-bound JWT service_role key or an authenticated read preflight|No valid (?:anon|service_role) credential matches the selected (?:local target|target project))$/.test(error.message)) return error.message;
  if (error instanceof Error && /^(?:process NEXT_PUBLIC_SUPABASE_ANON_KEY (?:uses an opaque public key that cannot be project-verified|must have anon role|is expired or has no expiry|does not identify a Supabase project|does not match the target project|has an invalid issuer for the local target|has no trusted issuer|has an invalid issuer|has an issuer that does not match the target project)|process SUPABASE_SERVICE_ROLE_KEY (?:uses an opaque service key that cannot be project-verified|must have service_role role|is expired or has no expiry|does not identify a Supabase project|does not match the target project|has an invalid issuer for the local target|has no trusted issuer|has an invalid issuer|has an issuer that does not match the target project))$/.test(error.message)) return error.message;
  return error?.name === 'TimeoutError' ? 'OpenCodex timeout' : 'Generation or validation failed';
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(safeError(error) === 'Generation or validation failed' ? 'Pipeline failed; verify arguments, credentials and connectivity.' : safeError(error)); process.exitCode = 1; });
}
