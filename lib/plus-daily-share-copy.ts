export type PlusDailyShareLocale = "ko" | "en" | "ja" | "zh" | "zh-tw";

export type PlusDailyShareCopy = {
  share: string;
  sharing: string;
  shared: string;
  fallback: string;
  downloaded: string;
  error: string;
};

export const PLUS_DAILY_SHARE_COPY: Record<PlusDailyShareLocale, PlusDailyShareCopy> = {
  ko: {
    share: "공유 팩 만들기",
    sharing: "카드 준비 중…",
    shared: "공유 시트를 열었어요.",
    fallback: "캡션을 복사하고 카드를 저장했어요.",
    downloaded: "카드를 저장했어요. 캡션은 직접 복사해 주세요.",
    error: "공유 카드를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.",
  },
  en: {
    share: "Create share pack",
    sharing: "Preparing card…",
    shared: "The share sheet is open.",
    fallback: "Caption copied and card saved.",
    downloaded: "Card saved. Please copy the caption manually.",
    error: "We could not prepare the share card. Please try again.",
  },
  ja: {
    share: "共有パックを作る",
    sharing: "カードを準備中…",
    shared: "共有シートを開きました。",
    fallback: "キャプションをコピーしてカードを保存しました。",
    downloaded: "カードを保存しました。キャプションは手動でコピーしてください。",
    error: "共有カードを準備できませんでした。もう一度お試しください。",
  },
  zh: {
    share: "制作分享包",
    sharing: "正在准备卡片…",
    shared: "已打开分享面板。",
    fallback: "已复制配文并保存卡片。",
    downloaded: "已保存卡片。请手动复制配文。",
    error: "无法准备分享卡片，请稍后再试。",
  },
  "zh-tw": {
    share: "製作分享包",
    sharing: "正在準備卡片…",
    shared: "已開啟分享面板。",
    fallback: "已複製貼文文字並儲存卡片。",
    downloaded: "已儲存卡片。請手動複製貼文文字。",
    error: "無法準備分享卡片，請稍後再試。",
  },
};
