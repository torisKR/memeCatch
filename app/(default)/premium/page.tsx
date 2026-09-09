import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MyFeed } from "@/components/my-feed";
import { CheckoutReturnStatus } from "@/components/premium/checkout-return-status";
import { PREMIUM_COPY } from "@/lib/i18n-premium";
import { PremiumDashboardContent } from "@/components/premium/premium-dashboard-content";
import { PlusActionQueue } from "@/components/premium/plus-action-queue";
import { PlusDailySignal } from "@/components/premium/plus-daily-signal";
import { PlusWeeklyDeltaBrief } from "@/components/premium/plus-weekly-delta-brief";
import { SavedReuseRadar } from "@/components/premium/saved-reuse-radar";
import { PlusSavedContextWatch } from "@/components/premium/plus-saved-context-watch";
import { PlusDailySignalSettings } from "@/components/premium/plus-daily-signal-settings";
import { PlusGlobalScout } from "@/components/premium/plus-global-scout";
import { PlusGlobalActionInbox } from "@/components/premium/plus-global-action-inbox";
import { MemeMarketPassport } from "@/components/meme-market-passport";
import {
  getPlusOutcomeSnapshotCopy,
  PlusOutcomeSnapshot,
} from "@/components/premium/plus-outcome-snapshot";
import { PlusOutcomeHistory } from "@/components/premium/plus-outcome-history";
import { PlusTranslationFulfillmentCenter } from "@/components/premium/plus-translation-fulfillment-center";
import { GlobalDailyChallenge } from "@/components/premium/global-daily-challenge";
import {
  getPremiumEntitlement,
  listOwnUnifiPaymentHistory,
  registerCurrentBillingIdentity,
} from "@/lib/billing/repository.server";
import { getRequestLocale } from "@/lib/i18n-server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isGlobalDailyLocale,
  isValidGlobalDailyQuestion,
  projectGlobalDailyOneCutCandidate,
  type GlobalDailyLocale,
} from "@/lib/global-daily-challenge";
import { loadGlobalDailyChallenge } from "@/lib/global-daily-challenge.server";
import { getMemeMarketPassport } from "@/lib/meme-market-passport.server";
import { getLocalizedMemeByShortId } from "@/lib/meme-translations";
import { createClient } from "@/lib/supabase/server";
import {
  CATEGORIES,
  type LifecycleStatus,
  type MemeCategory,
  type SafetyLevel,
} from "@/lib/labels";
import {
  buildSavedReuseRadar,
  SAVED_REUSE_RADAR_CANDIDATE_LIMIT,
  type SavedReuseRadarItem,
} from "@/lib/saved-reuse-radar";
import {
  resolvePlusContentLocale,
  type PlusFeedContentLocale,
  type PlusLocalizedFeedSource,
} from "@/lib/plus-localized-feed";
import {
  buildPlusWeeklyBriefCandidates,
  buildPlusWeeklyDeltaBrief,
  kstDateWindow,
  resolvePlusWeeklyBriefCoverageState,
  type PlusWeeklyBriefCandidate,
  type PlusWeeklyBriefMetric,
  type PlusWeeklyBriefSource,
  type PlusWeeklyBriefTranslation,
  type PlusWeeklyBriefCoverageState,
} from "@/lib/plus-weekly-brief";
import {
  buildSavedContextWatch,
  SAVED_CONTEXT_WATCH_ITEM_LIMIT,
  isSavedContextWatchKind,
  type SavedContextWatchItem,
  type SavedContextWatchSource,
} from "@/lib/saved-context-watch";
import {
  buildPlusDailySignalCandidates,
  isDailySignalLocale,
  type PlusDailySignalAlertRow,
  type PlusDailySignalTranslationRow,
} from "@/lib/plus-daily-signal-delivery.server";
import { plusDailySignalSince, type DailySignalLocale } from "@/lib/plus-daily-signal.server";
import { resolvePremiumPrimaryMission } from "@/lib/premium-primary-mission";
import {
  buildTrustedPlusGlobalActionInbox,
  type PlusGlobalActionInboxInput,
  type PlusGlobalActionInboxItem,
} from "@/lib/plus-global-action-inbox";
import { loadPlusGlobalActionInboxCompletion } from "@/lib/plus-global-action-inbox.server";
import {
  loadPlusOutcomeHistory,
  loadPlusOutcomeReplayItem,
  loadPlusOutcomeFollowUps,
  loadPlusOutcomeRatings,
  loadPlusOutcomeSummary,
  plusOutcomeHistoryDateWindow,
} from "@/lib/plus-outcome-ledger.server";
import { buildPlusOutcomeWinningReplay } from "@/lib/plus-outcome-ledger";
import { PLUS_OUTCOME_COPY } from "@/lib/plus-outcome-copy";
import { PLUS_NEXT_MOVE_COPY } from "@/lib/plus-next-move-copy";
import {
  plusNextMoveDateWindow,
  projectSavedRevisitNextMoveItem,
} from "@/lib/plus-next-move";
import {
  loadPlusGlobalScout,
  trustedPlusGlobalScoutMemeIds,
} from "@/lib/plus-global-scout.server";
import {
  exportPlusTrustedEvidenceSet,
  type PlusTrustedEvidenceSupabase,
} from "@/lib/plus-trusted-evidence-exporter.server";
import { loadPlusTranslationFulfillment } from "@/lib/plus-translation-fulfillment.server";
import {
  buildPlusOutcomeReplayPath,
  parsePlusOutcomeReplayRequest,
} from "@/lib/plus-outcome-replay-routing";
import {
  buildPlusActionPremiumPath,
  buildPlusDailySignalPremiumPath,
  parsePlusActionPremiumSource,
  parsePlusDailySignalLocale,
  parsePlusDailySignalFocus,
  parsePlusDailySignalSource,
} from "@/lib/plus-daily-signal-routing";
import type { QuizQuestion } from "@/lib/quiz";

