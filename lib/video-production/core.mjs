import { createHash } from 'node:crypto';

const SCENE_KINDS = new Set(['hook', 'meaning', 'example', 'context', 'caution']);
const ASSET_KINDS = new Set(['graphic', 'voice', 'font', 'image', 'video', 'music']);
const ACQUISITION_METHODS = new Set(['self_created', 'creator_supplied', 'licensed']);
const SHA256 = /^[a-f0-9]{64}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const REQUIRED_ASSET_KINDS = ['voice', 'font', 'graphic'];
const CREDENTIAL_QUERY_NAMES = new Set([
  'token', 'access_token', 'refresh_token', 'api_key', 'apikey', 'key', 'secret',
  'signature', 'sig', 'auth', 'authorization', 'password',
]);

export const DEFAULT_DAILY_LIMITS = Object.freeze({ candidate: 5, draft: 3, publish: 1 });

export function publicAttributionUrl(value) {
  if (typeof value !== 'string') throw new TypeError('unsafe_public_attribution_url');
  let url;
  try { url = new URL(value); } catch { throw new TypeError('unsafe_public_attribution_url'); }
  if (url.protocol !== 'https:' || url.username || url.password) throw new TypeError('unsafe_public_attribution_url');
  for (const name of url.searchParams.keys()) {
    const normalized = name.trim().toLowerCase();
    if (CREDENTIAL_QUERY_NAMES.has(normalized) || normalized.startsWith('x-amz-') || normalized.startsWith('x-goog-')) {
      throw new TypeError('unsafe_public_attribution_url');
    }
  }
  url.hash = '';
  return url.toString();
}

function record(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function own(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function exactKeys(value, keys, path, errors, optionalKeys = []) {
  if (!record(value)) {
    errors.push(`${path} must be an object`);
    return false;
  }
  for (const key of keys) if (!optionalKeys.includes(key) && !own(value, key)) errors.push(`${path}.${key} is required`);
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`${path}.${key} is not allowed`);
  return true;
}

function text(value, path, errors, min, max) {
  if (typeof value !== 'string') {
    errors.push(`${path} must be a string`);
    return '';
  }
  const result = value.trim();
  const length = [...result].length;
  if (length < min || length > max) errors.push(`${path} must contain ${min}-${max} Unicode characters`);
  return result;
}

function stringList(value, path, errors, { min = 0, max = 50 } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    errors.push(`${path} must contain ${min}-${max} items`);
    return [];
  }
  const result = value.map((item, index) => text(item, `${path}[${index}]`, errors, 1, 120));
  if (new Set(result).size !== result.length) errors.push(`${path} must not contain duplicates`);
  return result;
}

function validDate(value) {
  if (typeof value !== 'string') return false;
  const match = value.match(ISO_INSTANT);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const [date, time] = value.split('T');
  const [year, month, day] = date.split('-').map(Number);
  const clock = time.match(/^(\d{2}):(\d{2}):(\d{2})/);
  if (!clock) return false;
  const [, hour, minute, second] = clock.map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth
    && hour <= 23 && minute <= 59 && second <= 59;
}

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/gu, ' ');
}

function nowDate(now) {
  const result = now instanceof Date ? new Date(now) : new Date(now);
  if (!Number.isFinite(result.valueOf())) throw new TypeError('now must be a valid Date or timestamp');
  return result;
}

function schemaError(name, errors) {
  const error = new TypeError(`${name} is invalid: ${errors.join('; ')}`);
  error.issues = Object.freeze([...errors]);
  return error;
}

