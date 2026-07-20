import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type MemeCategory, type SafetyLevel } from "@/lib/labels";
import { MyFeed } from "@/components/my-feed";
import { PremiumGate } from "@/components/premium/premium-gate";
import { MyContent, type SavedMeme, type MySubmission } from "./my-content";
import { getPremiumEntitlement } from "@/lib/billing/repository.server";
import { getRequestLocale } from "@/lib/i18n-server";

const FREE_SAVE_LIMIT = 30;
const SAVED_PAGE_SIZE = 50;

function parseSavedPage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;

  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

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
  const savedPage = parseSavedPage(sp.saved_page);
  const savedFrom = (savedPage - 1) * SAVED_PAGE_SIZE;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my");

  const [entitlement, locale, profileRes, customRes, savedRes, subsRes] =
    await Promise.all([
    getPremiumEntitlement(),
    getRequestLocale(),
    supabase
      .from("profiles")
      .select("nickname, interests, age_group")
      .eq("id", user.id)
      .single(),
    supabase
      .from("profile_customizations")
      .select("flair, accent_color")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("saved_memes")
      .select(
        "created_at, collection, note, memes(id, short_id, slug, title, summary, safety_level)",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(savedFrom, savedFrom + SAVED_PAGE_SIZE - 1),
    supabase
      .from("meme_submissions")
      .select(
        "id, name, status, reject_reason, created_at, dup:memes!dup_of(title, short_id, slug)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const nickname = profileRes.data?.nickname ?? "";
  const interests = profileRes.data?.interests ?? [];
  const knownInterests = interests.filter(
    (c): c is MemeCategory => c in CATEGORIES
  );
  const ageGroup = profileRes.data?.age_group ?? null;
  const flair = customRes.data?.flair ?? null;
  const accentColor = customRes.data?.accent_color ?? null;
  const loadError = !!(profileRes.error || savedRes.error || subsRes.error);
  const savedTotal = savedRes.count ?? savedRes.data?.length ?? 0;
  const savedPageCount = Math.max(1, Math.ceil(savedTotal / SAVED_PAGE_SIZE));

  if (savedRes.count !== null && savedPage > savedPageCount) {
    redirect(`/my?saved_page=${savedPageCount}#saved`);
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
      savedPage={savedPage}
      savedPageCount={savedPageCount}
      myFeed={
        entitlement.isPremium ? (
          <MyFeed interests={knownInterests} locale={locale} />
        ) : (
          <PremiumGate compact />
        )
      }
    />
  );
}
