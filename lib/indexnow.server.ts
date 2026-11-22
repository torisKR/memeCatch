import "server-only";

import { after } from "next/server";
import { memePathFrom } from "@/lib/labels";
import { isSeoContentLocale, localizedMemePath } from "@/lib/i18n-routing";
import { isIndexableLocalizedDocument } from "@/lib/localized-document-eligibility";
import { SITE_URL } from "@/lib/site";
import { isThinMeme } from "@/lib/thin-meme";
import type { ContentDepthInput } from "@/lib/content-depth";
import {
  INDEXNOW_ORIGIN,
  indexNowPayloads,
  postIndexNowPayloads,
  type IndexNowBatchResult,
} from "@/lib/indexnow";

const PUBLIC_STATUSES = new Set(["approved", "limited"]);

/**
 * Same columns the localized proxy check reads, so a submitted translated URL
 * is one the proxy actually serves.
 */
export const INDEXNOW_MEME_SELECT =
  "id, short_id, slug, moderation_status, updated_at, description, origin, usage_note, caution, usage_examples," +
  " meme_sources(source_url, hidden_from_public), meme_contents(availability, moderation_status), meme_tags_map(tag_id)," +
  " meme_translations(locale, status, localized_slug, title, summary, description, origin, source_updated_at)";

export type IndexNowMemeRow = ContentDepthInput & {
  short_id: string;
  slug: string;
  moderation_status: string | null;
  updated_at: string;
  meme_translations?: Array<{
    locale: string;
    status: string;
    localized_slug: string | null;
    title: string | null;
    summary: string | null;
    description: string | null;
    origin: string | null;
    source_updated_at: string;
  }> | null;
};

/**
 * URLs worth announcing after a publish, edit or status change.
 * - Korean detail: public and not thin (thin pages are noindex), or no longer
 *   public at all (engines learn about the 404 sooner).
 * - Localized details: only reviewed, current translations, the same predicate
 *   the proxy uses before serving them.
 */
export function indexNowUrlsForMeme(meme: IndexNowMemeRow | null | undefined): string[] {
  if (!meme?.short_id || !meme.slug) return [];
  const isPublic = PUBLIC_STATUSES.has(meme.moderation_status ?? "");
  const urls: string[] = [];
  if (!isPublic || !isThinMeme(meme)) {
    urls.push(`${INDEXNOW_ORIGIN}${memePathFrom(meme.short_id, meme.slug)}`);
  }
  if (!isPublic) return urls;
  for (const translation of meme.meme_translations ?? []) {
    if (!isSeoContentLocale(translation.locale)) continue;
    const eligible = isIndexableLocalizedDocument({
      baseUpdatedAt: meme.updated_at,
      original: meme,
      translation: {
        status: translation.status,
        sourceUpdatedAt: translation.source_updated_at,
        title: translation.title ?? "",
        summary: translation.summary ?? "",
        description: translation.description ?? "",
        origin: translation.origin ?? "",
      },
    });
    if (!eligible) continue;
    const slug = translation.localized_slug?.trim() || meme.slug;
    urls.push(`${INDEXNOW_ORIGIN}${localizedMemePath(translation.locale, meme.short_id, slug)}`);
  }
  return urls;
}

/** Production on the apex host only: previews and local runs never ping engines. */
export function indexNowEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.INDEXNOW_DISABLED === "1") return false;
  return env.NODE_ENV === "production" && SITE_URL === INDEXNOW_ORIGIN;
}

export type IndexNowSubmitResult = {
  submitted: number;
  batches: IndexNowBatchResult[];
  skipped?: "disabled" | "empty";
};

/**
 * Submit URLs and log only counts and status codes (no key, no payload).
 * Never throws.
 */
export async function submitIndexNow(
  urls: Iterable<string | null | undefined>,
  options: { fetchImpl?: typeof fetch; force?: boolean; timeoutMs?: number } = {},
): Promise<IndexNowSubmitResult> {
  try {
    if (!options.force && !indexNowEnabled()) return { submitted: 0, batches: [], skipped: "disabled" };
    const payloads = indexNowPayloads(urls);
    if (payloads.length === 0) return { submitted: 0, batches: [], skipped: "empty" };
    const batches = await postIndexNowPayloads(payloads, {
      fetchImpl: options.fetchImpl,
      timeoutMs: options.timeoutMs,
    });
    const submitted = batches.reduce((sum, batch) => sum + (batch.ok ? batch.urls : 0), 0);
    const failed = batches.filter((batch) => !batch.ok);
    if (failed.length > 0) {
      console.warn({
        event: "indexnow_submit_failed",
        batches: failed.length,
        statuses: failed.map((batch) => batch.status),
      });
    }
    return { submitted, batches };
  } catch {
    console.warn({ event: "indexnow_submit_failed", batches: null });
    return { submitted: 0, batches: [] };
  }
}

type MemeLookupDb = {
  from: (table: "memes") => {
    select: (columns: string) => {
      eq: (column: "id", value: string) => {
        maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }>;
      };
    };
  };
};

/**
 * Announce a meme's URLs after the response is sent. Reads the row after the
 * mutation so the submitted set reflects the new status and translations.
 * Failures are swallowed: an admin action never waits for or fails on IndexNow.
 */
export function scheduleIndexNowForMeme(db: unknown, memeId: string | null | undefined): void {
  if (!memeId || !indexNowEnabled()) return;
  const run = async () => {
    try {
      const { data, error } = await (db as MemeLookupDb)
        .from("memes")
        .select(INDEXNOW_MEME_SELECT)
        .eq("id", memeId)
        .maybeSingle();
      if (error || !data) return;
      await submitIndexNow(indexNowUrlsForMeme(data as IndexNowMemeRow));
    } catch {
      console.warn({ event: "indexnow_submit_failed", batches: null });
    }
  };
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts, tests): fire and forget.
    void run();
  }
}