/** Parse untrusted model output as data. No field is interpreted as an instruction. */
export function parseVideoScript(value, { allowedSourceIds } = {}) {
  const errors = [];
  const rootKeys = [
    'title', 'description', 'narration', 'original_observation', 'scenes', 'source_ids',
    'uncertain_claims', 'asset_requirements', 'contains_synthetic_media',
  ];
  exactKeys(value, rootKeys, 'script', errors);
  if (!record(value)) throw schemaError('Video script', errors);

  const title = text(value.title, 'script.title', errors, 1, 100);
  const description = text(value.description, 'script.description', errors, 20, 600);
  const narration = text(value.narration, 'script.narration', errors, 40, 4_000);
  const originalObservation = text(value.original_observation, 'script.original_observation', errors, 20, 600);
  const sourceIds = stringList(value.source_ids, 'script.source_ids', errors, { min: 1, max: 30 });

  let allowed;
  if (allowedSourceIds !== undefined) {
    if (!Array.isArray(allowedSourceIds) && !(allowedSourceIds instanceof Set)) {
      errors.push('allowedSourceIds must be an array or Set');
      allowed = new Set();
    } else {
      allowed = new Set([...allowedSourceIds]);
      if ([...allowed].some(id => typeof id !== 'string' || !id.trim())) errors.push('allowedSourceIds must contain non-empty strings');
    }
    for (const id of sourceIds) if (!allowed.has(id)) errors.push(`script.source_ids contains unknown source ID: ${id}`);
  }

  const scenes = [];
  if (!Array.isArray(value.scenes) || value.scenes.length < 5 || value.scenes.length > 12) {
    errors.push('script.scenes must contain 5-12 scenes');
  } else {
    const ids = new Set();
    for (const [index, item] of value.scenes.entries()) {
      const path = `script.scenes[${index}]`;
      const keys = ['id', 'kind', 'heading', 'caption', 'narration', 'start_ms', 'end_ms', 'source_ids'];
      exactKeys(item, keys, path, errors);
      if (!record(item)) continue;
      const id = text(item.id, `${path}.id`, errors, 1, 64);
      if (!/^[\p{L}\p{N}][\p{L}\p{N}_.:-]*$/u.test(id)) errors.push(`${path}.id has an invalid format`);
      if (ids.has(id)) errors.push(`${path}.id duplicates ${id}`);
      ids.add(id);
      const kind = item.kind;
      if (!SCENE_KINDS.has(kind)) errors.push(`${path}.kind is invalid`);
      const heading = text(item.heading, `${path}.heading`, errors, 1, 80);
      const caption = text(item.caption, `${path}.caption`, errors, 1, 180);
      const sceneNarration = text(item.narration, `${path}.narration`, errors, 1, 900);
      const sceneSourceIds = stringList(item.source_ids, `${path}.source_ids`, errors, { min: 0, max: 12 });
      for (const sourceId of sceneSourceIds) {
        if (!sourceIds.includes(sourceId)) errors.push(`${path}.source_ids contains an ID missing from script.source_ids: ${sourceId}`);
        if (allowed && !allowed.has(sourceId)) errors.push(`${path}.source_ids contains unknown source ID: ${sourceId}`);
      }
      if ((kind === 'meaning' || kind === 'context') && sceneSourceIds.length === 0) {
        errors.push(`${path} factual ${kind} scene requires a source ID`);
      }
      if (kind === 'example' && !/(?:가상|자체\s*작성|fictional|invented)/iu.test(`${heading} ${caption} ${sceneNarration}`)) {
        errors.push(`${path} example must be marked as fictional or self-authored`);
      }
      if (!Number.isInteger(item.start_ms) || item.start_ms < 0) errors.push(`${path}.start_ms must be a non-negative integer`);
      if (!Number.isInteger(item.end_ms) || item.end_ms <= item.start_ms) errors.push(`${path}.end_ms must be an integer after start_ms`);
      if (index === 0 && item.start_ms !== 0) errors.push('script.scenes[0].start_ms must be 0');
      if (index > 0 && item.start_ms !== value.scenes[index - 1]?.end_ms) errors.push(`${path}.start_ms must equal the previous end_ms`);
      scenes.push({ id, kind, heading, caption, narration: sceneNarration, start_ms: item.start_ms, end_ms: item.end_ms, source_ids: sceneSourceIds });
    }
    const duration = value.scenes.at(-1)?.end_ms;
    if (!Number.isInteger(duration) || duration < 30_000 || duration > 45_000) errors.push('script duration must be 30-45 seconds');
    const aggregateNarration = normalizeWhitespace(scenes.map(scene => scene.narration).join(' '));
    if (normalizeWhitespace(narration) !== aggregateNarration) errors.push('script.narration must exactly concatenate scene narration in order');
    const used = new Set(scenes.flatMap(scene => scene.source_ids));
    for (const id of sourceIds) if (!used.has(id)) errors.push(`script.source_ids contains unused source ID: ${id}`);
  }

  const uncertainClaims = [];
  if (!Array.isArray(value.uncertain_claims) || value.uncertain_claims.length > 20) {
    errors.push('script.uncertain_claims must contain 0-20 items');
  } else {
    for (const [index, item] of value.uncertain_claims.entries()) {
      const path = `script.uncertain_claims[${index}]`;
      exactKeys(item, ['text', 'reason'], path, errors);
      if (record(item)) uncertainClaims.push({
        text: text(item.text, `${path}.text`, errors, 1, 400),
        reason: text(item.reason, `${path}.reason`, errors, 1, 400),
      });
    }
  }

  const assetRequirements = [];
  if (!Array.isArray(value.asset_requirements) || value.asset_requirements.length < 3 || value.asset_requirements.length > 30) {
    errors.push('script.asset_requirements must contain 3-30 items');
  } else {
    for (const [index, item] of value.asset_requirements.entries()) {
      const path = `script.asset_requirements[${index}]`;
      exactKeys(item, ['kind', 'description'], path, errors);
      if (!record(item)) continue;
      if (!ASSET_KINDS.has(item.kind)) errors.push(`${path}.kind is invalid`);
      assetRequirements.push({ kind: item.kind, description: text(item.description, `${path}.description`, errors, 1, 400) });
    }
  }

  if (typeof value.contains_synthetic_media !== 'boolean') errors.push('script.contains_synthetic_media must be boolean');
  if (errors.length) throw schemaError('Video script', errors);
  return Object.freeze({
    title, description, narration, original_observation: originalObservation,
    scenes: Object.freeze(scenes.map(scene => Object.freeze({ ...scene, source_ids: Object.freeze([...scene.source_ids]) }))), source_ids: Object.freeze(sourceIds),
    uncertain_claims: Object.freeze(uncertainClaims.map(claim => Object.freeze(claim))),
    asset_requirements: Object.freeze(assetRequirements.map(asset => Object.freeze(asset))),
    contains_synthetic_media: value.contains_synthetic_media,
  });
}

