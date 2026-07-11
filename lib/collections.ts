import type { MemeCategory } from "@/lib/labels";

/**
 * 테마별 밈 모음(허브 페이지) 정의 — /collections/[slug].
 * 목적: "2000년대 밈", "유행어 모음" 같은 미드테일 검색 유입 + 내부 링크 허브.
 * intro는 각 허브의 고유 텍스트(씬 콘텐츠 방지 + AI 인용 블록).
 */
export type CollectionDef = {
  slug: string;
  title: string;
  /** 검색 스니펫용 한 줄 */
  description: string;
  /** 페이지 상단 소개 문단 (2~3문장, 고유 작성) */
  intro: string;
  filter:
    | { kind: "decade"; from: number; to: number }
    | { kind: "category"; category: MemeCategory }
    | { kind: "beginner" }
    | { kind: "latest" };
  /** /explore로 이어지는 필터 쿼리스트링 */
  exploreQuery: string;
};

export const COLLECTIONS: CollectionDef[] = [
  {
    slug: "2020s",
    title: "2020년대 밈 모음",
    description: "코로나 시대부터 지금까지 — 2020년대를 정의한 한국 밈 총정리.",
    intro:
      "숏폼이 밈의 수명을 바꿔 놓은 시대. 2020년대 밈은 틱톡·유튜브 쇼츠에서 태어나 며칠 만에 전국으로 퍼지고, 몇 달 만에 식습니다. 코로나 시기의 방송 밈부터 최신 챌린지까지, 지금 써도 되는지 신호등과 함께 확인하세요.",
    filter: { kind: "decade", from: 2020, to: 2029 },
    exploreQuery: "year=2020s",
  },
  {
    slug: "2010s",
    title: "2010년대 밈 모음",
    description: "급식체·페북 감성·초기 유튜브 — 2010년대 한국 밈 총정리.",
    intro:
      "SNS가 밈의 놀이터가 된 시대. 급식체와 인터넷 방송 유행어가 교실을 점령했고, 예능 자막이 그대로 밈이 됐습니다. 지금 쓰면 '아재' 소리를 들을 수도 있는 밈들 — 어떤 게 아직 살아있는지 생명 게이지로 확인하세요.",
    filter: { kind: "decade", from: 2010, to: 2019 },
    exploreQuery: "year=2010s",
  },
  {
    slug: "2000s",
    title: "2000년대 밈 모음",
    description: "싸이월드·디시·플래시 시대 — 2000년대 추억의 한국 밈 총정리.",
    intro:
      "인터넷 밈이라는 개념이 한국에 뿌리내린 시대. 디시인사이드 짤방, 싸이월드 감성, 플래시 애니메이션이 유행을 만들었습니다. 회식 자리에서 '라떼' 인증이 될 수 있는 추억의 밈들을 모았습니다.",
    filter: { kind: "decade", from: 2000, to: 2009 },
    exploreQuery: "year=2000s",
  },
  {
    slug: "classic",
    title: "1990년대 클래식 밈 모음",
    description: "TV·CF·초기 PC통신 — 1990년대에 태어난 원조 유행어 총정리.",
    intro:
      "밈이라는 말이 없던 시절의 밈. 개그 프로그램 유행어와 CF 카피가 전 국민의 입에 붙었고, 일부는 30년이 지난 지금도 리메이크되어 돌아옵니다. 한국 밈의 뿌리를 만나보세요.",
    filter: { kind: "decade", from: 1980, to: 1999 },
    exploreQuery: "", // explore에 90s 필터 없음 — 전체 탐색으로
  },
  {
    slug: "phrase",
    title: "유행어 모음",
    description: "지금 도는 한국 유행어 — 뜻·유래·사용 안전도까지 한 번에.",
    intro:
      "대화에서 가장 많이 마주치는 밈. 유행어는 수명이 짧고 뉘앙스가 미묘해서, 뜻만 알고 쓰면 어색해지기 쉽습니다. 각 유행어의 유래와 '지금 써도 되는지'까지 신호등으로 정리했습니다.",
    filter: { kind: "category", category: "phrase" },
    exploreQuery: "category=phrase",
  },
  {
    slug: "challenge",
    title: "챌린지 모음",
    description: "틱톡·쇼츠를 달군 한국 챌린지 — 원본 영상과 함께 총정리.",
    intro:
      "따라 하면서 퍼지는 밈. 챌린지는 원본 영상을 알아야 재미가 완성됩니다. 대표 영상 임베드와 함께, 이미 식은 챌린지인지 아직 뜨거운지 생명 게이지로 확인하세요.",
    filter: { kind: "category", category: "challenge" },
    exploreQuery: "category=challenge",
  },
  {
    slug: "song",
    title: "밈송·노래 밈 모음",
    description: "한 소절만 들어도 아는 밈송 — 원곡과 유행 맥락 총정리.",
    intro:
      "귀에 박히는 순간 밈이 되는 노래들. 광고 CM송부터 역주행 밈송까지, 어떤 맥락에서 왜 유행했는지와 대표 영상을 함께 정리했습니다.",
    filter: { kind: "category", category: "song" },
    exploreQuery: "category=song",
  },
  {
    slug: "image",
    title: "짤 모음",
    description: "대화방 필수 짤 — 유래와 쓰는 상황까지 정리한 한국 짤 사전.",
    intro:
      "말보다 빠른 대답, 짤. 어디서 나온 장면인지 알고 쓰면 두 배 재밌습니다. 각 짤의 원출처와 어떤 상황에서 쓰는지, 출처 링크와 함께 모았습니다.",
    filter: { kind: "category", category: "image" },
    exploreQuery: "category=image",
  },
  {
    slug: "beginner",
    title: "밈 입문 — 왕초보 필수 밈",
    description: "요즘 대화를 따라가기 위한 최소한의 밈 — 입문자용 큐레이션.",
    intro:
      "밈을 하나도 모르겠다면 여기서 시작하세요. 난이도 '입문'으로 분류된, 지금 알아두면 대화가 편해지는 밈만 골랐습니다. 전부 사용 안전 신호등 초록·노랑 위주라 바로 써도 부담 없습니다.",
    filter: { kind: "beginner" },
    exploreQuery: "difficulty=beginner",
  },
  {
    slug: "latest",
    title: "최신 밈 — 이번 달 새로 등록된 밈",
    description: "밈캐치에 막 등록된 최신 밈 — 지금 뜨는 것부터 확인.",
    intro:
      "사전에 방금 올라온 따끈한 밈들. 급상승 중인 밈은 생명 게이지가 불꽃 4칸입니다. 유행 초입에 알아두면 '요즘 애들 말'을 실시간으로 따라갈 수 있습니다.",
    filter: { kind: "latest" },
    exploreQuery: "sort=recent",
  },
];

export function getCollection(slug: string): CollectionDef | undefined {
  return COLLECTIONS.find((c) => c.slug === slug);
}
