import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeSourceUrl } from "./url";
import { sourcePlatformFromReference } from "@/lib/source-platform";

const MAX_LINKS_PER_CHECK = 200;
const TIKTOK_IDS_PER_NULLABLE_CHECK = 25;
const MAX_TIKTOK_NULLABLE_ROWS = 100;
const SOURCE_STATE_COLUMNS = "platform,external_id,canonical_url,public_status,embeddable,removed_at";

type SourceLink = { source_url?: string | null };
type MediaContent = {
  url?: string | null;
  platform?: string | null;
  content_id?: string | null;
};
type SourceState = {
  platform: string;
  external_id: string | null;
  canonical_url: string;
  public_status: string | null;
  embeddable: boolean | null;
  removed_at: string | null;
};

type SourceQueryResult = {
  data: SourceState[] | null;
  error: { message?: string } | null;
};

type SourceQuery = PromiseLike<SourceQueryResult> & {
  select(columns: string): SourceQuery;
  in(column: string, values: readonly string[]): SourceQuery;
  eq(column: string, value: string): SourceQuery;
  is(column: string, value: null): SourceQuery;
  or(filters: string): SourceQuery;
  limit(count: number): SourceQuery;
};

type SourceAdmin = {
  from(table: "media_sources"): SourceQuery;
};

type NormalizedRef = {
  platform: string;
  externalId: string;
  canonicalUrl: string;
};

function contentUrl(content: MediaContent): string {
  // MemeEmbed uses content_id as the playback identity for YouTube rows.  Do
  // not let a stale/mismatched URL override that platform hint: use the
  // explicit platform first, then fall back to URL inference for legacy rows.
  const platform = sourcePlatformFromReference({ platform: content.platform })
    ?? sourcePlatformFromReference({ url: content.url });
  if (platform === "youtube_shorts" && content.content_id) return `https://www.youtube.com/shorts/${content.content_id}`;
  if (platform === "youtube" && content.content_id) return `https://www.youtube.com/watch?v=${content.content_id}`;
  if (platform === "instagram" && content.content_id) return `https://www.instagram.com/reel/${content.content_id}/`;
  if (platform === "tiktok" && content.content_id) return `https://www.tiktok.com/@_/video/${content.content_id}`;
  if (content.url) return content.url;
  return "";
}

function sanitizedDiagnostic(code: string, count: number) {
  if (process.env.NODE_ENV !== "test") console.warn({ scope: "public_media_filter", code, count });
}

function contentRefs(content: MediaContent): { primary: NormalizedRef | null; all: NormalizedRef[]; inconsistent: boolean } {
  const primary = parseRef(contentUrl(content));
  const urlRef = content.url ? parseRef(content.url) : null;
  const all = [primary, urlRef].filter((ref): ref is NormalizedRef => Boolean(ref));
  const inconsistent = Boolean(primary && urlRef && identity(primary) !== identity(urlRef));
  return { primary, all, inconsistent };
}

function identity(ref: NormalizedRef | null): string | null {
  if (!ref) return null;
  const platform = sourcePlatformFromReference({ platform: ref.platform });
  if (platform === "youtube" || platform === "youtube_shorts") return `youtube:${ref.externalId}`;
  if (platform === "instagram" || platform === "tiktok") return `${platform}:${ref.externalId}`;
  return null;
}

function rowIdentity(row: SourceState): string | null {
  if (row.external_id) {
    return identity({ platform: row.platform as NormalizedRef["platform"], externalId: row.external_id, canonicalUrl: row.canonical_url });
  }
  const parsed = parseRef(row.canonical_url);
  if (!parsed) return null;
  const declared = identity({ platform: row.platform, externalId: parsed.externalId, canonicalUrl: parsed.canonicalUrl });
  return declared === identity(parsed) ? declared : null;
}

function parseRef(url: string): NormalizedRef | null {
  const parsed = normalizeSourceUrl(url);
  return parsed ? { platform: parsed.platform, externalId: parsed.externalId, canonicalUrl: parsed.canonicalUrl } : null;
}