function validateAsset(asset, index, now) {
  const reasons = [];
  const path = `assets[${index}]`;
  const keys = [
    'id', 'kind', 'source_url', 'owner', 'acquisition_method', 'allow_edit', 'allow_youtube',
    'allow_commercial', 'attribution', 'valid_until', 'territories', 'evidence', 'reviewed_by', 'reviewed_at',
  ];
  exactKeys(asset, keys, path, reasons);
  if (!record(asset)) return reasons;
  const id = text(asset.id, `${path}.id`, reasons, 1, 100);
  if (!ASSET_KINDS.has(asset.kind)) reasons.push(`${path}.kind is invalid`);
  if (!ACQUISITION_METHODS.has(asset.acquisition_method)) reasons.push(`${path}.acquisition_method is blocked or invalid`);
  text(asset.owner, `${path}.owner`, reasons, 1, 200);
  text(asset.evidence, `${path}.evidence`, reasons, 1, 1_000);
  text(asset.reviewed_by, `${path}.reviewed_by`, reasons, 1, 200);
  if (asset.source_url !== null && (typeof asset.source_url !== 'string' || !/^https:\/\/[^\s]+$/i.test(asset.source_url))) reasons.push(`${path}.source_url must be null or an HTTPS URL`);
  if (asset.acquisition_method !== 'self_created' && asset.source_url === null) reasons.push(`${path}.source_url is required for supplied or licensed assets`);
  for (const permission of ['allow_edit', 'allow_youtube', 'allow_commercial']) {
    if (asset[permission] !== true) reasons.push(`${path}.${permission} must be explicitly true`);
  }
  if (asset.attribution !== null && typeof asset.attribution !== 'string') reasons.push(`${path}.attribution must be a string or null`);
  if (asset.attribution !== null && !asset.attribution.trim()) reasons.push(`${path}.attribution must not be empty`);
  if (asset.valid_until !== null && !validDate(asset.valid_until)) reasons.push(`${path}.valid_until must be a valid timezone-qualified instant or null`);
  if (validDate(asset.valid_until) && Date.parse(asset.valid_until) <= now.valueOf()) reasons.push(`${path}.valid_until has expired`);
  if (!Array.isArray(asset.territories) || asset.territories.length === 0 || asset.territories.some(item => typeof item !== 'string' || !item.trim())) {
    reasons.push(`${path}.territories must contain non-empty strings`);
  } else if (!asset.territories.some(item => item.trim().toLowerCase() === 'worldwide')) {
    reasons.push(`${path}.territories must include worldwide`);
  }
  if (!validDate(asset.reviewed_at)) reasons.push(`${path}.reviewed_at must be a valid timezone-qualified instant`);
  if (validDate(asset.reviewed_at) && Date.parse(asset.reviewed_at) > now.valueOf()) reasons.push(`${path}.reviewed_at must not be in the future`);
  return reasons.map(reason => `${id || index}: ${reason}`);
}

