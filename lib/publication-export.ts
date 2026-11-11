import type { createStaticClient } from "@/lib/supabase/server";
import {
  discoveryIndexIds,
  passesContentIndexGate,
  type ContentDepthInput,
  type IndexCandidate,
} from "@/lib/content-depth";

export const PUBLICATION_EXPORT_PAGE_SIZE = 1_000;
const MAX_PUBLICATION_EXPORT_CANDIDATES = 50_000;

type StaticClient = ReturnType<typeof createStaticClient>;

type PublicationExportRow = ContentDepthInput & {
  id: string;
  category?: string | null;
  origin_year?: number | null;
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

/**
 * Read the Korean discovery corpus under one explicit contract:
 * approved records only, then the body gate plus two indexable relatives.
 * The output limit is applied after filtering. Range pages have an id tie-breaker and
 * a hard scan bound so an unexpectedly large corpus cannot create an unbounded request.
 */
export async function loadApprovedIndexableMemes<T extends PublicationExportRow>(
  supabase: StaticClient,
  options: PublicationExportOptions,
): Promise<{ rows: T[]; eligibleCount: number }> {
  const fieldPassers: T[] = [];
  let exhausted = false;

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
    for (const meme of page) {
      if (!passesContentIndexGate(meme)) continue;
      fieldPassers.push(meme);
    }

    if (page.length < PUBLICATION_EXPORT_PAGE_SIZE) {
      exhausted = true;
      break;
    }
  }

  if (!exhausted) {
    throw new PublicationExportError(
      `Publication export exceeded the ${MAX_PUBLICATION_EXPORT_CANDIDATES.toLocaleString("en-US")}-row scan bound`,
    );
  }

  const indexableIds = discoveryIndexIds(fieldPassers as IndexCandidate[]);
  const eligible = fieldPassers.filter((meme) => indexableIds.has(meme.id));
  return {
    rows: eligible.slice(0, options.limit),
    eligibleCount: eligible.length,
  };
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
