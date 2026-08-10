import type { LifecycleStatus, SafetyLevel } from "@/lib/labels";
import type { SeoRouteLocale } from "@/lib/i18n-routing";

export type PlusGlobalScoutCopy = {
  eyebrow: string;
  title: string;
  intro: string;
  dateLabel: string;
  dailyLabel: string;
  reviewedLabel: string;
  currentLabel: string;
  contentLanguageLabel: string;
  safetyLabel: string;
  lifecycleLabel: string;
  usageLabel: string;
  cautionLabel: string;
  openMeme: string;
  emptyTitle: string;
  emptyBody: string;
  unavailableTitle: string;
  unavailableBody: string;
  safety: Record<SafetyLevel, string>;
  lifecycle: Record<LifecycleStatus, string>;
};

export const PLUS_GLOBAL_SCOUT_COPY = {
  ko: {
    eyebrow: "PLUS · GLOBAL SCOUT",
    title: "오늘의 글로벌 스카우트 덱",
    intro: "전 세계에서 지금 확인할 가치가 있는 검수 완료 밈만 하루 최대 5개 골랐어요.",
    dateLabel: "덱 날짜",
    dailyLabel: "오늘의 덱",
    reviewedLabel: "검수 완료",
    currentLabel: "현재 내용",
    contentLanguageLabel: "콘텐츠 언어",
    safetyLabel: "안전 신호",
    lifecycleLabel: "생명주기",
    usageLabel: "사용 예",
    cautionLabel: "주의",
    openMeme: "밈 자세히 보기",
    emptyTitle: "오늘 공개할 글로벌 밈이 아직 없어요",
    emptyBody: "검수와 현재성 기준을 모두 통과한 밈이 준비되면 이 덱에 표시돼요.",
    unavailableTitle: "글로벌 덱을 잠시 불러올 수 없어요",
    unavailableBody: "콘텐츠 공급 상태를 확인하고 있어요. 잠시 후 다시 시도해 주세요.",
    safety: {
      green: "써도 됨",
      yellow: "맥락 주의",
      gray: "이미 늦음",
      red: "쓰면 위험",
    },
    lifecycle: {
      rising: "급상승",
      active: "유행 중",
      cooling: "식는 중",
      archived: "추억 밈",
    },
  },
  en: {
    eyebrow: "PLUS · GLOBAL SCOUT",
    title: "Today’s Global Scout Deck",
    intro: "Up to five reviewed, current memes worth knowing around the world today.",
    dateLabel: "Deck date",
    dailyLabel: "Today’s deck",
    reviewedLabel: "Reviewed",
    currentLabel: "Current",
    contentLanguageLabel: "Content language",
    safetyLabel: "Safety",
    lifecycleLabel: "Lifecycle",
    usageLabel: "Usage",
    cautionLabel: "Caution",
    openMeme: "Open meme details",
    emptyTitle: "No global memes are ready for today",
    emptyBody: "Memes appear here only after they pass both review and freshness checks.",
    unavailableTitle: "The global deck is temporarily unavailable",
    unavailableBody: "We are checking the content supply. Please try again shortly.",
    safety: {
      green: "Safe to use",
      yellow: "Check the context",
      gray: "Past its prime",
      red: "Risky to use",
    },
    lifecycle: {
      rising: "Rising",
      active: "Active",
      cooling: "Cooling",
      archived: "Archived",
    },
  },
  ja: {
    eyebrow: "PLUS · GLOBAL SCOUT",
    title: "今日のグローバル・スカウトデッキ",
    intro: "世界で今チェックする価値がある、確認済みの最新ミームを1日最大5件選びます。",
    dateLabel: "デッキの日付",
    dailyLabel: "今日のデッキ",
    reviewedLabel: "確認済み",
    currentLabel: "最新内容",
    contentLanguageLabel: "コンテンツ言語",
    safetyLabel: "安全シグナル",
    lifecycleLabel: "ライフサイクル",
    usageLabel: "使用例",
    cautionLabel: "注意",
    openMeme: "ミームの詳細を見る",
    emptyTitle: "今日公開できるグローバルミームはまだありません",
    emptyBody: "確認と最新性の両方の基準を満たしたミームだけがここに表示されます。",
    unavailableTitle: "グローバルデッキを一時的に読み込めません",
    unavailableBody: "コンテンツの供給状況を確認しています。しばらくしてから再度お試しください。",
    safety: {
      green: "使ってOK",
      yellow: "文脈を確認",
      gray: "旬を過ぎた",
      red: "使用注意",
    },
    lifecycle: {
      rising: "急上昇",
      active: "流行中",
      cooling: "落ち着き中",
      archived: "懐かしミーム",
    },
  },
  zh: {
    eyebrow: "PLUS · GLOBAL SCOUT",
    title: "今日全球侦察卡组",
    intro: "每天精选最多 5 个经过审核、内容仍为最新且值得关注的全球迷因。",
    dateLabel: "卡组日期",
    dailyLabel: "今日卡组",
    reviewedLabel: "已审核",
    currentLabel: "内容最新",
    contentLanguageLabel: "内容语言",
    safetyLabel: "安全信号",
    lifecycleLabel: "生命周期",
    usageLabel: "使用示例",
    cautionLabel: "注意",
    openMeme: "查看迷因详情",
    emptyTitle: "今天还没有可发布的全球迷因",
    emptyBody: "只有同时通过审核和时效检查的迷因才会显示在这里。",
    unavailableTitle: "全球迷因牌组暂时无法使用",
    unavailableBody: "我们正在确认内容供应状态，请稍后再试。",
    safety: {
      green: "可以使用",
      yellow: "注意语境",
      gray: "已经过时",
      red: "谨慎使用",
    },
    lifecycle: {
      rising: "上升中",
      active: "流行中",
      cooling: "降温中",
      archived: "怀旧迷因",
    },
  },
  "zh-tw": {
    eyebrow: "PLUS · GLOBAL SCOUT",
    title: "今日全球偵察卡組",
    intro: "每天精選最多 5 個經過審核、內容仍為最新且值得關注的全球迷因。",
    dateLabel: "卡組日期",
    dailyLabel: "今日卡組",
    reviewedLabel: "已審核",
    currentLabel: "內容最新",
    contentLanguageLabel: "內容語言",
    safetyLabel: "安全信號",
    lifecycleLabel: "生命週期",
    usageLabel: "使用範例",
    cautionLabel: "注意",
    openMeme: "查看迷因詳情",
    emptyTitle: "今天還沒有可發布的全球迷因",
    emptyBody: "只有同時通過審核和時效檢查的迷因才會顯示在這裡。",
    unavailableTitle: "全球迷因牌組暫時無法使用",
    unavailableBody: "我們正在確認內容供應狀態，請稍後再試。",
    safety: {
      green: "可以使用",
      yellow: "注意語境",
      gray: "已經過時",
      red: "謹慎使用",
    },
    lifecycle: {
      rising: "上升中",
      active: "流行中",
      cooling: "降溫中",
      archived: "懷舊迷因",
    },
  },
} as const satisfies Record<SeoRouteLocale, PlusGlobalScoutCopy>;
