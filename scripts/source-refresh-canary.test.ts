import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";
import {
  loadMemeContentEnv,
  resolveMemeContentEnvFromSources,
} from "./meme-content-env.mjs";

vi.mock("server-only", () => ({}));

const SOURCE_ID = "cbbfcba5-c980-4b49-b536-19b3a1057282";
const VIDEO_ID = "hYqE_mlPeHc";
const PROJECT_REF = "onjipuldngbdptldkpoe";
const REPORT_DIR = resolve("artifacts/release/20261014-media-recovery");
const SOURCE_SENTINEL_ENV = "SOURCE_REFRESH_CANARY_SOURCE_ID";
const PROJECT_SENTINEL_ENV = "SOURCE_REFRESH_CANARY_PROJECT_REF";
const SOURCE_KEY = `youtube:${VIDEO_ID}`;
const SOURCE_KEY_SHORTS = `youtube_shorts:${VIDEO_ID}`;
const CONTENT_ALIASES = [
  `https://www.youtube.com/watch?v=${VIDEO_ID}`,
  `https://www.youtube.com/shorts/${VIDEO_ID}`,
  `https://youtu.be/${VIDEO_ID}`,
] as const;

type StringEnv = Record<string, string | undefined>;

type CanaryConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  youtubeApiKey: string;
};

const loadProjectBoundEnv = loadMemeContentEnv as unknown as (options: {
  root: string;
  processEnv: StringEnv;
}) => Promise<StringEnv>;

type GuardStats = {
  youtubeVideos: number;
  sourceReads: number;
  recoveryReads: number;
  contentReads: number;
  sourceWrites: number;
  contentIdentityWrites: number;
  contentUrlWrites: number;
  recoveryResolves: number;
  recoveryRecords: number;
  activeRecoveryReads: number;
  jobAudits: number;
};

type SourceSnapshot = {
  id: string;
  platform: string;
  external_id: string | null;
  canonical_url: string;
  removed_at: string | null;
  public_status: string | null;
  embeddable: boolean | null;
  last_checked_at: string | null;
  metadata_refreshed_at: string | null;
  metadata_expires_at: string | null;
};

type RecoverySnapshot = {
  source_id: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  last_error_code: string;
  resolved_at: string | null;
};

type ContentSnapshot = {
  id: string;
  availability: string | null;
};

function configuredValue(name: string, resolvedEnv: StringEnv) {
  const value = resolvedEnv[name];
  if (!value) throw new Error(`canary_missing_env:${name}`);
  return value;
}

export function resolveCanaryConfig(runtimeEnv: StringEnv, resolvedEnv: StringEnv): CanaryConfig {
  if (runtimeEnv[SOURCE_SENTINEL_ENV] !== SOURCE_ID) {
    throw new Error("canary_source_sentinel_mismatch");
  }
  if (runtimeEnv[PROJECT_SENTINEL_ENV] !== PROJECT_REF) {
    throw new Error("canary_project_sentinel_mismatch");
  }

  const supabaseUrl = configuredValue("NEXT_PUBLIC_SUPABASE_URL", resolvedEnv);
  const parsedUrl = new URL(supabaseUrl);
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== `${PROJECT_REF}.supabase.co`) {
    throw new Error("canary_supabase_project_mismatch");
  }

  return {
    supabaseUrl: parsedUrl.origin,
    serviceRoleKey: configuredValue("SUPABASE_SERVICE_ROLE_KEY", resolvedEnv),
    youtubeApiKey: configuredValue("YOUTUBE_API_KEY", resolvedEnv),
  };
}

function requestMethod(input: RequestInfo | URL, init?: RequestInit) {
  return (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
}

async function requestBody(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof init?.body === "string") return init.body;
  if (input instanceof Request) return input.clone().text();
  return "";
}

function guardBlocked(method: string, url: URL): never {
  throw new Error(`canary_guard_blocked:${method}:${url.hostname}${url.pathname}`);
}

