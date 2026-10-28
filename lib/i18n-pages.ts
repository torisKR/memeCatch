import type { Audience, MemeProduct } from "@/lib/meme-commerce";
import type { MemeNewsBrief } from "@/lib/meme-news";
import { withLocaleFallback, type Locale } from "@/lib/i18n";

export const AUDIENCE_LABELS_I18N: Record<Locale, Record<Audience, string>> = withLocaleFallback({
  ko: { "20s": "20대", "30s": "30대", "40s": "40대" },
  en: { "20s": "20s", "30s": "30s", "40s": "40s" },
  ja: { "20s": "20代", "30s": "30代", "40s": "40代" },
  zh: { "20s": "20多岁", "30s": "30多岁", "40s": "40多岁" },
});

const PRODUCT_CATEGORIES: Record<Locale, Record<string, string>> = withLocaleFallback({
  // ko는 원문 카테고리를 그대로 쓰므로 빈 맵 — 추론이 옵셔널 유니언으로 붕괴하지 않게 명시 캐스트
  ko: {} as Record<string, string>,
  en: { "크리에이터": "Creator", "교류 앱": "Social app", "패션": "Fashion", "차량": "Vehicle", "학습": "Learning" },
  ja: { "크리에이터": "クリエイター", "교류 앱": "交流アプリ", "패션": "ファッション", "차량": "車", "학습": "学習" },
  zh: { "크리에이터": "创作者", "교류 앱": "社交应用", "패션": "时尚", "차량": "车辆", "학습": "学习" },
});

export function localizeProductCategory(category: string, locale: Locale): string {
  return PRODUCT_CATEGORIES[locale][category] ?? category;
}

/** 본문 번역이 존재하는 콘텐츠 로케일로 축약(zh-tw→zh, 그 외 미번역→en). */
function contentLocale(locale: Exclude<Locale, "ko">): "en" | "ja" | "zh" {
  if (locale === "ja") return "ja";
  if (locale === "zh" || locale === "zh-tw") return "zh";
  return "en";
}