export function evaluateAssetRights(assets, now = new Date()) {
  const current = nowDate(now);
  const reasons = [];
  if (!Array.isArray(assets)) return Object.freeze({ allowed: false, reasons: Object.freeze(['assets must be an array']) });
  if (assets.length === 0) reasons.push('assets must not be empty');
  const ids = new Set();
  for (const [index, asset] of assets.entries()) {
    reasons.push(...validateAsset(asset, index, current));
    if (record(asset) && typeof asset.id === 'string') {
      if (ids.has(asset.id)) reasons.push(`assets contains duplicate ID: ${asset.id}`);
      ids.add(asset.id);
    }
  }
  for (const kind of REQUIRED_ASSET_KINDS) {
    if (!assets.some(asset => record(asset) && asset.kind === kind)) reasons.push(`assets is missing required ${kind} authorization`);
  }
  return Object.freeze({ allowed: reasons.length === 0, reasons: Object.freeze(reasons) });
}

function validateTechnicalCheck(value, reasons) {
  const keys = ['duration_ms', 'width', 'height', 'has_audio', 'decodable', 'captions_safe', 'passed'];
  exactKeys(value, keys, 'technicalCheck', reasons, ['passed']);
  if (!record(value)) return;
  if (!Number.isInteger(value.duration_ms) || value.duration_ms < 30_000 || value.duration_ms > 45_000) reasons.push('technicalCheck.duration_ms must be 30000-45000');
  if (value.width !== 1080 || value.height !== 1920) reasons.push('technicalCheck must be 1080x1920');
  for (const field of ['has_audio', 'decodable', 'captions_safe']) if (value[field] !== true) reasons.push(`technicalCheck.${field} must be explicitly true`);
  if (own(value, 'passed') && value.passed !== true) reasons.push('technicalCheck.passed must be true when provided');
}