function exactTargetFilter(url: URL) {
  return url.searchParams.get("id") === `eq.${SOURCE_ID}`;
}

function inFilterValues(value: string | null) {
  if (!value?.startsWith("in.(") || !value.endsWith(")")) return [];
  return value.slice(4, -1).split(",").map((entry) => {
    const trimmed = entry.trim();
    return trimmed.startsWith("\"") && trimmed.endsWith("\"")
      ? trimmed.slice(1, -1)
      : trimmed;
  });
}

function exactYoutubePlatformFilter(url: URL) {
  const platforms = new Set(inFilterValues(url.searchParams.get("platform")));
  return platforms.size === 2 && platforms.has("YouTube") && platforms.has("YouTube Shorts");
}

function exactContentIdentityFilter(url: URL, requirePlatform: boolean) {
  return (
    url.searchParams.get("content_id") === `eq.${VIDEO_ID}` &&
    url.searchParams.get("type") === "eq.embed" &&
    (!requirePlatform || exactYoutubePlatformFilter(url))
  );
}

function exactContentUrlFilter(url: URL, requirePlatform: boolean) {
  const aliases = new Set(inFilterValues(url.searchParams.get("url")));
  return (
    url.searchParams.get("type") === "eq.embed" &&
    aliases.size === CONTENT_ALIASES.length &&
    CONTENT_ALIASES.every((alias) => aliases.has(alias)) &&
    (!requirePlatform || exactYoutubePlatformFilter(url))
  );
}

function parseJsonBody(body: string) {
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function exactRecoveryIdentity(body: Record<string, unknown>) {
  const platform = body.p_platform;
  const sourceKey = body.p_source_key;
  const canonicalUrl = body.p_canonical_url;
  return (
    body.p_source_id === SOURCE_ID &&
    body.p_external_id === VIDEO_ID &&
    platform === "youtube" &&
    sourceKey === SOURCE_KEY &&
    typeof canonicalUrl === "string" &&
    CONTENT_ALIASES.includes(canonicalUrl as (typeof CONTENT_ALIASES)[number])
  );
}

export function createCanaryFetchGuard(
  nextFetch: typeof fetch,
  stats: GuardStats = {
    youtubeVideos: 0,
    sourceReads: 0,
    recoveryReads: 0,
    contentReads: 0,
    sourceWrites: 0,
    contentIdentityWrites: 0,
    contentUrlWrites: 0,
    recoveryResolves: 0,
    recoveryRecords: 0,
    activeRecoveryReads: 0,
    jobAudits: 0,
  },
) {
  const guardedFetch: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    const method = requestMethod(input, init);

    if (url.hostname === "www.googleapis.com") {
      if (
        method !== "GET" ||
        url.pathname !== "/youtube/v3/videos" ||
        url.searchParams.get("id") !== VIDEO_ID ||
        url.searchParams.get("part") !== "snippet,status,contentDetails" ||
        stats.youtubeVideos >= 1
      ) guardBlocked(method, url);
      stats.youtubeVideos += 1;
      return nextFetch(input, init);
    }

    if (url.hostname !== `${PROJECT_REF}.supabase.co` || !url.pathname.startsWith("/rest/v1/")) {
      guardBlocked(method, url);
    }

    const resource = url.pathname.slice("/rest/v1/".length);
    if (method === "GET" && resource === "media_sources" && exactTargetFilter(url)) {
      stats.sourceReads += 1;
      return nextFetch(input, init);
    }
    if (method === "GET" && resource === "source_acquisition_recovery" && url.searchParams.get("source_id") === `eq.${SOURCE_ID}`) {
      stats.recoveryReads += 1;
      return nextFetch(input, init);
    }
    if (method === "GET" && resource === "meme_contents" && (exactContentIdentityFilter(url, false) || exactContentUrlFilter(url, false))) {
      stats.contentReads += 1;
      return nextFetch(input, init);
    }
    if (method === "PATCH" && resource === "media_sources" && exactTargetFilter(url) && stats.sourceWrites < 1) {
      stats.sourceWrites += 1;
      return nextFetch(input, init);
    }
    if (method === "PATCH" && resource === "meme_contents" && exactContentIdentityFilter(url, true) && stats.contentIdentityWrites < 1) {
      stats.contentIdentityWrites += 1;
      return nextFetch(input, init);
    }
    if (method === "PATCH" && resource === "meme_contents" && exactContentUrlFilter(url, true) && stats.contentUrlWrites < 1) {
      stats.contentUrlWrites += 1;
      return nextFetch(input, init);
    }
    if (
      method === "POST" &&
      resource === "rpc/list_active_source_acquisition_recovery" &&
      url.searchParams.get("source_id") === `eq.${SOURCE_ID}` &&
      stats.activeRecoveryReads < 1
    ) {
      stats.activeRecoveryReads += 1;
      return nextFetch(input, init);
    }
    if (method === "POST" && resource === "rpc/resolve_source_acquisition_failure" && stats.recoveryResolves < 1) {
      const body = parseJsonBody(await requestBody(input, init));
      if (body.p_source_key !== SOURCE_KEY) guardBlocked(method, url);
      stats.recoveryResolves += 1;
      return nextFetch(input, init);
    }
    if (method === "POST" && resource === "rpc/record_source_acquisition_failure" && stats.recoveryRecords < 1) {
      const body = parseJsonBody(await requestBody(input, init));
      if (!exactRecoveryIdentity(body)) guardBlocked(method, url);
      stats.recoveryRecords += 1;
      return nextFetch(input, init);
    }
    if (method === "POST" && resource === "job_runs" && stats.jobAudits < 1) {
      const body = parseJsonBody(await requestBody(input, init));
      const row = Array.isArray(body) ? body[0] : body;
      if (!row || row.job_name !== "refresh_media_sources") guardBlocked(method, url);
      stats.jobAudits += 1;
      return nextFetch(input, init);
    }

    return guardBlocked(method, url);
  };

  return { fetch: guardedFetch, stats };
}

