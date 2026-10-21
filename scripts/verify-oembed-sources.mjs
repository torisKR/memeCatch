#!/usr/bin/env node
/**
 * 검수 대기 TikTok/Instagram 출처의 oEmbed 상태를 제한적으로 확인한다.
 * 기본은 계획 모드이며 DB inventory만 읽고 provider 호출·DB 쓰기를 하지 않는다.
 * 실행은 단일 UUID에 한해 `--execute --limit=1 --source-id=<uuid>`가 모두 필요하다.
 * Instagram은 provider 정책 검토가 필요하므로 이 CLI에서 호출·저장하지 않는다.
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createRestClient, restAll as defaultRestAll, loadEnv } from "./source-pipeline-rest.mjs";
import { normalizeSourceUrl } from "./source-url.mjs";

const MAX_LIMIT = 2;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const MAX_RESPONSE_BYTES = 256 * 1024;

export function parseLimit(value, fallback = MAX_LIMIT) {
  const parsed = value === undefined ? fallback : Number(value);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
    throw new Error("--limit must be a positive integer");
  }
  if (parsed > MAX_LIMIT) throw new Error(`--limit must be at most ${MAX_LIMIT}`);
  return parsed;
}

export function parseArgs(argv) {
  let execute = false;
  let dryRun = false;
  let limit = MAX_LIMIT;
  let sourceId = null;
  let hasLimit = false;
  const seen = new Set();
  for (const arg of argv) {
    const key = arg.startsWith("--limit=")
      ? "--limit"
      : arg.startsWith("--source-id=")
        ? "--source-id"
        : arg;
    if (!["--execute", "--dry-run", "--limit", "--source-id"].includes(key) || seen.has(key)) {
      throw new Error(`Unknown or repeated argument: ${arg}`);
    }
    seen.add(key);
    if (key === "--execute") execute = true;
    if (key === "--dry-run") dryRun = true;
    if (key === "--limit") {
      hasLimit = true;
      limit = parseLimit(arg.slice("--limit=".length));
    }
    if (key === "--source-id") {
      sourceId = arg.slice("--source-id=".length);
      if (!UUID_PATTERN.test(sourceId)) throw new Error("--source-id must be a UUID");
    }
  }
  if (execute && (!hasLimit || !sourceId || limit !== 1)) {
    throw new Error("--execute requires --limit=1 and --source-id=<uuid>");
  }
  if (dryRun && !execute) {
    throw new Error("--dry-run requires --execute because TikTok verification still calls a provider");
  }
  return { execute, dryRun, limit, sourceId };
}

function validSource(source) {
  if (!(
    source &&
    typeof source.id === "string" && UUID_PATTERN.test(source.id) &&
    (source.platform === "tiktok" || source.platform === "instagram") &&
    typeof source.external_id === "string" && source.external_id &&
    typeof source.canonical_url === "string"
  )) return false;
  const normalized = normalizeSourceUrl(source.canonical_url);
  return Boolean(
    normalized &&
    normalized.platform === source.platform &&
    normalized.externalId === source.external_id &&
    normalized.canonicalUrl === source.canonical_url
  );
}

async function readInventory({ rest, restAll, limit, sourceId }) {
  const pendingLinks = await restAll(rest, "meme_media?select=source_id&review_state=eq.pending");
  const pendingIds = new Set(pendingLinks.map((row) => row.source_id));
  const sourceFilter = sourceId ? `&id=eq.${encodeURIComponent(sourceId)}` : "";
  const candidates = (
    await restAll(
      rest,
      `media_sources?select=id,platform,external_id,canonical_url&platform=in.(tiktok,instagram)&embeddable=is.null&removed_at=is.null${sourceFilter}`
    )
  ).filter((source) => pendingIds.has(source.id));
  const selected = candidates.slice(0, limit);
  const valid = selected.filter(validSource);
  return {
    pendingLinks,
    candidates,
    selected,
    valid,
    targets: valid.filter((source) => source.platform === "tiktok"),
    reviewRequired: valid.filter((source) => source.platform === "instagram"),
  };
}

export async function planOEmbedVerification({ rest, restAll = defaultRestAll, limit = MAX_LIMIT, sourceId = null }) {
  const max = parseLimit(limit);
  if (sourceId !== null && !UUID_PATTERN.test(sourceId)) throw new Error("sourceId must be a UUID");
  const inventory = await readInventory({ rest, restAll, limit: max, sourceId });
  return {
    mode: "plan",
    totalPending: inventory.pendingLinks.length,
    candidates: inventory.candidates.length,
    selected: inventory.selected.length,
    eligible: inventory.targets.length,
    reviewRequired: inventory.reviewRequired.length,
    invalid: inventory.selected.length - inventory.valid.length,
    providerCalls: 0,
    dbWrites: 0,
  };
}

function providerEndpoint(source) {
  const endpoint = new URL("https://www.tiktok.com/oembed");
  endpoint.searchParams.set("url", source.canonical_url);
  return endpoint;
}

async function boundedJson(response) {
  const reader = response.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) return null;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => {});
        return null;
      }
      chunks.push(value);
    }
    if (total === 0) return null;
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = JSON.parse(text);
    return value && typeof value === "object" && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  } finally {
    reader.releaseLock();
  }
}

function quotedAttributes(tag) {
  const attributes = new Map();
  const pattern = /\s([A-Za-z_:][-A-Za-z0-9_:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu;
  for (const match of tag.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3]);
  }
  return attributes;
}

function validProviderBody(source, body) {
  if (!body || typeof body.html !== "string" || !body.html.trim()) return false;
  for (const match of body.html.matchAll(/<blockquote\b[^>]*>/giu)) {
    const attributes = quotedAttributes(match[0]);
    if (attributes.get("data-video-id") !== source.external_id) continue;
    const cite = attributes.get("cite");
    const normalized = cite ? normalizeSourceUrl(cite) : null;
    if (
      normalized?.platform === "tiktok" &&
      normalized.externalId === source.external_id &&
      normalized.canonicalUrl === source.canonical_url
    ) return true;
  }
  return false;
}

async function checkTikTokSource({ source, fetchImpl }) {
  let response;
  try {
    response = await fetchImpl(providerEndpoint(source), {
      redirect: "error",
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; CatchMemeSourceCollector/1.0; +https://catchmeme.com)",
      },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return { kind: "deferred" };
  }
  // oEmbed status codes, including 404, do not prove deletion or privacy.
  if (!response.ok) return { kind: "deferred" };
  const body = await boundedJson(response).catch(() => null);
  return validProviderBody(source, body) ? { kind: "verified" } : { kind: "deferred" };
}

export async function verifyOEmbedSources({
  rest,
  restAll = defaultRestAll,
  fetch: fetchImpl = globalThis.fetch,
  limit,
  sourceId,
  dryRun = false,
  now = new Date(),
}) {
  if (parseLimit(limit) !== 1 || !UUID_PATTERN.test(sourceId ?? "")) {
    throw new Error("oEmbed execution requires one UUID-scoped source");
  }
  const inventory = await readInventory({ rest, restAll, limit: 1, sourceId });
  const stats = {
    checked: 0,
    verified: 0,
    removed: 0,
    deferred: 0,
    reviewRequired: inventory.reviewRequired.length,
    invalid: inventory.selected.length - inventory.valid.length,
    providerCalls: 0,
    dbWrites: 0,
  };
  const checkedAt = now instanceof Date ? now : new Date(now);
  const nowIso = checkedAt.toISOString();
  const expires = new Date(checkedAt.getTime() + 30 * 86_400_000).toISOString();
  for (const source of inventory.targets) {
    stats.checked += 1;
    stats.providerCalls += 1;
    const result = await checkTikTokSource({ source, fetchImpl });
    if (result.kind === "deferred") {
      stats.deferred += 1;
      continue;
    }
    stats.verified += 1;
    if (!dryRun) {
      await rest(`media_sources?id=eq.${encodeURIComponent(source.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          embeddable: true,
          last_checked_at: nowIso,
          metadata_refreshed_at: nowIso,
          metadata_expires_at: expires,
        }),
      });
      stats.dbWrites += 1;
    }
  }
  return stats;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const env = loadEnv();
  const rest = createRestClient(env);
  if (!options.execute) {
    const plan = await planOEmbedVerification({ rest, limit: options.limit, sourceId: options.sourceId });
    console.log(JSON.stringify(plan));
    return plan;
  }
  const stats = await verifyOEmbedSources({
    rest,
    limit: options.limit,
    sourceId: options.sourceId,
    dryRun: options.dryRun,
  });
  const result = { mode: options.dryRun ? "execute-dry-run" : "execute", ...stats };
  console.log(JSON.stringify(result));
  return result;
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "oEmbed verification failed");
    process.exitCode = 1;
  });
}