function nullableCanonicalVariants(ref: NormalizedRef): string[] {
  switch (ref.platform) {
    case "youtube":
    case "youtube_shorts":
      return [
        `https://www.youtube.com/watch?v=${ref.externalId}`,
        `https://www.youtube.com/shorts/${ref.externalId}`,
      ];
    case "instagram":
      return ["p", "reel", "tv"].map((kind) => `https://www.instagram.com/${kind}/${ref.externalId}/`);
    case "tiktok":
      return [ref.canonicalUrl];
    default:
      return [];
  }
}

function tiktokNullableFilter(externalIds: readonly string[]): string {
  return externalIds
    .filter((externalId) => /^\d{10,25}$/.test(externalId))
    .map((externalId) => `canonical_url.like.https://www.tiktok.com/@%/video/${externalId}%`)
    .join(",");
}

async function readSourceStates(client: SourceAdmin, refs: readonly NormalizedRef[]): Promise<SourceState[] | null> {
  const externalIds = [...new Set(refs.map((ref) => ref.externalId))];
  const canonicalUrls = [...new Set(refs.flatMap(nullableCanonicalVariants))];
  const tiktokIds = [...new Set(refs
    .filter((ref) => ref.platform === "tiktok" && /^\d{10,25}$/.test(ref.externalId))
    .map((ref) => ref.externalId))];

  // These are independent lookup paths for the same bounded set of refs. Run
  // at most one request per lane at a time, while allowing the three lanes to
  // overlap so legacy nullable rows do not delay the primary external-id read.
  const [externalRows, canonicalRows, tiktokRows] = await Promise.all([
    (async (): Promise<SourceState[] | null> => {
      const rows: SourceState[] = [];
      for (let offset = 0; offset < externalIds.length; offset += MAX_LINKS_PER_CHECK) {
        const values = externalIds.slice(offset, offset + MAX_LINKS_PER_CHECK);
        const result = await client.from("media_sources").select(SOURCE_STATE_COLUMNS).in("external_id", values);
        if (result.error) {
          sanitizedDiagnostic("ledger_read_failed", values.length);
          return null;
        }
        rows.push(...(result.data ?? []));
      }
      return rows;
    })(),
    (async (): Promise<SourceState[] | null> => {
      const rows: SourceState[] = [];
      for (let offset = 0; offset < canonicalUrls.length; offset += MAX_LINKS_PER_CHECK) {
        const values = canonicalUrls.slice(offset, offset + MAX_LINKS_PER_CHECK);
        const result = await client.from("media_sources")
          .select(SOURCE_STATE_COLUMNS)
          .is("external_id", null)
          .in("canonical_url", values);
        if (result.error) {
          sanitizedDiagnostic("ledger_read_failed", values.length);
          return null;
        }
        rows.push(...(result.data ?? []));
      }
      return rows;
    })(),
    (async (): Promise<SourceState[] | null> => {
      const rows: SourceState[] = [];
      for (let offset = 0; offset < tiktokIds.length; offset += TIKTOK_IDS_PER_NULLABLE_CHECK) {
        const values = tiktokIds.slice(offset, offset + TIKTOK_IDS_PER_NULLABLE_CHECK);
        const result = await client.from("media_sources")
          .select(SOURCE_STATE_COLUMNS)
          .eq("platform", "tiktok")
          .is("external_id", null)
          .or(tiktokNullableFilter(values))
          .limit(MAX_TIKTOK_NULLABLE_ROWS);
        if (result.error) {
          sanitizedDiagnostic("ledger_read_failed", values.length);
          return null;
        }
        rows.push(...(result.data ?? []));
      }
      return rows;
    })(),
  ]);

  if (!externalRows || !canonicalRows || !tiktokRows) {
    return null;
  }
  return [...externalRows, ...canonicalRows, ...tiktokRows];
}

function hiddenKeys(rows: readonly SourceState[], requested: ReadonlySet<string | null>): Set<string> {
  return new Set(rows
    .filter((row) => requested.has(rowIdentity(row)))
    .filter((row) => row.removed_at !== null || row.public_status === "private" || row.public_status === "unlisted")
    .map(rowIdentity)
    .filter((key): key is string => key !== null));
}

function nonEmbeddableKeys(rows: readonly SourceState[], requested: ReadonlySet<string | null>): Set<string> {
  return new Set(rows
    .filter((row) => row.embeddable === false && requested.has(rowIdentity(row)))
    .map(rowIdentity)
    .filter((key): key is string => key !== null));
}

