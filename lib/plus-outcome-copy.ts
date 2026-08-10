import { withLocaleFallback, type Locale } from "@/lib/i18n";
import type { PlusOutcomeRating } from "@/lib/plus-outcome-ledger";

export type PlusOutcomeChannel =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "threads"
  | "x"
  | "community"
  | "messaging"
  | "blog"
  | "other";

export type PlusOutcomeArtifactKind =
  | "caption"
  | "single_card"
  | "creator_pack"
  | "link"
  | "other";

export type PlusOutcomeLedgerCopy = {
  receipt: {
    title: string;
    body: string;
    locale: string;
    channel: string;
    artifact: string;
    resultUrl: string;
    performance: string;
    note: string;
    optional: string;
    requiredLabel: string;
    resultRequired: string;
    urlPlaceholder: string;
    performancePlaceholder: string;
    notePlaceholder: string;
    save: string;
    saving: string;
    cancel: string;
    required: string;
    invalid: string;
    conflict: string;
    failed: string;
    privacy: string;
    channelOptions: Record<PlusOutcomeChannel, string>;
    artifactOptions: Record<PlusOutcomeArtifactKind, string>;
  };
  summary: {
    title: string;
    description: string;
    total: (count: number) => string;
    pendingReceipt: (count: number) => string;
    pendingPerformance: (count: number) => string;
    channels: string;
    locales: string;
    artifacts: string;
    empty: string;
    unavailable: string;
    retry: string;
    followUp: {
      title: string;
      description: string;
      recent: string;
      performance: string;
      add: string;
      placeholder: string;
      save: string;
      saving: string;
      cancel: string;
      required: string;
      failed: string;
      saved: string;
      rating: string;
      ratingOptions: Record<PlusOutcomeRating, string>;
      ratingSaving: string;
      ratingFailed: string;
      ratingSaved: string;
    };
    localeNames: Record<"ko" | "en" | "ja" | "zh" | "zh-tw", string>;
  };
};

