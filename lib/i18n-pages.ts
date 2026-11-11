import type { Audience, MemeNewsBrief } from "@/lib/meme-news";
import { withLocaleFallback, type Locale } from "@/lib/i18n";

export const AUDIENCE_LABELS_I18N: Record<Locale, Record<Audience, string>> = withLocaleFallback({
  ko: { "20s": "20대", "30s": "30대", "40s": "40대" },
  en: { "20s": "20s", "30s": "30s", "40s": "40s" },
  ja: { "20s": "20代", "30s": "30代", "40s": "40代" },
  zh: { "20s": "20多岁", "30s": "30多岁", "40s": "40多岁" },
});

/** 본문 번역이 존재하는 콘텐츠 로케일로 축약(zh-tw→zh, 그 외 미번역→en). */
function contentLocale(locale: Exclude<Locale, "ko">): "en" | "ja" | "zh" {
  if (locale === "ja") return "ja";
  if (locale === "zh" || locale === "zh-tw") return "zh";
  return "en";
}

const PAGE_COPY_BASE = {
  ko: {
    newsTitle: "세대별 밈 소식", newsDescription: "20대·30대·40대가 알아두면 좋은 밈과 디지털 생활 정보를 짧은 체크리스트로 정리합니다.",
    newsEyebrow: "Generation brief", newsIntro: "길게 검색하지 않아도 되도록, 세대별로 많이 아는 밈과 바로 써먹는 안전·절약 정보를 함께 정리해요.", ageNav: "연령대 바로가기",
    briefing: "브리핑", efficient: "지금 알면 효율적인 밈 생활", exploreAll: "전체 밈 탐색", known: "가 알아요·써요 한 밈",
    voteInfo: "로그인 이용자의 세대별 투표를 합산한 공개 하이라이트입니다.", votes: (count: number) => `인지·사용 ${count}표`,
    noVotes: "아직 공개 투표 표본이 부족해요. 아래 브리핑부터 확인하고, 밈 상세에서 세대별 투표에 참여해 주세요.",
    money: "절약", safety: "안전", culture: "문화", verified: "확인일", source: "출처",
  },
  en: {
    newsTitle: "Meme news by age", newsDescription: "Short checklists of memes and useful digital-life information for people in their 20s, 30s, and 40s.",
    newsEyebrow: "Generation brief", newsIntro: "Useful memes, safety tips, and money-saving information organized by age group—without a long search.", ageNav: "Jump to age group",
    briefing: "briefing", efficient: "A more efficient meme life", exploreAll: "Explore all memes", known: " meme highlights",
    voteInfo: "Public highlights aggregated from signed-in users' age-group votes.", votes: (count: number) => `${count} know/use votes`,
    noVotes: "There are not enough public votes yet. Start with the briefs below, then vote from a meme detail page.",
    money: "Savings", safety: "Safety", culture: "Culture", verified: "Checked", source: "Source",
  },
  ja: {
    newsTitle: "世代別ミーム情報", newsDescription: "20代・30代・40代に役立つミームとデジタル生活情報を短いチェックリストで紹介します。",
    newsEyebrow: "Generation brief", newsIntro: "長く検索しなくても、世代別のミームと安全・節約情報をすぐ確認できます。", ageNav: "年代へ移動",
    briefing: "向けブリーフィング", efficient: "今知ると役立つミーム生活", exploreAll: "すべてのミームを見る", known: "の注目ミーム",
    voteInfo: "ログインユーザーの世代別投票を集計した公開ハイライトです。", votes: (count: number) => `認知・使用 ${count}票`,
    noVotes: "公開投票がまだ不足しています。下のブリーフィングを確認し、ミーム詳細から投票してください。",
    money: "節約", safety: "安全", culture: "カルチャー", verified: "確認日", source: "出典",
  },
  zh: {
    newsTitle: "分年龄迷因资讯", newsDescription: "用简短清单整理适合20、30、40多岁人群的迷因与实用数字生活信息。",
    newsEyebrow: "Generation brief", newsIntro: "无需长时间搜索，即可按年龄了解热门迷因、安全与省钱信息。", ageNav: "跳转至年龄组",
    briefing: "简报", efficient: "现在了解更高效的迷因生活", exploreAll: "探索全部迷因", known: "热门迷因",
    voteInfo: "根据登录用户的年龄组投票汇总而成的公开亮点。", votes: (count: number) => `了解/使用 ${count}票`,
    noVotes: "目前公开投票样本不足。请先阅读下方简报，并在迷因详情页参与投票。",
    money: "省钱", safety: "安全", culture: "文化", verified: "核实日期", source: "来源",
  },
};

