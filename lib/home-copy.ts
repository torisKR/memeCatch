import type { SeoRouteLocale } from "@/lib/i18n-routing";

export const HOME_LOCALES = ["ko", "en", "ja", "zh", "zh-tw"] as const satisfies readonly SeoRouteLocale[];

type HomeLinkCopy = {
  label: string;
  href: "/editorial" | "/about" | "/privacy";
};

export type HomeCopy = {
  hero: {
    eyebrow: string;
    title: string;
    intro: string;
    searchLabel: string;
    searchPlaceholder: string;
    searchButton: string;
    sceneLabel: string;
    pauseScene: string;
    playScene: string;
  };
  recent: {
    eyebrow: string;
    title: string;
    description: string;
    read: string;
    originalLabel: string;
    empty: string;
    emptyAction: string;
    all: string;
  };
  pathways: {
    eyebrow: string;
    title: string;
    description: string;
    contributionLabel: string;
    submitAction: string;
    community: { title: string; description: string; action: string; createAction: string };
    products: { title: string; description: string; action: string; createAction: string };
  };
  trust: {
    eyebrow: string;
    title: string;
    description: string;
    links: [HomeLinkCopy, HomeLinkCopy, HomeLinkCopy];
  };
};

export const HOME_COPY: Record<SeoRouteLocale, HomeCopy> = {
  ko: {
    hero: {
      eyebrow: "뜻 · 유래 · 사용 맥락",
      title: "밈의 뜻을 찾고, 쓸 맥락까지 확인하세요.",
      intro: "처음 본 유행어부터 익숙한 짤까지, 뜻과 출처를 읽고 네 가지 사용 신호로 맥락을 살펴보세요.",
      searchLabel: "밈 검색",
      searchPlaceholder: "궁금한 밈이나 유행어를 검색하세요",
      searchButton: "검색",
      sceneLabel: "오렌지색 입체 말풍선 심벌과 금속 카드, 네 가지 맥락 신호를 조작하는 스튜디오",
      pauseScene: "장면 멈추기",
      playScene: "장면 재생하기",
    },
    recent: {
      eyebrow: "최근 기록",
      title: "새로 정리된 밈",
      description: "지금 읽을 수 있도록 공개된 설명에서 최근 항목을 모았습니다.",
      read: "뜻과 유래 읽기",
      originalLabel: "원문",
      empty: "지금은 최근 항목을 표시할 수 없습니다. 공개 항목이 없거나 연결이 원활하지 않을 수 있어요. 잠시 후 다시 열거나 밈 검색을 이용해 주세요.",
      emptyAction: "밈 검색하기",
      all: "전체 밈 보기",
    },
    pathways: {
      eyebrow: "함께 만드는 밈 사전",
      title: "읽은 다음, 이야기하고 발견하세요.",
      description: "커뮤니티에서 맥락을 나누거나 밈과 연결된 상품을 둘러볼 수 있습니다.",
      contributionLabel: "직접 발견한 맥락이 있나요?",
      submitAction: "밈 제보",
      community: {
        title: "커뮤니티",
        description: "밈을 어디서 봤는지, 어떤 맥락이 더 필요한지 이야기해 보세요.",
        action: "커뮤니티 가기",
        createAction: "이야기 나누기",
      },
      products: {
        title: "밈 상품",
        description: "판매 주체와 연결 관계를 표시한 밈 관련 상품을 둘러보세요.",
        action: "상품 둘러보기",
        createAction: "내 밈 상품 등록",
      },
    },
    trust: {
      eyebrow: "편집 정보",
      title: "설명을 읽기 전에 기준도 확인할 수 있어요.",
      description: "사용 신호는 법적 허가나 실시간 안전 보장이 아니라, 공개된 정보와 맥락을 이해하도록 돕는 편집 안내입니다.",
      links: [
        { label: "편집 원칙", href: "/editorial" },
        { label: "서비스 소개", href: "/about" },
        { label: "개인정보 처리방침", href: "/privacy" },
      ],
    },
  },
  en: {
    hero: {
      eyebrow: "Meaning · origin · usage context",
      title: "Find the meme. Understand the moment around it.",
      intro: "Look up Korean memes and slang, trace where they came from, and use four practical signals to read the context before you repeat them.",
      searchLabel: "Search memes",
      searchPlaceholder: "Search a Korean meme or phrase",
      searchButton: "Search",
      sceneLabel: "An orange sculptural speech-loop emblem with metallic cards and four interactive context signals",
      pauseScene: "Pause scene",
      playScene: "Play scene",
    },
    recent: {
      eyebrow: "Published translations",
      title: "Start with an available explanation",
      description: "These Korean meme explanations are currently published in English.",
      read: "Read the meaning and origin",
      originalLabel: "Korean original",
      empty: "Recent entries are not available right now. There may be no published entries or a temporary connection issue. Try again shortly or use search.",
      emptyAction: "Search the archive",
      all: "Explore published translations",
    },
    pathways: {
      eyebrow: "Beyond the dictionary",
      title: "Join the conversation or browse meme goods.",
      description: "Continue into MemeCatch’s Korean community and product directories.",
      contributionLabel: "Have context to add?",
      submitAction: "Submit a meme",
      community: {
        title: "Community",
        description: "Share where a meme appeared and which context still needs explaining.",
        action: "Visit the community",
        createAction: "Start a discussion",
      },
      products: {
        title: "Meme products",
        description: "Browse meme-related goods with seller and relationship disclosures.",
        action: "Browse products",
        createAction: "List your meme product",
      },
    },
    trust: {
      eyebrow: "Editorial context",
      title: "Read the method alongside the explanation.",
      description: "Usage signals are editorial context, not legal permission or a guaranteed real-time safety verdict.",
      links: [
        { label: "Editorial policy", href: "/editorial" },
        { label: "About MemeCatch", href: "/about" },
        { label: "Privacy", href: "/privacy" },
      ],
    },
  },
  ja: {
    hero: {
      eyebrow: "意味・由来・使用文脈",
      title: "ミームを探して、使う前に文脈まで理解する。",
      intro: "韓国のミームや流行語の意味と由来を調べ、4つの使用シグナルで今の文脈を確認できます。",
      searchLabel: "ミームを検索",
      searchPlaceholder: "韓国のミームや流行語を検索",
      searchButton: "検索",
      sceneLabel: "オレンジ色の立体吹き出しシンボルとメタルカード、4つの文脈シグナルを操作するスタジオ",
      pauseScene: "シーンを停止",
      playScene: "シーンを再生",
    },
    recent: {
      eyebrow: "公開中の翻訳",
      title: "読める解説から始める",
      description: "現在、日本語で公開されている韓国ミームの解説です。",
      read: "意味と由来を読む",
      originalLabel: "韓国語の原題",
      empty: "最近の項目を現在表示できません。公開された項目がないか、一時的な接続の問題の可能性があります。しばらくしてから再度開くか、検索をご利用ください。",
      emptyAction: "アーカイブを検索",
      all: "公開中の翻訳を見る",
    },
    pathways: {
      eyebrow: "辞典のその先へ",
      title: "会話に参加し、ミーム関連の商品を探す。",
      description: "MemeCatchの韓国語コミュニティと商品ページへ進めます。",
      contributionLabel: "追加したい文脈がありますか？",
      submitAction: "ミームを投稿",
      community: {
        title: "コミュニティ",
        description: "どこで見たミームか、どんな説明が必要かを共有できます。",
        action: "コミュニティを見る",
        createAction: "話題を投稿",
      },
      products: {
        title: "ミーム商品",
        description: "販売者と関係性の表示があるミーム関連商品を見られます。",
        action: "商品を見る",
        createAction: "商品を登録",
      },
    },
    trust: {
      eyebrow: "編集情報",
      title: "解説と一緒に編集方針も確認できます。",
      description: "使用シグナルは文脈を理解するための編集情報であり、法的な許可やリアルタイムの安全を保証するものではありません。",
      links: [
        { label: "編集方針", href: "/editorial" },
        { label: "MemeCatchについて", href: "/about" },
        { label: "プライバシー", href: "/privacy" },
      ],
    },
  },
  zh: {
    hero: {
      eyebrow: "含义・来源・使用语境",
      title: "找到迷因，也读懂使用它的语境。",
      intro: "搜索韩国迷因和流行语，了解它们的含义与来源，并用四种使用提示判断当前语境。",
      searchLabel: "搜索迷因",
      searchPlaceholder: "搜索韩国迷因或流行语",
      searchButton: "搜索",
      sceneLabel: "橙色立体气泡标志、金属卡片与四种可交互语境提示组成的工作室场景",
      pauseScene: "暂停场景",
      playScene: "播放场景",
    },
    recent: {
      eyebrow: "已发布翻译",
      title: "从现有解释开始",
      description: "这些韩国迷因解释目前已有简体中文版本。",
      read: "阅读含义与来源",
      originalLabel: "韩文原名",
      empty: "现在无法显示最近的条目。可能尚无已发布的内容，也可能是临时连接问题。请稍后重试或使用搜索。",
      emptyAction: "搜索资料库",
      all: "浏览已发布翻译",
    },
    pathways: {
      eyebrow: "词典之外",
      title: "加入讨论，或浏览迷因相关商品。",
      description: "继续前往 MemeCatch 的韩语社区和商品目录。",
      contributionLabel: "有想补充的语境吗？",
      submitAction: "提交迷因",
      community: {
        title: "社区",
        description: "分享你在哪里看到这个迷因，以及还需要补充哪些语境。",
        action: "前往社区",
        createAction: "发起讨论",
      },
      products: {
        title: "迷因商品",
        description: "浏览标明卖家与关联关系的迷因相关商品。",
        action: "浏览商品",
        createAction: "登记迷因商品",
      },
    },
    trust: {
      eyebrow: "编辑信息",
      title: "阅读解释时，也能查看整理标准。",
      description: "使用提示是帮助理解语境的编辑信息，不代表法律许可，也不保证实时安全。",
      links: [
        { label: "编辑原则", href: "/editorial" },
        { label: "关于 MemeCatch", href: "/about" },
        { label: "隐私政策", href: "/privacy" },
      ],
    },
  },
  "zh-tw": {
    hero: {
      eyebrow: "含義・來源・使用語境",
      title: "找到迷因，也讀懂使用它的語境。",
      intro: "搜尋韓國迷因和流行語，了解它們的含義與來源，並用四種使用提示判斷當前語境。",
      searchLabel: "搜尋迷因",
      searchPlaceholder: "搜尋韓國迷因或流行語",
      searchButton: "搜尋",
      sceneLabel: "橙色立體氣泡標誌、金屬卡片與四種可互動語境提示組成的工作室場景",
      pauseScene: "暫停場景",
      playScene: "播放場景",
    },
    recent: {
      eyebrow: "已發布翻譯",
      title: "從現有解釋開始",
      description: "這些韓國迷因解釋目前已有繁體中文版本。",
      read: "閱讀含義與來源",
      originalLabel: "韓文原名",
      empty: "現在無法顯示最近的項目。可能尚無已發布的內容，也可能是暫時的連線問題。請稍後重試或使用搜尋。",
      emptyAction: "搜尋資料庫",
      all: "瀏覽已發布翻譯",
    },
    pathways: {
      eyebrow: "詞典之外",
      title: "加入討論，或瀏覽迷因相關商品。",
      description: "繼續前往 MemeCatch 的韓語社群和商品目錄。",
      contributionLabel: "有想補充的語境嗎？",
      submitAction: "提交迷因",
      community: {
        title: "社群",
        description: "分享你在哪裡看到這個迷因，以及還需要補充哪些語境。",
        action: "前往社群",
        createAction: "發起討論",
      },
      products: {
        title: "迷因商品",
        description: "瀏覽標明賣家與關聯關係的迷因相關商品。",
        action: "瀏覽商品",
        createAction: "登記迷因商品",
      },
    },
    trust: {
      eyebrow: "編輯資訊",
      title: "閱讀解釋時，也能查看整理標準。",
      description: "使用提示是協助理解語境的編輯資訊，不代表法律許可，也不保證即時安全。",
      links: [
        { label: "編輯原則", href: "/editorial" },
        { label: "關於 MemeCatch", href: "/about" },
        { label: "隱私權政策", href: "/privacy" },
      ],
    },
  },
};