const OUTCOME_COPY_BASE: {
  ko: PlusOutcomeLedgerCopy;
  en: PlusOutcomeLedgerCopy;
  ja: PlusOutcomeLedgerCopy;
  zh: PlusOutcomeLedgerCopy;
} & Partial<Record<Locale, PlusOutcomeLedgerCopy>> = {
  ko: {
    receipt: {
      title: "활용 완료 영수증",
      body: "어디서 어떤 형태로 사용했는지 남겨두면 다음 주에 나의 밈 활용 기록으로 돌아옵니다.",
      locale: "콘텐츠 언어",
      channel: "사용 채널",
      artifact: "산출물",
      resultUrl: "게시물 URL",
      performance: "성과 메모",
      note: "개인 메모",
      optional: "선택",
      requiredLabel: "필수",
      resultRequired: "One-Cut을 완료하려면 결과 URL을 입력해 주세요.",
      urlPlaceholder: "https://…",
      performancePlaceholder: "예: 저장 12회, 댓글 반응이 좋았어요",
      notePlaceholder: "다음에 바꿔볼 점",
      save: "완료 및 영수증 저장",
      saving: "저장 중…",
      cancel: "취소",
      required: "필수 항목이에요.",
      invalid: "입력 내용을 확인해 주세요.",
      conflict: "오늘 이 밈의 활용 기록은 이미 다른 내용으로 저장됐어요. 기록을 바꾸지 않고 기존 기록을 보존했어요.",
      failed: "저장하지 못했어요. 입력값은 유지되니 다시 시도해 주세요.",
      privacy: "이 기록은 나만 볼 수 있으며 자동 게시나 URL 조회에 사용하지 않아요.",
      channelOptions: {
        instagram: "Instagram",
        tiktok: "TikTok",
        youtube: "YouTube",
        threads: "Threads",
        x: "X",
        community: "커뮤니티",
        messaging: "메신저",
        blog: "블로그·뉴스레터",
        other: "기타",
      },
      artifactOptions: {
        caption: "캡션·문구",
        single_card: "공유 카드",
        creator_pack: "Creator Pack",
        link: "링크",
        other: "기타",
      },
    },
    summary: {
      title: "최근 7일 활용",
      description: "내가 실제로 사용한 밈을 채널과 언어별로 다시 볼 수 있어요.",
      total: (count) => `활용 ${count}회`,
      pendingReceipt: (count) => `영수증 대기 ${count}건`,
      pendingPerformance: (count) => `성과 입력 대기 ${count}건`,
      channels: "채널별",
      locales: "언어별",
      artifacts: "산출물별",
      empty: "최근 7일 활용 기록이 없어요. 오늘 밈을 사용하고 영수증을 남겨 보세요.",
      unavailable: "최근 7일 기록을 불러오지 못했어요. 오늘의 Action Inbox는 계속 사용할 수 있어요.",
      retry: "다시 시도",
      followUp: {
        title: "최근 활용을 회고하기",
        description: "성과가 비어 있는 기록부터 결과를 덧붙여 다음 활용에 반영해 보세요.",
        recent: "최근 활용",
        performance: "성과 메모",
        add: "성과 추가",
        placeholder: "예: 저장 12회, 댓글 반응이 좋았어요",
        save: "성과 저장",
        saving: "저장 중…",
        cancel: "취소",
        required: "성과 메모를 한 줄 남겨 주세요.",
        failed: "저장하지 못했어요. 입력값은 유지되니 다시 시도해 주세요.",
        saved: "성과를 저장했어요.",
        rating: "이번 활용은 어땠나요?",
        ratingOptions: { hit: "좋았어요", neutral: "보통이에요", miss: "아쉬웠어요" },
        ratingSaving: "평가 저장 중…",
        ratingFailed: "평가를 저장하지 못했어요. 다시 시도해 주세요.",
        ratingSaved: "평가를 저장했어요. 다음 추천에 반영할게요.",
      },
      localeNames: { ko: "한국어", en: "English", ja: "日本語", zh: "简体中文", "zh-tw": "繁體中文" },
    },
  },
  en: {
    receipt: {
      title: "Completion receipt",
      body: "Keep a small record of where and how you used it so Plus can become your working meme memory.",
      locale: "Content language",
      channel: "Channel",
      artifact: "Artifact",
      resultUrl: "Post URL",
      performance: "Performance note",
      note: "Private note",
      optional: "optional",
      requiredLabel: "required",
      resultRequired: "Add the result URL before saving this One-Cut.",
      urlPlaceholder: "https://…",
      performancePlaceholder: "e.g. 12 saves and a good reply",
      notePlaceholder: "What to change next time",
      save: "Complete & save receipt",
      saving: "Saving…",
      cancel: "Cancel",
      required: "This field is required.",
      invalid: "Check the fields and try again.",
      conflict: "This meme already has a different use record today. We kept the original record unchanged.",
      failed: "Could not save it. Your entries are still here to retry.",
      privacy: "This stays private. We never fetch the URL or publish for you.",
      channelOptions: {
        instagram: "Instagram",
        tiktok: "TikTok",
        youtube: "YouTube",
        threads: "Threads",
        x: "X",
        community: "Community",
        messaging: "Messaging",
        blog: "Blog or newsletter",
        other: "Other",
      },
      artifactOptions: {
        caption: "Caption or text",
        single_card: "Share card",
        creator_pack: "Creator Pack",
        link: "Link",
        other: "Other",
      },
    },
    summary: {
      title: "Last 7 days",
      description: "See what you actually used, grouped by channel and language.",
      total: (count) => `${count} use${count === 1 ? "" : "s"}`,
      pendingReceipt: (count) => `${count} receipt${count === 1 ? "" : "s"} pending`,
      pendingPerformance: (count) => `${count} waiting for performance`,
      channels: "By channel",
      locales: "By language",
      artifacts: "By artifact",
      empty: "No use recorded in the last 7 days. Use a meme today and save the receipt.",
      unavailable: "Couldn’t load the last 7 days. Today’s Action Inbox is still available.",
      retry: "Retry",
      followUp: {
        title: "Review recent use",
        description: "Add results to the entries that are still waiting, then carry the lesson into your next post.",
        recent: "Recent use",
        performance: "Performance note",
        add: "Add result",
        placeholder: "e.g. 12 saves and a good reply",
        save: "Save result",
        saving: "Saving…",
        cancel: "Cancel",
        required: "Add a short performance note first.",
        failed: "Could not save it. Your entry is still here to retry.",
        saved: "Performance saved.",
        rating: "How did this use go?",
        ratingOptions: { hit: "Worked", neutral: "Okay", miss: "Missed" },
        ratingSaving: "Saving rating…",
        ratingFailed: "Could not save the rating. Try again.",
        ratingSaved: "Rating saved. It will shape your next recommendation.",
      },
      localeNames: { ko: "한국어", en: "English", ja: "日本語", zh: "简体中文", "zh-tw": "繁體中文" },
    },
  },
  ja: {
    receipt: {
      title: "活用記録",
      body: "どこでどのように使ったかを残すと、Plusの活用メモとして振り返れます。",
      locale: "コンテンツ言語",
      channel: "使用チャンネル",
      artifact: "成果物",
      resultUrl: "投稿URL",
      performance: "成果メモ",
      note: "個人メモ",
      optional: "任意",
      requiredLabel: "必須",
      resultRequired: "One-Cutを保存する前に結果URLを入力してください。",
      urlPlaceholder: "https://…",
      performancePlaceholder: "例：保存12件、反応がよかった",
      notePlaceholder: "次に変えること",
      save: "完了して記録を保存",
      saving: "保存中…",
      cancel: "キャンセル",
      required: "必須項目です。",
      invalid: "入力内容を確認してください。",
      conflict: "このミームには今日すでに別の活用記録があります。元の記録は変更していません。",
      failed: "保存できませんでした。入力内容は残っています。",
      privacy: "この記録は非公開です。URLの取得や自動投稿は行いません。",
      channelOptions: {
        instagram: "Instagram",
        tiktok: "TikTok",
        youtube: "YouTube",
        threads: "Threads",
        x: "X",
        community: "コミュニティ",
        messaging: "メッセージ",
        blog: "ブログ・ニュースレター",
        other: "その他",
      },
      artifactOptions: {
        caption: "キャプション・文面",
        single_card: "共有カード",
        creator_pack: "Creator Pack",
        link: "リンク",
        other: "その他",
      },
    },
    summary: {
      title: "過去7日間の活用",
      description: "実際に使ったミームをチャンネルと言語別に振り返れます。",
      total: (count) => `活用 ${count}件`,
      pendingReceipt: (count) => `記録待ち ${count}件`,
      pendingPerformance: (count) => `成果入力待ち ${count}件`,
      channels: "チャンネル別",
      locales: "言語別",
      artifacts: "成果物別",
      empty: "過去7日間の活用記録はありません。今日使って記録を残しましょう。",
      unavailable: "過去7日間の記録を読み込めませんでした。今日のAction Inboxは利用できます。",
      retry: "再試行",
      followUp: {
        title: "最近の活用を振り返る",
        description: "成果待ちの記録から結果を追加して、次の投稿に活かせます。",
        recent: "最近の活用",
        performance: "成果メモ",
        add: "成果を追加",
        placeholder: "例：保存12件、反応がよかった",
        save: "成果を保存",
        saving: "保存中…",
        cancel: "キャンセル",
        required: "成果メモを入力してください。",
        failed: "保存できませんでした。入力内容は残っています。",
        saved: "成果を保存しました。",
        rating: "今回の活用はどうでしたか？",
        ratingOptions: { hit: "よかった", neutral: "普通", miss: "残念" },
        ratingSaving: "評価を保存中…",
        ratingFailed: "評価を保存できませんでした。もう一度お試しください。",
        ratingSaved: "評価を保存しました。次のおすすめに反映します。",
      },
      localeNames: { ko: "韓国語", en: "英語", ja: "日本語", zh: "中国語（簡体）", "zh-tw": "中国語（繁体）" },
    },
  },
  zh: {
    receipt: {
      title: "使用完成记录",
      body: "记录你在哪里、如何使用它，让 Plus 累积成你的迷因工作记忆。",
      locale: "内容语言",
      channel: "使用渠道",
      artifact: "产出类型",
      resultUrl: "帖子 URL",
      performance: "成效备注",
      note: "私人备注",
      optional: "可选",
      requiredLabel: "必填",
      resultRequired: "保存此 One-Cut 前，请先填写结果 URL。",
      urlPlaceholder: "https://…",
      performancePlaceholder: "例如：12 次收藏，评论反应不错",
      notePlaceholder: "下次想改进的地方",
      save: "完成并保存记录",
      saving: "保存中…",
      cancel: "取消",
      required: "此项为必填项。",
      invalid: "请检查输入内容。",
      conflict: "今天这条迷因已经有不同的使用记录。我们保留了原记录，没有覆盖它。",
      failed: "无法保存。已保留输入内容，可以重试。",
      privacy: "此记录仅自己可见。我们不会抓取 URL 或代你发布。",
      channelOptions: {
        instagram: "Instagram",
        tiktok: "TikTok",
        youtube: "YouTube",
        threads: "Threads",
        x: "X",
        community: "社群",
        messaging: "聊天工具",
        blog: "博客或通讯",
        other: "其他",
      },
      artifactOptions: {
        caption: "文案或文字",
        single_card: "分享卡片",
        creator_pack: "Creator Pack",
        link: "链接",
        other: "其他",
      },
    },
    summary: {
      title: "近7天使用情况",
      description: "按渠道和语言查看你实际使用过的迷因。",
      total: (count) => `使用 ${count} 次`,
      pendingReceipt: (count) => `等待记录 ${count} 次`,
      pendingPerformance: (count) => `等待填写成效 ${count} 次`,
      channels: "按渠道",
      locales: "按语言",
      artifacts: "按产出",
      empty: "近7天没有使用记录。今天使用一个迷因并保存记录吧。",
      unavailable: "无法加载近7天记录。今天的 Action Inbox 仍可使用。",
      retry: "重试",
      followUp: {
        title: "回顾最近的使用",
        description: "先为等待成效的记录补上结果，把经验带到下一次发布中。",
        recent: "最近使用",
        performance: "成效备注",
        add: "添加成效",
        placeholder: "例如：收藏 12 次，评论反应不错",
        save: "保存成效",
        saving: "保存中…",
        cancel: "取消",
        required: "请先填写一条成效备注。",
        failed: "无法保存，输入内容已保留，可以重试。",
        saved: "成效已保存。",
        rating: "这次使用效果如何？",
        ratingOptions: { hit: "不错", neutral: "一般", miss: "不太行" },
        ratingSaving: "正在保存评价…",
        ratingFailed: "无法保存评价，请重试。",
        ratingSaved: "评价已保存，将用于下一次推荐。",
      },
      localeNames: { ko: "韩语", en: "英语", ja: "日语", zh: "简体中文", "zh-tw": "繁体中文" },
    },
  },
};

