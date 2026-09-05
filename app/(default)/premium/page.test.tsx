import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const fixtures = vi.hoisted(() => {
  const queryResult = { data: [], error: null, count: 0 };
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    limit: vi.fn(() => query),
    range: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    maybeSingle: vi.fn(() => query),
    overrideTypes: vi.fn(() => query),
    then: (
      resolve: (value: typeof queryResult) => unknown,
      reject?: (reason: unknown) => unknown,
    ) => Promise.resolve(queryResult).then(resolve, reject),
  };
  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-1" } } })),
    },
    from: vi.fn(() => query),
  };

  return {
    query,
    supabase,
    getPremiumEntitlement: vi.fn(),
    listOwnUnifiPaymentHistory: vi.fn(async () => []),
    registerCurrentBillingIdentity: vi.fn(async () => undefined),
    getRequestLocale: vi.fn(async () => "en"),
    createClient: vi.fn(async () => supabase),
    loadGlobalDailyChallenge: vi.fn(),
    getMemeMarketPassport: vi.fn(),
    loadPlusOutcomeHistory: vi.fn(),
    loadPlusOutcomeReplayItem: vi.fn(),
    loadPlusOutcomeFollowUps: vi.fn(),
    loadPlusOutcomeRatings: vi.fn(),
    loadPlusOutcomeSummary: vi.fn(),
    parsePlusOutcomeReplayRequest: vi.fn(),
    buildPlusOutcomeReplayPath: vi.fn(),
    buildPlusGlobalActionInbox: vi.fn(),
    buildPlusActionPremiumPath: vi.fn(),
    loadPlusGlobalActionInboxCompletion: vi.fn(),
  };
});

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/my-feed", () => ({ MyFeed: () => null }));
vi.mock("@/components/premium/checkout-return-status", () => ({ CheckoutReturnStatus: () => null }));
vi.mock("@/components/premium/premium-dashboard-content", () => ({
  PremiumDashboardContent: () => null,
}));
vi.mock("@/components/premium/plus-action-queue", () => ({ PlusActionQueue: () => null }));
vi.mock("@/components/premium/plus-daily-signal", () => ({ PlusDailySignal: () => null }));
vi.mock("@/components/premium/plus-weekly-delta-brief", () => ({ PlusWeeklyDeltaBrief: () => null }));
vi.mock("@/components/premium/saved-reuse-radar", () => ({ SavedReuseRadar: () => null }));
vi.mock("@/components/premium/plus-saved-context-watch", () => ({ PlusSavedContextWatch: () => null }));
vi.mock("@/components/premium/plus-daily-signal-settings", () => ({ PlusDailySignalSettings: () => null }));
vi.mock("@/components/premium/plus-global-scout", () => ({ PlusGlobalScout: () => null }));
vi.mock("@/components/premium/plus-global-action-inbox", () => ({ PlusGlobalActionInbox: () => null }));
vi.mock("@/components/premium/plus-outcome-snapshot", () => ({
  getPlusOutcomeSnapshotCopy: () => ({}),
  PlusOutcomeSnapshot: () => null,
}));
vi.mock("@/components/premium/plus-outcome-history", () => ({ PlusOutcomeHistory: () => null }));
vi.mock("@/components/premium/plus-translation-fulfillment-center", () => ({
  PlusTranslationFulfillmentCenter: () => null,
}));
vi.mock("@/components/premium/global-daily-challenge", () => ({
  GlobalDailyChallenge: () => null,
}));