export const metadata: Metadata = {
  title: "MY PLUS",
  description: "MemeCatch Plus 맞춤 트렌드 레이더와 멤버십 상태를 확인하세요.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const SAVED_CONTEXT_PAGE_SIZE = 200;
const WEEKLY_SOURCE_SELECT =
  "id, short_id, slug, title, summary, category, safety_level, lifecycle_status, media_type, origin_year, trend_score, description, origin, usage_note, caution, aliases, usage_examples, updated_at, moderation_status, meme_contents(availability, moderation_status, thumbnail_url, is_representative), meme_sources(source_url), meme_tags_map(tag_id)" as const;
const WEEKLY_TRANSLATION_SELECT =
  "meme_id, locale, status, localized_slug, title, summary, description, origin, source_updated_at" as const;

type WeeklySourceRow = PlusLocalizedFeedSource & {
  moderation_status: string;
};

type SavedContextRow = {
  created_at: string;
  memes: {
    id: string;
    short_id: string;
    slug: string;
    title: string;
    updated_at: string;
  } | null;
};

type SavedContextTranslation = {
  meme_id: string;
  locale: string;
  status: string;
  source_updated_at: string;
  updated_at: string;
};

type RawPremiumParams = Record<string, string | string[] | undefined>;

async function loadAllSavedContextRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SavedContextRow[]> {
  const rows: SavedContextRow[] = [];
  for (let offset = 0; ; offset += SAVED_CONTEXT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("saved_memes")
      .select("created_at, memes!inner(id, short_id, slug, title, updated_at)")
      .order("created_at", { ascending: false })
      .range(offset, offset + SAVED_CONTEXT_PAGE_SIZE - 1);
    if (error) return [];
    const pageRows = (data ?? []) as SavedContextRow[];
    rows.push(...pageRows);
    if (pageRows.length < SAVED_CONTEXT_PAGE_SIZE) return rows;
  }
}

async function loadSavedContextTranslations(
  supabase: Awaited<ReturnType<typeof createClient>>,
  memeIds: readonly string[],
  locale: string,
): Promise<SavedContextTranslation[]> {
  const rows: SavedContextTranslation[] = [];
  for (let start = 0; start < memeIds.length; start += SAVED_CONTEXT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("meme_translations")
      .select("meme_id, locale, status, source_updated_at, updated_at")
      .in("meme_id", memeIds.slice(start, start + SAVED_CONTEXT_PAGE_SIZE))
      .eq("locale", locale);
    if (error) return [];
    rows.push(...((data ?? []) as SavedContextTranslation[]));
  }
  return rows;
}

async function buildSavedRevisitNextMoveItems(
  items: readonly SavedReuseRadarItem[],
  locale: PlusFeedContentLocale,
): Promise<PlusGlobalActionInboxItem[]> {
  const candidates = await Promise.all(
    items.map(async (item) => {
      if (locale === "ko") return projectSavedRevisitNextMoveItem(item, locale);
      try {
        const localized = await getLocalizedMemeByShortId(item.shortId, locale);
        return projectSavedRevisitNextMoveItem(
          item,
          locale,
          localized
            ? {
                slug: localized.slug,
                title: localized.title,
                summary: localized.summary,
              }
            : null,
        );
      } catch {
        return projectSavedRevisitNextMoveItem(item, locale, null);
      }
    }),
  );
  return candidates.flatMap((item) => (item ? [item] : []));
}

function matchesGlobalDailyOneCutQuestion(
  question: QuizQuestion,
  candidate: {
    memeId: string;
    shortId: string;
    slug: string;
    title: string;
    safetyLevel: string;
  },
): boolean {
  return Boolean(
    question.meme.id === candidate.memeId &&
      question.meme.shortId === candidate.shortId &&
      question.meme.slug === candidate.slug &&
      question.meme.title === candidate.title &&
      question.meme.safetyLevel === candidate.safetyLevel,
  );
}

export default async function PremiumPage({
  searchParams,
}: {
  searchParams: Promise<RawPremiumParams>;
}) {
  const [initialEntitlement, locale, rawParams] = await Promise.all([
    getPremiumEntitlement(),
    getRequestLocale(),
    searchParams,
  ]);
  let entitlement = initialEntitlement;
  const actionEntrySource = parsePlusActionPremiumSource(rawParams.from);
  const dailySignalEntrySource = parsePlusDailySignalSource(rawParams.from);
  const globalDailyEntrySource = actionEntrySource === "global_daily" ? actionEntrySource : undefined;
  const outcomeReplayRequest = parsePlusOutcomeReplayRequest({
    shortId: rawParams.replay,
    locale: rawParams.replay_locale,
    source: rawParams.from,
    focus: rawParams.focus,
    dailySignalLocale: rawParams.locale,
  });
  const outcomeReplayShortId = outcomeReplayRequest?.shortId ?? null;
  const outcomeReplayLocale = outcomeReplayRequest?.locale ?? null;
  const actionFocusMemeId = actionEntrySource
    ? parsePlusDailySignalFocus(rawParams.focus)
    : undefined;
  const actionRequestedLocale = actionEntrySource && actionFocusMemeId
    ? parsePlusDailySignalLocale(rawParams.locale)
    : undefined;
  const preferredMemeId = dailySignalEntrySource ? actionFocusMemeId : undefined;
  const preferredSignalLocale = dailySignalEntrySource && preferredMemeId
    ? parsePlusDailySignalLocale(rawParams.locale)
    : undefined;
  const globalDailyRequestedLocale = globalDailyEntrySource && actionFocusMemeId
    ? actionRequestedLocale
    : undefined;
  const globalDailyLocale: GlobalDailyLocale =
    globalDailyRequestedLocale ?? (isGlobalDailyLocale(locale) ? locale : "en");
  const premiumPath = preferredMemeId
    ? buildPlusDailySignalPremiumPath(preferredMemeId, preferredSignalLocale)
    : globalDailyEntrySource && actionFocusMemeId
      ? buildPlusActionPremiumPath(actionFocusMemeId, actionRequestedLocale, globalDailyEntrySource)
    : outcomeReplayShortId && outcomeReplayLocale
      ? buildPlusOutcomeReplayPath(outcomeReplayShortId, outcomeReplayLocale) ?? "/premium"
      : "/premium";

  if (!entitlement.signedIn) {
    redirect(
      premiumPath === "/premium"
        ? "/pricing"
        : `/login?next=${encodeURIComponent(premiumPath)}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(premiumPath)}`);

  const nextMoveWindow = plusNextMoveDateWindow();
  const outcomeHistoryWindow = plusOutcomeHistoryDateWindow();

  // Latpeed에서 상품을 직접 구매해 웹훅이 먼저 도착한 경우에도, 같은
  // 로그인 이메일의 미매칭 결제를 이 계정에 안전하게 연결한다.
  if (!entitlement.isPremium) {
    try {
      await registerCurrentBillingIdentity();
      entitlement = await getPremiumEntitlement();
    } catch {
      // 기존 권한 조회 결과로 화면을 계속 렌더한다. 사용자는 새로고침으로
      // 재시도할 수 있고, 서명된 결제 이벤트 없이는 권한이 생기지 않는다.
    }
  }

  const [
    { data: profile },
    history,
    savedMemes,
    savedRadarRes,
    savedContextRes,
    dailySignalPreferenceRes,
    translationFulfillmentRes,
    actionCompletionRes,
    outcomeSummaryRes,
    outcomeFollowUpsRes,
    outcomeRatingsRes,
    outcomeHistoryRes,
    globalDailyChallengeRes,
  ] = await Promise.all([
    supabase.rpc("get_my_profile").maybeSingle(),
    listOwnUnifiPaymentHistory(),
    entitlement.isPremium
      ? supabase.from("saved_memes").select("meme_id", { count: "exact", head: true })
      : Promise.resolve({ count: 0, error: null }),
    entitlement.isPremium
      ? supabase
          .from("saved_memes")
          .select(
            "created_at, collection, memes!inner(id, short_id, slug, title, summary, safety_level, lifecycle_status, trend_score, updated_at)",
          )
          .order("trend_score", {
            referencedTable: "memes",
            ascending: false,
            nullsFirst: false,
          })
          .order("created_at", { ascending: false })
          .limit(SAVED_REUSE_RADAR_CANDIDATE_LIMIT)
      : Promise.resolve({ data: [], error: null }),
    entitlement.isPremium
      ? loadAllSavedContextRows(supabase).then((data) => ({ data }))
      : Promise.resolve({ data: [] as SavedContextRow[] }),
    supabase
      .from("plus_digest_preferences")
      .select("enabled, locale, timezone")
      .maybeSingle(),
    entitlement.isPremium
      ? loadPlusTranslationFulfillment({
          supabase,
          isPremium: true,
          userId: user.id,
        })
      : Promise.resolve({ status: "locked" as const, items: [] }),
    loadPlusGlobalActionInboxCompletion({
      supabase,
      isPremium: entitlement.isPremium,
    }),
    loadPlusOutcomeSummary({
      supabase,
      isPremium: entitlement.isPremium,
    }),
    loadPlusOutcomeFollowUps({
      supabase,
      isPremium: entitlement.isPremium,
      fromDate: kstDateWindow().from,
      toDate: kstDateWindow().to,
    }),
    loadPlusOutcomeRatings({
      supabase,
      isPremium: entitlement.isPremium,
      fromDate: nextMoveWindow.from,
      toDate: nextMoveWindow.to,
    }),
    loadPlusOutcomeHistory({
      supabase,
      isPremium: entitlement.isPremium,
      fromDate: outcomeHistoryWindow.from,
      toDate: outcomeHistoryWindow.to,
    }),
    entitlement.isPremium
      ? loadGlobalDailyChallenge(globalDailyLocale)
      : Promise.resolve(null),
  ]);
  const firstGlobalDailyMeme = globalDailyChallengeRes?.questions[0]?.meme;
  const globalDailyPassport =
    entitlement.isPremium &&
    globalDailyChallengeRes &&
    (globalDailyChallengeRes.state === "ready" || globalDailyChallengeRes.state === "completed") &&
    firstGlobalDailyMeme?.id
      ? await getMemeMarketPassport(firstGlobalDailyMeme.id, globalDailyChallengeRes.locale)
      : null;
  const globalDailyCandidateById = new Map(
    (globalDailyChallengeRes?.candidates ?? []).map((candidate) => [candidate.id, candidate]),
  );
  const globalDailyOneCutHandoffs: Record<string, string> = {};
  const globalDailyEligibleStates = globalDailyChallengeRes &&
    (globalDailyChallengeRes.state === "ready" || globalDailyChallengeRes.state === "completed") &&
    actionCompletionRes.status !== "unavailable";
  const globalDailyPromotionEligible = globalDailyChallengeRes &&
    globalDailyChallengeRes.state === "completed" &&
    actionCompletionRes.status !== "unavailable" &&
    globalDailyChallengeRes.questions.length === 3 &&
    globalDailyChallengeRes.questions.every((question) => {
      if (!isValidGlobalDailyQuestion(question) || !question.meme.id) return false;
      const projected = projectGlobalDailyOneCutCandidate(
        globalDailyCandidateById.get(question.meme.id),
        globalDailyChallengeRes.locale,
      );
      return Boolean(projected && matchesGlobalDailyOneCutQuestion(question, projected));
    });
  const completedActionMemeIds = new Set(actionCompletionRes.completedMemeIds ?? []);
  if (globalDailyEligibleStates && globalDailyChallengeRes) {
    for (const question of globalDailyChallengeRes.questions) {
      if (!isValidGlobalDailyQuestion(question) || !question.meme.id) continue;
      if (completedActionMemeIds.has(question.meme.id)) continue;
      const projected = projectGlobalDailyOneCutCandidate(
        globalDailyCandidateById.get(question.meme.id),
        globalDailyChallengeRes.locale,
      );
      if (!projected || !matchesGlobalDailyOneCutQuestion(question, projected)) continue;
      globalDailyOneCutHandoffs[projected.memeId] =
        `${buildPlusActionPremiumPath(projected.memeId, projected.locale, "global_daily")}#plus-global-action-inbox-title`;
    }
  }
  const globalDailyActionCandidate =
    globalDailyEntrySource &&
    actionFocusMemeId &&
    globalDailyRequestedLocale &&
    globalDailyChallengeRes &&
    globalDailyChallengeRes.locale === globalDailyRequestedLocale &&
    globalDailyPromotionEligible
      ? (() => {
          const question = globalDailyChallengeRes.questions.find(
            (item) => item.meme.id === actionFocusMemeId,
          );
          const projected = projectGlobalDailyOneCutCandidate(
            globalDailyCandidateById.get(actionFocusMemeId),
            globalDailyChallengeRes.locale,
          );
          return question && isValidGlobalDailyQuestion(question) && projected &&
            matchesGlobalDailyOneCutQuestion(question, projected)
            ? projected
            : undefined;
        })()
      : undefined;
  const interests = (profile?.interests ?? []).filter(
    (category): category is MemeCategory => category in CATEGORIES,
  );

  const savedRadarItems: SavedReuseRadarItem[] = (savedRadarRes.data ?? []).flatMap(
    (row) => {
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
          lifecycleStatus: meme.lifecycle_status as LifecycleStatus,
          trendScore: meme.trend_score ?? 0,
          savedAt: row.created_at,
          collection: row.collection ?? null,
        },
      ];
    },
  );
  const savedContextSources: SavedContextWatchSource[] = (savedContextRes.data ?? []).flatMap(
    (row) => {
      const meme = row.memes;
      if (!meme) return [];
      return [
        {
          id: meme.id,
          shortId: meme.short_id,
          slug: meme.slug,
          title: meme.title,
          savedAt: row.created_at,
          updatedAt: meme.updated_at,
          translation: null,
        },
      ];
    },
  );
  const savedContextMemeIds = savedContextSources.map((source) => source.id);
  const savedTranslations =
    entitlement.isPremium && savedContextMemeIds.length > 0
      ? await loadSavedContextTranslations(supabase, savedContextMemeIds, locale)
      : [];
  const translationsByMeme = new Map(
    savedTranslations.map((translation) => [translation.meme_id, translation]),
  );
  const savedContextInputs = savedContextSources.map((source) => {
    const translation = translationsByMeme.get(source.id);
    return {
      ...source,
      translation: translation
        ? {
            locale: translation.locale,
            status: translation.status,
            sourceUpdatedAt: translation.source_updated_at,
            updatedAt: translation.updated_at,
          }
        : null,
    };
  });
  const derivedContextWatch = buildSavedContextWatch(savedContextInputs);
  const interestRowsRes = entitlement.isPremium && interests.length
    ? await supabase
        .from("memes")
        .select("id, short_id, slug, title, summary, safety_level, lifecycle_status")
        .in("category", interests)
        .in("moderation_status", ["approved", "limited"])
        .order("trend_score", { ascending: false })
        .limit(60)
    : { data: [], error: null };
  const interestRows = interestRowsRes.data ?? [];
  const weeklySourceIds = [
    ...savedRadarItems.map((item) => item.id),
    ...interestRows.map((meme) => meme.id),
  ].filter((id, index, all) => all.indexOf(id) === index);
  const weeklyContentLocale = resolvePlusContentLocale(locale);
  let weeklyCandidates: PlusWeeklyBriefCandidate[] = [
    ...savedRadarItems.map((item) => ({
      id: item.id,
      shortId: item.shortId,
      slug: item.slug,
      title: item.title,
      summary: item.summary,
      safetyLevel: item.safetyLevel,
      lifecycleStatus: item.lifecycleStatus,
      source: "saved" as const,
    })),
    ...interestRows.map((meme) => ({
      id: meme.id,
      shortId: meme.short_id,
      slug: meme.slug,
      title: meme.title,
      summary: meme.summary,
      safetyLevel: meme.safety_level as SafetyLevel,
      lifecycleStatus: meme.lifecycle_status as LifecycleStatus,
      source: "interest" as const,
    })),
  ].filter((candidate, index, all) => all.findIndex((item) => item.id === candidate.id) === index)
    .slice(0, 60);
  let weeklyCoverageState: PlusWeeklyBriefCoverageState = resolvePlusWeeklyBriefCoverageState({
    locale: weeklyContentLocale,
    sourceError: Boolean(savedRadarRes.error || interestRowsRes.error),
  });
  if (weeklyCoverageState === "unavailable") {
    weeklyCandidates = [];
  } else if (weeklyContentLocale !== "ko") {
    const weeklySourceRes = weeklySourceIds.length
      ? await supabase
          .from("memes")
          .select(WEEKLY_SOURCE_SELECT)
          .in("id", weeklySourceIds)
          .overrideTypes<WeeklySourceRow[], { merge: false }>()
      : { data: [] as WeeklySourceRow[], error: null };
    if (interestRowsRes.error || savedRadarRes.error || weeklySourceRes.error) {
      weeklyCoverageState = resolvePlusWeeklyBriefCoverageState({
        locale: weeklyContentLocale,
        sourceError: Boolean(savedRadarRes.error || interestRowsRes.error),
        localizedSourceError: Boolean(weeklySourceRes.error),
      });
      weeklyCandidates = [];
    } else {
      const savedIds = new Set(savedRadarItems.map((item) => item.id));
      const weeklySources: PlusWeeklyBriefSource[] = (weeklySourceRes.data ?? []).map((source) => ({
        ...source,
        source: savedIds.has(source.id) ? "saved" : "interest",
      }));
      const weeklyTranslationRes = weeklySourceIds.length
        ? await supabase
            .from("meme_translations")
            .select(WEEKLY_TRANSLATION_SELECT)
            .eq("locale", weeklyContentLocale)
            .eq("status", "reviewed")
            .in("meme_id", weeklySourceIds)
            .overrideTypes<PlusWeeklyBriefTranslation[], { merge: false }>()
        : { data: [] as PlusWeeklyBriefTranslation[], error: null };
      if (weeklyTranslationRes.error) {
        weeklyCoverageState = resolvePlusWeeklyBriefCoverageState({
          locale: weeklyContentLocale,
          sourceError: false,
          translationError: true,
        });
        weeklyCandidates = [];
      } else {
        const projection = buildPlusWeeklyBriefCandidates({
          locale: weeklyContentLocale,
          sources: weeklySources,
          translations: weeklyTranslationRes.data ?? [],
        });
        weeklyCoverageState = projection.state;
        weeklyCandidates = projection.candidates;
      }
    }
  }
  const weeklyWindow = kstDateWindow();
  const dailySignalSince = plusDailySignalSince();
  const weeklyCandidateIds = weeklyCandidates.map((candidate) => candidate.id);
  const admin = createAdminClient();
  const [weeklyMetricsRes, trendAlertsRes, dailySignalAlertsRes, contextAlertsRes] = await Promise.all([
    weeklyCandidateIds.length
      ? admin
          .from("meme_trend_metrics")
          .select("meme_id, date, trend_score")
          .in("meme_id", weeklyCandidateIds)
          .gte("date", weeklyWindow.from)
          .lte("date", weeklyWindow.to)
          .order("date", { ascending: true })
      : Promise.resolve({ data: [] as PlusWeeklyBriefMetric[], error: null }),
    entitlement.isPremium
      ? supabase
          .from("trend_alerts")
          .select("meme_id")
          .gte("created_at", `${weeklyWindow.from}T00:00:00+09:00`)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
    entitlement.isPremium
      ? supabase
          .from("trend_alerts")
          .select(
            "meme_id, kind, trend_score, created_at, memes!inner(id, short_id, slug, title, summary, description, origin, usage_note, caution, usage_examples, updated_at, lifecycle_status, moderation_status, safety_level)",
          )
          .in("kind", ["rising", "saved_rising"])
          .gte("created_at", dailySignalSince)
          .order("trend_score", { ascending: false })
          .limit(30)
          .overrideTypes<PlusDailySignalAlertRow[], { merge: false }>()
      : Promise.resolve({ data: [] as PlusDailySignalAlertRow[], error: null }),
    entitlement.isPremium
      ? supabase
          .from("plus_saved_context_alerts")
          .select("id, event_id, read_at, created_at")
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);
  const radar = buildSavedReuseRadar(savedRadarItems);
  const surfacedIds = new Set([
    ...radar.readyNow.map((item) => item.id),
    ...radar.checkContext.map((item) => item.id),
    ...radar.archive.map((item) => item.id),
    ...(trendAlertsRes.error ? [] : trendAlertsRes.data ?? []).map((alert) => alert.meme_id),
  ]);
  const weeklyBriefBase = buildPlusWeeklyDeltaBrief({
    candidates: weeklyCandidates,
    metrics: weeklyMetricsRes.error ? [] : (weeklyMetricsRes.data ?? []),
    excludedIds: surfacedIds,
    from: weeklyWindow.from,
    to: weeklyWindow.to,
  });
  const weeklyBrief = {
    ...weeklyBriefBase,
    emptyReason:
      weeklyCoverageState === "unavailable" || weeklyMetricsRes.error || trendAlertsRes.error
        ? ("unavailable" as const)
        : weeklyCoverageState === "empty-coverage"
          ? ("coverage_empty" as const)
          : weeklyBriefBase.emptyReason,
  };
  const contextAlertRows = contextAlertsRes.error ? [] : (contextAlertsRes.data ?? []);
  let databaseContextWatch: SavedContextWatchItem[] = [];
  const databaseContextKeys = new Set<string>();
  if (contextAlertRows.length > 0) {
    const eventIds = contextAlertRows.map((row) => row.event_id);
    const eventsRes = await supabase
      .from("meme_public_change_events")
      .select("id, meme_id, kind, locale, source_updated_at, created_at")
      .in("id", eventIds);
    const eventMemeIds = [...new Set((eventsRes.data ?? []).map((event) => event.meme_id))];
    const memesRes = eventMemeIds.length
      ? await supabase.from("memes").select("id, short_id, slug, title").in("id", eventMemeIds)
      : { data: [], error: null };
    if (!eventsRes.error && !memesRes.error) {
      const eventsById = new Map((eventsRes.data ?? []).map((event) => [event.id, event]));
      const memesById = new Map((memesRes.data ?? []).map((meme) => [meme.id, meme]));
      databaseContextWatch = contextAlertRows.flatMap((alert) => {
        const event = eventsById.get(alert.event_id);
        const meme = event ? memesById.get(event.meme_id) : null;
        if (!event || !meme || !isSavedContextWatchKind(event.kind)) return [];
        if (event.locale !== null && event.locale !== locale) return [];
        databaseContextKeys.add(`${event.meme_id}:${event.kind}:${event.locale ?? ""}`);
        return [
          {
            id: `${event.meme_id}:${alert.id}`,
            shortId: meme.short_id,
            slug: meme.slug,
            title: meme.title,
            kind: event.kind,
            locale: event.locale,
            changedAt: event.created_at,
            readAt: alert.read_at,
          },
        ];
      });
    }
  }
  const contextWatchItems = [
    ...databaseContextWatch,
    ...derivedContextWatch.filter(
      (item) => !databaseContextKeys.has(`${item.id}:${item.kind}:${item.locale ?? ""}`),
    ),
  ]
    .sort((left, right) => Date.parse(right.changedAt) - Date.parse(left.changedAt))
    .slice(0, SAVED_CONTEXT_WATCH_ITEM_LIMIT);
  const copy = PREMIUM_COPY[locale];
  const storedDailySignalLocale = dailySignalPreferenceRes.data?.locale ?? "";
  const dailySignalLocale: DailySignalLocale =
    preferredSignalLocale ??
    (isDailySignalLocale(storedDailySignalLocale)
      ? storedDailySignalLocale
      : isDailySignalLocale(locale)
        ? locale
        : "en");
  const contentLocale: DailySignalLocale =
    preferredSignalLocale ?? (isDailySignalLocale(locale) ? locale : "en");
  const dailySignalAlerts = dailySignalAlertsRes.error ? [] : (dailySignalAlertsRes.data ?? []);
  const dailySignalMemeIds = [...new Set(dailySignalAlerts.map((alert) => alert.meme_id))];
  const dailySignalTranslationsRes =
    entitlement.isPremium && dailySignalLocale !== "ko" && dailySignalMemeIds.length > 0
      ? await supabase
          .from("meme_translations")
          .select(
            "meme_id, locale, localized_slug, title, summary, description, origin, usage_note, caution, usage_examples, status, source_updated_at",
          )
          .eq("locale", dailySignalLocale)
          .eq("status", "reviewed")
          .in("meme_id", dailySignalMemeIds)
          .overrideTypes<PlusDailySignalTranslationRow[], { merge: false }>()
      : { data: [] as PlusDailySignalTranslationRow[], error: null };
  const dailySignalCandidates = buildPlusDailySignalCandidates(
    dailySignalLocale,
    dailySignalAlerts,
    dailySignalTranslationsRes.error ? [] : (dailySignalTranslationsRes.data ?? []),
  );
  const actionSignalTranslationsRes =
    entitlement.isPremium && contentLocale !== "ko" && dailySignalMemeIds.length > 0
      ? contentLocale === dailySignalLocale
        ? dailySignalTranslationsRes
        : await supabase
            .from("meme_translations")
            .select(
              "meme_id, locale, localized_slug, title, summary, description, origin, usage_note, caution, usage_examples, status, source_updated_at",
            )
            .eq("locale", contentLocale)
            .eq("status", "reviewed")
            .in("meme_id", dailySignalMemeIds)
            .overrideTypes<PlusDailySignalTranslationRow[], { merge: false }>()
      : { data: [] as PlusDailySignalTranslationRow[], error: null };
  const actionSignalCandidates = buildPlusDailySignalCandidates(
    contentLocale,
    dailySignalAlerts,
    actionSignalTranslationsRes.error ? [] : (actionSignalTranslationsRes.data ?? []),
  );
  const outcomeReplayItem = outcomeReplayShortId && outcomeReplayLocale
    ? await loadPlusOutcomeReplayItem({
        supabase,
        isPremium: entitlement.isPremium,
        fromDate: outcomeHistoryWindow.from,
        toDate: outcomeHistoryWindow.to,
        shortId: outcomeReplayShortId,
        locale: outcomeReplayLocale,
      })
    : null;
  const actionFulfillment =
    translationFulfillmentRes.status === "locked"
      ? { status: "empty" as const, items: [] }
      : translationFulfillmentRes;
  const globalScout = entitlement.isPremium
    ? await loadPlusGlobalScout({
        supabase,
        isPremium: true,
        locale: contentLocale,
        interests,
      })
    : null;
  const actionInboxInput: PlusGlobalActionInboxInput | null = entitlement.isPremium
    ? {
        locale: contentLocale,
        fulfillment: actionFulfillment,
        signals: actionSignalCandidates,
        signalStatus:
          dailySignalAlertsRes.error || actionSignalTranslationsRes.error
            ? "unavailable"
            : "available",
        scout: globalScout ?? { status: "empty", dateKey: "", items: [] },
        completion: actionCompletionRes,
        preferredMemeId:
          outcomeReplayItem?.memeId ?? globalDailyActionCandidate?.memeId ?? preferredMemeId,
        replayItem: outcomeReplayItem ?? undefined,
        globalDailyCandidate: globalDailyActionCandidate,
      }
    : null;
  const trustedActionEvidence = actionInboxInput
    ? await exportPlusTrustedEvidenceSet({
        supabase: supabase as unknown as PlusTrustedEvidenceSupabase,
        dateKey: actionInboxInput.scout.dateKey,
        inbox: actionInboxInput,
        knownTrustedMemeIds: globalScout
          ? trustedPlusGlobalScoutMemeIds(globalScout)
          : [],
      })
    : null;
  const actionInbox = actionInboxInput
    ? buildTrustedPlusGlobalActionInbox({
        input: actionInboxInput,
        trustedMemeIds:
          trustedActionEvidence?.status === "unavailable"
            ? null
            : (trustedActionEvidence?.items ?? []).map((item) => item.memeId),
      })
    : null;
  const globalDailyPromotionEntrySource =
    globalDailyActionCandidate && actionInbox?.items[0]?.memeId === globalDailyActionCandidate.memeId
      ? "global_daily"
      : undefined;
  const savedRevisitNextMoveItems =
    entitlement.isPremium &&
    actionInbox?.status === "empty" &&
    actionInbox.completion.status === "available" &&
    !savedRadarRes.error
      ? await buildSavedRevisitNextMoveItems(radar.readyNow, contentLocale)
      : [];
  const nextMoveItems =
    actionInbox?.status === "empty" ? savedRevisitNextMoveItems : (actionInbox?.items ?? []);
  const resultEvidence =
    outcomeHistoryRes.status === "ready"
      ? {
          status: "ready" as const,
          count: outcomeHistoryRes.items.filter((item) => Boolean(item.resultUrl)).length,
        }
      : { status: outcomeHistoryRes.status, count: 0 };
  const winningReplay = outcomeReplayItem
    ? null
    : buildPlusOutcomeWinningReplay(outcomeSummaryRes, outcomeHistoryRes, actionCompletionRes);
  const primaryMission = resolvePremiumPrimaryMission({
    actionInboxStatus: actionInbox?.status ?? "empty",
    globalDailyState: globalDailyChallengeRes?.state ?? "locked",
    outcomeSummaryStatus: outcomeSummaryRes.status,
  });

  return (
    <>
      {/* 결제 복귀 폴링 — ?checkout=return일 때만 나타난다. useSearchParams라 Suspense 필요 */}
      <Suspense fallback={null}>
        <CheckoutReturnStatus
          initiallyPremium={entitlement.isPremium}
          locale={locale}
          copy={{
            confirming: copy.dashboard.checkoutConfirming,
            confirmed: copy.dashboard.checkoutConfirmed,
            timeout: copy.dashboard.checkoutTimeout,
            startOneCut: copy.dashboard.startOneCut,
          }}
        />
      </Suspense>
      <PremiumDashboardContent
        isPremium={entitlement.isPremium}
        status={entitlement.status}
        currentPeriodEnd={entitlement.currentPeriodEnd}
        feed={
          entitlement.isPremium ? (
            <MyFeed interests={interests} locale={locale} isPremium />
          ) : null
        }
        dailySignal={
          entitlement.isPremium ? (
            <PlusDailySignal candidates={dailySignalCandidates} locale={dailySignalLocale} />
          ) : null
        }
        globalScout={
          entitlement.isPremium && globalScout ? (
            <PlusGlobalScout
              locale={contentLocale}
              displayLocale={locale}
              status={globalScout.status}
              items={globalScout.items}
              dateKey={globalScout.dateKey}
            />
          ) : null
        }
        globalDailyChallenge={
          entitlement.isPremium && globalDailyChallengeRes ? (
            <GlobalDailyChallenge
              locale={globalDailyChallengeRes.locale}
              displayLocale={locale}
              challengeDate={globalDailyChallengeRes.challengeDate}
              state={globalDailyChallengeRes.state}
              questions={globalDailyChallengeRes.questions}
              currentStreak={globalDailyChallengeRes.currentStreak}
              showReviewShelf
              oneCutHandoffByMemeId={globalDailyOneCutHandoffs}
              marketPassport={
                globalDailyPassport?.dataStatus === "reviewed" ? (
                  <MemeMarketPassport
                    passport={globalDailyPassport}
                    locale={globalDailyChallengeRes.locale}
                  />
                ) : null
              }
            />
          ) : null
        }
        outcomeSnapshot={
          entitlement.isPremium ? (
            <PlusOutcomeSnapshot
              summary={outcomeSummaryRes}
              completion={actionCompletionRes}
              ratings={outcomeRatingsRes.rows}
              resultEvidence={resultEvidence}
              ratingsStatus={
                outcomeRatingsRes.status === "unavailable"
                  ? "unavailable"
                  : outcomeRatingsRes.status === "ready"
                    ? "ready"
                    : "empty"
              }
              copy={getPlusOutcomeSnapshotCopy(locale)}
              outcomeCopy={PLUS_OUTCOME_COPY[locale]}
              winningReplay={winningReplay}
            />
          ) : null
        }
        outcomeHistory={
          <PlusOutcomeHistory
            history={outcomeHistoryRes}
            locale={locale}
            activeReplay={
              outcomeReplayItem && outcomeReplayShortId && outcomeReplayLocale
                ? { shortId: outcomeReplayShortId, locale: outcomeReplayLocale }
                : null
            }
          />
        }
        actionInbox={
          entitlement.isPremium && actionInbox ? (
            <PlusGlobalActionInbox
              result={actionInbox}
              copy={copy.dashboard.actionInbox}
              mode="one_cut"
              outcomeSummary={outcomeSummaryRes}
              outcomeFollowUps={outcomeFollowUpsRes}
              outcomeCopy={PLUS_OUTCOME_COPY[locale]}
              nextMove={{
                items: nextMoveItems,
                ratings: outcomeRatingsRes.rows,
                ratingsStatus: outcomeRatingsRes.status === "unavailable" ? "unavailable" : "available",
              }}
              nextMoveCopy={PLUS_NEXT_MOVE_COPY[locale]}
              entrySource={
                outcomeReplayItem
                  ? "outcome_history"
                  : globalDailyPromotionEntrySource ?? dailySignalEntrySource
              }
              displayLocale={locale}
            />
          ) : null
        }
        primaryMission={primaryMission}
        dailySignalSettings={
          entitlement.isPremium ? (
            <PlusDailySignalSettings
              enabled={dailySignalPreferenceRes.data?.enabled ?? false}
              preferredLocale={dailySignalLocale}
            />
          ) : null
        }
        translationFulfillment={
          entitlement.isPremium && translationFulfillmentRes.status !== "locked" ? (
            <PlusTranslationFulfillmentCenter
              fulfillment={translationFulfillmentRes}
              locale={locale}
              copy={copy.translationFulfillment}
            />
          ) : null
        }
        history={history}
        savedMemeCount={savedMemes.count ?? 0}
        weeklyBrief={
          <PlusWeeklyDeltaBrief
            brief={weeklyBrief}
            locale={locale}
            contentLocale={weeklyContentLocale}
          />
        }
        plusActionQueue={
          entitlement.isPremium ? (
            <PlusActionQueue
              items={savedRadarItems}
              savedCount={savedMemes.count ?? 0}
              locale={locale}
            />
          ) : null
        }
        savedReuseRadar={
          entitlement.isPremium ? (
            <SavedReuseRadar items={savedRadarItems} locale={locale} />
            ) : null
        }
        savedContextWatch={
          entitlement.isPremium ? (
            <PlusSavedContextWatch
              items={contextWatchItems}
              locale={locale}
              savedCount={savedMemes.count ?? 0}
            />
          ) : null
        }
      />
    </>
  );
}