function availabilitySummary(rows: ContentSnapshot[]) {
  const unique = new Map(rows.map((row) => [row.id, row]));
  const availability = [...unique.values()].reduce<Record<string, number>>((counts, row) => {
    const key = row.availability ?? "null";
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
  return { count: unique.size, availability };
}

function publicSourceSnapshot(source: SourceSnapshot) {
  return {
    id: source.id,
    platform: source.platform,
    externalId: source.external_id,
    removed: source.removed_at !== null,
    publicStatus: source.public_status,
    embeddable: source.embeddable,
    lastCheckedAt: source.last_checked_at,
    metadataRefreshedAt: source.metadata_refreshed_at,
    metadataExpiresAt: source.metadata_expires_at,
  };
}

function publicRecoverySnapshot(recovery: RecoverySnapshot) {
  return {
    sourceId: recovery.source_id,
    attemptCount: recovery.attempt_count,
    nextRetryAt: recovery.next_retry_at,
    lastErrorCode: recovery.last_error_code,
    resolved: recovery.resolved_at !== null,
    resolvedAt: recovery.resolved_at,
  };
}

async function restRows<T>(config: CanaryConfig, path: string): Promise<T[]> {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
    },
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`canary_snapshot_http:${response.status}`);
  const data = await response.json() as unknown;
  if (!Array.isArray(data)) throw new Error("canary_snapshot_invalid");
  return data as T[];
}

async function captureSnapshot(config: CanaryConfig) {
  const sourceSelect = "id,platform,external_id,canonical_url,removed_at,public_status,embeddable,last_checked_at,metadata_refreshed_at,metadata_expires_at";
  const sources = await restRows<SourceSnapshot>(config, `media_sources?select=${sourceSelect}&id=eq.${SOURCE_ID}&limit=1`);
  const recovery = await restRows<RecoverySnapshot>(config, `source_acquisition_recovery?select=source_id,attempt_count,next_retry_at,last_error_code,resolved_at&source_id=eq.${SOURCE_ID}&limit=1`);
  const identity = await restRows<ContentSnapshot>(config, `meme_contents?select=id,availability&content_id=eq.${VIDEO_ID}&type=eq.embed`);
  const aliasFilter = `in.(${CONTENT_ALIASES.map((alias) => `\"${alias}\"`).join(",")})`;
  const aliases = await restRows<ContentSnapshot>(config, `meme_contents?select=id,availability&url=${encodeURIComponent(aliasFilter)}&type=eq.embed`);
  return { sources, recovery, contents: [...identity, ...aliases] };
}

