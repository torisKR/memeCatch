import type { SeoRouteLocale } from "@/lib/i18n-routing";

type HomeChapter = {
  href:
    | "#home-top"
    | "#home-latest"
    | "#home-signals"
    | "#home-pathways"
    | "#home-editorial";
  label: string;
};

export type HomeWeb3Copy = {
  chapterLabel: string;
  chapters: readonly [HomeChapter, HomeChapter, HomeChapter, HomeChapter, HomeChapter];
  hero: {
    exploreAction: string;
    communityAction: string;
  };
  pathways: {
    communityMark: string;
  };
};

export const HOME_WEB3_COPY: Record<SeoRouteLocale, HomeWeb3Copy> = {
  ko: {
    chapterLabel: "홈 섹션 바로가기",
    chapters: [
      { href: "#home-top", label: "처음" },
      { href: "#home-latest", label: "최신 밈" },
      { href: "#home-signals", label: "사용 신호" },
      { href: "#home-pathways", label: "커뮤니티" },
      { href: "#home-editorial", label: "편집 원칙" },
    ],
    hero: {
      exploreAction: "최신 밈 보기",
      communityAction: "커뮤니티 가기",
    },
    pathways: {
      communityMark: "대화가 설명을 완성합니다",
    },
  },
  en: {
    chapterLabel: "Home sections",
    chapters: [
      { href: "#home-top", label: "Top" },
      { href: "#home-latest", label: "Latest" },
      { href: "#home-signals", label: "Usage signals" },
      { href: "#home-pathways", label: "Community" },
      { href: "#home-editorial", label: "Editorial" },
    ],
    hero: {
      exploreAction: "Explore latest",
      communityAction: "Visit community",
    },
    pathways: {
      communityMark: "Conversation completes the context",
    },
  },
  ja: {
    chapterLabel: "ホームのセクション",
    chapters: [
      { href: "#home-top", label: "トップ" },
      { href: "#home-latest", label: "新着" },
      { href: "#home-signals", label: "使用シグナル" },
      { href: "#home-pathways", label: "コミュニティ" },
      { href: "#home-editorial", label: "編集方針" },
    ],
    hero: {
      exploreAction: "新着ミームを見る",
      communityAction: "コミュニティを見る",
    },
    pathways: {
      communityMark: "会話から文脈が見えてきます",
    },
  },
  zh: {
    chapterLabel: "首页章节",
    chapters: [
      { href: "#home-top", label: "顶部" },
      { href: "#home-latest", label: "最新内容" },
      { href: "#home-signals", label: "使用提示" },
      { href: "#home-pathways", label: "社区" },
      { href: "#home-editorial", label: "编辑原则" },
    ],
    hero: {
      exploreAction: "查看最新迷因",
      communityAction: "前往社区",
    },
    pathways: {
      communityMark: "通过讨论补充语境",
    },
  },
  "zh-tw": {
    chapterLabel: "首頁章節",
    chapters: [
      { href: "#home-top", label: "頂部" },
      { href: "#home-latest", label: "最新內容" },
      { href: "#home-signals", label: "使用提示" },
      { href: "#home-pathways", label: "社群" },
      { href: "#home-editorial", label: "編輯原則" },
    ],
    hero: {
      exploreAction: "查看最新迷因",
      communityAction: "前往社群",
    },
    pathways: {
      communityMark: "透過討論補充語境",
    },
  },
};
