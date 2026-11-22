/** How many items each meme feed carries. */
export const MEME_FEED_ITEM_LIMIT = 30;

/**
 * Feeds advertised in the Korean document head and in llms.txt.
 * `/feed.xml` lists newly published memes. `/feed/updated.xml` lists memes
 * whose body changed most recently, so search crawlers that use a feed as a
 * seed (Daum Webmaster "수집 Seed URL", for example) revisit rewritten pages.
 */
export const MEME_FEEDS = {
  new: {
    path: "/feed.xml",
    title: "밈캐치 — 새로 등록된 밈",
    description:
      "요즘 유행하는 밈·유행어·챌린지의 뜻과 유래, 그리고 지금 써도 되는지까지. 최근 등록된 밈 30개를 전해드려요.",
  },
  updated: {
    path: "/feed/updated.xml",
    title: "밈캐치 — 최근 내용이 바뀐 밈",
    description:
      "뜻·유래·사용 예시가 최근에 보강되거나 고쳐진 밈 30개를 전해드려요.",
  },
} as const;

export type MemeFeedKind = keyof typeof MEME_FEEDS;