vi.mock("@/lib/i18n-premium", () => {
  const copy = {
    dashboard: {
      checkoutConfirming: "confirming",
      checkoutConfirmed: "confirmed",
      checkoutTimeout: "timeout",
      startOneCut: "start",
      actionInbox: {},
    },
    translationFulfillment: {},
  };
  return { PREMIUM_COPY: { en: copy, th: copy } };
});
vi.mock("@/lib/billing/repository.server", () => ({
  getPremiumEntitlement: fixtures.getPremiumEntitlement,
  listOwnUnifiPaymentHistory: fixtures.listOwnUnifiPaymentHistory,
  registerCurrentBillingIdentity: fixtures.registerCurrentBillingIdentity,
}));
vi.mock("@/lib/i18n-server", () => ({ getRequestLocale: fixtures.getRequestLocale }));
vi.mock("@/lib/meme-translations", () => ({ getLocalizedMemeByShortId: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => fixtures.supabase,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: fixtures.createClient }));
vi.mock("@/lib/labels", () => ({ CATEGORIES: {} }));
vi.mock("@/lib/saved-reuse-radar", () => ({
  SAVED_REUSE_RADAR_CANDIDATE_LIMIT: 20,
  buildSavedReuseRadar: () => ({ readyNow: [], checkContext: [], archive: [] }),
}));
vi.mock("@/lib/plus-localized-feed", () => ({
  resolvePlusContentLocale: (locale: string) =>
    ["ko", "en", "ja", "zh", "zh-tw"].includes(locale) ? locale : "en",
}));
vi.mock("@/lib/plus-weekly-brief", () => ({
  buildPlusWeeklyBriefCandidates: () => ({ state: "empty-coverage", candidates: [] }),
  buildPlusWeeklyDeltaBrief: () => ({ items: [], emptyReason: "no_candidates" }),
  kstDateWindow: () => ({ from: "2026-08-01", to: "2026-08-10" }),
  resolvePlusWeeklyBriefCoverageState: () => "empty-coverage",
}));
vi.mock("@/lib/saved-context-watch", () => ({
  SAVED_CONTEXT_WATCH_ITEM_LIMIT: 20,
  buildSavedContextWatch: () => [],
  isSavedContextWatchKind: () => false,
}));
vi.mock("@/lib/plus-daily-signal-delivery.server", () => ({
  buildPlusDailySignalCandidates: () => [],
  isDailySignalLocale: (value: string) => ["ko", "en", "ja", "zh", "zh-tw"].includes(value),
}));
vi.mock("@/lib/plus-daily-signal.server", () => ({ plusDailySignalSince: () => "2026-08-01T00:00:00.000Z" }));
vi.mock("@/lib/plus-global-action-inbox", () => ({
  buildPlusGlobalActionInbox: fixtures.buildPlusGlobalActionInbox,
}));
vi.mock("@/lib/plus-global-action-inbox.server", () => ({
  loadPlusGlobalActionInboxCompletion: fixtures.loadPlusGlobalActionInboxCompletion,
}));
vi.mock("@/lib/plus-outcome-ledger.server", () => ({
  loadPlusOutcomeHistory: fixtures.loadPlusOutcomeHistory,
  loadPlusOutcomeReplayItem: fixtures.loadPlusOutcomeReplayItem,
  loadPlusOutcomeFollowUps: fixtures.loadPlusOutcomeFollowUps,
  loadPlusOutcomeRatings: fixtures.loadPlusOutcomeRatings,
  loadPlusOutcomeSummary: fixtures.loadPlusOutcomeSummary,
  plusOutcomeHistoryDateWindow: () => ({ from: "2026-08-01", to: "2026-08-10" }),
}));
vi.mock("@/lib/plus-outcome-copy", () => ({ PLUS_OUTCOME_COPY: { en: {} } }));
vi.mock("@/lib/plus-next-move-copy", () => ({ PLUS_NEXT_MOVE_COPY: { en: {} } }));
vi.mock("@/lib/plus-next-move", () => ({
  plusNextMoveDateWindow: () => ({ from: "2026-08-01", to: "2026-08-10" }),
  projectSavedRevisitNextMoveItem: () => null,
}));
vi.mock("@/lib/plus-global-scout.server", () => ({
  loadPlusGlobalScout: vi.fn(async () => ({ status: "empty", dateKey: "", items: [] })),
}));
vi.mock("@/lib/plus-translation-fulfillment.server", () => ({
  loadPlusTranslationFulfillment: vi.fn(async () => ({ status: "empty", items: [] })),
}));
vi.mock("@/lib/plus-outcome-replay-routing", () => ({
  buildPlusOutcomeReplayPath: fixtures.buildPlusOutcomeReplayPath,
  parsePlusOutcomeReplayRequest: fixtures.parsePlusOutcomeReplayRequest,
}));
vi.mock("@/lib/plus-daily-signal-routing", () => ({
  buildPlusDailySignalPremiumPath: () => "/premium",
  buildPlusActionPremiumPath: fixtures.buildPlusActionPremiumPath,
  parsePlusActionPremiumSource: (value: string | string[] | undefined) =>
    typeof value === "string" && ["daily_signal", "global_daily"].includes(value) ? value : null,
  parsePlusDailySignalLocale: (value: string | string[] | undefined) => {
    return typeof value === "string" && ["ko", "en", "ja", "zh", "zh-tw"].includes(value)
      ? value
      : null;
  },
  parsePlusDailySignalFocus: (value: string | string[] | undefined) => {
    return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
  },
  parsePlusDailySignalSource: (value: string | string[] | undefined) =>
    value === "daily_signal" ? "daily_signal" : null,
}));
vi.mock("@/lib/global-daily-challenge.server", () => ({
  loadGlobalDailyChallenge: fixtures.loadGlobalDailyChallenge,
}));
vi.mock("@/lib/meme-market-passport.server", () => ({
  getMemeMarketPassport: fixtures.getMemeMarketPassport,
}));

