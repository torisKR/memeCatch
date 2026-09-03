import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type MemeCategory, type SafetyLevel } from "@/lib/labels";
import { MyFeed } from "@/components/my-feed";
import { PremiumGate } from "@/components/premium/premium-gate";
import { MyContent, type SavedMeme, type MySubmission } from "./my-content";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { getRequestLocale } from "@/lib/i18n-server";
import {
  applySavedLibraryEntitlement,
  SAVED_LIBRARY_PAGE_SIZE,
  parseSavedLibraryFilters,
  savedLibraryHref,
  savedLibraryTitleFilter,
} from "@/lib/saved-library";

const FREE_SAVE_LIMIT = 30;

export const metadata: Metadata = {
  title: "MY",
  description: "저장한 밈과 내 제보를 한눈에 볼 수 있어요.",
};

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const nicknameError =
    typeof sp.nickname_error === "string" ? sp.nickname_error : undefined;
  const nicknameSaved = sp.nickname_saved === "1";
  const customError =
    typeof sp.custom_error === "string" ? sp.custom_error : undefined;
  const customSaved = sp.custom_saved === "1";
  const requestedFilters = parseSavedLibraryFilters(sp);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my");

  const [entitlement, locale, profileRes, customRes, subsRes] =
    await Promise.all([
      getPremiumEntitlement(),
      getRequestLocale(),
      supabase
        .rpc("get_my_profile")
        .single(),
      supabase
        .from("profile_customizations")
        .select("flair, accent_color")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("meme_submissions")
        .select(
          "id, name, status, reject_reason, created_at, dup:memes!dup_of(title, short_id, slug)",
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  // The private library controls are a Plus entitlement, not a cosmetic gate.
  // Ignore hand-crafted filter URLs for free accounts so the server-side query
  // contract and the visible control surface stay aligned.
  const savedFilters = applySavedLibraryEntitlement(
    requestedFilters,
    entitlement.isPremium,
  );
  const savedFrom = (savedFilters.page - 1) * SAVED_LIBRARY_PAGE_SIZE;
  const hasVaultFilters = Boolean(savedFilters.query || savedFilters.safety);

  let savedQuery = supabase
    .from("saved_memes")
    // `!inner` is required: referenced-table filters must filter parent saved
    // rows rather than merely returning an empty embedded `memes` object.
    .select(
      "created_at, collection, note, memes!inner(id, short_id, slug, title, summary, safety_level)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });
  const titleFilter = savedLibraryTitleFilter(savedFilters.query);
  if (titleFilter) {
    savedQuery = savedQuery.or(titleFilter, { referencedTable: "memes" });
  }
  if (savedFilters.safety) {
    savedQuery = savedQuery.eq("memes.safety_level", savedFilters.safety);
  }

  // An active filter needs both the matching-result count and the account's
  // complete saved total. The second request is head-only and remains scoped by
  // the existing saved_memes RLS policy.
  const totalSavedPromise = hasVaultFilters
    ? supabase
        .from("saved_memes")
        .select("meme_id", { count: "exact", head: true })
    : Promise.resolve(null);
  const collectionNamesPromise = entitlement.isPremium
    ? supabase
        .from("saved_memes")
        .select("collection")
        .not("collection", "is", null)
        .order("collection", { ascending: true })
        .limit(200)
    : Promise.resolve({ data: [] as { collection: string | null }[], error: null });
  const [savedRes, totalSavedRes] = await Promise.all([
    savedQuery.range(savedFrom, savedFrom + SAVED_LIBRARY_PAGE_SIZE - 1),
    totalSavedPromise,
  ]);
  const collectionNamesRes = await collectionNamesPromise;

  const nickname = profileRes.data?.nickname ?? "";
  const interests = profileRes.data?.interests ?? [];
  const knownInterests = interests.filter(
    (c): c is MemeCategory => c in CATEGORIES,
  );
  const ageGroup = profileRes.data?.age_group ?? null;
  const flair = customRes.data?.flair ?? null;
  const accentColor = customRes.data?.accent_color ?? null;
  const loadError = !!(
    profileRes.error ||
    savedRes.error ||
    totalSavedRes?.error ||
    collectionNamesRes.error ||
    subsRes.error
  );
  const savedResultTotal = savedRes.count ?? savedRes.data?.length ?? 0;
  const savedTotal = totalSavedRes?.count ?? savedResultTotal;
  const savedPageCount = Math.max(
    1,
    Math.ceil(savedResultTotal / SAVED_LIBRARY_PAGE_SIZE),
  );

  if (savedRes.count !== null && savedFilters.page > savedPageCount) {
    redirect(
      savedLibraryHref(
        { query: savedFilters.query, safety: savedFilters.safety },
        savedPageCount,
      ),
    );
  }

  // 서버에서 직렬화 가능한 순수 데이터로 정규화 (클라 컴포넌트로 전달)
  const saved: SavedMeme[] = (savedRes.data ?? []).flatMap((row) => {
    const meme = row.memes;
    if (!meme) return [];
    return [
      {
        id: meme.id,
        shortId: meme.short_id,
        slug: meme.slug,
        title: meme.title,
        summary: meme.summary,
        safetyLevel: meme.safety_level as SafetyLevel,
        collection: row.collection ?? null,
        note: row.note ?? null,
      },
    ];
  });
  const collectionNames = [
    ...new Set(
      (collectionNamesRes.data ?? [])
        .map((row) => row.collection?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  const submissions: MySubmission[] = (subsRes.data ?? []).map((sub) => ({
    id: sub.id,
    name: sub.name,
    status: sub.status,
    rejectReason: sub.reject_reason,
    createdAt: sub.created_at,
    dup: sub.dup
      ? {
          title: sub.dup.title,
          shortId: sub.dup.short_id,
          slug: sub.dup.slug,
        }
      : null,
  }));

  return (
    <MyContent
      nickname={nickname}
      ageGroup={ageGroup}
      interests={interests}
      saved={saved}
      collectionNames={collectionNames}
      submissions={submissions}
      loadError={loadError}
      nicknameError={nicknameError}
      nicknameSaved={nicknameSaved}
      flair={flair}
      accentColor={accentColor}
      customError={customError}
      customSaved={customSaved}
      isPremium={entitlement.isPremium}
      saveLimit={FREE_SAVE_LIMIT}
      savedTotal={savedTotal}
      savedResultTotal={savedResultTotal}
      savedQuery={savedFilters.query}
      savedSafety={savedFilters.safety}
      savedPage={savedFilters.page}
      savedPageCount={savedPageCount}
      myFeed={
        entitlement.isPremium ? (
          <MyFeed interests={knownInterests} locale={locale} isPremium />
        ) : (
          <PremiumGate compact />
        )
      }
    />
  );
}