const PAGE_COPY_BASE = {
  ko: {
    shopTitle: "밈캐치 편집숍", shopIntro: "실시간 광고 상품과 밈캐치 에디터가 고른 상품을 한곳에서 살펴보세요.",
    liveAdTitle: "실시간 광고 상품", liveAdDescription: "제휴 파트너가 실시간으로 제공하는 광고 상품입니다.",
    recommendBadge: "추천",
    recommendTitle: "쇼핑메이트 추천", recommendDescription: "애드픽 쇼핑메이트가 오늘 홍보하기 좋은 상품으로 추천한 목록입니다.",
    seasonalBadge: "시즌 픽",
    seasonalTitle: "날씨가 추워진 요즘, 겨울 준비템", seasonalDescription: "기온이 뚝 떨어진 요즘 많이 찾는 난방·방한·보온 상품을 골랐어요. 가격과 재고는 판매처에서 확인해 주세요.",
    editorPickTitle: "밈캐치 에디터 픽", editorPickDescription: "밈캐치 에디터가 밈 생활에 어울리는 상품을 직접 골랐습니다.",
    liveBadge: "실시간 광고", editorBadge: "에디터 픽", carouselLabel: "실시간 광고 상품 캐러셀",
    previousProduct: "이전 상품", nextProduct: "다음 상품", pauseCarousel: "캐러셀 일시정지", playCarousel: "캐러셀 재생",
    viewProductLabel: (productName: string) => `상품 보기: ${productName}`,
    checkProductLabel: (productName: string) => `조건 확인하기: ${productName}`,
    productTitle: "밈 상품", productDescription: "밈 생활과 연결된 앱·패션·차량·학습 상품을 광고 고지와 확인 체크리스트와 함께 소개합니다.",
    productEyebrow: "Meme picks", productIntro: "재미만 보고 결제하지 않도록, 링크 이동 전에 확인할 조건과 광고 여부를 함께 보여드려요.",
    affiliateTitle: "광고·제휴 링크 안내", affiliateBody: (count: number) => `현재 ${count}개 캠페인의 링크를 이용할 수 있습니다. 링크를 통한 가입·설치·구매 시 밈캐치가 수수료를 받을 수 있으며, 이용자 가격이나 결과를 보장하지 않습니다.`,
    adNotice: "광고 안내", expires: "캠페인 만료", check: "조건 확인하기", ended: "캠페인 종료", original: "광고주 캠페인 원문 확인",
    hotdealTitle: "지금 뜨는 핫딜", hotdealDescription: "애드픽이 제공한 현재 판매 가능한 상품입니다.",
    popularTitle: "밈캐치 인기", popularDescription: "최근 7일 동안 밈캐치에서 클릭된 상품입니다.",
    affiliateBadge: "광고·제휴", viewProduct: "상품 보러 가기", priceAtMerchant: "판매처에서 가격 확인", originalPrice: "정상가",
    lastUpdated: "마지막 갱신", staleWarning: "상품 정보 갱신이 지연되고 있어 가격이 달라질 수 있습니다",
    emptyHotdeals: "핫딜 상품을 준비하고 있습니다. 잠시 후 다시 확인해 주세요.", merchantPriceNotice: "최종 가격과 재고는 판매처에서 달라질 수 있습니다.",
    legacyOffersTitle: "앱·서비스 제휴 캠페인",
    newsTitle: "세대별 밈 소식", newsDescription: "20대·30대·40대가 알아두면 좋은 밈과 디지털 생활 정보를 짧은 체크리스트로 정리합니다.",
    newsEyebrow: "Generation brief", newsIntro: "길게 검색하지 않아도 되도록, 세대별로 많이 아는 밈과 바로 써먹는 안전·절약 정보를 함께 정리해요.", ageNav: "연령대 바로가기",
    briefing: "브리핑", efficient: "지금 알면 효율적인 밈 생활", exploreAll: "전체 밈 탐색", known: "가 알아요·써요 한 밈",
    voteInfo: "로그인 이용자의 세대별 투표를 합산한 공개 하이라이트입니다.", votes: (count: number) => `인지·사용 ${count}표`,
    noVotes: "아직 공개 투표 표본이 부족해요. 아래 브리핑부터 확인하고, 밈 상세에서 세대별 투표에 참여해 주세요.",
    money: "절약", safety: "안전", culture: "문화", verified: "확인일", source: "출처",
  },
  en: {
    shopTitle: "MemeCatch Edit Shop", shopIntro: "Browse live sponsored products alongside picks selected by the MemeCatch editors.",
    liveAdTitle: "Live sponsored products", liveAdDescription: "Sponsored products supplied in real time by our affiliate partner.",
    recommendBadge: "Picks",
    recommendTitle: "ShoppingMate picks", recommendDescription: "Products recommended today by the Adpick ShoppingMate feed.",
    seasonalBadge: "Season pick",
    seasonalTitle: "Cold days are here: winter essentials", seasonalDescription: "Heating, cold-weather, and warmth products people look for as temperatures drop. Check price and stock at the merchant.",
    editorPickTitle: "MemeCatch editor picks", editorPickDescription: "Products selected by MemeCatch editors for a meme-filled lifestyle.",
    liveBadge: "Live ad", editorBadge: "Editor pick", carouselLabel: "Live sponsored products carousel",
    previousProduct: "Previous product", nextProduct: "Next product", pauseCarousel: "Pause carousel", playCarousel: "Play carousel",
    viewProductLabel: (productName: string) => `View product: ${productName}`,
    checkProductLabel: (productName: string) => `Check product details: ${productName}`,
    productTitle: "Meme picks", productDescription: "Apps, fashion, vehicles, and learning offers related to meme culture, with ad disclosures and practical checklists.",
    productEyebrow: "Meme picks", productIntro: "Before you buy for the fun of it, review the conditions and advertising disclosure behind every link.",
    affiliateTitle: "Advertising & affiliate notice", affiliateBody: (count: number) => `${count} campaign links are currently available. MemeCatch may earn a commission from sign-ups, installs, or purchases, without changing your price. Results are not guaranteed.`,
    adNotice: "Ad disclosure", expires: "Campaign ends", check: "Review conditions", ended: "Campaign ended", original: "View advertiser campaign",
    hotdealTitle: "Hot deals right now", hotdealDescription: "Currently available products provided by AdPick.",
    popularTitle: "Popular on MemeCatch", popularDescription: "Products clicked on MemeCatch during the past 7 days.",
    affiliateBadge: "Ad · Affiliate", viewProduct: "View product", priceAtMerchant: "Check price at merchant", originalPrice: "Original price",
    lastUpdated: "Last updated", staleWarning: "Product updates are delayed, so prices may have changed.",
    emptyHotdeals: "Hot deals are being prepared. Please check again soon.", merchantPriceNotice: "Final price and stock may differ at the merchant.",
    legacyOffersTitle: "App & service affiliate offers",
    newsTitle: "Meme news by age", newsDescription: "Short checklists of memes and useful digital-life information for people in their 20s, 30s, and 40s.",
    newsEyebrow: "Generation brief", newsIntro: "Useful memes, safety tips, and money-saving information organized by age group—without a long search.", ageNav: "Jump to age group",
    briefing: "briefing", efficient: "A more efficient meme life", exploreAll: "Explore all memes", known: " meme highlights",
    voteInfo: "Public highlights aggregated from signed-in users' age-group votes.", votes: (count: number) => `${count} know/use votes`,
    noVotes: "There are not enough public votes yet. Start with the briefs below, then vote from a meme detail page.",
    money: "Savings", safety: "Safety", culture: "Culture", verified: "Checked", source: "Source",
  },
  ja: {
    shopTitle: "MemeCatch セレクトショップ", shopIntro: "リアルタイム広告商品とMemeCatch編集部が選んだ商品をまとめて紹介します。",
    liveAdTitle: "リアルタイム広告商品", liveAdDescription: "提携パートナーからリアルタイムで提供される広告商品です。",
    recommendBadge: "おすすめ",
    recommendTitle: "ShoppingMateのおすすめ", recommendDescription: "Adpick ShoppingMateが本日のおすすめとして提供する商品リストです。",
    seasonalBadge: "シーズンピック",
    seasonalTitle: "寒くなってきた今、冬の準備アイテム", seasonalDescription: "気温が下がる今よく探される暖房・防寒・保温アイテムを選びました。価格と在庫は販売先でご確認ください。",
    editorPickTitle: "MemeCatch 編集部ピック", editorPickDescription: "ミームのある暮らしに合う商品をMemeCatch編集部が選びました。",
    liveBadge: "リアルタイム広告", editorBadge: "編集部ピック", carouselLabel: "リアルタイム広告商品のカルーセル",
    previousProduct: "前の商品", nextProduct: "次の商品", pauseCarousel: "カルーセルを一時停止", playCarousel: "カルーセルを再生",
    viewProductLabel: (productName: string) => `商品を見る：${productName}`,
    checkProductLabel: (productName: string) => `条件を確認：${productName}`,
    productTitle: "ミーム商品", productDescription: "ミーム生活に関連するアプリ・ファッション・車・学習商品を、広告表示と確認リスト付きで紹介します。",
    productEyebrow: "Meme picks", productIntro: "面白さだけで購入しないよう、リンクを開く前に条件と広告の有無を確認できます。",
    affiliateTitle: "広告・アフィリエイトリンクについて", affiliateBody: (count: number) => `現在${count}件のキャンペーンリンクを利用できます。登録・インストール・購入によりMemeCatchが手数料を受け取る場合があります。価格や結果は保証しません。`,
    adNotice: "広告表示", expires: "終了日", check: "条件を確認", ended: "キャンペーン終了", original: "広告主のキャンペーンを確認",
    hotdealTitle: "今注目のセール", hotdealDescription: "AdPickが提供する、現在購入可能な商品です。",
    popularTitle: "MemeCatchで人気", popularDescription: "過去7日間にMemeCatch内でクリックされた商品です。",
    affiliateBadge: "広告・アフィリエイト", viewProduct: "商品を見る", priceAtMerchant: "販売店で価格を確認", originalPrice: "通常価格",
    lastUpdated: "最終更新", staleWarning: "商品情報の更新が遅れているため、価格が異なる場合があります。",
    emptyHotdeals: "セール商品を準備中です。しばらくしてからもう一度ご確認ください。", merchantPriceNotice: "最終価格と在庫は販売店で異なる場合があります。",
    legacyOffersTitle: "アプリ・サービスの提携キャンペーン",
    newsTitle: "世代別ミーム情報", newsDescription: "20代・30代・40代に役立つミームとデジタル生活情報を短いチェックリストで紹介します。",
    newsEyebrow: "Generation brief", newsIntro: "長く検索しなくても、世代別のミームと安全・節約情報をすぐ確認できます。", ageNav: "年代へ移動",
    briefing: "向けブリーフィング", efficient: "今知ると役立つミーム生活", exploreAll: "すべてのミームを見る", known: "の注目ミーム",
    voteInfo: "ログインユーザーの世代別投票を集計した公開ハイライトです。", votes: (count: number) => `認知・使用 ${count}票`,
    noVotes: "公開投票がまだ不足しています。下のブリーフィングを確認し、ミーム詳細から投票してください。",
    money: "節約", safety: "安全", culture: "カルチャー", verified: "確認日", source: "出典",
  },
  zh: {
    shopTitle: "MemeCatch 迷因选物店", shopIntro: "集中浏览实时广告商品与 MemeCatch 编辑团队精选的商品。",
    liveAdTitle: "实时广告商品", liveAdDescription: "由联盟合作伙伴实时提供的广告商品。",
    recommendBadge: "推荐",
    recommendTitle: "ShoppingMate 推荐", recommendDescription: "来自 Adpick ShoppingMate 推荐源的今日推荐商品。",
    seasonalBadge: "当季精选",
    seasonalTitle: "天气转冷，冬季必备好物", seasonalDescription: "精选气温下降时大家常找的取暖、防寒、保暖商品。价格和库存请以商家页面为准。",
    editorPickTitle: "MemeCatch 编辑精选", editorPickDescription: "由 MemeCatch 编辑团队为迷因生活挑选的商品。",
    liveBadge: "实时广告", editorBadge: "编辑精选", carouselLabel: "实时广告商品轮播",
    previousProduct: "上一个商品", nextProduct: "下一个商品", pauseCarousel: "暂停轮播", playCarousel: "播放轮播",
    viewProductLabel: (productName: string) => `查看商品：${productName}`,
    checkProductLabel: (productName: string) => `确认商品条件：${productName}`,
    productTitle: "迷因好物", productDescription: "介绍与迷因生活相关的应用、时尚、车辆和学习产品，并提供广告披露与检查清单。",
    productEyebrow: "Meme picks", productIntro: "避免只因有趣而消费；打开链接前先查看条件与广告说明。",
    affiliateTitle: "广告与联盟链接说明", affiliateBody: (count: number) => `目前有${count}个活动链接可用。通过链接注册、安装或购买时，MemeCatch 可能获得佣金；不保证价格或结果。`,
    adNotice: "广告说明", expires: "活动截止", check: "查看条件", ended: "活动已结束", original: "查看广告主活动原文",
    hotdealTitle: "当前热门优惠", hotdealDescription: "由 AdPick 提供的当前可购买商品。",
    popularTitle: "MemeCatch 人气", popularDescription: "过去7天内在 MemeCatch 被点击的商品。",
    affiliateBadge: "广告·联盟", viewProduct: "查看商品", priceAtMerchant: "前往商家确认价格", originalPrice: "原价",
    lastUpdated: "最后更新", staleWarning: "商品信息更新延迟，价格可能已有变化。",
    emptyHotdeals: "优惠商品正在准备中，请稍后再来查看。", merchantPriceNotice: "最终价格与库存可能因商家而异。",
    legacyOffersTitle: "应用与服务联盟活动",
    newsTitle: "分年龄迷因资讯", newsDescription: "用简短清单整理适合20、30、40多岁人群的迷因与实用数字生活信息。",
    newsEyebrow: "Generation brief", newsIntro: "无需长时间搜索，即可按年龄了解热门迷因、安全与省钱信息。", ageNav: "跳转至年龄组",
    briefing: "简报", efficient: "现在了解更高效的迷因生活", exploreAll: "探索全部迷因", known: "热门迷因",
    voteInfo: "根据登录用户的年龄组投票汇总而成的公开亮点。", votes: (count: number) => `了解/使用 ${count}票`,
    noVotes: "目前公开投票样本不足。请先阅读下方简报，并在迷因详情页参与投票。",
    money: "省钱", safety: "安全", culture: "文化", verified: "核实日期", source: "来源",
  },
};

