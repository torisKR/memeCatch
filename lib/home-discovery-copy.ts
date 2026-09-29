import type { SeoRouteLocale } from "@/lib/i18n-routing";

export type HomeDiscoveryCopy = {
  eyebrow: string;
  title: string;
  description: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchScope: string;
  categoryLabel: string;
  allCategories: string;
  resultsLabel: string;
  resultStatus: (visible: number, total: number) => string;
  clearFilters: string;
  noResultsTitle: string;
  noResultsDescription: string;
  emptyTitle: string;
  emptyDescription: string;
  readEntry: string;
  originalLabel: string;
  previewLabel: string;
  previewEyebrow: string;
  previewTitle: string;
  previewDescription: string;
  previewAction: string;
  nextPreview: string;
};

export const HOME_DISCOVERY_COPY: Record<SeoRouteLocale, HomeDiscoveryCopy> = {
  ko: {
    eyebrow: "최근 발견",
    title: "새로 정리된 밈을 훑어보세요.",
    description: "카테고리를 고르거나 단어를 입력해 지금 공개된 최근 항목 안에서 읽을 설명을 찾을 수 있어요.",
    searchLabel: "최근 항목 필터",
    searchPlaceholder: "제목, 설명, 카테고리 찾기",
    searchScope: "이 검색은 전체 아카이브가 아니라 아래의 최근 공개 항목 안에서만 찾습니다.",
    categoryLabel: "카테고리로 필터",
    allCategories: "전체",
    resultsLabel: "필터된 최근 항목",
    resultStatus: (visible, total) => `최근 항목 ${total}개 중 ${visible}개를 표시합니다.`,
    clearFilters: "필터 초기화",
    noResultsTitle: "조건에 맞는 최근 항목이 없어요",
    noResultsDescription: "검색어나 카테고리를 지우면 최근 항목을 다시 모두 볼 수 있어요.",
    emptyTitle: "표시할 최근 항목이 없어요",
    emptyDescription: "공개된 최근 설명이 생기면 이곳에 실제 항목이 표시됩니다.",
    readEntry: "설명 읽기",
    originalLabel: "원문",
    previewLabel: "다음 선택 미리보기",
    previewEyebrow: "다음 선택",
    previewTitle: "하나부터 읽어볼까요?",
    previewDescription: "현재 보이는 최근 항목에서 순서대로 한 편을 제안합니다.",
    previewAction: "이 설명 열기",
    nextPreview: "다음 선택 보기",
  },
  en: {
    eyebrow: "Recent discoveries",
    title: "Browse the newest explanations.",
    description: "Choose a category or type a phrase to find a useful starting point among the recent entries available here.",
    searchLabel: "Filter this recent set",
    searchPlaceholder: "Find a title, summary, or category",
    searchScope: "This filter searches only the recent set shown below, not the whole archive.",
    categoryLabel: "Filter by category",
    allCategories: "All",
    resultsLabel: "Filtered recent entries",
    resultStatus: (visible, total) => `Showing ${visible} of ${total} recent entries.`,
    clearFilters: "Clear filters",
    noResultsTitle: "No recent entries match",
    noResultsDescription: "Clear the phrase or category to bring every recent entry back into view.",
    emptyTitle: "No recent entries are available",
    emptyDescription: "Genuine published explanations will appear here when recent entries are available.",
    readEntry: "Read explanation",
    originalLabel: "Original",
    previewLabel: "Next pick preview",
    previewEyebrow: "Next pick",
    previewTitle: "Start with one explanation",
    previewDescription: "This suggestion moves through the recent entries currently in view, in order.",
    previewAction: "Open this explanation",
    nextPreview: "Show next pick",
  },
  ja: {
    eyebrow: "最近の発見",
    title: "新しく整理されたミームを見てみましょう。",
    description: "カテゴリーや言葉で、ここに表示されている最近の記事から読みたい解説を探せます。",
    searchLabel: "最近の記事を絞り込む",
    searchPlaceholder: "タイトル・解説・カテゴリーを検索",
    searchScope: "この検索の対象は全アーカイブではなく、下に表示された最近の記事だけです。",
    categoryLabel: "カテゴリーで絞り込む",
    allCategories: "すべて",
    resultsLabel: "絞り込んだ最近の記事",
    resultStatus: (visible, total) => `最近の記事${total}件中${visible}件を表示しています。`,
    clearFilters: "絞り込みを解除",
    noResultsTitle: "条件に合う最近の記事はありません",
    noResultsDescription: "検索語やカテゴリーを解除すると、最近の記事をすべて表示できます。",
    emptyTitle: "表示できる最近の記事はありません",
    emptyDescription: "公開済みの新しい解説があると、実際の記事がここに表示されます。",
    readEntry: "解説を読む",
    originalLabel: "韓国語原題",
    previewLabel: "次の候補プレビュー",
    previewEyebrow: "次の候補",
    previewTitle: "まず一つ読んでみませんか",
    previewDescription: "現在表示中の最近の記事を、順番に一つずつ提案します。",
    previewAction: "この解説を開く",
    nextPreview: "次の候補を見る",
  },
  zh: {
    eyebrow: "近期发现",
    title: "浏览最新整理的迷因解释。",
    description: "选择分类或输入关键词，在这里显示的近期条目中找到适合开始阅读的解释。",
    searchLabel: "筛选近期条目",
    searchPlaceholder: "查找标题、说明或分类",
    searchScope: "此筛选只搜索下方显示的近期条目，不会搜索整个资料库。",
    categoryLabel: "按分类筛选",
    allCategories: "全部",
    resultsLabel: "筛选后的近期条目",
    resultStatus: (visible, total) => `近期条目共${total}条，当前显示${visible}条。`,
    clearFilters: "清除筛选",
    noResultsTitle: "没有符合条件的近期条目",
    noResultsDescription: "清除关键词或分类，即可重新查看全部近期条目。",
    emptyTitle: "暂无可显示的近期条目",
    emptyDescription: "有新的公开解释后，真实条目会显示在这里。",
    readEntry: "阅读解释",
    originalLabel: "韩文原名",
    previewLabel: "下一个推荐预览",
    previewEyebrow: "下一个推荐",
    previewTitle: "先读一篇解释",
    previewDescription: "推荐会按顺序在当前显示的近期条目中切换。",
    previewAction: "打开这篇解释",
    nextPreview: "查看下一个推荐",
  },
  "zh-tw": {
    eyebrow: "近期發現",
    title: "瀏覽最新整理的迷因解釋。",
    description: "選擇分類或輸入關鍵字，在這裡顯示的近期項目中找到適合開始閱讀的解釋。",
    searchLabel: "篩選近期項目",
    searchPlaceholder: "查找標題、說明或分類",
    searchScope: "此篩選只搜尋下方顯示的近期項目，不會搜尋整個資料庫。",
    categoryLabel: "按分類篩選",
    allCategories: "全部",
    resultsLabel: "篩選後的近期項目",
    resultStatus: (visible, total) => `近期項目共${total}筆，目前顯示${visible}筆。`,
    clearFilters: "清除篩選",
    noResultsTitle: "沒有符合條件的近期項目",
    noResultsDescription: "清除關鍵字或分類，即可重新查看全部近期項目。",
    emptyTitle: "暫無可顯示的近期項目",
    emptyDescription: "有新的公開解釋後，真實項目會顯示在這裡。",
    readEntry: "閱讀解釋",
    originalLabel: "韓文原名",
    previewLabel: "下一個推薦預覽",
    previewEyebrow: "下一個推薦",
    previewTitle: "先讀一篇解釋",
    previewDescription: "推薦會依序在目前顯示的近期項目中切換。",
    previewAction: "開啟這篇解釋",
    nextPreview: "查看下一個推薦",
  },
};
