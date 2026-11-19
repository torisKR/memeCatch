import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { type SafetyLevel } from "@/lib/labels";
import { MyContent, type SavedMeme, type MySubmission } from "./my-content";
import { getMemeCardCollectionPage } from "@/lib/meme-collectible.server";
import { MemeCollectibleCollection } from "@/components/meme-collectible-collection";
import { DailyMemeQuiz } from "@/components/daily-meme-quiz";
import {
  SAVED_LIBRARY_PAGE_SIZE,
  parseSavedLibraryFilters,
  savedLibraryHref,
  savedLibraryTitleFilter,
} from "@/lib/saved-library";

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
  const savedFilters = parseSavedLibraryFilters(sp);

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login?next=/my");

  const memeCardsPromise = user.is_anonymous
    ? Promise.resolve({ page: null, error: true, loginRequired: true })
    : getMemeCardCollectionPage(db, user.id, { page: 1 })
      .then((page) => ({ page, error: false, loginRequired: false }))
      .catch(() => ({ page: null, error: true, loginRequired: false }));

  const [profileRes, subsRes] =
    await Promise.all([
      db
        .rpc("get_my_profile")
        .single(),
      db
        .from("meme_submissions")
        .select(
          "id, name, status, reject_reason, created_at, dup:memes!dup_of(title, short_id, slug)",
        )
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const savedFrom = (savedFilters.page - 1) * SAVED_LIBRARY_PAGE_SIZE;
  const hasVaultFilters = Boolean(savedFilters.query || savedFilters.safety);

  let savedQuery = db
    .from("saved_memes")
    // `!inner` is required: referenced-table filters must filter parent saved
    // rows rather than merely returning an empty embedded `memes` object.
    .select(
      "created_at, memes!inner(id, short_id, slug, title, summary, safety_level)",
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
    ? db
        .from("saved_memes")
        .select("meme_id", { count: "exact", head: true })
    : Promise.resolve(null);
  const [savedRes, totalSavedRes] = await Promise.all([
    savedQuery.range(savedFrom, savedFrom + SAVED_LIBRARY_PAGE_SIZE - 1),
    totalSavedPromise,
  ]);

  const nickname = profileRes.data?.nickname ?? "";
  const interests = profileRes.data?.interests ?? [];
  const ageGroup = profileRes.data?.age_group ?? null;
  const loadError = !!(
    profileRes.error ||
    savedRes.error ||
    totalSavedRes?.error ||
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
      },
    ];
  });
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
  const memeCards = await memeCardsPromise;

  return (
    <MyContent
      nickname={nickname}
      ageGroup={ageGroup}
      interests={interests}
      saved={saved}
      submissions={submissions}
      loadError={loadError}
      nicknameError={nicknameError}
      nicknameSaved={nicknameSaved}
      savedTotal={savedTotal}
      savedResultTotal={savedResultTotal}
      savedQuery={savedFilters.query}
      savedSafety={savedFilters.safety}
      savedPage={savedFilters.page}
      savedPageCount={savedPageCount}
      dailyQuiz={<DailyMemeQuiz variant="compact" />}
      memeCards={<MemeCollectibleCollection key={user.id} ownerUserId={user.id} initialPage={memeCards.page} initialError={memeCards.error} initialLoginRequired={memeCards.loginRequired} />}
    />
  );
}
