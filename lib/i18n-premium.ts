import { withLocaleFallback, type Locale } from "@/lib/i18n";

export type PremiumCopy = {
  productName: "MemeCatch Plus";
  menuLabel: string;
  badge: string;
  pricing: {
    eyebrow: string;
    title: string;
    intro: string;
    monthly: string;
    perMonth: string;
    launchNote: string;
    checkout: string;
    sameEmail: string;
    freeName: string;
    plusName: string;
    /** 인터랙티브 기능 쇼케이스 섹션의 제목. */
    featuresTitle: string;
    comparisonTitle: string;
    features: ReadonlyArray<{
      label: string;
      free: string;
      plus: string;
      /** 인터랙티브 쇼케이스에서 카드 선택 시 펼쳐지는 상세 설명. */
      detail: string;
    }>;
  };
  dashboard: {
    eyebrow: string;
    activeTitle: string;
    activeBody: string;
    upgradeTitle: string;
    upgradeBody: string;
    viewPlans: string;
    membershipStatus: string;
    active: string;
    renews: string;
    extend: string;
    expiringSoon: (days: number) => string;
    billingHelp: string;
    syncNote: string;
    checkoutConfirming: string;
    checkoutConfirmed: string;
    checkoutTimeout: string;
    startOneCut: string;
    moreTools: string;
    primaryMissionUnavailable: { eyebrow: string; heading: string; body: string };
    historyTitle: string;
    historyEmpty: string;
    historyCanceled: string;
    savedMemeWatchTitle: string;
    savedMemeWatchDescription: (count: number) => string;
    savedMemeWatchEmpty: string;
    contextWatch: {
      eyebrow: string;
      title: string;
      summary: (count: number, unread: number) => string;
      emptyBody: (count: number) => string;
      markRead: string;
      marking: string;
      markedRead: string;
      markFailed: string;
      open: string;
      unread: string;
      kinds: Record<
        | "editorial_update"
        | "safety_update"
        | "translation_reviewed"
        | "translation_stale"
        | "lifecycle_update",
        string
      >;
    };
    actionInbox: {
      eyebrow: string;
      heading: string;
      body: string;
      contentLanguageLabel: string;
      outcome: {
        ready: (count: number) => string;
        prepared: (count: number) => string;
        complete: (count: number, currentStreak: number) => string;
      };
      open: string;
      copyAction: string;
      shareAction: string;
      completeAction: string;
      completing: string;
      completed: string;
      actionFailed: string;
      completionUnavailable: string;
      progress: (completedTodayCount: number, currentStreak: number) => string;
      kindLabels: Record<"outcome_replay" | "translation_ready" | "saved_signal" | "new_reviewed", string>;
      empty: { heading: string; body: string };
      unavailable: { heading: string; body: string };
      partialUnavailable: (count: number) => string;
      creatorPack: {
        title: string;
        body: string;
        exampleLabel: string;
        examplePreview: string;
        exampleUnavailable: string;
        includeMoreLabel: string;
        includeMoreDescription: string;
        create: string;
        channelRequired: string;
        recommended: (count: number) => string;
        preparing: string;
        shared: string;
        shareAgain: string;
        downloadAgain: string;
        reusable: (count: number) => string;
        fallback: string;
        downloaded: string;
        partial: (succeeded: number, failed: number) => string;
        error: string;
        empty: string;
        ready: (count: number) => string;
        complete: (count: number) => string;
        completing: string;
        completed: (count: number) => string;
        partialCompleted: (succeeded: number, failed: number) => string;
        completionError: string;
      };
    };
    actionQueue: {
      eyebrow: string;
      title: string;
      summary: (count: number) => string;
      emptyTitle: string;
      emptyBody: string;
      explore: string;
      useNow: { description: string; cta: string };
      checkContext: { description: string; cta: string };
      review: { description: string; cta: string };
    };
    weeklyBrief: {
      eyebrow: string;
      title: string;
      summary: (count: number) => string;
      window: (from: string, to: string) => string;
      sourceSaved: string;
      sourceInterest: string;
      openTrend: string;
      emptyNoCandidates: string;
      coverageEmpty: string;
      emptyInsufficientHistory: string;
      emptyNoChange: string;
      unavailable: string;
    };
    radar: {
      eyebrow: string;
      title: string;
      summary: (count: number) => string;
      openLibrary: string;
      emptyTitle: string;
      emptyBody: string;
      explore: string;
      readyNow: { title: string; description: string; empty: string };
      checkContext: { title: string; description: string; empty: string };
      archive: { title: string; description: string; empty: string };
      lifecycle: Record<"rising" | "active" | "cooling" | "archived", string>;
    };
  };
  feed: {
    personalRadar: string;
    fresh: string;
    editInterests: string;
    setInterests: string;
    fallback: string;
    englishContent: string;
    localizedEmpty: string;
    localizedUnavailable: string;
    empty: string;
    explore: string;
  };
  trend: {
    title: string;
    plusBadge: string;
    failed: string;
    lockedDescription: string;
    lockedBadge: string;
    loginToView: string;
    upgradeToView: string;
    noData: string;
    metricTrendScore: string;
    metricViews: string;
    metricReactions: string;
    current: string;
    periodHigh: string;
    change: string;
    windowSummary: (days: number) => string;
    observedUp: string;
    observedDown: string;
    observedFlat: string;
    observedInsufficient: string;
    observedBasis: string;
    observedEvidence: (start: number, end: number, views: number, reactions: number, saves: number) => string;
    sampleCoverage: (samples: number, days: number, percent: number) => string;
    confidenceHigh: string;
    confidenceMedium: string;
    confidenceLow: string;
    confidenceInsufficient: string;
    lastObserved: (date: string) => string;
    lastObservedUnavailable: string;
    chartLabel: (metric: string, start: string, end: string, current: number, high: number) => string;
  };
  alerts: {
    buttonLabel: string;
    title: string;
    plusBadge: string;
    loading: string;
    empty: string;
    manageInterests: string;
    categoryRising: string;
    savedRising: string;
    unread: string;
  };
  kit: {
    eyebrow: string;
    title: string;
    description: string;
    plusBadge: string;
    lockedTitle: string;
    lockedBody: string;
    upgrade: string;
    open: string;
    copyAll: string;
    shareAll: string;
    copied: string;
    shared: string;
    prepared: string;
    copy: string;
    copyFailed: string;
    sourceNote: string;
    explainTitle: string;
    captionTitle: string;
    safetyTitle: string;
    safetyLabel: string;
    usageLabel: string;
    cautionLabel: string;
    trendLabel: string;
    noGuidance: string;
    safety: Record<"green" | "yellow" | "gray" | "red", string>;
    lifecycle: Record<"rising" | "active" | "cooling" | "archived", string>;
  };
  translationPriority: {
    eyebrow: string;
    title: string;
    body: string;
    saveRequired: string;
    request: string;
    requesting: string;
      requested: string;
      inReview: string;
      track: string;
      completed: string;
    alreadyAvailable: string;
    upgrade: string;
    retry: string;
  };
  translationFulfillment: {
    heading: string;
    body: string;
    statusLabels: Record<"requested" | "in_review" | "ready" | "stale" | "source_incomplete" | "dismissed", string>;
    timestampLabels: Record<"requested" | "in_review" | "ready" | "stale" | "source_incomplete" | "dismissed", string>;
    openLink: string;
    empty: { heading: string; body: string };
    unavailable: { heading: string; body: string };
  };
  save: {
    loginGate: string;
    savedButton: string;
    saveButton: string;
    saved: string;
    removed: string;
    retry: string;
    limitReached: string;
    upgrade: string;
  };
  my: {
    unlimited: string;
    freeLimit: (count: number, limit: number) => string;
    paginationLabel: string;
    previousPage: string;
    nextPage: string;
    pageStatus: (page: number, total: number) => string;
  };
};