export const PAGE_COPY: Record<Locale, (typeof PAGE_COPY_BASE)["ko"]> = withLocaleFallback(PAGE_COPY_BASE);

const NEWS_TITLES: Record<"en" | "ja" | "zh", Record<string, string>> = {
  en: { "20s-affiliate-disclosure": "30-second check before posting an affiliate link", "20s-social-app-safety": "Lock down location on meme profiles", "20s-sale-meme-check": "Check the final price before buying the sale meme", "30s-work-chat-meme": "Check the audience before sending a meme at work", "30s-ott-check": "Before subscribing just to see a meme's source", "30s-car-total-cost": "Car meme ads: compare total cost, not monthly payment", "40s-family-meme-context": "Check context before banning a meme your child uses", "40s-study-benefit-dates": "Write down three dates for online-class offers", "40s-chat-app-boundary": "Set payment and meeting boundaries for chat apps" },
  ja: { "20s-affiliate-disclosure": "アフィリエイトリンク投稿前の30秒確認", "20s-social-app-safety": "ミームプロフィールは位置情報から非公開に", "20s-sale-meme-check": "セールミームで買う前に最終金額を確認", "30s-work-chat-meme": "社内チャットでミームを送る前に公開範囲を確認", "30s-ott-check": "ミームの元ネタを見るためにOTTを契約する前に", "30s-car-total-cost": "車の広告は月額より総費用", "40s-family-meme-context": "子どものミームは禁止より元の文脈確認", "40s-study-benefit-dates": "オンライン講座の無料特典は3つの日付を確認", "40s-chat-app-boundary": "チャットアプリの決済・対面ルールを決める" },
  zh: { "20s-affiliate-disclosure": "发布联盟链接前的30秒检查", "20s-social-app-safety": "先关闭迷因头像中的位置暴露", "20s-sale-meme-check": "因促销迷因购买前先看最终金额", "30s-work-chat-meme": "在工作群发迷因前确认可见范围", "30s-ott-check": "为看迷因原作订阅流媒体前", "30s-car-total-cost": "汽车迷因广告：看总成本而非月供", "40s-family-meme-context": "与其禁止孩子用迷因，不如先查原始语境", "40s-study-benefit-dates": "在线课程免费优惠先记下三个日期", "40s-chat-app-boundary": "为聊天应用设定支付与见面边界" },
};

const GENERIC_NEWS = {
  en: { summary: "Check the original context, privacy, total cost, and cancellation terms before acting on a trending post.", checklist: ["Check the original source and context", "Review privacy and total cost", "Confirm reporting, cancellation, or refund options"] },
  ja: { summary: "流行投稿を見て行動する前に、元の文脈・個人情報・総費用・解約条件を確認しましょう。", checklist: ["元の出典と文脈を確認", "個人情報と総費用を確認", "通報・解約・返金方法を確認"] },
  zh: { summary: "根据热门内容采取行动前，请确认原始语境、隐私、总费用与取消条件。", checklist: ["确认原始来源与语境", "检查隐私与总费用", "确认举报、取消或退款方式"] },
} as const;

export function localizeBrief(brief: MemeNewsBrief, locale: Locale): Pick<MemeNewsBrief, "title" | "summary" | "checklist"> {
  if (locale === "ko") return brief;
  const l = contentLocale(locale);
  return { title: NEWS_TITLES[l][brief.id] ?? brief.title, ...GENERIC_NEWS[l] };
}