import PremiumPage from "@/app/(default)/premium/page";

function entitlement(isPremium: boolean) {
  return {
    signedIn: true,
    isPremium,
    status: isPremium ? "active" : "none",
    currentPeriodEnd: null,
  };
}

describe("PremiumPage Global Daily loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fixtures.loadPlusOutcomeHistory.mockResolvedValue({ status: "empty", items: [], pendingCount: 0 });
    fixtures.loadPlusOutcomeReplayItem.mockResolvedValue(null);
    fixtures.loadPlusOutcomeFollowUps.mockResolvedValue({ status: "empty", items: [], pendingCount: 0 });
    fixtures.loadPlusOutcomeRatings.mockResolvedValue({ status: "empty", rows: [] });
    fixtures.loadPlusOutcomeSummary.mockResolvedValue({ status: "empty" });
    fixtures.parsePlusOutcomeReplayRequest.mockReturnValue(null);
    fixtures.buildPlusOutcomeReplayPath.mockReturnValue(null);
    fixtures.buildPlusActionPremiumPath.mockImplementation(
      (memeId: string, locale: string | undefined, source: string) =>
        `/premium?focus=${memeId}&locale=${locale ?? ""}&from=${source}`,
    );
    fixtures.buildPlusGlobalActionInbox.mockReturnValue({
      status: "empty",
      items: [],
      unavailableLanes: [],
      completion: {
        status: "available",
        completedMemeIds: [],
        completedTodayCount: 0,
        currentStreak: 0,
      },
    });
    fixtures.loadPlusGlobalActionInboxCompletion.mockResolvedValue({
      status: "available",
      completedMemeIds: [],
      completedTodayCount: 0,
      currentStreak: 0,
    });
    fixtures.getPremiumEntitlement.mockResolvedValue(entitlement(false));
    fixtures.loadGlobalDailyChallenge.mockResolvedValue({
      state: "completed",
      challengeDate: "2026-08-10",
      locale: "en",
      questions: [
        {
          question: "What does this mean?",
          options: ["One", "Two", "Three", "Four"],
          answerIndex: 0,
          meme: {
            id: "meme-1",
            shortId: "meme-1",
            slug: "meme-one",
            title: "Meme One",
            originYear: 2026,
            safetyLevel: "green",
          },
        },
        {
          question: "What does this mean?",
          options: ["One", "Two", "Three", "Four"],
          answerIndex: 0,
          meme: {
            id: "meme-2",
            shortId: "meme-2",
            slug: "meme-two",
            title: "Meme Two",
            originYear: 2026,
            safetyLevel: "yellow",
          },
        },
        {
          question: "What does this mean?",
          options: ["One", "Two", "Three", "Four"],
          answerIndex: 0,
          meme: {
            id: "meme-3",
            shortId: "meme-3",
            slug: "meme-three",
            title: "Meme Three",
            originYear: 2026,
            safetyLevel: "green",
          },
        },
      ],
      candidates: [
        {
          id: "meme-1",
          shortId: "meme-1",
          category: "phrase",
          originYear: 2026,
          safetyLevel: "green",
          lifecycleStatus: "active",
          updatedAt: "2026-08-10T00:00:00.000Z",
          locales: {
            ko: { slug: "meme-one", title: "Meme One", summary: "Korean summary", description: "Korean description", origin: "Korean origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            en: { slug: "meme-one", title: "Meme One", summary: "English summary", description: "English description", origin: "English origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            ja: { slug: "meme-one", title: "Meme One", summary: "Japanese summary", description: "Japanese description", origin: "Japanese origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            zh: { slug: "meme-one", title: "Meme One", summary: "Chinese summary", description: "Chinese description", origin: "Chinese origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            "zh-tw": { slug: "meme-one", title: "Meme One", summary: "Traditional Chinese summary", description: "Traditional Chinese description", origin: "Traditional Chinese origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
          },
        },
        {
          id: "meme-2",
          shortId: "meme-2",
          category: "phrase",
          originYear: 2026,
          safetyLevel: "yellow",
          lifecycleStatus: "rising",
          updatedAt: "2026-08-10T00:00:00.000Z",
          locales: {
            ko: { slug: "meme-two", title: "Meme Two", summary: "Korean summary", description: "Korean description", origin: "Korean origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            en: { slug: "meme-two", title: "Meme Two", summary: "English summary", description: "English description", origin: "English origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            ja: { slug: "meme-two", title: "Meme Two", summary: "Japanese summary", description: "Japanese description", origin: "Japanese origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            zh: { slug: "meme-two", title: "Meme Two", summary: "Chinese summary", description: "Chinese description", origin: "Chinese origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            "zh-tw": { slug: "meme-two", title: "Meme Two", summary: "Traditional Chinese summary", description: "Traditional Chinese description", origin: "Traditional Chinese origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
          },
        },
        {
          id: "meme-3",
          shortId: "meme-3",
          category: "phrase",
          originYear: 2026,
          safetyLevel: "green",
          lifecycleStatus: "active",
          updatedAt: "2026-08-10T00:00:00.000Z",
          locales: {
            ko: { slug: "meme-three", title: "Meme Three", summary: "Korean summary", description: "Korean description", origin: "Korean origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            en: { slug: "meme-three", title: "Meme Three", summary: "English summary", description: "English description", origin: "English origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            ja: { slug: "meme-three", title: "Meme Three", summary: "Japanese summary", description: "Japanese description", origin: "Japanese origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            zh: { slug: "meme-three", title: "Meme Three", summary: "Chinese summary", description: "Chinese description", origin: "Chinese origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
            "zh-tw": { slug: "meme-three", title: "Meme Three", summary: "Traditional Chinese summary", description: "Traditional Chinese description", origin: "Traditional Chinese origin", source_updated_at: "2026-08-10T00:00:00.000Z" },
          },
        },
      ],
      completedAt: "2026-08-10T00:00:00.000Z",
      completionLocale: "en",
      currentStreak: 0,
    });
    fixtures.getMemeMarketPassport.mockResolvedValue({
      dataStatus: "reviewed",
      origin: {
        memeId: "meme-1",
        marketCode: "KR",
        languageTag: "ko",
        role: "origin",
        localTitle: "Meme One",
        localAliases: [],
        usageNote: null,
        caution: null,
      },
      profiles: [],
      variants: [],
    });
  });

  it("does not load the challenge for a signed-in non-Premium account", async () => {
    await PremiumPage({ searchParams: Promise.resolve({}) });

    expect(fixtures.loadGlobalDailyChallenge).not.toHaveBeenCalled();
  });

  it("loads the challenge once for an active Premium account", async () => {
    fixtures.getPremiumEntitlement.mockResolvedValue(entitlement(true));

    const page = await PremiumPage({ searchParams: Promise.resolve({}) });

    expect(fixtures.loadGlobalDailyChallenge).toHaveBeenCalledOnce();
    expect(fixtures.loadGlobalDailyChallenge).toHaveBeenCalledWith("en");
    expect(fixtures.getMemeMarketPassport).toHaveBeenCalledOnce();
    expect(fixtures.getMemeMarketPassport).toHaveBeenCalledWith("meme-1", "en");

    type ElementLike = { props?: Record<string, unknown> };
    const children = (page as ElementLike).props?.children;
    const dashboard = Array.isArray(children) ? (children[1] as ElementLike | undefined) : undefined;
    const challenge = dashboard?.props?.globalDailyChallenge as ElementLike | null | undefined;
    expect(challenge?.props?.showReviewShelf).toBe(true);
  });

  it("keeps UI-only locales separate from the reviewed content locale", async () => {
    fixtures.getRequestLocale.mockResolvedValue("th");
    fixtures.getPremiumEntitlement.mockResolvedValue(entitlement(true));

    const page = await PremiumPage({ searchParams: Promise.resolve({}) });

    expect(fixtures.loadGlobalDailyChallenge).toHaveBeenCalledWith("en");
    type ElementLike = { props?: Record<string, unknown> };
    const children = (page as ElementLike).props?.children;
    const dashboard = Array.isArray(children) ? (children[1] as ElementLike | undefined) : undefined;
    const challenge = dashboard?.props?.globalDailyChallenge as ElementLike | null | undefined;
    const scout = dashboard?.props?.globalScout as ElementLike | null | undefined;
    expect(challenge?.props?.locale).toBe("en");
    expect(challenge?.props?.displayLocale).toBe("th");
    expect(scout?.props?.locale).toBe("en");
    expect(scout?.props?.displayLocale).toBe("th");
    expect(fixtures.getMemeMarketPassport).toHaveBeenCalledWith("meme-1", "en");
  });

  it("suppresses the winning promotion and marks the locale-qualified replay as active", async () => {
    fixtures.getRequestLocale.mockResolvedValue("en");
    fixtures.getPremiumEntitlement.mockResolvedValue(entitlement(true));
    fixtures.parsePlusOutcomeReplayRequest.mockReturnValue({ shortId: "meme-1", locale: "ja" });
    fixtures.buildPlusOutcomeReplayPath.mockReturnValue(
      "/premium?replay=meme-1&replay_locale=ja&from=outcome_history",
    );
    fixtures.loadPlusOutcomeSummary.mockResolvedValue({
      status: "ready",
      fromDate: "2026-08-04",
      toDate: "2026-08-10",
      timezone: "Asia/Seoul",
      totalReceipts: 1,
      totalCompletions: 1,
      pendingReceiptCount: 0,
      awaitingPerformanceCount: 0,
      byChannel: [{ key: "threads", count: 1 }],
      byLocale: [{ key: "ja", count: 1 }],
      byArtifactKind: [{ key: "caption", count: 1 }],
    });
    fixtures.loadPlusOutcomeHistory.mockResolvedValue({
      status: "ready",
      pendingCount: 0,
      items: [
        {
          receiptId: "private-receipt",
          completionDate: "2026-08-10",
          title: "Japanese hit",
          channel: "threads",
          locale: "ja",
          artifactKind: "caption",
          hasPerformanceNote: true,
          performanceRating: "hit",
          href: "/ja/memes/meme-1",
          linkStatus: "localized",
          replayShortId: "meme-1",
        },
      ],
    });
    fixtures.loadPlusOutcomeReplayItem.mockResolvedValue({
      id: "outcome-replay:meme-1",
      memeId: "private-meme-id",
      shortId: "meme-1",
      slug: "meme-one",
      title: "Japanese hit",
      summary: "Reviewed summary",
      locale: "ja",
      href: "/ja/memes/meme-1#meme-use-kit-title",
      shareText: "Japanese hit",
      kind: "outcome_replay",
      changedAt: null,
      trendScore: 10,
      preferredOutcomeChannel: "threads",
      creatorPackFacts: {
        title: "Japanese hit",
        summary: "Reviewed summary",
        usageNote: null,
        caution: null,
        safetyLevel: "green",
        lifecycleStatus: "active",
      },
    });

    const page = await PremiumPage({
      searchParams: Promise.resolve({
        replay: "meme-1",
        replay_locale: "ja",
        from: "outcome_history",
      }),
    });

    type ElementLike = { props?: Record<string, unknown> };
    const children = (page as ElementLike).props?.children;
    const dashboard = Array.isArray(children) ? (children[1] as ElementLike | undefined) : undefined;
    const snapshot = dashboard?.props?.outcomeSnapshot as ElementLike | null | undefined;
    const history = dashboard?.props?.outcomeHistory as ElementLike | null | undefined;
    expect(snapshot?.props?.winningReplay).toBeNull();
    expect(history?.props?.activeReplay).toEqual({ shortId: "meme-1", locale: "ja" });
  });

  it("accepts a Global Daily focus only when it matches the current question and content locale", async () => {
    fixtures.getPremiumEntitlement.mockResolvedValue(entitlement(true));
    fixtures.buildPlusGlobalActionInbox.mockImplementation((input: {
      globalDailyCandidate?: { memeId: string; locale: string };
    }) => ({
      status: input.globalDailyCandidate ? "active" : "empty",
      items: input.globalDailyCandidate
        ? [{ memeId: input.globalDailyCandidate.memeId, locale: input.globalDailyCandidate.locale }]
        : [],
      unavailableLanes: [],
      completion: {
        status: "available",
        completedMemeIds: [],
        completedTodayCount: 0,
        currentStreak: 0,
      },
    }));

    const accepted = await PremiumPage({
      searchParams: Promise.resolve({ focus: "meme-1", locale: "en", from: "global_daily" }),
    });

    type ElementLike = { props?: Record<string, unknown> };
    const acceptedChildren = (accepted as ElementLike).props?.children;
    const acceptedDashboard = Array.isArray(acceptedChildren)
      ? (acceptedChildren[1] as ElementLike | undefined)
      : undefined;
    const acceptedInbox = acceptedDashboard?.props?.actionInbox as ElementLike | null | undefined;
    expect(fixtures.loadGlobalDailyChallenge).toHaveBeenCalledWith("en");
    expect(fixtures.buildPlusGlobalActionInbox).toHaveBeenCalledWith(
      expect.objectContaining({
        preferredMemeId: "meme-1",
        globalDailyCandidate: expect.objectContaining({ memeId: "meme-1", locale: "en" }),
      }),
    );
    expect(acceptedInbox?.props?.entrySource).toBe("global_daily");

    fixtures.buildPlusGlobalActionInbox.mockClear();
    const completedChallenge = await fixtures.loadGlobalDailyChallenge("en");
    fixtures.loadGlobalDailyChallenge.mockResolvedValueOnce({
      ...completedChallenge,
      state: "ready",
    });
    const ready = await PremiumPage({
      searchParams: Promise.resolve({ focus: "meme-1", locale: "en", from: "global_daily" }),
    });
    const readyChildren = (ready as ElementLike).props?.children;
    const readyDashboard = Array.isArray(readyChildren)
      ? (readyChildren[1] as ElementLike | undefined)
      : undefined;
    const readyInbox = readyDashboard?.props?.actionInbox as ElementLike | null | undefined;
    expect(fixtures.buildPlusGlobalActionInbox).toHaveBeenCalledWith(
      expect.objectContaining({ preferredMemeId: undefined, globalDailyCandidate: undefined }),
    );
    expect(readyInbox?.props?.entrySource).not.toBe("global_daily");

    fixtures.buildPlusGlobalActionInbox.mockClear();
    await PremiumPage({
      searchParams: Promise.resolve({ focus: "meme-1", locale: "ja", from: "global_daily" }),
    });
    expect(fixtures.loadGlobalDailyChallenge).toHaveBeenLastCalledWith("ja");
    expect(fixtures.buildPlusGlobalActionInbox).toHaveBeenCalledWith(
      expect.objectContaining({ globalDailyCandidate: undefined }),
    );

    fixtures.buildPlusGlobalActionInbox.mockClear();
    await PremiumPage({
      searchParams: Promise.resolve({
        focus: ["meme-1", "meme-2"],
        locale: "en",
        from: "global_daily",
      }),
    });
    expect(fixtures.buildPlusGlobalActionInbox).toHaveBeenCalledWith(
      expect.objectContaining({ globalDailyCandidate: undefined }),
    );

    fixtures.buildPlusGlobalActionInbox.mockClear();
    fixtures.loadPlusGlobalActionInboxCompletion.mockResolvedValueOnce({
      status: "unavailable",
      completedMemeIds: [],
      completedTodayCount: 0,
      currentStreak: 0,
    });
    await PremiumPage({
      searchParams: Promise.resolve({ focus: "meme-1", locale: "en", from: "global_daily" }),
    });
    expect(fixtures.buildPlusGlobalActionInbox).toHaveBeenCalledWith(
      expect.objectContaining({ globalDailyCandidate: undefined }),
    );
  });
});
