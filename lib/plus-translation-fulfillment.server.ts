import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  buildPlusTranslationFulfillment,
  PLUS_TRANSLATION_FULFILLMENT_LIMIT,
  type PlusTranslationFulfillmentRequestRow,
  type PlusTranslationFulfillmentResult,
  type PlusTranslationFulfillmentTranslationRow,
} from "@/lib/plus-translation-fulfillment";
import { isSeoContentLocale } from "@/lib/i18n-routing";

const PLUS_TRANSLATION_LOCALES = ["en", "ja", "zh", "zh-tw"] as const;

export type PlusTranslationFulfillmentLoadResult =
  | PlusTranslationFulfillmentResult
  | { status: "locked"; items: [] };

export type PlusTranslationFulfillmentSupabase = Awaited<
  ReturnType<typeof createClient>
>;

function boundedLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return PLUS_TRANSLATION_FULFILLMENT_LIMIT;
  }
  return Math.min(
    PLUS_TRANSLATION_FULFILLMENT_LIMIT,
    Math.max(1, Math.trunc(limit)),
  );
}

function locked(): PlusTranslationFulfillmentLoadResult {
  return { status: "locked", items: [] };
}

function unavailable(): PlusTranslationFulfillmentLoadResult {
  return { status: "unavailable", items: [] };
}

export async function loadPlusTranslationFulfillment({
  supabase,
  isPremium,
  userId,
  limit,
}: {
  supabase: PlusTranslationFulfillmentSupabase;
  isPremium: boolean;
  userId: string;
  limit?: number;
}): Promise<PlusTranslationFulfillmentLoadResult> {
  const ownerId = userId.trim();
  if (!isPremium || ownerId.length === 0) return locked();

  try {
    const { data: requestRows, error: requestError } = await supabase
      .from("plus_translation_requests")
      .select(
        "id, meme_id, locale, status, created_at, updated_at, completed_at, meme:memes!inner(id, short_id, slug, title, summary, description, origin, usage_note, caution, usage_examples, safety_level, lifecycle_status, trend_score, moderation_status, updated_at, meme_sources(source_url), meme_contents(availability, moderation_status), meme_tags_map(tag_id))",
      )
      .eq("user_id", ownerId)
      .in("memes.moderation_status", ["approved", "limited"])
      .order("updated_at", { ascending: false })
      .order("id", { ascending: true })
      .limit(boundedLimit(limit))
      .overrideTypes<PlusTranslationFulfillmentRequestRow[], { merge: false }>();

    if (requestError) return unavailable();

    const requests = (requestRows ?? []).filter((request) =>
      isSeoContentLocale(request.locale),
    );
    if (requests.length === 0) {
      return buildPlusTranslationFulfillment({
        requests: [],
        translations: [],
        limit,
      });
    }

    const memeIds = [...new Set(requests.map((request) => request.meme_id))];
    const locales = PLUS_TRANSLATION_LOCALES.filter((locale) =>
      requests.some((request) => request.locale === locale),
    );
    const translationRows: PlusTranslationFulfillmentTranslationRow[] = [];

    for (const locale of locales) {
      const { data, error } = await supabase
        .from("meme_translations")
        .select(
          "meme_id, locale, status, source_updated_at, localized_slug, title, summary, description, origin, usage_note, caution, usage_examples, updated_at",
        )
        .eq("locale", locale)
        .in("meme_id", memeIds)
        .overrideTypes<
          PlusTranslationFulfillmentTranslationRow[],
          { merge: false }
        >();
      if (error) return unavailable();
      translationRows.push(...(data ?? []));
    }

    return buildPlusTranslationFulfillment({
      requests,
      translations: translationRows,
      limit,
    });
  } catch {
    return unavailable();
  }
}
