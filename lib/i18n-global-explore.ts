import type { SeoContentLocale } from "@/lib/i18n-routing";

export type LocalizedExploreCopy = {
  eyebrow: string;
  title: string;
  description: string;
  intro: string;
  read: string;
  home: string;
  previousPage: string;
  nextPage: string;
  pageLabel: (page: number) => string;
  originalExplore: string;
  originalLabel: string;
  safetyLabel: string;
  safety: Record<"green" | "yellow" | "gray" | "red", string>;
  emptyTitle: string;
  emptyDescription: string;
  unavailableTitle: string;
  unavailableDescription: string;
  resultSummary: (count: number) => string;
};

export const LOCALIZED_EXPLORE_COPY: Record<SeoContentLocale, LocalizedExploreCopy> = {
  en: {
    eyebrow: "Discover",
    title: "Explore Korean memes",
    description: "Browse Korean memes with their meaning, origin, and usage context.",
    intro: "Only current, human-reviewed translations of substantial public entries appear here.",
    read: "Read the explanation",
    home: "Back to home",
    previousPage: "Previous page",
    nextPage: "Next page",
    pageLabel: (page) => `Page ${page}`,
    originalExplore: "Explore Korean originals",
    originalLabel: "Korean original",
    safetyLabel: "Usage signal",
    safety: { green: "Safe to use", yellow: "Context needed", gray: "Past its prime", red: "Risky to use" },
    emptyTitle: "Reviewed translations are being prepared",
    emptyDescription: "This language desk has no eligible public entries yet. Please check back soon.",
    unavailableTitle: "The explore desk is temporarily unavailable",
    unavailableDescription: "Please try again in a moment. Published translations were not changed.",
    resultSummary: (count) => `${count} translated meme${count === 1 ? "" : "s"}`,
  },
  ja: {
    eyebrow: "Discover",
    title: "韓国ミームを探す",
    description: "意味、由来、使うときの文脈まで韓国ミームを探せます。",
    intro: "内容が充実し、人が確認した最新の翻訳だけを公開しています。",
    read: "解説を読む",
    home: "ホームに戻る",
    previousPage: "前のページ",
    nextPage: "次のページ",
    pageLabel: (page) => `${page}ページ`,
    originalExplore: "韓国語の原文を探す",
    originalLabel: "韓国語の原題",
    safetyLabel: "使用シグナル",
    safety: { green: "使ってOK", yellow: "文脈に注意", gray: "旬を過ぎた", red: "使用注意" },
    emptyTitle: "確認済みの翻訳を準備しています",
    emptyDescription: "この言語の公開対象はまだありません。しばらくしてからご覧ください。",
    unavailableTitle: "探検デスクは一時的に利用できません",
    unavailableDescription: "少し時間をおいて再試行してください。公開済み翻訳は変更されていません。",
    resultSummary: (count) => `翻訳済みミーム ${count}件`,
  },
  zh: {
    eyebrow: "Discover",
    title: "探索韩国迷因",
    description: "浏览韩国迷因的含义、来源和使用语境。",
    intro: "这里只发布内容完整、经过人工审核且保持最新的翻译。",
    read: "阅读解释",
    home: "返回首页",
    previousPage: "上一页",
    nextPage: "下一页",
    pageLabel: (page) => `第 ${page} 页`,
    originalExplore: "探索韩语原文",
    originalLabel: "韩文原名",
    safetyLabel: "使用提示",
    safety: { green: "可以使用", yellow: "注意语境", gray: "已经过时", red: "谨慎使用" },
    emptyTitle: "已审核的翻译正在准备中",
    emptyDescription: "这个语言版本暂时没有符合公开条件的内容，请稍后再来。",
    unavailableTitle: "迷因探索暂时不可用",
    unavailableDescription: "请稍后再试。已发布的翻译没有被修改。",
    resultSummary: (count) => `${count} 条已翻译迷因`,
  },
  "zh-tw": {
    eyebrow: "Discover",
    title: "探索韓國迷因",
    description: "瀏覽韓國迷因的含義、來源和使用語境。",
    intro: "這裡只發布內容完整、經過人工審核且保持最新的翻譯。",
    read: "閱讀解釋",
    home: "返回首頁",
    previousPage: "上一頁",
    nextPage: "下一頁",
    pageLabel: (page) => `第 ${page} 頁`,
    originalExplore: "探索韓語原文",
    originalLabel: "韓文原名",
    safetyLabel: "使用提示",
    safety: { green: "可以使用", yellow: "注意語境", gray: "已經過時", red: "謹慎使用" },
    emptyTitle: "已審核的翻譯正在準備中",
    emptyDescription: "這個語言版本暫時沒有符合公開條件的內容，請稍後再來。",
    unavailableTitle: "迷因探索暫時無法使用",
    unavailableDescription: "請稍後再試。已發布的翻譯沒有被修改。",
    resultSummary: (count) => `${count} 則已翻譯迷因`,
  },
};
