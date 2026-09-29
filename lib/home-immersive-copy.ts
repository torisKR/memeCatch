import {
  SEO_ROUTE_LOCALES,
  type SeoRouteLocale,
} from "@/lib/i18n-routing";

export type HomeStoryChapterId = "discover" | "context" | "participate";

type HomeStoryChapter = {
  id: HomeStoryChapterId;
  href:
    | "#home-story-discover"
    | "#home-story-context"
    | "#home-story-participate";
  navigationLabel: string;
  eyebrow: string;
  title: string;
  description: string;
};

export type HomeImmersiveCopy = {
  navigationLabel: string;
  skipLabel: string;
  sceneLabel: string;
  pauseScene: string;
  playScene: string;
  chapters: readonly [HomeStoryChapter, HomeStoryChapter, HomeStoryChapter];
  search: {
    label: string;
    placeholder: string;
    button: string;
  };
  contextAction: string;
  communityAction: string;
  productsAction: string;
};

export const HOME_IMMERSIVE_LOCALES = SEO_ROUTE_LOCALES;

export const HOME_IMMERSIVE_COPY: Record<SeoRouteLocale, HomeImmersiveCopy> = {
  ko: {
    navigationLabel: "홈 스토리 챕터",
    skipLabel: "최신 밈으로 건너뛰기",
    sceneLabel: "밈의 발견, 맥락, 참여를 하나의 흐름으로 보여 주는 오렌지색 입체 장면",
    pauseScene: "장면 멈추기",
    playScene: "장면 재생하기",
    chapters: [
      {
        id: "discover",
        href: "#home-story-discover",
        navigationLabel: "발견",
        eyebrow: "01 · DISCOVER",
        title: "밈을 발견하고, 맥락까지 읽으세요.",
        description: "처음 본 유행어부터 익숙한 짤까지, 이름이나 기억나는 표현으로 바로 찾아보세요.",
      },
      {
        id: "context",
        href: "#home-story-context",
        navigationLabel: "맥락",
        eyebrow: "02 · CONTEXT",
        title: "쓰기 전에, 그 밈을 둘러싼 맥락부터.",
        description: "뜻과 유래, 지금의 사용 신호를 함께 읽으면 같은 표현도 어디에서 어떻게 달라지는지 보입니다.",
      },
      {
        id: "participate",
        href: "#home-story-participate",
        navigationLabel: "참여",
        eyebrow: "03 · PARTICIPATE",
        title: "읽었다면, 다음 맥락을 함께 만드세요.",
        description: "커뮤니티에서 발견한 장면을 나누고, 판매 주체와 관계가 표시된 밈 상품도 둘러보세요.",
      },
    ],
    search: {
      label: "밈 검색",
      placeholder: "궁금한 밈이나 유행어를 검색하세요",
      button: "검색",
    },
    contextAction: "네 가지 사용 신호 보기",
    communityAction: "커뮤니티 가기",
    productsAction: "밈 상품 둘러보기",
  },
  en: {
    navigationLabel: "Home story chapters",
    skipLabel: "Skip to the latest memes",
    sceneLabel: "An orange sculptural scene moving through meme discovery, context, and participation",
    pauseScene: "Pause scene",
    playScene: "Play scene",
    chapters: [
      {
        id: "discover",
        href: "#home-story-discover",
        navigationLabel: "Discover",
        eyebrow: "01 · DISCOVER",
        title: "Catch the meme. Follow the meaning.",
        description: "Start with a name, a phrase, or the detail you remember from a Korean meme or piece of slang.",
      },
      {
        id: "context",
        href: "#home-story-context",
        navigationLabel: "Context",
        eyebrow: "02 · CONTEXT",
        title: "Read the moment around it before you repeat it.",
        description: "Meaning, origin, and current usage signals show how the same expression can change across situations.",
      },
      {
        id: "participate",
        href: "#home-story-participate",
        navigationLabel: "Participate",
        eyebrow: "03 · PARTICIPATE",
        title: "Once you understand it, add to the story.",
        description: "Share the context you found with the community, or browse meme goods with seller relationships shown clearly.",
      },
    ],
    search: {
      label: "Search memes",
      placeholder: "Search a Korean meme or phrase",
      button: "Search",
    },
    contextAction: "See the four usage signals",
    communityAction: "Visit the community",
    productsAction: "Browse meme products",
  },
  ja: {
    navigationLabel: "ホームストーリーのチャプター",
    skipLabel: "新着ミームへ移動",
    sceneLabel: "ミームの発見、文脈、参加をひとつの流れで描くオレンジ色の立体シーン",
    pauseScene: "シーンを停止",
    playScene: "シーンを再生",
    chapters: [
      {
        id: "discover",
        href: "#home-story-discover",
        navigationLabel: "発見",
        eyebrow: "01 · DISCOVER",
        title: "ミームを見つけて、文脈まで読み解く。",
        description: "名前や覚えているフレーズから、気になる韓国ミームや流行語を探せます。",
      },
      {
        id: "context",
        href: "#home-story-context",
        navigationLabel: "文脈",
        eyebrow: "02 · CONTEXT",
        title: "使う前に、そのミームを取り巻く文脈から。",
        description: "意味と由来、現在の使用シグナルを一緒に読むと、場面による違いが見えてきます。",
      },
      {
        id: "participate",
        href: "#home-story-participate",
        navigationLabel: "参加",
        eyebrow: "03 · PARTICIPATE",
        title: "理解したら、次の文脈に参加する。",
        description: "見つけた場面をコミュニティで共有し、販売者との関係が明示されたミーム商品も探せます。",
      },
    ],
    search: {
      label: "ミームを検索",
      placeholder: "韓国のミームや流行語を検索",
      button: "検索",
    },
    contextAction: "4つの使用シグナルを見る",
    communityAction: "コミュニティを見る",
    productsAction: "ミーム商品を見る",
  },
  zh: {
    navigationLabel: "首页故事章节",
    skipLabel: "跳到最新迷因",
    sceneLabel: "以橙色立体场景串联迷因的发现、语境与参与",
    pauseScene: "暂停场景",
    playScene: "播放场景",
    chapters: [
      {
        id: "discover",
        href: "#home-story-discover",
        navigationLabel: "发现",
        eyebrow: "01 · DISCOVER",
        title: "找到迷因，沿着线索读懂含义。",
        description: "从名称、记得的词句或画面出发，搜索你想了解的韩国迷因与流行语。",
      },
      {
        id: "context",
        href: "#home-story-context",
        navigationLabel: "语境",
        eyebrow: "02 · CONTEXT",
        title: "转发之前，先读懂它周围的语境。",
        description: "结合含义、来源与当前使用提示，了解同一个表达在不同场景中会如何变化。",
      },
      {
        id: "participate",
        href: "#home-story-participate",
        navigationLabel: "参与",
        eyebrow: "03 · PARTICIPATE",
        title: "理解之后，一起补充下一段故事。",
        description: "在社区分享你发现的使用场景，或浏览清楚标明卖家关联关系的迷因商品。",
      },
    ],
    search: {
      label: "搜索迷因",
      placeholder: "搜索韩国迷因或流行语",
      button: "搜索",
    },
    contextAction: "查看四种使用提示",
    communityAction: "前往社区",
    productsAction: "浏览迷因商品",
  },
  "zh-tw": {
    navigationLabel: "首頁故事章節",
    skipLabel: "跳到最新迷因",
    sceneLabel: "以橙色立體場景串聯迷因的發現、語境與參與",
    pauseScene: "暫停場景",
    playScene: "播放場景",
    chapters: [
      {
        id: "discover",
        href: "#home-story-discover",
        navigationLabel: "發現",
        eyebrow: "01 · DISCOVER",
        title: "找到迷因，沿著線索讀懂含義。",
        description: "從名稱、記得的詞句或畫面出發，搜尋你想了解的韓國迷因與流行語。",
      },
      {
        id: "context",
        href: "#home-story-context",
        navigationLabel: "語境",
        eyebrow: "02 · CONTEXT",
        title: "轉發之前，先讀懂它周圍的語境。",
        description: "結合含義、來源與目前的使用提示，了解同一個表達在不同場景中會如何變化。",
      },
      {
        id: "participate",
        href: "#home-story-participate",
        navigationLabel: "參與",
        eyebrow: "03 · PARTICIPATE",
        title: "理解之後，一起補充下一段故事。",
        description: "在社群分享你發現的使用場景，或瀏覽清楚標示賣家關聯關係的迷因商品。",
      },
    ],
    search: {
      label: "搜尋迷因",
      placeholder: "搜尋韓國迷因或流行語",
      button: "搜尋",
    },
    contextAction: "查看四種使用提示",
    communityAction: "前往社群",
    productsAction: "瀏覽迷因商品",
  },
};