function assertPreconditions(snapshot: Awaited<ReturnType<typeof captureSnapshot>>) {
  expect(snapshot.sources).toHaveLength(1);
  const source = snapshot.sources[0];
  expect(source.id).toBe(SOURCE_ID);
  expect(["youtube", "youtube_shorts"]).toContain(source.platform);
  expect(source.external_id).toBe(VIDEO_ID);
  expect(source.removed_at).toBeNull();
  expect(CONTENT_ALIASES).toContain(source.canonical_url as (typeof CONTENT_ALIASES)[number]);

  expect(snapshot.recovery).toHaveLength(1);
  const recovery = snapshot.recovery[0];
  expect(recovery.source_id).toBe(SOURCE_ID);
  expect(recovery.attempt_count).toBe(1);
  expect(recovery.resolved_at).toBeNull();
  expect(recovery.next_retry_at).not.toBeNull();
  expect(Date.parse(recovery.next_retry_at!)).toBeLessThanOrEqual(Date.now());
}

function liveEnabled(runtimeEnv: StringEnv) {
  return (
    runtimeEnv[SOURCE_SENTINEL_ENV] === SOURCE_ID &&
    runtimeEnv[PROJECT_SENTINEL_ENV] === PROJECT_REF
  );
}

function safeBlocker(error: unknown) {
  if (!(error instanceof Error)) return "canary_blocked";
  if (/^canary_guard_blocked:[A-Z]+:[a-z0-9.-]+\/[a-zA-Z0-9_./-]+$/.test(error.message)) {
    return error.message;
  }
  if (/^canary_snapshot_http:\d{3}$/.test(error.message)) return error.message;
  if (/^canary_[a-z0-9_]+(?::[A-Z0-9_]+)?$/.test(error.message)) return error.message;
  return "canary_blocked";
}

function uniqueReportPath() {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/gu, "");
  const nonce = Math.random().toString(36).slice(2, 10);
  return resolve(REPORT_DIR, `source-refresh-canary-${stamp}-${nonce}.json`);
}

