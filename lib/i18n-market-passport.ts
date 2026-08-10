import { withLocaleFallback, type Locale } from "@/lib/i18n";
import type { MarketVariantRelation } from "@/lib/meme-market-passport";

export type MarketPassportCopy = {
  eyebrow: string;
  title: string;
  description: string;
  origin: string;
  language: string;
  active: string;
  adopted: string;
  originRole: string;
  variantTitle: string;
  variantDescription: string;
  noVariants: string;
  unavailableTitle: string;
  unavailableBody: string;
  usage: string;
  caution: string;
  marketNames: Record<string, string>;
  relations: Record<MarketVariantRelation, string>;
};

const BASE: { ko: MarketPassportCopy; en: MarketPassportCopy; ja: MarketPassportCopy; zh: MarketPassportCopy } = {
  ko: {
    eyebrow: "GLOBAL MEME PASSPORT",
    title: "이 밈은 어디에서 어떻게 쓰이나요?",
    description: "화면 언어와 밈의 원산지·사용 시장은 다를 수 있어요. 검수된 시장 정보만 보여드려요.",
    origin: "원산지",
    language: "언어",
    active: "현재 사용 시장",
    adopted: "도입 시장",
    originRole: "원본 시장",
    variantTitle: "연결된 현지 변형",
    variantDescription: "같은 밈 계보로 검수된 다른 문서를 확인하세요.",
    noVariants: "아직 검수된 현지 변형 연결이 없어요.",
    unavailableTitle: "글로벌 시장 정보를 불러오지 못했어요",
    unavailableBody: "잠시 후 다시 확인해 주세요. 확인되지 않은 변형 링크는 보여드리지 않아요.",
    usage: "현지 사용 메모",
    caution: "현지 주의사항",
    marketNames: { KR: "한국", US: "미국", JP: "일본", TW: "대만", CN: "중국", GLOBAL: "글로벌" },
    relations: {
      derived_from: "에서 파생",
      local_variant: "현지 변형",
      local_equivalent: "현지 대응 표현",
    },
  },
  en: {
    eyebrow: "GLOBAL MEME PASSPORT",
    title: "Where does this meme travel?",
    description: "The page language is not the same thing as a meme's origin or market. Only reviewed market facts appear here.",
    origin: "Origin market",
    language: "Language",
    active: "Active market",
    adopted: "Adopted market",
    originRole: "Original market",
    variantTitle: "Connected local variants",
    variantDescription: "Explore other reviewed entries in this meme family.",
    noVariants: "No reviewed local variant is connected yet.",
    unavailableTitle: "Global market data is unavailable",
    unavailableBody: "Please check again soon. We will not show an unverified variant link.",
    usage: "Local usage note",
    caution: "Local caution",
    marketNames: { KR: "Korea", US: "United States", JP: "Japan", TW: "Taiwan", CN: "China", GLOBAL: "Global" },
    relations: {
      derived_from: "derived from",
      local_variant: "local variant",
      local_equivalent: "local equivalent",
    },
  },
  ja: {
    eyebrow: "GLOBAL MEME PASSPORT",
    title: "このミームはどこで、どう使われる？",
    description: "ページの言語とミームの発祥地・使用市場は同じとは限りません。確認済みの市場情報だけを表示します。",
    origin: "発祥市場",
    language: "言語",
    active: "現在の使用市場",
    adopted: "導入市場",
    originRole: "原発祥市場",
    variantTitle: "つながっている現地バリエーション",
    variantDescription: "同じミーム系譜にある確認済みの記事を見られます。",
    noVariants: "確認済みの現地バリエーションはまだありません。",
    unavailableTitle: "グローバル市場情報を読み込めません",
    unavailableBody: "しばらくしてから再確認してください。未確認のバリエーションリンクは表示しません。",
    usage: "現地での使い方",
    caution: "現地での注意",
    marketNames: { KR: "韓国", US: "アメリカ", JP: "日本", TW: "台湾", CN: "中国", GLOBAL: "グローバル" },
    relations: {
      derived_from: "から派生",
      local_variant: "現地バリエーション",
      local_equivalent: "現地の対応表現",
    },
  },
  zh: {
    eyebrow: "GLOBAL MEME PASSPORT",
    title: "这个迷因在哪里、如何传播？",
    description: "页面语言不等于迷因的起源地或使用市场。这里只显示经过审核的市场信息。",
    origin: "起源市场",
    language: "语言",
    active: "当前使用市场",
    adopted: "采用市场",
    originRole: "原始市场",
    variantTitle: "关联的本地变体",
    variantDescription: "查看同一迷因谱系中经过审核的其他词条。",
    noVariants: "目前还没有经过审核的本地变体关联。",
    unavailableTitle: "暂时无法读取全球市场信息",
    unavailableBody: "请稍后再试。我们不会显示未经确认的变体链接。",
    usage: "本地使用说明",
    caution: "本地注意事项",
    marketNames: { KR: "韩国", US: "美国", JP: "日本", TW: "台湾", CN: "中国", GLOBAL: "全球" },
    relations: {
      derived_from: "源自",
      local_variant: "本地变体",
      local_equivalent: "本地对应表达",
    },
  },
};

export const MARKET_PASSPORT_COPY: Record<Locale, MarketPassportCopy> = withLocaleFallback(BASE);
