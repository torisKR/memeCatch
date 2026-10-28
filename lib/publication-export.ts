import type { createStaticClient } from "@/lib/supabase/server";
import {
  type ContentDepthInput,
  isIndexableMeme,
  type DepthContentRef,
} from "@/lib/content-depth";
import { resolveMemeDelivery } from "@/lib/meme-delivery";
import { publicEditorialEligibilityInput } from "@/lib/meme-public-detail";
import { filterPublicMemeMedia } from "@/lib/sources/public-links.server";
import type { SourceLink } from "@/lib/source-links";

export const PUBLICATION_EXPORT_PAGE_SIZE = 1_000;
const MAX_PUBLICATION_EXPORT_CANDIDATES = 50_000;

type StaticClient = ReturnType<typeof createStaticClient>;

type PublicationExportContent = DepthContentRef & {
  url?: string | null;
  platform?: string | null;
  content_id?: string | null;
  production_id?: string | null;
};

type PublicationExportSource = SourceLink & {
  title?: string | null;
  creator_name?: string | null;
  captured_at?: string | null;
};

type PublicationExportRow = ContentDepthInput & {
  id: string;
  title?: string;
  summary?: string;
  published_at?: string | null;
  moderation_status?: string | null;
};

type PublicationExportOptions = {
  select: string;
  primaryOrder: "published_at" | "trend_score";
  limit: number;
  /** llms exports display the real eligible corpus count, so they must scan to exhaustion. */
  countAll: boolean;
};

export class PublicationExportError extends Error {
  constructor(message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "PublicationExportError";
  }
}

async function projectPublicIndexableRows<T extends PublicationExportRow>(
  page: readonly T[],
): Promise<T[]> {
  const candidates = page.filter(isIndexableMeme);
  if (candidates.length === 0) return [];

  // One bounded helper invocation per export page. The helper batches ledger
  // reads internally; keeping the original object identities lets us split
  // the flattened result back into each meme without an N+1 lookup.
  const candidateSources = candidates.flatMap(
    (meme) => (meme.meme_sources ?? []) as PublicationExportSource[],
  );
  const candidateContents = candidates.flatMap(
    (meme) => (meme.meme_contents ?? []) as PublicationExportContent[],
  );
  const publicMedia = await filterPublicMemeMedia({
    sources: candidateSources,
    contents: candidateContents,
  });
  const publicSources = new Set(publicMedia.sources);
  const publicContents = new Set(publicMedia.contents);
  const projected: T[] = [];

  for (const meme of candidates) {
    const memeSources = (meme.meme_sources ?? []) as PublicationExportSource[];
    const memeContents = (meme.meme_contents ?? []) as PublicationExportContent[];
    const delivery = resolveMemeDelivery({
      sources: memeSources.filter((source) => publicSources.has(source)),
      contents: memeContents.filter((content) => publicContents.has(content)),
    });
    // The query is already constrained to approved rows. Supplying that known
    // state keeps older consumers (such as RSS) compatible while the export
    // projection shares the detail/sitemap eligibility constructor.
    const eligibilityMeme = {
      title: meme.title ?? "",
      summary: meme.summary ?? "",
      description: meme.description ?? null,
      origin: meme.origin ?? null,
      usage_note: meme.usage_note ?? null,
      caution: meme.caution ?? null,
      usage_examples: meme.usage_examples ?? null,
      published_at: meme.published_at ?? null,
      moderation_status: "approved" as const,
      meme_tags_map: (meme.meme_tags_map ?? []).map((tag) => ({ tag_id: tag.tag_id })),
    } as Parameters<typeof publicEditorialEligibilityInput>[0]["meme"];
    const publicDepth = publicEditorialEligibilityInput({
      meme: eligibilityMeme,
      originalSources: delivery.originalSources,
      renderableContents: delivery.renderableContents,
    });
    if (!isIndexableMeme(publicDepth)) continue;

    projected.push({
      ...meme,
      description: publicDepth.description,
      meme_sources: [...delivery.originalSources],
      meme_contents: [...delivery.renderableContents],
    } as T);
  }

  return projected;
}

/**
 * Read the Korean discovery corpus under one explicit contract:
 * approved records only, then the same isIndexableMeme gate as sitemap/detail robots.
 * The output limit is applied after filtering. Range pages have an id tie-breaker and
 * a hard scan bound so an unexpectedly large corpus cannot create an unbounded request.
 */
export async function loadApprovedIndexableMemes<T extends PublicationExportRow>(
  supabase: StaticClient,
  options: PublicationExportOptions,
): Promise<{ rows: T[]; eligibleCount: number }> {
  const rows: T[] = [];
  let eligibleCount = 0;

  for (
    let from = 0;
    from < MAX_PUBLICATION_EXPORT_CANDIDATES;
    from += PUBLICATION_EXPORT_PAGE_SIZE
  ) {
    let query = supabase
      .from("memes")
      .select(options.select)
      .eq("moderation_status", "approved");

    query = options.primaryOrder === "published_at"
      ? query.order("published_at", { ascending: false, nullsFirst: false })
      : query.order("trend_score", { ascending: false });
    query = query.order("id", { ascending: false });

    const { data, error } = await query.range(
      from,
      from + PUBLICATION_EXPORT_PAGE_SIZE - 1,
    );
    if (error) {
      throw new PublicationExportError(
        `Publication export query failed at offset ${from}: ${error.message}`,
        error,
      );
    }

    const page = (data ?? []) as unknown as T[];
    const publicRows = await projectPublicIndexableRows(page);
    for (const meme of publicRows) {
      eligibleCount += 1;
      if (rows.length < options.limit) rows.push(meme);
    }

    if (!options.countAll && rows.length >= options.limit) {
      return { rows, eligibleCount };
    }
    if (page.length < PUBLICATION_EXPORT_PAGE_SIZE) {
      return { rows, eligibleCount };
    }
  }

  throw new PublicationExportError(
    `Publication export exceeded the ${MAX_PUBLICATION_EXPORT_CANDIDATES.toLocaleString("en-US")}-row scan bound`,
  );
}

export function publicationExportUnavailableResponse(): Response {
  return new Response("Publication export temporarily unavailable.\n", {
    status: 503,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "Retry-After": "300",
    },
  });
}
