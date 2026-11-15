import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOperatorPage } from "@/app/(default)/admin/require-operator";
import { ModerationBadge, OriginKindBadge } from "@/components/admin/badges";
import { AdminMemeContents } from "@/components/admin/admin-meme-contents";
import { MemeEditForm } from "@/components/admin/meme-edit-form";
import { MemeStatusControls } from "@/components/admin/meme-status-controls";
import { MemeOriginCountryForm } from "@/components/admin/meme-origin-country-form";
import {
  CatalogProvenancePanel,
  type CatalogProvenanceSource,
} from "@/components/admin/catalog-provenance-panel";
import {
  MemeTranslationReview,
  type MemeTranslationReviewRow,
} from "@/components/admin/meme-translation-review";
import { ArtifactStudio } from "@/components/studio/artifact-studio";
import { isSeoContentLocale } from "@/lib/i18n-routing";
import { memePathFrom, SAFETY_LEVELS, type SafetyLevel } from "@/lib/labels";
import {
  houseOriginalCanonicalUrl,
  houseOriginalPublicLabel,
  isHouseOriginal,
  isHouseOriginalRightsSource,
} from "@/lib/house-original";
import type { ModerationStatus } from "@/components/admin/constants";

export const metadata = { title: "밈 편집" };

type UsageContext = Record<"work" | "friends" | "family" | "sns", SafetyLevel>;

export default async function AdminMemeEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 방어심화 — 미들웨어와 별개로 페이지에서 operator 재검증
  const { supabase } = await requireOperatorPage(`/admin/memes/${id}`);
  const { data: meme } = await supabase.from("memes").select("*").eq("id", id).single();
  if (!meme) notFound();

  const [
    { data: contents },
    { data: translations },
    { data: sources },
    { data: provenanceSources, error: provenanceError },
    { data: tagRows, error: tagsError },
    { data: originProfiles, error: originProfilesError },
  ] = await Promise.all([
    supabase
      .from("meme_contents")
      .select(
        "id, platform, content_id, url, thumbnail_url, availability, caption, is_representative, moderation_status",
      )
      .eq("meme_id", id)
      .order("is_representative", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("meme_translations")
      .select(
        "locale, status, source_updated_at, translated_at, updated_at, reviewed_at, reviewed_by, title, summary, description, origin, usage_note, caution, aliases",
      )
      .eq("meme_id", id)
      .order("locale", { ascending: true }),
    supabase
      .from("meme_sources")
      .select("source_url, source_role, rights_basis")
      .eq("meme_id", id),
    supabase
      .from("meme_media")
      .select("source_id, source_role, rights_basis, review_state, reviewer_note, media_sources(canonical_url, title, platform)")
      .eq("meme_id", id)
      .order("created_at", { ascending: true })
      .returns<CatalogProvenanceSource[]>(),
    supabase
      .from("meme_tags_map")
      .select("tags(name)")
      .eq("meme_id", id),
    supabase
      .from("meme_market_profiles")
      .select("market_code, language_tag, local_title, review_state")
      .eq("meme_id", id)
      .eq("role", "origin")
      .order("created_at", { ascending: true }),
  ]);
  if (originProfilesError) {
    throw new Error("출처 국가 프로필을 불러오지 못했어요.");
  }
  if (provenanceError || tagsError) {
    throw new Error("등록 근거를 불러오지 못했어요.");
  }

  const translationsForReview: MemeTranslationReviewRow[] = (translations ?? [])
    .filter(
      (translation) =>
        isSeoContentLocale(translation.locale) &&
        ["machine", "reviewed", "stale"].includes(translation.status),
    )
    .map((translation) => ({
      ...translation,
      locale: translation.locale as MemeTranslationReviewRow["locale"],
      status: translation.status as MemeTranslationReviewRow["status"],
    }));

  const rawCtx = (meme.usage_context ?? {}) as Partial<UsageContext>;
  const usageContext: UsageContext = {
    work: rawCtx.work ?? "yellow",
    friends: rawCtx.friends ?? "yellow",
    family: rawCtx.family ?? "yellow",
    sns: rawCtx.sns ?? "yellow",
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/memes" className="text-base text-muted hover:text-foreground">
          ← 밈 관리로
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold">{meme.title}</h1>
          <ModerationBadge status={meme.moderation_status as ModerationStatus} />
          <OriginKindBadge originKind={meme.origin_kind} />
          {["approved", "limited"].includes(meme.moderation_status) && (
            <Link
              href={memePathFrom(meme.short_id, meme.slug)}
              className="flex min-h-11 items-center text-base text-accent-text underline"
            >
              공개 페이지 보기
            </Link>
          )}
        </div>
      </div>

      <MemeStatusControls
        memeId={meme.id}
        currentStatus={meme.moderation_status as ModerationStatus}
        originKind={meme.origin_kind}
        hasRightsEvidence={(sources ?? []).some(isHouseOriginalRightsSource)}
        rightsSourceUrl={
          (sources ?? []).find(isHouseOriginalRightsSource)?.source_url ?? null
        }
      />

      {!isHouseOriginal(meme.origin_kind) && (
        <CatalogProvenancePanel
          dates={{
            sourceWorkYear: meme.source_work_year,
            memeFirstSeenYear: meme.meme_first_seen_year,
            koreaViralYear: meme.korea_viral_year,
            yearPrecision: meme.year_precision,
          }}
          tags={(tagRows ?? []).flatMap((row) => row.tags?.name ? [row.tags.name] : [])}
          sources={provenanceSources ?? []}
        />
      )}

      <MemeOriginCountryForm
        memeId={meme.id}
        memeTitle={meme.title}
        profiles={originProfiles ?? []}
      />

      <MemeTranslationReview
        memeId={meme.id}
        memeUpdatedAt={meme.updated_at}
        translations={translationsForReview}
        hasOpenAiReviewKey={Boolean(process.env.OPENAI_API_KEY?.trim())}
      />

      <AdminMemeContents
        contents={contents ?? []}
        memeTitle={meme.title}
        originKind={meme.origin_kind}
      />

      {isHouseOriginal(meme.origin_kind) && (
        <ArtifactStudio
          dictionaryOnly
          dictionaryDefaults={{
            name: meme.title,
            summary: meme.summary,
            safety: `${SAFETY_LEVELS[meme.safety_level as SafetyLevel].icon} ${SAFETY_LEVELS[meme.safety_level as SafetyLevel].user}`,
            detailUrl: houseOriginalCanonicalUrl(meme.short_id, meme.slug),
            source: houseOriginalPublicLabel(),
          }}
        />
      )}

      <MemeEditForm
        memeId={meme.id}
        originKind={meme.origin_kind}
        hasOpenAiReviewKey={Boolean(process.env.OPENAI_API_KEY?.trim())}
        initial={{
          title: meme.title,
          summary: meme.summary,
          description: meme.description,
          origin: meme.origin,
          usageNote: meme.usage_note ?? "",
          caution: meme.caution ?? "",
          aliases: meme.aliases,
          safetyLevel: meme.safety_level,
          lifecycleStatus: meme.lifecycle_status,
          category: meme.category,
          difficulty: meme.difficulty,
          sentiment: meme.sentiment,
          originYear: meme.origin_year,
          usageContext,
        }}
      />
    </div>
  );
}