/**
 * Remove only media links whose own source ledger explicitly says they are
 * private/unlisted or removed. Unknown, stale, and provider-error states stay
 * visible because absence of a successful refresh is not proof of deletion.
 * The returned objects retain the caller's exact DTO shape and source URL.
 */
export async function filterPublicSourceLinks<T extends SourceLink>(
  sources: readonly T[],
  admin?: SourceAdmin,
): Promise<T[]> {
  if (sources.length === 0) return [];

  const normalized = sources
    .map((source, index) => ({ source, index, parsed: parseRef(source.source_url ?? "") }))
    .filter((entry): entry is { source: T; index: number; parsed: NormalizedRef } => Boolean(entry.parsed));
  if (normalized.length === 0) return [...sources];

  const requestedKeys = new Set(normalized.map(({ parsed }) => identity(parsed)));
  let rows: SourceState[] | null = null;
  try {
    const client = admin ?? (createAdminClient() as unknown as SourceAdmin);
    rows = await readSourceStates(client, normalized.map(({ parsed }) => parsed));
    if (!rows) return [...sources];
  } catch {
    // A ledger read failure must not fabricate removal or hide citations.
    sanitizedDiagnostic("ledger_read_failed", 1);
    return [...sources];
  }

  const hidden = hiddenKeys(rows, requestedKeys);
  const checked = new Set(normalized.map(({ index }) => index));
  return sources.filter((source, index) => {
    if (!checked.has(index)) return true;
    const key = identity(normalized.find((entry) => entry.index === index)!.parsed);
    return !key || !hidden.has(key);
  });
}

export async function filterPublicMemeMedia<
  TSource extends SourceLink,
  TContent extends MediaContent,
>(
  input: { sources: readonly TSource[]; contents: readonly TContent[] },
  admin?: SourceAdmin,
): Promise<{ sources: TSource[]; contents: TContent[] }> {
  if (input.sources.length === 0 && input.contents.length === 0) return { sources: [], contents: [] };
  const refs = [
    ...input.sources.map((source) => parseRef(source.source_url ?? "")),
    ...input.contents.flatMap((content) => contentRefs(content).all),
  ].filter((ref): ref is NormalizedRef => Boolean(ref));
  if (refs.length === 0) return { sources: [...input.sources], contents: [...input.contents] };
  const inconsistentContents = new Set(input.contents.filter((content) => contentRefs(content).inconsistent));
  const requestedKeys = new Set(refs.map(identity));
  let rows: SourceState[] | null = null;
  try {
    const client = admin ?? (createAdminClient() as unknown as SourceAdmin);
    rows = await readSourceStates(client, refs);
    // A failed read is not deletion evidence. Preserve citations and storage,
    // but do not activate an embed whose current public state could not be read.
    if (!rows) return { sources: [...input.sources], contents: [] };
  } catch {
    sanitizedDiagnostic("ledger_read_failed", 1);
    return { sources: [...input.sources], contents: [] };
  }
  const hidden = hiddenKeys(rows, requestedKeys);
  const nonEmbeddable = nonEmbeddableKeys(rows, requestedKeys);
  const keep = (value: string) => {
    const ref = parseRef(value);
    const key = ref ? identity(ref) : null;
    return !key || !hidden.has(key);
  };
  const keepContent = (content: TContent) => {
    const refs = contentRefs(content);
    if (refs.inconsistent) return false;
    return refs.all.every((ref) => {
      const key = identity(ref);
      return !key || (!hidden.has(key) && !nonEmbeddable.has(key));
    });
  };
  return {
    sources: input.sources.filter((source) => keep(source.source_url ?? "")),
    contents: input.contents.filter((content) => !inconsistentContents.has(content) && keepContent(content)),
  };
}

async function readPublicMemeMedia<
  TSource extends SourceLink,
  TContent extends MediaContent,
>(
  sources: readonly TSource[],
  contents: readonly TContent[],
  admin?: SourceAdmin,
): Promise<{ sources: TSource[]; contents: TContent[] }> {
  return filterPublicMemeMedia({ sources, contents }, admin);
}

/** Deduplicate ledger reads when metadata and the page use the same detail DTO. */
export const getPublicMemeMedia = cache(readPublicMemeMedia);