const PREMIUM_COPY_BASE = {
  ko: {
    productName: "MemeCatch Plus",
    menuLabel: "MemeCatch Plus",
    badge: "PLUS",
    pricing: {
      eyebrow: "검수형 밈 활용 도구",
      title: "오늘 게시할 밈 3개와 플랫폼별 문구를 받으세요",
      intro: "관심 분야에 맞는 밈, 회사·브랜드 계정 안전성, 급상승 알림까지 한곳에서 확인하세요.",
      monthly: "$10",
      perMonth: "USD / 30일",
      launchNote: "30일 이용권 · 자동 갱신 없음 · 잔여기간 보존 · Kaia USDT 결제",
      checkout: "MemeCatch Plus 시작하기",
      sameEmail: "결제 금액은 $10 USD이며 Unifi Wallet의 Kaia USDT로 결제합니다. 남은 이용기간이 있으면 그 뒤로 30일 연장되고, 환불은 지원 문의 후 원결제 지갑으로 수동 처리됩니다.",
      freeName: "무료",
      plusName: "Plus",
      featuresTitle: "Plus로 무엇이 열리나요?",
      comparisonTitle: "무료로 충분히 둘러보고, 필요할 때 업그레이드하세요",
      features: [
        {
          label: "밈 뜻·유래·출처 확인",
          free: "포함",
          plus: "포함",
          detail:
            "모든 밈의 뜻·유래·출처는 무료로도 언제나 열람할 수 있어요. Plus를 구독해도 이 기본 사전 기능은 그대로 유지돼요.",
        },
        {
          label: "관심사 맞춤 트렌드 레이더",
          free: "이용 불가",
          plus: "전체 이용",
          detail:
            "관심사를 골라두면 지금 뜨는 밈을 개인화된 트렌드 레이더로 모아 보여줘요. Plus에서 레이더 전체가 열려요.",
        },
        {
          label: "밈 저장·재사용 레이더",
          free: "10개",
          plus: "무제한 + 재사용 레이더",
          detail:
            "마음에 든 밈을 저장해 두고 나중에 다시 찾아봐요. Plus는 무제한 저장은 물론 현재 유행과 사용 신호로 다시 꺼내볼 수 있어요.",
        },
        {
          label: "광고 없는 경험",
          free: "광고 표시",
          plus: "광고 없음",
          detail:
            "무료에서는 하단 배너와 자동 광고가 표시돼요. Plus를 구독하면 사이트 전체에서 광고가 사라져 밈에만 집중할 수 있어요.",
        },
        {
          label: "밈 활용 팩",
          free: "잠금 미리보기",
          plus: "설명·게시·안전 문구 복사",
          detail:
            "검수된 뜻·사용 안내·주의·유행 상태를 설명용, 게시용, 안전 체크용 문구로 묶어 바로 복사할 수 있어요. 새로운 사실을 만들어내지 않고 확인된 정보만 사용해요.",
        },
        {
          label: "Plus Daily Signal 이메일",
          free: "이용 불가",
          plus: "하루 1회 · 저장 밈 우선",
          detail:
            "명시적으로 동의하면 매일 한 번 저장한 밈의 급상승과 관심사 신호를 이메일로 받아요. 검수된 콘텐츠와 현재 신호만 넣고, 수신 언어도 선택할 수 있어요.",
        },
        {
          label: "Global Meme Daily",
          free: "잠금 미리보기",
          plus: "매일 3문제 + 연속 기록",
          detail:
            "한국어 원문과 영어·일본어·중국어 번역이 모두 현재 검수된 밈만 골라 매일 3문제로 익히고 연속 기록을 쌓아요.",
        },
      ],
    },
    dashboard: {
      eyebrow: "MY PLUS",
      activeTitle: "오늘의 한 컷을 바로 완성하세요",
      activeBody: "검수된 밈 한 장을 골라 게시용 카드로 준비하고, 실제 사용 결과까지 기록할 수 있어요.",
      upgradeTitle: "오늘 쓸 검수 밈 한 장부터 시작하세요",
      upgradeBody: "MemeCatch Plus에서 오늘의 한 컷을 고르고, 준비하고, 사용 기록까지 이어가세요.",
      viewPlans: "Plus 요금제 보기",
      membershipStatus: "멤버십 상태",
      active: "이용 중",
      renews: "이용 확인 기한",
      extend: "이용 연장하기",
      expiringSoon: (days: number) => days <= 0 ? "오늘 만료돼요. 지금 연장하면 이어서 쓸 수 있어요." : `${days}일 뒤 만료돼요. 미리 연장해 두세요.`,
      billingHelp: "취소·환불 문의",
      syncNote: "구매 직후 연결까지 잠시 걸릴 수 있어요. 같은 이메일을 사용했는지 확인해 주세요.",
      checkoutConfirming: "결제를 확인하고 있어요… 웹훅 도착까지 잠시 걸릴 수 있어요.",
      checkoutConfirmed: "결제가 확인됐어요! Plus 이용이 시작됐습니다.",
      checkoutTimeout: "아직 결제 확인이 도착하지 않았어요. 잠시 뒤 새로고침해 주세요 — 결제는 안전하게 처리 중이에요.",
      startOneCut: "첫 활용 시작하기",
      moreTools: "더 많은 Plus 도구",
      primaryMissionUnavailable: {
        eyebrow: "PLUS 상태",
        heading: "지금 시작할 주 행동을 확인하지 못했어요",
        body: "행동함·Global Daily·활용 결과를 불러오지 못했어요. 잠시 후 다시 열어 주세요.",
      },
      historyTitle: "결제 이력",
      historyEmpty: "아직 결제 이력이 없어요.",
      historyCanceled: "취소됨",
      savedMemeWatchTitle: "저장한 밈 급상승 알림",
      savedMemeWatchDescription: (count) => `저장한 밈 ${count}개를 지켜보고 있어요. 급상승하면 알림으로 알려드려요.`,
      savedMemeWatchEmpty: "저장한 밈이 아직 없어요. 밈을 저장하면 급상승 신호를 알려드려요.",
      contextWatch: {
        eyebrow: "PLUS CONTEXT WATCH",
        title: "저장한 밈의 검수 변화",
        summary: (count, unread) => `저장한 밈에서 확인할 변화 ${count}개${unread > 0 ? ` · 안 읽음 ${unread}개` : ""}를 모았어요.`,
        emptyBody: (count) => count > 0 ? `저장한 밈 ${count}개를 감시 중이에요. 안전·사용 맥락·번역 검수가 바뀌면 여기에 먼저 보여드려요.` : "밈을 저장하면 안전 신호, 사용 맥락, 번역 검수의 변화를 먼저 알려드려요.",
        markRead: "모두 확인",
        marking: "확인 중…",
        markedRead: "변화를 모두 확인했어요.",
        markFailed: "확인 처리에 실패했어요. 잠시 후 다시 시도해 주세요.",
        open: "내용 확인",
        unread: "안 읽음",
        kinds: {
          editorial_update: "내용 업데이트",
          safety_update: "안전 신호 변경",
          translation_reviewed: "번역 검수 완료",
          translation_stale: "번역 다시 확인 필요",
          lifecycle_update: "유행 단계 변경",
        },
      },
      actionInbox: {
        eyebrow: "PLUS ACTION INBOX",
        heading: "오늘의 활용 결과",
        body: "검수된 글로벌 밈을 현지어 카드로 준비하고, 실제로 사용한 결과까지 한곳에서 마무리해요.",
        contentLanguageLabel: "콘텐츠 언어",
        outcome: {
          ready: (count) => `오늘 쓸 검수 완료 밈 ${count}개가 준비됐어요.`,
          prepared: (count) => `${count}개 카드가 준비됐어요. 실제로 사용한 뒤 완료로 기록해 주세요.`,
          complete: (count, currentStreak) => `오늘의 결과 완료 · ${count}개 활용 · ${currentStreak}일 연속`,
        },
        open: "밈 열기",
        copyAction: "활용 문구 복사",
        shareAction: "공유",
        completeAction: "활용 완료",
        completing: "기록 중…",
        completed: "오늘 활용으로 기록했어요.",
        actionFailed: "처리하지 못했어요. 잠시 후 다시 시도해 주세요.",
        completionUnavailable: "활용 기록을 잠시 불러오지 못했어요.",
        progress: (completedTodayCount, currentStreak) => `오늘 활용 ${completedTodayCount}개 · ${currentStreak}일 연속`,
        kindLabels: {
          outcome_replay: "성과 재사용",
          translation_ready: "번역 완료",
          saved_signal: "저장 신호",
          new_reviewed: "새 검수 밈",
        },
        empty: {
          heading: "지금 대기 중인 행동이 없어요",
          body: "새 번역이나 상승 신호가 준비되면 이곳에 가장 먼저 보여드려요.",
        },
        unavailable: {
          heading: "행동함을 잠시 불러오지 못했어요",
          body: "Plus 신호를 확인하지 못했어요. 잠시 후 다시 열어 주세요.",
        },
        partialUnavailable: (count) => `일부 신호 ${count}개를 확인하지 못해 가능한 항목만 보여드려요.`,
        creatorPack: {
          title: "오늘의 Creator Pack",
          body: "게시 채널을 고르면 그 채널에 맞는 현지어 초안·안전 체크·공유 카드를 검수된 문장만으로 한 번에 준비해 드려요.",
          exampleLabel: "어떤 상황에서 쓸까요?",
          examplePreview: "검수된 한 줄",
          exampleUnavailable: "이 밈에는 검수된 상황별 예문이 없어 새 문장을 만들지 않아요.",
          includeMoreLabel: "오늘 후보를 더 담기",
          includeMoreDescription: "남은 검수 밈도 각자 상황을 골라 한 번에 준비해요.",
          create: "Creator Pack 만들기",
          channelRequired: "게시 채널을 먼저 선택해 주세요.",
          recommended: (count) => `최근 성과 ${count}건을 바탕으로 추천`,
          preparing: "카드 준비 중…",
          shared: "공유 시트를 열었어요.",
          shareAgain: "준비한 카드 다시 공유",
          downloadAgain: "카드 다시 저장",
          reusable: (count) => `${count}개 카드가 계속 준비되어 있어요. 다시 공유하거나 저장할 수 있어요.`,
          fallback: "캡션을 복사하고 카드를 저장했어요.",
          downloaded: "카드를 저장했어요. 캡션은 직접 복사해 주세요.",
          partial: (succeeded, failed) => `${succeeded}개 카드를 준비했어요. ${failed}개는 건너뛰었어요.`,
          error: "Creator Pack을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.",
          empty: "현재 카드로 만들 수 있는 검수 완료 밈이 없어요.",
          ready: (count) => `${count}개 카드를 준비했어요. 다 사용한 뒤 활용 완료로 기록해 주세요.`,
          complete: (count) => `${count}개 활용 완료로 기록`,
          completing: "활용 기록 중…",
          completed: (count) => `${count}개를 활용 완료로 기록했어요.`,
          partialCompleted: (succeeded, failed) => `${succeeded}개를 기록했어요. ${failed}개는 다시 시도할 수 있어요.`,
          completionError: "활용 완료를 기록하지 못했어요. 준비된 카드가 남아 있어요.",
        },
      },
      actionQueue: {
        eyebrow: "PLUS ACTION QUEUE",
        title: "오늘 바로 할 일",
        summary: (count) => `저장한 밈 ${count}개에서 지금 할 수 있는 다음 행동을 골랐어요.`,
        emptyTitle: "먼저 밈을 저장해 보세요",
        emptyBody: "저장한 밈이 생기면 유행과 사용 신호를 읽고 바로 활용할 순서를 만들어 드려요.",
        explore: "밈 둘러보기",
        useNow: { description: "안전 신호가 green이고 지금 유행 중이에요. 활용 팩을 바로 열어 보세요.", cta: "활용 팩 열기" },
        checkContext: { description: "지금 유행 중이지만 사용 전 맥락을 먼저 확인하는 편이 좋아요.", cta: "맥락 확인" },
        review: { description: "유행이 지났거나 사용 신호가 조심스러워 보관함에서 다시 판단해요.", cta: "다시 검토" },
      },
      weeklyBrief: {
        eyebrow: "PLUS WEEKLY BRIEF",
        title: "이번 주 달라진 밈",
        summary: (count) => `개인 후보 ${count}개 중 지난 7일 기록이 있는 밈을 최대 5개로 정리했어요.`,
        window: (from, to) => `${from}–${to} · KST`,
        sourceSaved: "저장한 밈에서 발견",
        sourceInterest: "관심사에서 발견",
        openTrend: "추이 보기",
        emptyNoCandidates: "지금 비교할 만한 green·현재 유행 후보가 없어요.",
        coverageEmpty: "이 언어로 검수 완료된 주간 후보가 아직 없어요.",
        emptyInsufficientHistory: "아직 두 날짜 이상의 추이 기록이 쌓인 후보가 없어요.",
        emptyNoChange: "두 날짜 이상의 기록은 있지만 지난 7일 상승한 후보는 아직 없어요.",
        unavailable: "주간 추이 데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      },
      radar: {
        eyebrow: "SAVED REUSE RADAR",
        title: "저장한 밈, 지금 어떻게 쓸까요?",
        summary: (count) => `저장한 밈 ${count}개를 현재 유행과 사용 신호로 다시 정리했어요.`,
        openLibrary: "내 보관함 열기",
        emptyTitle: "아직 다시 볼 밈이 없어요",
        emptyBody: "마음에 드는 밈을 저장하면 현재 유행과 사용 신호를 기준으로 다시 꺼내볼 수 있어요.",
        explore: "밈 둘러보기",
        readyNow: {
          title: "지금 써도 좋아요",
          description: "현재 유행 중이면서 사용 신호가 green인 저장 밈이에요.",
          empty: "지금 바로 추천할 저장 밈은 없어요.",
        },
        checkContext: {
          title: "맥락을 먼저 확인해요",
          description: "현재 유행 중이지만 사용 전에 맥락을 살펴야 하는 밈이에요.",
          empty: "추가 맥락 확인이 필요한 저장 밈은 없어요.",
        },
        archive: {
          title: "나중에 다시 보기",
          description: "유행이 지났거나 현재 사용 신호가 조심스러운 저장 밈이에요.",
          empty: "정리해 둘 저장 밈은 없어요.",
        },
        lifecycle: { rising: "급상승", active: "유행 중", cooling: "식는 중", archived: "추억 밈" },
      },
    },
    feed: {
      personalRadar: "나만의 트렌드 레이더",
      fresh: "최근 등록된 밈",
      editInterests: "관심사 수정",
      setInterests: "관심사 설정",
      fallback: "관심사를 설정하면 취향에 맞는 급상승 밈을 먼저 보여드려요. 지금은 최근 등록된 밈이에요.",
      englishContent: "영문 검수 콘텐츠",
      localizedEmpty: "현재 언어로 검수된 밈이 아직 없어요.",
      localizedUnavailable: "검수된 글로벌 피드를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      empty: "아직 보여드릴 밈이 없어요.",
      explore: "탐색하러 가기",
    },
    trend: {
      title: "트렌드 추이",
      plusBadge: "Plus",
      failed: "추이를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.",
      lockedDescription: "이 밈이 며칠에 걸쳐 어떻게 퍼졌는지 — 조회·반응·트렌드 점수의 일별 추이를 Plus에서 볼 수 있어요. 지금 뜨는 중인지, 이미 지나갔는지 한눈에 구분됩니다.",
      lockedBadge: "Plus 전용",
      loginToView: "로그인하고 보기",
      upgradeToView: "Plus로 추이 보기",
      noData: "아직 추이를 그릴 만큼 데이터가 쌓이지 않았어요. 하루 한 번 기록되니 며칠 뒤 다시 확인해 주세요.",
      metricTrendScore: "트렌드 점수",
      metricViews: "조회",
      metricReactions: "반응",
      current: "현재",
      periodHigh: "기간 최고",
      change: "변화",
      windowSummary: (days) => `${days}일 관측 요약`,
      observedUp: "마지막 트렌드 점수가 첫 관측보다 높아요.",
      observedDown: "마지막 트렌드 점수가 첫 관측보다 낮아요.",
      observedFlat: "첫 관측과 마지막 트렌드 점수가 같아요.",
      observedInsufficient: "비교할 날짜가 두 개 이상 필요해요.",
      observedBasis: "관측 근거",
      observedEvidence: (start, end, views, reactions, saves) => `관측값 ${start}→${end} · 조회 ${views} · 반응 ${reactions} · 저장 ${saves}`,
      sampleCoverage: (samples, days, percent) => `표본 ${samples}/${days}일 · 커버리지 ${percent}%`,
      confidenceHigh: "표본 신뢰도 높음",
      confidenceMedium: "표본 신뢰도 보통",
      confidenceLow: "표본 신뢰도 낮음",
      confidenceInsufficient: "표본 신뢰도 판단 불가",
      lastObserved: (date) => `마지막 관측일 ${date}`,
      lastObservedUnavailable: "마지막 관측 기록 없음",
      chartLabel: (metric, start, end, current, high) => `${metric} 추이 — ${start}부터 ${end}까지, 현재 ${current}, 최고 ${high}`,
    },
    alerts: {
      buttonLabel: "트렌드 알림",
      title: "트렌드 알림",
      plusBadge: "PLUS",
      loading: "불러오는 중…",
      empty: "아직 급상승 알림이 없어요. 관심 카테고리나 저장한 밈이 급상승하면 알려드려요.",
      manageInterests: "관심 카테고리 설정",
      categoryRising: "관심사 급상승",
      savedRising: "저장한 밈 급상승",
      unread: "안 읽음",
    },
    kit: {
      eyebrow: "PLUS USE KIT",
      title: "이 밈을 바로 써보는 활용 팩",
      description: "이 페이지에 표시된 정보만 설명·게시·안전 체크 문구로 묶었어요.",
      plusBadge: "PLUS",
      lockedTitle: "읽는 데서 끝내지 말고, 바로 활용하세요",
      lockedBody: "Plus는 이 밈의 뜻과 사용 신호를 실제로 보낼 수 있는 문구로 정리해 줘요.",
      upgrade: "활용 팩 잠금 해제",
      open: "활용 팩 열기",
      copyAll: "세 문구 모두 복사",
      shareAll: "공유하기",
      copied: "복사했어요",
      shared: "공유했어요",
      prepared: "준비 완료. 필요한 문구를 바로 보내 보세요.",
      copy: "복사",
      copyFailed: "복사하지 못했어요. 문구를 직접 선택해 주세요.",
      sourceNote: "이 팩은 이 페이지에 표시된 정보만 사용해요. 공개 게시 전 원문 맥락도 확인하세요.",
      explainTitle: "친구에게 설명하기",
      captionTitle: "게시물 캡션",
      safetyTitle: "사용 전 안전 체크",
      safetyLabel: "사용 신호",
      usageLabel: "사용 안내",
      cautionLabel: "주의",
      trendLabel: "유행 상태",
      noGuidance: "추가 사용 안내가 아직 기록되지 않았어요.",
      safety: { green: "대체로 사용 가능", yellow: "맥락을 확인하세요", gray: "대부분 지난 표현", red: "사용에 주의하세요" },
      lifecycle: { rising: "급상승", active: "사용 중", cooling: "식는 중", archived: "보관됨" },
    },
    translationPriority: {
      eyebrow: "PLUS TRANSLATION DESK",
      title: "저장한 밈을 내 언어로 먼저 검수",
      body: "원하는 언어의 검수 수요를 운영자 큐에 올려요. 번역은 최신 원문과 대조한 뒤 공개됩니다.",
      saveRequired: "먼저 이 밈을 저장하면 우선 검수 요청을 보낼 수 있어요.",
      request: "우선 검수 요청",
      requesting: "요청 중…",
      requested: "검수 대기열에 들어갔어요.",
      inReview: "운영자가 검수 중이에요.",
      track: "검수 요청함에서 진행 상황 보기",
      completed: "번역 검수가 끝났어요. 이 언어 페이지를 다시 확인해 보세요.",
      alreadyAvailable: "현재 언어 번역은 최신 검수본이에요.",
      upgrade: "Plus에서 요청하기",
      retry: "요청하지 못했어요. 잠시 후 다시 시도해 주세요.",
    },
    translationFulfillment: {
      heading: "검수 요청함",
      body: "저장한 밈의 번역 요청이 어디까지 왔는지 확인하고, 완료된 언어 페이지를 바로 열 수 있어요.",
      statusLabels: { requested: "검수 대기", in_review: "검수 중", ready: "공개 준비 완료", stale: "원문 변경으로 재확인", source_incomplete: "원문 보강 필요", dismissed: "보류" },
      timestampLabels: { requested: "요청 시각", in_review: "최근 변경", ready: "완료 시각", stale: "완료 확인", source_incomplete: "원문 확인", dismissed: "최근 변경" },
      openLink: "해당 언어 페이지 열기",
      empty: { heading: "진행 중인 번역 요청이 없어요", body: "밈 상세에서 필요한 언어의 검수를 요청하면 이곳에서 진행 상황을 확인할 수 있어요." },
      unavailable: { heading: "요청함을 불러오지 못했어요", body: "번역 요청 상태를 확인할 수 없어요. 잠시 후 다시 시도해 주세요." },
    },
    save: {
      loginGate: "로그인하면 밈을 저장할 수 있어요.",
      savedButton: "저장한 밈",
      saveButton: "이 밈 저장하기",
      saved: "MY에 저장했어요.",
      removed: "저장을 해제했어요.",
      retry: "잠시 후 다시 시도해 주세요.",
      limitReached: "무료 저장 한도 10개를 모두 사용했어요.",
      upgrade: "Plus로 무제한 저장하기",
    },
    my: {
      unlimited: "무제한 저장",
      freeLimit: (count, limit) => `${count}/${limit}개 저장`,
      paginationLabel: "저장한 밈 페이지",
      previousPage: "이전",
      nextPage: "다음",
      pageStatus: (page, total) => `${page} / ${total} 페이지`,
    },
  },
  en: {
    productName: "MemeCatch Plus",
    menuLabel: "MemeCatch Plus",
    badge: "PLUS",
    pricing: {
      eyebrow: "A reviewed meme-use tool",
      title: "Get three memes to post today, with platform-ready copy",
      intro: "See memes matched to your interests, brand-use safety, and rising alerts in one place.",
      monthly: "$10",
      perMonth: "USD / 30 days",
      launchNote: "30-day pass · no auto-renewal · remaining time preserved · pay with Kaia USDT",
      checkout: "Start MemeCatch Plus",
      sameEmail: "The order is $10 USD and is paid with Kaia USDT through Unifi Wallet. Any remaining access is preserved before adding 30 days. Refunds are reviewed by support and sent manually to the original payment wallet.",
      freeName: "Free",
      plusName: "Plus",
      featuresTitle: "What do you unlock with Plus?",
      comparisonTitle: "Explore for free, then upgrade when you need more",
      features: [
        {
          label: "Meanings, origins, and sources",
          free: "Included",
          plus: "Included",
          detail:
            "Every meme's meaning, origin, and source is always free to read. Subscribing to Plus keeps this core dictionary intact.",
        },
        {
          label: "Personal trend radar",
          free: "Not included",
          plus: "Full access",
          detail:
            "Pick your interests and a personalized radar gathers the memes trending right now. Plus unlocks the full radar.",
        },
        {
          label: "Saved-meme reuse radar",
          free: "10",
          plus: "Unlimited + radar",
          detail:
            "Save the memes you love and find them again later. Plus adds unlimited saves and resurfaces them with their current trend and usage signal.",
        },
        {
          label: "Ad-free experience",
          free: "Ads shown",
          plus: "No ads",
          detail:
            "The free tier shows a bottom banner and auto ads. Subscribe to Plus and ads disappear across the whole site so you can focus on the memes.",
        },
        {
          label: "Meme use kit",
          free: "Locked preview",
          plus: "Copy-ready explain, post, and safety text",
          detail:
            "Turn the reviewed meaning, usage guidance, caution, and trend state into copy-ready text for explaining, posting, and checking context. It uses recorded facts instead of inventing new claims.",
        },
        {
          label: "Plus Daily Signal email",
          free: "Not included",
          plus: "Once daily · saved memes first",
          detail:
            "Opt in to one daily email with rising saved memes and signals from your interests. It includes reviewed content and current signals only, with a language choice.",
        },
        {
          label: "Global Meme Daily",
          free: "Locked preview",
          plus: "3 questions daily + streak",
          detail:
            "Each day, Plus selects memes with current review in Korean, English, Japanese, Simplified Chinese, and Traditional Chinese, then turns one into three questions.",
        },
      ],
    },
    dashboard: {
      eyebrow: "MY PLUS",
      activeTitle: "Finish today’s one-cut",
      activeBody: "Choose one reviewed meme, prepare its ready-to-post card, and record what you actually used.",
      upgradeTitle: "Start with one reviewed meme today",
      upgradeBody: "MemeCatch Plus connects today’s one-cut from selection to preparation to the use record.",
      viewPlans: "View Plus plan",
      membershipStatus: "Membership status",
      active: "Active",
      renews: "Access confirmed through",
      extend: "Extend access",
      expiringSoon: (days: number) => days <= 0 ? "Your pass expires today. Extend now to keep access." : `Your pass expires in ${days} days. Extend it in advance.`,
      billingHelp: "Cancellation & refund help",
      syncNote: "Connection may take a moment after purchase. Make sure you used the same email.",
      checkoutConfirming: "Confirming your payment… the webhook may take a moment.",
      checkoutConfirmed: "Payment confirmed! Your Plus access has started.",
      checkoutTimeout: "Confirmation hasn’t arrived yet. Please refresh shortly — your payment is being processed safely.",
      startOneCut: "Start your first One-Cut",
      moreTools: "More Plus tools",
      primaryMissionUnavailable: {
        eyebrow: "PLUS STATUS",
        heading: "We could not choose your next action",
        body: "Your action inbox, Global Daily, and outcome data are unavailable. Please try again shortly.",
      },
      historyTitle: "Payment history",
      historyEmpty: "No payments yet.",
      historyCanceled: "Canceled",
      savedMemeWatchTitle: "Saved-meme rising alerts",
      savedMemeWatchDescription: (count) => `We are watching your ${count} saved memes. If one rises, we will alert you.`,
      savedMemeWatchEmpty: "You have no saved memes yet. Save a meme to get a signal when it rises.",
      contextWatch: {
        eyebrow: "PLUS CONTEXT WATCH",
        title: "Changes to your saved memes",
        summary: (count, unread) => `${count} saved-meme changes need your attention${unread > 0 ? ` · ${unread} unread` : ""}.`,
        emptyBody: (count) => count > 0 ? `We are watching your ${count} saved memes. Safety, usage context, and translation review changes appear here first.` : "Save a meme to get the important safety, usage-context, and translation-review changes first.",
        markRead: "Mark all read",
        marking: "Marking…",
        markedRead: "All changes marked as read.",
        markFailed: "Could not mark changes as read. Try again shortly.",
        open: "Review change",
        unread: "Unread",
        kinds: {
          editorial_update: "Content update",
          safety_update: "Safety signal changed",
          translation_reviewed: "Translation reviewed",
          translation_stale: "Translation needs review",
          lifecycle_update: "Lifecycle changed",
        },
      },
      actionInbox: {
        eyebrow: "PLUS ACTION INBOX",
        heading: "Today’s meme outcome",
        body: "Turn reviewed global memes into localized cards, then record what you actually used.",
        contentLanguageLabel: "Content language",
        outcome: {
          ready: (count) => `${count} reviewed meme${count === 1 ? " is" : "s are"} ready for today.`,
          prepared: (count) => `${count} card${count === 1 ? " is" : "s are"} ready. Mark them as used after you use them.`,
          complete: (count, currentStreak) => `Today’s outcome complete · ${count} used · ${currentStreak}-day streak`,
        },
        open: "Open meme",
        copyAction: "Copy use text",
        shareAction: "Share",
        completeAction: "Mark used",
        completing: "Saving…",
        completed: "Marked as used today.",
        actionFailed: "Could not save that action. Try again shortly.",
        completionUnavailable: "Use tracking is temporarily unavailable.",
        progress: (completedTodayCount, currentStreak) => `${completedTodayCount} used today · ${currentStreak}-day streak`,
        kindLabels: {
          outcome_replay: "Outcome replay",
          translation_ready: "Translation ready",
          saved_signal: "Saved signal",
          new_reviewed: "Newly reviewed",
        },
        empty: {
          heading: "Nothing needs action right now",
          body: "New translations and rising signals will appear here first when they are ready.",
        },
        unavailable: {
          heading: "Action inbox is temporarily unavailable",
          body: "We could not confirm your Plus signals. Please try again shortly.",
        },
        partialUnavailable: (count) => `We could not confirm ${count} signal source${count === 1 ? "" : "s"}; showing what is available.`,
        creatorPack: {
          title: "Today's Creator Pack",
          body: "Choose a posting channel to prepare its structured localized draft, safety check, and share card from reviewed text only.",
          exampleLabel: "What situation is this for?",
          examplePreview: "Reviewed line",
          exampleUnavailable: "No reviewed usage example is available, so no new sentence will be generated.",
          includeMoreLabel: "Include the other ready cards",
          includeMoreDescription: "Choose a reviewed situation for each card and prepare them together.",
          create: "Create Creator Pack",
          channelRequired: "Choose a posting channel first.",
          recommended: (count) => `Recommended from ${count} recent results`,
          preparing: "Preparing cards…",
          shared: "The share sheet is open.",
          shareAgain: "Share prepared cards",
          downloadAgain: "Save card again",
          reusable: (count) => `${count} card${count === 1 ? " is" : "s are"} still ready. Share or save ${count === 1 ? "it" : "them"} again anytime.`,
          fallback: "Caption copied and cards saved.",
          downloaded: "Cards saved. Please copy the caption manually.",
          partial: (succeeded, failed) => `${succeeded} cards ready. ${failed} skipped.`,
          error: "We could not prepare the Creator Pack. Please try again shortly.",
          empty: "No reviewed actions can become cards right now.",
          ready: (count) => `${count} card${count === 1 ? " is" : "s are"} ready. Mark them as used when you are done.`,
          complete: (count) => `Mark ${count} card${count === 1 ? "" : "s"} as used`,
          completing: "Recording use…",
          completed: (count) => `Marked ${count} card${count === 1 ? "" : "s"} as used.`,
          partialCompleted: (succeeded, failed) => `Marked ${succeeded} as used. ${failed} remain to retry.`,
          completionError: "Could not record use. The prepared cards remain available to retry.",
        },
      },
      actionQueue: {
        eyebrow: "PLUS ACTION QUEUE",
        title: "Your next best meme actions",
        summary: (count) => `We picked the next useful action from your ${count} saved memes.`,
        emptyTitle: "Save a meme to start your queue",
        emptyBody: "Once you save memes, Plus will sort their momentum and usage signals into a next-step queue.",
        explore: "Explore memes",
        useNow: { description: "It is current with a green usage signal. Open the Use Kit and act on it now.", cta: "Open Use Kit" },
        checkContext: { description: "It is current, but review the context before you use it.", cta: "Check context" },
        review: { description: "Its trend or usage signal needs care. Revisit it before sharing.", cta: "Review meme" },
      },
      weeklyBrief: {
        eyebrow: "PLUS WEEKLY BRIEF",
        title: "What changed this week",
        summary: (count) => `We compared ${count} personal candidates and kept up to five with observed seven-day history.`,
        window: (from, to) => `${from}–${to} · KST`,
        sourceSaved: "Found in saved memes",
        sourceInterest: "Found in your interests",
        openTrend: "View trend",
        emptyNoCandidates: "There are no current green candidates to compare right now.",
        coverageEmpty: "No human-reviewed weekly candidates are ready in this language yet.",
        emptyInsufficientHistory: "No candidate has at least two dated trend points yet.",
        emptyNoChange: "There are dated trend points, but no candidate has risen in the last seven days yet.",
        unavailable: "The weekly trend data is unavailable right now. Please try again later.",
      },
      radar: {
        eyebrow: "SAVED REUSE RADAR",
        title: "What can you do with your saved memes now?",
        summary: (count) => `We sorted your ${count} saved memes by their current momentum and usage signal.`,
        openLibrary: "Open my library",
        emptyTitle: "Nothing to resurface yet",
        emptyBody: "Save a meme you like and this radar will bring it back with its current trend and usage signal.",
        explore: "Explore memes",
        readyNow: {
          title: "Ready to use now",
          description: "Saved memes that are current and have a green usage signal.",
          empty: "None of your saved memes are ready to recommend right now.",
        },
        checkContext: {
          title: "Check the context first",
          description: "Saved memes that are current but need context before you use them.",
          empty: "No current saved memes need an extra context check.",
        },
        archive: {
          title: "Revisit later",
          description: "Saved memes whose trend has cooled or whose current signal needs more care.",
          empty: "There are no saved memes to set aside right now.",
        },
        lifecycle: { rising: "Rising", active: "Active", cooling: "Cooling", archived: "Archive" },
      },
    },
    feed: {
      personalRadar: "Your personal trend radar",
      fresh: "Recently added memes",
      editInterests: "Edit interests",
      setInterests: "Set interests",
      fallback: "Set your interests to see relevant rising memes first. Here are recent additions for now.",
      englishContent: "English reviewed content",
      localizedEmpty: "No reviewed memes are available in this language yet.",
      localizedUnavailable: "We could not load the reviewed global feed. Please try again shortly.",
      empty: "There are no memes to show yet.",
      explore: "Explore memes",
    },
    trend: {
      title: "Trend history",
      plusBadge: "Plus",
      failed: "We could not load the trend history. Please try again shortly.",
      lockedDescription: "Plus shows how this meme spread over time with daily views, reactions, and trend scores, so you can tell whether it is rising or has passed.",
      lockedBadge: "Plus only",
      loginToView: "Log in to view",
      upgradeToView: "View with Plus",
      noData: "There is not enough history to chart yet. We record it once a day, so please check back in a few days.",
      metricTrendScore: "Trend score",
      metricViews: "Views",
      metricReactions: "Reactions",
      current: "Current",
      periodHigh: "Period high",
      change: "Change",
      windowSummary: (days) => `${days}-day observed summary`,
      observedUp: "The last trend score is higher than the first observed score.",
      observedDown: "The last trend score is lower than the first observed score.",
      observedFlat: "The first and last observed trend scores are equal.",
      observedInsufficient: "At least two dated observations are needed.",
      observedBasis: "Observed basis",
      observedEvidence: (start, end, views, reactions, saves) => `Observed ${start}→${end} · views ${views} · reactions ${reactions} · saves ${saves}`,
      sampleCoverage: (samples, days, percent) => `Samples ${samples}/${days} days · ${percent}% coverage`,
      confidenceHigh: "High sample confidence",
      confidenceMedium: "Medium sample confidence",
      confidenceLow: "Low sample confidence",
      confidenceInsufficient: "Insufficient samples for confidence",
      lastObserved: (date) => `Last observed ${date}`,
      lastObservedUnavailable: "No observed update yet",
      chartLabel: (metric, start, end, current, high) => `${metric} history — ${start} to ${end}; current ${current}, high ${high}`,
    },
    alerts: {
      buttonLabel: "Trend alerts",
      title: "Trend alerts",
      plusBadge: "PLUS",
      loading: "Loading…",
      empty: "No rising alerts yet. We will let you know when an interest or saved meme starts rising.",
      manageInterests: "Set interests",
      categoryRising: "Interest is rising",
      savedRising: "Saved meme is rising",
      unread: "Unread",
    },
    kit: {
      eyebrow: "PLUS USE KIT",
      title: "A use kit for this meme",
      description: "Information shown on this page, packaged for explaining, posting, and checking context.",
      plusBadge: "PLUS",
      lockedTitle: "Go from reading a meme to using it",
      lockedBody: "Plus turns this meme's meaning and usage signals into text you can actually send.",
      upgrade: "Unlock the use kit",
      open: "Open the Use Kit",
      copyAll: "Copy all three",
      shareAll: "Share",
      copied: "Copied",
      shared: "Shared",
      prepared: "Ready to use. Send the format you need when you need it.",
      copy: "Copy",
      copyFailed: "Could not copy. Select the text manually.",
      sourceNote: "This kit only uses the information shown on this page. Check the original context before posting publicly.",
      explainTitle: "Explain to a friend",
      captionTitle: "Post caption",
      safetyTitle: "Safety check",
      safetyLabel: "Usage signal",
      usageLabel: "Usage",
      cautionLabel: "Caution",
      trendLabel: "Trend state",
      noGuidance: "No additional usage guidance is recorded yet.",
      safety: { green: "Generally usable", yellow: "Check the context", gray: "Mostly dated", red: "Use with caution" },
      lifecycle: { rising: "Rising", active: "Active", cooling: "Cooling", archived: "Archived" },
    },
    translationPriority: {
      eyebrow: "PLUS TRANSLATION DESK",
      title: "Request a reviewed translation for a saved meme",
      body: "Put demand for your language into the operator queue. A translation is published only after it is checked against the current Korean source.",
      saveRequired: "Save this meme first to request priority review.",
      request: "Request priority review",
      requesting: "Requesting…",
      requested: "Added to the review queue.",
      inReview: "An editor is reviewing it now.",
      track: "Track this request in Plus",
      completed: "The translation review is complete. Reopen this language page to see it.",
      alreadyAvailable: "The translation for this language is already current and reviewed.",
      upgrade: "Request with Plus",
      retry: "Could not submit the request. Try again shortly.",
    },
    translationFulfillment: {
      heading: "Translation request desk",
      body: "Track saved-meme translation requests and reopen the exact language page when review is complete.",
      statusLabels: { requested: "Queued", in_review: "In review", ready: "Ready to open", stale: "Recheck needed", source_incomplete: "Source needs more context", dismissed: "On hold" },
      timestampLabels: { requested: "Requested", in_review: "Updated", ready: "Completed", stale: "Completion checked", source_incomplete: "Source checked", dismissed: "Updated" },
      openLink: "Open language page",
      empty: { heading: "No translation requests yet", body: "Request a language review from a saved meme detail page to track it here." },
      unavailable: { heading: "Requests are unavailable", body: "Translation request status could not be loaded. Try again shortly." },
    },
    save: {
      loginGate: "Log in to save memes.",
      savedButton: "Saved",
      saveButton: "Save this meme",
      saved: "Saved to MY.",
      removed: "Removed from saved memes.",
      retry: "Please try again in a moment.",
      limitReached: "You have used all 10 free saves.",
      upgrade: "Get unlimited saves with Plus",
    },
    my: {
      unlimited: "Unlimited saves",
      freeLimit: (count, limit) => `${count}/${limit} saved`,
      paginationLabel: "Saved memes pages",
      previousPage: "Previous",
      nextPage: "Next",
      pageStatus: (page, total) => `Page ${page} of ${total}`,
    },
  },
  ja: {
    productName: "MemeCatch Plus",
    menuLabel: "MemeCatch Plus",
    badge: "PLUS",
    pricing: {
      eyebrow: "審査済みミーム活用ツール",
      title: "今日投稿するミーム3つと媒体別コピーを受け取る",
      intro: "関心分野に合うミーム、企業・ブランド利用時の安全性、急上昇通知をまとめて確認できます。",
      monthly: "$10",
      perMonth: "USD / 30日",
      launchNote: "30日利用券・自動更新なし・残存期間を維持・Kaia USDT決済",
      checkout: "MemeCatch Plusを始める",
      sameEmail: "注文額は10米ドルで、Unifi WalletのKaia USDTで支払います。残りの利用期間の後ろに30日が追加され、返金はサポート確認後に元の決済ウォレットへ手動で送金されます。",
      freeName: "無料",
      plusName: "Plus",
      featuresTitle: "Plusで何が使えるようになる？",
      comparisonTitle: "まず無料で試し、必要になったらアップグレード",
      features: [
        {
          label: "意味・由来・出典の確認",
          free: "利用可",
          plus: "利用可",
          detail:
            "すべてのミームの意味・由来・出典はいつでも無料で読めます。Plusに登録してもこの基本の辞書機能はそのままです。",
        },
        {
          label: "興味に合うトレンドレーダー",
          free: "利用不可",
          plus: "すべて利用可",
          detail:
            "興味を選ぶと、今話題のミームをパーソナライズされたレーダーでまとめて表示します。Plusでレーダー全体が開放されます。",
        },
        {
          label: "保存ミーム・再活用レーダー",
          free: "10件",
          plus: "無制限 + 再活用レーダー",
          detail:
            "気に入ったミームを保存して後で見返せます。Plusでは無制限に保存でき、今の流行と使用シグナルに合わせて再び見つけられます。",
        },
        {
          label: "広告なしの体験",
          free: "広告あり",
          plus: "広告なし",
          detail:
            "無料では下部バナーと自動広告が表示されます。Plusに登録するとサイト全体から広告が消え、ミームに集中できます。",
        },
        {
          label: "ミーム活用キット",
          free: "ロック中",
          plus: "説明・投稿・安全文をコピー",
          detail:
            "確認済みの意味・使い方・注意点・トレンド状態を、説明用・投稿用・安全確認用の文章にまとめてコピーできます。新しい事実は作りません。",
        },
        {
          label: "Plus Daily Signalメール",
          free: "利用不可",
          plus: "1日1通・保存ミームを優先",
          detail:
            "同意すると、保存したミームの上昇と興味のある分野のシグナルを1日1通で受け取れます。確認済みのコンテンツと現在のシグナルだけを掲載し、言語も選べます。",
        },
        {
          label: "Global Meme Daily",
          free: "ロック中",
          plus: "毎日3問 + 連続記録",
          detail:
            "韓国語・英語・日本語・簡体字中国語・繁体字中国語の5言語で最新確認されたミームだけを、毎日3問で学べます。",
        },
      ],
    },
    dashboard: {
      eyebrow: "MY PLUS",
      activeTitle: "今日の1カットをすぐ完成",
      activeBody: "確認済みミームを1つ選び、投稿用カードに準備して、実際に使った結果を記録できます。",
      upgradeTitle: "今日使う確認済みミーム1つから始める",
      upgradeBody: "MemeCatch Plusなら、今日の1カットを選ぶところから準備・利用記録までつながります。",
      viewPlans: "Plusプランを見る",
      membershipStatus: "メンバーシップ状況",
      active: "利用中",
      renews: "利用確認期限",
      extend: "利用を延長する",
      expiringSoon: (days: number) => days <= 0 ? "本日で期限が切れます。今すぐ延長すれば続けて利用できます。" : `あと${days}日で期限が切れます。早めに延長してください。`,
      billingHelp: "キャンセル・返金のお問い合わせ",
      syncNote: "購入後の連携には少し時間がかかる場合があります。同じメールアドレスを使用したか確認してください。",
      checkoutConfirming: "決済を確認しています… 反映まで少しかかる場合があります。",
      checkoutConfirmed: "決済が確認できました！Plusのご利用が始まりました。",
      checkoutTimeout: "まだ確認が届いていません。しばらくして再読み込みしてください — 決済は安全に処理中です。",
      startOneCut: "最初の1カットを始める",
      moreTools: "その他のPlusツール",
      primaryMissionUnavailable: {
        eyebrow: "PLUS STATUS",
        heading: "次の行動を選べませんでした",
        body: "Action Inbox、Global Daily、活用結果を読み込めませんでした。しばらくして再試行してください。",
      },
      historyTitle: "決済履歴",
      historyEmpty: "決済履歴はまだありません。",
      historyCanceled: "キャンセル",
      savedMemeWatchTitle: "保存したミームの急上昇アラート",
      savedMemeWatchDescription: (count) => `保存したミーム${count}件を見守っています。急上昇したらお知らせします。`,
      savedMemeWatchEmpty: "保存したミームはまだありません。保存すると急上昇のシグナルをお知らせします。",
      contextWatch: {
        eyebrow: "PLUS CONTEXT WATCH",
        title: "保存したミームのレビュー変化",
        summary: (count, unread) => `確認が必要な保存ミームの変化${count}件${unread > 0 ? ` · 未読${unread}件` : ""}をまとめました。`,
        emptyBody: (count) => count > 0 ? `保存したミーム${count}件を見守っています。安全・使用文脈・翻訳レビューの変化をここに先に表示します。` : "ミームを保存すると、安全・使用文脈・翻訳レビューの重要な変化を先にお知らせします。",
        markRead: "すべて確認",
        marking: "確認中…",
        markedRead: "すべて確認済みにしました。",
        markFailed: "確認処理に失敗しました。しばらくして再試行してください。",
        open: "変化を確認",
        unread: "未読",
        kinds: {
          editorial_update: "内容の更新",
          safety_update: "安全シグナルの変更",
          translation_reviewed: "翻訳レビュー完了",
          translation_stale: "翻訳の再確認が必要",
          lifecycle_update: "流行段階の変更",
        },
      },
      actionInbox: {
        eyebrow: "PLUS ACTION INBOX",
        heading: "今日の活用結果",
        body: "確認済みのグローバルミームを現地語カードにして、実際に使った結果までここで完了できます。",
        contentLanguageLabel: "コンテンツ言語",
        outcome: {
          ready: (count) => `今日使える確認済みミームが${count}件あります。`,
          prepared: (count) => `${count}件のカードを準備しました。使った後に活用済みとして記録してください。`,
          complete: (count, currentStreak) => `今日の結果を完了 · ${count}件を活用 · ${currentStreak}日連続`,
        },
        open: "ミームを開く",
        copyAction: "活用文をコピー",
        shareAction: "共有",
        completeAction: "活用済みにする",
        completing: "記録中…",
        completed: "今日の活用として記録しました。",
        actionFailed: "記録できませんでした。しばらくして再試行してください。",
        completionUnavailable: "活用記録を一時的に読み込めません。",
        progress: (completedTodayCount, currentStreak) => `今日の活用 ${completedTodayCount}件 · ${currentStreak}日連続`,
        kindLabels: {
          outcome_replay: "成果の再利用",
          translation_ready: "翻訳完了",
          saved_signal: "保存シグナル",
          new_reviewed: "新しいレビュー",
        },
        empty: {
          heading: "今すぐできる行動はありません",
          body: "新しい翻訳や急上昇シグナルが準備できると、ここに先に表示します。",
        },
        unavailable: {
          heading: "アクションインボックスを読み込めません",
          body: "Plusのシグナルを確認できませんでした。しばらくして再試行してください。",
        },
        partialUnavailable: (count) => `${count}件のシグナルを確認できないため、取得できた項目だけ表示しています。`,
        creatorPack: {
          title: "今日のCreator Pack",
          body: "投稿先を選ぶと、そのチャンネル向けの現地語ドラフト・安全確認・共有カードを確認済みの文面だけで準備できます。",
          exampleLabel: "どんな場面で使いますか？",
          examplePreview: "確認済みの一言",
          exampleUnavailable: "確認済みの使用例がないため、新しい文は生成しません。",
          includeMoreLabel: "他の準備済みカードも含める",
          includeMoreDescription: "カードごとに確認済みの場面を選び、まとめて準備できます。",
          create: "Creator Packを作る",
          channelRequired: "投稿先のチャンネルを先に選んでください。",
          recommended: (count) => `${count}件の最近の結果からおすすめ`,
          preparing: "カードを準備中…",
          shared: "共有シートを開きました。",
          shareAgain: "準備したカードを再共有",
          downloadAgain: "カードをもう一度保存",
          reusable: (count) => `${count}件のカードを引き続き利用できます。いつでも再共有・再保存できます。`,
          fallback: "キャプションをコピーしてカードを保存しました。",
          downloaded: "カードを保存しました。キャプションは手動でコピーしてください。",
          partial: (succeeded, failed) => `${succeeded}件のカードを準備しました。${failed}件はスキップしました。`,
          error: "Creator Packを準備できませんでした。しばらくして再試行してください。",
          empty: "今すぐカードにできるレビュー済みの行動はありません。",
          ready: (count) => `${count}件のカードを準備しました。使い終わったら活用済みとして記録できます。`,
          complete: (count) => `${count}件を活用済みとして記録`,
          completing: "活用を記録中…",
          completed: (count) => `${count}件を活用済みとして記録しました。`,
          partialCompleted: (succeeded, failed) => `${succeeded}件を記録しました。${failed}件は再試行できます。`,
          completionError: "活用を記録できませんでした。準備したカードは再試行できます。",
        },
      },
      actionQueue: {
        eyebrow: "PLUS ACTION QUEUE",
        title: "今日やることを選ぶ",
        summary: (count) => `保存したミーム${count}件から、今できる次の行動を選びました。`,
        emptyTitle: "まずミームを保存しましょう",
        emptyBody: "ミームを保存すると、流行と使用シグナルを見て次の行動を整理します。",
        explore: "ミームを探す",
        useNow: { description: "今も流行していてgreenの使用シグナルがあります。活用パックを開きましょう。", cta: "活用パックを開く" },
        checkContext: { description: "今も流行していますが、使う前に文脈を確認しましょう。", cta: "文脈を確認" },
        review: { description: "流行や使用シグナルに注意が必要です。共有前に見直しましょう。", cta: "もう一度確認" },
      },
      weeklyBrief: {
        eyebrow: "PLUS WEEKLY BRIEF",
        title: "今週変化したミーム",
        summary: (count) => `保存や興味に合う${count}件から、7日間の記録があるものを最大5件表示します。`,
        window: (from, to) => `${from}–${to} · KST`,
        sourceSaved: "保存したミームから",
        sourceInterest: "興味から",
        openTrend: "推移を見る",
        emptyNoCandidates: "比較できるgreen・現在流行中のミームはありません。",
        coverageEmpty: "この言語で確認済みの週間候補はまだありません。",
        emptyInsufficientHistory: "2日以上の推移記録があるミームはまだありません。",
        emptyNoChange: "2日以上の記録はありますが、過去7日間に上昇した候補はまだありません。",
        unavailable: "週間トレンドを読み込めませんでした。しばらくしてから再試行してください。",
      },
      radar: {
        eyebrow: "SAVED REUSE RADAR",
        title: "保存したミームを今どう使う？",
        summary: (count) => `保存したミーム${count}件を、現在の勢いと使用シグナルで整理しました。`,
        openLibrary: "保存一覧を開く",
        emptyTitle: "見直す保存ミームはまだありません",
        emptyBody: "気に入ったミームを保存すると、今の流行と使用シグナルに合わせてこのレーダーに表示されます。",
        explore: "ミームを探す",
        readyNow: {
          title: "今なら使いやすい",
          description: "今も流行していて、greenの使用シグナルがある保存ミームです。",
          empty: "今すぐおすすめできる保存ミームはありません。",
        },
        checkContext: {
          title: "先に文脈を確認",
          description: "今も流行していますが、使う前に文脈を確かめたい保存ミームです。",
          empty: "追加の文脈確認が必要な保存ミームはありません。",
        },
        archive: {
          title: "あとで見返す",
          description: "流行が落ち着いたか、現在の使用シグナルに注意が必要な保存ミームです。",
          empty: "今は保留にする保存ミームはありません。",
        },
        lifecycle: { rising: "急上昇", active: "流行中", cooling: "落ち着き中", archived: "アーカイブ" },
      },
    },
    feed: {
      personalRadar: "自分専用トレンドレーダー",
      fresh: "最近追加されたミーム",
      editInterests: "興味を編集",
      setInterests: "興味を設定",
      fallback: "興味を設定すると、好みに合う急上昇ミームを先に表示します。今は最近追加されたミームです。",
      englishContent: "英語のレビュー済みコンテンツ",
      localizedEmpty: "この言語でレビュー済みのミームはまだありません。",
      localizedUnavailable: "レビュー済みのグローバルフィードを読み込めませんでした。しばらくしてから再度お試しください。",
      empty: "表示できるミームはまだありません。",
      explore: "ミームを探す",
    },
    trend: {
      title: "トレンド推移",
      plusBadge: "Plus",
      failed: "トレンド推移を読み込めませんでした。しばらくしてからもう一度お試しください。",
      lockedDescription: "Plusでは、日ごとの閲覧数・リアクション・トレンドスコアで、このミームが広がった推移を確認できます。今上がっているのか、すでに過ぎたのかをひと目で判断できます。",
      lockedBadge: "Plus限定",
      loginToView: "ログインして見る",
      upgradeToView: "Plusで推移を見る",
      noData: "まだグラフを描けるほどの履歴がありません。1日1回記録するため、数日後にもう一度ご確認ください。",
      metricTrendScore: "トレンドスコア",
      metricViews: "閲覧数",
      metricReactions: "リアクション",
      current: "現在",
      periodHigh: "期間最高",
      change: "変化",
      windowSummary: (days) => `${days}日間の観測要約`,
      observedUp: "最後のトレンドスコアは最初の観測値より高くなっています。",
      observedDown: "最後のトレンドスコアは最初の観測値より低くなっています。",
      observedFlat: "最初と最後のトレンドスコアは同じです。",
      observedInsufficient: "比較には日付の異なる観測が2件以上必要です。",
      observedBasis: "観測根拠",
      observedEvidence: (start, end, views, reactions, saves) => `観測値 ${start}→${end} · 閲覧 ${views} · リアクション ${reactions} · 保存 ${saves}`,
      sampleCoverage: (samples, days, percent) => `標本 ${samples}/${days}日 · カバー率 ${percent}%`,
      confidenceHigh: "標本信頼度 高",
      confidenceMedium: "標本信頼度 中",
      confidenceLow: "標本信頼度 低",
      confidenceInsufficient: "標本不足で信頼度を判定できません",
      lastObserved: (date) => `最終観測日 ${date}`,
      lastObservedUnavailable: "観測更新はまだありません",
      chartLabel: (metric, start, end, current, high) => `${metric}の推移 — ${start}から${end}まで、現在${current}、最高${high}`,
    },
    alerts: {
      buttonLabel: "トレンド通知",
      title: "トレンド通知",
      plusBadge: "PLUS",
      loading: "読み込み中…",
      empty: "急上昇の通知はまだありません。興味のあるカテゴリや保存したミームが急上昇するとお知らせします。",
      manageInterests: "興味を設定",
      categoryRising: "興味のある話題が急上昇",
      savedRising: "保存したミームが急上昇",
      unread: "未読",
    },
    kit: {
      eyebrow: "PLUS USE KIT",
      title: "このミームを使うためのキット",
      description: "このページに表示された情報を、説明・投稿・安全確認の文章にまとめます。",
      plusBadge: "PLUS",
      lockedTitle: "読むだけでなく、すぐ使える形に",
      lockedBody: "Plusなら、このミームの意味と使用シグナルを実際に送れる文章へ整理できます。",
      upgrade: "活用キットを開く",
      open: "活用キットを開く",
      copyAll: "3つすべてコピー",
      shareAll: "共有する",
      copied: "コピーしました",
      shared: "共有しました",
      prepared: "準備完了。必要な文章をすぐに送れます。",
      copy: "コピー",
      copyFailed: "コピーできませんでした。文章を選択してコピーしてください。",
      sourceNote: "このキットはページに表示された情報だけを使います。公開前に元の文脈も確認してください。",
      explainTitle: "友人に説明",
      captionTitle: "投稿キャプション",
      safetyTitle: "使用前の安全確認",
      safetyLabel: "使用シグナル",
      usageLabel: "使い方",
      cautionLabel: "注意",
      trendLabel: "トレンド状態",
      noGuidance: "追加の使用案内はまだ記録されていません。",
      safety: { green: "基本的に使用可", yellow: "文脈を確認", gray: "多くは古い表現", red: "使用に注意" },
      lifecycle: { rising: "上昇中", active: "流行中", cooling: "下降中", archived: "アーカイブ" },
    },
    translationPriority: {
      eyebrow: "PLUS TRANSLATION DESK",
      title: "保存したミームの翻訳を優先レビュー",
      body: "必要な言語の需要を運営キューに届けます。翻訳は最新の韓国語原文と照合してから公開します。",
      saveRequired: "先にこのミームを保存すると、優先レビューを依頼できます。",
      request: "優先レビューを依頼",
      requesting: "依頼中…",
      requested: "レビューキューに追加しました。",
      inReview: "編集者がレビュー中です。",
      track: "Plusでリクエスト状況を確認",
      completed: "翻訳レビューが完了しました。この言語のページをもう一度開いてください。",
      alreadyAvailable: "この言語の翻訳は最新のレビュー済みです。",
      upgrade: "Plusで依頼する",
      retry: "依頼できませんでした。しばらくしてから再試行してください。",
    },
    translationFulfillment: {
      heading: "翻訳リクエストデスク",
      body: "保存したミームの翻訳依頼を追跡し、レビュー完了後に対象言語のページを開けます。",
      statusLabels: { requested: "レビュー待ち", in_review: "レビュー中", ready: "公開準備完了", stale: "再確認が必要", source_incomplete: "原文の補強が必要", dismissed: "保留" },
      timestampLabels: { requested: "依頼日時", in_review: "更新日時", ready: "完了日時", stale: "完了確認", source_incomplete: "原文確認", dismissed: "更新日時" },
      openLink: "言語ページを開く",
      empty: { heading: "翻訳リクエストはありません", body: "保存したミームの詳細ページから必要な言語のレビューを依頼すると、ここで進行状況を確認できます。" },
      unavailable: { heading: "リクエストを読み込めません", body: "翻訳リクエストの状態を確認できません。しばらくしてから再試行してください。" },
    },
    save: {
      loginGate: "ログインするとミームを保存できます。",
      savedButton: "保存済み",
      saveButton: "このミームを保存",
      saved: "MYに保存しました。",
      removed: "保存を解除しました。",
      retry: "しばらくしてからもう一度お試しください。",
      limitReached: "無料保存枠10件をすべて使用しました。",
      upgrade: "Plusで無制限に保存",
    },
    my: {
      unlimited: "無制限保存",
      freeLimit: (count, limit) => `${count}/${limit}件保存`,
      paginationLabel: "保存したミームのページ",
      previousPage: "前へ",
      nextPage: "次へ",
      pageStatus: (page, total) => `${page} / ${total}ページ`,
    },
  },
  zh: {
    productName: "MemeCatch Plus",
    menuLabel: "MemeCatch Plus",
    badge: "PLUS",
    pricing: {
      eyebrow: "已审核的迷因使用工具",
      title: "获取今天可发布的3个迷因及各平台文案",
      intro: "在一处查看符合兴趣的迷因、企业与品牌使用安全性和热度提醒。",
      monthly: "$10",
      perMonth: "USD / 30天",
      launchNote: "30天使用权 · 不自动续费 · 保留剩余天数 · 使用Kaia USDT支付",
      checkout: "开通 MemeCatch Plus",
      sameEmail: "订单金额为10美元，并通过Unifi Wallet使用Kaia USDT支付。剩余使用期会被保留并顺延30天；退款经客服审核后手动退回原付款钱包。",
      freeName: "免费",
      plusName: "Plus",
      featuresTitle: "订阅 Plus 能解锁什么？",
      comparisonTitle: "先免费体验，需要时再升级",
      features: [
        {
          label: "含义、起源和来源",
          free: "包含",
          plus: "包含",
          detail:
            "每个迷因的含义、起源和来源始终免费阅读。订阅 Plus 后，这项基础词典功能依旧保留。",
        },
        {
          label: "兴趣趋势雷达",
          free: "不包含",
          plus: "完整使用",
          detail:
            "选择你的兴趣，个性化雷达会汇集当下正在流行的迷因。Plus 解锁完整雷达。",
        },
        {
          label: "收藏迷因与再利用雷达",
          free: "10条",
          plus: "无限 + 再利用雷达",
          detail:
            "收藏喜欢的迷因，之后随时回来查看。Plus 可无限收藏，并会按当前趋势和使用信号重新呈现给你。",
        },
        {
          label: "无广告体验",
          free: "显示广告",
          plus: "无广告",
          detail:
            "免费版会显示底部横幅和自动广告。订阅 Plus 后，整个网站的广告都会消失，让你专注于迷因。",
        },
        {
          label: "迷因使用包",
          free: "锁定预览",
          plus: "复制解释、发布和安全提示",
          detail:
            "将经过审核的含义、使用说明、注意事项和趋势状态整理成可直接复制的解释、发布和语境检查文字。不新增未经记录的事实。",
        },
        {
          label: "Plus Daily Signal 邮件",
          free: "不包含",
          plus: "每天一封 · 优先收藏迷因",
          detail:
            "开启接收后，每天通过一封邮件查看收藏迷因的上升信号和关注领域动态。邮件只包含已审核内容和当前信号，也可以选择邮件语言。",
        },
        {
          label: "Global Meme Daily",
          free: "锁定预览",
          plus: "每天3道题 + 连续记录",
          detail:
            "每天只选择韩文、英文、日文、简体中文和繁体中文都完成最新审核的迷因，用三道题真正掌握它。",
        },
      ],
    },
    dashboard: {
      eyebrow: "MY PLUS",
      activeTitle: "完成今天的一张迷因卡",
      activeBody: "挑选一个已审核迷因，准备可直接发布的卡片，并记录实际使用的结果。",
      upgradeTitle: "从今天的一个已审核迷因开始",
      upgradeBody: "MemeCatch Plus把今天的一张迷因从挑选、准备到使用记录连在一起。",
      viewPlans: "查看Plus方案",
      membershipStatus: "会员状态",
      active: "使用中",
      renews: "权限确认至",
      extend: "延长使用权",
      expiringSoon: (days: number) => days <= 0 ? "使用权今天到期。立即续期即可继续使用。" : `使用权将在 ${days} 天后到期，建议提前续期。`,
      billingHelp: "取消与退款咨询",
      syncNote: "购买后关联可能需要一点时间。请确认使用了相同的邮箱。",
      checkoutConfirming: "正在确认您的付款… 可能需要片刻。",
      checkoutConfirmed: "付款已确认！Plus 已开始生效。",
      checkoutTimeout: "确认尚未到达。请稍后刷新 — 您的付款正在安全处理中。",
      startOneCut: "开始你的第一张迷因卡",
      moreTools: "更多 Plus 工具",
      primaryMissionUnavailable: {
        eyebrow: "PLUS 状态",
        heading: "暂时无法选择下一步行动",
        body: "无法加载 Action Inbox、Global Daily 和成果数据。请稍后再试。",
      },
      historyTitle: "付款记录",
      historyEmpty: "暂无付款记录。",
      historyCanceled: "已取消",
      savedMemeWatchTitle: "已收藏迷因的上升提醒",
      savedMemeWatchDescription: (count) => `我们正在关注你收藏的 ${count} 个迷因。它上升时会通知你。`,
      savedMemeWatchEmpty: "你还没有收藏迷因。收藏后，我们会在它上升时提醒你。",
      contextWatch: {
        eyebrow: "PLUS CONTEXT WATCH",
        title: "已收藏迷因的审核变化",
        summary: (count, unread) => `${count} 个收藏迷因有需要查看的变化${unread > 0 ? ` · ${unread} 个未读` : ""}。`,
        emptyBody: (count) => count > 0 ? `我们正在关注你收藏的 ${count} 个迷因。安全、使用语境和翻译审核变化会优先显示在这里。` : "收藏一个迷因后，重要的安全、使用语境和翻译审核变化会优先通知你。",
        markRead: "全部标为已读",
        marking: "处理中…",
        markedRead: "已将全部变化标为已读。",
        markFailed: "无法标记为已读，请稍后重试。",
        open: "查看变化",
        unread: "未读",
        kinds: {
          editorial_update: "内容更新",
          safety_update: "安全信号变化",
          translation_reviewed: "翻译已审核",
          translation_stale: "需要重新审核翻译",
          lifecycle_update: "趋势阶段变化",
        },
      },
      actionInbox: {
        eyebrow: "PLUS ACTION INBOX",
        heading: "今天的迷因成果",
        body: "把已审核的全球迷因整理成本地化卡片，并在实际使用后记录今天的成果。",
        contentLanguageLabel: "内容语言",
        outcome: {
          ready: (count) => `今天有 ${count} 个已审核迷因可以使用。`,
          prepared: (count) => `已准备 ${count} 张卡片。使用后再记录为已使用。`,
          complete: (count, currentStreak) => `今天的成果已完成 · 使用 ${count} 个 · 连续 ${currentStreak} 天`,
        },
        open: "打开迷因",
        copyAction: "复制使用文字",
        shareAction: "分享",
        completeAction: "标记为已使用",
        completing: "记录中…",
        completed: "已记录为今天使用过。",
        actionFailed: "无法保存这项行动，请稍后重试。",
        completionUnavailable: "暂时无法读取使用记录。",
        progress: (completedTodayCount, currentStreak) => `今天使用 ${completedTodayCount} 个 · 连续 ${currentStreak} 天`,
        kindLabels: {
          outcome_replay: "复用成果",
          translation_ready: "翻译完成",
          saved_signal: "收藏信号",
          new_reviewed: "新审核迷因",
        },
        empty: {
          heading: "现在没有需要行动的内容",
          body: "新翻译或上升信号准备好后，会优先显示在这里。",
        },
        unavailable: {
          heading: "暂时无法读取行动收件箱",
          body: "无法确认Plus信号，请稍后再试。",
        },
        partialUnavailable: (count) => `有 ${count} 个信号来源无法确认，目前只显示可用内容。`,
        creatorPack: {
          title: "今天的 Creator Pack",
          body: "选择发布渠道后，可仅使用已审核文案一次准备对应渠道的本地化草稿、安全检查和分享卡片。",
          exampleLabel: "适合什么场景？",
          examplePreview: "已审核的一句话",
          exampleUnavailable: "暂无已审核的使用示例，因此不会生成新句子。",
          includeMoreLabel: "加入其他可用卡片",
          includeMoreDescription: "为每张卡片选择已审核的场景，然后一起准备。",
          create: "制作 Creator Pack",
          channelRequired: "请先选择发布渠道。",
          recommended: (count) => `根据最近 ${count} 次结果推荐`,
          preparing: "正在准备卡片…",
          shared: "已打开分享面板。",
          shareAgain: "再次分享已准备的卡片",
          downloadAgain: "再次保存卡片",
          reusable: (count) => `已保留 ${count} 张卡片，随时可以再次分享或保存。`,
          fallback: "已复制配文并保存卡片。",
          downloaded: "已保存卡片。请手动复制配文。",
          partial: (succeeded, failed) => `已准备 ${succeeded} 张卡片，跳过 ${failed} 张。`,
          error: "无法准备 Creator Pack，请稍后重试。",
          empty: "现在没有可以制成卡片的已审核行动。",
          ready: (count) => `已准备 ${count} 张卡片。使用后可以将它们记录为已使用。`,
          complete: (count) => `记录 ${count} 张卡片为已使用`,
          completing: "正在记录使用…",
          completed: (count) => `已将 ${count} 张卡片记录为已使用。`,
          partialCompleted: (succeeded, failed) => `已记录 ${succeeded} 张，${failed} 张可以重试。`,
          completionError: "无法记录使用情况，已准备的卡片仍可重试。",
        },
      },
      actionQueue: {
        eyebrow: "PLUS ACTION QUEUE",
        title: "今天可以做什么",
        summary: (count) => `我们从你收藏的 ${count} 个迷因中选出了下一步行动。`,
        emptyTitle: "先收藏一个迷因，开始你的队列",
        emptyBody: "收藏迷因后，Plus 会根据当前热度和使用信号整理下一步行动。",
        explore: "发现迷因",
        useNow: { description: "它仍在流行且使用信号为 green。打开使用包，马上开始。", cta: "打开使用包" },
        checkContext: { description: "它仍在流行，但使用前最好先确认语境。", cta: "确认语境" },
        review: { description: "热度或使用信号需要更多留意。分享前先重新查看。", cta: "重新查看" },
      },
      weeklyBrief: {
        eyebrow: "PLUS WEEKLY BRIEF",
        title: "本周发生变化的迷因",
        summary: (count) => `我们比较了符合你收藏或兴趣的 ${count} 个候选，最多显示 5 个有近 7 天记录的内容。`,
        window: (from, to) => `${from}–${to} · KST`,
        sourceSaved: "来自已收藏迷因",
        sourceInterest: "来自你的兴趣",
        openTrend: "查看趋势",
        emptyNoCandidates: "目前没有可比较的 green 且正在流行的候选迷因。",
        coverageEmpty: "这个语言还没有可用的人工审核周度候选迷因。",
        emptyInsufficientHistory: "还没有候选迷因积累至少两天的趋势记录。",
        emptyNoChange: "已有至少两天的趋势记录，但近 7 天还没有上升的候选迷因。",
        unavailable: "暂时无法加载每周趋势，请稍后再试。",
      },
      radar: {
        eyebrow: "SAVED REUSE RADAR",
        title: "现在怎样使用已收藏的迷因？",
        summary: (count) => `我们按当前热度和使用信号整理了你收藏的 ${count} 个迷因。`,
        openLibrary: "打开我的收藏",
        emptyTitle: "暂时没有可重新发现的迷因",
        emptyBody: "收藏喜欢的迷因后，这个雷达会结合当前趋势和使用信号重新呈现给你。",
        explore: "发现迷因",
        readyNow: {
          title: "现在适合使用",
          description: "仍在流行且使用信号为 green 的已收藏迷因。",
          empty: "目前没有可直接推荐使用的收藏迷因。",
        },
        checkContext: {
          title: "先确认语境",
          description: "仍在流行，但使用前需要先确认语境的已收藏迷因。",
          empty: "没有需要额外确认语境的当前收藏迷因。",
        },
        archive: {
          title: "稍后再看",
          description: "热度已经降温，或当前使用信号需要更多留意的已收藏迷因。",
          empty: "目前没有需要暂时留存的收藏迷因。",
        },
        lifecycle: { rising: "上升中", active: "流行中", cooling: "降温中", archived: "已归档" },
      },
    },
    feed: {
      personalRadar: "你的专属趋势雷达",
      fresh: "最近收录的迷因",
      editInterests: "编辑兴趣",
      setInterests: "设置兴趣",
      fallback: "设置兴趣后，我们会优先显示符合喜好的上升迷因。目前先显示最近收录的内容。",
      englishContent: "英文人工审核内容",
      localizedEmpty: "目前还没有这个语言的人工审核迷因。",
      localizedUnavailable: "无法加载人工审核的全球内容，请稍后重试。",
      empty: "暂时没有可显示的迷因。",
      explore: "发现迷因",
    },
    trend: {
      title: "趋势变化",
      plusBadge: "Plus",
      failed: "无法加载趋势变化，请稍后重试。",
      lockedDescription: "Plus 可显示这个迷因随时间传播的每日浏览、互动和趋势分数，帮你判断它正在上升还是已经过去。",
      lockedBadge: "Plus 专属",
      loginToView: "登录后查看",
      upgradeToView: "使用 Plus 查看趋势",
      noData: "暂时还没有足够的历史数据绘制图表。我们每天记录一次，请几天后再查看。",
      metricTrendScore: "趋势分数",
      metricViews: "浏览",
      metricReactions: "互动",
      current: "当前",
      periodHigh: "期间最高",
      change: "变化",
      windowSummary: (days) => `${days} 天观察摘要`,
      observedUp: "最后的趋势分数高于首次观察值。",
      observedDown: "最后的趋势分数低于首次观察值。",
      observedFlat: "首次和最后的趋势分数相同。",
      observedInsufficient: "至少需要两个不同日期的观察值。",
      observedBasis: "观察依据",
      observedEvidence: (start, end, views, reactions, saves) => `观察值 ${start}→${end} · 浏览 ${views} · 互动 ${reactions} · 收藏 ${saves}`,
      sampleCoverage: (samples, days, percent) => `样本 ${samples}/${days} 天 · 覆盖率 ${percent}%`,
      confidenceHigh: "样本可信度高",
      confidenceMedium: "样本可信度中等",
      confidenceLow: "样本可信度低",
      confidenceInsufficient: "样本不足，无法判断可信度",
      lastObserved: (date) => `最后观察日 ${date}`,
      lastObservedUnavailable: "暂无观察更新",
      chartLabel: (metric, start, end, current, high) => `${metric}变化 — ${start} 至 ${end}，当前 ${current}，最高 ${high}`,
    },
    alerts: {
      buttonLabel: "趋势提醒",
      title: "趋势提醒",
      plusBadge: "PLUS",
      loading: "加载中…",
      empty: "暂时没有上升提醒。你关注的分类或收藏的迷因上升时会通知你。",
      manageInterests: "设置兴趣",
      categoryRising: "兴趣内容正在上升",
      savedRising: "收藏的迷因正在上升",
      unread: "未读",
    },
    kit: {
      eyebrow: "PLUS USE KIT",
      title: "这个迷因的使用包",
      description: "把页面显示的信息整理成解释、发布和语境检查文字。",
      plusBadge: "PLUS",
      lockedTitle: "不只阅读，马上使用",
      lockedBody: "Plus 会把这个迷因的含义和使用信号整理成可以直接发送的文字。",
      upgrade: "解锁使用包",
      open: "打开使用包",
      copyAll: "复制全部三段",
      shareAll: "分享",
      copied: "已复制",
      shared: "已分享",
      prepared: "准备好了。需要时可以直接发送相应文字。",
      copy: "复制",
      copyFailed: "无法复制，请手动选择文字。",
      sourceNote: "此使用包只使用页面上显示的信息。公开发布前请确认原始语境。",
      explainTitle: "向朋友解释",
      captionTitle: "发布文案",
      safetyTitle: "使用前安全检查",
      safetyLabel: "使用信号",
      usageLabel: "使用说明",
      cautionLabel: "注意",
      trendLabel: "趋势状态",
      noGuidance: "暂未记录额外的使用说明。",
      safety: { green: "通常可以使用", yellow: "请确认语境", gray: "大多已经过时", red: "使用时请注意" },
      lifecycle: { rising: "上升中", active: "流行中", cooling: "降温中", archived: "已归档" },
    },
    translationPriority: {
      eyebrow: "PLUS TRANSLATION DESK",
      title: "为收藏的迷因优先请求本地化审核",
      body: "把你需要的语言加入运营者队列。翻译会先与最新韩文原文核对，再公开发布。",
      saveRequired: "请先收藏这个迷因，再请求优先审核。",
      request: "请求优先审核",
      requesting: "请求中…",
      requested: "已加入审核队列。",
      inReview: "编辑正在审核。",
      track: "在 Plus 中查看请求进度",
      completed: "翻译审核已完成。重新打开此语言页面即可查看。",
      alreadyAvailable: "此语言翻译已经是最新人工审核版本。",
      upgrade: "使用 Plus 请求",
      retry: "无法提交请求，请稍后重试。",
    },
    translationFulfillment: {
      heading: "翻译请求中心",
      body: "查看收藏迷因的翻译请求进度，审核完成后直接打开对应语言页面。",
      statusLabels: { requested: "等待审核", in_review: "审核中", ready: "可以打开", stale: "需要重新确认", source_incomplete: "原文需要补充", dismissed: "暂缓" },
      timestampLabels: { requested: "请求时间", in_review: "更新时间", ready: "完成时间", stale: "完成确认", source_incomplete: "原文确认", dismissed: "更新时间" },
      openLink: "打开语言页面",
      empty: { heading: "还没有翻译请求", body: "在已收藏迷因的详情页请求语言审核后，可以在这里查看进度。" },
      unavailable: { heading: "暂时无法读取请求", body: "无法确认翻译请求状态，请稍后再试。" },
    },
    save: {
      loginGate: "登录后即可收藏迷因。",
      savedButton: "已收藏",
      saveButton: "收藏这个迷因",
      saved: "已收藏到我的页面。",
      removed: "已取消收藏。",
      retry: "请稍后再试。",
      limitReached: "10条免费收藏额度已用完。",
      upgrade: "升级Plus无限收藏",
    },
    my: {
      unlimited: "无限收藏",
      freeLimit: (count, limit) => `已收藏 ${count}/${limit}`,
      paginationLabel: "已收藏迷因分页",
      previousPage: "上一页",
      nextPage: "下一页",
      pageStatus: (page, total) => `第 ${page} / ${total} 页`,
    },
  },
} satisfies Record<"ko" | "en" | "ja" | "zh", PremiumCopy>;

const PREMIUM_COPY_WITH_FALLBACK = withLocaleFallback<PremiumCopy>(PREMIUM_COPY_BASE);

const ZH_TW_FEED_COPY: PremiumCopy["feed"] = {
  personalRadar: "你的專屬趨勢雷達",
  fresh: "最近收錄的迷因",
  editInterests: "編輯興趣",
  setInterests: "設定興趣",
  fallback: "設定興趣後，我們會優先顯示符合喜好的上升迷因。目前先顯示最近收錄的內容。",
  englishContent: "英文人工審核內容",
  localizedEmpty: "目前還沒有這個語言的人工審核迷因。",
  localizedUnavailable: "無法載入人工審核的全球內容，請稍後重試。",
  empty: "暫時沒有可顯示的迷因。",
  explore: "探索迷因",
};

const ZH_TW_ACTION_INBOX_COPY: PremiumCopy["dashboard"]["actionInbox"] = {
  ...PREMIUM_COPY_WITH_FALLBACK["zh-tw"].dashboard.actionInbox,
  heading: "今天的迷因成果",
  body: "把已審核的全球迷因整理成本地化卡片，並在實際使用後記錄今天的成果。",
  outcome: {
    ready: (count) => `今天有 ${count} 個已審核迷因可以使用。`,
    prepared: (count) => `已準備 ${count} 張卡片。使用後再記錄為已使用。`,
    complete: (count, currentStreak) => `今天的成果已完成 · 使用 ${count} 個 · 連續 ${currentStreak} 天`,
  },
  creatorPack: {
    ...PREMIUM_COPY_WITH_FALLBACK["zh-tw"].dashboard.actionInbox.creatorPack,
    title: "今天的 Creator Pack",
    body: "選擇發布渠道後，可僅使用已審核文案一次準備對應渠道的在地化草稿、安全檢查與分享卡片。",
    exampleLabel: "適合什麼情境？",
    examplePreview: "已審核的一句話",
    exampleUnavailable: "目前沒有已審核的使用範例，因此不會生成新句子。",
    includeMoreLabel: "加入其他可用卡片",
    includeMoreDescription: "為每張卡片選擇已審核的情境，再一起準備。",
    create: "製作 Creator Pack",
    channelRequired: "請先選擇發布渠道。",
    recommended: (count) => `根據最近 ${count} 次結果推薦`,
    preparing: "正在準備卡片…",
    shared: "已開啟分享面板。",
    shareAgain: "再次分享已準備的卡片",
    downloadAgain: "再次儲存卡片",
    reusable: (count) => `已保留 ${count} 張卡片，隨時可以再次分享或儲存。`,
    fallback: "已複製文案並儲存卡片。",
    downloaded: "已儲存卡片。請手動複製文案。",
    partial: (succeeded, failed) => `已準備 ${succeeded} 張卡片，略過 ${failed} 張。`,
    error: "無法準備 Creator Pack，請稍後重試。",
    empty: "目前沒有可以製成卡片的已審核行動。",
    ready: (count) => `已準備 ${count} 張卡片。使用後可以將它們記錄為已使用。`,
    complete: (count) => `將 ${count} 張卡片記錄為已使用`,
    completing: "正在記錄使用…",
    completed: (count) => `已將 ${count} 張卡片記錄為已使用。`,
    partialCompleted: (succeeded, failed) => `已記錄 ${succeeded} 張，${failed} 張可以重試。`,
    completionError: "無法記錄使用情況，已準備的卡片仍可重試。",
  },
};

const ZH_TW_WEEKLY_BRIEF_COPY: PremiumCopy["dashboard"]["weeklyBrief"] = {
  ...PREMIUM_COPY_WITH_FALLBACK["zh-tw"].dashboard.weeklyBrief,
  eyebrow: "PLUS WEEKLY BRIEF",
  title: "本週變化的迷因",
  summary: (count) => `我們比較了符合你收藏或興趣的 ${count} 個候選，只保留近 7 天有明顯變化的內容。`,
  window: (from, to) => `${from}–${to} · KST`,
  sourceSaved: "來自已收藏迷因",
  sourceInterest: "來自你的興趣",
  openTrend: "查看趨勢",
  emptyNoCandidates: "目前沒有可比較的 green 且正在流行的候選迷因。",
  coverageEmpty: "目前還沒有可用的人工審核週度候選迷因。",
  emptyInsufficientHistory: "還沒有候選迷因累積至少兩天的趨勢記錄。",
  emptyNoChange: "已有至少兩天的趨勢記錄，但近 7 天還沒有上升的候選迷因。",
  unavailable: "暫時無法載入每週趨勢，請稍後再試。",
};

export const PREMIUM_COPY: Record<Locale, PremiumCopy> = {
  ...PREMIUM_COPY_WITH_FALLBACK,
  "zh-tw": {
    ...PREMIUM_COPY_WITH_FALLBACK["zh-tw"],
    pricing: {
      ...PREMIUM_COPY_WITH_FALLBACK["zh-tw"].pricing,
      eyebrow: "少花時間決定今天要用的迷因",
      title: "今天就能使用的已審核迷因",
      intro: "挑選今天的已審核迷因，準備成可直接發布的卡片，再在同一處記錄實際使用結果。",
    },
    dashboard: {
      ...PREMIUM_COPY_WITH_FALLBACK["zh-tw"].dashboard,
      activeTitle: "完成今天的一張迷因卡",
      activeBody: "挑選一個已審核迷因，準備可直接發布的卡片，並記錄實際使用的結果。",
      upgradeTitle: "從今天的一個已審核迷因開始",
      upgradeBody: "MemeCatch Plus把今天的一張迷因從挑選、準備到使用記錄連在一起。",
      startOneCut: "開始你的第一張迷因卡",
      actionInbox: ZH_TW_ACTION_INBOX_COPY,
      weeklyBrief: ZH_TW_WEEKLY_BRIEF_COPY,
    },
    feed: ZH_TW_FEED_COPY,
  },
};
