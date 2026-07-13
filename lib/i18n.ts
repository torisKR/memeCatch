export const SUPPORTED_LOCALES = ["ko", "en", "ja", "zh"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ko";
export const LOCALE_COOKIE = "memecatch_locale";
export const LOCALE_HEADER = "x-memecatch-locale";

export const LANGUAGE_NAMES: Record<Locale, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  zh: "中文",
};

export const LANGUAGE_SHORT_NAMES: Record<Locale, "KO" | "EN" | "JA" | "ZH"> = {
  ko: "KO",
  en: "EN",
  ja: "JA",
  zh: "ZH",
};

export function isLocale(value: string | null | undefined): value is Locale {
  return SUPPORTED_LOCALES.includes(value as Locale);
}

export function getDocumentLanguage(locale: Locale): string {
  return locale === "zh" ? "zh-Hans" : locale;
}

export function localeFromLanguageTag(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const language = value.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(language) ? language : null;
}

export function localeFromCountry(value: string | null | undefined): Locale | null {
  switch (value?.trim().toUpperCase()) {
    case "KR": return "ko";
    case "JP": return "ja";
    case "CN":
    case "HK":
    case "MO":
    case "TW": return "zh";
    default: return null;
  }
}

export function localeFromAcceptLanguage(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const entries = value
    .split(",")
    .map((entry) => {
      const [tag, ...parameters] = entry.trim().split(";");
      const quality = Number(parameters.find((item) => item.trim().startsWith("q="))?.split("=")[1] ?? 1);
      return { locale: localeFromLanguageTag(tag), quality: Number.isFinite(quality) ? quality : 0 };
    })
    .filter((entry): entry is { locale: Locale; quality: number } => entry.locale !== null)
    .sort((a, b) => b.quality - a.quality);
  return entries[0]?.locale ?? null;
}

const MESSAGES = {
  ko: {
    brand: "밈캐치", home: "밈캐치 홈", search: "밈 검색", searchPlaceholder: "밈 검색",
    explore: "탐색", timeline: "연표", community: "커뮤니티", submit: "제보", my: "MY", login: "로그인",
    random: "아무 밈이나 보기", language: "언어 설정", languageMenu: "언어 선택",
    footerNav: "사이트 정보", about: "밈캐치 소개", privacy: "개인정보처리방침", terms: "이용약관",
    news: "세대별 밈 소식", products: "밈 상품", donate: "후원하기", legalSummary: "운영·저작권 안내",
    legal1: "밈캐치는 한국 밈·유행어의 뜻과 유래를 기록하는 사전 서비스입니다. 모든 제보는 운영자 검수(사실 확인 → 저작권 확인)를 거쳐 공개됩니다.",
    legal2: "원본 영상·이미지는 저장하지 않고 출처 링크·임베드로만 제공하며, 각 콘텐츠의 저작권은 원저작자에게 있습니다. 문의·삭제 요청:",
    mainNav: "주 내비게이션",
  },
  en: {
    brand: "MemeCatch", home: "MemeCatch home", search: "Search memes", searchPlaceholder: "Search memes",
    explore: "Explore", timeline: "Timeline", community: "Community", submit: "Submit", my: "MY", login: "Log in",
    random: "Show a random meme", language: "Language", languageMenu: "Choose language",
    footerNav: "Site information", about: "About MemeCatch", privacy: "Privacy", terms: "Terms",
    news: "Meme news by age", products: "Meme picks", donate: "Support us", legalSummary: "About & copyright",
    legal1: "MemeCatch is a dictionary that documents the meaning and origin of Korean memes and trending expressions. Submissions are published only after fact and copyright review.",
    legal2: "We do not store original videos or images; we only provide source links and embeds. Copyright remains with each creator. Contact or removal requests:",
    mainNav: "Main navigation",
  },
  ja: {
    brand: "MemeCatch", home: "MemeCatch ホーム", search: "ミームを検索", searchPlaceholder: "ミームを検索",
    explore: "探す", timeline: "年表", community: "コミュニティ", submit: "投稿", my: "MY", login: "ログイン",
    random: "ランダムなミームを見る", language: "言語", languageMenu: "言語を選択",
    footerNav: "サイト情報", about: "MemeCatchについて", privacy: "プライバシー", terms: "利用規約",
    news: "世代別ミーム情報", products: "ミーム商品", donate: "支援する", legalSummary: "運営・著作権について",
    legal1: "MemeCatchは韓国のミームや流行語の意味と由来を記録する辞典サービスです。投稿は事実・著作権の確認後に公開されます。",
    legal2: "元の動画・画像は保存せず、出典リンクと埋め込みのみを提供します。著作権は各制作者に帰属します。お問い合わせ・削除依頼：",
    mainNav: "メインナビゲーション",
  },
  zh: {
    brand: "MemeCatch", home: "MemeCatch 首页", search: "搜索迷因", searchPlaceholder: "搜索迷因",
    explore: "发现", timeline: "时间线", community: "社区", submit: "投稿", my: "我的", login: "登录",
    random: "随机查看迷因", language: "语言", languageMenu: "选择语言",
    footerNav: "网站信息", about: "关于 MemeCatch", privacy: "隐私政策", terms: "使用条款",
    news: "分年龄迷因资讯", products: "迷因好物", donate: "支持我们", legalSummary: "运营与版权说明",
    legal1: "MemeCatch 是记录韩国迷因和流行语含义及来源的词典服务。所有投稿均经事实与版权审核后发布。",
    legal2: "我们不保存原始视频或图片，仅提供来源链接和嵌入内容。版权归各创作者所有。咨询或删除请求：",
    mainNav: "主导航",
  },
} as const;

export type Messages = (typeof MESSAGES)[Locale];
export function getMessages(locale: Locale): Messages { return MESSAGES[locale]; }
