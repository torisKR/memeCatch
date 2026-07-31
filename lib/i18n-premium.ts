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
  };
  feed: {
    personalRadar: string;
    fresh: string;
    editInterests: string;
    setInterests: string;
    fallback: string;
    empty: string;
    explore: string;
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
      eyebrow: "밈을 찾는 시간을 줄이는 구독",
      title: "나만의 밈 트렌드 데스크",
      intro: "관심사에 맞는 급상승 밈을 먼저 보고, 필요한 밈은 한도 없이 저장하세요.",
      monthly: "$20",
      perMonth: "/ 30일",
      launchNote: "30일 이용권 · 자동 갱신 없음",
      checkout: "MemeCatch Plus 시작하기",
      sameEmail: "결제가 끝나면 로그인한 계정에 30일 이용권이 자동으로 연결돼요. 만료되면 다시 결제해 연장할 수 있어요.",
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
          label: "밈 저장",
          free: "30개",
          plus: "무제한",
          detail:
            "마음에 든 밈을 저장해 두고 나중에 다시 찾아봐요. 무료는 30개까지, Plus는 무제한으로 모을 수 있어요.",
        },
        {
          label: "광고 없는 경험",
          free: "광고 표시",
          plus: "광고 없음",
          detail:
            "무료에서는 하단 배너와 자동 광고가 표시돼요. Plus를 구독하면 사이트 전체에서 광고가 사라져 밈에만 집중할 수 있어요.",
        },
      ],
    },
    dashboard: {
      eyebrow: "MY PLUS",
      activeTitle: "오늘의 트렌드를 먼저 확인하세요",
      activeBody: "관심사에 맞춘 급상승 밈과 Plus 이용 상태를 한곳에서 확인할 수 있어요.",
      upgradeTitle: "나만의 트렌드 레이더를 열어보세요",
      upgradeBody: "MemeCatch Plus에서 관심사 맞춤 피드와 무제한 저장을 이용할 수 있어요.",
      viewPlans: "Plus 요금제 보기",
      membershipStatus: "멤버십 상태",
      active: "이용 중",
      renews: "이용 확인 기한",
      extend: "이용 연장하기",
      expiringSoon: (days: number) => days <= 0 ? "오늘 만료돼요. 지금 연장하면 이어서 쓸 수 있어요." : `${days}일 뒤 만료돼요. 미리 연장해 두세요.`,
      billingHelp: "취소·환불 문의",
      syncNote: "구매 직후 연결까지 잠시 걸릴 수 있어요. 같은 이메일을 사용했는지 확인해 주세요.",
    },
    feed: {
      personalRadar: "나만의 트렌드 레이더",
      fresh: "최근 등록된 밈",
      editInterests: "관심사 수정",
      setInterests: "관심사 설정",
      fallback: "관심사를 설정하면 취향에 맞는 급상승 밈을 먼저 보여드려요. 지금은 최근 등록된 밈이에요.",
      empty: "아직 보여드릴 밈이 없어요.",
      explore: "탐색하러 가기",
    },
    save: {
      loginGate: "로그인하면 밈을 저장할 수 있어요.",
      savedButton: "저장한 밈",
      saveButton: "이 밈 저장하기",
      saved: "MY에 저장했어요.",
      removed: "저장을 해제했어요.",
      retry: "잠시 후 다시 시도해 주세요.",
      limitReached: "무료 저장 한도 30개를 모두 사용했어요.",
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
      eyebrow: "Spend less time hunting for memes",
      title: "Your personal Korean meme trend desk",
      intro: "See rising memes matched to your interests first and save everything you need without a limit.",
      monthly: "$20",
      perMonth: "/ 30 days",
      launchNote: "30-day pass · does not auto-renew",
      checkout: "Start MemeCatch Plus",
      sameEmail: "Your 30-day pass is linked to the account you are signed in with. When it expires, pay again to extend.",
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
          label: "Saved memes",
          free: "30",
          plus: "Unlimited",
          detail:
            "Save the memes you love and find them again later. Free stops at 30; Plus lets you collect without limit.",
        },
        {
          label: "Ad-free experience",
          free: "Ads shown",
          plus: "No ads",
          detail:
            "The free tier shows a bottom banner and auto ads. Subscribe to Plus and ads disappear across the whole site so you can focus on the memes.",
        },
      ],
    },
    dashboard: {
      eyebrow: "MY PLUS",
      activeTitle: "Get ahead of today’s trends",
      activeBody: "Your interest-based rising memes and Plus status are together in one place.",
      upgradeTitle: "Unlock your personal trend radar",
      upgradeBody: "MemeCatch Plus gives you an interest-based feed and unlimited saves.",
      viewPlans: "View Plus plan",
      membershipStatus: "Membership status",
      active: "Active",
      renews: "Access confirmed through",
      extend: "Extend access",
      expiringSoon: (days: number) => days <= 0 ? "Your pass expires today. Extend now to keep access." : `Your pass expires in ${days} days. Extend it in advance.`,
      billingHelp: "Cancellation & refund help",
      syncNote: "Connection may take a moment after purchase. Make sure you used the same email.",
    },
    feed: {
      personalRadar: "Your personal trend radar",
      fresh: "Recently added memes",
      editInterests: "Edit interests",
      setInterests: "Set interests",
      fallback: "Set your interests to see relevant rising memes first. Here are recent additions for now.",
      empty: "There are no memes to show yet.",
      explore: "Explore memes",
    },
    save: {
      loginGate: "Log in to save memes.",
      savedButton: "Saved",
      saveButton: "Save this meme",
      saved: "Saved to MY.",
      removed: "Removed from saved memes.",
      retry: "Please try again in a moment.",
      limitReached: "You have used all 30 free saves.",
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
      eyebrow: "ミーム探しの時間を短縮するサブスク",
      title: "自分専用の韓国ミーム・トレンドデスク",
      intro: "興味に合う急上昇ミームを先に確認し、必要なミームを上限なく保存できます。",
      monthly: "$20",
      perMonth: "/ 30日",
      launchNote: "30日間の利用券・自動更新なし",
      checkout: "MemeCatch Plusを始める",
      sameEmail: "決済が完了すると、ログイン中のアカウントに30日間の利用券が連携されます。期限が切れたら再度決済して延長できます。",
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
          label: "ミーム保存",
          free: "30件",
          plus: "無制限",
          detail:
            "気に入ったミームを保存して後で見返せます。無料は30件まで、Plusは無制限に集められます。",
        },
        {
          label: "広告なしの体験",
          free: "広告あり",
          plus: "広告なし",
          detail:
            "無料では下部バナーと自動広告が表示されます。Plusに登録するとサイト全体から広告が消え、ミームに集中できます。",
        },
      ],
    },
    dashboard: {
      eyebrow: "MY PLUS",
      activeTitle: "今日のトレンドを一足先にチェック",
      activeBody: "興味に合う急上昇ミームとPlusの利用状況を一か所で確認できます。",
      upgradeTitle: "自分専用トレンドレーダーを開く",
      upgradeBody: "MemeCatch Plusなら、興味に合うフィードと無制限保存を利用できます。",
      viewPlans: "Plusプランを見る",
      membershipStatus: "メンバーシップ状況",
      active: "利用中",
      renews: "利用確認期限",
      extend: "利用を延長する",
      expiringSoon: (days: number) => days <= 0 ? "本日で期限が切れます。今すぐ延長すれば続けて利用できます。" : `あと${days}日で期限が切れます。早めに延長してください。`,
      billingHelp: "キャンセル・返金のお問い合わせ",
      syncNote: "購入後の連携には少し時間がかかる場合があります。同じメールアドレスを使用したか確認してください。",
    },
    feed: {
      personalRadar: "自分専用トレンドレーダー",
      fresh: "最近追加されたミーム",
      editInterests: "興味を編集",
      setInterests: "興味を設定",
      fallback: "興味を設定すると、好みに合う急上昇ミームを先に表示します。今は最近追加されたミームです。",
      empty: "表示できるミームはまだありません。",
      explore: "ミームを探す",
    },
    save: {
      loginGate: "ログインするとミームを保存できます。",
      savedButton: "保存済み",
      saveButton: "このミームを保存",
      saved: "MYに保存しました。",
      removed: "保存を解除しました。",
      retry: "しばらくしてからもう一度お試しください。",
      limitReached: "無料保存枠30件をすべて使用しました。",
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
      eyebrow: "减少寻找迷因时间的订阅",
      title: "你的专属韩国迷因趋势台",
      intro: "优先查看符合兴趣的上升迷因，并无限收藏所有需要的内容。",
      monthly: "$20",
      perMonth: "/ 30天",
      launchNote: "30天使用权 · 不自动续费",
      checkout: "开通 MemeCatch Plus",
      sameEmail: "支付完成后，30天使用权会自动关联到您登录的账号。到期后可再次支付续期。",
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
          label: "收藏迷因",
          free: "30条",
          plus: "无限",
          detail:
            "收藏你喜欢的迷因，稍后再回来查看。免费最多 30 条，Plus 可无限收藏。",
        },
        {
          label: "无广告体验",
          free: "显示广告",
          plus: "无广告",
          detail:
            "免费版会显示底部横幅和自动广告。订阅 Plus 后，整个网站的广告都会消失，让你专注于迷因。",
        },
      ],
    },
    dashboard: {
      eyebrow: "MY PLUS",
      activeTitle: "抢先掌握今天的趋势",
      activeBody: "在一个页面查看符合兴趣的上升迷因和Plus使用状态。",
      upgradeTitle: "解锁你的专属趋势雷达",
      upgradeBody: "MemeCatch Plus提供兴趣推荐和无限收藏。",
      viewPlans: "查看Plus方案",
      membershipStatus: "会员状态",
      active: "使用中",
      renews: "权限确认至",
      extend: "延长使用权",
      expiringSoon: (days: number) => days <= 0 ? "使用权今天到期。立即续期即可继续使用。" : `使用权将在 ${days} 天后到期，建议提前续期。`,
      billingHelp: "取消与退款咨询",
      syncNote: "购买后关联可能需要一点时间。请确认使用了相同的邮箱。",
    },
    feed: {
      personalRadar: "你的专属趋势雷达",
      fresh: "最近收录的迷因",
      editInterests: "编辑兴趣",
      setInterests: "设置兴趣",
      fallback: "设置兴趣后，我们会优先显示符合喜好的上升迷因。目前先显示最近收录的内容。",
      empty: "暂时没有可显示的迷因。",
      explore: "发现迷因",
    },
    save: {
      loginGate: "登录后即可收藏迷因。",
      savedButton: "已收藏",
      saveButton: "收藏这个迷因",
      saved: "已收藏到我的页面。",
      removed: "已取消收藏。",
      retry: "请稍后再试。",
      limitReached: "30条免费收藏额度已用完。",
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

export const PREMIUM_COPY: Record<Locale, PremiumCopy> = withLocaleFallback<PremiumCopy>(PREMIUM_COPY_BASE);