export function productionReadiness(input, now = new Date()) {
  const reasons = [];
  const keys = ['script', 'assets', 'blocked', 'artifactHash', 'approvedArtifactHash', 'technicalCheck'];
  exactKeys(input, keys, 'input', reasons);
  if (!record(input)) return Object.freeze({ ready: false, reasons: Object.freeze(reasons) });
  let script;
  try { script = parseVideoScript(input.script); } catch (error) { reasons.push(...(error.issues ?? [error.message])); }
  if (script?.uncertain_claims.length) reasons.push('script has unresolved uncertain claims');
  const rights = evaluateAssetRights(input.assets, now);
  reasons.push(...rights.reasons);
  if (input.blocked !== false) reasons.push('blocked must be explicitly false');
  if (typeof input.artifactHash !== 'string' || !SHA256.test(input.artifactHash)) reasons.push('artifactHash must be a lowercase SHA-256 digest');
  if (typeof input.approvedArtifactHash !== 'string' || !SHA256.test(input.approvedArtifactHash)) reasons.push('approvedArtifactHash must be a lowercase SHA-256 digest');
  if (SHA256.test(input.artifactHash) && SHA256.test(input.approvedArtifactHash) && input.artifactHash !== input.approvedArtifactHash) reasons.push('approved artifact hash does not match rendered artifact hash');
  validateTechnicalCheck(input.technicalCheck, reasons);
  return Object.freeze({ ready: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function publicationEligibility(input) {
  const reasons = [];
  const keys = ['channel', 'uploadedChannel', 'hash', 'privacy', 'processing', 'embeddable', 'publicApproval', 'studioReviewed', 'blocked'];
  exactKeys(input, keys, 'input', reasons);
  if (!record(input)) return Object.freeze({ eligible: false, reasons: Object.freeze(reasons) });
  const channel = text(input.channel, 'input.channel', reasons, 1, 120);
  const uploadedChannel = text(input.uploadedChannel, 'input.uploadedChannel', reasons, 1, 120);
  if (channel && uploadedChannel && channel !== uploadedChannel) reasons.push('uploaded channel does not match the approved channel');
  exactKeys(input.hash, ['artifact', 'approved', 'uploaded'], 'input.hash', reasons);
  if (record(input.hash)) {
    for (const key of ['artifact', 'approved', 'uploaded']) if (typeof input.hash[key] !== 'string' || !SHA256.test(input.hash[key])) reasons.push(`input.hash.${key} must be a lowercase SHA-256 digest`);
    if ([input.hash.artifact, input.hash.approved, input.hash.uploaded].every(value => SHA256.test(value)) && new Set([input.hash.artifact, input.hash.approved, input.hash.uploaded]).size !== 1) reasons.push('artifact, approval, and uploaded hashes must match');
  }
  if (!['public', 'unlisted'].includes(input.privacy)) reasons.push('privacy must be explicitly public or unlisted');
  if (input.processing !== 'succeeded') reasons.push('processing must be succeeded');
  if (input.embeddable !== true) reasons.push('embeddable must be explicitly true');
  if (input.publicApproval !== true) reasons.push('publicApproval must be explicitly true');
  if (input.studioReviewed !== true) reasons.push('studioReviewed must be explicitly true');
  if (input.blocked !== false) reasons.push('blocked must be explicitly false');
  return Object.freeze({ eligible: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function normalizeDailyLimits(value = {}) {
  if (!record(value)) throw new TypeError('Daily limits must be an object');
  const errors = [];
  const keys = ['candidate', 'draft', 'publish'];
  for (const key of Object.keys(value)) if (!keys.includes(key)) errors.push(`limits.${key} is not allowed`);
  const limits = { ...DEFAULT_DAILY_LIMITS, ...value };
  for (const key of keys) if (!Number.isInteger(limits[key]) || limits[key] < 0 || limits[key] > 1_000) errors.push(`limits.${key} must be an integer from 0 to 1000`);
  if (limits.draft > limits.candidate) errors.push('limits.draft must not exceed limits.candidate');
  if (limits.publish > limits.draft) errors.push('limits.publish must not exceed limits.draft');
  if (errors.length) throw schemaError('Daily limits', errors);
  return Object.freeze(limits);
}

function semanticText(value) {
  return value.normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function normalizedContentFingerprint(script) {
  if (!record(script)) throw new TypeError('script must be an object');
  const errors = [];
  const title = text(script.title, 'script.title', errors, 1, 120);
  const observation = text(script.original_observation, 'script.original_observation', errors, 1, 600);
  if (!Array.isArray(script.scenes) || script.scenes.length === 0) errors.push('script.scenes must not be empty');
  const scenes = Array.isArray(script.scenes) ? script.scenes.map((scene, index) => {
    if (!record(scene)) { errors.push(`script.scenes[${index}] must be an object`); return ''; }
    return [scene.kind, scene.heading, scene.caption, scene.narration].map((item, field) => text(item, `script.scenes[${index}].semantic[${field}]`, errors, 1, 900)).map(semanticText).join('|');
  }) : [];
  if (errors.length) throw schemaError('Fingerprint input', errors);
  const normalized = [semanticText(title), semanticText(observation), ...scenes].join('\n');
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}