async function writeCanaryReport(report: Record<string, unknown>, reportPath = uniqueReportPath()) {
  await mkdir(REPORT_DIR, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx" });
  return reportPath;
}

describe("source refresh canary guards", () => {
  it("reuses the project-bound resolver instead of a mismatched production service key", () => {
    const nowSeconds = 1_800_000_000;
    const jwt = (payload: Record<string, unknown>) => {
      const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString("base64url");
      return `${encode({ alg: "HS256", typ: "JWT" })}.${encode(payload)}.signature`;
    };
    const credential = (role: string, ref: string) => jwt({
      iss: "supabase",
      ref,
      role,
      iat: nowSeconds - 60,
      exp: nowSeconds + 3_600,
    });
    const resolved = resolveMemeContentEnvFromSources([
      { name: "process", values: { YOUTUBE_API_KEY: "youtube-secret" } },
      { name: ".env.local", values: {
        NEXT_PUBLIC_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: credential("anon", PROJECT_REF),
      } },
      { name: ".env.production", values: {
        SUPABASE_SERVICE_ROLE_KEY: credential("service_role", "wrongproject"),
      } },
      { name: ".env.development", values: {
        SUPABASE_SERVICE_ROLE_KEY: credential("service_role", PROJECT_REF),
      } },
    ], { nowSeconds });

    const config = resolveCanaryConfig({
      [SOURCE_SENTINEL_ENV]: SOURCE_ID,
      [PROJECT_SENTINEL_ENV]: PROJECT_REF,
    }, resolved as StringEnv);
    expect(config.supabaseUrl).toBe(`https://${PROJECT_REF}.supabase.co`);
    expect(config.serviceRoleKey).toBe(credential("service_role", PROJECT_REF));
  });

  it("requires the exact source, project, and production Supabase host", () => {
    const fileEnv = {
      NEXT_PUBLIC_SUPABASE_URL: `https://${PROJECT_REF}.supabase.co`,
      SUPABASE_SERVICE_ROLE_KEY: "service-secret",
      YOUTUBE_API_KEY: "youtube-secret",
    };
    expect(() => resolveCanaryConfig({} as StringEnv, fileEnv)).toThrow("canary_source_sentinel_mismatch");
    expect(() => resolveCanaryConfig({
      [SOURCE_SENTINEL_ENV]: SOURCE_ID,
      [PROJECT_SENTINEL_ENV]: "wrong-project",
    }, fileEnv)).toThrow("canary_project_sentinel_mismatch");
    expect(() => resolveCanaryConfig({
      [SOURCE_SENTINEL_ENV]: SOURCE_ID,
      [PROJECT_SENTINEL_ENV]: PROJECT_REF,
    }, {
      ...fileEnv,
      NEXT_PUBLIC_SUPABASE_URL: "https://wrong.supabase.co",
    })).toThrow("canary_supabase_project_mismatch");
  });

  it("allows one target videos.list call and rejects search, other IDs, and repeats", async () => {
    const nextFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 }));
    const guard = createCanaryFetchGuard(nextFetch);
    const allowed = `https://www.googleapis.com/youtube/v3/videos?part=snippet%2Cstatus%2CcontentDetails&id=${VIDEO_ID}&key=hidden`;
    await guard.fetch(allowed);
    await expect(guard.fetch(allowed)).rejects.toThrow("canary_guard_blocked:GET:www.googleapis.com/youtube/v3/videos");
    await expect(guard.fetch("https://www.googleapis.com/youtube/v3/search?q=x")).rejects.toThrow("canary_guard_blocked");
    expect(guard.stats.youtubeVideos).toBe(1);
  });

  it("rejects broad Supabase writes and cron invocation paths", async () => {
    const nextFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const guard = createCanaryFetchGuard(nextFetch);
    await expect(guard.fetch(`https://${PROJECT_REF}.supabase.co/rest/v1/media_sources`, {
      method: "PATCH",
      body: "{}",
    })).rejects.toThrow("canary_guard_blocked");
    await expect(guard.fetch(`https://${PROJECT_REF}.supabase.co/api/cron/source-refresh`, {
      method: "POST",
    })).rejects.toThrow("canary_guard_blocked");
    expect(nextFetch).not.toHaveBeenCalled();
  });

  it("allows only the target content identity and exact alias set", async () => {
    const nextFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const guard = createCanaryFetchGuard(nextFetch);
    const identity = new URL(`https://${PROJECT_REF}.supabase.co/rest/v1/meme_contents`);
    identity.searchParams.set("platform", "in.(YouTube,YouTube Shorts)");
    identity.searchParams.set("content_id", `eq.${VIDEO_ID}`);
    identity.searchParams.set("type", "eq.embed");
    await guard.fetch(identity, { method: "PATCH", body: JSON.stringify({ availability: "live" }) });

    const aliases = new URL(`https://${PROJECT_REF}.supabase.co/rest/v1/meme_contents`);
    aliases.searchParams.set("platform", "in.(YouTube,YouTube Shorts)");
    aliases.searchParams.set("url", `in.(${CONTENT_ALIASES.join(",")})`);
    aliases.searchParams.set("type", "eq.embed");
    await guard.fetch(aliases, { method: "PATCH", body: JSON.stringify({ availability: "live" }) });

    const extraAlias = new URL(aliases);
    extraAlias.searchParams.set("url", `in.(${CONTENT_ALIASES.join(",")},https://example.com/other)`);
    await expect(guard.fetch(extraAlias, { method: "PATCH", body: "{}" })).rejects.toThrow("canary_guard_blocked");
    expect(guard.stats.contentIdentityWrites).toBe(1);
    expect(guard.stats.contentUrlWrites).toBe(1);
  });

  it("rejects missing or wrong source filters for source and recovery reads", async () => {
    const nextFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const guard = createCanaryFetchGuard(nextFetch);
    const source = `https://${PROJECT_REF}.supabase.co/rest/v1/media_sources`;
    const recovery = `https://${PROJECT_REF}.supabase.co/rest/v1/source_acquisition_recovery`;
    await expect(guard.fetch(source)).rejects.toThrow("canary_guard_blocked");
    await expect(guard.fetch(`${source}?id=eq.wrong`)).rejects.toThrow("canary_guard_blocked");
    await expect(guard.fetch(recovery)).rejects.toThrow("canary_guard_blocked");
    await expect(guard.fetch(`${recovery}?source_id=eq.wrong`)).rejects.toThrow("canary_guard_blocked");
    expect(nextFetch).not.toHaveBeenCalled();
  });

  it("rejects broad, missing, and wrong active-recovery RPC targets", async () => {
    const nextFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const guard = createCanaryFetchGuard(nextFetch);
    const rpc = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/list_active_source_acquisition_recovery`;
    await expect(guard.fetch(rpc, { method: "POST", body: "{}" })).rejects.toThrow("canary_guard_blocked");
    await expect(guard.fetch(`${rpc}?source_id=eq.wrong`, { method: "POST", body: "{}" })).rejects.toThrow("canary_guard_blocked");
    await guard.fetch(`${rpc}?source_id=eq.${SOURCE_ID}`, { method: "POST", body: "{}" });
    expect(nextFetch).toHaveBeenCalledTimes(1);
  });

  it("binds recovery writes to the exact source key, platform, and canonical URL", async () => {
    const nextFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const endpoint = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/record_source_acquisition_failure`;
    const base = {
      p_source_id: SOURCE_ID,
      p_external_id: VIDEO_ID,
      p_source_key: SOURCE_KEY,
      p_platform: "youtube",
      p_canonical_url: CONTENT_ALIASES[0],
    };
    const validGuard = createCanaryFetchGuard(nextFetch);
    await validGuard.fetch(endpoint, { method: "POST", body: JSON.stringify(base) });
    for (const body of [
      { ...base, p_source_key: "youtube:wrong" },
      { ...base, p_source_key: SOURCE_KEY_SHORTS, p_platform: "youtube_shorts" },
      { ...base, p_platform: "youtube_shorts" },
      { ...base, p_canonical_url: "https://example.com/not-target" },
    ]) {
      const adverseFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
      const adverseGuard = createCanaryFetchGuard(adverseFetch);
      await expect(adverseGuard.fetch(endpoint, { method: "POST", body: JSON.stringify(body) })).rejects.toThrow("canary_guard_blocked");
      expect(adverseFetch).not.toHaveBeenCalled();
    }
    expect(nextFetch).toHaveBeenCalledTimes(1);
  });

  it("binds recovery resolution to the exact YouTube source key", async () => {
    const endpoint = `https://${PROJECT_REF}.supabase.co/rest/v1/rpc/resolve_source_acquisition_failure`;
    const validFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
    const validGuard = createCanaryFetchGuard(validFetch);
    await validGuard.fetch(endpoint, {
      method: "POST",
      body: JSON.stringify({ p_source_key: SOURCE_KEY }),
    });
    expect(validFetch).toHaveBeenCalledTimes(1);

    for (const sourceKey of ["youtube:wrong", SOURCE_KEY_SHORTS]) {
      const adverseFetch = vi.fn<typeof fetch>().mockResolvedValue(new Response("[]", { status: 200 }));
      const adverseGuard = createCanaryFetchGuard(adverseFetch);
      await expect(adverseGuard.fetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ p_source_key: sourceKey }),
      })).rejects.toThrow("canary_guard_blocked");
      expect(adverseFetch).not.toHaveBeenCalled();
    }
  });
});