const ZH_TW_OUTCOME_COPY: PlusOutcomeLedgerCopy = {
  receipt: {
    ...OUTCOME_COPY_BASE.zh.receipt,
    title: "使用完成紀錄",
    body: "記下你在哪裡、如何使用，讓 Plus 累積成你的迷因工作記憶。",
    locale: "內容語言",
    channel: "使用管道",
    artifact: "產出類型",
    resultUrl: "貼文 URL",
    performance: "成效備註",
    note: "私人備註",
    optional: "選填",
    requiredLabel: "必填",
    resultRequired: "儲存此 One-Cut 前，請先填寫結果 URL。",
    performancePlaceholder: "例如：12 次收藏，留言反應不錯",
    notePlaceholder: "下次想改進的地方",
    save: "完成並儲存紀錄",
    cancel: "取消",
    required: "此欄位為必填。",
    invalid: "請檢查輸入內容。",
    conflict: "今天這則迷因已經有不同的使用紀錄。我們保留原紀錄，沒有覆蓋它。",
    failed: "無法儲存。輸入內容已保留，可以重試。",
    privacy: "此紀錄只有自己看得到。我們不會抓取 URL 或代你發布。",
    channelOptions: {
      instagram: "Instagram",
      tiktok: "TikTok",
      youtube: "YouTube",
      threads: "Threads",
      x: "X",
      community: "社群",
      messaging: "聊天工具",
      blog: "部落格或電子報",
      other: "其他",
    },
    artifactOptions: {
      caption: "文案或文字",
      single_card: "分享卡片",
      creator_pack: "Creator Pack",
      link: "連結",
      other: "其他",
    },
  },
  summary: {
    ...OUTCOME_COPY_BASE.zh.summary,
    title: "最近7天使用狀況",
    description: "依管道和語言查看你實際使用過的迷因。",
    total: (count) => `使用 ${count} 次`,
    pendingReceipt: (count) => `等待紀錄 ${count} 次`,
    pendingPerformance: (count) => `等待填寫成效 ${count} 次`,
    channels: "依管道",
    locales: "依語言",
    artifacts: "依產出",
    empty: "最近7天沒有使用紀錄。今天使用一個迷因並儲存紀錄吧。",
    unavailable: "無法載入最近7天紀錄。今天的 Action Inbox 仍可使用。",
    retry: "重試",
    followUp: {
      title: "回顧最近的使用",
      description: "先為等待成效的紀錄補上結果，把經驗帶到下一次發布中。",
      recent: "最近使用",
      performance: "成效備註",
      add: "新增成效",
      placeholder: "例如：收藏 12 次，留言反應不錯",
      save: "儲存成效",
      saving: "儲存中…",
      cancel: "取消",
      required: "請先填寫一則成效備註。",
      failed: "無法儲存，輸入內容已保留，可以重試。",
      saved: "成效已儲存。",
      rating: "這次使用效果如何？",
      ratingOptions: { hit: "不錯", neutral: "普通", miss: "不太好" },
      ratingSaving: "正在儲存評價…",
      ratingFailed: "無法儲存評價，請重試。",
      ratingSaved: "評價已儲存，會用於下一次推薦。",
    },
    localeNames: { ko: "韓語", en: "英語", ja: "日語", zh: "簡體中文", "zh-tw": "繁體中文" },
  },
};

export const PLUS_OUTCOME_COPY: Record<Locale, PlusOutcomeLedgerCopy> = {
  ...withLocaleFallback(OUTCOME_COPY_BASE),
  "zh-tw": ZH_TW_OUTCOME_COPY,
};