export const PAGE_COPY: Record<Locale, (typeof PAGE_COPY_BASE)["ko"]> = withLocaleFallback(PAGE_COPY_BASE);

const PRODUCT_TITLES: Record<"en" | "ja" | "zh", Record<string, string>> = {
  en: {
    "adpick-shoppingmate-signup": "Checklist before starting AdPick Shopping Mate",
    "amasia-friend-app": "Safety checks before installing a nearby or international friends app",
    "carebear-summer-fashion": "7 checks before buying Care Bears summer fashion",
    "chago-long-term-rental": "8 checks before comparing a first-car lease or long-term rental",
    "daesung-grade12-signup": "Checklist for online class sign-up benefits",
    "daytalk-friend-app": "Profile, payment, and meeting safety for chat apps",
    "dokit-friend-app": "7 safety checks before installing a Japanese friends chat app",
    "gangdae-math-season1": "7 checks before choosing a math mock-exam package",
    "kimseungri-gyeolgyeok-sayu": "7 checks before buying an advanced Korean-language course",
    "kmate-friend-app": "Privacy and language-exchange checklist for international friends apps",
    "truckdoctor-truck-lease": "8 costs to calculate before leasing a one-ton truck",
  },
  ja: {
    "adpick-shoppingmate-signup": "AdPickショッピングメイト開始前のチェックリスト", "amasia-friend-app": "友達・国際交流アプリの安全確認", "carebear-summer-fashion": "ケアベア夏服購入前の7項目", "chago-long-term-rental": "初めての車の長期レンタル・リース比較8項目", "daesung-grade12-signup": "オンライン講座の登録特典チェック", "daytalk-friend-app": "チャットアプリのプロフィール・決済・対面安全", "dokit-friend-app": "日本人友達チャットアプリの安全基準7項目", "gangdae-math-season1": "数学模試パッケージ選びの7項目", "kimseungri-gyeolgyeok-sayu": "上級国語講座購入前の7項目", "kmate-friend-app": "外国人友達アプリの個人情報・言語交換チェック", "truckdoctor-truck-lease": "1トントラックのリース前に計算する8項目",
  },
  zh: {
    "adpick-shoppingmate-signup": "开始 AdPick Shopping Mate 前的检查清单", "amasia-friend-app": "安装附近或国际交友应用前的安全检查", "carebear-summer-fashion": "购买 Care Bears 夏装前的7项检查", "chago-long-term-rental": "首次比较长期租车或租赁前的8项检查", "daesung-grade12-signup": "在线课程注册优惠检查清单", "daytalk-friend-app": "聊天应用的资料、支付与见面安全", "dokit-friend-app": "安装日本交友聊天应用前的7项安全标准", "gangdae-math-season1": "选择数学模拟考试套装前的7项检查", "kimseungri-gyeolgyeok-sayu": "购买高难度韩语课程前的7项检查", "kmate-friend-app": "国际交友应用的隐私与语言交换清单", "truckdoctor-truck-lease": "租赁一吨卡车前要计算的8项费用",
  },
};

const GENERIC_PRODUCT = {
  en: { description: "Review eligibility, total cost, privacy, cancellation, and refund conditions before continuing.", disclosure: "Advertisement: MemeCatch may receive a commission when you use this link. Benefits or results are not guaranteed." },
  ja: { description: "進む前に対象条件・総費用・個人情報・解約・返金条件を確認してください。", disclosure: "広告：このリンクの利用によりMemeCatchが手数料を受け取る場合があります。特典や結果は保証されません。" },
  zh: { description: "继续前请确认资格、总费用、隐私、取消及退款条件。", disclosure: "广告：使用此链接时 MemeCatch 可能获得佣金；不保证优惠或结果。" },
} as const;

export function localizeProduct(product: MemeProduct, locale: Locale): Pick<MemeProduct, "title" | "description" | "disclosure"> {
  if (locale === "ko") return product;
  const l = contentLocale(locale);
  return { title: PRODUCT_TITLES[l][product.id] ?? product.title, ...GENERIC_PRODUCT[l] };
}

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
