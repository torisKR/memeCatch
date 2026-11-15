import { withLocaleFallback, type Locale } from "@/lib/i18n";

export type PlusOutcomeHistoryCopy = {
  eyebrow: string;
  title: string;
  description: string;
  empty: string;
  unavailable: string;
  locked: string;
  filteredEmpty: string;
  showing: (count: number) => string;
  channelFilter: string;
  ratingFilter: string;
  all: string;
  noRating: string;
  rate: string;
  noPerformanceNote: string;
  performanceNote: string;
  open: string;
  replay: string;
  replayActive: string;
  localizedLink: string;
  koreanFallbackLink: string;
  unavailableLink: string;
  resultLink: string;
  resultMissing: string;
};

const HISTORY_COPY_BASE: {
  ko: PlusOutcomeHistoryCopy;
  en: PlusOutcomeHistoryCopy;
  ja: PlusOutcomeHistoryCopy;
  zh: PlusOutcomeHistoryCopy;
} = {
  ko: {
    eyebrow: "PLUS MEMORY",
    title: "나의 활용 기록",
    description: "최근 30일 동안 실제로 사용한 밈과 결과를 다시 보고, 다음 선택의 근거로 삼아요.",
    empty: "최근 30일 활용 기록이 없어요. 오늘의 Action Inbox에서 밈을 사용하고 영수증을 남겨 보세요.",
    unavailable: "활용 기록을 불러오지 못했어요. 오늘의 Action Inbox는 계속 사용할 수 있어요.",
    locked: "Plus를 활성화하면 나의 활용 기록을 확인할 수 있어요.",
    filteredEmpty: "이 필터에 맞는 기록이 없어요.",
    showing: (count) => `표시 중 ${count}건`,
    channelFilter: "채널",
    ratingFilter: "평가",
    all: "전체",
    noRating: "평가 없음",
    rate: "이 활용 평가하기",
    noPerformanceNote: "성과 메모 없음",
    performanceNote: "성과 메모",
    open: "밈 상세 보기",
    replay: "좋았던 결과 다시 만들기",
    replayActive: "현재 실행 중",
    localizedLink: "번역 상세",
    koreanFallbackLink: "한국어 원문",
    unavailableLink: "번역 링크를 확인할 수 없음",
    resultLink: "저장한 결과 다시 보기",
    resultMissing: "결과 링크 없음",
  },
  en: {
    eyebrow: "PLUS MEMORY",
    title: "My use history",
    description: "Revisit the memes you actually used in the last 30 days and turn the record into your next move.",
    empty: "No use recorded in the last 30 days. Use a meme from today’s Action Inbox and save the receipt.",
    unavailable: "Your use history is unavailable. Today’s Action Inbox is still available.",
    locked: "Activate Plus to see your personal use history.",
    filteredEmpty: "No records match these filters.",
    showing: (count) => `Showing ${count}`,
    channelFilter: "Channel",
    ratingFilter: "Rating",
    all: "All",
    noRating: "Not rated",
    rate: "Rate this use",
    noPerformanceNote: "No performance note",
    performanceNote: "Performance note",
    open: "Open meme",
    replay: "Recreate this hit",
    replayActive: "Currently open",
    localizedLink: "Localized detail",
    koreanFallbackLink: "Korean original",
    unavailableLink: "Localized replay unavailable",
    resultLink: "Open saved result",
    resultMissing: "No result link saved",
  },
  ja: {
    eyebrow: "PLUS MEMORY",
    title: "自分の活用履歴",
    description: "過去30日間に実際に使ったミームと結果を振り返り、次の選択に活かせます。",
    empty: "過去30日間の活用記録はありません。今日のAction Inboxから使って記録を残しましょう。",
    unavailable: "活用履歴を読み込めませんでした。今日のAction Inboxは利用できます。",
    locked: "Plusを有効にすると自分の活用履歴を確認できます。",
    filteredEmpty: "この条件に一致する記録はありません。",
    showing: (count) => `${count}件を表示`,
    channelFilter: "チャンネル",
    ratingFilter: "評価",
    all: "すべて",
    noRating: "未評価",
    rate: "この活用を評価",
    noPerformanceNote: "成果メモなし",
    performanceNote: "成果メモ",
    open: "ミームを開く",
    replay: "この成果をもう一度作る",
    replayActive: "現在開いています",
    localizedLink: "翻訳版の詳細",
    koreanFallbackLink: "韓国語の原文",
    unavailableLink: "翻訳リンクを確認できません",
    resultLink: "保存した結果を開く",
    resultMissing: "結果URLなし",
  },
  zh: {
    eyebrow: "PLUS MEMORY",
    title: "我的使用记录",
    description: "回顾过去30天实际使用过的迷因和结果，把记录变成下一步选择的依据。",
    empty: "近30天没有使用记录。先从今天的 Action Inbox 使用一个迷因并保存记录吧。",
    unavailable: "暂时无法加载使用记录。今天的 Action Inbox 仍可使用。",
    locked: "开通 Plus 后即可查看你的个人使用记录。",
    filteredEmpty: "没有符合这些筛选条件的记录。",
    showing: (count) => `显示 ${count} 条`,
    channelFilter: "渠道",
    ratingFilter: "评价",
    all: "全部",
    noRating: "尚未评价",
    rate: "评价这次使用",
    noPerformanceNote: "没有成效备注",
    performanceNote: "成效备注",
    open: "打开迷因",
    replay: "再次制作这次好结果",
    replayActive: "当前已打开",
    localizedLink: "翻译详情",
    koreanFallbackLink: "韩文原文",
    unavailableLink: "暂时无法确认翻译链接",
    resultLink: "打开已保存结果",
    resultMissing: "没有保存结果链接",
  },
};

const ZH_TW_HISTORY_COPY: PlusOutcomeHistoryCopy = {
  eyebrow: "PLUS MEMORY",
  title: "我的使用紀錄",
  description: "回顧過去30天實際使用過的迷因和結果，把紀錄變成下一步選擇的依據。",
  empty: "最近30天沒有使用紀錄。先從今天的 Action Inbox 使用一個迷因並儲存紀錄吧。",
  unavailable: "暫時無法載入使用紀錄。今天的 Action Inbox 仍可使用。",
  locked: "開通 Plus 後即可查看你的個人使用紀錄。",
  filteredEmpty: "沒有符合這些篩選條件的紀錄。",
  showing: (count) => `顯示 ${count} 筆`,
  channelFilter: "管道",
  ratingFilter: "評價",
  all: "全部",
  noRating: "尚未評價",
  rate: "評價這次使用",
  noPerformanceNote: "沒有成效備註",
  performanceNote: "成效備註",
  open: "開啟迷因",
  replay: "再次製作這次好結果",
  replayActive: "目前已開啟",
  localizedLink: "翻譯版詳細內容",
  koreanFallbackLink: "韓文原文",
  unavailableLink: "暫時無法確認翻譯連結",
  resultLink: "開啟已儲存結果",
  resultMissing: "沒有儲存結果連結",
};

export const PLUS_OUTCOME_HISTORY_COPY: Record<Locale, PlusOutcomeHistoryCopy> =
  withLocaleFallback({ ...HISTORY_COPY_BASE, "zh-tw": ZH_TW_HISTORY_COPY });
