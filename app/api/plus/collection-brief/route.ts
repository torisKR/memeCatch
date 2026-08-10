import { NextResponse } from "next/server";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { hasRequiredTranslationFields, isTranslationCurrent } from "@/lib/meme-translations";
import {
  buildPlusCollectionBrief,
  type PlusCollectionBriefItem,
} from "@/lib/plus-collection-brief";
import { isLocale, type Locale } from "@/lib/i18n";
import { isSeoContentLocale, localizedMemePath } from "@/lib/i18n-routing";
import { memePathFrom, type LifecycleStatus, type SafetyLevel } from "@/lib/labels";
import { SITE_URL } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ITEMS = 100;

type SavedBriefRow = {
  created_at: string;
  collection: string | null;
  note: string | null;
  memes: {
    id: string;
    short_id: string;
    slug: string;
    title: string;
    summary: string;
    description: string;
    origin: string;
    usage_note: string | null;
    caution: string | null;
    safety_level: SafetyLevel;
    lifecycle_status: LifecycleStatus;
    trend_score: number;
    updated_at: string;
    moderation_status: "approved" | "limited";
  } | null;
};

type TranslationBriefRow = {
  meme_id: string;
  locale: string;
  status: string;
  localized_slug: string;
  title: string;
  summary: string;
  description: string;
  origin: string;
  usage_note: string | null;
  caution: string | null;
  source_updated_at: string;
};

type BriefRequest = { collection: string; locale: Locale };

function noStore() {
  return {
    "cache-control": "private, no-store",
    "x-content-type-options": "nosniff",
  };
}

function parseField(value: FormDataEntryValue | unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength ? normalized : null;
}

function parseLocale(value: unknown): Locale {
  return typeof value === "string" && isLocale(value) ? value : "ko";
}

async function parseRequest(request: Request): Promise<BriefRequest | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    const collection = parseField(body?.collection, 40);
    if (!collection) return null;
    return { collection, locale: parseLocale(body?.locale) };
  }

  const form = await request.formData().catch(() => null);
  if (!form) return null;
  const collection = parseField(form.get("collection"), 40);
  if (!collection) return null;
  return { collection, locale: parseLocale(form.get("locale")) };
}

function safeFilename(collection: string): string {
  const stem = collection
    .normalize("NFKC")
    .replace(/[^A-Za-z0-9가-힣_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return `memecatch-plus-${stem || "collection"}.md`;
}

export async function POST(request: Request): Promise<Response> {
  const input = await parseRequest(request);
  if (!input) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400, headers: noStore() });
  }

  const entitlement = await getPremiumEntitlement();
  if (!entitlement.signedIn) {
    return NextResponse.json({ error: "signed_out" }, { status: 401, headers: noStore() });
  }
  if (!entitlement.isPremium) {
    return NextResponse.json({ error: "not_premium" }, { status: 403, headers: noStore() });
  }

  const supabase = await createClient();
  const { data, count, error } = await supabase
    .from("saved_memes")
    .select(
      "created_at, collection, note, memes!inner(id, short_id, slug, title, summary, description, origin, usage_note, caution, safety_level, lifecycle_status, trend_score, updated_at, moderation_status)",
      { count: "exact" },
    )
    .eq("collection", input.collection)
    .in("memes.moderation_status", ["approved", "limited"])
    .order("created_at", { ascending: false })
    .limit(MAX_ITEMS);

  if (error) {
    return NextResponse.json({ error: "fetch_failed" }, { status: 500, headers: noStore() });
  }

  const rows = (data ?? []) as unknown as SavedBriefRow[];
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "collection_empty" },
      { status: 404, headers: noStore() },
    );
  }

  const memes = rows.flatMap((row) => (row.memes ? [row.memes] : []));
  const translations = new Map<string, TranslationBriefRow>();
  if (isSeoContentLocale(input.locale)) {
    const { data: translationRows, error: translationError } = await supabase
      .from("meme_translations")
      .select(
        "meme_id, locale, status, localized_slug, title, summary, description, origin, usage_note, caution, source_updated_at",
      )
      .eq("locale", input.locale)
      .eq("status", "reviewed")
      .in("meme_id", memes.map((meme) => meme.id));
    if (!translationError) {
      for (const row of (translationRows ?? []) as unknown as TranslationBriefRow[]) {
        translations.set(row.meme_id, row);
      }
    }
  }

  const items: PlusCollectionBriefItem[] = memes.map((meme) => {
    const translation = translations.get(meme.id);
    const isLocalized = Boolean(
      translation &&
        translation.locale === input.locale &&
        translation.status === "reviewed" &&
        isTranslationCurrent(translation.source_updated_at, meme.updated_at) &&
        hasRequiredTranslationFields(translation),
    );
    const content = isLocalized && translation ? translation : meme;
    const slug = "localized_slug" in content ? content.localized_slug : meme.slug;
    const detailPath =
      isLocalized && isSeoContentLocale(input.locale)
        ? localizedMemePath(input.locale, meme.short_id, slug || meme.slug)
        : memePathFrom(meme.short_id, meme.slug);

    return {
      title: content.title,
      summary: content.summary,
      origin: content.origin,
      usageNote: content.usage_note,
      caution: content.caution,
      safetyLevel: meme.safety_level,
      lifecycleStatus: meme.lifecycle_status,
      privateNote: rows.find((row) => row.memes?.id === meme.id)?.note ?? null,
      detailUrl: `${SITE_URL}${detailPath}`,
      isLocalized,
    };
  });

  const markdown = buildPlusCollectionBrief({
    collection: input.collection,
    locale: input.locale,
    items,
    generatedAt: new Date().toISOString(),
    truncated: (count ?? rows.length) > rows.length,
  });

  return new Response(markdown, {
    status: 200,
    headers: {
      ...noStore(),
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="${safeFilename(input.collection)}"`,
      "content-language": input.locale,
    },
  });
}
