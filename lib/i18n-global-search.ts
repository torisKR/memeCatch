import { withLocaleFallback, type Locale } from "@/lib/i18n";

export type SearchInputCopy = {
  label: string;
  placeholder: string;
  suggestionLabel: string;
  loading: string;
  noMatches: string;
  recent: string;
  clearRecent: string;
  popular: string;
  emptyHint: string;
  removeRecent: string;
};

export type GlobalSearchCopy = {
  eyebrow: string;
  title: string;
  description: string;
  resultSection: string;
  resultSummary: (query: string, count: number) => string;
  fallbackLabel: string;
  noResultLabel: string;
  noResultTitle: string;
  noResultDescription: string;
  submit: (query: string) => string;
  trendingTitle: string;
  translationOptions: string;
  input: SearchInputCopy;
};

const SEARCH_COPY_BASE = {
  ko: {
    eyebrow: "Search",
    title: "밈 검색",
    description: "이름·초성·별칭으로 바로 찾아보세요.",
    resultSection: "검색 결과",
    resultSummary: (query: string, count: number) => `‘${query}’ 검색 결과 ${count}개예요.`,
    fallbackLabel: "한국어 원문",
    noResultLabel: "아직 미포착",
    noResultTitle: "이 밈, 저희도 아직 몰라요",
    noResultDescription: "제보해 주시면 뜻과 유래를 정리해서 알려드려요.",
    submit: (query: string) => `‘${query}’ 제보하기`,
    trendingTitle: "지금 많이 찾는 밈",
    translationOptions: "번역 옵션 보기",
    input: {
      label: "밈 검색",
      placeholder: "무슨 밈인지 검색해보세요",
      suggestionLabel: "자동완성 결과",
      loading: "검색 중…",
      noMatches: "일치하는 밈이 없어요",
      recent: "최근 검색어",
      clearRecent: "전체 지우기",
      popular: "인기 검색어",
      emptyHint: "밈 이름이나 초성으로 검색해보세요",
      removeRecent: "최근 검색어 삭제",
    },
  },
  en: {
    eyebrow: "Search",
    title: "Search Korean memes",
    description: "Find a meme by name, Korean initials, or alias.",
    resultSection: "Search results",
    resultSummary: (query: string, count: number) => `${count} result${count === 1 ? "" : "s"} for “${query}”.`,
    fallbackLabel: "Korean original",
    noResultLabel: "Not captured yet",
    noResultTitle: "We do not know this meme yet",
    noResultDescription: "Send it in and we will explain its meaning and origin.",
    submit: (query: string) => `Submit “${query}”`,
    trendingTitle: "Trending now",
    translationOptions: "See translation options",
    input: {
      label: "Search memes",
      placeholder: "What meme are you looking for?",
      suggestionLabel: "Search suggestions",
      loading: "Searching…",
      noMatches: "No matching memes",
      recent: "Recent searches",
      clearRecent: "Clear all",
      popular: "Popular searches",
      emptyHint: "Search by meme name or Korean initials",
      removeRecent: "Remove recent search",
    },
  },
  ja: {
    eyebrow: "Search",
    title: "韓国ミームを検索",
    description: "名前・韓国語の初声・別名からミームを探せます。",
    resultSection: "検索結果",
    resultSummary: (query: string, count: number) => `「${query}」の検索結果 ${count}件`,
    fallbackLabel: "韓国語の原文",
    noResultLabel: "未収録",
    noResultTitle: "このミームはまだ未収録です",
    noResultDescription: "投稿していただければ、意味と由来を整理します。",
    submit: (query: string) => `「${query}」を投稿`,
    trendingTitle: "今よく検索されているミーム",
    translationOptions: "翻訳オプションを見る",
    input: {
      label: "ミームを検索",
      placeholder: "探したいミームは？",
      suggestionLabel: "検索候補",
      loading: "検索中…",
      noMatches: "一致するミームがありません",
      recent: "最近の検索",
      clearRecent: "すべて削除",
      popular: "人気の検索",
      emptyHint: "ミーム名や韓国語の初声で検索",
      removeRecent: "最近の検索を削除",
    },
  },
  zh: {
    eyebrow: "Search",
    title: "搜索韩国迷因",
    description: "可按名称、韩文初声或别名查找迷因。",
    resultSection: "搜索结果",
    resultSummary: (query: string, count: number) => `“${query}”的搜索结果：${count} 条`,
    fallbackLabel: "韩文原文",
    noResultLabel: "尚未收录",
    noResultTitle: "这个迷因还没有收录",
    noResultDescription: "欢迎投稿，我们会整理它的含义和来源。",
    submit: (query: string) => `投稿“${query}”`,
    trendingTitle: "正在热门搜索",
    translationOptions: "查看翻译选项",
    input: {
      label: "搜索迷因",
      placeholder: "想找什么迷因？",
      suggestionLabel: "搜索建议",
      loading: "搜索中…",
      noMatches: "没有匹配的迷因",
      recent: "最近搜索",
      clearRecent: "全部清除",
      popular: "热门搜索",
      emptyHint: "按迷因名称或韩文初声搜索",
      removeRecent: "删除最近搜索",
    },
  },
  "zh-tw": {
    eyebrow: "Search",
    title: "搜尋韓國迷因",
    description: "可按名稱、韓文初聲或別名查找迷因。",
    resultSection: "搜尋結果",
    resultSummary: (query: string, count: number) => `「${query}」的搜尋結果：${count} 則`,
    fallbackLabel: "韓文原文",
    noResultLabel: "尚未收錄",
    noResultTitle: "這個迷因還沒有收錄",
    noResultDescription: "歡迎投稿，我們會整理它的含義和來源。",
    submit: (query: string) => `投稿「${query}」`,
    trendingTitle: "目前熱門搜尋",
    translationOptions: "查看翻譯選項",
    input: {
      label: "搜尋迷因",
      placeholder: "想找什麼迷因？",
      suggestionLabel: "搜尋建議",
      loading: "搜尋中…",
      noMatches: "沒有符合的迷因",
      recent: "最近搜尋",
      clearRecent: "全部清除",
      popular: "熱門搜尋",
      emptyHint: "按迷因名稱或韓文初聲搜尋",
      removeRecent: "刪除最近搜尋",
    },
  },
} satisfies { ko: GlobalSearchCopy; en: GlobalSearchCopy; ja: GlobalSearchCopy; zh: GlobalSearchCopy; "zh-tw": GlobalSearchCopy };

export const GLOBAL_SEARCH_COPY: Record<Locale, GlobalSearchCopy> = withLocaleFallback(SEARCH_COPY_BASE);
