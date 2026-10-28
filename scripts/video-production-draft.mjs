#!/usr/bin/env node
import { open, readFile, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateLocalVideoDraft } from '../lib/video-production/draft.mjs';

const MAX_INPUT_BYTES = 128 * 1024;
const SAFE_CODES = new Set([
  'input_required', 'output_required', 'model_required', 'unknown_argument', 'duplicate_argument',
  'input_output_must_differ', 'input_too_large', 'invalid_candidate_json', 'output_exists',
  'reviewed_evidence_required', 'video_draft_input_too_large', 'invalid_opencodex_endpoint',
  'video_draft_provider_not_configured', 'video_draft_provider_failed', 'invalid_video_draft_response',
  'incomplete_video_draft_response', 'opencodex_response_too_large', 'draft_validation_failed',
]);

export function parseArgs(argv) {
  const options = {};
  const allowed = new Set(['--input', '--output', '--model', '--endpoint']);
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const equals = token.indexOf('=');
    const name = equals === -1 ? token : token.slice(0, equals);
    const inline = equals === -1 ? undefined : token.slice(equals + 1);
    if (!allowed.has(name)) throw new Error('unknown_argument');
    const key = name.slice(2);
    if (Object.hasOwn(options, key)) throw new Error('duplicate_argument');
    const value = inline ?? argv[++index];
    if (!value || value.startsWith('--')) throw new Error(`${key}_required`);
    options[key] = value;
  }
  if (!options.input) throw new Error('input_required');
  if (!options.output) throw new Error('output_required');
  return options;
}

export function safeCliError(error) {
  const code = error instanceof Error ? error.message : '';
  if (SAFE_CODES.has(code) || /^(?:Video script|Fingerprint input) is invalid:/.test(code)) {
    return code.startsWith('Video script') || code.startsWith('Fingerprint input') ? 'draft_validation_failed' : code;
  }
  if (error && typeof error === 'object' && error.code === 'EEXIST') return 'output_exists';
  return 'video_draft_failed';
}

async function readCandidate(path) {
  const bytes = await readFile(path);
  if (bytes.byteLength > MAX_INPUT_BYTES) throw new Error('input_too_large');
  try { return JSON.parse(bytes.toString('utf8')); }
  catch { throw new Error('invalid_candidate_json'); }
}

export async function runVideoProductionDraft(options, { env = process.env, fetcher = fetch } = {}) {
  const inputPath = resolve(options.input);
  const outputPath = resolve(options.output);
  if (inputPath === outputPath) throw new Error('input_output_must_differ');
  const model = options.model ?? env.OPENCODEX_CONTENT_MODEL;
  if (typeof model !== 'string' || !model.trim()) throw new Error('model_required');
  const candidate = await readCandidate(inputPath);
  let output;
  try { output = await open(outputPath, 'wx'); }
  catch (error) { if (error?.code === 'EEXIST') throw new Error('output_exists'); throw error; }
  try {
    const draft = await generateLocalVideoDraft(candidate, { endpoint: options.endpoint ?? env.OPENCODEX_CONTENT_BASE_URL,
      model: model.trim(), apiKey: env.OPENCODEX_CONTENT_API_KEY, fetcher });
    await output.writeFile(`${JSON.stringify(draft, null, 2)}\n`, { encoding: 'utf8' });
    return { output: outputPath, draft };
  } catch (error) {
    await output.close().catch(() => {});
    output = null;
    await unlink(outputPath).catch(() => {});
    throw error;
  } finally {
    await output?.close().catch(() => {});
  }
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  return runVideoProductionDraft(parseArgs(argv), { env });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then(({ output }) => { process.stdout.write(`${JSON.stringify({ ok: true, output })}\n`); })
    .catch((error) => { process.stderr.write(`${safeCliError(error)}\n`); process.exitCode = 1; });
}
