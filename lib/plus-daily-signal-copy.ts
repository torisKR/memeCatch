import { withLocaleFallback, type Locale } from "@/lib/i18n";
import type { SafetyLevel } from "@/lib/labels";

export type DailySignalCopy = {
  subject: (count: number) => string;
  preheader: string;
  title: string;
  intro: string;
  emptyTitle: string;
  emptyBody: string;
  savedReason: string;
  interestReason: string;
  safety: (level: SafetyLevel) => string;
  open: string;
  action: string;
  footer: string;
  unsubscribe: string;
  settingsTitle: string;
  settingsBody: string;
  enabledLabel: string;
  localeLabel: string;
  saved: string;
  failed: string;
};

export const DAILY_SIGNAL_COPY: Record<Locale, DailySignalCopy> = withLocaleFallback({
  ko: {
    subject: (count) => `오늘의 Plus Signal · ${count}개`,
    preheader: "놓치기 전에 확인하는 오늘의 밈 신호",
    title: "오늘의 Plus Signal",
    intro: "저장한 밈과 관심사에서 지금 확인할 가치가 있는 신호만 골랐어요.",
    emptyTitle: "지금은 새 신호가 없어요",
    emptyBody: "검수된 콘텐츠 중 현재 급상승 조건을 충족하는 밈이 생기면 여기에 표시돼요.",
    savedReason: "저장한 밈 급상승",
    interestReason: "관심사 급상승",
    safety: (level) => `안전 신호: ${level === "green" ? "낮은 위험" : level === "yellow" ? "맥락 확인" : "주의"}`,
    open: "밈 자세히 보기",
    action: "오늘 한 장 준비하기",
    footer: "검수된 MemeCatch 콘텐츠와 현재 신호만 담았습니다.",
    unsubscribe: "MY PLUS에서 이메일 수신을 끌 수 있어요.",
    settingsTitle: "오늘의 Signal 이메일",
    settingsBody: "저장한 밈 급상승과 관심사 신호를 하루 한 번 이메일로 받아보세요.",
    enabledLabel: "이메일로 받기",
    localeLabel: "받을 언어",
    saved: "설정을 저장했어요.",
    failed: "설정을 저장하지 못했어요. 잠시 뒤 다시 시도해 주세요.",
  },
  en: {
    subject: (count) => `Today’s Plus Signal · ${count}`,
    preheader: "A short, useful signal before the moment passes",
    title: "Today’s Plus Signal",
    intro: "Here are the signals worth checking from your saved memes and interests.",
    emptyTitle: "No new signal right now",
    emptyBody: "A reviewed meme appears here when it meets the current rising-signal criteria.",
    savedReason: "Rising saved meme",
    interestReason: "Rising in your interests",
    safety: (level) => `Safety signal: ${level === "green" ? "lower risk" : level === "yellow" ? "check context" : "caution"}`,
    open: "Open meme",
    action: "Prepare today’s One-Cut",
    footer: "Only reviewed MemeCatch content and current signals are included.",
    unsubscribe: "You can turn off email delivery in MY PLUS.",
    settingsTitle: "Daily Signal email",
    settingsBody: "Get one email a day with rising saved memes and signals from your interests.",
    enabledLabel: "Send me the email",
    localeLabel: "Email language",
    saved: "Your settings were saved.",
    failed: "We could not save that setting. Try again shortly.",
  },
  ja: {
    subject: (count) => `今日のPlus Signal · ${count}件`,
    preheader: "見逃す前に確認したい今日のミームシグナル",
    title: "今日のPlus Signal",
    intro: "保存したミームと興味のある分野から、今確認する価値のあるシグナルを選びました。",
    emptyTitle: "今は新しいシグナルがありません",
    emptyBody: "確認済みのミームが現在の上昇シグナル条件を満たすと、ここに表示されます。",
    savedReason: "保存したミームの上昇",
    interestReason: "興味のある分野で上昇",
    safety: (level) => `安全シグナル: ${level === "green" ? "リスク低め" : level === "yellow" ? "文脈を確認" : "注意"}`,
    open: "ミームを見る",
    action: "今日のOne-Cutを準備",
    footer: "確認済みのMemeCatchコンテンツと現在のシグナルだけを掲載しています。",
    unsubscribe: "MY PLUSからメール配信を停止できます。",
    settingsTitle: "今日のSignalメール",
    settingsBody: "保存したミームの上昇と興味のある分野のシグナルを、1日1通で受け取れます。",
    enabledLabel: "メールで受け取る",
    localeLabel: "メールの言語",
    saved: "設定を保存しました。",
    failed: "設定を保存できませんでした。少し待ってから再度お試しください。",
  },
  zh: {
    subject: (count) => `今日 Plus Signal · ${count} 条`,
    preheader: "在热度过去前，先看一眼今天的迷因信号",
    title: "今日 Plus Signal",
    intro: "这是从你收藏的迷因和关注领域中挑出的值得现在查看的信号。",
    emptyTitle: "现在没有新的信号",
    emptyBody: "经过审核的迷因符合当前上升信号条件后，会显示在这里。",
    savedReason: "收藏的迷因正在上升",
    interestReason: "关注领域正在上升",
    safety: (level) => `安全信号：${level === "green" ? "风险较低" : level === "yellow" ? "请确认语境" : "需要注意"}`,
    open: "查看迷因",
    action: "准备今天的一键卡片",
    footer: "邮件只包含已审核的 MemeCatch 内容和当前信号。",
    unsubscribe: "你可以在 MY PLUS 中关闭邮件发送。",
    settingsTitle: "每日 Signal 邮件",
    settingsBody: "每天接收一封邮件，查看收藏迷因的上升信号和关注领域动态。",
    enabledLabel: "通过邮件接收",
    localeLabel: "邮件语言",
    saved: "设置已保存。",
    failed: "设置保存失败，请稍后再试。",
  },
  "zh-tw": {
    subject: (count) => `今日 Plus Signal · ${count} 則`,
    preheader: "在熱度過去前，先看看今天的迷因訊號",
    title: "今日 Plus Signal",
    intro: "這是從你收藏的迷因和關注領域中挑出的值得現在查看的訊號。",
    emptyTitle: "目前沒有新的訊號",
    emptyBody: "經過審核的迷因符合目前上升訊號條件後，會顯示在這裡。",
    savedReason: "收藏的迷因正在上升",
    interestReason: "關注領域正在上升",
    safety: (level) => `安全訊號：${level === "green" ? "風險較低" : level === "yellow" ? "請確認語境" : "需要注意"}`,
    open: "查看迷因",
    action: "準備今天的一鍵卡片",
    footer: "郵件只包含已審核的 MemeCatch 內容和目前訊號。",
    unsubscribe: "你可以在 MY PLUS 中關閉郵件寄送。",
    settingsTitle: "每日 Signal 郵件",
    settingsBody: "每天接收一封郵件，查看收藏迷因的上升訊號和關注領域動態。",
    enabledLabel: "透過郵件接收",
    localeLabel: "郵件語言",
    saved: "設定已儲存。",
    failed: "設定儲存失敗，請稍後再試。",
  },
});