const liveCanary = liveEnabled(process.env) ? it : it.skip;

liveCanary("runs the approved existing-source canary exactly once", async () => {
  const resolvedEnv = await loadProjectBoundEnv({ root: process.cwd(), processEnv: process.env });
  const config = resolveCanaryConfig(process.env, resolvedEnv);
  const previousEnv = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY,
  };
  process.env.NEXT_PUBLIC_SUPABASE_URL = config.supabaseUrl;
  process.env.SUPABASE_SERVICE_ROLE_KEY = config.serviceRoleKey;
  process.env.YOUTUBE_API_KEY = config.youtubeApiKey;

  const nativeFetch = globalThis.fetch;
  const guard = createCanaryFetchGuard(nativeFetch);
  globalThis.fetch = guard.fetch;
  const reportPath = uniqueReportPath();

  let report: Record<string, unknown> | null = null;
  try {
    const before = await captureSnapshot(config);
    assertPreconditions(before);
    const { runSourceRefresh } = await import("../lib/sources/refresh.server");
    const result = await runSourceRefresh({ sourceId: SOURCE_ID });
    const after = await captureSnapshot(config);

    report = {
      schemaVersion: 1,
      executedAt: new Date().toISOString(),
      status: result.status,
      target: { sourceId: SOURCE_ID, videoId: VIDEO_ID, projectRef: PROJECT_REF },
      configuration: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(config.supabaseUrl),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(config.serviceRoleKey),
        YOUTUBE_API_KEY: Boolean(config.youtubeApiKey),
      },
      before: {
        source: publicSourceSnapshot(before.sources[0]),
        recovery: publicRecoverySnapshot(before.recovery[0]),
        contents: availabilitySummary(before.contents),
      },
      result: {
        circuitOpen: result.circuitOpen,
        youtube: result.youtube,
        oembed: result.oembed,
        error: result.error ? "source_refresh_failed" : null,
      },
      after: {
        source: after.sources[0] ? publicSourceSnapshot(after.sources[0]) : null,
        recovery: after.recovery[0] ? publicRecoverySnapshot(after.recovery[0]) : null,
        contents: availabilitySummary(after.contents),
      },
      requests: guard.stats,
      secretsRedacted: true,
    };

    expect(result.youtube.checked).toBe(1);
    expect(result.youtube.failed).toBe(0);
    expect(result.oembed.checked).toBe(0);
    expect(guard.stats.youtubeVideos).toBe(1);
    expect(guard.stats.sourceWrites).toBe(1);
    expect(guard.stats.contentIdentityWrites).toBe(1);
    expect(guard.stats.contentUrlWrites).toBe(1);
    expect(guard.stats.recoveryResolves).toBe(1);
    expect(guard.stats.recoveryRecords).toBe(0);
    expect(guard.stats.jobAudits).toBe(1);
    expect(after.recovery[0]?.resolved_at).not.toBeNull();
    await writeCanaryReport(report, reportPath);
  } catch (error) {
    await writeCanaryReport({
      schemaVersion: 1,
      executedAt: new Date().toISOString(),
      status: "blocked",
      target: { sourceId: SOURCE_ID, videoId: VIDEO_ID, projectRef: PROJECT_REF },
      configuration: {
        NEXT_PUBLIC_SUPABASE_URL: Boolean(config.supabaseUrl),
        SUPABASE_SERVICE_ROLE_KEY: Boolean(config.serviceRoleKey),
        YOUTUBE_API_KEY: Boolean(config.youtubeApiKey),
      },
      blocker: safeBlocker(error),
      observedResult: report,
      requests: guard.stats,
      secretsRedacted: true,
    }, reportPath);
    throw new Error(safeBlocker(error));
  } finally {
    globalThis.fetch = nativeFetch;
    for (const [name, value] of Object.entries(previousEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }

  expect(report).not.toBeNull();
}, 60_000);
